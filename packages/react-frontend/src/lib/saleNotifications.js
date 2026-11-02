import { coordinatesOf, distanceMiles } from "./geo.js";
import { money } from "./format.js";
import { DEMO_NOW } from "../data/mock.js";

export function notificationWatch(state) {
  const listIds = new Set(state.lists.map((list) => list.id));
  return {
    productIds: [
      ...new Set(
        state.items
          .filter(
            (item) =>
              listIds.has(item.list_id) &&
              !item.checked &&
              Number(item.quantity) > 0
          )
          .map((item) => item.product_id)
      )
    ].sort(),
    location: coordinatesOf(state.location),
    radiusMi: state.radiusMi,
    includeMember: state.includeMember,
    demo: state.catalog.pricesAreDemo !== false,
    alerts: state.alerts
      .filter(
        (alert) =>
          !alert.zip || alert.zip === state.location?.zip
      )
      .map((alert) => ({
        productId: alert.product_id,
        below: Number(alert.below)
      }))
      .sort((a, b) => a.productId.localeCompare(b.productId))
  };
}

function period(value, end = false) {
  if (value == null || value === "") return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const time = Date.parse(
    dateOnly
      ? `${value}T${end ? "23:59:59.999" : "00:00:00.000"}Z`
      : value
  );
  return Number.isFinite(time) ? time : NaN;
}

export function findSaleNotifications(
  watch,
  catalog,
  now = Date.now()
) {
  if (!coordinatesOf(watch.location)) return [];
  const clock = watch.demo ? Date.parse(DEMO_NOW) : Number(now);
  const products = new Map(
    catalog.products.map((product) => [product.id, product])
  );
  const stores = new Map(
    catalog.stores.map((store) => [store.id, store])
  );
  const watched = new Set(watch.productIds);
  const targets = new Map(
    watch.alerts.map((alert) => [alert.productId, alert.below])
  );
  const matches = new Map();
  for (const row of catalog.prices) {
    const product = products.get(row.product_id),
      store = stores.get(row.store_id);
    const price = row.price == null ? NaN : Number(row.price);
    const updated = Date.parse(row.updated_at);
    const distance = distanceMiles(watch.location, store);
    const starts = period(row.sale_starts_at),
      ends = period(row.sale_ends_at, true);
    if (
      !product ||
      !store ||
      !Number.isFinite(price) ||
      price <= 0 ||
      row.in_stock !== true ||
      !Number.isFinite(updated) ||
      updated > clock ||
      clock - updated >= 7 * 86400000 ||
      distance == null ||
      distance > watch.radiusMi ||
      (row.is_member_price && !watch.includeMember) ||
      Number.isNaN(starts) ||
      Number.isNaN(ends) ||
      (starts != null && starts > clock) ||
      (ends != null && ends < clock) ||
      (starts != null && ends != null && starts > ends)
    )
      continue;
    const target = targets.get(row.product_id);
    const priceMatch =
      Number.isFinite(target) && price < target;
    const saleMatch =
      watched.has(row.product_id) &&
      row.is_sale === true &&
      (row.regular_price == null ||
        Number(row.regular_price) > price);
    if (!priceMatch && !saleMatch) continue;
    const kind = priceMatch ? "price-target" : "sale";
    const id = `offer:${encodeURIComponent(JSON.stringify([kind, row.product_id, row.store_id, price, Boolean(row.is_member_price), row.sale_starts_at || "", row.sale_ends_at || "", priceMatch ? target : null]))}`;
    const label = watch.demo ? "Demo: " : "";
    matches.set(id, {
      id,
      kind,
      productId: row.product_id,
      demo: watch.demo,
      title: `${label}Price Pantry ${priceMatch ? "price alert" : "sale"}`,
      body: `${product.name} is ${money(price)} at ${store.name}${row.is_member_price ? " (member price)" : ""}.${priceMatch ? ` Below your ${money(target)} target.` : ""}${row.sale_ends_at ? ` Sale ends ${row.sale_ends_at}.` : ""}`,
      url: `/product/${encodeURIComponent(row.product_id)}`
    });
  }
  return [...matches.values()];
}
