import { useState } from "react";
import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { compareList } from "../lib/compare.js";
import { itemSummary, miles, money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

export default function RoutePlan() {
  const state = useAppState();
  const list =
    state.lists.find(
      (entry) => entry.id === state.activeListId
    ) || state.lists[0];
  const rows = list
    ? state.items.filter((item) => item.list_id === list.id)
    : [];
  const plan = compareList({
    items: rows,
    products: state.catalog.products,
    prices: state.catalog.prices,
    stores: state.catalog.stores,
    swaps: state.catalog.product_swaps,
    acceptedSwapIds: state.acceptedSwapIds,
    radiusMi: state.radiusMi,
    includeMember: state.includeMember,
    now: DEMO_NOW
  });
  const stops =
    state.routePlan === "single" && plan.single
      ? [
          {
            store: plan.single.store,
            items: plan.single.items,
            total: plan.single.total
          }
        ]
      : plan.stops;
  const [index, setIndex] = useState(0);
  const stop = stops[index];

  if (!stop) {
    return (
      <Screen title="Route" backTo="/list/optimize">
        <div className="empty">
          <h2>No route yet</h2>
          <Link className="btn primary" to="/list/optimize">
            Compare totals
          </Link>
        </div>
      </Screen>
    );
  }

  const last = index >= stops.length - 1;

  return (
    <Screen
      title="Route"
      backTo="/list/optimize"
      dock={
        last ? (
          <Link className="btn primary" to="/list">
            Done
          </Link>
        ) : (
          <button
            type="button"
            className="btn primary"
            onClick={() => setIndex((value) => value + 1)}>
            Next stop
          </button>
        )
      }>
      <p className="meta">
        Stop {index + 1} of {stops.length}
        {plan.savings > 0 && state.routePlan !== "single"
          ? ` | saves ${money(plan.savings)}`
          : ""}
      </p>
      <div className="card">
        <h2>{stop.store.name}</h2>
        <p className="muted">
          {miles(stop.store.distance_mi)} |{" "}
          {stop.store.drive_minutes} min drive
        </p>
        <p className="muted">{stop.store.hours_label}</p>
        <p>
          {stop.store.address}, {stop.store.city},{" "}
          {stop.store.state} {stop.store.zip}
        </p>
      </div>
      <div className="section-title">
        <h2>Buy here</h2>
        <strong>{money(stop.total)}</strong>
      </div>
      <ul className="buy-list">
        {stop.items.map((row) => (
          <li key={row.item.id}>
            <span>
              {itemSummary(row.product, row.item.quantity)}
            </span>
            <span>{money(row.line)}</span>
          </li>
        ))}
      </ul>
      <p className="fine">
        Planned stop order for the demo. This is not live
        navigation.
      </p>
    </Screen>
  );
}
