import { getStore } from '@netlify/blobs';

export function siteStore() {
  // 'strong' consistency: without it, reads can come back from an edge
  // cache that lags behind the most recent write (Netlify Blobs defaults
  // to 'eventual'). updateJSON()'s etag compare-and-swap below depends on
  // reading the truly-current etag, or every retry conflicts forever —
  // only shows up against real production Blobs, not the local dev
  // emulator, which is why this went unnoticed until the first real deploy.
  return getStore({ name: 'site-data', consistency: 'strong' });
}

export async function readJSON(store, key, fallback) {
  const value = await store.get(key, { type: 'json' });
  return value === null || value === undefined ? fallback : value;
}

// Optimistic-concurrency read-modify-write: retries a few times if another
// request wrote the same key in between, so two simultaneous bookings for
// the same slot can never both succeed.
export async function updateJSON(store, key, fallback, mutate, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const existing = await store.getWithMetadata(key, { type: 'json' });
    const current = existing === null ? fallback : (existing.data === null ? fallback : existing.data);
    const next = await mutate(structuredClone(current));
    if (next === null) return current; // mutate() signals "no change needed"

    const writeOptions = existing === null ? { onlyIfNew: true } : { onlyIfMatch: existing.etag };
    const result = await store.set(key, JSON.stringify(next), writeOptions);
    if (result.modified) return next;
    // conflict: someone else wrote first, retry with fresh data
  }
  throw new Error('Konnte Änderung nicht speichern (zu viele gleichzeitige Zugriffe). Bitte nochmal versuchen.');
}

export function json(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      extraHeaders || {}
    ),
  });
}
