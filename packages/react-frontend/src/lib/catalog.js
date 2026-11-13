import * as sample from "../data/mock.js";

export function priceClock(row, now = Date.now()) {
  return row?.source === "demo" ? sample.DEMO_NOW : now;
}

// A connected catalog supplements built-in products instead of hiding them.
// Rebuild each successful collection from the defaults so removed remote
// observations don't survive indefinitely in memory.
export function mergeCatalog(current, remote) {
  const catalog = { ...current };
  for (const key of [
    "store_chains",
    "stores",
    "products",
    "prices",
    "price_history",
    "product_swaps"
  ]) {
    if (!Array.isArray(remote[key])) continue;
    const rows = new Map(
      sample[key].map((row) => [row.id, row])
    );
    for (const row of remote[key])
      rows.set(row.id, {
        ...rows.get(row.id),
        ...row,
        ...(key === "prices"
          ? { source: row.source || "catalog" }
          : {})
      });
    catalog[key] = [...rows.values()];
  }
  catalog.storesAreDemo = !catalog.stores.some(
    (store) => !sample.stores.some((row) => row.id === store.id)
  );
  catalog.pricesAreDemo = catalog.prices.every(
    (row) => row.source === "demo"
  );
  return catalog;
}
