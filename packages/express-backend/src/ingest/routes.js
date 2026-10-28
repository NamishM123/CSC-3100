// Express routes that trigger and report on ingestion.
//
//   POST /ingest        run a live ingestion (writes to Supabase)
//   POST /ingest?dryRun=1   fetch + normalize, return counts, no write
//   GET  /ingest/status last run summary and whether creds are set
//
// Runs are serialized: a second POST while one is in flight is
// rejected with 409 so we never hammer Kroger or race writes.

import { Router } from "express";
import {
  readConfig,
  krogerConfigured,
  supabaseConfigured
} from "./config.js";
import { runIngestion } from "./pipeline.js";
import { createWriter } from "./supabase.js";

export function createIngestRouter({ config = readConfig() } = {}) {
  const router = Router();
  const state = { running: false, lastRun: null };

  router.get("/ingest/status", (_req, res) => {
    res.json({
      running: state.running,
      krogerConfigured: krogerConfigured(config),
      supabaseConfigured: supabaseConfigured(config),
      zip: config.search.zip,
      terms: config.search.terms,
      lastRun: state.lastRun
    });
  });

  router.post("/ingest", async (req, res) => {
    const dryRun =
      req.query.dryRun === "1" || req.query.dryRun === "true";

    if (!krogerConfigured(config)) {
      return res.status(503).json({
        ok: false,
        error:
          "Kroger API not configured. Set KROGER_CLIENT_ID and " +
          "KROGER_CLIENT_SECRET."
      });
    }
    if (!dryRun && !supabaseConfigured(config)) {
      return res.status(503).json({
        ok: false,
        error:
          "Supabase not configured. Set SUPABASE_URL and " +
          "SUPABASE_SERVICE_ROLE_KEY, or POST /ingest?dryRun=1."
      });
    }
    if (state.running) {
      return res
        .status(409)
        .json({ ok: false, error: "An ingestion is already running." });
    }

    state.running = true;
    try {
      const writer = dryRun ? null : await createWriter(config);
      const summary = await runIngestion({ config, writer, dryRun });
      // The full catalog can be large; keep status lightweight.
      const { catalog, ...lite } = summary;
      void catalog;
      state.lastRun = { ...lite, finishedAt: new Date().toISOString() };
      res.json(summary);
    } catch (error) {
      state.lastRun = {
        ok: false,
        error: error.message,
        finishedAt: new Date().toISOString()
      };
      res.status(500).json({ ok: false, error: error.message });
    } finally {
      state.running = false;
    }
  });

  return router;
}
