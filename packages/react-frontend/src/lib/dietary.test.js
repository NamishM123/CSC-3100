import assert from "node:assert/strict";
import test from "node:test";
import { dietaryStatus } from "./dietary.js";
import { rankKrogerStores } from "./recommendations.js";
import { compareList, priceForMembership } from "./compare.js";
import { mergeNearbyStores } from "./storeDiscovery.js";
import { notificationWatch } from "./saleNotifications.js";
import { catalogForLocation } from "./catalog.js";

test("catalog radius checks use the selected location instead of illustrative stored distances", () => {
  const catalog = {
    stores: [
      {
        id: "slo",
        distance_mi: 0.8,
        latitude: 35.28,
        longitude: -120.66
      }
    ]
  };
  assert.ok(
    catalogForLocation(catalog, {
      latitude: 40.71,
      longitude: -74
    }).stores[0].distance_mi > 100
  );
  assert.equal(
    catalogForLocation(catalog, {
      latitude: 35.28,
      longitude: -120.66
    }).stores[0].distance_mi,
    0
  );
  assert.equal(
    catalogForLocation(catalog, null).stores[0].distance_mi,
    Infinity
  );
  assert.equal(catalog.stores[0].distance_mi, 0.8);
});

test("dietary filters also exclude incompatible sale and price-alert watches without deleting saved requests", () => {
  const state = {
    lists: [{ id: "list" }],
    items: [
      { list_id: "list", product_id: "milk", quantity: 1 },
      { list_id: "list", product_id: "fruit", quantity: 1 }
    ],
    alerts: [{ product_id: "milk", below: 3 }],
    dietary: ["Vegan"],
    catalog: {
      products: [
        { id: "milk", name: "Whole Milk" },
        { id: "fruit", name: "Bananas" }
      ]
    }
  };
  const watch = notificationWatch(state);
  assert.deepEqual(watch.productIds, ["fruit"]);
  assert.deepEqual(watch.alerts, []);
  assert.equal(state.items.length, 2);
  assert.equal(state.alerts.length, 1);
});

test("dietary filters require affirmative evidence and all selected filters", () => {
  assert.equal(
    dietaryStatus({ name: "Mystery food" }, []).ok,
    true
  );
  assert.equal(
    dietaryStatus({ name: "Mystery food" }, ["Vegan"]).ok,
    false
  );
  assert.equal(dietaryStatus(null, ["Vegan"]).ok, false);
  assert.equal(
    dietaryStatus({ name: "Gluten-free oat drink" }, [
      "Gluten free"
    ]).ok,
    true
  );
  assert.equal(
    dietaryStatus({ name: "Gluten-free oat drink" }, [
      "Gluten free",
      "Nut free"
    ]).ok,
    false
  );
  assert.equal(
    dietaryStatus({ name: "Lactose Free Whole Milk" }, [
      "Dairy free"
    ]).ok,
    false
  );
  assert.equal(
    dietaryStatus({ name: "Non-vegan cheese" }, ["Vegan"]).ok,
    false
  );
  assert.equal(
    dietaryStatus({ name: "Non-vegan cheese" }, ["Dairy free"])
      .ok,
    false
  );
  assert.equal(
    dietaryStatus({ name: "Tree nut free snack" }, ["Nut free"])
      .ok,
    false
  );
  assert.equal(
    dietaryStatus({ name: "Peanut-free almond milk" }, [
      "Nut free"
    ]).ok,
    false
  );
  assert.equal(
    dietaryStatus({ name: "Bananas" }, [
      "Vegan",
      "Dairy free",
      "Gluten free"
    ]).ok,
    true
  );
  assert.equal(
    dietaryStatus({ name: "Banana cream pie" }, ["Vegan"]).ok,
    false
  );
});

