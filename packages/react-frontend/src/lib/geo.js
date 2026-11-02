const EARTH_RADIUS_MI = 3958.7613;
const zipCache = new Map();

export function coordinatesOf(place) {
  if (
    place?.latitude == null ||
    place?.longitude == null ||
    place.latitude === "" ||
    place.longitude === ""
  )
    return null;
  const latitude = Number(place.latitude);
  const longitude = Number(place.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return null;
  return { latitude, longitude };
}

export function distanceMiles(from, to) {
  const a = coordinatesOf(from);
  const b = coordinatesOf(to);
  if (!a || !b) return null;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const lat = radians(b.latitude - a.latitude);
  const lon = radians(b.longitude - a.longitude);
  const h =
    Math.sin(lat / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(lon / 2) ** 2;
  return (
    2 *
    EARTH_RADIUS_MI *
    Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))))
  );
}

export function nearbyStores(stores, place, radiusMi) {
  if (!coordinatesOf(place)) return [];
  return stores
    .map((store) => ({
      ...store,
      distance_mi: distanceMiles(place, store)
    }))
    .filter(
      (store) =>
        store.distance_mi != null &&
        store.distance_mi <= radiusMi
    )
    .sort((a, b) => a.distance_mi - b.distance_mi);
}

export async function lookupZip(zip, { signal } = {}) {
  const clean = String(zip).trim();
  if (!/^\d{5}$/.test(clean)) {
    throw new Error("Enter a 5 digit ZIP code.");
  }
  if (zipCache.has(clean)) return zipCache.get(clean);

  let response;
  try {
    const timeout = AbortSignal.timeout(10000);
    response = await fetch(
      `https://api.zippopotam.us/us/${clean}`,
      {
        signal: signal
          ? AbortSignal.any([signal, timeout])
          : timeout
      }
    );
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Unable to look up this ZIP code. Check your connection and try again."
    );
  }
  if (response.status === 404) {
    throw new Error(
      "ZIP code not found. Check it and try again."
    );
  }
  if (!response.ok) {
    throw new Error(
      "ZIP code lookup is unavailable. Please try again."
    );
  }
  const data = await response.json();
  const result = data.places?.[0];
  const coordinates = coordinatesOf(result);
  if (!coordinates) {
    throw new Error(
      "No map location was found for this ZIP code."
    );
  }
  const place = {
    ...coordinates,
    city: result["place name"] || `ZIP ${clean}`,
    state: result["state abbreviation"] || "",
    zip: clean,
    source: "zip",
    demoNote: false
  };
  zipCache.set(clean, place);
  return place;
}
