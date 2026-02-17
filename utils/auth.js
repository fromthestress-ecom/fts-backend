import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const HASH_ITERATIONS = 100000;
const KEY_LEN = 64;
const JWT_SECRET = process.env.JWT_SECRET || 'streetwear-dev-secret-change-in-production';
const JWT_EXPIRES = '1h';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, KEY_LEN, 'sha512')
    .toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const derived = crypto
    .pbkdf2Sync(password, salt, HASH_ITERATIONS, KEY_LEN, 'sha512')
    .toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(derived));
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
