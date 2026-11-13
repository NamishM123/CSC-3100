import assert from "node:assert/strict";
import test from "node:test";
import * as sample from "../data/mock.js";
import {
  catalogForLocation,
  catalogWithStoreDirectory,
  mergeCatalog
} from "./catalog.js";
import { nearbyStores } from "./geo.js";
import {
  reconcileStores,
  samePhysicalStore
} from "./storeDiscovery.js";
import { storeItemsPath } from "./storeLinks.js";
import { compareList } from "./compare.js";
import {
  weeklyAdStore,
  weeklyAdStores
} from "./weeklyAdStores.js";

const slo = { latitude: 35.28, longitude: -120.66 };

test("seven real ad branches participate in the normal location/radius filtering and direct store routes", () => {
  assert.equal(weeklyAdStores.length, 7);
  const catalog = catalogForLocation(sample, slo);
  const branches = nearbyStores(catalog.stores, slo, 5).filter(
    (store) => store.source === "weekly-ads"
  );
  assert.deepEqual(
    new Set(branches.map((store) => store.id)),
    new Set([
      "weekly-california-fresh-slo",
      "weekly-slo-food-coop"
    ])
  );
  assert.ok(
    nearbyStores(catalog.stores, slo, 15).some(
      (store) => store.id === "weekly-spencers-morro-bay"
    )
  );
  assert.ok(
    !nearbyStores(catalog.stores, slo, 5).some(
      (store) => store.id === "weekly-california-fresh-pismo"
    )
  );
  for (const store of weeklyAdStores) {
    assert.match(
      storeItemsPath(store),
      new RegExp(`^/stores/${store.id}\\?source=weekly-ads$`)
    );
    assert.equal(weeklyAdStore(store.id), store);
    assert.ok(
      store.address &&
        store.city &&
        store.zip &&
        store.coordinate_source_url
    );
    assert.equal(store.drive_minutes, undefined);
  }
  assert.equal(weeklyAdStore("not-a-store"), null);
});

test("OSM discoveries of a curated branch become one marker with its ad route, while distinct branches remain", () => {
  const branch = weeklyAdStore("weekly-california-fresh-slo");
  const mapped = {
    ...branch,
    id: "osm-way-45599266",
    alternate_ids: [],
    source: "openstreetmap",
    provider: undefined
  };
  const other = {
    ...mapped,
    id: "osm-node-nearby",
    address: "779 E. Foothill Blvd",
    latitude: branch.latitude + 0.0001
  };
  const unrelated = {
    ...mapped,
    id: "other-grocer",
    name: "Independent Grocer",
    address: branch.address
  };
  const rows = reconcileStores([
    mapped,
    other,
    unrelated,
    branch
  ]);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, "weekly-ads");
  assert.ok(rows[0].alternate_ids.includes(mapped.id));
  assert.equal(samePhysicalStore(branch, other), false);
  assert.equal(samePhysicalStore(branch, unrelated), false);
  assert.equal(mapped.alternate_ids.length, 0);
});

test("real branch data replaces a fictional built-in store and removes its sample prices, history, and swaps everywhere", () => {
  const real = {
    id: "osm-real-grocery-outlet",
    name: "Grocery Outlet",
    source: "openstreetmap",
    address: "1314 Madonna Road",
    city: "San Luis Obispo",
    state: "CA",
    zip: "93405",
    latitude: 35.262,
    longitude: -120.678
  };
  const catalog = catalogWithStoreDirectory(sample, [real]);
  assert.equal(
    catalog.stores.some((store) => store.id === "store-go"),
    false
  );
  assert.ok(
    catalog.stores
      .find((store) => store.id === real.id)
      .alternate_ids.includes("store-go")
  );
  for (const key of [
    "prices",
    "price_history",
    "product_swaps"
  ]) {
    assert.equal(
      catalog[key].some(
        (row) =>
          row.store_id === "store-go" ||
          row.store_id === real.id
      ),
      false
    );
    assert.deepEqual(
      catalog[key].filter((row) => row.store_id === "store-tj"),
      sample[key].filter((row) => row.store_id === "store-tj")
    );
  }
  assert.ok(
    catalog.products.some(
      (product) => product.id === "prod-bananas"
    )
  );
  assert.ok(
    sample.stores.some((store) => store.id === "store-go")
  );
});

