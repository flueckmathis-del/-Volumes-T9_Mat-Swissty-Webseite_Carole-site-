import { isAuthenticated } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';
import { generateTotpSecret, buildOtpauthUrl } from './_shared/totp.mjs';

// Erzeugt nur ein neues Secret zur Anzeige — wird erst in admin-2fa-verify
// dauerhaft gespeichert, sobald der erste Code erfolgreich bestätigt wurde.
// So bleibt kein halb-eingerichteter Zustand liegen, wenn der Vorgang
// abgebrochen wird.
export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpauthUrl(secret, 'Admin', 'CB Ernährung');
  return json(200, { secret, otpauthUrl });
};
