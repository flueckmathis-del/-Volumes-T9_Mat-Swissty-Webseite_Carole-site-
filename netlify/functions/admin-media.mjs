import { isAuthenticated } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';
import { insertMedia, listMedia, deleteMedia, getMedia } from './_shared/sections-store.mjs';

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

// Erkennt den echten Dateityp anhand der ersten Bytes ("Magic Bytes"),
// statt dem vom Client behaupteten Content-Type zu vertrauen. SVG wird
// bewusst nie akzeptiert, weil es Skriptcode enthalten kann.
function sniffImageMime(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export default async (req) => {
  if (!(await isAuthenticated(req))) return json(401, { error: 'Nicht angemeldet.' });

  const url = new URL(req.url);

  if (req.method === 'GET') {
    return json(200, { media: await listMedia() });
  }

  if (req.method === 'POST') {
    let form;
    try {
      form = await req.formData();
    } catch {
      return json(400, { error: 'Ungültige Anfrage (kein multipart/form-data).' });
    }
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return json(400, { error: 'Keine Datei übermittelt.' });
    }
    if (file.size > MAX_SIZE) {
      return json(413, { error: 'Datei ist zu gross (maximal 8 MB).' });
    }
    // Alles rund um das eigentliche Lesen/Verarbeiten der Datei abgesichert:
    // eine kaputte/unerwartete Datei soll immer eine saubere JSON-Fehler-
    // antwort geben, nie einen rohen Stacktrace an den Client durchreichen.
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > MAX_SIZE) {
        return json(413, { error: 'Datei ist zu gross (maximal 8 MB).' });
      }
      const mime = sniffImageMime(buffer);
      if (!mime) {
        return json(400, { error: 'Nur JPEG-, PNG- oder WebP-Bilder sind erlaubt.' });
      }
      const id = crypto.randomUUID();
      const filename = typeof file.name === 'string' && file.name ? file.name : id;
      await insertMedia({ id, filename, mime, size: buffer.length, buffer });
      return json(200, { id, url: '/.netlify/functions/media?id=' + id });
    } catch {
      return json(400, { error: 'Datei konnte nicht verarbeitet werden.' });
    }
  }

  if (req.method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return json(400, { error: 'id fehlt.' });
    if (!(await getMedia(id))) return json(404, { error: 'Bild nicht gefunden.' });
    await deleteMedia(id);
    return json(200, { ok: true });
  }

  return json(405, { error: 'Method not allowed' });
};
