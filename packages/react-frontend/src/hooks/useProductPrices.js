import { useMemo } from "react";
import { priceForMembership } from "../lib/compare.js";

export function useProductPrices(
  catalog,
  product,
  includeMember = true,
  radiusMi = Infinity
) {
  return useMemo(() => {
    if (!product) return [];
    const storesById = new Map(
      catalog.stores.map((store) => [store.id, store])
    );
    return catalog.prices
      .filter((row) => row.product_id === product.id)
      .map((row) => ({
        ...row,
        store: storesById.get(row.store_id)
      }))
      .filter(
        (row) => row.store && row.store.distance_mi <= radiusMi
      )
      .map((row) => priceForMembership(row, includeMember))
      .sort(
        (a, b) =>
          (a.price ?? Infinity) - (b.price ?? Infinity) ||
          a.store.distance_mi - b.store.distance_mi
      );
  }, [
    catalog.prices,
    catalog.stores,
    product,
    includeMember,
    radiusMi
  ]);
}
