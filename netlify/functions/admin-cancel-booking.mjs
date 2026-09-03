import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, updateJSON, json } from './_shared/store.mjs';

export default async (req) => {
  if (!isAuthenticated(req)) return json(401, { error: 'Nicht angemeldet.' });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const { date, id } = body || {};
  if (!date || !id) return json(400, { error: 'date und id sind erforderlich.' });

  const store = siteStore();
  const next = await updateJSON(store, `bookings/${date}.json`, [], (current) => {
    const filtered = current.filter((b) => b.id !== id);
    if (filtered.length === current.length) return null; // nothing to remove
    return filtered;
  });

  return json(200, { ok: true, bookings: next });
};
