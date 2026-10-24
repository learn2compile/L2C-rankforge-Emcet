import { Router } from 'express';
import { randomInt } from 'node:crypto';
import { pool } from '../db/pool.mjs';
import { withTransaction } from '../db/transaction.mjs';
import { config } from '../config.mjs';
import { createRateLimiter } from '../middleware/security.mjs';
import { clearOauthCookie, clearSessionCookie, createSession, optionalSession, publicUser, requireSession, setCsrfCookie, cookieOptions } from '../middleware/session.mjs';
import { deliveryStatus, sendEmail, sendSms } from '../services/delivery.mjs';
import { hashPassword, normalizeEmail, normalizePhone, randomToken, safeEqual, secretHash, sha256, verifyPassword } from '../utils/security.mjs';

export const authRouter = Router();
const standardLimiter = createRateLimiter({ max: 20, keyPrefix: 'auth' });
const sensitiveLimiter = createRateLimiter({ max: 8, windowMs: 15 * 60_000, keyPrefix: 'sensitive-auth' });
const otpLimiter = createRateLimiter({ max: 5, windowMs: 10 * 60_000, keyPrefix: 'phone-otp' });
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordValid = (value) => typeof value === 'string' && value.length >= 8 && value.length <= 128;
const cleanName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const frontendLink = (path, token) => `${config.frontendUrl.replace(/\/$/, '')}${path}?token=${encodeURIComponent(token)}`;
const requestError = (status, code, message, fieldErrors) => Object.assign(new Error(message), { status, code, fieldErrors });

function newCsrf(req, res) {
  const token = randomToken(24);
  setCsrfCookie(res, token);
  return token;
}
async function issueAuthToken(userId, purpose, hours) {
  const raw = randomToken(32);
  await pool.query('UPDATE auth_tokens SET consumed_at = NOW() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL', [userId, purpose]);
  await pool.query('INSERT INTO auth_tokens(user_id, purpose, token_hash, expires_at) VALUES ($1,$2,$3,NOW() + ($4 * INTERVAL \'1 hour\'))', [userId, purpose, sha256(raw), hours]);
  return raw;
}
async function deliverOrReturnDev({ to, subject, text, html, token, purpose }) {
  try {
    const result = await sendEmail({ to, subject, text, html });
    if (!result.delivered && config.isProduction) throw new Error('Email provider is not configured.');
    return { delivered: result.delivered, ...(config.exposeDevCodes && !result.delivered ? { [`dev${purpose}Token`]: token } : {}) };
  } catch (error) {
    if (config.isProduction) throw requestError(503, 'DELIVERY_UNAVAILABLE', 'Message delivery is temporarily unavailable. Please try again later.');
    console.error(JSON.stringify({ level: 'warn', event: 'email_delivery_failed', message: error.message }));
    return { delivered: false, ...(config.exposeDevCodes ? { [`dev${purpose}Token`]: token } : {}) };
  }
}

// Creates a readable double-submit CSRF cookie. The token itself is not an authentication credential.
authRouter.get('/csrf', (req, res) => res.json({ csrfToken: newCsrf(req, res) }));
authRouter.get('/providers', (req, res) => res.json({ providers: deliveryStatus(), developmentCodesExposed: !config.isProduction && config.exposeDevCodes }));

