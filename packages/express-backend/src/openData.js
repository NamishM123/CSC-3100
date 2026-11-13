import {
  coordinatesOf,
  distanceMiles
} from "../../react-frontend/src/lib/geo.js";

const OVERPASS =
  "https://overpass.private.coffee/api/interpreter";
const OPEN_PRICES =
  "https://prices.openfoodfacts.org/api/v1/prices";
const OPEN_LOCATIONS =
  "https://prices.openfoodfacts.org/api/v1/locations";
const FOOD_FACTS =
  "https://world.openfoodfacts.org/api/v2/product/";
const UA = "PricePantry/1.0";
const fail = (status, message) =>
  Object.assign(new Error(message), { status });
const tags = (value) =>
  Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string")
        .slice(0, 100)
    : [];
const barcodeKey = (code) =>
  String(code || "").padStart(14, "0");

export function osmIdentity(id) {
  const match = /^osm-(node|way|relation)-(\d{1,16})$/.exec(
    String(id || "")
  );
  if (!match) throw fail(400, "Choose a valid mapped store.");
  return { type: match[1], id: match[2] };
}

export function normalizeOsmStore(row) {
  const position = row.center || row;
  const coordinates = coordinatesOf({
    latitude: position.lat,
    longitude: position.lon
  });
  if (
    !coordinates ||
    ![
      "supermarket",
      "grocery",
      "convenience",
      "greengrocer",
      "wholesale"
    ].includes(row.tags?.shop) ||
    !row.tags?.name ||
    row.tags?.disused === "yes" ||
    row.tags?.access === "private"
  )
    return null;
  return {
    id: `osm-${row.type}-${row.id}`,
    source: "openstreetmap",
    name: row.tags.name,
    ...coordinates,
    address: [
      row.tags["addr:housenumber"],
      row.tags["addr:street"]
    ]
      .filter(Boolean)
      .join(" "),
    city: row.tags["addr:city"] || "",
    state: row.tags["addr:state"] || "",
    zip: row.tags["addr:postcode"] || "",
    chain: row.tags.brand || row.tags.operator || "",
    hours_label: row.tags.opening_hours
      ? `Hours: ${row.tags.opening_hours}`
      : "Hours unavailable",
    source_url: `https://www.openstreetmap.org/${row.type}/${row.id}`
  };
}

export function normalizeOpenPriceLocation(row) {
  const type = String(row.osm_type || "").toLowerCase();
  if (
    row.type !== "OSM" ||
    !/^(node|way|relation)$/.test(type) ||
    !/^\d{1,16}$/.test(String(row.osm_id))
  )
    return null;
  const marketplace =
    row.osm_tag_key === "amenity" &&
    row.osm_tag_value === "marketplace";
  if (!marketplace && row.osm_tag_key !== "shop") return null;
  const store = normalizeOsmStore({
    type,
    id: row.osm_id,
    lat: row.osm_lat,
    lon: row.osm_lon,
    tags: {
      name: row.osm_name,
      shop: marketplace ? "grocery" : row.osm_tag_value,
      brand: row.osm_brand
    }
  });
  return store
    ? {
        ...store,
        address: row.osm_display_name || "",
        zip: row.osm_address_postcode || ""
      }
    : null;
}

export function normalizeFoodFacts(row) {
  return {
    code: String(row.code),
    labels: tags(row.labels_tags),
    analysis: tags(row.ingredients_analysis_tags),
    allergens: tags(row.allergens_tags),
    traces: tags(row.traces_tags),
    source_url: `https://world.openfoodfacts.org/product/${encodeURIComponent(row.code)}`
  };
}

