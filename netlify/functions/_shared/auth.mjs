import { createHmac, timingSafeEqual } from 'node:crypto';
import { getCredentials } from './credentials.mjs';

const COOKIE_NAME = 'admin_session';
const SESSION_DAYS = 14;

function b64url(input) {
  return Buffer.from(input).toString('base64url');
}

async function getSessionSecret() {
  const creds = await getCredentials();
  if (!creds || !creds.sessionSecret) {
    throw new Error('Es wurde noch kein Admin-Passwort eingerichtet.');
  }
  return creds.sessionSecret;
}

// `knownSecret`: pass this when the caller just wrote the credentials blob
// itself (setup-password, login) and already has the secret in hand —
// Netlify Blobs is only eventually consistent, so a fresh read of a blob
// that was written moments ago in the same request can still miss it.
export async function createSessionToken(knownSecret) {
  const secret = knownSecret || (await getSessionSecret());
  const payload = JSON.stringify({ exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000 });
  const payloadB64 = b64url(payload);
  const signature = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  let secret;
  try {
    secret = await getSessionSecret();
  } catch {
    return false;
  }
  const [payloadB64, signature] = token.split('.');
  const expected = createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const a = Buffer.from(signature || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    return typeof payload.exp === 'number' && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function parseCookies(req) {
  const header = req.headers.get('cookie') || '';
  const cookies = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  });
  return cookies;
}

export async function isAuthenticated(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

export async function setSessionCookieHeader(knownSecret) {
  const token = await createSessionToken(knownSecret);
  const maxAge = SESSION_DAYS * 24 * 60 * 60;
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookieHeader() {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}
