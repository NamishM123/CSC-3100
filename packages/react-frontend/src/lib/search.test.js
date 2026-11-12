import assert from "node:assert/strict";
import test from "node:test";
import { products as demoProducts } from "../data/mock.js";
import { findProduct, productMatchesQuery } from "./search.js";

const milkCatalog = [
  { id: "one", name: "Milk, 1%" },
  { id: "oat", name: "Oat milk" },
  { id: "two", name: "Milk, 2%", size_label: "1 gal" },
  { id: "whole", name: "Whole milk" }
];

test("finds 2% milk regardless of word order, filler words, or a typo", () => {
  for (const query of [
    "2% mil",
    "milk of 2%",
    "2% MILK",
    "milk 2 %",
    "two percent milk",
    "2 percent milk",
    "2 pct milk",
    "2% mlik",
    "milk 2% please",
    "2%milk",
    "milk, 2%",
    "2% milk 1 gallon"
  ]) {
    assert.equal(
      findProduct(milkCatalog, query).primary?.id,
      "two",
      query
    );
    assert.equal(
      productMatchesQuery(milkCatalog[2], query),
      true,
      query
    );
  }
});

test("works with differently named future retailer products without keywords", () => {
  const catalog = [
    { id: "wrong", name: "Farm Fresh 1 Percent Milk" },
    {
      id: "right",
      name: "Farm Fresh Milk of Two Percent",
      size_label: "1 gallon"
    }
  ];
  assert.equal(
    findProduct(catalog, "2% mil").primary?.id,
    "right"
  );
  assert.equal(
    findProduct([{ id: "only", name: "2% Milk" }], "milk of 2%")
      .primary?.id,
    "only"
  );
});

test("never changes percentages, decimal quantities, or explicit variants", () => {
  for (const query of [
    "3% milk",
    "0.2% milk",
    "2% oat milk",
    "organic milk"
  ]) {
    const found = findProduct(milkCatalog, query);
    assert.equal(found.primary, null, query);
    assert.equal(found.suggestion, null, query);
    assert.equal(
      milkCatalog.some((product) =>
        productMatchesQuery(product, query)
      ),
      false,
      query
    );
  }
  const skim = [{ id: "skim", name: "Fat-free milk" }];
  assert.equal(findProduct(skim, "whole milk").primary, null);
  assert.equal(
    findProduct(skim, "skim milk").primary?.id,
    "skim"
  );
  assert.equal(
    findProduct([{ id: "goat", name: "Goat milk" }], "oat milk")
      .primary,
    null
  );
  assert.equal(
    findProduct(
      [{ id: "large", name: "Milk", size_label: "12 oz" }],
      "milk 2 oz"
    ).primary,
    null
  );
});

test("handles missing, swapped, and mistyped letters directly", () => {
  for (const [query, expected] of [
    ["bananaz", "prod-bananas"],
    ["mlik", "prod-milk"],
    ["egss", "prod-eggs"],
    ["spimach", "prod-spinach"],
    ["peanutbutter", "prod-pb"],
    ["oatmilk", "prod-oat-milk"],
    ["wheat whole braed", "prod-bread"]
  ]) {
    const found = findProduct(demoProducts, query);
    assert.equal(found.primary?.id, expected, query);
    assert.equal(found.suggestion, null, query);
  }
});

test("aliases work in both directions and plural words match", () => {
  for (const [name, query] of [
    ["Garbanzo beans", "chickpeas"],
    ["Chickpeas", "garbanzo beans"],
    ["Green onions", "scallions"],
    ["Scallions", "spring onions"],
    ["Aubergines", "eggplant"],
    ["Courgettes", "zucchini"],
    ["Greek yoghurt", "yogurt greek"],
    ["Strawberries", "strawberry"],
    ["Tomatoes", "tomato"],
    ["Peaches", "peach"],
    ["Hummus", "hummus"]
  ]) {
    assert.equal(
      findProduct([{ id: "match", name }], query).primary?.id,
      "match",
      `${name}: ${query}`
    );
  }
});

test("normalizes accents, punctuation, and extra whitespace", () => {
  const catalog = [{ id: "coffee", name: "Café-style Coffee" }];
  assert.equal(
    findProduct(catalog, "  COFFEE cafe style  ").primary?.id,
    "coffee"
  );
});

