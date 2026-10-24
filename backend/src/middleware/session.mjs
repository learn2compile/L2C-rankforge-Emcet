import { pool } from '../db/pool.mjs';
import { config } from '../config.mjs';
import { sha256, publicUser } from '../utils/security.mjs';

export function parseCookies(req, res, next) {
  const cookies = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = value; }
  }
  req.cookies = cookies;
  next();
}

export function cookieOptions({ httpOnly = true, maxAge = undefined, sameSite = 'lax' } = {}) {
  return { httpOnly, secure: config.isProduction, sameSite, path: '/', ...(config.cookieDomain ? { domain: config.cookieDomain } : {}), ...(maxAge === undefined ? {} : { maxAge }) };
}
export function setCsrfCookie(res, token) {
  res.cookie('rf_csrf', token, cookieOptions({ httpOnly: false, maxAge: 2 * 60 * 60 * 1000 }));
}
export function setSessionCookie(res, token) {
  res.cookie('rf_session', token, cookieOptions({ httpOnly: true, maxAge: config.sessionTtlDays * 24 * 60 * 60 * 1000 }));
}
export function clearSessionCookie(res) { res.clearCookie('rf_session', cookieOptions()); }
export function clearOauthCookie(res) { res.clearCookie('rf_oauth_state', cookieOptions({ httpOnly: true })); }

export async function createSession(userId, res) {
  const raw = (await import('node:crypto')).randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + config.sessionTtlDays * 24 * 60 * 60 * 1000);
  await pool.query('INSERT INTO sessions(user_id, token_hash, expires_at) VALUES ($1, $2, $3)', [userId, sha256(raw), expiresAt]);
  setSessionCookie(res, raw);
  return expiresAt;
}

export async function optionalSession(req, res, next) {
  try {
    const raw = req.cookies?.rf_session;
    if (!raw) { req.user = null; return next(); }
    const result = await pool.query(`SELECT u.*, s.id AS session_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > NOW() AND u.status = 'active' LIMIT 1`, [sha256(raw)]);
    if (!result.rowCount) { req.user = null; return next(); }
    req.user = result.rows[0];
    await pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = $1', [req.user.session_id]);
    next();
  } catch (error) { next(error); }
}

export function requireSession(req, res, next) {
  if (!req.user) return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.', requestId: req.requestId } });
  next();
}
export { publicUser };
