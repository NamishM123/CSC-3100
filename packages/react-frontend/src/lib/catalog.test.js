import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import * as sample from "../data/mock.js";
import { builtInProducts } from "../data/builtInProducts.js";
import { mergeCatalog } from "./catalog.js";
import { compareList } from "./compare.js";
import { productMatchesQuery } from "./search.js";

test("all built-in groceries have a bundled picture and offers at multiple known stores", () => {
  const stores = new Set(
    sample.stores.map((store) => store.id)
  );
  for (const product of sample.products) {
    assert.ok(
      existsSync(
        new URL(
          `../../public${product.image_url}`,
          import.meta.url
        )
      ),
      product.name
    );
    const offers = sample.prices.filter(
      (price) => price.product_id === product.id
    );
    assert.ok(
      new Set(offers.map((offer) => offer.store_id)).size >= 2,
      product.name
    );
    assert.ok(
      offers.every((offer) => stores.has(offer.store_id))
    );
  }
  for (const product of builtInProducts) {
    assert.equal(
      productMatchesQuery(product, product.name),
      true
    );
    assert.equal(
      productMatchesQuery(
        product,
        `${product.name} ${product.size_label}`
      ),
      true
    );
    assert.equal(
      productMatchesQuery(product, product.keywords[0]),
      true
    );
  }
});

test("connected products supplement built-ins and refreshed offers recalculate saved catalog baskets", () => {
  const date = "2026-12-12T12:00:00Z";
  const price = {
    id: "remote-offer",
    product_id: "remote-milk",
    store_id: "remote-store",
    price: 3,
    in_stock: true,
    updated_at: date,
    source: "retailer"
  };
  let catalog = mergeCatalog(sample, {
    stores: [
      { id: "remote-store", name: "Store", distance_mi: 1 }
    ],
    products: [{ id: "remote-milk", name: "Milk" }],
    prices: [price]
  });
  assert.ok(
    catalog.products.some(
      (product) => product.id === "prod-bananas"
    )
  );
  assert.ok(
    catalog.products.some(
      (product) => product.id === "remote-milk"
    )
  );
  const options = {
    items: [{ product_id: "remote-milk", quantity: 2 }],
    stores: catalog.stores,
    products: catalog.products,
    radiusMi: 5,
    includeMember: true,
    acceptedSwapIds: [],
    now: Date.parse(date)
  };
  assert.equal(
    compareList({ ...options, prices: catalog.prices }).single
      .total,
    6
  );
  catalog = mergeCatalog(catalog, {
    prices: [{ ...price, price: 5 }]
  });
  assert.equal(
    compareList({ ...options, prices: catalog.prices }).single
      .total,
    10
  );
  catalog = mergeCatalog(catalog, { prices: [] });
  assert.equal(
    compareList({ ...options, prices: catalog.prices }).single,
    null
  );
  assert.ok(
    catalog.products.some(
      (product) => product.id === "prod-bananas"
    )
  );
});
