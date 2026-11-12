import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import {
  _resetTokenCache,
  chainsFromLocations,
  fetchLocations,
  fetchProducts,
  krogerBase,
  krogerConfigured,
  normalizeCatalog,
  normalizeLocation,
  normalizePrice,
  normalizeProduct
} from "../../../api/_lib/kroger.js";

const sampleLocation = {
  locationId: "70100460",
  chain: "KROGER",
  name: "Kroger Marketplace",
  address: {
    addressLine1: "123 Main St",
    city: "Cincinnati",
    state: "OH",
    zipCode: "45202"
  },
  geolocation: { latitude: 39.1, longitude: -84.5 },
  hours: { monday: { open: "06:00", close: "23:00" } }
};

const saleProduct = {
  productId: "0001111041700",
  description: "Kroger 2% Reduced Fat Milk",
  brand: "Kroger",
  categories: ["Dairy"],
  images: [
    {
      perspective: "front",
      sizes: [
        { size: "medium", url: "https://img/medium.jpg" },
        { size: "large", url: "https://img/large.jpg" }
      ]
    }
  ],
  items: [
    {
      size: "1 gal",
      soldBy: "UNIT",
      price: { regular: 3.99, promo: 2.99 }
    }
  ]
};

const regularProduct = {
  productId: "0002222052800",
  description: "Organic Bananas",
  categories: ["Produce"],
  items: [
    {
      size: "per lb",
      soldBy: "WEIGHT",
      price: { regular: 0.69, promo: 0 }
    }
  ]
};

test("krogerBase strips trailing slash and defaults", () => {
  const prev = process.env.KROGER_BASE;
  delete process.env.KROGER_BASE;
  assert.equal(krogerBase(), "https://api.kroger.com/v1");
  process.env.KROGER_BASE = "https://api-ce.kroger.com/v1/";
  assert.equal(krogerBase(), "https://api-ce.kroger.com/v1");
  if (prev === undefined) delete process.env.KROGER_BASE;
  else process.env.KROGER_BASE = prev;
});

test("krogerConfigured reflects both credentials", () => {
  const id = process.env.KROGER_CLIENT_ID;
  const secret = process.env.KROGER_CLIENT_SECRET;
  delete process.env.KROGER_CLIENT_ID;
  delete process.env.KROGER_CLIENT_SECRET;
  assert.equal(krogerConfigured(), false);
  process.env.KROGER_CLIENT_ID = "abc";
  assert.equal(krogerConfigured(), false);
  process.env.KROGER_CLIENT_SECRET = "def";
  assert.equal(krogerConfigured(), true);
  if (id === undefined) delete process.env.KROGER_CLIENT_ID;
  else process.env.KROGER_CLIENT_ID = id;
  if (secret === undefined)
    delete process.env.KROGER_CLIENT_SECRET;
  else process.env.KROGER_CLIENT_SECRET = secret;
});

test("normalizeLocation maps to a Price Pantry store row", () => {
  const store = normalizeLocation(sampleLocation);
  assert.equal(store.id, "70100460");
  assert.equal(store.chain_id, "chain-kroger-kroger");
  assert.equal(store.address, "123 Main St");
  assert.equal(store.city, "Cincinnati");
  assert.equal(store.zip, "45202");
  assert.equal(store.latitude, 39.1);
  assert.equal(store.longitude, -84.5);
  assert.equal(store.source, "kroger");
  assert.match(store.hours_label, /Open 6:00 AM/);
});

test("chainsFromLocations de-duplicates by chain", () => {
  const chains = chainsFromLocations([
    sampleLocation,
    { ...sampleLocation, locationId: "x" }
  ]);
  assert.equal(chains.length, 1);
  assert.equal(chains[0].id, "chain-kroger-kroger");
  assert.equal(chains[0].name, "Kroger");
});

test("normalizeProduct derives name, keywords, and image", () => {
  const product = normalizeProduct(saleProduct);
  assert.equal(product.id, "0001111041700");
  assert.equal(product.name, "Kroger 2% Reduced Fat Milk");
  assert.equal(product.size_label, "1 gal");
  assert.equal(product.image_url, "https://img/medium.jpg");
  assert.ok(product.keywords.includes("milk"));
  assert.equal(product.source, "kroger");
});

