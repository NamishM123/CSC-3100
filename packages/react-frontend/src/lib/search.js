import {
  exactTerm,
  oneTypoApart,
  searchTerms
} from "./searchTerms.js";

function sameTerms(a, b) {
  return (
    a.length === b.length && a.every((term) => b.includes(term))
  );
}

function termQuality(query, candidate) {
  if (query === candidate) return 1;
  if (exactTerm(query) || exactTerm(candidate)) return 0;
  if (
    query.length >= 3 &&
    query.length / candidate.length >= 0.6 &&
    candidate.startsWith(query)
  ) {
    return 0.85;
  }
  if (
    query.length >= 4 &&
    candidate.length >= 3 &&
    (oneTypoApart(query, candidate) ||
      // A swapped plural ending ("egss") survives singular normalization.
      (query.endsWith("s") &&
        oneTypoApart(query, `${candidate}s`)))
  ) {
    return 0.7;
  }
  return 0;
}

function matchTerms(query, candidates) {
  const remaining = new Set(candidates);
  const unmatched = [];
  let quality = 0;
  // Reserve exact terms first so a typo cannot consume another query word.
  for (const term of query) {
    if (remaining.delete(term)) quality += 1;
    else unmatched.push(term);
  }
  const options = new Map(
    unmatched.map((term) => [
      term,
      [...remaining]
        .map((candidate) => ({
          candidate,
          quality: termQuality(term, candidate)
        }))
        .filter((option) => option.quality > 0)
        .sort(
          (a, b) =>
            b.quality - a.quality ||
            a.candidate.localeCompare(b.candidate)
        )
    ])
  );
  const assigned = new Map();
  // Reassign overlapping typo candidates so matching does not depend on word order.
  function assign(term, visited) {
    for (const option of options.get(term)) {
      if (visited.has(option.candidate)) continue;
      visited.add(option.candidate);
      const previous = assigned.get(option.candidate);
      if (!previous || assign(previous, visited)) {
        assigned.set(option.candidate, term);
        return true;
      }
    }
    return false;
  }
  for (const term of unmatched.sort()) {
    // Every meaningful query word must match, including variant and size.
    if (!assign(term, new Set())) return 0;
  }
  for (const [candidate, term] of assigned) {
    quality += termQuality(term, candidate);
  }
  return quality / query.length;
}

function productFields(product) {
  return [
    product.name,
    product.short_name,
    ...(product.keywords || [])
  ]
    .filter(Boolean)
    .map(searchTerms)
    .filter((terms) => terms.length);
}

function scoreProduct(product, query, includeCategory = false) {
  if (!query.length) return 0;
  const fields = productFields(product);
  const name = searchTerms(product.name);
  if (sameTerms(query, name)) return 100;
  const head = searchTerms((product.name || "").split(",")[0]);
  if (sameTerms(query, head)) return 95;
  if (fields.some((terms) => sameTerms(query, terms)))
    return 90;

  // Joined names such as "creamcheese" still match "cream cheese".
  if (
    query.every((term) => !exactTerm(term)) &&
    fields.some((terms) => terms.join("") === query.join(""))
  ) {
    return 85;
  }
  const candidates = [
    ...new Set([
      ...fields.flat(),
      ...searchTerms(product.size_label),
      ...(includeCategory ? searchTerms(product.category) : [])
    ])
  ];
  const quality = matchTerms(query, candidates);
  if (!quality) return 0;
  // Prefer fewer extra name words for broad searches; exact matches win.
  const extra = Math.max(0, head.length - query.length);
  // All exact token matches outrank typo/prefix matches, even for long queries.
  const base = quality === 1 ? 85 : 60 + quality * 19;
  return base - Math.min(extra, 5);
}

function emptySearchResult(query) {
  return {
    query,
    primary: null,
    alsoTry: [],
    suggestion: null
  };
}

function rankProducts(products, query) {
  const terms = searchTerms(query);
  return products
    .map((product) => ({
      product,
      score: scoreProduct(product, terms)
    }))
    .filter((entry) => entry.score > 0);
}

function sortRankedProducts(ranked) {
  return ranked.sort(
    (a, b) =>
      b.score - a.score ||
      a.product.name.localeCompare(b.product.name)
  );
}

function alsoTryProducts(products, primary, ranked) {
  const related = (primary.also_try || [])
    .map((id) => products.find((product) => product.id === id))
    .filter(Boolean);
  if (related.length) return related;
  return ranked.slice(1, 4).map((entry) => entry.product);
}

export function findProduct(products, rawQuery) {
  const query = (rawQuery || "").trim();
  if (!query) return emptySearchResult("");
  const ranked = sortRankedProducts(
    rankProducts(products, query)
  );
  if (!ranked.length) {
    return emptySearchResult(query);
  }
  // Equally plausible typo matches need the user's choice before showing prices.
  if (
    ranked[0].score < 80 &&
    ranked[1]?.score === ranked[0].score
  ) {
    return {
      ...emptySearchResult(query),
      suggestion: ranked[0].product
    };
  }
  const primary = ranked[0].product;
  return {
    query,
    primary,
    alsoTry: alsoTryProducts(products, primary, ranked),
    suggestion: null
  };
}

export { dietaryStatus } from "./dietary.js";

export function productMatchesQuery(product, rawQuery) {
  if (!String(rawQuery ?? "").trim()) return true;
  return scoreProduct(product, searchTerms(rawQuery), true) > 0;
}
