// Standalone ingestion runner, for cron or manual use:
//
//   node src/ingest/cli.js            live run (writes to Supabase)
//   node src/ingest/cli.js --dry-run  fetch + normalize, print a sample
//
// Same logic as the HTTP route, minus the server. Exits non-zero on
// failure so a scheduler can detect it.

import {
  readConfig,
  krogerConfigured,
  supabaseConfigured
} from "./config.js";
import { runIngestion } from "./pipeline.js";
import { createWriter } from "./supabase.js";

async function main() {
  const dryRun =
    process.argv.includes("--dry-run") ||
    process.argv.includes("-n");
  const config = readConfig();

  if (!krogerConfigured(config)) {
    console.error(
      "Missing Kroger credentials. Set KROGER_CLIENT_ID and " +
        "KROGER_CLIENT_SECRET (free at https://developer.kroger.com)."
    );
    process.exit(1);
  }
  if (!dryRun && !supabaseConfigured(config)) {
    console.error(
      "Missing Supabase service credentials. Set SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY, or pass --dry-run."
    );
    process.exit(1);
  }

  const writer = dryRun ? null : await createWriter(config);
  const summary = await runIngestion({
    config,
    writer,
    dryRun,
    logger: (line) => console.log(line)
  });

  console.log("---");
  console.log(
    `stores=${summary.stores} products=${summary.products} ` +
      `prices=${summary.prices}`
  );
  if (summary.written) {
    console.log("written:", JSON.stringify(summary.written));
  }
  if (dryRun && summary.catalog) {
    const sample = summary.catalog.prices
      .slice()
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);
    console.log("cheapest sample:");
    for (const p of sample) {
      console.log(
        `  ${p.product_id} @ ${p.store_id}: $${p.price}` +
          (p.is_sale ? " (sale)" : "")
      );
    }
  }
  console.log(summary.message);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
