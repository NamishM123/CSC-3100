import assert from "node:assert/strict";
import test from "node:test";
import {
  advertisedProduct,
  buildComparisonStores,
  rankStoreBaskets,
  reportedProduct
} from "./storeComparisons.js";
import { rankKrogerStores } from "./recommendations.js";
import { listDocument } from "./savedLists.js";

const checkedAt = "2026-11-13T12:00:00Z";
const now = Date.parse(checkedAt);
const item = (query, extra = {}) => ({
  id: query,
  query,
  quantity: 1,
  checked: false,
  ...extra
});
const product = (name, price, extra = {}) => ({
  id: name,
  name,
  size_label: "1 each",
  price,
  availability: "in_stock",
  evidence: "catalog",
  checkedAt,
  pricing_unit: "item",
  price_quantity: 1,
  ...extra
});
const store = (id, products, extra = {}) => ({
  id,
  name: id,
  source: "catalog",
  distance_mi: 1,
  comparisonProducts: products,
  ...extra
});
const rank = (stores, items, extra = {}) =>
  rankStoreBaskets({
    stores,
    items,
    products: [],
    now,
    priceWeight: 1,
    ...extra
  });
const ad = (name, price, extra = {}) =>
  advertisedProduct(
    {
      name,
      price,
      price_quantity: 1,
      unit: "each",
      starts_on: "2026-11-11",
      ends_on: "2026-11-17",
      ...extra
    },
    "california-fresh"
  );

test("all stores keep proposed lists; four priced items and a missing apple produce a partial total and lower score", () => {
  const items = ["apple", "milk", "bread", "eggs", "rice"].map(
    (name) => item(name)
  );
  const complete = store(
    "complete",
    items.map((i) => product(i.query, 2))
  );
  const partial = store(
    "partial",
    items.slice(1).map((i) => product(i.query, 2))
  );
  const empty = store("empty", []);
  const rows = rank([partial, empty, complete], items);
  assert.deepEqual(
    rows.map((row) => row.store.id),
    ["complete", "partial", "empty"]
  );
  assert.equal(rows[0].score, 100);
  assert.equal(rows[1].score, 80);
  assert.equal(rows[1].total, 8);
  assert.equal(rows[1].coverage, 0.8);
  assert.equal(rows[1].complete, false);
  assert.equal(rows[1].lines.length, 5);
  assert.equal(rows[1].missing[0].query, "apple");
  assert.doesNotMatch(
    rows[1].missing[0].status,
    /out of stock/i
  );
  assert.equal(rows[2].score, 0);
  assert.equal(rows[2].lines.length, 5);
});

test("missing lines do not become free in the price score and complete priced baskets stay first", () => {
  const rows = rank(
    [
      store("cheap-partial", [product("milk", 1)]),
      store("complete", [
        product("milk", 4),
        product("eggs", 5)
      ])
    ],
    [item("milk"), item("eggs")]
  );
  assert.equal(rows[0].store.id, "complete");
  assert.equal(rows[0].priceScore, 6 / 9);
  assert.equal(rows[1].total, 1);
  assert.equal(rows[1].score, 50);
});

test("explicit stock failure, missing data, pending feeds, and failed searches remain distinct", () => {
  const rows = rank(
    [
      store("out", [
        product("apple", 2, { availability: "out_of_stock" })
      ]),
      store("unknown", []),
      store("loading", [], { loading: true }),
      store("failed", [], { feedError: "Upstream unavailable" })
    ],
    [item("apple")]
  );
  const byId = Object.fromEntries(
    rows.map((row) => [row.store.id, row.lines[0]])
  );
  assert.equal(byId.out.status, "Out of stock");
  assert.match(byId.unknown.status, /No matching priced item/);
  assert.match(byId.loading.status, /Checking/);
  assert.equal(
    byId.failed.status,
    "Prices could not be checked"
  );
  assert.ok(rows.every((row) => row.score === 0));
});

