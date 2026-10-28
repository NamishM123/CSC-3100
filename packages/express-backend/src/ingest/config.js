// Ingestion configuration, read from the environment so no
// secrets live in the repo. See packages/express-backend/.env.example.
//
// Kroger credentials come from the free developer portal
// (https://developer.kroger.com). The Supabase service role key
// is required to WRITE rows; the frontend's anon key is read only.

function list(value, fallback) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function int(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function num(value, fallback) {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// Default basket mirrors the demo catalog so the UI shows
// familiar items once real Kroger prices land.
const DEFAULT_TERMS = [
  "bananas",
  "milk 2%",
  "large eggs",
  "whole wheat bread",
  "peanut butter",
  "spinach"
];

export function readConfig(env = process.env) {
  return {
    kroger: {
      clientId: env.KROGER_CLIENT_ID || null,
      clientSecret: env.KROGER_CLIENT_SECRET || null,
      baseUrl: env.KROGER_BASE_URL || "https://api.kroger.com/v1",
      // product.compact is enough for price + description.
      scope: env.KROGER_SCOPE || "product.compact"
    },
    supabase: {
      url: env.SUPABASE_URL || env.VITE_SUPABASE_URL || null,
      // Service role is needed to write. Never ship it to the browser.
      serviceKey:
        env.SUPABASE_SERVICE_ROLE_KEY ||
        env.SUPABASE_SERVICE_KEY ||
        null
    },
    search: {
      zip: env.INGEST_ZIP || "93401",
      radiusMiles: num(env.INGEST_RADIUS_MILES, 10),
      maxStores: int(env.INGEST_MAX_STORES, 6),
      terms: list(env.INGEST_TERMS, DEFAULT_TERMS),
      perTermLimit: int(env.INGEST_PER_TERM_LIMIT, 5),
      // How many Kroger requests may be in flight at once.
      concurrency: int(env.INGEST_CONCURRENCY, 4),
      // Optional origin for distance. Falls back to the store centroid.
      originLat: num(env.INGEST_ORIGIN_LAT, null),
      originLng: num(env.INGEST_ORIGIN_LNG, null)
    }
  };
}

export function krogerConfigured(config) {
  return Boolean(config.kroger.clientId && config.kroger.clientSecret);
}

export function supabaseConfigured(config) {
  return Boolean(config.supabase.url && config.supabase.serviceKey);
}
