import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCatalog,
  haversineMiles,
  normalizePrice,
  normalizeProduct,
  normalizeStore,
  priceId,
  productId,
  resolveOrigin,
  storeId
} from "./normalize.js";

const NOW = "2026-10-28T12:00:00.000Z";

// Shapes mirror real Kroger /locations and /products responses,
// trimmed to the fields the normalizer reads.
const locationA = {
  locationId: "01400441",
  chain: "KINGSOOPERS",
  name: "King Soopers - Main",
  address: {
    addressLine1: "100 Main St",
    city: "Denver",
    state: "CO",
    zipCode: "80202"
  },
  geolocation: { latitude: 39.74, longitude: -104.99 }
};
const locationB = {
  locationId: "01400442",
  chain: "KINGSOOPERS",
  name: "King Soopers - West",
  address: {
    addressLine1: "900 West Ave",
    city: "Denver",
    state: "CO",
    zipCode: "80204"
  },
  geolocation: { latitude: 39.72, longitude: -105.05 }
};

const milk = {
  productId: "0001111041700",
  description: "2% Reduced Fat Milk",
  brand: "Kroger",
  categories: ["Dairy"],
  items: [
    {
      size: "1 gal",
      price: { regular: 3.99, promo: 0, regularPerUnitEstimate: 3.99 }
    }
  ]
};
const milkCheaperOnSale = {
  productId: "0001111041700",
  description: "2% Reduced Fat Milk",
  brand: "Kroger",
  categories: ["Dairy"],
  items: [{ size: "1 gal", price: { regular: 4.29, promo: 3.49 } }]
};
const noPrice = {
  productId: "0009999999999",
  description: "Mystery Item",
  brand: "Kroger",
  categories: ["Pantry"],
  items: [{ size: "1 ea", price: { regular: 0, promo: 0 } }]
};

test("haversineMiles is zero for the same point and positive apart", () => {
  const p = { lat: 39.74, lng: -104.99 };
  assert.equal(haversineMiles(p, p), 0);
  assert.ok(
    haversineMiles(p, { lat: 39.72, lng: -105.05 }) > 2
  );
  assert.equal(haversineMiles(p, { lat: null, lng: null }), null);
});

test("ids are deterministic and share across stores by productId", () => {
  assert.equal(storeId("01400441"), "store-kr-01400441");
  assert.equal(productId("0001111041700"), "prod-kr-0001111041700");
  assert.equal(
    priceId("01400441", "0001111041700"),
    "price-store-kr-01400441-prod-kr-0001111041700"
  );
  // Same product at two stores keeps one product id -> comparable.
  assert.equal(
    normalizeProduct(milk).id,
    normalizeProduct(milkCheaperOnSale).id
  );
});

test("normalizeStore derives distance and keeps address fields", () => {
  const origin = { lat: 39.74, lng: -104.99 };
  const store = normalizeStore(locationA, origin);
  assert.equal(store.id, "store-kr-01400441");
  assert.equal(store.chain_id, "chain-kr-kingsoopers");
  assert.equal(store.city, "Denver");
  assert.equal(store.distance_mi, 0);
  assert.equal(store.drive_minutes, 2);
});

test("normalizePrice reads regular price and the source tag", () => {
  const price = normalizePrice(milk, locationA, NOW);
  assert.equal(price.price, 3.99);
  assert.equal(price.regular_price, 3.99);
  assert.equal(price.is_sale, false);
  assert.equal(price.source, "kroger");
  assert.equal(price.updated_at, NOW);
});

test("normalizePrice flags a promo as a sale and uses promo price", () => {
  const price = normalizePrice(milkCheaperOnSale, locationA, NOW);
  assert.equal(price.price, 3.49);
  assert.equal(price.regular_price, 4.29);
  assert.equal(price.is_sale, true);
});

test("normalizePrice returns null when there is no sellable price", () => {
  assert.equal(normalizePrice(noPrice, locationA, NOW), null);
});

test("resolveOrigin prefers config, else store centroid", () => {
  assert.deepEqual(
    resolveOrigin([locationA, locationB], { lat: 1, lng: 2 }),
    { lat: 1, lng: 2 }
  );
  const centroid = resolveOrigin([locationA, locationB], {});
  assert.ok(Math.abs(centroid.lat - 39.73) < 1e-9);
  assert.ok(Math.abs(centroid.lng - -105.02) < 1e-9);
});

test("buildCatalog dedupes products and keeps one price per store", () => {
  const fetched = [
    { location: locationA, products: [milk, noPrice] },
    { location: locationB, products: [milkCheaperOnSale] }
  ];
  const origin = resolveOrigin([locationA, locationB], {});
  const catalog = buildCatalog([locationA, locationB], fetched, {
    origin,
    now: NOW
  });

  assert.equal(catalog.store_chains.length, 1);
  assert.equal(catalog.stores.length, 2);
  // Milk appears at both stores but is one product; the no-price
  // item still lands in the catalog, it just has no price row.
  assert.equal(catalog.products.length, 2);
  // Two milk prices (one per store), none for the no-price item.
  assert.equal(catalog.prices.length, 2);

  const milkPrices = catalog.prices
    .filter((p) => p.product_id === "prod-kr-0001111041700")
    .sort((a, b) => a.price - b.price);
  assert.equal(milkPrices.length, 2);
  // Store B's sale price is the cheapest -> compare.js can rank it.
  assert.equal(milkPrices[0].store_id, "store-kr-01400442");
  assert.equal(milkPrices[0].price, 3.49);
});