// Bounded read-only clients. Prices and stock are never invented when an
// upstream source is empty or unavailable. Caches stay in server memory.
export function createOpenDataClient({
  fetchImpl = fetch,
  now = Date.now,
  userAgent = process.env.OPEN_DATA_USER_AGENT || UA
} = {}) {
  const cache = new Map();
  const inFlight = new Map();
  const factRequests = [];
  let factsPausedUntil = 0;
  let mapPausedUntil = 0;

  async function cached(key, ttl, work) {
    const saved = cache.get(key);
    if (saved?.expiresAt > now()) return saved.value;
    if (inFlight.has(key)) return inFlight.get(key);
    const task = (async () => {
      const value = await work();
      if (cache.size >= 1000)
        cache.delete(cache.keys().next().value);
      cache.set(key, { value, expiresAt: now() + ttl });
      return value;
    })();
    inFlight.set(key, task);
    try {
      return await task;
    } finally {
      inFlight.delete(key);
    }
  }

  async function json(
    url,
    {
      timeoutMs = 20000,
      allowNotFound = false,
      ...options
    } = {}
  ) {
    const response = await fetchImpl(url, {
      ...options,
      headers: {
        "User-Agent": userAgent,
        Accept: "application/json",
        ...options.headers
      },
      redirect: "error",
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (allowNotFound && response.status === 404)
      return { status: 0 };
    if (!response.ok)
      throw fail(
        response.status === 429 ? 429 : 502,
        response.status === 429
          ? "The community data service is busy. Try again later."
          : "Community data is temporarily unavailable. Please retry."
      );
    return response.json();
  }

  async function facts(codes) {
    const unique = [
      ...new Set(
        codes
          .filter((code) =>
            /^(?:\d{8}|\d{12,14})$/.test(String(code))
          )
          .map(String)
      )
    ];
    const found = {};
    let limited = false;
    // At most 12 uncached lookups per minute across this client, below OFF's
    // read limit. No long queue blocks prices when dietary facts are missing.
    await Promise.all(
      unique.map(async (code) => {
        const key = `facts:${barcodeKey(code)}`;
        try {
          const fact = await cached(
            key,
            24 * 60 * 60 * 1000,
            async () => {
              while (
                factRequests.length &&
                factRequests[0] <= now() - 60000
              )
                factRequests.shift();
              if (
                factRequests.length >= 12 ||
                now() < factsPausedUntil
              ) {
                limited = true;
                throw fail(
                  429,
                  "Dietary lookup limit reached."
                );
              }
              factRequests.push(now());
              const fields =
                "code,labels_tags,ingredients_analysis_tags,allergens_tags,traces_tags";
              let data;
              try {
                data = await json(
                  `${FOOD_FACTS}${encodeURIComponent(code)}.json?fields=${fields}`,
                  { timeoutMs: 5000, allowNotFound: true }
                );
              } catch (error) {
                if (error.status === 429)
                  factsPausedUntil = now() + 60000;
                throw error;
              }
              return data.status === 1 &&
                data.product &&
                barcodeKey(data.product.code) ===
                  barcodeKey(code)
                ? normalizeFoodFacts(data.product)
                : null;
            }
          );
          if (fact) found[code] = fact;
        } catch {
          limited = true;
        }
      })
    );
    return { facts: found, limited };
  }

  async function overpass(query) {
    if (now() < mapPausedUntil)
      throw fail(
        429,
        "Map data is busy. Try again in a minute."
      );
    try {
      const data = await json(OVERPASS, {
        timeoutMs: 10000,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ data: query }).toString()
      });
      if (!Array.isArray(data.elements) || data.remark)
        throw fail(
          502,
          "Map data could not finish loading. Try a smaller radius."
        );
      return data.elements
        .map(normalizeOsmStore)
        .filter(Boolean);
    } catch (error) {
      mapPausedUntil = now() + 60000;
      throw error;
    }
  }

  async function stores(body) {
    const location = coordinatesOf(body?.location);
    const radius = body?.radiusMi;
    if (
      !location ||
      typeof radius !== "number" ||
      !Number.isFinite(radius) ||
      radius < 1 ||
      radius > 100
    )
      throw fail(
        400,
        "Choose a location and a radius between 1 and 100 miles."
      );
    // Keep volunteer infrastructure queries small even when comparison radius
    // is larger. Return this limit explicitly to the UI.
    const searchRadiusMi = Math.min(radius, 25);
    const key = `stores:${location.latitude.toFixed(3)},${location.longitude.toFixed(3)}:${searchRadiusMi}`;
    const discovery = await cached(
      key,
      30 * 60 * 1000,
      async () => {
        try {
          return {
            rows: await overpass(
              `[out:json][timeout:15];nwr["shop"~"^(supermarket|grocery|convenience|greengrocer|wholesale)$"](around:${Math.ceil(searchRadiusMi * 1609.344) + 200},${location.latitude.toFixed(3)},${location.longitude.toFixed(3)});out center;`
            ),
            mapFallback: false
          };
        } catch {
          const params = new URLSearchParams({
            lat: String(location.latitude),
            lon: String(location.longitude),
            radius_km: String(searchRadiusMi * 1.609344),
            page_size: "60"
          });
          const data = await json(
            `${OPEN_LOCATIONS}/nearby?${params}`,
            { timeoutMs: 10000 }
          );
          if (!Array.isArray(data.items))
            throw fail(
              502,
              "Community store locations are temporarily unavailable."
            );
          return {
            rows: data.items
              .map(normalizeOpenPriceLocation)
              .filter(Boolean),
            mapFallback: true
          };
        }
      }
    );
    for (const store of discovery.rows) {
      if (cache.size >= 1000)
        cache.delete(cache.keys().next().value);
      cache.set(`store:${store.id}`, {
        value: store,
        expiresAt: now() + 30 * 60 * 1000
      });
    }
    const nearby = discovery.rows
      .map((store) => ({
        ...store,
        distance_mi: distanceMiles(location, store)
      }))
      .filter(
        (store) =>
          store.distance_mi != null &&
          store.distance_mi <= searchRadiusMi
      )
      .sort((a, b) => a.distance_mi - b.distance_mi);
    return {
      stores: nearby.slice(0, 60),
      limitedStores: nearby.length > 60,
      searchRadiusMi,
      mapFallback: discovery.mapFallback
    };
  }

  async function store(storeId) {
    const identity = osmIdentity(storeId);
    return cached(
      `store:${storeId}`,
      30 * 60 * 1000,
      async () => {
        let found;
        try {
          const rows = await overpass(
            `[out:json][timeout:15];${identity.type}(${identity.id});out center;`
          );
          found = rows.find((row) => row.id === storeId);
        } catch {
          const data = await json(
            `${OPEN_LOCATIONS}/osm/${identity.type.toUpperCase()}/${identity.id}`,
            { timeoutMs: 10000, allowNotFound: true }
          );
          found = normalizeOpenPriceLocation(data);
        }
        if (!found)
          throw fail(
            404,
            "This mapped grocery store is no longer available."
          );
        return found;
      }
    );
  }

  async function prices(storeId) {
    const identity = osmIdentity(storeId);
    return cached(
      `prices:${storeId}`,
      10 * 60 * 1000,
      async () => {
        const today = new Date(now())
          .toISOString()
          .slice(0, 10);
        const since = new Date(now() - 90 * 86400000)
          .toISOString()
          .slice(0, 10);
        const params = new URLSearchParams({
          location_osm_type: identity.type.toUpperCase(),
          location_osm_id: identity.id,
          currency: "USD",
          date__gte: since,
          date__lte: today,
          order_by: "-date",
          page_size: "50"
        });
        const data = await json(`${OPEN_PRICES}?${params}`);
        if (!Array.isArray(data.items))
          throw fail(
            502,
            "Community price data returned an invalid response."
          );
        const seen = new Set();
        const offers = data.items
          .filter(
            (row) =>
              String(row.location_osm_id) === identity.id &&
              String(row.location_osm_type).toLowerCase() ===
                identity.type &&
              row.currency === "USD" &&
              Number(row.price) > 0 &&
              Number.isFinite(Number(row.price)) &&
              /^\d{4}-\d{2}-\d{2}$/.test(row.date) &&
              row.date >= since &&
              row.date <= today
          )
          .sort((a, b) => b.date.localeCompare(a.date))
          .flatMap((row) => {
            const name =
              row.product?.product_name ||
              row.product_name ||
              row.category_tag
                ?.replace(/^en:/, "")
                .replaceAll("-", " ");
            if (!name) return [];
            const key =
              row.product_code ||
              `${name}:${row.price_per || "package"}`;
            if (seen.has(key)) return [];
            seen.add(key);
            return [
              {
                id: String(row.id),
                name,
                barcode: row.product_code || null,
                price: Number(row.price),
                currency: "USD",
                observed_on: row.date,
                unit:
                  row.price_per ||
                  row.product?.quantity ||
                  "package",
                source_url: `https://prices.openfoodfacts.org/prices/${row.id}`,
                availability: "unknown",
                is_discounted: Boolean(row.price_is_discounted),
                discount_type: row.discount_type || null
              }
            ];
          });
        return {
          offers,
          limited: data.total > data.items.length,
          since,
          today
        };
      }
    );
  }
  return { stores, store, prices, facts };
}

export const openDataClient = createOpenDataClient();

export function createOpenDataHandler(client = openDataClient) {
  return async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({
        error: "Use POST for community data searches."
      });
    }
    try {
      const body = req.body;
      if (body?.action === "stores")
        return res.json(await client.stores(body));
      if (body?.action === "inventory") {
        osmIdentity(body.storeId);
        const [store, inventory] = await Promise.all([
          client.store(body.storeId),
          client.prices(body.storeId)
        ]);
        const dietary =
          Array.isArray(body.dietary) && body.dietary.length > 0
            ? await client.facts(
                inventory.offers.map((offer) => offer.barcode)
              )
            : { facts: {}, limited: false };
        return res.json({
          store,
          ...inventory,
          dietaryLimited: dietary.limited,
          offers: inventory.offers.map((offer) => ({
            ...offer,
            dietary_facts: dietary.facts[offer.barcode]
          }))
        });
      }
      throw fail(
        400,
        "Choose a supported community data search."
      );
    } catch (error) {
      return res.status(error.status || 502).json({
        error: error.status
          ? error.message
          : "Community data could not load. Please retry."
      });
    }
  };
}
