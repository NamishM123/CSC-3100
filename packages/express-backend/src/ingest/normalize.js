// Pure transforms from raw Kroger API JSON into the row shapes
// Price Pantry's Supabase schema expects. No network here, so this
// is unit tested against a captured sample in normalize.test.js.
//
// The "find the cheapest price" design rests on one fact: a Kroger
// productId is stable across stores. We key every product by it, so
// the same item at different locations shares one product_id and the
// frontend's compare.js can rank stores against each other with no
// extra work. Each (store, product) pair yields exactly one price row
// with a deterministic id, so re-running ingestion upserts in place
// instead of piling up duplicates.

const EARTH_RADIUS_MI = 3958.8;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

// Great-circle distance in miles. Kroger does not return distance,
// so we derive it from store coordinates and a chosen origin.
export function haversineMiles(a, b) {
  if (
    a?.lat == null ||
    a?.lng == null ||
    b?.lat == null ||
    b?.lng == null
  ) {
    return null;
  }
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(h));
}

function round(value, places) {
  if (value == null) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

// Rough in-town drive time when a routing API is not wired up yet.
function estimateDriveMinutes(distanceMi) {
  if (distanceMi == null) return null;
  return Math.max(1, Math.round(distanceMi * 2 + 2));
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function chainId(name) {
  return `chain-kr-${slug(name) || "kroger"}`;
}

export function storeId(locationId) {
  return `store-kr-${locationId}`;
}

export function productId(krogerProductId) {
  return `prod-kr-${krogerProductId}`;
}

export function priceId(locationId, krogerProductId) {
  return `price-${storeId(locationId)}-${productId(krogerProductId)}`;
}

export function normalizeChain(location) {
  const name = location.chain || "Kroger";
  return { id: chainId(name), name, code: slug(name).toUpperCase() };
}

export function normalizeStore(location, origin) {
  const addr = location.address || {};
  const geo = location.geolocation || {};
  const lat = geo.latitude ?? null;
  const lng = geo.longitude ?? null;
  const distance = origin
    ? haversineMiles(origin, { lat, lng })
    : null;
  return {
    id: storeId(location.locationId),
    chain_id: chainId(location.chain || "Kroger"),
    name: location.name || location.chain || "Kroger",
    address: addr.addressLine1 || null,
    city: addr.city || null,
    state: addr.state || null,
    zip: addr.zipCode || null,
    latitude: lat,
    longitude: lng,
    distance_mi: round(distance, 1),
    drive_minutes: estimateDriveMinutes(distance),
    hours_label: null
  };
}

// Keywords help the app's search match the real product name.
function keywordsFor(description, brand) {
  const words = `${brand || ""} ${description || ""}`
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((w) => w.length > 1);
  return [...new Set(words)];
}

export function normalizeProduct(product) {
  const item = (product.items && product.items[0]) || {};
  const category =
    (product.categories && product.categories[0]) || null;
  return {
    id: productId(product.productId),
    name: product.description || "Unknown product",
    short_name: product.description || "Unknown product",
    list_unit: item.size || null,
    category,
    size_label: item.size || null,
    unit_amount: null,
    unit: null,
    dietary: [],
    dietary_conflicts: [],
    dietary_verified: false,
    also_try: [],
    keywords: keywordsFor(product.description, product.brand)
  };
}

// One price row for a product at a store. Returns null when the
// store has no sellable price for the item (out of catalog, etc.).
export function normalizePrice(product, location, now) {
  const item = (product.items && product.items[0]) || {};
  const price = item.price || {};
  const regular = price.regular == null ? null : Number(price.regular);
  const promo = price.promo ? Number(price.promo) : 0;
  const isSale = promo > 0 && promo < (regular ?? Infinity);
  const current = isSale ? promo : regular;
  if (current == null || Number.isNaN(current) || current <= 0) {
    return null;
  }
  const inStock =
    item.inventory == null ||
    item.inventory.stockLevel == null ||
    item.inventory.stockLevel !== "TEMPORARILY_OUT_OF_STOCK";
  return {
    id: priceId(location.locationId, product.productId),
    store_id: storeId(location.locationId),
    product_id: productId(product.productId),
    price: round(current, 2),
    regular_price: round(regular ?? current, 2),
    unit_price:
      price.regularPerUnitEstimate == null
        ? null
        : round(Number(price.regularPerUnitEstimate), 2),
    unit: null,
    is_member_price: false,
    is_sale: isSale,
    in_stock: inStock,
    updated_at: now,
    source: "kroger"
  };
}

// Pick a distance origin: explicit config, else the centroid of the
// stores we found, so distance_mi stays meaningful even without one.
export function resolveOrigin(locations, configured) {
  if (configured?.lat != null && configured?.lng != null) {
    return { lat: configured.lat, lng: configured.lng };
  }
  const points = locations
    .map((l) => l.geolocation)
    .filter((g) => g && g.latitude != null && g.longitude != null);
  if (points.length === 0) return null;
  const lat =
    points.reduce((s, g) => s + g.latitude, 0) / points.length;
  const lng =
    points.reduce((s, g) => s + g.longitude, 0) / points.length;
  return { lat, lng };
}

// Fold many per-store product responses into one de-duplicated
// catalog ready for upsert. `fetched` is a list of
// { location, products: [...] } produced by the pipeline.
export function buildCatalog(locations, fetched, { origin, now } = {}) {
  const chains = new Map();
  const stores = new Map();
  const products = new Map();
  const prices = new Map();

  for (const location of locations) {
    const chain = normalizeChain(location);
    chains.set(chain.id, chain);
    const store = normalizeStore(location, origin);
    stores.set(store.id, store);
  }

  for (const { location, products: rows } of fetched) {
    for (const product of rows || []) {
      if (!product.productId) continue;
      const normalizedProduct = normalizeProduct(product);
      if (!products.has(normalizedProduct.id)) {
        products.set(normalizedProduct.id, normalizedProduct);
      }
      const price = normalizePrice(product, location, now);
      if (price) prices.set(price.id, price);
    }
  }

  return {
    store_chains: [...chains.values()],
    stores: [...stores.values()],
    products: [...products.values()],
    prices: [...prices.values()]
  };
}
