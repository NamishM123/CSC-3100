// Client for our own /api/kroger/* endpoints. The browser never sees the
// Kroger client secret — it only calls these same-origin routes, which
// are served by Vercel serverless functions in production and by the
// Express backend (proxied by Vite) in local development. The response is
// already shaped like src/data/mock.js, so it flows into applyRemote
// alongside the Supabase catalog.
//
// Every failure (missing config -> 503, Kroger error, network) resolves
// to null so the app keeps whatever catalog it already had.

const CATALOG_PATH = "/api/kroger/catalog";
const LOCATIONS_PATH = "/api/kroger/locations";

function hasFiveDigitZip(zip) {
  return /^\d{5}$/.test(String(zip || "").trim());
}

async function getJson(url, signal) {
  let response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal
    });
  } catch {
    return null; // network error or aborted
  }
  if (response.status === 503) return null; // Kroger not configured
  if (!response.ok) {
    console.warn(
      `Price Pantry: Kroger request failed (${response.status}). Keeping current catalog.`
    );
    return null;
  }
  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Returns { store_chains, stores, products, prices } or null.
export async function loadKrogerCatalog(
  zip,
  { terms, radiusMi, stores, signal } = {}
) {
  if (!hasFiveDigitZip(zip)) return null;
  const params = new URLSearchParams({
    zip: String(zip).trim()
  });
  if (Array.isArray(terms) && terms.length)
    params.set("terms", terms.slice(0, 8).join(","));
  if (radiusMi) params.set("radius", String(radiusMi));
  if (stores) params.set("stores", String(stores));

  const data = await getJson(
    `${CATALOG_PATH}?${params.toString()}`,
    signal
  );
  if (!data || data.error) return null;
  const hasRows =
    (data.stores && data.stores.length) ||
    (data.products && data.products.length);
  return hasRows ? data : null;
}

// Returns an array of normalized stores for a ZIP, or null.
export async function loadKrogerStores(
  zip,
  { radiusMi, limit, signal } = {}
) {
  if (!hasFiveDigitZip(zip)) return null;
  const params = new URLSearchParams({
    zip: String(zip).trim()
  });
  if (radiusMi) params.set("radius", String(radiusMi));
  if (limit) params.set("limit", String(limit));
  const data = await getJson(
    `${LOCATIONS_PATH}?${params.toString()}`,
    signal
  );
  if (!data || data.error || !Array.isArray(data.stores))
    return null;
  return data.stores;
}
