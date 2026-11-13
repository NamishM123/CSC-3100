import {
  coordinatesOf,
  distanceMiles
} from "../../react-frontend/src/lib/geo.js";
import { krogerSearchQueries } from "../../react-frontend/src/lib/krogerSearch.js";

const BASE = "https://api.kroger.com/v1";
const MAX_STORES = 5;
const MAX_QUERIES = 20;
const MAX_PRODUCTS = 100;

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateKrogerRequest(body) {
  const location = coordinatesOf(body?.location);
  const radiusMi = body?.radiusMi;
  const queries = body?.queries;
  if (
    !location ||
    typeof radiusMi !== "number" ||
    !Number.isFinite(radiusMi) ||
    radiusMi < 1 ||
    radiusMi > 100
  )
    throw failure(
      400,
      "Choose a location and a radius between 1 and 100 miles."
    );
  if (
    !Array.isArray(queries) ||
    queries.length > MAX_QUERIES ||
    queries.some(
      (query) =>
        typeof query !== "string" ||
        !query.trim() ||
        query.length > 120 ||
        !krogerSearchQueries(query).length
    )
  )
    throw failure(
      400,
      "Provide up to 20 different items, with names up to 120 characters. Use an empty list to find stores only."
    );
  return {
    location,
    radiusMi,
    queries: [...new Set(queries.map((query) => query.trim()))]
  };
}

function positive(value) {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
    ? value
    : null;
}

function productImage(images = []) {
  const front =
    images.find((image) => image.perspective === "front") ||
    images[0];
  const sizes = front?.sizes || [];
  const url = (
    sizes.find((size) => size.size === "medium") ||
    sizes.find((size) => size.size === "large") ||
    sizes[0]
  )?.url;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" &&
      ["www.kroger.com", "images.kroger.com"].includes(
        parsed.hostname
      )
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}

export function normalizeKrogerProducts(rows) {
  return rows
    .flatMap((product) =>
      (product.items || []).map((item) => {
        const regular = positive(item.price?.regular);
        const promo = positive(item.price?.promo);
        const stockLevel = String(
          item.inventory?.stockLevel || "UNKNOWN"
        ).toUpperCase();
        return {
          id: `${product.productId}:${item.itemId || product.upc}`,
          productId: product.productId,
          name:
            product.description ||
            product.brand ||
            "Unnamed product",
          brand: product.brand || "",
          image_url: productImage(product.images),
          size_label: item.size || "Size unavailable",
          price:
            promo && (!regular || promo < regular)
              ? promo
              : regular,
          regular_price: regular,
          stockLevel,
          availability: [
            "HIGH",
            "LOW",
            "TEMPORARILY_OUT_OF_STOCK",
            "OUT_OF_STOCK"
          ].includes(stockLevel)
            ? ["HIGH", "LOW"].includes(stockLevel)
              ? "in_stock"
              : "out_of_stock"
            : "unknown"
        };
      })
    )
    .filter((product) => product.productId);
}

