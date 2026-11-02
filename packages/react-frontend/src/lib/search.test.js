import assert from "node:assert/strict";
import test from "node:test";
import { findProduct } from "./search.js";

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(value) {
  const text = normalize(value);
  if (text.endsWith("s") && text.length > 3) {
    return text.slice(0, -1);
  }
  return text;
}

function editDistance(a, b) {
  const row = Array.from(
    { length: b.length + 1 },
    (_, index) => index
  );
  for (let i = 1; i <= a.length; i += 1) {
    let previous = i - 1;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const saved = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + cost
      );
      previous = saved;
    }
  }
  return row[b.length];
}

function referenceSuggestion(products, query) {
  const raw = normalize(query);
  if (raw.length < 4) return null;
  let best = null;
  let bestDistance = 3;
  products.forEach((product) => {
    const first = product.name.split(",")[0];
    const candidates = [
      normalize(product.name),
      singular(product.name),
      normalize(first),
      singular(first)
    ];
    candidates.forEach((candidate) => {
      const distance = editDistance(raw, candidate);
      if (distance > 0 && distance < bestDistance) {
        bestDistance = distance;
        best = product;
      }
    });
  });
  return best;
}

function suggestionId(products, query) {
  const found = findProduct(products, query);
  return found.suggestion ? found.suggestion.id : null;
}

test("typo suggestions stay on the closest earlier product", () => {
  const products = [
    { id: "bananas", name: "Bananas", keywords: ["banana"] },
    { id: "bread", name: "Banana bread" },
    { id: "milk", name: "Milk, 2%", keywords: ["milk"] },
    {
      id: "eggs",
      name: "Eggs, large",
      keywords: ["eggs", "egg"]
    },
    { id: "oat", name: "Oat milk", keywords: ["oat", "milk"] },
    { id: "spinach", name: "Spinach" },
    { id: "pb", name: "Peanut butter" }
  ];
  const queries = [
    "bananaz",
    "mlik",
    "egss",
    "spimach",
    "oatmilk",
    "peanutbutter",
    "whle",
    "abc",
    "",
    "bananas"
  ];
  for (const query of queries) {
    const expected = referenceSuggestion(products, query);
    const found = findProduct(products, query);
    if (found.primary) {
      assert.equal(found.suggestion, null);
    } else {
      assert.equal(
        suggestionId(products, query),
        expected ? expected.id : null,
        query
      );
    }
  }
  assert.equal(
    findProduct(products, "bananas").primary.id,
    "bananas"
  );
  assert.equal(suggestionId(products, "bananaz"), "bananas");
  assert.equal(suggestionId(products, "mlik"), "milk");
  assert.equal(suggestionId(products, "spimach"), "spinach");
  assert.equal(suggestionId(products, "abc"), null);
});

test("distance 1 beats an earlier distance 2, ties keep the first", () => {
  const products = [
    { id: "far", name: "abxy" },
    { id: "near", name: "abce" },
    { id: "tie", name: "abxz" }
  ];
  assert.equal(suggestionId(products, "abcd"), "near");

  const tied = [
    { id: "first", name: "abxy" },
    { id: "second", name: "xbyd" }
  ];
  assert.equal(suggestionId(tied, "abcd"), "first");
  assert.equal(referenceSuggestion(tied, "abcd").id, "first");
});

test("blank queries stay empty and do not suggest a product", () => {
  const products = [
    { id: "bananas", name: "Bananas", also_try: [] }
  ];
  for (const query of ["", "   ", null, undefined]) {
    assert.deepEqual(findProduct(products, query), {
      query: "",
      primary: null,
      alsoTry: [],
      suggestion: null
    });
  }
});

test("exact name outranks a partial match and also_try is honored", () => {
  const products = [
    {
      id: "bread",
      name: "Banana bread",
      keywords: ["banana"],
      also_try: []
    },
    {
      id: "bananas",
      name: "Bananas",
      keywords: ["banana"],
      also_try: ["missing", "bread"]
    }
  ];
  const found = findProduct(products, "bananas");
  assert.equal(found.primary.id, "bananas");
  assert.equal(found.suggestion, null);
  assert.deepEqual(
    found.alsoTry.map((product) => product.id),
    ["bread"]
  );
});

test("equal scores stay alphabetical and also_try falls back to the next ranks", () => {
  const products = [
    {
      id: "z",
      name: "Zucchini banana muffins",
      also_try: ["gone"]
    },
    { id: "a", name: "Apple banana muffins", also_try: [] },
    { id: "e", name: "Extra banana muffins", also_try: [] },
    { id: "y", name: "Yellow banana muffins", also_try: [] },
    { id: "bread", name: "Banana bread", also_try: [] }
  ];
  const found = findProduct(products, "banana muffins");
  assert.equal(found.primary.id, "a");
  assert.equal(found.suggestion, null);
  assert.deepEqual(
    found.alsoTry.map((product) => product.id),
    ["e", "y", "z"]
  );
});

test("matches the previous suggestion scan on random catalogs", () => {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let seed = 20261023;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const word = () => {
    const length = 3 + Math.floor(random() * 14);
    let text = "";
    for (let i = 0; i < length; i += 1) {
      text += alphabet[Math.floor(random() * alphabet.length)];
    }
    if (random() < 0.4) text += "s";
    return text;
  };

  for (let catalog = 0; catalog < 40; catalog += 1) {
    const products = [];
    const count = 1 + Math.floor(random() * 30);
    for (let i = 0; i < count; i += 1) {
      const head = word();
      const tail = random() < 0.5 ? "" : `, ${word()}`;
      products.push({
        id: `p-${catalog}-${i}`,
        name: `${head}${tail}`,
        keywords: random() < 0.3 ? [word()] : []
      });
    }
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const base =
        products[Math.floor(random() * products.length)].name;
      const chars = normalize(base).split("");
      const roll = random();
      if (roll < 0.25 && chars.length) {
        chars.splice(Math.floor(random() * chars.length), 1);
      } else if (roll < 0.5) {
        chars.splice(
          Math.floor(random() * (chars.length + 1)),
          0,
          alphabet[Math.floor(random() * alphabet.length)]
        );
      } else if (roll < 0.75 && chars.length) {
        const at = Math.floor(random() * chars.length);
        chars[at] =
          alphabet[Math.floor(random() * alphabet.length)];
      }
      const query = chars.join("") || word();
      const expected = referenceSuggestion(products, query);
      const found = findProduct(products, query);
      if (found.primary) {
        assert.equal(found.suggestion, null);
      } else {
        assert.equal(
          found.suggestion ? found.suggestion.id : null,
          expected ? expected.id : null
        );
      }
    }
  }
});
