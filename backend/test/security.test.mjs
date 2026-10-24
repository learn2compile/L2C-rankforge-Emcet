import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, normalizePhone, randomToken, safeEqual, sha256, hashPassword, verifyPassword } from '../src/utils/security.mjs';

test('email normalization trims and lowercases', () => {
  assert.equal(normalizeEmail('  Student@Example.COM '), 'student@example.com');
});

test('Indian mobile numbers normalize to E.164', () => {
  assert.equal(normalizePhone('9876543210'), '+919876543210');
  assert.equal(normalizePhone('+91 98765 43210'), '+919876543210');
  assert.equal(normalizePhone('12345'), null);
});

test('opaque tokens are random-looking and hash deterministically', () => {
  const token = randomToken();
  assert.ok(token.length >= 40);
  assert.equal(sha256(token), sha256(token));
  assert.notEqual(sha256(token), sha256(randomToken()));
});

test('constant-time comparison helper rejects mismatched values', () => {
  assert.equal(safeEqual('same', 'same'), true);
  assert.equal(safeEqual('same', 'different'), false);
  assert.equal(safeEqual('short', 'longer'), false);
});

test('password hashes verify correctly without storing the plaintext', async () => {
  const password = 'RankForge-test-password-2026';
  const hash = await hashPassword(password);
  assert.ok(hash.startsWith('scrypt$'));
  assert.equal(hash.includes(password), false);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong-password', hash), false);
});
