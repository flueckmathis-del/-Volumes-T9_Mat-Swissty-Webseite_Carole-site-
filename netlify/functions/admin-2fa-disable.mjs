import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, json } from './_shared/store.mjs';
import { getCredentials, verifyPassword, CREDENTIALS_KEY } from './_shared/credentials.mjs';

// Verlangt bewusst das aktuelle Passwort, nicht nur eine gültige Sitzung —
// eine Sicherheitsfunktion zu deaktivieren ist heikler als sie einzurichten.
export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const creds = await getCredentials();
  if (!creds || !verifyPassword(body && body.currentPassword, creds.salt, creds.hash)) {
    return json(401, { error: 'Aktuelles Passwort ist falsch.' });
  }

  const next = Object.assign({}, creds);
  delete next.totpEnabled;
  delete next.totpSecret;
  delete next.backupCodes;

  const store = siteStore();
  await store.set(CREDENTIALS_KEY, JSON.stringify(next));

  return json(200, { ok: true });
};