authRouter.get('/session', optionalSession, (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

authRouter.post('/register', standardLimiter, async (req, res, next) => {
  try {
    const name = cleanName(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    const fieldErrors = {};
    if (name.length < 2 || name.length > 120) fieldErrors.name = 'Enter a name between 2 and 120 characters.';
    if (!emailPattern.test(email) || email.length > 320) fieldErrors.email = 'Enter a valid email address.';
    if (!passwordValid(password)) fieldErrors.password = 'Password must be 8–128 characters.';
    if (Object.keys(fieldErrors).length) throw requestError(422, 'VALIDATION_FAILED', 'Check the highlighted fields and try again.', fieldErrors);
    const exists = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (exists.rowCount) return res.status(202).json({ message: 'If this address can be registered, verification instructions will be sent.' });
    const passwordHash = await hashPassword(password);
    const inserted = await pool.query(`INSERT INTO users(name,email,password_hash) VALUES ($1,$2,$3) RETURNING id`, [name, email, passwordHash]);
    const userId = inserted.rows[0].id;
    const token = await issueAuthToken(userId, 'email_verify', 24);
    const link = frontendLink('/auth/verify-email', token);
    const delivery = await deliverOrReturnDev({ to: email, subject: 'Verify your RankForge email', text: `Welcome to RankForge. Verify your email: ${link}`, html: `<p>Welcome to RankForge.</p><p><a href="${link}">Verify your email address</a></p>`, token, purpose: 'Verification' });
    return res.status(202).json({ message: 'Account created. Check your inbox for a verification link.', deliveryConfigured: delivery.delivered, ...(delivery.devVerificationToken ? { devVerificationToken: delivery.devVerificationToken } : {}) });
  } catch (error) { next(error); }
});

authRouter.post('/login', standardLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!emailPattern.test(email) || typeof password !== 'string' || password.length > 128) throw requestError(422, 'VALIDATION_FAILED', 'Enter a valid email and password.');
    const result = await pool.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [email]);
    const user = result.rows[0];
    // A dummy scrypt comparison reduces the obvious timing difference for unknown accounts.
    const passwordOk = user?.password_hash ? await verifyPassword(password, user.password_hash) : (await hashPassword(`unknown-account:${randomToken(16)}`), false);
    if (!user || !passwordOk || user.status !== 'active') throw requestError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    if (!user.email_verified_at) throw requestError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email address before signing in. You can request a new verification link.');
    await createSession(user.id, res);
    return res.json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

authRouter.post('/logout', optionalSession, async (req, res, next) => {
  try {
    const raw = req.cookies?.rf_session;
    if (raw) await pool.query('DELETE FROM sessions WHERE token_hash = $1', [sha256(raw)]);
    clearSessionCookie(res);
    return res.status(204).end();
  } catch (error) { next(error); }
});

authRouter.post('/verify-email', sensitiveLimiter, async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    if (token.length < 20 || token.length > 200) throw requestError(400, 'INVALID_TOKEN', 'This verification link is invalid or expired. Request a new one.');
    const user = await withTransaction(async (client) => {
      const result = await client.query(`SELECT t.id AS token_id, u.id, u.name, u.email, u.phone, u.email_verified_at, u.phone_verified_at, u.created_at, u.status FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1 AND t.purpose = 'email_verify' AND t.consumed_at IS NULL AND t.expires_at > NOW() AND u.status = 'active' LIMIT 1 FOR UPDATE OF t`, [sha256(token)]);
      const matched = result.rows[0];
      if (!matched) throw requestError(400, 'INVALID_TOKEN', 'This verification link is invalid or expired. Request a new one.');
      await client.query('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = $1', [matched.token_id]);
      const updated = await client.query('UPDATE users SET email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW() WHERE id = $1 RETURNING id,name,email,phone,email_verified_at,phone_verified_at,created_at,status', [matched.id]);
      return updated.rows[0];
    });
    await createSession(user.id, res);
    return res.json({ message: 'Email verified successfully.', user: publicUser(user) });
  } catch (error) { next(error); }
});

authRouter.post('/resend-verification', sensitiveLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const response = { message: 'If the address has an unverified account, a verification link will be sent.' };
    if (!emailPattern.test(email)) return res.status(202).json(response);
    const result = await pool.query('SELECT id,email,email_verified_at FROM users WHERE email = $1 LIMIT 1', [email]);
    const user = result.rows[0];
    if (!user || user.email_verified_at) return res.status(202).json(response);
    const token = await issueAuthToken(user.id, 'email_verify', 24);
    const link = frontendLink('/auth/verify-email', token);
    const delivery = await deliverOrReturnDev({ to: email, subject: 'Your RankForge verification link', text: `Verify your email: ${link}`, html: `<p><a href="${link}">Verify your email address</a></p>`, token, purpose: 'Verification' });
    return res.status(202).json({ ...response, ...(delivery.devVerificationToken ? { devVerificationToken: delivery.devVerificationToken } : {}) });
  } catch (error) { next(error); }
});

