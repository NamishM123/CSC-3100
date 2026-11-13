import assert from "node:assert/strict";
import test from "node:test";
import {
  createKrogerClient,
  normalizeKrogerProducts,
  validateKrogerRequest
} from "./kroger.js";
import { createApp } from "./app.js";
import { rankKrogerStores } from "../../react-frontend/src/lib/recommendations.js";

const env = {
  KROGER_CLIENT_ID: "test-id",
  KROGER_CLIENT_SECRET: "test-secret"
};
const body = {
  location: { latitude: 35.28, longitude: -120.66 },
  radiusMi: 5,
  queries: ["2% mlik"]
};
const location = {
  locationId: "123",
  name: "Ralphs",
  address: { addressLine1: "1 Main St", city: "SLO" },
  geolocation: body.location
};
const rawProduct = (id = "milk", extra = {}) => ({
  productId: id,
  description: "Kroger Two Percent Milk",
  items: [
    {
      itemId: id,
      price: { regular: 4, promo: 3 },
      size: "1 gallon",
      inventory: { stockLevel: "HIGH" },
      ...extra
    }
  ]
});
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" }
  });

test("Kroger product images retain trusted HTTPS front images only", () => {
  const product = {
    ...rawProduct(),
    images: [
      {
        perspective: "front",
        sizes: [
          {
            size: "medium",
            url: "https://www.kroger.com/product/images/medium/front/milk"
          }
        ]
      }
    ]
  };
  assert.equal(
    normalizeKrogerProducts([product])[0].image_url,
    product.images[0].sizes[0].url
  );
  for (const url of [
    "javascript:alert(1)",
    "https://untrusted.example/image.jpg",
    "http://www.kroger.com/image.jpg"
  ]) {
    product.images[0].sizes[0].url = url;
    assert.equal(
      normalizeKrogerProducts([product])[0].image_url,
      null
    );
  }
});

function fixture({
  products,
  locations = [location],
  override
} = {}) {
  const calls = [];
  const fetchImpl = async (input, options) => {
    const url = new URL(input);
    calls.push({ url, options });
    const response = override?.(url, options, calls);
    if (response) return response;
    if (url.pathname.endsWith("/token"))
      return json({
        access_token: "test-token",
        expires_in: 1800
      });
    if (url.pathname.endsWith("/locations"))
      return json({ data: locations });
    return json({ data: products || [rawProduct()] });
  };
  return { calls, fetchImpl };
}

test("validates coordinates, radius, item limits, and names before contacting Kroger", () => {
  for (const request of [
    {},
    { ...body, location: { latitude: 91, longitude: 1 } },
    { ...body, radiusMi: 0 },
    { ...body, radiusMi: "5" },
    { ...body, queries: undefined },
    { ...body, queries: "milk" },
    { ...body, queries: [" "] },
    { ...body, queries: ["!!!"] },
    { ...body, queries: Array(21).fill("milk") },
    { ...body, queries: ["a".repeat(121)] }
  ])
    assert.throws(() => validateKrogerRequest(request), {
      status: 400
    });
  assert.deepEqual(
    validateKrogerRequest({
      ...body,
      queries: ["milk", "milk"]
    }).queries,
    ["milk"]
  );
});

test("validates an optional selected store ID before contacting Kroger", async () => {
  for (const storeId of [
    null,
    123,
    "",
    "../123",
    "x",
    "1".repeat(21)
  ]) {
    await assert.rejects(
      createKrogerClient({
        env,
        fetchImpl: () => assert.fail("Unexpected fetch")
      }).compare({ ...body, storeId }),
      { status: 400 }
    );
  }
  assert.equal(
    validateKrogerRequest({ ...body, storeId: "123" }).storeId,
    "123"
  );
});

