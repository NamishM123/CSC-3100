import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import StoreRecommendations from "../components/StoreRecommendations.jsx";
import { compareList, lowestQuote } from "../lib/compare.js";
import { cents, joinNames, money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";
import DietaryNotice from "../components/DietaryNotice.jsx";
import { dietaryStatus } from "../lib/dietary.js";

export default function ShoppingList() {
  const state = useAppState();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [requestedItem, setRequestedItem] = useState("");
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
    dietary: state.dietary,
    now: state.now
  });

  function lineQuote(item) {
    return lowestQuote({
      productId: item.product_id,
      prices: state.catalog.prices,
      stores: state.catalog.stores,
      radiusMi: state.radiusMi,
      includeMember: state.includeMember,
      products: state.catalog.products,
      dietary: state.dietary,
      now: state.now,
      swaps: state.catalog.product_swaps,
      acceptedSwapIds: state.acceptedSwapIds
    });
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
        rows.some((item) => item.query) ? (
          <Link className="btn primary" to="/list/optimize">
            Compare all nearby stores
          </Link>
        ) : rows.length ? (
          <>
            <div className="desktop-only summary-panel">
              <p className="summary-kicker">Catalog total</p>
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
              <span>Cheapest catalog store</span>
              <strong>{singleLabel}</strong>
            </div>
            <button
              type="button"
              className="btn primary"
              onClick={() => navigate("/list/optimize")}>
              Compare stores
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
      {list ? (
        <form
          className="form card"
          onSubmit={(event) => {
            event.preventDefault();
            if (!requestedItem.trim()) return;
            state.addRequestedItem(list.id, requestedItem);
            setRequestedItem("");
          }}>
          <label className="field">
            <span>Add an item to compare across stores</span>
            <input
              value={requestedItem}
              maxLength={120}
              required
              placeholder="e.g. 2% milk"
              onChange={(event) =>
                setRequestedItem(event.target.value)
              }
            />
          </label>
          <button className="btn primary" type="submit">
            Add item
          </button>
          <p className="fine">
            Use a general name to compare brands, or include a
            brand and size for a specific product.
          </p>
        </form>
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
          <h2>
            {list ? "This list is empty" : "No saved lists yet"}
          </h2>
          <p>
            {list
              ? "Add an item above, or search for a product to add."
              : "Create your first list or search for products. Your lists save to your account automatically."}
          </p>
        </div>
      ) : (
        <div className="stack">
          {rows.map((item) => {
            const product = state.catalog.products.find(
              (entry) => entry.id === item.product_id
            ) || {
              id: item.product_id,
              name:
                item.name ||
                item.query ||
                "Unavailable product",
              image_url: item.image_url,
              list_unit: item.size_label || "packages"
            };
            const quote = lineQuote(item);
            const total = quote
              ? cents(quote.unit * item.quantity)
              : null;
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

                {product.image_url ? (
                  <img
                    className="list-product-image"
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility =
                        "hidden";
                    }}
                  />
                ) : (
                  <span
                    className="list-product-placeholder"
                    aria-hidden="true">
                    🛒
                  </span>
                )}
                <div className="list-item-details">
                  <div className="name-line">
                    {item.query ||
                    !state.catalog.products.some(
                      (entry) => entry.id === item.product_id
                    ) ? (
                      <strong>{product.name}</strong>
                    ) : (
                      <Link to={`/product/${product.id}`}>
                        <strong>{product.name}</strong>
                      </Link>
                    )}
                    {state.justAddedProductId === product.id ? (
                      <span className="badge cheap">
                        Just added
                      </span>
                    ) : null}
                  </div>
                  <p className="muted">
                    Qty {item.quantity} | {product.list_unit}
                  </p>
                  {!item.query &&
                  !dietaryStatus(product, state.dietary).ok ? (
                    <p className="fine">
                      Excluded from totals by dietary filters;
                      saved item kept.
                    </p>
                  ) : null}
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
                      ? item.query
                        ? "See matches below"
                        : "Unavailable"
                      : money(total)}
                  </strong>
                  {!item.query ? (
                    <span>
                      {quote
                        ? `${quote.store.source === "demo" ? "Sample catalog price" : "Lowest catalog price"} at ${quote.store.name}`
                        : "No current catalog offer"}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {list ? <DietaryNotice /> : null}
      {list ? (
        <StoreRecommendations key={list.id} items={rows} />
      ) : null}
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
