export const DEFAULT_AVAILABILITY = {
  slotMinutes: 60,
  weeksAhead: 6,
  weekly: {
    mon: ['09:00-12:00', '14:00-17:00'],
    tue: ['09:00-12:00', '14:00-17:00'],
    wed: ['09:00-12:00'],
    thu: ['09:00-12:00', '14:00-17:00'],
    fri: ['09:00-12:00'],
    sat: [],
    sun: [],
  },
  blockedDates: [],
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function weekdayKeyFor(dateStr) {
  // dateStr: "YYYY-MM-DD" — parsed as UTC midnight to avoid local-timezone
  // shifting the calendar day.
  const d = new Date(dateStr + 'T00:00:00Z');
  return WEEKDAY_KEYS[d.getUTCDay()];
}

function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function slotsForDate(dateStr, availability) {
  if (availability.blockedDates && availability.blockedDates.includes(dateStr)) return [];
  const key = weekdayKeyFor(dateStr);
  const ranges = (availability.weekly && availability.weekly[key]) || [];
  const slotMinutes = availability.slotMinutes || 60;
  const slots = [];
  ranges.forEach((range) => {
    const [start, end] = range.split('-');
    let cursor = timeToMinutes(start);
    const endMinutes = timeToMinutes(end);
    while (cursor + slotMinutes <= endMinutes) {
      slots.push(minutesToTime(cursor));
      cursor += slotMinutes;
    }
  });
  return slots;
}

export function isDateWithinWindow(dateStr, weeksAhead) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const max = new Date(today);
  max.setUTCDate(max.getUTCDate() + (weeksAhead || 6) * 7);
  const maxStr = max.toISOString().slice(0, 10);
  return dateStr >= todayStr && dateStr <= maxStr;
}
