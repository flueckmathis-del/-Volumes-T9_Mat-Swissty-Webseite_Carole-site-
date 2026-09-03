import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, readJSON, json } from './_shared/store.mjs';

export default async (req) => {
  if (!isAuthenticated(req)) return json(401, { error: 'Nicht angemeldet.' });

  const store = siteStore();
  const log = await readJSON(store, 'cancellations.json', []);
  const sorted = log.slice().sort((a, b) => (b.cancelledAt || '').localeCompare(a.cancelledAt || ''));

  return json(200, { cancellations: sorted.slice(0, 100) });
};
