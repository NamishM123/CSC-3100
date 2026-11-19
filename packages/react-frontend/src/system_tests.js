import test from "node:test";
import assert from "node:assert/strict"
import { findProduct } from "./lib/search.js";
import { buildComparisonStores } from "./lib/storeComparisons.js";

// Test data
const products = [
    { id: "1", name: "Bananas" },
    { id: "2", name: "Apples" },
    { id: "3", name: "Milk" }
];

const stores = [
    {
        id: "store1",
        name: "Walmart",
        source: "catalog",
        latitude: 35.28,
        longitude: -120.66
    },
    {
        id: "store2",
        name: "Target",
        source: "catalog",
        latitude: 35.29,
        longitude: -120.67
    }
];

const prices = [
    {
        id: "price1",
        product_id: "1",
        store_id: "store1",
        price: 2.00,
        in_stock: true,
        source: "catalog",
        updated_at: new Date().toISOString()
    },
    {
        id: "price2",
        product_id: "1",
        store_id: "store2",
        price: 2.50,
        in_stock: true,
        source: "catalog",
        updated_at: new Date().toISOString()
    }
];

const catalog = { products, stores, prices };

test("searching for bananas returns stores that sell them", () => {

    const result = findProduct(products, "bananas")

    assert.ok(result.primary)

    const comparisons = buildComparisonStores({
        catalog
    });

    assert.ok(comparisons.length > 0);
    assert.ok(comparisons.some(store =>
        store.comparisonProducts.some(product => product.id === `catalog:${result.primary.id}`)
    ));
});