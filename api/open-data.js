import { requireAuth } from "../packages/express-backend/src/auth.js";
import { createOpenDataHandler } from "../packages/express-backend/src/openData.js";

export const maxDuration = 60;
const authenticate = requireAuth();
const readData = createOpenDataHandler();

export default function handler(req, res) {
  return authenticate(req, res, () => readData(req, res));
}
