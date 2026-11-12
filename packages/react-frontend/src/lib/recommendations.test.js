import assert from "node:assert/strict";
import test from "node:test";
import {
  rankKrogerStores,
  listSearchQuery
} from "./recommendations.js";
import { krogerSearchQueries } from "./krogerSearch.js";

const checkedAt = "2026-11-12T12:00:00Z";
const now = Date.parse(checkedAt);
const milk = {
  id: "milk",
  query: "2% milk",
  quantity: 1,
  checked: false
};
const eggs = {
  id: "eggs",
  query: "eggs",
  quantity: 1,
  checked: false
};
const product = (id, price, extra = {}) => ({
  id,
  name: "Kroger Two Percent Milk",
  size_label: "1 gallon",
  price,
  availability: "in_stock",
  ...extra
});
const store = (
  id,
  distance,
  milkProducts,
  eggPrice = null
) => ({
  id,
  name: id,
  distance_mi: distance,
  results: [
    { query: milk.query, products: milkProducts, checkedAt },
    {
      query: eggs.query,
      products:
        eggPrice == null
          ? []
          : [product("eggs", eggPrice, { name: "Large Eggs" })],
      checkedAt
    }
  ]
});
const rank = (stores, items = [milk], extra = {}) =>
  rankKrogerStores({
    stores,
    items,
    products: [],
    now,
    ...extra
  });

test("retailer retrieval corrects common typos and aliases while preserving explicit variants", () => {
  assert.deepEqual(
    krogerSearchQueries("milk of two percent please"),
    ["milk 2%"]
  );
  assert.deepEqual(krogerSearchQueries("2% mlik"), ["2% milk"]);
  assert.deepEqual(krogerSearchQueries("bananaz"), ["banana"]);
  assert.deepEqual(krogerSearchQueries("garbanzo beans"), [
    "chickpea",
    "garbanzo beans"
  ]);
  assert.deepEqual(krogerSearchQueries("3% organic oat milk"), [
    "3% organic oat milk"
  ]);
});

test("catalog list items preserve their requested size and free-text items preserve their query", () => {
  assert.equal(
    listSearchQuery({ product_id: "p" }, [
      { id: "p", name: "Milk, 2%", size_label: "1 gallon" }
    ]),
    "Milk, 2% 1 gallon"
  );
  assert.equal(listSearchQuery(milk, []), "2% milk");
});

test("price and distance priorities change the recommendation", () => {
  const stores = [
    store("near", 1, [product("a", 5)]),
    store("cheap", 8, [product("b", 3)])
  ];
  assert.equal(
    rank(stores, [milk], { priceWeight: 1 })[0].store.id,
    "cheap"
  );
  assert.equal(
    rank(stores, [milk], { priceWeight: 0 })[0].store.id,
    "near"
  );
});

test("a complete basket outranks a cheap partial basket and missing items aren't free", () => {
  const rows = rank(
    [
      store("partial", 0, [product("a", 1)]),
      store("complete", 5, [product("b", 4)], 5)
    ],
    [milk, eggs]
  );
  assert.equal(rows[0].store.id, "complete");
  assert.equal(rows[0].total, 9);
  assert.equal(rows[1].complete, false);
  assert.equal(rows[1].total, 1);
  assert.equal(rows[0].priceScore, 6 / 9);
});

test("selecting one of five milk products recalculates totals and store ranking", () => {
  const choices = Array.from({ length: 5 }, (_, i) =>
    product(`milk-${i}`, i + 2, {
      name: `Brand ${String.fromCharCode(65 + i)} 2% Milk`
    })
  );
  const stores = [
    store("a", 1, choices),
    store("b", 1, [product("other", 4)])
  ];
  assert.equal(
    rank(stores, [milk], { priceWeight: 1 })[0].store.id,
    "a"
  );
  const rows = rank(
    stores,
    [
      { ...milk, quantity: 2, storeSelections: { a: "milk-4" } }
    ],
    { priceWeight: 1 }
  );
  assert.equal(rows[0].store.id, "b");
  const a = rows.find((row) => row.store.id === "a");
  assert.equal(a.lines[0].options.length, 5);
  assert.equal(a.total, 12);
  assert.equal(a.lines[0].selected.id, "milk-4");
});

