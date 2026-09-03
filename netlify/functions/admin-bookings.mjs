import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, readJSON, json } from './_shared/store.mjs';

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async (req) => {
  if (!isAuthenticated(req)) return json(401, { error: 'Nicht angemeldet.' });

  const url = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get('days') || '60', 10) || 60, 180);
  const today = new Date().toISOString().slice(0, 10);

  const store = siteStore();
  const results = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    const bookings = await readJSON(store, `bookings/${date}.json`, []);
    bookings.forEach((b) => results.push(Object.assign({ date }, b)));
  }
  results.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return json(200, { bookings: results });
};
