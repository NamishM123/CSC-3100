import assert from "node:assert/strict";
import test from "node:test";
import { runComparisonFeed } from "./comparisonFeeds.js";

test("community comparisons batch all store IDs, retain successes on partial failure, and publish progress", async () => {
  const storeIds = Array.from(
    { length: 9 },
    (_, i) => `osm-node-${i + 1}`
  );
  const calls = [];
  const updates = [];
  await runComparisonFeed(
    { kind: "community", storeIds, dietary: [] },
    {
      signal: new AbortController().signal,
      update: (value) => updates.push(value),
      loadOpen: async (body) => {
        calls.push(body);
        if (body.storeIds.includes("osm-node-5"))
          throw new Error("source failed");
        return {
          stores: body.storeIds.map((storeId) => ({
            storeId,
            offers: [{ name: "apple", price: 2 }]
          }))
        };
      }
    }
  );
  assert.deepEqual(
    calls.map((body) => body.storeIds.length),
    [4, 4, 1]
  );
  const last = updates.at(-1);
  assert.equal(last.completed, 9);
  assert.equal(Object.keys(last.entries).length, 9);
  assert.equal(last.entries["osm-node-1"].offers.length, 1);
  assert.equal(
    last.entries["osm-node-5"].error,
    "source failed"
  );
  assert.equal(last.entries["osm-node-9"].offers.length, 1);
  assert.equal(updates[1].completed, 4);
});

test("weekly-ad failures do not prevent other publishers from producing baskets", async () => {
  let last;
  await runComparisonFeed(
    {
      kind: "weekly",
      providers: [
        "california-fresh",
        "spencers",
        "slo-food-coop"
      ]
    },
    {
      signal: new AbortController().signal,
      update: (value) => {
        last = value;
      },
      loadOpen: async ({ provider }) => {
        if (provider === "spencers")
          throw new Error("temporarily unavailable");
        return { offers: [{ name: "apple", price: 2 }] };
      }
    }
  );
  assert.equal(last.completed, 3);
  assert.equal(last.entries["slo-food-coop"].offers.length, 1);
  assert.equal(
    last.entries.spencers.error,
    "temporarily unavailable"
  );
});

test("retailer comparisons cover all discovered stores and split lists longer than 20 searches", async () => {
  const queries = Array.from(
    { length: 23 },
    (_, i) => `item ${i}`
  );
  const storeIds = Array.from(
    { length: 7 },
    (_, i) => `store-${i}`
  );
  const calls = [];
  let last;
  await runComparisonFeed(
    {
      kind: "kroger",
      storeIds,
      queries,
      location: { latitude: 35, longitude: -120 },
      radiusMi: 25,
      dietary: []
    },
    {
      signal: new AbortController().signal,
      update: (value) => {
        last = value;
      },
      loadKroger: async (body) => {
        calls.push(body);
        return {
          stores: (body.storeId
            ? [body.storeId]
            : storeIds.slice(0, 5)
          ).map((id) => ({
            id,
            name: id,
            results: body.queries.map((query) => ({
              query,
              checkedAt: "2026-11-13T12:00:00Z",
              products: []
            }))
          }))
        };
      }
    }
  );
  assert.equal(calls.length, 6);
  assert.ok(calls.every((call) => call.queries.length <= 20));
  assert.equal(last.completed, last.total);
  assert.equal(Object.keys(last.entries).length, 7);
  assert.ok(
    Object.values(last.entries).every(
      (store) => store.results.length === 23
    )
  );
  assert.deepEqual(
    new Set(
      calls
        .filter((call) => call.storeId)
        .map((call) => call.storeId)
    ),
    new Set(storeIds.slice(5))
  );
});

test("a failed retailer stream retains completed searches and stops repeated failing requests", async () => {
  let calls = 0;
  let last;
  await runComparisonFeed(
    {
      kind: "kroger",
      storeIds: ["one", "two", "three"],
      queries: ["apple"],
      location: {},
      radiusMi: 5
    },
    {
      signal: new AbortController().signal,
      update: (value) => {
        last = value;
      },
      loadKroger: async () => {
        if (calls++) throw new Error("quota reached");
        return {
          stores: [
            {
              id: "one",
              name: "one",
              results: [{ query: "apple", products: [] }]
            }
          ]
        };
      }
    }
  );
  assert.equal(calls, 2);
  assert.equal(last.entries.one.results.length, 1);
  assert.equal(last.error, "quota reached");
});

test("aborting a changed list prevents further source requests and late progress updates", async () => {
  const controller = new AbortController();
  let calls = 0;
  let updates = 0;
  await assert.rejects(
    runComparisonFeed(
      { kind: "weekly", providers: ["one", "two"] },
      {
        signal: controller.signal,
        update: () => {
          updates++;
        },
        loadOpen: async () => {
          calls++;
          controller.abort();
          return { offers: [] };
        }
      }
    ),
    { name: "AbortError" }
  );
  assert.equal(calls, 1);
  assert.equal(updates, 1);
});
