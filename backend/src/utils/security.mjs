import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from '../config.mjs';

const scrypt = promisify(scryptCallback);
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex');
export const secretHash = (value) => sha256(`${config.oauthStateSecret || 'rankforge-development-pepper'}:${value}`);
export function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt}$${Buffer.from(derived).toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [algorithm, n, r, p, salt, digest] = String(stored).split('$');
    if (algorithm !== 'scrypt' || !salt || !digest) return false;
    const derived = await scrypt(password, salt, 64, { N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 });
    return safeEqual(Buffer.from(derived).toString('hex'), digest);
  } catch {
    return false;
  }
}
export function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91') && /^[6-9]/.test(digits.slice(2))) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) return `+91${digits.slice(1)}`;
  return null;
}
export function publicUser(row) {
  return { id: row.id, name: row.name, email: row.email, phone: row.phone, emailVerified: Boolean(row.email_verified_at), phoneVerified: Boolean(row.phone_verified_at), createdAt: row.created_at };
}
