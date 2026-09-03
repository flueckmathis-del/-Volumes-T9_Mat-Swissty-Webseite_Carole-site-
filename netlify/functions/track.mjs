import { siteStore, updateJSON, json } from './_shared/store.mjs';

const MAX_PAGE_LEN = 80;

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const page = (body && body.page ? String(body.page) : 'unknown').slice(0, MAX_PAGE_LEN);
  const today = new Date().toISOString().slice(0, 10);
  const store = siteStore();

  await updateJSON(store, `analytics/${today}.json`, {}, (current) => {
    current[page] = (current[page] || 0) + 1;
    return current;
  });

  return json(200, { ok: true });
};
