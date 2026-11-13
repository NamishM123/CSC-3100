import { findProduct, productMatchesQuery } from "./search.js";
import { dietaryStatus } from "./dietary.js";
import { cents } from "./format.js";
import { priceForMembership } from "./compare.js";
import { listSearchQuery } from "./recommendations.js";
import { nearbyStores } from "./geo.js";
import { reconcileStores } from "./storeDiscovery.js";
import { weeklyAdSources } from "./weeklyAdSources.js";

export const comparisonUnitLabel = (unit) =>
  ({
    item: "packages / each",
    lb: "pounds",
    kg: "kilograms",
    l: "liters"
  })[unit] || unit;
const pacificFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});
const pacificDay = (now) =>
  pacificFormatter.format(new Date(now));
const stablePart = (value) =>
  encodeURIComponent(
    String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
  );

function pricingUnit(product) {
  if (product.pricing_unit) return product.pricing_unit;
  const text = `${product.size_label || ""} ${product.list_unit || ""}`;
  if (/\beach\b|\bea\b|\bct\b|\bcount\b/i.test(text))
    return "item";
  if (
    /^(?:per\s+)?(?:1\s*)?(?:lb\.?|lbs\.?|pounds?)$/i.test(
      text.trim()
    )
  )
    return "lb";
  if (
    /^(?:per\s+)?(?:1\s*)?(?:kg|kilograms?)$/i.test(text.trim())
  )
    return "kg";
  return "item";
}

export function advertisedProduct(offer, provider) {
  const unit = /^(?:lb|pound)$/i.test(offer.unit)
    ? "lb"
    : /^(?:kg|kilogram)$/i.test(offer.unit)
      ? "kg"
      : "item";
  const size =
    offer.package_size ||
    (unit === "lb"
      ? "1 lb"
      : unit === "kg"
        ? "1 kg"
        : offer.unit === "each"
          ? "1 each"
          : "Size not supplied");
  return {
    ...offer,
    // The source's report ID changes with the price/date. A saved choice must
    // survive a price refresh while retaining the same product, size and unit.
    id: `ad:${provider}:${stablePart(offer.name)}:${stablePart(size)}:${unit}:${offer.price_quantity || 1}`,
    name: offer.name,
    size_label: size,
    pricing_unit: unit,
    price_quantity: offer.price_quantity || 1,
    evidence: "advertised",
    availability: "unknown"
  };
}

export function reportedProduct(offer) {
  const unit = /^(?:LB|POUND)$/i.test(offer.unit)
    ? "lb"
    : /^(?:KG|KILOGRAM)$/i.test(offer.unit)
      ? "kg"
      : /^(?:L|LITER)$/i.test(offer.unit)
        ? "l"
        : "item";
  return {
    ...offer,
    id: `report:${stablePart(offer.barcode || offer.name)}:${stablePart(offer.unit)}`,
    size_label:
      unit === "item"
        ? offer.unit || "Size not supplied"
        : `1 ${unit}`,
    pricing_unit: unit,
    price_quantity: 1,
    evidence: "community",
    availability: "unknown"
  };
}

