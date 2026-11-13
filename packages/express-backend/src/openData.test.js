import assert from "node:assert/strict";
import test from "node:test";
import {
  createOpenDataClient,
  createOpenDataHandler,
  normalizeOsmStore,
  osmIdentity
} from "./openData.js";

const now = Date.parse("2026-11-12T12:00:00Z");
const body = {
  location: { latitude: 35.28, longitude: -120.66 },
  radiusMi: 5
};
const shop = {
  type: "node",
  id: 123,
  lat: 35.281,
  lon: -120.66,
  tags: {
    name: "Food 4 Less",
    shop: "supermarket",
    "addr:street": "Higuera St",
    "addr:housenumber": "3985"
  }
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

test("comparison reports bound mapped-store batches, preserve per-store failures, and enrich dietary facts", async () => {
  let active = 0;
  let peak = 0;
  const calls = [];
  const handler = createOpenDataHandler({
    prices: async (id) => {
      calls.push(id);
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      if (id === "osm-node-2")
        throw new Error("private upstream details");
      return {
        offers: [
          {
            name: "Example apple",
            barcode: "123456789012",
            price: 2
          }
        ],
        limited: false
      };
    },
    facts: async (codes) => {
      assert.deepEqual([...new Set(codes)], ["123456789012"]);
      return {
        facts: { 123456789012: { labels: ["en:vegan"] } },
        limited: true
      };
    }
  });
  const res = {
    setHeader() {},
    status(code) {
      this.code = code;
      return this;
    },
    json(value) {
      this.value = value;
      return this;
    }
  };
  await handler(
    {
      method: "POST",
      body: {
        action: "comparisonReports",
        storeIds: [
          "osm-node-1",
          "osm-node-2",
          "osm-node-3",
          "osm-node-4"
        ],
        dietary: ["Vegan"]
      }
    },
    res
  );
  assert.equal(peak, 2);
  assert.equal(res.value.stores.length, 4);
  assert.equal(
    res.value.stores[0].offers[0].dietary_facts.labels[0],
    "en:vegan"
  );
  assert.equal(res.value.dietaryLimited, true);
  assert.match(
    res.value.stores[1].error,
    /could not be checked/
  );
  assert.doesNotMatch(
    res.value.stores[1].error,
    /private upstream/
  );
  for (const storeIds of [
    [],
    ["osm-node-1", "osm-node-1"],
    ["https://evil.example/"],
    Array.from({ length: 5 }, (_, i) => `osm-node-${i}`)
  ]) {
    await handler(
      {
        method: "POST",
        body: { action: "comparisonReports", storeIds }
      },
      res
    );
    assert.equal(res.code, 400);
  }
  assert.equal(calls.length, 4);
});

test("community stores validate inputs, preserve real locations, cache requests, and bound radius", async () => {
  const calls = [];
  const client = createOpenDataClient({
    now: () => now,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return json({
        elements: [
          shop,
          { ...shop, id: 456, lat: 0, lon: 0 },
          {
            ...shop,
            id: 789,
            tags: { name: "Not a grocer", shop: "clothes" }
          }
        ]
      });
    }
  });
  const result = await client.stores(body);
  assert.equal(result.stores.length, 1);
  assert.equal(result.stores[0].name, "Food 4 Less");
  assert.equal(result.stores[0].id, "osm-node-123");
  assert.equal(result.stores[0].source, "openstreetmap");
  await client.stores(body);
  assert.equal(calls.length, 1);
  assert.match(
    calls[0].options.headers["User-Agent"],
    /PricePantry/
  );
  assert.equal(
    (await client.stores({ ...body, radiusMi: 100 }))
      .searchRadiusMi,
    25
  );
  for (const request of [
    {},
    { ...body, radiusMi: 0 },
    { ...body, radiusMi: "5" },
    { ...body, location: { latitude: 91, longitude: 0 } }
  ])
    await assert.rejects(client.stores(request), {
      status: 400
    });
  for (const id of [
    "https://evil.example/",
    "osm-node-1);out;",
    "osm-bogus-1",
    "osm-node--1"
  ])
    assert.throws(() => osmIdentity(id), { status: 400 });
  assert.equal(
    normalizeOsmStore({
      ...shop,
      tags: { ...shop.tags, disused: "yes" }
    }),
    null
  );
});

