// Speicher für den Sektion-Baukasten (Inhalte + Bilder) — läuft auf Netlify
// Blobs, genau wie Buchungen/Login/Analytics (siehe store.mjs). Damit
// funktioniert der Baukasten auch im echten Live-Betrieb (im Gegensatz zur
// vorherigen lokalen SQLite-Variante, die auf Netlifys Server keinen
// dauerhaften Speicher gehabt hätte).
import { siteStore, readJSON, updateJSON } from './store.mjs';

function sectionsKey(page) {
  return `sections/${page}.json`;
}

const MEDIA_INDEX_KEY = 'media/index.json';

function mediaBlobKey(id) {
  return `media/blobs/${id}`;
}

export async function listSections(page) {
  const store = siteStore();
  const sections = await readJSON(store, sectionsKey(page), []);
  return sections.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

export async function getSection(page, id) {
  const sections = await listSections(page);
  return sections.find((s) => s.id === id) || null;
}

// Fügt eine Sektion an `position` ein und rückt alle nachfolgenden Sektionen
// atomar eine Position weiter — Positionen bleiben immer lückenlos und
// eindeutig, unabhängig davon, ob der Aufrufer danach noch einen separaten
// reorder-Aufruf macht (z.B. Duplizieren tut das nicht).
export async function createSection(page, type, data, position) {
  const store = siteStore();
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const newSection = { id, page, type, position, data, created_at: now, updated_at: now };
  await updateJSON(store, sectionsKey(page), [], (current) => {
    const shifted = current.map((s) => (s.position >= position ? Object.assign({}, s, { position: s.position + 1 }) : s));
    shifted.push(newSection);
    return shifted;
  });
  return newSection;
}

export async function updateSection(page, id, data) {
  const store = siteStore();
  const now = new Date().toISOString();
  let updated = null;
  await updateJSON(store, sectionsKey(page), [], (current) => {
    let found = false;
    const next = current.map((s) => {
      if (s.id !== id) return s;
      found = true;
      updated = Object.assign({}, s, { data, updated_at: now });
      return updated;
    });
    return found ? next : null; // null = keine Änderung, updateJSON macht dann nichts
  });
  return updated;
}

export async function reorderSections(page, orderedIds) {
  const store = siteStore();
  const next = await updateJSON(store, sectionsKey(page), [], (current) => {
    const byId = new Map(current.map((s) => [s.id, s]));
    return orderedIds
      .map((id, index) => {
        const s = byId.get(id);
        return s ? Object.assign({}, s, { position: index }) : null;
      })
      .filter(Boolean);
  });
  return next.slice().sort((a, b) => a.position - b.position);
}

export async function deleteSection(page, id) {
  const store = siteStore();
  await updateJSON(store, sectionsKey(page), [], (current) => current.filter((s) => s.id !== id));
}

export async function insertMedia({ id, filename, mime, size, buffer }) {
  const store = siteStore();
  const now = new Date().toISOString();
  await store.set(mediaBlobKey(id), buffer);
  await updateJSON(store, MEDIA_INDEX_KEY, [], (current) => {
    current.unshift({ id, filename, mime, size, created_at: now });
    return current;
  });
  return { id, filename, mime, size, created_at: now };
}

export async function getMedia(id) {
  const store = siteStore();
  const index = await readJSON(store, MEDIA_INDEX_KEY, []);
  const meta = index.find((m) => m.id === id);
  if (!meta) return null;
  const data = await store.get(mediaBlobKey(id), { type: 'arrayBuffer' });
  if (data === null) return null;
  return Object.assign({}, meta, { data: Buffer.from(data) });
}

export async function listMedia() {
  const store = siteStore();
  return readJSON(store, MEDIA_INDEX_KEY, []);
}

export async function deleteMedia(id) {
  const store = siteStore();
  await store.delete(mediaBlobKey(id));
  await updateJSON(store, MEDIA_INDEX_KEY, [], (current) => current.filter((m) => m.id !== id));
}
