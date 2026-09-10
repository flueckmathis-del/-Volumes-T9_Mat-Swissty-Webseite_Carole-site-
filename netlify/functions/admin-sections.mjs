import { isAuthenticated } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';
import {
  listSections,
  getSection,
  createSection,
  updateSection,
  reorderSections,
  deleteSection,
} from './_shared/sections-store.mjs';

const ALLOWED_PAGES = ['home', 'about', 'services', 'metabolic', 'contact'];
const ALLOWED_TYPES = [
  'hero-photo',
  'text-hero',
  'split-image-text',
  'card-grid',
  'cta-band',
  'topic-list',
  'pricing-table',
  'testimonial',
  'gallery',
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    const page = url.searchParams.get('page');
    if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
    return json(200, { sections: await listSections(page) });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Ungültige Anfrage.' });
    }

    if (body && body.action === 'reorder') {
      const { page, orderedIds } = body;
      if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
      if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
        return json(400, { error: 'orderedIds muss eine Liste von IDs sein.' });
      }
      const sections = await reorderSections(page, orderedIds);
      return json(200, { sections });
    }

    const { page, type, data, position } = body || {};
    if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
    if (!ALLOWED_TYPES.includes(type)) return json(400, { error: 'Unbekannter Sektionstyp.' });
    if (!isPlainObject(data)) return json(400, { error: 'data muss ein Objekt sein.' });

    const existing = await listSections(page);
    const pos = Number.isInteger(position) ? position : existing.length;
    const section = await createSection(page, type, data, pos);
    return json(200, { section });
  }

  if (req.method === 'PATCH') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: 'Ungültige Anfrage.' });
    }
    const { page, id, data } = body || {};
    if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
    if (typeof id !== 'string' || !UUID_RE.test(id)) return json(400, { error: 'Ungültige id.' });
    if (!isPlainObject(data)) return json(400, { error: 'data muss ein Objekt sein.' });
    if (!(await getSection(page, id))) return json(404, { error: 'Sektion nicht gefunden.' });
    const section = await updateSection(page, id, data);
    return json(200, { section });
  }

  if (req.method === 'DELETE') {
    const page = url.searchParams.get('page');
    const id = url.searchParams.get('id');
    if (!ALLOWED_PAGES.includes(page)) return json(400, { error: 'Unbekannte Seite.' });
    if (typeof id !== 'string' || !UUID_RE.test(id)) return json(400, { error: 'Ungültige id.' });
    if (!(await getSection(page, id))) return json(404, { error: 'Sektion nicht gefunden.' });
    await deleteSection(page, id);
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
