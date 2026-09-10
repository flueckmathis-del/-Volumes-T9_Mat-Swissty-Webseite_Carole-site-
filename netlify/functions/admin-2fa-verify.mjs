import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, json } from './_shared/store.mjs';
import { getCredentials, CREDENTIALS_KEY } from './_shared/credentials.mjs';
import { verifyTotp, generateBackupCodes, hashBackupCode } from './_shared/totp.mjs';

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const { secret, code } = body || {};
  if (!secret || !code) return json(400, { error: 'Code fehlt.' });

  if (!verifyTotp(secret, String(code).replace(/\s/g, ''))) {
    return json(400, { error: 'Der Code stimmt nicht. Bitte nochmal versuchen.' });
  }

  const creds = await getCredentials();
  if (!creds) return json(400, { error: 'Kein Admin-Konto gefunden.' });

  const plainBackupCodes = generateBackupCodes();
  const backupCodes = plainBackupCodes.map((c) => {
    const { salt, hash } = hashBackupCode(c);
    return { salt, hash, usedAt: null };
  });

  const store = siteStore();
  await store.set(
    CREDENTIALS_KEY,
    JSON.stringify(Object.assign({}, creds, { totpEnabled: true, totpSecret: secret, backupCodes }))
  );

  return json(200, { ok: true, backupCodes: plainBackupCodes });
};