test("store item browsing searches only the selected location, including beyond the nearest five", async () => {
  const locations = Array.from({ length: 8 }, (_, index) => ({
    ...location,
    locationId: String(index),
    geolocation: {
      ...body.location,
      latitude: body.location.latitude + index * 0.001
    }
  }));
  const { fetchImpl, calls } = fixture({ locations });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare({
    ...body,
    storeId: "7"
  });
  assert.deepEqual(
    result.stores.map((store) => store.id),
    ["7"]
  );
  assert.equal(result.limitedStores, false);
  const productCalls = calls.filter(({ url }) =>
    url.pathname.endsWith("/products")
  );
  assert.ok(productCalls.length > 0);
  assert.ok(
    productCalls.every(
      ({ url }) =>
        url.searchParams.get("filter.locationId") === "7"
    )
  );
});

test("unavailable or out-of-radius selected stores never substitute other stores' inventory", async () => {
  for (const storeId of ["999", "456"]) {
    const { fetchImpl, calls } = fixture({
      locations: [
        location,
        {
          ...location,
          locationId: "456",
          geolocation: { latitude: 0, longitude: 0 }
        }
      ]
    });
    const result = await createKrogerClient({
      env,
      fetchImpl
    }).compare({ ...body, storeId });
    assert.deepEqual(result.stores, []);
    assert.ok(
      !calls.some(({ url }) =>
        url.pathname.endsWith("/products")
      )
    );
  }
});

test("normalizes all SKU variants, promotional prices, and explicit unknown stock", () => {
  const p = rawProduct();
  p.items.push({
    itemId: "large",
    price: { regular: 5, promo: 0 },
    size: "2 gallons"
  });
  p.items.push({
    itemId: "out",
    price: { regular: 2 },
    inventory: { stockLevel: "TEMPORARILY_OUT_OF_STOCK" }
  });
  p.items.push({
    itemId: "invalid",
    price: { regular: -1, promo: 0 }
  });
  const rows = normalizeKrogerProducts([p]);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].price, 3);
  assert.equal(rows[1].price, 5);
  assert.equal(rows[1].availability, "unknown");
  assert.equal(rows[2].availability, "out_of_stock");
  assert.equal(rows[3].price, null);
  assert.notEqual(rows[0].id, rows[1].id);
});

test("map discovery includes more than five Kroger locations without additional product calls", async () => {
  const { fetchImpl, calls } = fixture({
    locations: Array.from({ length: 8 }, (_, index) => ({
      ...location,
      locationId: String(index),
      geolocation: {
        ...body.location,
        latitude: body.location.latitude + index * 0.001
      }
    }))
  });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare({ ...body, queries: [] });
  assert.equal(result.stores.length, 8);
  assert.equal(result.maxStores, 50);
  assert.ok(
    !calls.some(({ url }) => url.pathname.endsWith("/products"))
  );
});

test("active dietary filters enrich exact returned UPCs and failed facts never invent matches", async () => {
  const raw = { ...rawProduct(), upc: "0123456789012" };
  const { fetchImpl } = fixture({ products: [raw] });
  const calls = [];
  const foodFacts = {
    facts: async (codes) => {
      calls.push(codes);
      return {
        facts: {
          "0123456789012": {
            code: "0123456789012",
            allergens: ["en:milk"]
          }
        },
        limited: false
      };
    }
  };
  const result = await createKrogerClient({
    env,
    fetchImpl,
    foodFacts
  }).compare({ ...body, dietary: ["Vegan"] });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], ["0123456789012"]);
  assert.equal(
    result.stores[0].results[0].products[0].dietary_facts
      .allergens[0],
    "en:milk"
  );
  const ranked = rankKrogerStores({
    stores: result.stores,
    products: [],
    items: [
      { id: "milk", query: body.queries[0], quantity: 1 }
    ],
    dietary: ["Vegan"]
  });
  assert.equal(ranked[0].matched, 0);
  const failed = await createKrogerClient({
    env,
    fetchImpl,
    foodFacts: {
      facts: async () => {
        throw new Error("Offline");
      }
    }
  }).compare({ ...body, dietary: ["Vegan"] });
  assert.equal(failed.dietaryLimited, true);
  assert.equal(
    failed.stores[0].results[0].products[0].dietary_facts,
    undefined
  );
  await assert.rejects(
    createKrogerClient({ env, fetchImpl }).compare({
      ...body,
      dietary: ["unknown"]
    }),
    { status: 400 }
  );
});

