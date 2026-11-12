// Vercel serverless function: GET /api/kroger/catalog
// Holds no logic of its own — delegates to the shared handler so the
// Express backend and `vercel dev` run identical code.
export { catalogHandler as default } from "../_lib/handlers.js";
