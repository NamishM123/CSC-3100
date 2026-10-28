import { useMemo } from "react";

export function useProductPrices(catalog, product) {
  return useMemo(() => {
    if (!product) return [];
    const storesById = new Map(catalog.stores.map((store) => [store.id, store]));
    return catalog.prices
      .filter((row) => row.product_id === product.id)
      .map((row) => ({ ...row, store: storesById.get(row.store_id) }))
      .filter((row) => row.store)
      .sort((a, b) => a.price - b.price || a.store.distance_mi - b.store.distance_mi);
  }, [catalog.prices, catalog.stores, product]);
}
