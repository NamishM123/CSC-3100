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
  const missing = [];
  const assignments = [];

  active.forEach((item) => {
    const product = products.find(
      (entry) => entry.id === item.product_id
    );
    const quotes = freshQuotes({
      productId: item.product_id,
      prices,
      stores,
      radiusMi,
      includeMember,
      now,
      swaps,
      acceptedSwapIds
    });
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

  const stopsMap = new Map();
  assignments.forEach((row) => {
    const current = stopsMap.get(row.store.id) || {
      store: row.store,
      items: [],
      total: 0
    };
    current.items.push(row);
    current.total = cents(current.total + row.line);
    stopsMap.set(row.store.id, current);
  });

  const stops = [...stopsMap.values()].sort(
    (a, b) => a.store.distance_mi - b.store.distance_mi
  );
  const splitTotal = cents(
    stops.reduce((sum, stop) => sum + stop.total, 0)
  );

  let single = null;
  stores
    .filter((store) => store.distance_mi <= radiusMi)
    .forEach((store) => {
      const lines = [];
      let total = 0;
      for (const item of active) {
        const product = products.find(
          (entry) => entry.id === item.product_id
        );
        const quote = freshQuotes({
          productId: item.product_id,
          prices,
          stores,
          radiusMi,
          includeMember,
          now,
          swaps,
          acceptedSwapIds
        }).find((entry) => entry.store.id === store.id);
        if (!product || !quote) return;
        const line = cents(quote.unit * item.quantity);
        total = cents(total + line);
        lines.push({
          item,
          product,
          line,
          updated_at: quote.updated_at
        });
      }
      if (lines.length !== active.length) return;
      if (!single || total < single.total) {
        single = { store, total, items: lines };
      }
    });

  const splitDrive = stops.reduce(
    (sum, stop) => sum + stop.store.drive_minutes,
    0
  );
  const usedDates = assignments.map((row) => row.updated_at);
  if (single) {
    single.items.forEach((row) =>
      usedDates.push(row.updated_at)
    );
  }
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
