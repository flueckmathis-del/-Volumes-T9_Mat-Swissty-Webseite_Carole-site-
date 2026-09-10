import { isAuthenticated } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';
import { getCredentials } from './_shared/credentials.mjs';

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });
  const creds = await getCredentials();
  const backupCodes = (creds && creds.backupCodes) || [];
  return json(200, {
    enabled: !!(creds && creds.totpEnabled),
    unusedBackupCodes: backupCodes.filter((c) => !c.usedAt).length,
  });
};
