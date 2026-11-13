import assert from "node:assert/strict";
import test from "node:test";
import {
  listDocument,
  ListConflictError,
  SavedListRepository
} from "./savedLists.js";
import { rankKrogerStores } from "./recommendations.js";

// Shared fake Data API: two independent clients see the same committed rows.
function database() {
  const rows = new Map();
  let fail = false;
  function client(identity) {
    return {
      from(table) {
        assert.equal(table, "account_list_state");
        const filters = {};
        let operation = "select";
        let values;
        const query = {
          select() {
            return query;
          },
          eq(key, value) {
            filters[key] = value;
            return query;
          },
          insert(value) {
            operation = "insert";
            values = value;
            return query;
          },
          update(value) {
            operation = "update";
            values = value;
            return query;
          },
          async maybeSingle() {
            if (fail) return { error: { code: "NETWORK" } };
            const owner = values?.user_id || filters.user_id;
            assert.equal(
              owner,
              identity,
              "every request must address the authenticated account"
            );
            const row = rows.get(owner);
            if (operation === "insert") {
              if (row) return { error: { code: "23505" } };
              rows.set(owner, structuredClone(values));
            } else if (operation === "update") {
              if (!row || row.revision !== filters.revision)
                return { data: null };
              rows.set(owner, {
                ...row,
                ...structuredClone(values)
              });
            }
            return {
              data: structuredClone(rows.get(owner) || null)
            };
          }
        };
        return query;
      }
    };
  }
  return {
    client,
    rows,
    fail(value) {
      fail = value;
    }
  };
}

function shoppingState() {
  return {
    lists: [{ id: "custom", name: "Next month" }],
    items: [
      {
        id: "line",
        list_id: "custom",
        product_id: "request",
        query: "2% milk",
        name: "Kroger 2% Milk",
        image_url: "/milk.svg",
        size_label: "1 gal",
        quantity: 2,
        checked: false,
        storeSelections: { ralphs: "milk:one" },
        price: 3,
        total: 6
      }
    ],
    activeListId: "custom",
    krogerPriceWeight: 0.6
  };
}

test("new accounts are empty; legacy starter lists are removed without removing user lists", () => {
  assert.deepEqual(listDocument().lists, []);
  const state = shoppingState();
  state.lists.push({
    id: "list-weekly",
    name: "Weekly groceries"
  });
  state.items.push({ id: "sample", list_id: "list-weekly" });
  assert.deepEqual(listDocument(state).lists, [
    { id: "custom", name: "Next month" }
  ]);
  assert.equal(listDocument(state).items.length, 1);
});

test("lists survive a fresh client/account session, preserve SKU choices, and never store prices or credentials", async () => {
  const db = database();
  const first = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  assert.equal(await first.load(), null);
  await first.save({
    ...shoppingState(),
    access_token: "secret",
    catalog: { prices: [1] }
  });
  const returned = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  assert.deepEqual(
    await returned.load(),
    listDocument(shoppingState())
  );
  assert.equal(
    db.rows.get("alice").document.items[0].price,
    undefined
  );
  assert.equal(
    db.rows.get("alice").document.items[0].total,
    undefined
  );
  assert.equal(
    db.rows.get("alice").document.access_token,
    undefined
  );
  assert.equal(
    await new SavedListRepository(
      db.client("bob"),
      "bob"
    ).load(),
    null
  );
});

test("saving waits for loading; failures can retry without losing pending edits", async () => {
  const db = database();
  const repo = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  await assert.rejects(
    repo.save(shoppingState()),
    /Load your saved lists/
  );
  db.fail(true);
  await assert.rejects(repo.load(), /Unable to load/);
  db.fail(false);
  await repo.load();
  db.fail(true);
  await assert.rejects(
    repo.save(shoppingState()),
    /Unable to save/
  );
  assert.equal(repo.baseline, null);
  db.fail(false);
  await repo.save(shoppingState());
  assert.equal(db.rows.get("alice").document.items.length, 1);
});

test("concurrent changes from another device cannot overwrite committed lists", async () => {
  const db = database();
  const a = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  const b = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  await Promise.all([a.load(), b.load()]);
  await a.save(shoppingState());
  await assert.rejects(
    b.save({ lists: [], items: [] }),
    ListConflictError
  );
  await b.load();
  await a.save({ ...shoppingState(), items: [] });
  await assert.rejects(
    b.save({ lists: [], items: [] }),
    ListConflictError
  );
  assert.equal(db.rows.get("alice").document.items.length, 0);
  assert.equal(db.rows.get("alice").document.lists.length, 1);
});

test("rapid queued edits and deletion persist in order", async () => {
  const db = database();
  const repo = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  await repo.load();
  const state = shoppingState();
  await Promise.all([
    repo.save(state),
    repo.save({ ...state, items: [] }),
    repo.save({ lists: [], items: [] })
  ]);
  assert.equal(db.rows.get("alice").revision, 3);
  assert.deepEqual(db.rows.get("alice").document.lists, []);
  assert.deepEqual(db.rows.get("alice").document.items, []);
});

test("a saved basket reopened a month later uses the current store price for its pinned SKU", async () => {
  const db = database();
  const repo = new SavedListRepository(
    db.client("alice"),
    "alice"
  );
  await repo.load();
  await repo.save(shoppingState());
  const reopened = await new SavedListRepository(
    db.client("alice"),
    "alice"
  ).load();
  function basket(date, price, sku = "milk:one") {
    return rankKrogerStores({
      products: [],
      items: reopened.items,
      now: Date.parse(date),
      stores: [
        {
          id: "ralphs",
          distance_mi: 1,
          results: [
            {
              query: "2% milk",
              checkedAt: date,
              products: [
                {
                  id: sku,
                  name: "Kroger 2% Milk",
                  size_label: "1 gal",
                  price,
                  availability: "in_stock"
                }
              ]
            }
          ]
        }
      ]
    })[0];
  }
  assert.equal(basket("2026-11-12T12:00:00Z", 3).total, 6);
  assert.equal(basket("2026-12-12T12:00:00Z", 4.5).total, 9);
  assert.equal(
    basket("2026-12-12T12:00:00Z", 2, "replacement").matched,
    0
  );
});
