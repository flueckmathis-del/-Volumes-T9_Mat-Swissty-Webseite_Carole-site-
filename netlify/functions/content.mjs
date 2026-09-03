import { siteStore, readJSON, json } from './_shared/store.mjs';
import { ALL } from './_shared/defaults.mjs';

const ALLOWED_PAGES = ['home', 'about', 'services', 'metabolic', 'contact'];

export default async (req) => {
  const url = new URL(req.url);
  const page = url.searchParams.get('page');

  const store = siteStore();
  const settings = await readJSON(store, 'content/settings.json', ALL.settings);

  if (!page) {
    return json(200, settings);
  }

  if (!ALLOWED_PAGES.includes(page)) {
    return json(400, { error: 'Unbekannte Seite.' });
  }

  const pageContent = await readJSON(store, `content/${page}.json`, ALL[page]);
  return json(200, Object.assign({}, settings, pageContent));
};