test("advertisements and fresh reports provide estimates without becoming confirmed stock", () => {
  const report = reportedProduct({
    name: "milk",
    price: 3,
    unit: "1 gallon",
    observed_on: "2026-11-12",
    source_url: "https://prices.openfoodfacts.org/prices/1"
  });
  const rows = rank(
    [
      store("advertised", [ad("milk", 2)]),
      store("reported", [report])
    ],
    [item("milk")]
  );
  assert.ok(
    rows.every(
      (row) =>
        row.complete &&
        row.estimated &&
        row.confirmed === 0 &&
        !row.confirmedComplete
    )
  );
  assert.match(rows[0].lines[0].status, /stock unconfirmed/);
  assert.equal(rows[1].total, 3);
  for (const observed_on of [
    "2026-11-06",
    "2026-11-14",
    "bad"
  ]) {
    assert.equal(
      rank(
        [
          store("report", [
            reportedProduct({
              name: "milk",
              price: 2,
              observed_on,
              unit: "1 gallon"
            })
          ])
        ],
        [item("milk")]
      )[0].matched,
      0
    );
  }
  assert.equal(
    rank(
      [store("ad", [ad("milk", 2, { ends_on: "2026-11-12" })])],
      [item("milk")]
    )[0].matched,
    0
  );
});

test("unit choices prevent mixing per-pound and per-item prices and persist as shopping intent", () => {
  const stores = [
    store("pounds-a", [ad("apple", 2, { unit: "lb" })]),
    store("pounds-b", [ad("apple", 3, { unit: "lb" })]),
    store("each", [product("apple", 1)])
  ];
  const auto = rank(stores, [item("apple")]);
  assert.equal(
    auto.find((row) => row.store.id === "pounds-a").matched,
    1
  );
  assert.match(
    auto.find((row) => row.store.id === "each").lines[0].status,
    /Different pricing unit/
  );
  const each = rank(stores, [
    item("apple", { comparisonUnit: "item" })
  ]);
  assert.equal(each[0].store.id, "each");
  assert.equal(
    each.find((row) => row.store.id === "pounds-a").matched,
    0
  );
  const document = listDocument({
    lists: [{ id: "list", name: "Food" }],
    items: [
      {
        ...item("apple"),
        list_id: "list",
        comparisonUnit: "lb",
        price: 7,
        availability: "in_stock",
        storeSelections: {
          "pounds-a": ad("apple", 2, { unit: "lb" }).id
        }
      }
    ]
  });
  assert.equal(document.items[0].comparisonUnit, "lb");
  assert.equal(document.items[0].price, undefined);
  assert.equal(document.items[0].availability, undefined);
});

test("multi-buy requirements affect actual purchase cost; quantity and product selection immediately recalculate", () => {
  const bundle = ad("apple", 4, { price_quantity: 2 });
  const single = ad("fresh apple", 3);
  const stores = [store("shop", [bundle, single])];
  assert.equal(rank(stores, [item("apple")])[0].total, 3);
  const two = rank(stores, [item("apple", { quantity: 2 })])[0];
  assert.equal(two.total, 4);
  assert.equal(two.lines[0].selected.id, bundle.id);
  const pinned = rank(stores, [
    item("apple", { storeSelections: { shop: bundle.id } })
  ])[0];
  assert.equal(pinned.total, 4);
  assert.equal(pinned.lines[0].purchase.extra, 1);
  assert.equal(
    rank(stores, [
      item("apple", {
        quantity: 3,
        storeSelections: { shop: bundle.id }
      })
    ])[0].total,
    8
  );
  assert.equal(
    rank(stores, [item("apple", { checked: true })]).length,
    0
  );
});

test("saved advertisement choices survive price/date refreshes but unavailable or excluded choices never switch silently", () => {
  const before = ad("apple", 2);
  const after = ad("apple", 5, {
    starts_on: "2026-11-12",
    ends_on: "2026-11-18"
  });
  assert.equal(before.id, after.id);
  const pinned = item("apple", {
    storeSelections: { shop: before.id }
  });
  assert.equal(
    rank([store("shop", [after])], [pinned])[0].total,
    5
  );
  assert.equal(
    rank(
      [store("shop", [product("other apple", 1)])],
      [pinned]
    )[0].matched,
    0
  );
  const excluded = product("apple", 2, {
    dietary_conflicts: ["Vegan"],
    dietary_verified: true
  });
  const row = rank(
    [store("shop", [excluded])],
    [item("apple", { storeSelections: { shop: excluded.id } })],
    { dietary: ["Vegan"] }
  )[0];
  assert.equal(row.matched, 0);
  assert.match(row.lines[0].status, /dietary/);
});

