import { randomUUID } from 'node:crypto';
import { config } from '../config.mjs';
import { safeEqual } from '../utils/security.mjs';

export function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (config.isProduction) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
}

export function corsPolicy(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.', requestId: req.requestId } });
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-CSRF-Token,X-Request-Id');
    res.setHeader('Access-Control-Expose-Headers', 'X-Request-Id,Retry-After');
  }
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
}

export function originGuard(req, res, next) {
  const origin = req.headers.origin;
  if (origin && !config.allowedOrigins.includes(origin)) return res.status(403).json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'This origin is not allowed.', requestId: req.requestId } });
  next();
}

export function csrfGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = req.cookies?.rf_csrf;
  const header = req.get('X-CSRF-Token');
  if (!cookie || !header || !safeEqual(cookie, header)) {
    return res.status(403).json({ error: { code: 'CSRF_VALIDATION_FAILED', message: 'Your security token expired. Refresh the page and try again.', requestId: req.requestId } });
  }
  next();
}

export function createRateLimiter({ windowMs = 15 * 60_000, max = 20, keyPrefix = 'auth' } = {}) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = `${keyPrefix}:${req.ip || req.socket.remoteAddress || 'unknown'}`;
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) bucket = { count: 0, resetAt: now + windowMs };
    bucket.count += 1;
    buckets.set(key, bucket);
    if (buckets.size > 10_000) {
      for (const [bucketKey, value] of buckets) if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Please wait and try again.', requestId: req.requestId } });
    }
    buckets.set(key, bucket);
    next();
  };
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  const status = Number.isInteger(error.status) ? error.status : 500;
  if (status >= 500) console.error(JSON.stringify({ level: 'error', requestId: req.requestId, message: error.message }));
  const message = status >= 500 ? 'Something went wrong. Please try again.' : error.message;
  res.status(status).json({ error: { code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'), message, ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}), requestId: req.requestId } });
}
