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

  const { date, id, reason } = body || {};
  if (!date || !id) return json(400, { error: 'date und id sind erforderlich.' });

  const store = siteStore();
  let removed = null;
  const next = await updateJSON(store, `bookings/${date}.json`, [], (current) => {
    const filtered = current.filter((b) => b.id !== id);
    if (filtered.length === current.length) return null; // nothing to remove
    removed = current.find((b) => b.id === id);
    return filtered;
  });

  if (removed) {
    const record = Object.assign({}, removed, {
      date,
      cancelledAt: new Date().toISOString(),
      reason: reason ? String(reason).trim().slice(0, 1000) : '',
    });
    await updateJSON(store, 'cancellations.json', [], (log) => {
      log.push(record);
      if (log.length > 500) log.splice(0, log.length - 500); // keep the log from growing forever
      return log;
    });
  }

  return json(200, { ok: true, bookings: next });
};
