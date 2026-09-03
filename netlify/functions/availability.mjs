import { siteStore, readJSON, json } from './_shared/store.mjs';
import { DEFAULT_AVAILABILITY, slotsForDate, isDateWithinWindow } from './_shared/availability.mjs';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async (req) => {
  const url = new URL(req.url);
  const date = url.searchParams.get('date');

  if (!date || !DATE_RE.test(date)) {
    return json(400, { error: 'Bitte ein gültiges Datum (YYYY-MM-DD) angeben.' });
  }

  const store = siteStore();
  const availability = await readJSON(store, 'availability.json', DEFAULT_AVAILABILITY);

  if (!isDateWithinWindow(date, availability.weeksAhead)) {
    return json(200, { date, slots: [] });
  }

  const allSlots = slotsForDate(date, availability);
  const bookings = await readJSON(store, `bookings/${date}.json`, []);
  const bookedTimes = new Set(bookings.map((b) => b.time));
  const freeSlots = allSlots.filter((t) => !bookedTimes.has(t));

  return json(200, { date, slots: freeSlots });
};
