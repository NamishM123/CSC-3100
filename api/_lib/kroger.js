// Shared, framework-agnostic Kroger API client for Price Pantry.
//
// This module is the ONLY place the Kroger client secret is used.
// It is imported by the Vercel serverless functions in api/kroger/*
// and by the Express backend (packages/express-backend) so the same
// code path serves both `vercel dev`/production and `npm run dev:local`.
//
// Required environment variables (set in Vercel, or .env.local locally):
//   KROGER_CLIENT_ID      OAuth2 client id
//   KROGER_CLIENT_SECRET  OAuth2 client secret
//   KROGER_BASE           API base incl. /v1, e.g.
//                         https://api-ce.kroger.com/v1 (Certification) or
//                         https://api.kroger.com/v1    (Production)
//
// The secret never leaves the server: the browser only ever talks to
// our own /api/kroger/* endpoints, which return catalog rows already
// shaped like src/data/mock.js so they drop straight into applyRemote.

const DEFAULT_BASE = "https://api.kroger.com/v1";

export function krogerBase() {
  const base = (process.env.KROGER_BASE || DEFAULT_BASE).trim();
  return base.replace(/\/+$/, "");
}

export function krogerConfigured() {
  return Boolean(
    process.env.KROGER_CLIENT_ID &&
    process.env.KROGER_CLIENT_SECRET
  );
}

// A thrown KrogerError carries an HTTP status the handlers relay as-is.
export class KrogerError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "KrogerError";
    this.status = status;
  }
}

// --- OAuth2 client_credentials token, cached in module memory ---------
// A warm serverless instance (or the long-lived Express process) reuses
// the token until ~30s before it expires, then fetches a new one.

let cachedToken = null; // { value, expiresAt }

export function _resetTokenCache() {
  cachedToken = null;
}

async function requestToken() {
  const id = process.env.KROGER_CLIENT_ID;
  const secret = process.env.KROGER_CLIENT_SECRET;
  if (!id || !secret)
    throw new KrogerError(
      503,
      "Kroger API is not configured. Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET."
    );

  const credentials = Buffer.from(`${id}:${secret}`).toString(
    "base64"
  );
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    // product.compact is enough for /locations and /products pricing.
    scope: "product.compact"
  });

  let response;
  try {
    response = await fetch(
      `${krogerBase()}/connect/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json"
        },
        body
      }
    );
  } catch (error) {
    throw new KrogerError(
      502,
      `Could not reach Kroger token endpoint: ${error.message}`
    );
  }

  if (!response.ok) {
    // Avoid echoing Kroger's body (it can include the client id).
    throw new KrogerError(
      response.status === 401 ? 502 : response.status,
      `Kroger token request failed (${response.status}).`
    );
  }

  const json = await response.json();
  const expiresInMs = (Number(json.expires_in) || 1800) * 1000;
  return {
    value: json.access_token,
    expiresAt: Date.now() + expiresInMs - 30_000
  };
}

export async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now())
    return cachedToken.value;
  cachedToken = await requestToken();
  return cachedToken.value;
}

// --- Authenticated GET against the Kroger API -------------------------

async function krogerGet(path, params) {
  const token = await getAccessToken();
  const url = new URL(`${krogerBase()}${path}`);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "")
      url.searchParams.set(key, value);
  }

  let response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      }
    });
  } catch (error) {
    throw new KrogerError(
      502,
      `Could not reach Kroger API: ${error.message}`
    );
  }

  if (response.status === 401) {
    // Token may have been revoked early; drop cache and retry once.
    _resetTokenCache();
    const retryToken = await getAccessToken();
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${retryToken}`,
        Accept: "application/json"
      }
    });
  }

  if (!response.ok)
    throw new KrogerError(
      response.status,
      `Kroger request to ${path} failed (${response.status}).`
    );

  return response.json();
}

// --- Raw fetchers -----------------------------------------------------

export async function fetchLocations({
  zip,
  radiusMiles = 10,
  limit = 5
} = {}) {
  if (!/^\d{5}$/.test(String(zip || "")))
    throw new KrogerError(
      400,
      "A 5-digit ZIP code is required."
    );
  const json = await krogerGet("/locations", {
    "filter.zipCode.near": zip,
    "filter.radiusInMiles": clampInt(radiusMiles, 1, 100, 10),
    "filter.limit": clampInt(limit, 1, 10, 5)
  });
  return Array.isArray(json.data) ? json.data : [];
}

export async function fetchProducts({
  term,
  locationId,
  limit = 10
} = {}) {
  if (!term || !String(term).trim())
    throw new KrogerError(400, "A search term is required.");
  const json = await krogerGet("/products", {
    "filter.term": String(term).trim(),
    "filter.locationId": locationId,
    "filter.limit": clampInt(limit, 1, 50, 10)
  });
  return Array.isArray(json.data) ? json.data : [];
}

