import { setSessionCookieHeader, checkLoginLockout, recordLoginFailure, recordLoginSuccess } from './_shared/auth.mjs';
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

  // Brute-force protection: check the lockout BEFORE touching the password
  // at all, so a locked-out caller can't even spend a guess.
  const lockout = await checkLoginLockout();
  if (lockout.locked) {
    return json(
      429,
      { error: `Zu viele Fehlversuche. Bitte in ${lockout.retryAfterSeconds} Sekunden erneut versuchen.` },
      { 'Retry-After': String(lockout.retryAfterSeconds) }
    );
  }

  const creds = await getCredentials();
  if (!creds || !creds.hash) {
    return json(400, { error: 'Es wurde noch kein Admin-Passwort eingerichtet.', needsSetup: true });
  }

  if (!body || !verifyPassword(body.password, creds.salt, creds.hash)) {
    await recordLoginFailure();
    return json(401, { error: 'Falsches Passwort.' });
  }

  await recordLoginSuccess();
  return json(200, { ok: true }, { 'Set-Cookie': await setSessionCookieHeader(creds.sessionSecret) });
};
