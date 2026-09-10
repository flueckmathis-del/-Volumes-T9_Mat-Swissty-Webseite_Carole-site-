import { json } from './_shared/store.mjs';
import { listSections } from './_shared/sections-store.mjs';

const ALLOWED_PAGES = ['home', 'about', 'services', 'metabolic', 'contact'];

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  const page = url.searchParams.get('page');
  if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });

  const sections = await listSections(page);
  return json(200, { sections });
};