function clampInt(value, min, max, fallback) {
  const parsed = Math.trunc(Number(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

// --- Normalizers: Kroger shapes -> Price Pantry catalog rows ----------
// Output matches src/data/mock.js so rows flow through applyRemote.

function chainIdFor(chain) {
  const slug = String(chain || "KROGER")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `chain-kroger-${slug || "kroger"}`;
}

export function normalizeLocation(location) {
  const address = location.address || {};
  const geo = location.geolocation || {};
  return {
    id: location.locationId,
    chain_id: chainIdFor(location.chain),
    name: location.name || location.chain || "Kroger store",
    address: address.addressLine1 || "",
    city: address.city || "",
    state: address.state || "",
    zip: address.zipCode || "",
    latitude: numberOrNull(geo.latitude),
    longitude: numberOrNull(geo.longitude),
    distance_mi: 0,
    drive_minutes: 0,
    hours_label: hoursLabel(location.hours),
    source: "kroger"
  };
}

export function chainsFromLocations(locations) {
  const seen = new Map();
  for (const location of locations) {
    const id = chainIdFor(location.chain);
    if (!seen.has(id)) {
      const name = titleCase(location.chain || "Kroger");
      seen.set(id, { id, name, code: codeFor(name) });
    }
  }
  return [...seen.values()];
}

// Kroger returns one product record per location query, so a product id
// can repeat across locations. We keep one catalog product per id and
// one price per (location, product).
export function normalizeProduct(product) {
  const item = (product.items && product.items[0]) || {};
  const sizeLabel = item.size || "";
  const dietary = dietaryTags(product);
  return {
    id: product.productId,
    name: product.description || "Item",
    short_name: shorten(product.description || "Item"),
    list_unit:
      sizeLabel || (item.soldBy === "WEIGHT" ? "lb" : "each"),
    category:
      (product.categories && product.categories[0]) ||
      "Grocery",
    size_label: sizeLabel,
    unit_amount: null,
    unit: item.soldBy === "WEIGHT" ? "lb" : null,
    brand: product.brand || null,
    image_url: productImage(product),
    dietary,
    dietary_conflicts: [],
    dietary_verified: false,
    also_try: [],
    keywords: keywordsFor(product),
    source: "kroger"
  };
}

export function normalizePrice(product, locationId, updatedAt) {
  const item = (product.items && product.items[0]) || {};
  const price = item.price || {};
  const regular = numberOrNull(price.regular);
  const promo = numberOrNull(price.promo);
  const onSale =
    promo != null &&
    promo > 0 &&
    regular != null &&
    promo < regular;
  const effective = onSale ? promo : regular;
  if (effective == null) return null; // no price for this location
  const inStock =
    !item.inventory ||
    item.inventory.stockLevel !== "TEMPORARILY_OUT_OF_STOCK";
  return {
    id: `price-${locationId}-${product.productId}`,
    store_id: locationId,
    product_id: product.productId,
    price: effective,
    regular_price: regular ?? effective,
    unit_price: null,
    unit: item.soldBy === "WEIGHT" ? "lb" : null,
    is_member_price: false,
    is_sale: onSale,
    in_stock: inStock,
    updated_at: updatedAt,
    source: "kroger"
  };
}

// Merge normalized rows across several location/term queries into a
// single de-duplicated catalog object.
export function normalizeCatalog({ locations, productGroups }) {
  const stores = locations.map(normalizeLocation);
  const store_chains = chainsFromLocations(locations);
  const updatedAt = new Date().toISOString();

  const productsById = new Map();
  const pricesById = new Map();

  for (const group of productGroups) {
    for (const product of group.products) {
      if (!product || !product.productId) continue;
      if (!productsById.has(product.productId))
        productsById.set(
          product.productId,
          normalizeProduct(product)
        );
      const priceRow = normalizePrice(
        product,
        group.locationId,
        updatedAt
      );
      if (priceRow) pricesById.set(priceRow.id, priceRow);
    }
  }

  return {
    store_chains,
    stores,
    products: [...productsById.values()],
    prices: [...pricesById.values()]
  };
}

// --- small helpers ----------------------------------------------------

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hoursLabel(hours) {
  if (!hours) return "";
  if (hours.open24 === true || hours.open24 === "Y")
    return "Open 24 hours";
  // Kroger nests today's hours under a weekday key; surface whatever is open.
  const today = Object.values(hours).find(
    (day) => day && day.open && day.close
  );
  if (today)
    return `Open ${formatTime(today.open)}–${formatTime(today.close)}`;
  return "";
}

function formatTime(value) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!match) return String(value || "");
  let hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

function dietaryTags(product) {
  const tags = [];
  const haystack =
    `${product.description || ""} ${(product.categories || []).join(" ")}`.toLowerCase();
  if (/\borganic\b/.test(haystack)) tags.push("Organic");
  if (/gluten[\s-]?free/.test(haystack))
    tags.push("Gluten free");
  if (/\bvegan\b/.test(haystack)) tags.push("Vegan");
  if (/dairy[\s-]?free/.test(haystack)) tags.push("Dairy free");
  return tags;
}

function productImage(product) {
  const images = product.images || [];
  const front =
    images.find((img) => img.perspective === "front") ||
    images[0];
  if (!front || !Array.isArray(front.sizes)) return null;
  const preferred =
    front.sizes.find((size) => size.size === "medium") ||
    front.sizes.find((size) => size.size === "large") ||
    front.sizes[0];
  return preferred ? preferred.url : null;
}

function keywordsFor(product) {
  const words = new Set();
  for (const part of String(product.description || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2))
    words.add(part);
  if (product.brand)
    words.add(String(product.brand).toLowerCase());
  return [...words].slice(0, 12);
}

function shorten(text, max = 28) {
  const clean = String(text).trim();
  return clean.length <= max
    ? clean
    : `${clean.slice(0, max - 1).trim()}…`;
}

function titleCase(text) {
  return String(text)
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function codeFor(name) {
  return String(name)
    .replace(/[^A-Za-z]/g, "")
    .slice(0, 2)
    .toUpperCase();
}
