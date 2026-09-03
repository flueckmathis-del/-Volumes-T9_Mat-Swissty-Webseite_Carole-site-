import { siteStore, readJSON, json } from './_shared/store.mjs';
import { DEFAULT_AVAILABILITY, slotsForDate, isDateWithinWindow } from './_shared/availability.mjs';
import { randomUUID } from 'node:crypto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const { date, time, name, email, message } = body || {};

  if (!date || !DATE_RE.test(date)) return json(400, { error: 'Ungültiges Datum.' });
  if (!time || !TIME_RE.test(time)) return json(400, { error: 'Ungültige Uhrzeit.' });
  if (!name || !String(name).trim()) return json(400, { error: 'Bitte gib deinen Namen an.' });
  if (!email || !EMAIL_RE.test(email)) return json(400, { error: 'Bitte gib eine gültige E-Mail-Adresse an.' });

  const store = siteStore();
  const availability = await readJSON(store, 'availability.json', DEFAULT_AVAILABILITY);

  if (!isDateWithinWindow(date, availability.weeksAhead)) {
    return json(409, { error: 'Dieses Datum liegt ausserhalb des buchbaren Zeitraums.' });
  }
  const validSlots = slotsForDate(date, availability);
  if (!validSlots.includes(time)) {
    return json(409, { error: 'Diese Zeit wird nicht angeboten. Bitte Seite neu laden und erneut wählen.' });
  }

  const key = `bookings/${date}.json`;
  const booking = {
    id: randomUUID(),
    time,
    name: String(name).trim().slice(0, 200),
    email: String(email).trim().slice(0, 200),
    message: message ? String(message).trim().slice(0, 2000) : '',
    createdAt: new Date().toISOString(),
  };

  const MAX_ATTEMPTS = 6;
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const existing = await store.getWithMetadata(key, { type: 'json' });
    const current = existing === null ? [] : existing.data === null ? [] : existing.data;

    if (current.some((b) => b.time === time)) {
      return json(409, { error: 'Diese Zeit ist bereits vergeben. Bitte wähle eine andere.' });
    }

    const next = [...current, booking];
    const writeOptions = existing === null ? { onlyIfNew: true } : { onlyIfMatch: existing.etag };
    const result = await store.set(key, JSON.stringify(next), writeOptions);

    if (result.modified) {
      return json(200, { ok: true, booking: { date, time } });
    }
    // Someone else wrote to this date's bookings at the same instant — retry.
  }

  return json(503, { error: 'Bitte versuch es nochmal — der Server war gerade stark ausgelastet.' });
};