export function buildComparisonStores({
  catalog,
  kroger = {},
  weekly = {},
  community = {},
  location,
  radiusMi,
  includeMember = true
}) {
  const stores = nearbyStores(
    reconcileStores([
      ...Object.values(kroger.entries || {}).map((entry) => ({
        ...catalog.stores.find(
          (store) => store.id === entry.id
        ),
        ...entry
      })),
      ...catalog.stores
    ]),
    location,
    radiusMi
  );
  return stores.map((store) => {
    const localProducts = catalog.prices
      .filter((price) => price.store_id === store.id)
      .flatMap((raw) => {
        const product = catalog.products.find(
          (entry) => entry.id === raw.product_id
        );
        if (!product) return [];
        const price = priceForMembership(raw, includeMember);
        return [
          {
            ...product,
            id: `catalog:${product.id}`,
            price: price.price,
            availability:
              raw.in_stock === true
                ? "in_stock"
                : raw.in_stock === false
                  ? "out_of_stock"
                  : "unknown",
            checkedAt: raw.updated_at,
            evidence:
              raw.source === "demo" ? "demo" : "catalog",
            pricing_unit: /^(?:lb|kg|l)$/i.test(
              product.list_unit || ""
            )
              ? product.list_unit.toLowerCase()
              : "item",
            price_quantity: 1,
            is_member_price: price.is_member_price,
            sale_starts_at: raw.sale_starts_at,
            sale_ends_at: raw.sale_ends_at,
            source_url: raw.source_url
          }
        ];
      });
    if (store.source === "kroger") {
      const result = kroger.entries?.[store.id];
      return {
        ...store,
        results: result?.results || [],
        comparisonProducts: localProducts,
        loading: !result && kroger.pending,
        feedPending: kroger.pending,
        feedError:
          result?.feedError || (!result ? kroger.error : null),
        missingQueryError: kroger.error,
        noDataMessage:
          "No matching products returned by the retailer."
      };
    }
    if (store.source === "weekly-ads") {
      const result = weekly.entries?.[store.provider];
      return {
        ...store,
        comparisonProducts: [
          ...localProducts,
          ...(result?.offers || []).map((offer) =>
            advertisedProduct(offer, store.provider)
          )
        ],
        loading: !result && weekly.pending,
        feedError:
          result?.error || (!result ? weekly.error : null),
        noDataMessage:
          result?.documents?.length && !result.offers?.length
            ? "Prices are available in the original flyer; no matching product prices can be checked automatically."
            : "No matching item in the current advertised offers; store availability is unknown.",
        source_url:
          weeklyAdSources.find(
            (source) => source.id === store.provider
          )?.source_url || store.source_url,
        feedWarnings: result?.warnings || []
      };
    }
    if (store.source === "openstreetmap") {
      const result = community.entries?.[store.id];
      return {
        ...store,
        comparisonProducts: [
          ...localProducts,
          ...(result?.offers || []).map(reportedProduct)
        ],
        loading: !result && community.pending,
        feedError:
          result?.error || (!result ? community.error : null),
        noDataMessage:
          "No recent matching community price report; store availability is unknown.",
        feedWarnings: result?.limited
          ? [
              "Only the latest 50 community price reports are available."
            ]
          : []
      };
    }
    return {
      ...store,
      comparisonProducts: localProducts,
      noDataMessage:
        "No matching priced item in this store's catalog."
    };
  });
}

function evidenceStatus(product, now, today = pacificDay(now)) {
  if (!Number.isFinite(product.price) || product.price <= 0)
    return "Price unavailable";
  if (product.availability === "out_of_stock")
    return "Out of stock";
  for (const [field, end] of [
    ["sale_starts_at", false],
    ["sale_ends_at", true]
  ]) {
    if (!product[field]) continue;
    const text = product[field];
    const time = Date.parse(
      /^\d{4}-\d{2}-\d{2}$/.test(text)
        ? `${text}T${end ? "23:59:59.999" : "00:00:00"}Z`
        : text
    );
    if (
      !Number.isFinite(time) ||
      (end ? now > time : now < time)
    )
      return "This offer is outside its sale dates";
  }
  if (product.evidence === "advertised") {
    if (
      !product.starts_on ||
      !product.ends_on ||
      product.starts_on > today ||
      product.ends_on < today
    )
      return "Advertised price is outside its sale dates";
    return null;
  }
  if (product.evidence === "community") {
    const age =
      Date.parse(`${today}T00:00:00Z`) -
      Date.parse(`${product.observed_on}T00:00:00Z`);
    return !Number.isFinite(age) ||
      age < 0 ||
      age >= 7 * 86400000
      ? "Price report is outdated; current price and stock are unknown"
      : null;
  }
  if (product.evidence !== "demo") {
    const age = now - Date.parse(product.checkedAt);
    const limit =
      product.evidence === "catalog" ? 7 * 86400000 : 5 * 60000;
    if (!Number.isFinite(age) || age < 0 || age >= limit)
      return "Refresh prices to check availability";
  }
  return product.availability === "in_stock"
    ? null
    : "Stock is unconfirmed; no current priced offer";
}

function purchase(product, quantity) {
  const bundle =
    Number.isFinite(product.price_quantity) &&
    product.price_quantity >= 1 &&
    product.price_quantity <= 100
      ? product.price_quantity
      : 1;
  const purchased = Math.ceil(quantity / bundle) * bundle;
  return {
    cost: cents(Math.ceil(quantity / bundle) * product.price),
    purchased,
    extra: purchased - quantity
  };
}

