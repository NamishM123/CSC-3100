import assert from "node:assert/strict";
import test from "node:test";
import {
  clearAccountState,
  loadAccountState,
  saveAccountState
} from "./accountStorage.js";

function storage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
    entries
  };
}

test("local lists and location never cross account boundaries or load before verified sign-in", () => {
  const cache = storage();
  const data = {
    lists: [{ id: "private-list" }],
    location: { zip: "12345" },
    recentSearches: ["private search"]
  };
  saveAccountState(cache, "account-a", data);
  assert.deepEqual(loadAccountState(cache, "account-a"), data);
  assert.deepEqual(loadAccountState(cache, "account-b"), {});
  assert.deepEqual(loadAccountState(cache, null), {});
  saveAccountState(cache, null, data);
  assert.equal(cache.entries.size, 1);
});

test("passwords, Auth tokens, factor secrets, and profiles are excluded from app persistence", () => {
  const cache = storage();
  saveAccountState(cache, "a", {
    lists: [],
    password: "secret",
    access_token: "token",
    refresh_token: "token",
    user: { id: "a" },
    secret: "totp",
    catalog: { products: [] }
  });
  assert.deepEqual(loadAccountState(cache, "a"), { lists: [] });
});

test("logout clears the active account and legacy unscoped cache without touching another account", () => {
  const cache = storage();
  saveAccountState(cache, "a", { alerts: ["a"] });
  saveAccountState(cache, "b", { alerts: ["b"] });
  cache.setItem(
    "price-pantry-demo",
    JSON.stringify({ lists: ["old shared data"] })
  );
  assert.deepEqual(loadAccountState(cache, "unknown"), {});
  clearAccountState(cache, "a");
  assert.deepEqual(loadAccountState(cache, "a"), {});
  assert.deepEqual(loadAccountState(cache, "b"), {
    alerts: ["b"]
  });
  assert.equal(cache.getItem("price-pantry-demo"), null);
});

test("malformed or unavailable browser storage does not block the app", () => {
  const cache = storage();
  cache.setItem("price-pantry-account:a", "not JSON");
  assert.deepEqual(loadAccountState(cache, "a"), {});
  const blocked = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
    removeItem() {
      throw new Error("blocked");
    }
  };
  assert.deepEqual(loadAccountState(blocked, "a"), {});
  assert.doesNotThrow(() => saveAccountState(blocked, "a", {}));
  assert.doesNotThrow(() => clearAccountState(blocked, "a"));
});
