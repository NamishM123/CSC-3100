import { distanceMiles, nearbyStores } from "./geo.js";

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const names = (store) =>
  [store.name, store.chain, ...(store.aliases || [])]
    .map(normalize)
    .filter(Boolean);
const cityMatches = (a, b) =>
  Boolean(
    a.city && b.city && normalize(a.city) === normalize(b.city)
  );

export function sameStoreBrand(a, b) {
  return names(a).some((left) =>
    names(b).some(
      (right) =>
        left === right ||
        left.startsWith(right) ||
        right.startsWith(left)
    )
  );
}

export function samePhysicalStore(a, b) {
  if (
    (a.id && a.id === b.id) ||
    a.alternate_ids?.includes(b.id) ||
    b.alternate_ids?.includes(a.id)
  )
    return true;
  if (!sameStoreBrand(a, b)) return false;
  const numberA = a.address?.match(/^\s*(\d+)/)?.[1];
  const numberB = b.address?.match(/^\s*(\d+)/)?.[1];
  if (numberA && numberB && numberA !== numberB) return false;
  const distance = distanceMiles(a, b);
  // The same street/ZIP can exist in different towns. Address similarity must
  // not override coordinates placing the records in different neighborhoods.
  if (distance != null && distance > 0.5) return false;
  const address = (value) =>
    normalize(
      String(value || "")
        .toLowerCase()
        .replace(
          /\b(street|boulevard|avenue|drive|road|north|south|east|west)\b/g,
          (word) =>
            ({
              street: "st",
              boulevard: "blvd",
              avenue: "ave",
              drive: "dr",
              road: "rd",
              north: "n",
              south: "s",
              east: "e",
              west: "w"
            })[word]
        )
    );
  if (
    a.address &&
    b.address &&
    address(a.address) === address(b.address) &&
    (cityMatches(a, b) || (a.zip && a.zip === b.zip))
  )
    return true;
  // A fictional sample coordinate cannot verify a real branch. Require the
  // same address or a known ID before removing its illustrative catalog.
  if ((a.source === "demo") !== (b.source === "demo"))
    return false;
  return distance != null && distance < 0.15;
}

export function reconcileStores(rows) {
  const priority = (store) =>
    ({
      kroger: 5,
      "weekly-ads": 4,
      catalog: 3,
      openstreetmap: 2,
      demo: 0
    })[store.source] ?? 3;
  const stores = [];
  for (const row of [...rows].sort(
    (a, b) => priority(b) - priority(a)
  )) {
    const existing = stores.find((store) =>
      samePhysicalStore(store, row)
    );
    if (existing) {
      existing.alternate_ids = [
        ...new Set([
          ...(existing.alternate_ids || []),
          row.id,
          ...(row.alternate_ids || [])
        ])
      ].filter((id) => id !== existing.id);
    } else
      stores.push({
        ...row,
        alternate_ids: [...(row.alternate_ids || [])]
      });
  }
  return stores;
}

export function mergeNearbyStores(
  catalog,
  kroger,
  community,
  place,
  radiusMi
) {
  return nearbyStores(
    reconcileStores([...kroger, ...community, ...catalog]),
    place,
    radiusMi
  );
}
