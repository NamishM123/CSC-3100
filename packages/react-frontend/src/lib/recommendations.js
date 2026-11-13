import { findProduct, productMatchesQuery } from "./search.js";
import { cents } from "./format.js";

export function listSearchQuery(item, products) {
  if (item.query) return item.query;
  const product = products.find(
    (entry) => entry.id === item.product_id
  );
  return product
    ? [product.name, product.size_label]
        .filter(Boolean)
        .join(" ")
    : [item.name || "Unknown item", item.size_label]
        .filter(Boolean)
        .join(" ");
}

export function rankKrogerStores({
  stores,
  items,
  products,
  priceWeight = 0.7,
  now = Date.now()
}) {
  const active = items.filter(
    (item) =>
      !item.checked &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
  );
  if (!active.length) return [];
  const weight = Math.max(
    0,
    Math.min(
      1,
      Number.isFinite(priceWeight) ? priceWeight : 0.7
    )
  );
  const rows = stores.map((store) => {
    let total = 0;
    const lines = active.map((item) => {
      const query = listSearchQuery(item, products);
      const result = store.results.find(
        (entry) => entry.query === query
      );
      const age = now - Date.parse(result?.checkedAt);
      const stale =
        !Number.isFinite(age) ||
        age < 0 ||
        age >= 5 * 60 * 1000;
      const options = (result?.products || [])
        .filter((product) =>
          productMatchesQuery(
            { ...product, category: "" },
            query
          )
        )
        .sort(
          (a, b) =>
            (a.price ?? Infinity) - (b.price ?? Infinity) ||
            a.name.localeCompare(b.name) ||
            a.id.localeCompare(b.id)
        );
      const usable = options.filter(
        (product) =>
          product.availability === "in_stock" &&
          Number.isFinite(product.price) &&
          product.price > 0
      );
      const pinned = item.storeSelections?.[store.id];
      // Ambiguous typo matches need a deliberate choice. A missing pinned SKU
      // stays missing until the user clears or replaces it.
      const ambiguous =
        !findProduct(usable, query).primary &&
        usable.length > 0;
      const selected = pinned
        ? options.find((product) => product.id === pinned)
        : ambiguous
          ? null
          : usable[0];
      const available =
        !result?.error &&
        !stale &&
        selected &&
        usable.includes(selected);
      const lineTotal = available
        ? cents(selected.price * item.quantity)
        : null;
      if (lineTotal != null) total = cents(total + lineTotal);
      return {
        item,
        query,
        options,
        selected,
        lineTotal,
        ambiguous,
        pinned,
        error: result?.error,
        status: result?.error
          ? "Search failed"
          : stale
            ? "Refresh prices to check availability"
            : pinned && !selected
              ? "Your selected product is no longer in these results"
              : selected?.availability === "out_of_stock"
                ? "Selected product is out of stock"
                : selected?.availability === "unknown"
                  ? "Stock is unconfirmed"
                  : selected && lineTotal == null
                    ? "Price unavailable"
                    : ambiguous && !pinned
                      ? "Choose a product to confirm this match"
                      : lineTotal != null
                        ? "In stock"
                        : options.length
                          ? "No confirmed stock and price"
                          : "No matching products returned",
        truncated: result?.truncated
      };
    });
    const matched = lines.filter(
      (line) => line.lineTotal != null
    ).length;
    return {
      store,
      lines,
      total,
      matched,
      coverage: matched / active.length,
      complete: matched === active.length
    };
  });
  // Price comparisons use the SAME basket: impute a missing line using the
  // highest confirmed price for that line. Missing items never become free.
  const referencePrices = active.map((_, index) =>
    Math.max(
      0,
      ...rows.map((row) => row.lines[index].lineTotal || 0)
    )
  );
  const costs = rows.map((row) =>
    row.lines.reduce(
      (sum, line, index) =>
        sum + (line.lineTotal ?? referencePrices[index]),
      0
    )
  );
  const minimumCost = Math.min(
    ...costs.filter((cost) => cost > 0)
  );
  rows.forEach((row, index) => {
    row.priceScore =
      costs[index] > 0 ? minimumCost / costs[index] : 0;
    row.distanceScore = 1 / (1 + row.store.distance_mi);
    row.score =
      row.matched === 0
        ? 0
        : Math.round(
            100 *
              row.coverage *
              (weight * row.priceScore +
                (1 - weight) * row.distanceScore)
          );
  });
  // A store with the whole list always ranks before an incomplete basket.
  return rows.sort(
    (a, b) =>
      Number(b.complete) - Number(a.complete) ||
      b.score - a.score ||
      b.matched - a.matched ||
      a.store.distance_mi - b.store.distance_mi ||
      a.store.id.localeCompare(b.store.id)
  );
}
