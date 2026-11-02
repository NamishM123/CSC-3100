import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_NOW,
  prices,
  product_swaps,
  products,
  shopping_list_items,
  stores
} from "../data/mock.js";
import { cents } from "./format.js";
import { compareList, freshQuotes } from "./compare.js";

function referenceCompareList({
  items,
  products: catalogProducts,
  prices: catalogPrices,
  stores: catalogStores,
  swaps,
  acceptedSwapIds,
  radiusMi,
  includeMember,
  now
}) {
  const active = (items || []).filter(
    (item) => !item.checked && item.quantity > 0
  );
  if (active.length === 0) {
    return {
      activeCount: 0,
      missing: [],
      stops: [],
      splitTotal: 0,
      single: null,
      savings: null,
      extraMinutes: null,
      oldestUpdatedAt: null
    };
  }
  const missing = [];
  const assignments = [];

  active.forEach((item) => {
    const product = catalogProducts.find(
      (entry) => entry.id === item.product_id
    );
    const quotes = freshQuotes({
      productId: item.product_id,
      prices: catalogPrices,
      stores: catalogStores,
      radiusMi,
      includeMember,
      now,
      swaps,
      acceptedSwapIds
    });
    if (!product || quotes.length === 0) {
      missing.push(
        product || { id: item.product_id, name: "Unknown item" }
      );
      return;
    }
    const best = quotes[0];
    assignments.push({
      item,
      product,
      store: best.store,
      line: cents(best.unit * item.quantity),
      unit: best.unit,
      updated_at: best.updated_at
    });
  });

  const stopsMap = new Map();
  assignments.forEach((row) => {
    const current = stopsMap.get(row.store.id) || {
      store: row.store,
      items: [],
      total: 0
    };
    current.items.push(row);
    current.total = cents(current.total + row.line);
    stopsMap.set(row.store.id, current);
  });

  const stops = [...stopsMap.values()].sort(
    (a, b) => a.store.distance_mi - b.store.distance_mi
  );
  const splitTotal = cents(
    stops.reduce((sum, stop) => sum + stop.total, 0)
  );

  let single = null;
  catalogStores
    .filter((store) => store.distance_mi <= radiusMi)
    .forEach((store) => {
      const lines = [];
      let total = 0;
      for (const item of active) {
        const product = catalogProducts.find(
          (entry) => entry.id === item.product_id
        );
        const quote = freshQuotes({
          productId: item.product_id,
          prices: catalogPrices,
          stores: catalogStores,
          radiusMi,
          includeMember,
          now,
          swaps,
          acceptedSwapIds
        }).find((entry) => entry.store.id === store.id);
        if (!product || !quote) return;
        const line = cents(quote.unit * item.quantity);
        total = cents(total + line);
        lines.push({
          item,
          product,
          line,
          updated_at: quote.updated_at
        });
      }
      if (lines.length !== active.length) return;
      if (!single || total < single.total) {
        single = { store, total, items: lines };
      }
    });

  const splitDrive = stops.reduce(
    (sum, stop) => sum + stop.store.drive_minutes,
    0
  );
  const usedDates = assignments.map((row) => row.updated_at);
  if (single) {
    single.items.forEach((row) =>
      usedDates.push(row.updated_at)
    );
  }
  const dated = usedDates.filter(Boolean).sort();

  return {
    activeCount: active.length,
    missing,
    stops,
    splitTotal,
    single,
    savings: single ? cents(single.total - splitTotal) : null,
    extraMinutes: single
      ? splitDrive - single.store.drive_minutes
      : null,
    oldestUpdatedAt: dated[0] || null
  };
}

function summarize(plan) {
  return {
    activeCount: plan.activeCount,
    missing: plan.missing.map((product) => product.name),
    stops: plan.stops.map((stop) => ({
      store: stop.store.name,
      total: stop.total,
      items: stop.items.map((row) => row.product.name)
    })),
    splitTotal: plan.splitTotal,
    single: plan.single
      ? {
          store: plan.single.store.name,
          total: plan.single.total
        }
      : null,
    savings: plan.savings,
    extraMinutes: plan.extraMinutes,
    oldestUpdatedAt: plan.oldestUpdatedAt
  };
}

function weeklyInput(overrides = {}) {
  return {
    items: shopping_list_items,
    products,
    prices,
    stores,
    swaps: product_swaps,
    acceptedSwapIds: [],
    radiusMi: 5,
    includeMember: true,
    now: DEMO_NOW,
    ...overrides
  };
}

test("weekly groceries match the pre-refactor comparison", () => {
  const input = weeklyInput();
  const before = referenceCompareList(input);
  const after = compareList(input);
  const beforeSummary = summarize(before);
  const afterSummary = summarize(after);
  console.log(`BEFORE ${JSON.stringify(beforeSummary)}`);
  console.log(`AFTER ${JSON.stringify(afterSummary)}`);
  assert.deepEqual(after, before);
  assert.deepEqual(afterSummary, {
    activeCount: 6,
    missing: [],
    stops: [
      {
        store: "Trader Joe's",
        total: 10.38,
        items: [
          "Bananas",
          "Eggs, large",
          "Peanut butter",
          "Spinach"
        ]
      },
      {
        store: "Grocery Outlet",
        total: 7.24,
        items: ["Milk, 2%", "Bread, whole wheat"]
      }
    ],
    splitTotal: 17.62,
    single: { store: "Trader Joe's", total: 21.47 },
    savings: 3.85,
    extraMinutes: 7,
    oldestUpdatedAt: "2026-10-05T13:41:00.000Z"
  });
});

