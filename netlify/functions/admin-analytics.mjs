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
  const days = Math.min(parseInt(url.searchParams.get('days') || '30', 10) || 30, 90);
  const today = new Date().toISOString().slice(0, 10);

  const store = siteStore();
  const byDay = [];
  const totalsByPage = {};
  let total = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const dayData = await readJSON(store, `analytics/${date}.json`, {});
    let dayTotal = 0;
    Object.entries(dayData).forEach(([page, count]) => {
      dayTotal += count;
      totalsByPage[page] = (totalsByPage[page] || 0) + count;
      total += count;
    });
    byDay.push({ date, count: dayTotal });
  }

  const topPages = Object.entries(totalsByPage)
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count);

  return json(200, { total, byDay, topPages });
};
