import { distanceMiles, nearbyStores } from "./geo.js";

export function mergeNearbyStores(
  catalog,
  kroger,
  community,
  place,
  radiusMi
) {
  const live = [...kroger];
  const name = (store) =>
    String(store.chain || store.name)
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
  for (const store of community) {
    // A Kroger feed takes precedence only for the same named physical store.
    // Never merge unrelated grocers just because they share a shopping center.
    if (
      !live.some((other) => {
        const a = name(store),
          b = name(other);
        const distance = distanceMiles(store, other);
        return (
          a &&
          b &&
          (a === b || a.startsWith(b) || b.startsWith(a)) &&
          distance != null &&
          distance < 0.15
        );
      })
    )
      live.push(store);
  }
  return nearbyStores([...catalog, ...live], place, radiusMi);
}
