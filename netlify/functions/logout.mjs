import { clearSessionCookieHeader } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';

export default async () => {
  return json(200, { ok: true }, { 'Set-Cookie': clearSessionCookieHeader() });
};
