import * as sample from "../data/mock.js";
import { distanceMiles } from "./geo.js";
import { reconcileStores } from "./storeDiscovery.js";
import { weeklyAdStores } from "./weeklyAdStores.js";
import { weeklyAdSources } from "./weeklyAdSources.js";

export function catalogWithStoreDirectory(
  catalog,
  liveStores = []
) {
  const stores = reconcileStores([
    ...weeklyAdStores,
    ...liveStores,
    ...catalog.stores
  ]);
  const byId = new Map();
  for (const store of stores) {
    byId.set(store.id, store);
    for (const alias of store.alternate_ids)
      byId.set(alias, store);
  }
  const replacedDemoIds = new Set(
    catalog.stores
      .filter(
        (store) =>
          store.source === "demo" &&
          byId.get(store.id)?.id !== store.id
      )
      .map((store) => store.id)
  );
  const filterRows = (key) => {
    const demoIds = new Set(sample[key].map((row) => row.id));
    return (catalog[key] || []).flatMap((row) => {
      const store = byId.get(row.store_id);
      const demo =
        row.source === "demo" ||
        (!row.source && demoIds.has(row.id));
      if (
        !store ||
        replacedDemoIds.has(row.store_id) ||
        (demo && store.source !== "demo")
      )
        return [];
      return [{ ...row, store_id: store.id }];
    });
  };
  const prices = filterRows("prices");
  const chains = new Map(
    (catalog.store_chains || []).map((chain) => [
      chain.id,
      chain
    ])
  );
  for (const source of weeklyAdSources)
    chains.set(`weekly-${source.id}`, {
      id: `weekly-${source.id}`,
      name: source.name
    });
  return {
    ...catalog,
    stores,
    store_chains: [...chains.values()],
    prices,
    price_history: filterRows("price_history"),
    product_swaps: filterRows("product_swaps"),
    storesAreDemo: stores.every(
      (store) => store.source === "demo"
    ),
    pricesAreDemo: prices.every((row) => row.source === "demo")
  };
}

export function catalogForLocation(
  catalog,
  place,
  liveStores = []
) {
  const directory = catalogWithStoreDirectory(
    catalog,
    liveStores
  );
  return {
    ...directory,
    stores: directory.stores.map((store) => ({
      ...store,
      distance_mi: distanceMiles(place, store) ?? Infinity
    }))
  };
}

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
    for (const row of remote[key]) {
      const original = rows.get(row.id);
      // A copy of a seeded fictional location is still a sample; reading it
      // from the database alone does not verify its address or coordinates.
      const unchangedSampleStore =
        key === "stores" &&
        original?.source === "demo" &&
        [
          "name",
          "address",
          "city",
          "latitude",
          "longitude"
        ].every(
          (field) =>
            row[field] === undefined ||
            row[field] === original[field]
        );
      rows.set(row.id, {
        ...original,
        ...row,
        ...([
          "prices",
          "stores",
          "price_history",
          "product_swaps"
        ].includes(key)
          ? {
              source:
                row.source ||
                (unchangedSampleStore ? "demo" : "catalog")
            }
          : {})
      });
    }
    catalog[key] = [...rows.values()];
  }
  catalog.storesAreDemo = catalog.stores.every(
    (store) => store.source === "demo"
  );
  catalog.pricesAreDemo = catalog.prices.every(
    (row) => row.source === "demo"
  );
  return catalog;
}
