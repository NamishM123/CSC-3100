// Vercel serverless function that runs Kroger price ingestion, so the
// Supabase catalog refreshes in the cloud with no laptop involved.
//
// Invoked two ways:
//   - Vercel Cron (see "crons" in vercel.json) on a schedule.
//   - A manual GET/POST to /api/ingest (add ?dryRun=1 to preview).
//
// Credentials come from the Vercel project's Environment Variables
// (Settings -> Environment Variables), never from the frontend:
//   KROGER_CLIENT_ID, KROGER_CLIENT_SECRET,
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Set CRON_SECRET too; Vercel sends it as a Bearer token on cron
// runs, and we reject calls that do not present it.

import {
  readConfig,
  krogerConfigured,
  supabaseConfigured
} from "../packages/express-backend/src/ingest/config.js";
import { runIngestion } from "../packages/express-backend/src/ingest/pipeline.js";
import { createWriter } from "../packages/express-backend/src/ingest/supabase.js";

export default async function handler(req, res) {
  // When CRON_SECRET is set, require it. Vercel Cron sends it as
  // `Authorization: Bearer <CRON_SECRET>`, which blocks public hits.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ ok: false, error: "Unauthorized" });
    }
  }

  const dryRun =
    req.query?.dryRun === "1" || req.query?.dryRun === "true";
  const cfg = readConfig();

  if (!krogerConfigured(cfg)) {
    return res.status(503).json({
      ok: false,
      error:
        "Kroger API not configured. Set KROGER_CLIENT_ID and " +
        "KROGER_CLIENT_SECRET in the Vercel environment."
    });
  }
  if (!dryRun && !supabaseConfigured(cfg)) {
    return res.status(503).json({
      ok: false,
      error:
        "Supabase not configured. Set SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY in the Vercel environment."
    });
  }

  try {
    const writer = dryRun ? null : await createWriter(cfg);
    const summary = await runIngestion({ config: cfg, writer, dryRun });
    // The full catalog can be large; return just the counts.
    const { catalog, ...lite } = summary;
    void catalog;
    return res.status(200).json(lite);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}

// Ingestion makes several Kroger calls, so allow more than the
// default execution time.
export const config = { maxDuration: 60 };
