import { requireAuth } from "../packages/express-backend/src/auth.js";
import { createKrogerHandler } from "../packages/express-backend/src/kroger.js";

export const maxDuration = 60;
const authenticate = requireAuth();
const search = createKrogerHandler();

export default function handler(req, res) {
  return authenticate(req, res, () => search(req, res));
}