authRouter.post('/forgot-password', sensitiveLimiter, async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const response = { message: 'If an account matches that address, password-reset instructions will be sent.' };
    if (!emailPattern.test(email)) return res.status(202).json(response);
    const result = await pool.query('SELECT id,email FROM users WHERE email = $1 AND status = \'active\' LIMIT 1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(202).json(response);
    const token = await issueAuthToken(user.id, 'password_reset', 1);
    const link = frontendLink('/auth/reset-password', token);
    const delivery = await deliverOrReturnDev({ to: email, subject: 'Reset your RankForge password', text: `Reset your password within one hour: ${link}`, html: `<p><a href="${link}">Reset your password</a> (link expires in one hour).</p>`, token, purpose: 'Reset' });
    return res.status(202).json({ ...response, ...(delivery.devResetToken ? { devResetToken: delivery.devResetToken } : {}) });
  } catch (error) { next(error); }
});

authRouter.post('/reset-password', sensitiveLimiter, async (req, res, next) => {
  try {
    const token = String(req.body?.token || '');
    const password = req.body?.password;
    if (!passwordValid(password)) throw requestError(422, 'VALIDATION_FAILED', 'Password must be 8–128 characters.', { password: 'Password must be 8–128 characters.' });
    const passwordHash = await hashPassword(password);
    await withTransaction(async (client) => {
      const result = await client.query(`SELECT t.id AS token_id, u.id AS user_id FROM auth_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = $1 AND t.purpose = 'password_reset' AND t.consumed_at IS NULL AND t.expires_at > NOW() LIMIT 1 FOR UPDATE OF t`, [sha256(token)]);
      const row = result.rows[0];
      if (!row) throw requestError(400, 'INVALID_TOKEN', 'This password-reset link is invalid or expired. Request another one.');
      await client.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [passwordHash, row.user_id]);
      await client.query('UPDATE auth_tokens SET consumed_at = NOW() WHERE id = $1', [row.token_id]);
      await client.query('DELETE FROM sessions WHERE user_id = $1', [row.user_id]);
    });
    clearSessionCookie(res);
    return res.json({ message: 'Password updated. Sign in with your new password.' });
  } catch (error) { next(error); }
});

authRouter.post('/otp/start', otpLimiter, async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    if (!phone) throw requestError(422, 'VALIDATION_FAILED', 'Enter a valid Indian mobile number.', { phone: 'Enter a valid Indian mobile number.' });
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await pool.query('UPDATE phone_otps SET consumed_at = NOW() WHERE phone = $1 AND consumed_at IS NULL', [phone]);
    await pool.query('INSERT INTO phone_otps(phone,code_hash,expires_at) VALUES ($1,$2,NOW() + INTERVAL \'5 minutes\')', [phone, secretHash(`${phone}:${code}`)]);
    let delivered = false;
    try {
      const result = await sendSms({ to: phone, message: `Your RankForge sign-in code is ${code}. It expires in 5 minutes. Do not share it.` });
      delivered = result.delivered;
      if (!delivered && config.isProduction) throw new Error('SMS provider is not configured.');
    } catch (error) {
      if (config.isProduction) throw requestError(503, 'SMS_UNAVAILABLE', 'SMS delivery is temporarily unavailable. Please try again later.');
      console.error(JSON.stringify({ level: 'warn', event: 'sms_delivery_failed', message: error.message }));
    }
    return res.status(202).json({ message: 'If delivery is configured, a sign-in code has been sent. The code expires in 5 minutes.', deliveryConfigured: delivered, ...(!delivered && !config.isProduction && config.exposeDevCodes ? { devOtpCode: code } : {}) });
  } catch (error) { next(error); }
});

authRouter.post('/otp/verify', otpLimiter, async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body?.phone);
    const code = String(req.body?.code || '');
    if (!phone || !/^\d{6}$/.test(code)) throw requestError(422, 'VALIDATION_FAILED', 'Enter a valid mobile number and six-digit code.');
    const result = await pool.query(`SELECT * FROM phone_otps WHERE phone = $1 AND consumed_at IS NULL AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1`, [phone]);
    const otp = result.rows[0];
    if (!otp || otp.attempts >= 5 || !safeEqual(otp.code_hash, secretHash(`${phone}:${code}`))) {
      if (otp) await pool.query('UPDATE phone_otps SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
      throw requestError(401, 'INVALID_OTP', 'That code is incorrect or expired. Request a new one.');
    }
    await pool.query('UPDATE phone_otps SET consumed_at = NOW() WHERE id = $1', [otp.id]);
    let userResult = await pool.query('SELECT * FROM users WHERE phone = $1 LIMIT 1', [phone]);
    if (!userResult.rowCount) {
      userResult = await pool.query(`INSERT INTO users(name,phone,phone_verified_at) VALUES ('Student',$1,NOW()) RETURNING *`, [phone]);
    } else {
      await pool.query('UPDATE users SET phone_verified_at = COALESCE(phone_verified_at,NOW()), updated_at = NOW() WHERE id = $1', [userResult.rows[0].id]);
      userResult = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [userResult.rows[0].id]);
    }
    const user = userResult.rows[0];
    if (user.status !== 'active') throw requestError(403, 'ACCOUNT_DISABLED', 'This account is unavailable. Contact support.');
    await createSession(user.id, res);
    return res.json({ user: publicUser(user), message: 'Phone verified. You are signed in.' });
  } catch (error) { next(error); }
});

