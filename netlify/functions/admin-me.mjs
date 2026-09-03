import { isAuthenticated } from './_shared/auth.mjs';
import { json } from './_shared/store.mjs';

export default async (req) => {
  return json(200, { authenticated: await isAuthenticated(req) });
};
