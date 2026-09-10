import { json } from './_shared/store.mjs';
import { getMedia } from './_shared/sections-store.mjs';

export default async (req) => {
  if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return json(400, { error: 'id fehlt.' });

  const media = await getMedia(id);
  if (!media) return json(404, { error: 'Bild nicht gefunden.' });

  return new Response(media.data, {
    status: 200,
    headers: {
      'Content-Type': media.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
    },
  });
};
