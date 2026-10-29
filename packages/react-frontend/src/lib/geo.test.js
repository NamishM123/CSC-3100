import assert from "node:assert/strict";
import test from "node:test";
import {
  coordinatesOf,
  distanceMiles,
  lookupZip,
  nearbyStores
} from "./geo.js";

test("coordinates reject missing and invalid locations without substituting zero", () => {
  for (const value of [
    null,
    {},
    { latitude: null, longitude: null },
    { latitude: "", longitude: "" },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: "invalid", longitude: 10 }
  ])
    assert.equal(coordinatesOf(value), null);
  assert.deepEqual(
    coordinatesOf({ latitude: "0", longitude: "0" }),
    { latitude: 0, longitude: 0 }
  );
});

test("distance and nearby filtering follow the selected coordinates", () => {
  const sanFrancisco = {
    latitude: 37.7749,
    longitude: -122.4194
  };
  const seattle = { latitude: 47.6062, longitude: -122.3321 };
  assert.equal(distanceMiles(sanFrancisco, sanFrancisco), 0);
  assert(
    Math.abs(distanceMiles(sanFrancisco, seattle) - 679) < 2
  );
  assert.equal(distanceMiles(sanFrancisco, {}), null);
  const stores = [
    { id: "far", ...sanFrancisco },
    { id: "near", latitude: 47.61, longitude: -122.33 },
    { id: "missing" },
    { id: "here", ...seattle }
  ];
  const result = nearbyStores(stores, seattle, 5);
  assert.deepEqual(
    result.map((store) => store.id),
    ["here", "near"]
  );
  assert.equal(stores[0].distance_mi, undefined);
  assert.deepEqual(nearbyStores(stores, null, 5), []);
});

test("ZIP lookup maps real response coordinates and caches the result", async (t) => {
  let requests = 0;
  t.mock.method(globalThis, "fetch", async (url) => {
    requests += 1;
    assert.equal(url, "https://api.zippopotam.us/us/98101");
    return new Response(
      JSON.stringify({
        places: [
          {
            "place name": "Seattle",
            "state abbreviation": "WA",
            latitude: "47.6114",
            longitude: "-122.3305"
          }
        ]
      }),
      { status: 200 }
    );
  });
  const place = await lookupZip("98101");
  assert.deepEqual(place, {
    city: "Seattle",
    state: "WA",
    zip: "98101",
    latitude: 47.6114,
    longitude: -122.3305,
    source: "zip",
    demoNote: false
  });
  assert.deepEqual(await lookupZip("98101"), place);
  assert.equal(requests, 1);
});

test("invalid, unknown, and unavailable ZIP lookups never invent a location", async (t) => {
  await assert.rejects(lookupZip("abc"), /5 digit/);
  t.mock.method(
    globalThis,
    "fetch",
    async () => new Response("{}", { status: 404 })
  );
  await assert.rejects(lookupZip("00000"), /not found/);
  globalThis.fetch.mock.mockImplementation(async () => {
    throw new TypeError("Failed to fetch");
  });
  await assert.rejects(lookupZip("00001"), /connection/);
});
