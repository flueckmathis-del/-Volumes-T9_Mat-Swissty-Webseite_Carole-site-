import { isAuthenticated } from './_shared/auth.mjs';
import { siteStore, readJSON, json } from './_shared/store.mjs';
import { ALL } from './_shared/defaults.mjs';

const ALLOWED_PAGES = ['settings', 'home', 'about', 'services', 'metabolic', 'contact'];

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });
  const store = siteStore();
  const url = new URL(req.url);

  if (req.method === 'GET') {
    const page = url.searchParams.get('page');
    if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
    const data = await readJSON(store, `content/${page}.json`, ALL[page]);
    // Neue Felder (z.B. später hinzugefügte Formular-Texte) erscheinen auch,
    // wenn die gespeicherte Version sie noch nicht enthält.
    return json(200, Object.assign({}, ALL[page], data));
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Ungültige Anfrage.' });
    }
    const { page, data } = body || {};
    if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return json(400, { error: 'data muss ein Objekt sein.' });
    }
    await store.set(`content/${page}.json`, JSON.stringify(data));
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