test("barcode ingredient analysis and explicit labels work, but allergens and traces override claims", () => {
  const product = {
    name: "Plant drink",
    dietary_facts: {
      analysis: ["en:vegan"],
      labels: ["en:gluten-free"]
    }
  };
  assert.equal(
    dietaryStatus(product, [
      "Vegan",
      "Gluten free",
      "Dairy free"
    ]).ok,
    true
  );
  assert.equal(
    dietaryStatus(
      {
        ...product,
        dietary_facts: {
          ...product.dietary_facts,
          allergens: ["en:milk"]
        }
      },
      ["Dairy free"]
    ).ok,
    false
  );
  assert.equal(
    dietaryStatus(
      {
        name: "Nut free cookie",
        dietary_facts: { traces: ["en:peanuts"] }
      },
      ["Nut free"]
    ).ok,
    false
  );
  assert.equal(
    dietaryStatus(
      {
        name: "Gluten free bread",
        dietary_facts: { allergens: ["en:gluten"] }
      },
      ["Gluten free"]
    ).ok,
    false
  );
  assert.equal(
    dietaryStatus(
      {
        name: "Drink",
        dietary_facts: { allergens: [], traces: [] }
      },
      ["Dairy free"]
    ).ok,
    false
  );
});

test("recommendations exclude conflicting and unknown SKUs without silently replacing a pinned choice", () => {
  const checkedAt = "2026-11-12T12:00:00Z";
  const products = [
    {
      id: "dairy",
      name: "Whole Milk",
      availability: "in_stock",
      price: 2
    },
    {
      id: "plant",
      name: "Vegan Oat Milk",
      availability: "in_stock",
      price: 3
    },
    {
      id: "unknown",
      name: "Oat Milk",
      availability: "in_stock",
      price: 1
    }
  ];
  const store = {
    id: "store",
    distance_mi: 1,
    results: [{ query: "milk", products, checkedAt }]
  };
  const item = { id: "item", query: "milk", quantity: 1 };
  const rank = (items) =>
    rankKrogerStores({
      stores: [store],
      items,
      products: [],
      dietary: ["Vegan"],
      now: Date.parse(checkedAt)
    })[0];
  const result = rank([item]);
  assert.equal(result.total, 3);
  assert.equal(result.lines[0].selected.id, "plant");
  assert.equal(result.lines[0].dietaryHidden, 2);
  const pinned = rank([
    { ...item, storeSelections: { store: "dairy" } }
  ]);
  assert.equal(pinned.matched, 0);
  assert.equal(pinned.score, 0);
  assert.match(pinned.lines[0].status, /excluded by dietary/);
});

test("catalog totals retain excluded lines as missing, while membership prices update display", () => {
  const input = {
    items: [
      { product_id: "milk", quantity: 2 },
      { product_id: "fruit", quantity: 1 }
    ],
    products: [
      { id: "milk", name: "Whole milk" },
      { id: "fruit", name: "Bananas" }
    ],
    stores: [
      {
        id: "store",
        name: "Store",
        distance_mi: 1,
        drive_minutes: 2
      }
    ],
    prices: [
      {
        id: "milk-price",
        store_id: "store",
        product_id: "milk",
        price: 2,
        in_stock: true,
        updated_at: "2026-11-12T12:00:00Z"
      },
      {
        id: "fruit-price",
        store_id: "store",
        product_id: "fruit",
        price: 1,
        in_stock: true,
        updated_at: "2026-11-12T12:00:00Z"
      }
    ],
    radiusMi: 5,
    now: "2026-11-12T12:00:00Z",
    swaps: [],
    acceptedSwapIds: []
  };
  const plan = compareList({ ...input, dietary: ["Vegan"] });
  assert.equal(plan.activeCount, 2);
  assert.equal(plan.splitTotal, 1);
  assert.equal(plan.single, null);
  assert.equal(plan.missing[0].id, "milk");
  assert.equal(input.items.length, 2);
  const offer = {
    price: 2,
    regular_price: 4,
    is_member_price: true,
    is_sale: true
  };
  assert.equal(priceForMembership(offer, false).price, 4);
  assert.equal(priceForMembership(offer, false).is_sale, false);
  assert.equal(priceForMembership(offer, true).price, 2);
});

test("store discovery keeps independent grocers and merges only matching physical Kroger stores", () => {
  const place = { latitude: 35.28, longitude: -120.66 };
  const kroger = [
    { id: "123", name: "Ralphs", source: "kroger", ...place }
  ];
  const mapped = [
    { id: "osm-node-1", name: "Ralphs", ...place },
    { id: "osm-node-2", name: "Food 4 Less", ...place },
    {
      id: "osm-node-3",
      name: "Ralphs",
      latitude: 35.3,
      longitude: -120.66
    }
  ];
  assert.deepEqual(
    mergeNearbyStores([], kroger, mapped, place, 5).map(
      (store) => store.id
    ),
    ["123", "osm-node-2", "osm-node-3"]
  );
});