// The client is shared by local Express and both supported Vercel project roots.
// Secrets and OAuth tokens never leave this server module.
export function createKrogerClient({
  env = process.env,
  fetchImpl = fetch,
  now = Date.now
} = {}) {
  let token;
  let tokenRequest;
  const cache = new Map();

  async function accessToken(signal) {
    if (token?.expiresAt > now() + 30000) return token.value;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      const id = env.KROGER_CLIENT_ID;
      const secret = env.KROGER_CLIENT_SECRET;
      if (!id || !secret)
        throw failure(
          503,
          "Kroger search is not configured. Set KROGER_CLIENT_ID and KROGER_CLIENT_SECRET on the server."
        );
      const response = await fetchImpl(
        `${BASE}/connect/oauth2/token`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded"
          },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            scope: "product.compact"
          }).toString(),
          redirect: "error",
          signal
        }
      );
      if (!response.ok)
        throw failure(
          502,
          "Kroger authorization failed. Check the server credentials and product.compact access."
        );
      const data = await response.json();
      if (
        !data.access_token ||
        !Number.isFinite(Number(data.expires_in))
      )
        throw failure(
          502,
          "Kroger returned an invalid authorization response."
        );
      token = {
        value: data.access_token,
        expiresAt: now() + Number(data.expires_in) * 1000
      };
      return token.value;
    })();
    try {
      return await tokenRequest;
    } finally {
      tokenRequest = null;
    }
  }

  async function get(path, params, signal) {
    const url = `${BASE}/${path}?${new URLSearchParams(params)}`;
    const saved = cache.get(url);
    if (saved?.expiresAt > now()) return saved.data;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const bearer = await accessToken(signal);
      const response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${bearer}` },
        redirect: "error",
        signal
      });
      if (response.status === 401 && attempt === 0) {
        token = null;
        continue;
      }
      if (!response.ok)
        throw failure(
          502,
          response.status === 429
            ? "Kroger's request limit was reached. Wait a moment and retry."
            : "Kroger search is temporarily unavailable. Please retry."
        );
      const data = await response.json();
      if (!Array.isArray(data.data))
        throw failure(
          502,
          "Kroger returned an invalid search response."
        );
      data.fetchedAt = new Date(now()).toISOString();
      if (cache.size >= 250)
        cache.delete(cache.keys().next().value);
      cache.set(url, { data, expiresAt: now() + 120000 });
      return data;
    }
  }

  async function productsFor(storeId, query, signal) {
    const found = new Map();
    let truncated = false;
    let checkedAt;
    for (const term of krogerSearchQueries(query)) {
      for (let start = 1; start <= MAX_PRODUCTS; start += 50) {
        const data = await get(
          "products",
          {
            "filter.term": term,
            "filter.locationId": storeId,
            "filter.limit": "50",
            "filter.start": String(start)
          },
          signal
        );
        if (!checkedAt || data.fetchedAt < checkedAt)
          checkedAt = data.fetchedAt;
        for (const product of normalizeKrogerProducts(
          data.data
        ))
          found.set(product.id, product);
        const total = data.meta?.pagination?.total;
        if (
          data.data.length < 50 ||
          (Number.isFinite(total) &&
            start + data.data.length > total)
        )
          break;
        if (start === 51) truncated = true;
      }
    }
    return {
      products: [...found.values()],
      truncated,
      checkedAt
    };
  }

  async function compare(body) {
    const { location, radiusMi, queries } =
      validateKrogerRequest(body);
    const deadline = AbortSignal.timeout(45000);
    try {
      const data = await get(
        "locations",
        {
          "filter.latLong.near": `${location.latitude},${location.longitude}`,
          "filter.radiusInMiles": String(Math.ceil(radiusMi)),
          "filter.limit": "200"
        },
        AbortSignal.any([deadline, AbortSignal.timeout(10000)])
      );
      const nearby = data.data
        .map((row) => ({
          id: row.locationId,
          source: "kroger",
          name: row.name || row.chain || "Kroger store",
          address: [
            row.address?.addressLine1,
            row.address?.city,
            row.address?.state,
            row.address?.zipCode
          ]
            .filter(Boolean)
            .join(", "),
          latitude: row.geolocation?.latitude,
          longitude: row.geolocation?.longitude,
          distance_mi: distanceMiles(location, row.geolocation),
          results: []
        }))
        .filter(
          (store) =>
            store.id &&
            store.distance_mi != null &&
            store.distance_mi <= radiusMi
        )
        .sort(
          (a, b) =>
            a.distance_mi - b.distance_mi ||
            a.id.localeCompare(b.id)
        );
      const stores = nearby.slice(0, MAX_STORES);
      const jobs = stores.flatMap((store) =>
        queries.map((query) => ({ store, query }))
      );
      let index = 0;
      await Promise.all(
        Array.from(
          { length: Math.min(6, jobs.length) },
          async () => {
            while (index < jobs.length) {
              const { store, query } = jobs[index++];
              try {
                const result = await productsFor(
                  store.id,
                  query,
                  AbortSignal.any([
                    deadline,
                    AbortSignal.timeout(15000)
                  ])
                );
                store.results.push({ query, ...result });
              } catch (error) {
                store.results.push({
                  query,
                  products: [],
                  error: error.status
                    ? error.message
                    : "Kroger did not finish this item search. Retry to check availability."
                });
              }
            }
          }
        )
      );
      return {
        stores,
        limitedStores:
          nearby.length > MAX_STORES ||
          data.data.length === 200,
        maxStores: MAX_STORES
      };
    } catch (error) {
      if (error.status) throw error;
      throw failure(
        502,
        "Kroger search timed out or could not connect. Please retry."
      );
    }
  }
  return { compare };
}

export function createKrogerHandler(
  client = createKrogerClient()
) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res
        .status(405)
        .json({ error: "Use POST for Kroger searches." });
    }
    try {
      return res.json(await client.compare(req.body));
    } catch (error) {
      return res.status(error.status || 502).json({
        error: error.status
          ? error.message
          : "Kroger search failed. Please retry."
      });
    }
  };
}
