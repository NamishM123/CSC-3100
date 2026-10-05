function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singular(value) {
  const text = normalize(value);
  if (text.endsWith("s") && text.length > 3)
    return text.slice(0, -1);
  return text;
}

function scoreProduct(product, query) {
  const raw = normalize(query);
  const q = singular(query);
  if (!raw) return 0;
  if (singular(product.name) === q) return 100;
  const firstWord = product.name.split(",")[0];
  if (singular(firstWord) === q) return 95;
  const full = normalize(product.name);
  if (full.startsWith(raw)) return 90;
  if (full.includes(raw)) return 70;
  const keywords = product.keywords || [];
  if (
    keywords.some(
      (word) =>
        singular(word) === q || normalize(word).includes(raw)
    )
  ) {
    return 80;
  }
  return 0;
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

function suggestionFor(products, query) {
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

export function findProduct(products, rawQuery) {
  const query = (rawQuery || "").trim();
  if (!query) {
    return {
      query: "",
      primary: null,
      alsoTry: [],
      suggestion: null
    };
  }
  const ranked = products
    .map((product) => ({
      product,
      score: scoreProduct(product, query)
    }))
    .filter((entry) => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.product.name.localeCompare(b.product.name)
    );
  if (!ranked.length) {
    return {
      query,
      primary: null,
      alsoTry: [],
      suggestion: suggestionFor(products, query)
    };
  }
  const primary = ranked[0].product;
  const related = (primary.also_try || [])
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);
  return {
    query,
    primary,
    alsoTry: related.length
      ? related
      : ranked.slice(1, 4).map((entry) => entry.product),
    suggestion: null
  };
}

export function dietaryStatus(product, filters) {
  const selected = filters || [];
  if (!product || selected.length === 0) {
    return {
      ok: true,
      unverified: false,
      conflicts: [],
      missing: []
    };
  }
  const conflicts = selected.filter((filter) =>
    (product.dietary_conflicts || []).includes(filter)
  );
  if (conflicts.length) {
    return {
      ok: false,
      unverified: false,
      conflicts,
      missing: []
    };
  }
  const missing = selected.filter(
    (filter) => !(product.dietary || []).includes(filter)
  );
  if (missing.length) {
    return {
      ok: true,
      unverified: true,
      conflicts: [],
      missing
    };
  }
  return {
    ok: true,
    unverified: false,
    conflicts: [],
    missing: []
  };
}

export function productMatchesQuery(product, rawQuery) {
  const query = normalize(rawQuery);
  if (!query) return true;
  const haystack = normalize(
    `${product.name} ${product.category || ""} ${(product.keywords || []).join(" ")}`
  );
  return haystack.includes(query);
}
