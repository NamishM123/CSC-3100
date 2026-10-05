import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { compareList } from "../lib/compare.js";
import {
  ageLabel,
  cents,
  countNoun,
  itemSummary,
  miles,
  money
} from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

export default function Optimized() {
  const state = useAppState();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
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
  const [selected, setSelected] = useState("split");
  const swap = state.catalog.product_swaps.find((entry) =>
    rows.some((item) => item.product_id === entry.product_id)
  );
  const swapItem = swap
    ? rows.find((item) => item.product_id === swap.product_id)
    : null;
  const swapProduct = swap
    ? state.catalog.products.find(
        (entry) => entry.id === swap.product_id
      )
    : null;
  const swapStore = swap
    ? state.catalog.stores.find(
        (entry) => entry.id === swap.store_id
      )
    : null;
  const currentPrice = swap
    ? state.catalog.prices.find(
        (row) =>
          row.product_id === swap.product_id &&
          row.store_id === swap.store_id
      )
    : null;
  const swapSavings =
    swap && currentPrice && swapItem
      ? cents(
          (currentPrice.price - swap.price) * swapItem.quantity
        )
      : 0;
  const accepted = swap
    ? state.acceptedSwapIds.includes(swap.id)
    : false;
  const choice =
    selected === "single" && plan.single ? "single" : "split";

  const age = plan.oldestUpdatedAt
    ? ageLabel(plan.oldestUpdatedAt, DEMO_NOW)
    : null;

  return (
    <Screen
      title="Cheapest total"
      backTo="/list"
      dock={
        <button
          type="button"
          className="btn primary"
          disabled={plan.stops.length === 0}
          onClick={() => {
            state.setRoutePlan(choice);
            navigate("/route");
          }}>
          {choice === "split"
            ? "Start route at stop 1"
            : "Start route"}
        </button>
      }>
      <p className="meta">
        {countNoun(rows.length, "item")} | stores within{" "}
        {state.radiusMi} mi
        {age ? ` | prices from ${age}` : ""}
      </p>

      <div className="compare-columns">
        <div>
          {plan.stops.length ? (
            <label
              className={
                choice === "split" ? "best on" : "best"
              }>
              <input
                className="sr-only"
                type="radio"
                name="plan"
                checked={choice === "split"}
                onChange={() => setSelected("split")}
              />
              <div className="best-top">
                <span className="muted">Best total</span>
                {plan.savings > 0 ? (
                  <strong className="save">
                    Save {money(plan.savings)}
                  </strong>
                ) : (
                  <strong className="save">Lowest total</strong>
                )}
              </div>
              <div className="best-mid">
                <strong>
                  Split across{" "}
                  {countNoun(plan.stops.length, "store")}
                </strong>
                <strong className="big">
                  {money(plan.splitTotal)}
                </strong>
              </div>
              <p className="muted">
                {plan.extraMinutes == null
                  ? "Compared with one store when a full store exists."
                  : plan.extraMinutes > 0
                    ? `+${plan.extraMinutes} min extra driving compared with one store`
                    : plan.extraMinutes === 0
                      ? "Same driving time as one store"
                      : `${Math.abs(plan.extraMinutes)} min less driving than one store`}
              </p>
              <div className="stack inner stops-grid">
                {plan.stops.map((stop, index) => (
                  <div
                    key={stop.store.id}
                    className="card stop-card">
                    <div className="stop-main">
                      <span className="stop-num">
                        {index + 1}
                      </span>
                      <div>
                        <strong>{stop.store.name}</strong>
                        <p className="muted">
                          {miles(stop.store.distance_mi)} |{" "}
                          {countNoun(stop.items.length, "item")}
                        </p>
                        <p className="muted">
                          {stop.items
                            .map((row) =>
                              itemSummary(
                                row.product,
                                row.item.quantity
                              )
                            )
                            .join(", ")}
                        </p>
                      </div>
                    </div>
                    <strong>{money(stop.total)}</strong>
                  </div>
                ))}
              </div>
            </label>
          ) : (
            <div className="card">
              <strong>No fresh prices for this list</strong>
              <p className="muted">
                Try a wider radius, or clear items that have no
                nearby price.
              </p>
            </div>
          )}
        </div>
        <div className="compare-side">
          {plan.single ? (
            <label
              className={
                choice === "single"
                  ? "card plan on"
                  : "card plan"
              }>
              <input
                className="sr-only"
                type="radio"
                name="plan"
                checked={choice === "single"}
                onChange={() => setSelected("single")}
              />
              <div>
                <strong>
                  One store: {plan.single.store.name}
                </strong>
                <p className="muted">
                  All {countNoun(plan.activeCount, "item")} in
                  one trip |{" "}
                  {miles(plan.single.store.distance_mi)}
                </p>
              </div>
              <strong className="big">
                {money(plan.single.total)}
              </strong>
            </label>
          ) : (
            <div className="card">
              <strong>No single store has every item</strong>
              <p className="muted">
                {plan.missing.length
                  ? `Missing nearby: ${plan.missing.map((item) => item.name).join(", ")}.`
                  : "Split the list across the stops above."}
              </p>
            </div>
          )}

          <label className="checkline">
            <input
              type="checkbox"
              checked={state.includeMember}
              onChange={(event) =>
                state.setIncludeMember(event.target.checked)
              }
            />
            Include member prices (Safeway Club)
          </label>
          <label className="checkline">
            <input
              type="checkbox"
              checked={state.suggestSwaps}
              onChange={(event) =>
                state.setSuggestSwaps(event.target.checked)
              }
            />
            Suggest cheaper store brand swaps
          </label>

          {state.suggestSwaps &&
          swap &&
          swapProduct &&
          !dismissed ? (
            <div className="card swap">
              <strong>
                {accepted ? "Swap applied" : "Cheaper swap"}
              </strong>
              <p>
                {swap.name}, {swap.size_label}, is{" "}
                {money(swap.price)} at {swapStore?.name}. That
                saves {money(swapSavings)} compared with{" "}
                {swapProduct.name}.
              </p>
              <div className="btn-row">
                <button
                  type="button"
                  className="btn primary"
                  onClick={() => state.toggleSwap(swap.id)}>
                  {accepted ? "Undo swap" : "Use this swap"}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setDismissed(true)}>
                  Keep original
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Screen>
  );
}
