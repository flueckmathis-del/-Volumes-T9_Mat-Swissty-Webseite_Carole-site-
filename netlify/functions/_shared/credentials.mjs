import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteStore, readJSON } from './store.mjs';

const KEY = 'admin-credentials.json';

export async function getCredentials() {
  const store = siteStore();
  return readJSON(store, KEY, null);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, hash) {
  if (!password || !salt || !hash) return false;
  const attempt = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (attempt.length !== expected.length) return false;
  return timingSafeEqual(attempt, expected);
}

export { KEY as CREDENTIALS_KEY };
