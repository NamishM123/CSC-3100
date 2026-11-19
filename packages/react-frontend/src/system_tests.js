import test from "node:test";
import assert from "node:assert/strict"
import { findProduct } from "./lib/search.js";
import { buildComparisonStores } from "./lib/storeComparisons.js";

// Test data
const products = [
    { id: "1", name: "Bananas", category: "Produce" },
    { id: "2", name: "Apples", category: "Produce" },
    { id: "3", name: "Milk", category: "Dairy" },
    { id: "4", name: "Eggs", category: "Dairy" } // Egg should not be dairy, but they are apparently
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
    },
    {
        id: "store3",
        name: "Albertsons",
        source: "catalog",
        latitude: 35.281,
        longitude: -120.661
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
    },
    {
        id: "price3",
        product_id: "4",
        store_id: "store3",
        price: 4.50,
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

test("searching for Eggs finds the Eggs product and nearest grocery store", () => {
    const result = findProduct(products, "Eggs");

    assert.ok(result.primary);
    assert.equal(result.primary.name, "Eggs");
    assert.equal(result.primary.category, "Dairy");

    const comparisons = buildComparisonStores({
        catalog
    });

    const eggsStore = comparisons.find(store =>
        store.comparisonProducts.some(
            product => product.id === `catalog:${result.primary.id}`
        )
    );

    assert.ok(eggsStore);
    assert.equal(eggsStore.name, "Albertsons");
});