import {
  setSessionCookieHeader,
  verifyPendingTwoFactorCookie,
  checkLoginLockout,
  recordLoginFailure,
  recordLoginSuccess,
} from './_shared/auth.mjs';
import { getCredentials, CREDENTIALS_KEY } from './_shared/credentials.mjs';
import { verifyTotp, verifyBackupCode } from './_shared/totp.mjs';
import { siteStore, json } from './_shared/store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const lockout = await checkLoginLockout();
  if (lockout.locked) {
    return json(
      429,
      { error: `Zu viele Fehlversuche. Bitte in ${lockout.retryAfterSeconds} Sekunden erneut versuchen.` },
      { 'Retry-After': String(lockout.retryAfterSeconds) }
    );
  }

  const creds = await getCredentials();
  if (!creds || !creds.totpEnabled) {
    return json(400, { error: 'Zwei-Faktor-Authentifizierung ist nicht aktiv.' });
  }

  if (!verifyPendingTwoFactorCookie(req, creds.sessionSecret)) {
    return json(401, { error: 'Sitzung abgelaufen. Bitte erneut mit Passwort anmelden.' });
  }

  const code = String((body && body.code) || '').trim();
  const isValidTotp = verifyTotp(creds.totpSecret, code.replace(/\s/g, ''));

  let matchedBackupIndex = -1;
  if (!isValidTotp) {
    const backupCodes = creds.backupCodes || [];
    matchedBackupIndex = backupCodes.findIndex((bc) => !bc.usedAt && verifyBackupCode(code, bc.salt, bc.hash));
  }

  if (!isValidTotp && matchedBackupIndex === -1) {
    await recordLoginFailure();
    return json(401, { error: 'Ungültiger Code.' });
  }

  if (matchedBackupIndex !== -1) {
    const store = siteStore();
    const backupCodes = (creds.backupCodes || []).slice();
    backupCodes[matchedBackupIndex] = Object.assign({}, backupCodes[matchedBackupIndex], {
      usedAt: new Date().toISOString(),
    });
    await store.set(CREDENTIALS_KEY, JSON.stringify(Object.assign({}, creds, { backupCodes })));
  }

  await recordLoginSuccess();
  return json(200, { ok: true }, { 'Set-Cookie': await setSessionCookieHeader(creds.sessionSecret) });
};
