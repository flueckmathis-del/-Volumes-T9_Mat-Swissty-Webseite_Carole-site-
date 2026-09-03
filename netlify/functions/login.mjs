import { setSessionCookieHeader } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Ungültige Anfrage.' });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return json(500, { error: 'Server ist nicht konfiguriert (ADMIN_PASSWORD fehlt).' });
  }

  if (!body || body.password !== adminPassword) {
    return json(401, { error: 'Falsches Passwort.' });
  }

  return json(
    200,
    { ok: true },
    { 'Set-Cookie': setSessionCookieHeader() }
  );
};