test("normalizeProduct tags organic items", () => {
  const product = normalizeProduct(regularProduct);
  assert.ok(product.dietary.includes("Organic"));
  assert.equal(product.unit, "lb");
});

test("normalizePrice marks a promo as a sale", () => {
  const price = normalizePrice(
    saleProduct,
    "70100460",
    "2026-11-12T00:00:00Z"
  );
  assert.equal(price.id, "price-70100460-0001111041700");
  assert.equal(price.store_id, "70100460");
  assert.equal(price.product_id, "0001111041700");
  assert.equal(price.price, 2.99);
  assert.equal(price.regular_price, 3.99);
  assert.equal(price.is_sale, true);
  assert.equal(price.in_stock, true);
});

test("normalizePrice uses regular when no promo", () => {
  const price = normalizePrice(
    regularProduct,
    "70100460",
    "2026-11-12T00:00:00Z"
  );
  assert.equal(price.price, 0.69);
  assert.equal(price.regular_price, 0.69);
  assert.equal(price.is_sale, false);
});

test("normalizePrice returns null when a location has no price", () => {
  const noPrice = { productId: "p", items: [{ size: "1 ct" }] };
  assert.equal(normalizePrice(noPrice, "70100460", "x"), null);
});

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

afterEach(() => {
  mock.restoreAll();
  _resetTokenCache();
});

test("fetchLocations sends Basic auth for the token then a Bearer query", async () => {
  process.env.KROGER_CLIENT_ID = "my-id";
  process.env.KROGER_CLIENT_SECRET = "my-secret";
  process.env.KROGER_BASE = "https://api-ce.kroger.com/v1";
  const calls = [];
  mock.method(
    globalThis,
    "fetch",
    async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url).endsWith("/connect/oauth2/token"))
        return jsonResponse({
          access_token: "tok-123",
          expires_in: 1800
        });
      return jsonResponse({
        data: [{ locationId: "1", chain: "KROGER" }]
      });
    }
  );

  const locations = await fetchLocations({
    zip: "45202",
    limit: 3
  });
  assert.equal(locations.length, 1);

  const [token, locationsCall] = calls;
  // Token request: Basic base64(id:secret), client_credentials, product scope.
  assert.equal(token.options.method, "POST");
  assert.equal(
    token.options.headers.Authorization,
    `Basic ${Buffer.from("my-id:my-secret").toString("base64")}`
  );
  assert.match(
    token.options.body.toString(),
    /grant_type=client_credentials/
  );
  assert.match(
    token.options.body.toString(),
    /scope=product.compact/
  );
  // Locations request: Bearer token + the zip/radius/limit filters.
  assert.equal(
    locationsCall.options.headers.Authorization,
    "Bearer tok-123"
  );
  assert.match(locationsCall.url, /\/locations\?/);
  assert.match(locationsCall.url, /filter.zipCode.near=45202/);
  assert.match(locationsCall.url, /filter.limit=3/);
});

test("the access token is cached across calls", async () => {
  process.env.KROGER_CLIENT_ID = "id";
  process.env.KROGER_CLIENT_SECRET = "secret";
  let tokenRequests = 0;
  mock.method(globalThis, "fetch", async (url) => {
    if (String(url).endsWith("/connect/oauth2/token")) {
      tokenRequests += 1;
      return jsonResponse({
        access_token: "t",
        expires_in: 1800
      });
    }
    return jsonResponse({ data: [] });
  });

  await fetchProducts({ term: "milk", locationId: "1" });
  await fetchProducts({ term: "eggs", locationId: "1" });
  assert.equal(tokenRequests, 1);
});

test("normalizeCatalog merges stores, products, and prices without dupes", () => {
  const catalog = normalizeCatalog({
    locations: [sampleLocation],
    productGroups: [
      {
        locationId: "70100460",
        products: [saleProduct, regularProduct]
      },
      // same product id at the same location must not duplicate rows
      { locationId: "70100460", products: [saleProduct] }
    ]
  });
  assert.equal(catalog.stores.length, 1);
  assert.equal(catalog.store_chains.length, 1);
  assert.equal(catalog.products.length, 2);
  assert.equal(catalog.prices.length, 2);
  const milkPrice = catalog.prices.find(
    (row) => row.product_id === "0001111041700"
  );
  assert.equal(milkPrice.price, 2.99);
});
