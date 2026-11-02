import assert from "node:assert/strict";
import test from "node:test";
import {
  findSaleNotifications,
  notificationWatch
} from "./saleNotifications.js";
import * as mock from "../data/mock.js";

const location = {
  latitude: 35.27,
  longitude: -120.66,
  zip: "93405"
};
function watch(overrides = {}) {
  return {
    productIds: ["prod-bananas"],
    location,
    radiusMi: 5,
    includeMember: true,
    demo: true,
    alerts: [],
    ...overrides
  };
}
const sale = mock.prices.find((row) => row.is_sale);
const catalog = (row) => ({ ...mock, prices: [row] });

test("outstanding saved items and same-ZIP price targets form the watch", () => {
  const state = {
    lists: [{ id: "list" }],
    items: [
      {
        list_id: "list",
        product_id: "a",
        quantity: 1,
        checked: false
      },
      {
        list_id: "list",
        product_id: "a",
        quantity: 2,
        checked: false
      },
      {
        list_id: "list",
        product_id: "b",
        quantity: 1,
        checked: true
      },
      { list_id: "deleted", product_id: "c", quantity: 1 },
      { list_id: "list", product_id: "d", quantity: 0 }
    ],
    location,
    radiusMi: 5,
    includeMember: true,
    catalog: { pricesAreDemo: false },
    alerts: [
      { product_id: "milk", below: 4, zip: "93405" },
      { product_id: "eggs", below: 2, zip: "99999" }
    ]
  };
  assert.deepEqual(notificationWatch(state).productIds, ["a"]);
  assert.deepEqual(notificationWatch(state).alerts, [
    { productId: "milk", below: 4 }
  ]);
  assert.equal(notificationWatch(state).demo, false);
});

test("demo sales are clearly labeled with product, store, price, membership, and a safe link", () => {
  const [result] = findSaleNotifications(watch(), mock);
  assert.match(result.title, /Demo/);
  assert.match(
    result.body,
    /Bananas.*\$0.25.*Safeway.*member price/
  );
  assert.equal(result.url, "/product/prod-bananas");
  assert.equal(result.kind, "sale");
});

test("stock, age, future dates, coordinates, radius, and membership all constrain delivery", () => {
  for (const row of [
    { ...sale, is_sale: false },
    { ...sale, in_stock: false },
    { ...sale, in_stock: null },
    { ...sale, price: null },
    { ...sale, price: -1 },
    { ...sale, regular_price: sale.price },
    { ...sale, updated_at: "2020-01-01" },
    { ...sale, updated_at: "2030-01-01" },
    { ...sale, updated_at: "invalid" },
    { ...sale, sale_starts_at: "2030-01-01" },
    { ...sale, sale_ends_at: "2020-01-01" },
    { ...sale, sale_ends_at: "invalid" }
  ])
    assert.equal(
      findSaleNotifications(watch(), catalog(row)).length,
      0
    );
  for (const value of [
    watch({ location: null }),
    watch({ location: { latitude: 0, longitude: 0 } }),
    watch({ radiusMi: 0.01 }),
    watch({ includeMember: false }),
    watch({ productIds: [] })
  ]) {
    assert.equal(
      findSaleNotifications(value, catalog(sale)).length,
      0
    );
  }
});

test("price targets can notify for non-sale products outside a list without duplicate sale alerts", () => {
  const target = watch({
    productIds: [],
    alerts: [{ productId: "prod-bananas", below: 0.3 }]
  });
  const results = findSaleNotifications(
    target,
    catalog({ ...sale, is_sale: false })
  );
  assert.equal(results.length, 1);
  assert.equal(results[0].kind, "price-target");
  assert.match(results[0].body, /Below your \$0.30 target/);
  assert.equal(
    findSaleNotifications(
      watch({ alerts: target.alerts }),
      catalog(sale)
    ).length,
    1
  );
  assert.equal(
    findSaleNotifications(
      watch({
        productIds: [],
        alerts: [{ productId: "prod-bananas", below: 0.25 }]
      }),
      catalog(sale)
    ).length,
    0
  );
});

test("date-only sale ends include that UTC day; live prices use real time instead of the demo clock", () => {
  const row = {
    ...sale,
    sale_starts_at: "2026-10-05",
    sale_ends_at: "2026-10-05"
  };
  assert.equal(
    findSaleNotifications(watch(), catalog(row)).length,
    1
  );
  assert.equal(
    findSaleNotifications(
      watch({ demo: false }),
      catalog(row),
      Date.parse("2026-10-06T00:00:00Z")
    ).length,
    0
  );
  assert.equal(
    findSaleNotifications(
      watch({ demo: false }),
      catalog(row),
      Date.parse(mock.DEMO_NOW)
    ).length,
    1
  );
});

test("refresh timestamps do not create repeat offer IDs, but changed price or period does", () => {
  const id = findSaleNotifications(watch(), catalog(sale))[0]
    .id;
  assert.equal(
    findSaleNotifications(
      watch(),
      catalog({ ...sale, updated_at: mock.DEMO_NOW })
    )[0].id,
    id
  );
  assert.notEqual(
    findSaleNotifications(
      watch(),
      catalog({ ...sale, price: 0.2 })
    )[0].id,
    id
  );
  assert.notEqual(
    findSaleNotifications(
      watch(),
      catalog({ ...sale, sale_ends_at: "2026-10-06" })
    )[0].id,
    id
  );
  assert.equal(
    findSaleNotifications(watch(), {
      ...mock,
      prices: [sale, sale]
    }).length,
    1
  );
});