test("Open Prices keeps each item's newest report regardless of age, with store, currency, and future-date checks", async () => {
  let requestUrl;
  const row = {
    id: 1,
    product_code: "123456789012",
    product: { product_name: "Milk", quantity: "1 gallon" },
    price: "3.50",
    currency: "USD",
    date: "2026-11-10",
    location_osm_id: 123,
    location_osm_type: "NODE"
  };
  const client = createOpenDataClient({
    now: () => now,
    fetchImpl: async (url) => {
      requestUrl = new URL(url);
      return json({
        total: 8,
        items: [
          row,
          { ...row, id: 2, date: "2026-11-09", price: "2.00" },
          { ...row, location_osm_id: 456 },
          { ...row, currency: "EUR" },
          { ...row, date: "2026-12-01" },
          { ...row, date: "2020-01-01" },
          {
            ...row,
            id: 3,
            product_code: "999999999999",
            product: {
              product_name: "Coffee",
              quantity: "1 lb"
            },
            date: "2026-06-25",
            price: "7.00"
          },
          { ...row, price: "NaN" }
        ]
      });
    }
  });
  const result = await client.prices("osm-node-123");
  assert.equal(result.offers.length, 2);
  assert.equal(result.offers[0].price, 3.5);
  assert.equal(result.offers[0].observed_on, "2026-11-10");
  assert.equal(result.offers[0].availability, "unknown");
  assert.equal(result.offers[1].name, "Coffee");
  assert.equal(result.offers[1].observed_on, "2026-06-25");
  assert.equal(result.offers[1].price, 7);
  assert.equal(requestUrl.searchParams.has("date__gte"), false);
  assert.equal(
    requestUrl.searchParams.get("order_by"),
    "-date"
  );
  assert.equal(
    requestUrl.searchParams.get("location_osm_type"),
    "NODE"
  );
  assert.equal(requestUrl.searchParams.get("currency"), "USD");
  assert.equal(
    requestUrl.searchParams.get("date__lte"),
    "2026-11-12"
  );
});

test("Open Prices locations keep discovery and direct reload usable during an Overpass outage", async () => {
  const source = {
    type: "OSM",
    osm_type: "RELATION",
    osm_id: 123,
    osm_name: "Costco",
    osm_tag_key: "shop",
    osm_tag_value: "wholesale",
    osm_lat: 35.281,
    osm_lon: -120.66
  };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.includes("overpass.")) throw new Error("Offline");
    if (url.includes("/nearby?"))
      return json({ items: [source] });
    return json(source);
  };
  const client = createOpenDataClient({ fetchImpl });
  const result = await client.stores(body);
  assert.equal(result.mapFallback, true);
  assert.equal(result.stores[0].name, "Costco");
  const count = calls.length;
  assert.equal(
    (await client.store("osm-relation-123")).name,
    "Costco"
  );
  assert.equal(calls.length, count);
  assert.equal(
    (
      await createOpenDataClient({ fetchImpl }).store(
        "osm-relation-123"
      )
    ).name,
    "Costco"
  );
});

test("barcode facts use exact identities, deduplicate/cache lookups, and enforce a shared read budget", async () => {
  const calls = [];
  const client = createOpenDataClient({
    now: () => now,
    fetchImpl: async (url) => {
      calls.push(url);
      const code = /product\/(\d+)/.exec(url)[1];
      return json({
        status: 1,
        product: {
          code,
          labels_tags: ["en:gluten-free"],
          allergens_tags: ["en:milk"]
        }
      });
    }
  });
  const first = await client.facts([
    "123456789012",
    "123456789012",
    "https://evil.example"
  ]);
  assert.equal(calls.length, 1);
  assert.equal(
    first.facts["123456789012"].allergens[0],
    "en:milk"
  );
  await client.facts(["0123456789012"]);
  assert.equal(calls.length, 1);
  const more = await client.facts(
    Array.from({ length: 20 }, (_, index) =>
      String(100000000000 + index)
    )
  );
  assert.equal(calls.length, 12);
  assert.equal(more.limited, true);
  const mismatch = createOpenDataClient({
    fetchImpl: async () =>
      json({
        status: 1,
        product: {
          code: "999999999999",
          labels_tags: ["en:vegan"]
        }
      })
  });
  assert.deepEqual(
    (await mismatch.facts(["123456789012"])).facts,
    {}
  );
});

test("missing barcode facts are cached; source failure preserves unknown status and is retryable", async () => {
  let calls = 0;
  const client = createOpenDataClient({
    fetchImpl: async () => {
      calls++;
      return json({}, 404);
    }
  });
  assert.deepEqual(
    (await client.facts(["123456789012"])).facts,
    {}
  );
  assert.deepEqual(
    (await client.facts(["123456789012"])).facts,
    {}
  );
  assert.equal(calls, 1);
  const busy = createOpenDataClient({
    fetchImpl: async () => json({}, 429)
  });
  await assert.rejects(busy.stores(body), { status: 429 });
  assert.equal(
    (await busy.facts(["123456789012"])).limited,
    true
  );
});

test("community data handlers reject unsupported operations and handle inventory without fabricated prices", async () => {
  const client = {
    store: async () => normalizeOsmStore(shop),
    prices: async () => ({ offers: [], limited: false }),
    facts: async () =>
      assert.fail(
        "No need to look up facts without active filters"
      )
  };
  const handler = createOpenDataHandler(client);
  const response = () => ({
    headers: {},
    setHeader(key, value) {
      this.headers[key] = value;
    },
    status(code) {
      this.code = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  });
  const inventory = response();
  await handler(
    {
      method: "POST",
      body: { action: "inventory", storeId: "osm-node-123" }
    },
    inventory
  );
  assert.deepEqual(inventory.body.offers, []);
  assert.equal(inventory.body.store.name, "Food 4 Less");
  const invalid = response();
  await handler(
    {
      method: "POST",
      body: { action: "anything", url: "http://localhost" }
    },
    invalid
  );
  assert.equal(invalid.code, 400);
  const wrongMethod = response();
  await handler({ method: "GET" }, wrongMethod);
  assert.equal(wrongMethod.code, 405);
});
