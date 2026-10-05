import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { compareList, lowestQuote } from "../lib/compare.js";
import { cents, joinNames, money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

export default function ShoppingList() {
  const state = useAppState();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
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

  function linePrice(item) {
    const quote = lowestQuote({
      productId: item.product_id,
      prices: state.catalog.prices,
      stores: state.catalog.stores,
      radiusMi: state.radiusMi,
      includeMember: state.includeMember,
      now: DEMO_NOW,
      swaps: state.catalog.product_swaps,
      acceptedSwapIds: state.acceptedSwapIds
    });
    if (!quote) return null;
    return cents(quote.unit * item.quantity);
  }

  const singleLabel =
    rows.length > 0 && plan.activeCount === 0
      ? "All items are checked off"
      : plan.single
        ? `${money(plan.single.total)} at ${plan.single.store.name}`
        : "No store has every item";

  return (
    <Screen
      title={list?.name || "Lists"}
      chrome={false}
      className="list-screen"
      dock={
        rows.length ? (
          <>
            <div className="desktop-only summary-panel">
              <p className="summary-kicker">Cheapest total</p>
              <div className="summary-figure">
                <span>
                  {plan.stops.length
                    ? `Split across ${plan.stops.length} ${
                        plan.stops.length === 1
                          ? "store"
                          : "stores"
                      }`
                    : "Split across stores"}
                </span>
                <strong>
                  {plan.stops.length
                    ? money(plan.splitTotal)
                    : "Unavailable"}
                </strong>
              </div>
              {plan.savings > 0 ? (
                <p className="save">
                  Save {money(plan.savings)} compared with one
                  store
                </p>
              ) : null}
            </div>
            <div className="total-line">
              <span>Cheapest single store</span>
              <strong>{singleLabel}</strong>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate("/list/optimize")}>
              Find cheapest total
            </button>
          </>
        ) : (
          <Link className="btn primary" to="/">
            Search items
          </Link>
        )
      }>
      <div className="list-head">
        <h1>{list?.name || "Your lists"}</h1>
        <button
          type="button"
          className="text-link"
          onClick={() => setCreating(true)}>
          + New list
        </button>
      </div>
      {state.lists.length > 1 ? (
        <div className="chips">
          {state.lists.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={
                entry.id === list?.id ? "chip on" : "chip"
              }
              onClick={() => state.setActiveList(entry.id)}>
              {entry.name}
            </button>
          ))}
        </div>
      ) : null}
      {list?.shared_with?.length ? (
        <div className="avatar-row">
          {list.shared_with.map((person) => (
            <span key={person.name} className="avatar">
              {person.initial}
            </span>
          ))}
          <span>Shared with {joinNames(list.shared_with)}</span>
          <button
            type="button"
            className="text-link push"
            onClick={() => setEditing((value) => !value)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      ) : (
        <div className="avatar-row">
          <button
            type="button"
            className="text-link"
            onClick={() => setEditing((value) => !value)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty">
          <h2>This list is empty</h2>
          <p>Search for an item and add it to this list.</p>
        </div>
      ) : (
        <div className="stack">
          {rows.map((item) => {
            const product = state.catalog.products.find(
              (entry) => entry.id === item.product_id
            );
            if (!product) return null;
            const total = linePrice(item);
            return (
              <div
                key={item.id}
                className={
                  item.checked
                    ? "card list-item checked"
                    : "card list-item"
                }>
                <input
                  type="checkbox"
                  aria-label={`Check off ${product.name}`}
                  checked={item.checked}
                  onChange={() => state.toggleChecked(item.id)}
                />
                <div>
                  <div className="name-line">
                    <Link to={`/product/${product.id}`}>
                      <strong>{product.name}</strong>
                    </Link>
                    {state.justAddedProductId === product.id ? (
                      <span className="badge cheap">
                        Just added
                      </span>
                    ) : null}
                  </div>
                  <p className="muted">
                    Qty {item.quantity} | {product.list_unit}
                  </p>
                  {editing ? (
                    <div className="edit-row">
                      <button
                        type="button"
                        onClick={() =>
                          state.setItemQuantity(
                            item.id,
                            Math.max(1, item.quantity - 1)
                          )
                        }>
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          state.setItemQuantity(
                            item.id,
                            Math.min(99, item.quantity + 1)
                          )
                        }>
                        +
                      </button>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() =>
                          state.removeItem(item.id)
                        }>
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
                <div className="price-col">
                  <strong>
                    {total == null
                      ? "Unavailable"
                      : money(total)}
                  </strong>
                  <span>lowest</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editing && list ? (
        <button
          type="button"
          className="text-link danger-link"
          onClick={() => {
            state.deleteList(list.id);
            setEditing(false);
          }}>
          Delete list
        </button>
      ) : null}
      {creating ? (
        <Sheet
          title="New list"
          onClose={() => setCreating(false)}>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const id = state.createList(name);
              if (!id) return;
              setName("");
              setCreating(false);
            }}>
            <label className="field">
              <span>List name</span>
              <input
                value={name}
                autoFocus
                onChange={(event) =>
                  setName(event.target.value)
                }
              />
            </label>
            <button className="btn primary" type="submit">
              Create list
            </button>
          </form>
        </Sheet>
      ) : null}
    </Screen>
  );
}