test("uses OAuth and store-specific searches, corrects retrieval typos, and caches tokens/results", async () => {
  const { calls, fetchImpl } = fixture();
  const client = createKrogerClient({ env, fetchImpl });
  const result = await client.compare(body);
  assert.equal(result.stores[0].name, "Ralphs");
  assert.equal(result.stores[0].distance_mi, 0);
  assert.equal(
    result.stores[0].results[0].products[0].price,
    3
  );
  const productCall = calls.find((call) =>
    call.url.pathname.endsWith("/products")
  );
  assert.equal(
    productCall.url.searchParams.get("filter.locationId"),
    "123"
  );
  assert.equal(
    productCall.url.searchParams.get("filter.term"),
    "2% milk"
  );
  assert.equal(
    calls[0].options.headers.Authorization,
    `Basic ${Buffer.from("test-id:test-secret").toString("base64")}`
  );
  assert.match(calls[0].options.body, /scope=product.compact/);
  assert.equal(
    productCall.options.headers.Authorization,
    "Bearer test-token"
  );
  await client.compare(body);
  assert.equal(calls.length, 3);
  assert.doesNotMatch(
    JSON.stringify(result),
    /test-secret|test-token/
  );
});

test("nearby stores use real coordinates and searches are limited to the nearest five", async () => {
  const locations = Array.from({ length: 8 }, (_, index) => ({
    ...location,
    locationId: String(index),
    geolocation: {
      ...body.location,
      latitude: body.location.latitude + index * 0.001
    }
  }));
  locations.push({
    ...location,
    locationId: "far",
    geolocation: { latitude: 0, longitude: 0 }
  });
  const { fetchImpl } = fixture({ locations });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare(body);
  assert.equal(result.stores.length, 5);
  assert.equal(result.limitedStores, true);
  assert.deepEqual(
    result.stores.map((store) => store.id),
    ["0", "1", "2", "3", "4"]
  );
});

test("map discovery finds nearby live stores without a shopping list or product requests", async () => {
  const { fetchImpl, calls } = fixture({
    locations: [
      {
        ...location,
        locationId: "far",
        geolocation: { latitude: 0, longitude: 0 }
      },
      { ...location, locationId: "invalid", geolocation: {} },
      location
    ]
  });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare({
    ...body,
    queries: []
  });
  assert.equal(result.stores.length, 1);
  assert.deepEqual(result.stores[0], {
    id: "123",
    source: "kroger",
    name: "Ralphs",
    address: "1 Main St, SLO",
    ...body.location,
    distance_mi: 0,
    results: []
  });
  const requests = calls.map(({ url }) => url.pathname);
  assert.deepEqual(requests, [
    "/v1/connect/oauth2/token",
    "/v1/locations"
  ]);
  const search = calls[1].url.searchParams;
  assert.equal(
    search.get("filter.latLong.near"),
    "35.28,-120.66"
  );
  assert.equal(search.get("filter.radiusInMiles"), "5");
});

test("map discovery reports no nearby stores and API failures without substituting samples", async () => {
  const request = { ...body, queries: [] };
  const empty = fixture({ locations: [] });
  const result = await createKrogerClient({
    env,
    fetchImpl: empty.fetchImpl
  }).compare(request);
  assert.deepEqual(result.stores, []);
  assert.equal(result.limitedStores, false);
  const unavailable = fixture({
    override: (url) =>
      url.pathname.endsWith("/locations")
        ? json({}, 503)
        : undefined
  });
  await assert.rejects(
    createKrogerClient({
      env,
      fetchImpl: unavailable.fetchImpl
    }).compare(request),
    { status: 502 }
  );
  await assert.rejects(
    createKrogerClient({
      env: {},
      fetchImpl: () => assert.fail("Unexpected fetch")
    }).compare(request),
    { status: 503 }
  );
});

