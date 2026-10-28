// Orchestrates one ingestion run:
//   1. find nearby Kroger stores for the configured zip
//   2. for each (store x search term), fetch products with price,
//      bounded by a small concurrency limit to stay polite
//   3. fold the responses into a de-duplicated catalog
//   4. write it to Supabase (unless dryRun)
//
// Returns a summary so the HTTP route and CLI can report what ran.

import { KrogerClient } from "./kroger.js";
import { buildCatalog, resolveOrigin } from "./normalize.js";

// Run async tasks with at most `limit` in flight at once.
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
    }
  }
  const runners = [];
  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(run());
  }
  await Promise.all(runners);
  return results;
}

export async function runIngestion({
  config,
  client,
  writer,
  dryRun = false,
  now = new Date().toISOString(),
  logger = () => {}
}) {
  const krogerClient =
    client || new KrogerClient(config.kroger);
  const { search } = config;

  logger(
    `Looking up Kroger stores near ${search.zip} ` +
      `(<= ${search.radiusMiles} mi, up to ${search.maxStores}).`
  );
  const locations = await krogerClient.locations({
    zip: search.zip,
    radiusMiles: search.radiusMiles,
    limit: search.maxStores
  });
  if (locations.length === 0) {
    return {
      ok: true,
      dryRun,
      stores: 0,
      products: 0,
      prices: 0,
      written: null,
      message: `No Kroger stores found near ${search.zip}.`
    };
  }
  logger(`Found ${locations.length} store(s).`);

  // One task per (store, term). Each returns the products that
  // store carries for that term, with price attached.
  const tasks = [];
  for (const location of locations) {
    for (const term of search.terms) {
      tasks.push({ location, term });
    }
  }
  logger(
    `Fetching ${tasks.length} store/term queries ` +
      `at concurrency ${search.concurrency}.`
  );

  const byLocation = new Map();
  await mapWithConcurrency(
    tasks,
    search.concurrency,
    async ({ location, term }) => {
      try {
        const products = await krogerClient.products({
          term,
          locationId: location.locationId,
          limit: search.perTermLimit
        });
        const bucket = byLocation.get(location.locationId) || [];
        bucket.push(...products);
        byLocation.set(location.locationId, bucket);
      } catch (error) {
        // One failed term should not sink the whole run.
        logger(
          `  ! ${location.locationId} "${term}": ${error.message}`
        );
      }
    }
  );

  const fetched = locations.map((location) => ({
    location,
    products: byLocation.get(location.locationId) || []
  }));

  const origin = resolveOrigin(locations, {
    lat: search.originLat,
    lng: search.originLng
  });
  const catalog = buildCatalog(locations, fetched, { origin, now });

  const summary = {
    ok: true,
    dryRun,
    stores: catalog.stores.length,
    products: catalog.products.length,
    prices: catalog.prices.length,
    written: null,
    ranAt: now
  };

  if (dryRun) {
    summary.message = "Dry run: nothing written to Supabase.";
    summary.catalog = catalog;
    return summary;
  }

  if (!writer) {
    throw new Error(
      "No Supabase writer provided and dryRun is false."
    );
  }
  logger("Writing catalog to Supabase...");
  summary.written = await writer.write(catalog);
  summary.message = "Ingestion complete.";
  return summary;
}