test("checked and zero-quantity lines are ignored", () => {
  const input = weeklyInput({
    items: [
      ...shopping_list_items.map((item) => ({
        ...item,
        checked: true
      })),
      {
        id: "zero",
        list_id: "list-weekly",
        product_id: "prod-bananas",
        quantity: 0,
        checked: false
      }
    ]
  });
  const after = compareList(input);
  assert.deepEqual(after, referenceCompareList(input));
  assert.equal(after.activeCount, 0);
  assert.equal(after.splitTotal, 0);
  assert.equal(after.single, null);
});

test("member prices, swaps, radius, and missing products stay aligned", () => {
  const cases = [
    weeklyInput({ includeMember: false }),
    weeklyInput({ radiusMi: 1 }),
    weeklyInput({ radiusMi: 0 }),
    weeklyInput({
      acceptedSwapIds: ["swap-pb-tj"]
    }),
    weeklyInput({
      items: [
        {
          id: "unknown",
          product_id: "missing-product",
          quantity: 1,
          checked: false
        },
        shopping_list_items[0]
      ]
    })
  ];
  for (const input of cases) {
    assert.deepEqual(
      summarize(compareList(input)),
      summarize(referenceCompareList(input))
    );
  }
});

test("duplicate product ids and store prices keep the first match", () => {
  const localStores = [
    {
      id: "near",
      name: "Near",
      distance_mi: 1,
      drive_minutes: 4
    },
    {
      id: "far",
      name: "Far",
      distance_mi: 2,
      drive_minutes: 9
    }
  ];
  const first = { id: "milk", name: "First milk" };
  const second = { id: "milk", name: "Second milk" };
  const input = {
    items: [
      {
        id: "line",
        product_id: "milk",
        quantity: 2,
        checked: false
      }
    ],
    products: [first, second],
    prices: [
      {
        id: "expensive",
        product_id: "milk",
        store_id: "near",
        price: 5,
        regular_price: 5,
        in_stock: true,
        is_member_price: false,
        updated_at: "2026-10-05T12:00:00.000Z"
      },
      {
        id: "cheap",
        product_id: "milk",
        store_id: "near",
        price: 3,
        regular_price: 3,
        in_stock: true,
        is_member_price: false,
        updated_at: "2026-10-05T12:00:00.000Z"
      },
      {
        id: "far-price",
        product_id: "milk",
        store_id: "far",
        price: 1,
        regular_price: 1,
        in_stock: true,
        is_member_price: false,
        updated_at: "2026-10-05T11:00:00.000Z"
      }
    ],
    stores: localStores,
    swaps: [],
    acceptedSwapIds: [],
    radiusMi: 5,
    includeMember: true,
    now: DEMO_NOW
  };
  const after = compareList(input);
  assert.deepEqual(after, referenceCompareList(input));
  assert.equal(
    after.stops[0].items[0].product.name,
    "First milk"
  );
  assert.equal(after.single.store.id, "far");
  assert.equal(after.single.total, 2);
});

test("random catalogs match the previous compareList output", () => {
  let seed = 28;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let scenario = 0; scenario < 30; scenario += 1) {
    const localStores = [0, 1, 2].map((index) => ({
      id: `s${index}`,
      name: `Store ${index}`,
      distance_mi: Math.round(random() * 80) / 10,
      drive_minutes: Math.floor(random() * 15)
    }));
    const localProducts = [0, 1, 2].map((index) => ({
      id: `p${index}`,
      name: `Product ${index}`
    }));
    if (random() < 0.3) {
      localProducts.push({
        id: "p0",
        name: "Duplicate of product 0"
      });
    }
    const localPrices = [];
    for (const product of localProducts) {
      for (const store of localStores) {
        if (random() < 0.25) continue;
        localPrices.push({
          id: `${product.id}-${store.id}-${localPrices.length}`,
          product_id: product.id,
          store_id: store.id,
          price: Math.round(random() * 500) / 100,
          regular_price: Math.round(random() * 500) / 100,
          in_stock: random() > 0.15,
          is_member_price: random() < 0.3,
          updated_at:
            random() < 0.2
              ? "2026-09-01T00:00:00.000Z"
              : "2026-10-05T12:00:00.000Z"
        });
      }
    }
    const items = [0, 1, 2, 3].map((index) => ({
      id: `i${index}`,
      product_id: random() < 0.15 ? "missing" : `p${index % 3}`,
      quantity:
        random() < 0.15 ? 0 : 1 + Math.floor(random() * 3),
      checked: random() < 0.15
    }));
    const input = {
      items,
      products: localProducts,
      prices: localPrices,
      stores: localStores,
      swaps: [
        {
          id: "swap-1",
          product_id: "p0",
          store_id: "s0",
          price: 0.5
        }
      ],
      acceptedSwapIds: random() < 0.5 ? ["swap-1"] : [],
      radiusMi: [1, 3, 8][scenario % 3],
      includeMember: scenario % 2 === 0,
      now: DEMO_NOW
    };
    assert.deepEqual(
      compareList(input),
      referenceCompareList(input)
    );
  }
});