test("adding, removing, checking off, and changing quantity updates the basket", () => {
  const stores = [store("a", 1, [product("m", 2)], 3)];
  assert.equal(rank(stores, [milk])[0].total, 2);
  assert.equal(
    rank(stores, [milk, { ...eggs, quantity: 2 }])[0].total,
    8
  );
  assert.equal(
    rank(stores, [milk, { ...eggs, checked: true }])[0].total,
    2
  );
  assert.deepEqual(rank(stores, []), []);
});

test("unknown stock, out-of-stock, zero/invalid price, and stale results never count as available", () => {
  for (const extra of [
    { availability: "unknown" },
    { availability: "out_of_stock" },
    { price: null },
    { price: 0 },
    { price: NaN }
  ]) {
    assert.equal(
      rank([store("a", 1, [product("m", 3, extra)])])[0]
        .matched,
      0
    );
  }
  assert.equal(
    rank([store("a", 1, [product("m", 3)])], [milk], {
      now: now + 300000
    })[0].matched,
    0
  );
  assert.equal(
    rank([store("a", 1, [product("m", 3)])], [milk], {
      now: now - 1
    })[0].matched,
    0
  );
});

test("an unavailable pinned product never silently switches to a cheaper alternative", () => {
  const stores = [
    store("a", 1, [
      product("cheap", 2),
      product("chosen", 5, { availability: "out_of_stock" })
    ])
  ];
  const pinned = { ...milk, storeSelections: { a: "chosen" } };
  assert.equal(rank(stores, [pinned])[0].matched, 0);
  assert.equal(
    rank(stores, [
      { ...milk, storeSelections: { a: "gone" } }
    ])[0].matched,
    0
  );
  assert.equal(rank(stores, [milk])[0].total, 2);
});

test("shared fuzzy matching rejects the wrong percentage, explicit type, and size", () => {
  const stores = [
    store("a", 1, [
      product("wrong", 1, { name: "Kroger 1 Percent Milk" }),
      product("right", 3)
    ])
  ];
  assert.equal(rank(stores)[0].lines[0].options.length, 1);
  assert.equal(rank(stores)[0].total, 3);
  for (const query of [
    "2% oat milk",
    "3% milk",
    "0.2% milk",
    "2% milk 2 gallons"
  ]) {
    const s = store("a", 1, [product("m", 2)]);
    s.results[0].query = query;
    assert.equal(
      rank([s], [{ ...milk, query }])[0].matched,
      0,
      query
    );
  }
});

test("retailer names with typos and aliases use the existing product matcher", () => {
  for (const [query, name] of [
    ["2% mlik", "Farm Fresh Milk of Two Percent"],
    ["chickpeas", "Garbanzo beans"],
    ["scallions", "Green onions"]
  ]) {
    const s = store("a", 1, [product("p", 3, { name })]);
    s.results[0].query = query;
    assert.equal(
      rank([s], [{ ...milk, query }])[0].matched,
      1,
      query
    );
  }
});

test("ambiguous typo matches require the user's selection", () => {
  const item = { id: "i", query: "lile", quantity: 1 };
  const stores = [
    {
      id: "a",
      distance_mi: 1,
      results: [
        {
          query: "lile",
          checkedAt,
          products: [
            product("lime", 1, { name: "Lime" }),
            product("line", 2, { name: "Line" })
          ]
        }
      ]
    }
  ];
  assert.equal(rank(stores, [item])[0].matched, 0);
  assert.equal(
    rank(stores, [
      { ...item, storeSelections: { a: "lime" } }
    ])[0].total,
    1
  );
});

test("failed per-store searches remain visible and don't become missing stock claims", () => {
  const s = store("a", 1, []);
  s.results[0].error = "Rate limited";
  const row = rank([s])[0];
  assert.equal(row.score, 0);
  assert.equal(row.lines[0].status, "Search failed");
  assert.equal(row.lines[0].error, "Rate limited");
});