authRouter.get('/google', standardLimiter, async (req, res, next) => {
  try {
    if (!config.googleClientId || !config.googleClientSecret) return res.status(503).send('Google sign-in is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to the backend environment.');
    const state = randomToken(32);
    await pool.query('INSERT INTO oauth_states(state_hash,expires_at) VALUES ($1,NOW() + INTERVAL \'10 minutes\')', [sha256(state)]);
    res.cookie('rf_oauth_state', state, cookieOptions({ httpOnly: true, maxAge: 10 * 60 * 1000 }));
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', config.googleClientId);
    url.searchParams.set('redirect_uri', config.googleCallbackUrl);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');
    return res.redirect(url.toString());
  } catch (error) { next(error); }
});

authRouter.get('/google/callback', async (req, res, next) => {
  try {
    const { code, state, error: oauthError } = req.query;
    const failUrl = `${config.frontendUrl.replace(/\/$/, '')}/auth/login?oauth=failed`;
    if (oauthError || typeof code !== 'string' || typeof state !== 'string' || !safeEqual(state, req.cookies?.rf_oauth_state || '')) return res.redirect(failUrl);
    const stateResult = await pool.query('UPDATE oauth_states SET consumed_at = NOW() WHERE state_hash = $1 AND consumed_at IS NULL AND expires_at > NOW() RETURNING id', [sha256(state)]);
    clearOauthCookie(res);
    if (!stateResult.rowCount) return res.redirect(failUrl);
    const exchange = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, client_id: config.googleClientId, client_secret: config.googleClientSecret, redirect_uri: config.googleCallbackUrl, grant_type: 'authorization_code' }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!exchange.ok) return res.redirect(failUrl);
    const tokenResponse = await exchange.json();
    if (typeof tokenResponse.id_token !== 'string') return res.redirect(failUrl);
    const infoResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenResponse.id_token)}`, { signal: AbortSignal.timeout(8_000) });
    if (!infoResponse.ok) return res.redirect(failUrl);
    const info = await infoResponse.json();
    if (info.aud !== config.googleClientId || !['accounts.google.com', 'https://accounts.google.com'].includes(info.iss) || info.email_verified !== 'true' || !info.email) return res.redirect(failUrl);
    const email = normalizeEmail(info.email);
    let userResult = await pool.query('SELECT * FROM users WHERE google_sub = $1 OR email = $2 LIMIT 1', [info.sub, email]);
    let user;
    if (userResult.rowCount) {
      user = userResult.rows[0];
      if (user.status !== 'active') return res.redirect(failUrl);
      const updated = await pool.query('UPDATE users SET google_sub = COALESCE(google_sub,$1), email_verified_at = COALESCE(email_verified_at,NOW()), updated_at = NOW() WHERE id = $2 RETURNING *', [info.sub, user.id]);
      user = updated.rows[0];
    } else {
      const inserted = await pool.query('INSERT INTO users(name,email,email_verified_at,google_sub) VALUES ($1,$2,NOW(),$3) RETURNING *', [cleanName(info.name) || email.split('@')[0], email, info.sub]);
      user = inserted.rows[0];
    }
    await createSession(user.id, res);
    return res.redirect(`${config.frontendUrl.replace(/\/$/, '')}/home?oauth=success`);
  } catch (error) { next(error); }
});

authRouter.get('/me', optionalSession, requireSession, (req, res) => res.json({ user: publicUser(req.user) }));
