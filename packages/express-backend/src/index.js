import express from "express";
import { createIngestRouter } from "./ingest/routes.js";

const app = express();
const PORT = process.env.PORT || 8000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Price ingestion: POST /ingest pulls live Kroger prices into
// Supabase; GET /ingest/status reports the last run.
app.use(createIngestRouter());

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