test("uses existing keywords, short names, and size labels", () => {
  const catalog = [
    {
      id: "spread",
      name: "Brand's Creamy Spread",
      short_name: "Peanut butter",
      keywords: ["ground peanuts"],
      size_label: "16 oz"
    }
  ];
  for (const query of [
    "pb",
    "peanuts ground",
    "peanut butter 16 ounces"
  ]) {
    assert.equal(
      findProduct(catalog, query).primary?.id,
      "spread",
      query
    );
  }
});

test("does not accept substrings inside unrelated words or drop query words", () => {
  const catalog = [
    { id: "ham", name: "Hamburger" },
    { id: "milk", name: "Milk, 2%" }
  ];
  for (const query of [
    "ham",
    "ilk",
    "2% chocolate milk",
    "xyzzy",
    "of the",
    "!!!"
  ]) {
    assert.equal(
      findProduct(catalog, query).primary,
      null,
      query
    );
  }
});

test("ambiguous typos require confirmation and are deterministic", () => {
  const catalog = [
    { id: "lime", name: "Lime" },
    { id: "line", name: "Line" }
  ];
  for (const products of [catalog, [...catalog].reverse()]) {
    const found = findProduct(products, "lile");
    assert.equal(found.primary, null);
    assert.equal(found.suggestion?.id, "lime");
  }
});

test("word order does not change matches when typos overlap", () => {
  const catalog = [{ id: "match", name: "Mike milk" }];
  for (const query of ["mile pike", "pike mile"]) {
    assert.equal(
      findProduct(catalog, query).primary?.id,
      "match",
      query
    );
  }
});

test("joined names match in both directions", () => {
  for (const [name, query] of [
    ["Cream cheese", "creamcheese"],
    ["Creamcheese", "cream cheese"]
  ]) {
    assert.equal(
      findProduct([{ id: "match", name }], query).primary?.id,
      "match"
    );
  }
});

test("long queries still confirm equally plausible typos", () => {
  const found = findProduct(
    [
      { id: "lime", name: "Fresh organic green lime" },
      { id: "line", name: "Fresh organic green line" }
    ],
    "fresh organic green lile"
  );
  assert.equal(found.primary, null);
  assert.equal(found.suggestion?.id, "lime");
});

test("blank queries stay empty while store browsing shows all products", () => {
  for (const query of ["", "   ", null, undefined]) {
    assert.deepEqual(findProduct(demoProducts, query), {
      query: "",
      primary: null,
      alsoTry: [],
      suggestion: null
    });
    assert.equal(
      productMatchesQuery(milkCatalog[0], query),
      true
    );
  }
  assert.equal(findProduct([], "milk").primary, null);
  assert.equal(
    findProduct([{ id: "minimal", name: "Milk" }], "mil")
      .primary?.id,
    "minimal"
  );
});

test("exact names outrank partial matches and also_try is honored", () => {
  const catalog = [
    { id: "bread", name: "Banana bread", keywords: ["banana"] },
    {
      id: "bananas",
      name: "Bananas",
      also_try: ["missing", "bread"]
    }
  ];
  const found = findProduct(catalog, "bananas");
  assert.equal(found.primary.id, "bananas");
  assert.deepEqual(
    found.alsoTry.map((product) => product.id),
    ["bread"]
  );
});

test("exact words beat typo matches and equally ranked results stay alphabetical", () => {
  assert.equal(
    findProduct(
      [
        { id: "typo", name: "Mile" },
        { id: "exact", name: "Milk, 2%" }
      ],
      "milk"
    ).primary.id,
    "exact"
  );
  const catalog = ["Zucchini", "Apple", "Extra", "Yellow"].map(
    (prefix) => ({
      id: prefix,
      name: `${prefix} banana muffins`,
      also_try: ["gone"]
    })
  );
  const found = findProduct(catalog, "muffins banana");
  assert.equal(found.primary.id, "Apple");
  assert.deepEqual(
    found.alsoTry.map((product) => product.id),
    ["Extra", "Yellow", "Zucchini"]
  );
});

test("store search shares matching and also supports categories", () => {
  assert.equal(
    productMatchesQuery(demoProducts[0], "produce"),
    true
  );
  assert.equal(
    productMatchesQuery(demoProducts[0], "dairy"),
    false
  );
  assert.equal(
    productMatchesQuery(milkCatalog[0], "2% mil"),
    false
  );
  assert.equal(
    productMatchesQuery(milkCatalog[2], "of the"),
    false
  );
});