test("a source that reuses a sample store ID cannot inherit that store's illustrative prices", () => {
  const updated = mergeCatalog(sample, {
    stores: [
      {
        ...sample.stores[0],
        source: undefined,
        address: "Real address"
      }
    ],
    prices: [
      {
        id: "confirmed",
        store_id: "store-tj",
        product_id: "prod-bananas",
        price: 0.5
      }
    ]
  });
  const catalog = catalogWithStoreDirectory(updated);
  assert.equal(
    updated.stores.find((store) => store.id === "store-tj")
      .source,
    "catalog"
  );
  assert.deepEqual(
    catalog.prices
      .filter((row) => row.store_id === "store-tj")
      .map((row) => row.id),
    ["confirmed"]
  );
  assert.equal(
    catalog.price_history.some(
      (row) => row.store_id === "store-tj"
    ),
    false
  );
});

test("real catalog offers survive deduplication into an ad branch, but its sample offers do not", () => {
  const branch = weeklyAdStore("weekly-california-fresh-slo");
  const remote = {
    ...branch,
    id: "remote-cfm",
    source: "catalog",
    alternate_ids: []
  };
  const catalog = catalogWithStoreDirectory({
    ...sample,
    stores: [...sample.stores, remote],
    prices: [
      ...sample.prices,
      {
        id: "real-offer",
        store_id: remote.id,
        product_id: "prod-bananas",
        source: "retailer",
        price: 0.49
      }
    ]
  });
  assert.equal(
    catalog.stores.some((store) => store.id === remote.id),
    false
  );
  assert.equal(
    catalog.prices.find((row) => row.id === "real-offer")
      .store_id,
    branch.id
  );
  assert.equal(
    catalog.prices.some((row) => row.kind === "advertised"),
    false
  );
});

test("fictional stores in other cities and unrelated neighboring grocers are preserved", () => {
  const demo = { ...sample.stores[0], city: "Different City" };
  const real = {
    ...demo,
    id: "real-tj",
    source: "openstreetmap",
    city: "San Luis Obispo",
    latitude: 36
  };
  assert.equal(reconcileStores([demo, real]).length, 2);
});

test("a real offer at a new branch can be compared without inventing a driving time", () => {
  const date = "2026-11-13T12:00:00Z";
  const store = weeklyAdStore("weekly-california-fresh-slo");
  const catalog = catalogForLocation(
    {
      ...sample,
      products: [
        { id: "actual-product", name: "Example product" }
      ],
      prices: [
        {
          id: "actual-price",
          product_id: "actual-product",
          store_id: store.id,
          price: 5,
          source: "retailer",
          in_stock: true,
          updated_at: date
        }
      ]
    },
    slo
  );
  const comparison = compareList({
    items: [{ product_id: "actual-product", quantity: 1 }],
    products: catalog.products,
    stores: catalog.stores,
    prices: catalog.prices,
    radiusMi: 5,
    includeMember: true,
    now: Date.parse(date),
    acceptedSwapIds: [],
    swaps: []
  });
  assert.equal(comparison.single.total, 5);
  assert.equal(comparison.extraMinutes, null);
});

test("catalog refreshes cannot turn copied sample locations into real stores or restore their old offers", () => {
  const seeded = sample.stores.find(
    (store) => store.id === "store-go"
  );
  const remote = mergeCatalog(sample, {
    stores: [{ ...seeded, source: undefined }],
    prices: [
      {
        id: "copied-seed-offer",
        store_id: seeded.id,
        product_id: "prod-bananas",
        price: 0.22
      }
    ]
  });
  const real = {
    ...seeded,
    id: "osm-real-go",
    source: "openstreetmap",
    address: "1314 Madonna Road",
    latitude: 35.262,
    longitude: -120.678
  };
  const catalog = catalogWithStoreDirectory(remote, [real]);
  assert.equal(
    catalog.stores.some((store) => store.id === seeded.id),
    false
  );
  assert.equal(
    catalog.prices.some(
      (row) => row.id === "copied-seed-offer"
    ),
    false
  );
  assert.equal(
    catalog.prices.some((row) => row.store_id === real.id),
    false
  );
});
