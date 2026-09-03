import { getCredentials } from './_shared/credentials.mjs';
import { json } from './_shared/store.mjs';

export default async () => {
  const creds = await getCredentials();
  return json(200, { configured: !!(creds && creds.hash) });
};
