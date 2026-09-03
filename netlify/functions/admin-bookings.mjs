import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, readJSON, json } from './_shared/store.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function diffDays(a, b) {
  return Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 86400000);
}

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });

  const url = new URL(req.url);
  const today = new Date().toISOString().slice(0, 10);

  let from = url.searchParams.get('from');
  let to = url.searchParams.get('to');

  if (!from || !DATE_RE.test(from)) from = today;
  if (!to || !DATE_RE.test(to)) {
    const days = Math.min(parseInt(url.searchParams.get('days') || '60', 10) || 60, MAX_RANGE_DAYS);
    to = addDays(from, days);
  }

  var span = diffDays(from, to);
  if (span < 0) { const tmp = from; from = to; to = tmp; span = -span; }
  if (span > MAX_RANGE_DAYS) to = addDays(from, MAX_RANGE_DAYS);

  const store = siteStore();
  const results = [];
  let cursor = from;
  while (cursor <= to) {
    const bookings = await readJSON(store, `bookings/${cursor}.json`, []);
    bookings.forEach((b) => results.push(Object.assign({ date: cursor }, b)));
    cursor = addDays(cursor, 1);
  }
  results.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  return json(200, { bookings: results, from, to });
};
