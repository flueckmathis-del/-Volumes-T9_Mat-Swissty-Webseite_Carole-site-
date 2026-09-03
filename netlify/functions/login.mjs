import { setSessionCookieHeader } from './_shared/auth.mjs';
import { getCredentials, verifyPassword } from './_shared/credentials.mjs';
import { json } from './_shared/store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const creds = await getCredentials();
  if (!creds || !creds.hash) {
    return json(400, { error: 'Es wurde noch kein Admin-Passwort eingerichtet.', needsSetup: true });
  }

  if (!body || !verifyPassword(body.password, creds.salt, creds.hash)) {
    return json(401, { error: 'Falsches Passwort.' });
  }

  return json(200, { ok: true }, { 'Set-Cookie': await setSessionCookieHeader() });
};