test("cache reads retain the original price check time, then refresh after expiry", async () => {
  let time = Date.parse("2026-11-12T12:00:00Z");
  const { calls, fetchImpl } = fixture();
  const client = createKrogerClient({
    env,
    fetchImpl,
    now: () => time
  });
  const first = await client.compare(body);
  time += 60000;
  const cached = await client.compare(body);
  assert.equal(
    cached.stores[0].results[0].checkedAt,
    first.stores[0].results[0].checkedAt
  );
  assert.equal(calls.length, 3);
  time += 120000;
  const fresh = await client.compare(body);
  assert.equal(
    fresh.stores[0].results[0].checkedAt,
    new Date(time).toISOString()
  );
  assert.equal(calls.length, 5);
});

test("pages product candidates and reports truncated searches instead of claiming completeness", async () => {
  const { fetchImpl, calls } = fixture({
    override: (url) => {
      if (!url.pathname.endsWith("/products")) return;
      const start = Number(
        url.searchParams.get("filter.start")
      );
      return json({
        data: Array.from({ length: 50 }, (_, index) =>
          rawProduct(String(start + index))
        ),
        meta: { pagination: { total: 125 } }
      });
    }
  });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare(body);
  assert.equal(
    result.stores[0].results[0].products.length,
    100
  );
  assert.equal(result.stores[0].results[0].truncated, true);
  assert.deepEqual(
    calls
      .filter((call) => call.url.pathname.endsWith("/products"))
      .map((call) => call.url.searchParams.get("filter.start")),
    ["1", "51"]
  );
});

test("refreshes an expired OAuth token once after a 401", async () => {
  let productCalls = 0;
  const { fetchImpl, calls } = fixture({
    override: (url) => {
      if (
        url.pathname.endsWith("/products") &&
        ++productCalls === 1
      )
        return json({}, 401);
    }
  });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare(body);
  assert.equal(result.stores[0].results[0].products.length, 1);
  assert.equal(
    calls.filter((call) => call.url.pathname.endsWith("/token"))
      .length,
    2
  );
});

test("one failed store search preserves other stores and exposes a retryable error", async () => {
  const { fetchImpl } = fixture({
    locations: [location, { ...location, locationId: "bad" }],
    override: (url) => {
      if (url.searchParams.get("filter.locationId") === "bad")
        return json({}, 429);
    }
  });
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare(body);
  assert.equal(
    result.stores.find((store) => store.id === "123").results[0]
      .products.length,
    1
  );
  assert.match(
    result.stores.find((store) => store.id === "bad").results[0]
      .error,
    /request limit/
  );
});

test("missing credentials fail clearly without making an external request", async () => {
  await assert.rejects(
    createKrogerClient({
      env: {},
      fetchImpl: () => assert.fail("Unexpected fetch")
    }).compare(body),
    { status: 503 }
  );
});

test("a mocked Kroger response feeds shared fuzzy matching and the recommendation basket", async () => {
  const { fetchImpl } = fixture();
  const result = await createKrogerClient({
    env,
    fetchImpl
  }).compare({ ...body, queries: ["2% milk"] });
  const rows = rankKrogerStores({
    stores: result.stores,
    products: [],
    items: [{ id: "i", query: "2% milk", quantity: 2 }]
  });
  assert.equal(rows[0].complete, true);
  assert.equal(rows[0].total, 6);
});

test("the Express endpoint requires a verified account and returns comparison JSON", async (t) => {
  const app = createApp({
    auth: { getUser: async () => ({ id: "user" }) },
    kroger: {
      compare: async (request) => ({
        stores: [],
        queries: request.queries
      })
    }
  });
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) =>
    server.once("listening", resolve)
  );
  t.after(
    () => new Promise((resolve) => server.close(resolve))
  );
  const url = `http://127.0.0.1:${server.address().port}/api/kroger`;
  const denied = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(denied.status, 401);
  const claims = Buffer.from(
    JSON.stringify({ sub: "user", aal: "aal1" })
  ).toString("base64url");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer header.${claims}.signature`
    },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    stores: [],
    queries: body.queries
  });
  assert.equal(
    response.headers.get("Cache-Control"),
    "no-store"
  );
});