function scoreRows(rows, active, weight) {
  // A missing item is valued at the highest matching price, for scoring only.
  // These imputed values never appear in a displayed basket's subtotal.
  const reference = active.map((_, index) =>
    Math.max(
      0,
      ...rows.map((row) => row.lines[index].lineTotal || 0)
    )
  );
  const costs = rows.map((row) =>
    row.lines.reduce(
      (sum, line, index) =>
        sum + (line.lineTotal ?? reference[index]),
      0
    )
  );
  const minimum = Math.min(...costs.filter((cost) => cost > 0));
  rows.forEach((row, index) => {
    row.priceScore =
      costs[index] > 0 ? minimum / costs[index] : 0;
    row.distanceScore = Number.isFinite(row.store.distance_mi)
      ? 1 / (1 + Math.max(0, row.store.distance_mi))
      : 0;
    row.score = row.matched
      ? Math.round(
          100 *
            row.coverage *
            (weight * row.priceScore +
              (1 - weight) * row.distanceScore)
        )
      : 0;
  });
}

export function rankStoreBaskets({
  stores,
  items,
  products,
  priceWeight = 0.7,
  dietary = [],
  now = Date.now()
}) {
  const active = items.filter(
    (item) =>
      !item.checked &&
      Number.isFinite(item.quantity) &&
      item.quantity > 0
  );
  if (!active.length) return [];
  const today = pacificDay(now);
  const prepared = stores.map((store) => ({
    store,
    lines: active.map((item) => {
      const query = listSearchQuery(item, products);
      const result = store.results?.find(
        (entry) => entry.query === query
      );
      const candidates = [
        ...(result?.products || []).map((product) => ({
          ...product,
          evidence: "retailer",
          checkedAt: result.checkedAt,
          pricing_unit: pricingUnit(product),
          price_quantity: 1
        })),
        ...(store.comparisonProducts || [])
      ].filter((product) =>
        productMatchesQuery({ ...product, category: "" }, query)
      );
      const options = [
        ...new Map(
          candidates
            .filter(
              (product) => dietaryStatus(product, dietary).ok
            )
            .map((product) => [product.id, product])
        ).values()
      ];
      const pinned =
        item.storeSelections?.[store.id] ||
        store.alternate_ids
          ?.map((id) => item.storeSelections?.[id])
          .find(Boolean);
      return {
        item,
        query,
        options,
        pinned,
        candidates,
        result,
        usable: options.filter(
          (product) => !evidenceStatus(product, now, today)
        ),
        error:
          result?.error ||
          store.feedError ||
          (!result ? store.missingQueryError : null),
        truncated: result?.truncated
      };
    })
  }));
  const basesFor = (candidates) =>
    active.map((item, index) => {
      const counts = new Map();
      for (const row of candidates)
        for (const unit of new Set(
          row.lines[index].usable.map(
            (p) => p.pricing_unit || "item"
          )
        ))
          counts.set(unit, (counts.get(unit) || 0) + 1);
      const units = [
        ...new Set([
          ...counts.keys(),
          ...(item.comparisonUnit ? [item.comparisonUnit] : [])
        ])
      ].sort();
      const explicitWeight = /\b(?:lb|lbs|pounds?)\b/i.test(
        item.query || ""
      )
        ? "lb"
        : /\b(?:kg|kilograms?)\b/i.test(item.query || "")
          ? "kg"
          : null;
      const unit =
        item.comparisonUnit ||
        (explicitWeight && units.includes(explicitWeight)
          ? explicitWeight
          : [...counts].sort(
              (a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
            )[0]?.[0]) ||
        "item";
      return { unit, units: [...new Set([unit, ...units])] };
    });
  const real = prepared.filter(
    (row) => row.store.source !== "demo"
  );
  const samples = prepared.filter(
    (row) => row.store.source === "demo"
  );
  const bases = basesFor(real.length ? real : samples);
  const sampleBases = basesFor(samples);
  const rows = prepared.map(({ store, lines }) => {
    let total = 0;
    let confirmed = 0;
    const completeLines = lines.map((line, index) => {
      const basis = (
        store.source === "demo" ? sampleBases : bases
      )[index];
      const usable = line.usable
        .filter(
          (p) => (p.pricing_unit || "item") === basis.unit
        )
        .sort(
          (a, b) =>
            purchase(a, line.item.quantity).cost -
              purchase(b, line.item.quantity).cost ||
            a.name.localeCompare(b.name) ||
            a.id.localeCompare(b.id)
        );
      const ambiguous =
        !findProduct(usable, line.query).primary &&
        usable.length > 0;
      const selected = line.pinned
        ? line.options.find((p) => p.id === line.pinned)
        : ambiguous
          ? null
          : usable[0];
      const usableSelection =
        selected && usable.includes(selected);
      const cost = usableSelection
        ? purchase(selected, line.item.quantity)
        : null;
      const blocked =
        line.error &&
        !["catalog", "demo"].includes(selected?.evidence);
      const lineTotal = !blocked && cost ? cost.cost : null;
      if (lineTotal != null) total = cents(total + lineTotal);
      const isConfirmed =
        lineTotal != null &&
        ["retailer", "catalog"].includes(selected.evidence) &&
        selected.availability === "in_stock";
      if (isConfirmed) confirmed++;
      const wrongUnit =
        (selected &&
          (selected.pricing_unit || "item") !== basis.unit) ||
        (!selected && line.usable.length && !usable.length);
      const excludedPin =
        line.pinned &&
        line.candidates.some((p) => p.id === line.pinned) &&
        !selected;
      const allOut =
        line.options.length &&
        line.options.every(
          (p) => p.availability === "out_of_stock"
        );
      const loading =
        store.loading ||
        (store.source === "kroger" &&
          store.feedPending &&
          !line.result &&
          !store.feedError);
      const status =
        lineTotal != null
          ? isConfirmed
            ? "In stock"
            : selected.evidence === "demo"
              ? "Sample price; not verified"
              : selected.evidence === "advertised"
                ? "Advertised price; stock unconfirmed"
                : `Reported ${selected.observed_on}; stock unconfirmed`
          : line.error
            ? "Prices could not be checked"
            : loading
              ? "Checking item prices..."
              : excludedPin
                ? "Selected product is excluded by dietary filters"
                : line.pinned && !selected
                  ? "Previously selected product is unavailable in these results"
                  : wrongUnit
                    ? `Different pricing unit; comparing ${comparisonUnitLabel(basis.unit)}`
                    : selected
                      ? evidenceStatus(selected, now, today)
                      : ambiguous
                        ? "Choose a product to confirm this match"
                        : allOut
                          ? "Out of stock"
                          : line.candidates.length &&
                              !line.options.length
                            ? "No matching products meet the dietary filters"
                            : line.options.length
                              ? evidenceStatus(
                                  line.options[0],
                                  now,
                                  today
                                ) ||
                                "No comparable priced offer"
                              : store.noDataMessage ||
                                "No matching priced item in the available data";
      return {
        ...line,
        selected,
        ambiguous,
        lineTotal,
        confirmed: isConfirmed,
        status,
        unit: basis.unit,
        availableUnits: basis.units,
        purchase: cost,
        loading
      };
    });
    const matched = completeLines.filter(
      (line) => line.lineTotal != null
    ).length;
    return {
      store,
      lines: completeLines,
      total,
      matched,
      confirmed,
      coverage: matched / active.length,
      complete: matched === active.length,
      confirmedComplete: confirmed === active.length,
      estimated: matched > confirmed,
      demo: store.source === "demo",
      missing: completeLines.filter(
        (line) => line.lineTotal == null
      )
    };
  });
  const weight = Math.max(
    0,
    Math.min(
      1,
      Number.isFinite(priceWeight) ? priceWeight : 0.7
    )
  );
  scoreRows(
    rows.filter((row) => !row.demo),
    active,
    weight
  );
  scoreRows(
    rows.filter((row) => row.demo),
    active,
    weight
  );
  return rows.sort(
    (a, b) =>
      Number(a.demo) - Number(b.demo) ||
      Number(b.complete) - Number(a.complete) ||
      b.score - a.score ||
      b.matched - a.matched ||
      a.store.distance_mi - b.store.distance_mi ||
      a.store.id.localeCompare(b.store.id)
  );
}
