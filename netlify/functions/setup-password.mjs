import { randomBytes } from 'node:crypto';
import { siteStore, json } from './_shared/store.mjs';
import { getCredentials, hashPassword, CREDENTIALS_KEY } from './_shared/credentials.mjs';
import { setSessionCookieHeader } from './_shared/auth.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const { password, confirmPassword } = body || {};
  if (!password || String(password).length < 8) {
    return json(400, { error: 'Das Passwort muss mindestens 8 Zeichen haben.' });
  }
  if (password !== confirmPassword) {
    return json(400, { error: 'Die Passwörter stimmen nicht überein.' });
  }

  const existing = await getCredentials();
  if (existing && existing.hash) {
    return json(409, { error: 'Es wurde bereits ein Admin-Passwort eingerichtet.' });
  }

  const store = siteStore();
  const { salt, hash } = hashPassword(password);
  const sessionSecret = randomBytes(32).toString('hex');

  // Conditional write: if two people somehow submit initial setup at the
  // same instant, only the first one actually wins.
  const result = await store.set(CREDENTIALS_KEY, JSON.stringify({ salt, hash, sessionSecret }), { onlyIfNew: true });
  if (!result.modified) {
    return json(409, { error: 'Es wurde bereits ein Admin-Passwort eingerichtet.' });
  }

  return json(200, { ok: true }, { 'Set-Cookie': await setSessionCookieHeader() });
};
