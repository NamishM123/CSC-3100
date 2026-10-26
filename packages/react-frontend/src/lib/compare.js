import { cents, isStale } from "./format.js";

function listedUnit(row, includeMember) {
  if (row.is_member_price && !includeMember) {
    return row.regular_price ?? null;
  }
  return row.price;
}

function acceptedSwap(
  swaps,
  acceptedSwapIds,
  productId,
  storeId
) {
  return (swaps || []).find(
    (swap) =>
      acceptedSwapIds.includes(swap.id) &&
      swap.product_id === productId &&
      swap.store_id === storeId
  );
}

export function freshQuotes({
  productId,
  prices,
  stores,
  radiusMi,
  includeMember,
  now,
  swaps,
  acceptedSwapIds
}) {
  const nearby = stores.filter(
    (store) => store.distance_mi <= radiusMi
  );
  const results = [];
  prices.forEach((row) => {
    if (row.product_id !== productId) return;
    if (!row.in_stock) return;
    if (isStale(row.updated_at, now)) return;
    const store = nearby.find(
      (item) => item.id === row.store_id
    );
    if (!store) return;
    const swap = acceptedSwap(
      swaps,
      acceptedSwapIds,
      productId,
      row.store_id
    );
    const unit = swap
      ? swap.price
      : listedUnit(row, includeMember);
    if (unit == null) return;
    results.push({
      store,
      unit,
      updated_at: row.updated_at,
      price_id: row.id,
      swap
    });
  });
  results.sort(
    (a, b) =>
      a.unit - b.unit ||
      a.store.distance_mi - b.store.distance_mi
  );
  return results;
}

export function lowestQuote(options) {
  const quotes = freshQuotes(options);
  return quotes[0] || null;
}

function quoteLookup(active, options) {
  const quotesByProduct = new Map();
  const quotesByProductAndStore = new Map();

  [...new Set(active.map((item) => item.product_id))].forEach(
    (productId) => {
      const quotes = freshQuotes({ ...options, productId });
      quotesByProduct.set(productId, quotes);
      quotesByProductAndStore.set(
        productId,
        new Map(quotes.map((quote) => [quote.store.id, quote]))
      );
    }
  );

  return { quotesByProduct, quotesByProductAndStore };
}

function assignSplitItems(active, productsById, quotesByProduct) {
  const missing = [];
  const assignments = [];

  active.forEach((item) => {
    const product = productsById.get(item.product_id);
    const quotes = quotesByProduct.get(item.product_id) || [];
    if (!product || quotes.length === 0) {
      missing.push(
        product || { id: item.product_id, name: "Unknown item" }
      );
      return;
    }
    const best = quotes[0];
    assignments.push({
      item,
      product,
      store: best.store,
      line: cents(best.unit * item.quantity),
      unit: best.unit,
      updated_at: best.updated_at
    });
  });

  return { missing, assignments };
}

function buildStops(assignments) {
  const stopsByStore = new Map();
  assignments.forEach((assignment) => {
    const stop = stopsByStore.get(assignment.store.id) || {
      store: assignment.store,
      items: [],
      total: 0
    };
    stop.items.push(assignment);
    stop.total = cents(stop.total + assignment.line);
    stopsByStore.set(assignment.store.id, stop);
  });

  return [...stopsByStore.values()].sort(
    (a, b) => a.store.distance_mi - b.store.distance_mi
  );
}

function findSingleStorePlan(
  active,
  stores,
  radiusMi,
  productsById,
  quotesByProductAndStore
) {
  let cheapestPlan = null;

  stores
    .filter((store) => store.distance_mi <= radiusMi)
    .forEach((store) => {
      const items = [];
      let total = 0;
      for (const item of active) {
        const product = productsById.get(item.product_id);
        const quote = quotesByProductAndStore
          .get(item.product_id)
          ?.get(store.id);
        if (!product || !quote) return;
        const line = cents(quote.unit * item.quantity);
        total = cents(total + line);
        items.push({
          item,
          product,
          line,
          updated_at: quote.updated_at
        });
      }
      if (items.length !== active.length) return;
      if (!cheapestPlan || total < cheapestPlan.total) {
        cheapestPlan = { store, total, items };
      }
    });

  return cheapestPlan;
}

// Greedy split: each list line goes to the cheapest fresh
// price inside the radius. The one-store plan is the
// cheapest store that stocks every line. Extra minutes are
// the sum of stop drive times minus the one-store drive.
export function compareList({
  items,
  products,
  prices,
  stores,
  swaps,
  acceptedSwapIds,
  radiusMi,
  includeMember,
  now
}) {
  const active = (items || []).filter(
    (item) => !item.checked && item.quantity > 0
  );
  if (active.length === 0) {
    return {
      activeCount: 0,
      missing: [],
      stops: [],
      splitTotal: 0,
      single: null,
      savings: null,
      extraMinutes: null,
      oldestUpdatedAt: null
    };
  }
  const productsById = new Map(
    products.map((product) => [product.id, product])
  );
  const { quotesByProduct, quotesByProductAndStore } = quoteLookup(
    active,
    { prices, stores, radiusMi, includeMember, now, swaps, acceptedSwapIds }
  );
  const { missing, assignments } = assignSplitItems(
    active,
    productsById,
    quotesByProduct
  );
  const stops = buildStops(assignments);
  const splitTotal = cents(
    stops.reduce((sum, stop) => sum + stop.total, 0)
  );

  const single = findSingleStorePlan(
    active,
    stores,
    radiusMi,
    productsById,
    quotesByProductAndStore
  );

  const splitDrive = stops.reduce(
    (sum, stop) => sum + stop.store.drive_minutes,
    0
  );
  const usedDates = [
    ...assignments.map((row) => row.updated_at),
    ...(single ? single.items.map((row) => row.updated_at) : [])
  ];
  const dated = usedDates.filter(Boolean).sort();

  return {
    activeCount: active.length,
    missing,
    stops,
    splitTotal,
    single,
    savings: single ? cents(single.total - splitTotal) : null,
    extraMinutes: single
      ? splitDrive - single.store.drive_minutes
      : null,
    oldestUpdatedAt: dated[0] || null
  };
}