test("sample data never changes real-store scores or the automatic unit basis", () => {
  const real = store("real", [ad("apple", 5, { unit: "lb" })]);
  const baseline = rank([real], [item("apple")])[0].score;
  const rows = rank(
    [
      store(
        "sample",
        [product("apple", 0.01, { evidence: "demo" })],
        { source: "demo" }
      ),
      real
    ],
    [item("apple")]
  );
  assert.equal(rows[0].store.id, "real");
  assert.equal(rows[0].score, baseline);
  assert.equal(rows[0].lines[0].unit, "lb");
});

test("confirmed retailer scoring remains compatible with saved Kroger recommendations and strict size matching", () => {
  const stores = [1, 2].map((id) => ({
    id: String(id),
    name: String(id),
    source: "kroger",
    distance_mi: id,
    results: [
      {
        query: "2% milk 1 gallon",
        checkedAt,
        products: [
          product(`Brand ${id} 2% milk`, id + 2, {
            size_label: "1 gallon"
          })
        ]
      }
    ]
  }));
  const items = [item("2% milk 1 gallon", { quantity: 2 })];
  const before = rankKrogerStores({
    stores,
    items,
    products: [],
    now
  });
  const after = rank(stores, items, { priceWeight: 0.7 });
  assert.deepEqual(
    after.map((row) => [row.store.id, row.total, row.score]),
    before.map((row) => [row.store.id, row.total, row.score])
  );
  stores[0].results[0].products[0].size_label = "64 oz";
  assert.equal(
    rank(stores, items).find((row) => row.store.id === "1")
      .matched,
    0
  );
});

test("all source adapters include stores with no structured data and keep failed retailer metadata on the map", () => {
  const position = { latitude: 35.28, longitude: -120.66 };
  const catalog = {
    products: [
      { id: "bread", name: "bread", size_label: "1 loaf" }
    ],
    prices: [
      {
        id: "p",
        product_id: "bread",
        store_id: "catalog",
        price: 3,
        in_stock: true,
        source: "catalog",
        updated_at: checkedAt
      }
    ],
    stores: [
      {
        id: "catalog",
        name: "Catalog",
        source: "catalog",
        ...position
      },
      {
        id: "weekly",
        name: "Ad store",
        source: "weekly-ads",
        provider: "california-fresh",
        ...position
      },
      {
        id: "flyer",
        name: "Spencer's",
        source: "weekly-ads",
        provider: "spencers",
        ...position
      },
      {
        id: "osm-node-1",
        name: "Community",
        source: "openstreetmap",
        ...position
      },
      {
        id: "retailer",
        name: "Retailer",
        source: "kroger",
        ...position
      }
    ]
  };
  const rows = buildComparisonStores({
    catalog,
    location: position,
    radiusMi: 5,
    weekly: {
      entries: {
        "california-fresh": {
          offers: [
            {
              name: "apple",
              price: 2,
              unit: "each",
              starts_on: "2026-11-11",
              ends_on: "2026-11-17"
            }
          ]
        },
        spencers: {
          offers: [],
          documents: [
            { source_url: "https://example.com/ad.pdf" }
          ]
        }
      }
    },
    community: {
      entries: {
        "osm-node-1": {
          offers: [
            {
              name: "milk",
              price: 2,
              unit: "1 gallon",
              observed_on: "2026-11-12"
            }
          ]
        }
      }
    },
    kroger: {
      entries: {
        retailer: {
          id: "retailer",
          source: "kroger",
          feedError: "Could not check"
        }
      }
    }
  });
  assert.equal(rows.length, 5);
  const ranked = rank(rows, [
    item("bread"),
    item("apple"),
    item("milk")
  ]);
  assert.equal(
    ranked.find((row) => row.store.id === "flyer").matched,
    0
  );
  assert.match(
    ranked.find((row) => row.store.id === "flyer").lines[0]
      .status,
    /flyer/
  );
  assert.equal(
    ranked.find((row) => row.store.id === "retailer").store
      .name,
    "Retailer"
  );
  assert.equal(
    ranked.find((row) => row.store.id === "catalog").matched,
    1
  );
  assert.equal(
    ranked.find((row) => row.store.id === "weekly").matched,
    1
  );
  assert.equal(
    ranked.find((row) => row.store.id === "osm-node-1").matched,
    1
  );
});
