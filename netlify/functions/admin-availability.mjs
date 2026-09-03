import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, readJSON, json } from './_shared/store.mjs';
import { DEFAULT_AVAILABILITY } from './_shared/availability.mjs';

const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const RANGE_RE = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function validate(body) {
  if (!body || typeof body !== 'object') return 'Ungültige Daten.';
  if (!Number.isInteger(body.slotMinutes) || body.slotMinutes < 10 || body.slotMinutes > 240) {
    return 'slotMinutes muss zwischen 10 und 240 liegen.';
  }
  if (!Number.isInteger(body.weeksAhead) || body.weeksAhead < 1 || body.weeksAhead > 26) {
    return 'weeksAhead muss zwischen 1 und 26 liegen.';
  }
  if (!body.weekly || typeof body.weekly !== 'object') return 'weekly fehlt.';
  for (const day of WEEKDAYS) {
    const ranges = body.weekly[day];
    if (!Array.isArray(ranges)) return `weekly.${day} muss eine Liste sein.`;
    for (const r of ranges) {
      if (!RANGE_RE.test(r)) return `Ungültiger Zeitbereich "${r}" bei ${day}.`;
    }
  }
  if (!Array.isArray(body.absences)) return 'absences muss eine Liste sein.';
  for (const a of body.absences) {
    if (!a || typeof a !== 'object') return 'Ungültiger Abwesenheitseintrag.';
    if (!DATE_RE.test(a.date)) return 'Ungültiges Datum in einer Abwesenheit.';
    if (typeof a.allDay !== 'boolean') return 'allDay fehlt bei einer Abwesenheit.';
    if (!a.allDay) {
      if (!TIME_RE.test(a.start) || !TIME_RE.test(a.end) || a.start >= a.end) {
        return 'Ungültige Start-/Endzeit in einer Abwesenheit.';
      }
    }
  }
  return null;
}

export default async (req) => {
  if (!isAuthenticated(req)) return json(401, { error: 'Nicht angemeldet.' });
  const store = siteStore();

  if (req.method === 'GET') {
    const availability = await readJSON(store, 'availability.json', DEFAULT_AVAILABILITY);
    return json(200, availability);
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Ungültige Anfrage.' });
    }
    const error = validate(body);
    if (error) return json(400, { error });
    await store.set('availability.json', JSON.stringify(body));
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
