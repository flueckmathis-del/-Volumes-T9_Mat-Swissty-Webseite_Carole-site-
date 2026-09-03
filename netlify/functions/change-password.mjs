import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, json } from './_shared/store.mjs';
import { getCredentials, hashPassword, verifyPassword, CREDENTIALS_KEY } from './_shared/credentials.mjs';

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const { currentPassword, newPassword, confirmPassword } = body || {};
  if (!newPassword || String(newPassword).length < 8) {
    return json(400, { error: 'Das neue Passwort muss mindestens 8 Zeichen haben.' });
  }
  if (newPassword !== confirmPassword) {
    return json(400, { error: 'Die neuen Passwörter stimmen nicht überein.' });
  }

  const creds = await getCredentials();
  if (!creds || !verifyPassword(currentPassword, creds.salt, creds.hash)) {
    return json(401, { error: 'Aktuelles Passwort ist falsch.' });
  }

  const { salt, hash } = hashPassword(newPassword);
  const store = siteStore();
  await store.set(CREDENTIALS_KEY, JSON.stringify(Object.assign({}, creds, { salt, hash })));

  return json(200, { ok: true });
};
