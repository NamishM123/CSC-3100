import { useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams
} from "react-router-dom";
import PriceChart from "../components/PriceChart.jsx";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { useAppState } from "../state/useAppState.js";
import {
  ageLabel,
  ageOld,
  countNoun,
  isStale,
  miles,
  money,
  shortDate,
  unitCaption
} from "../lib/format.js";
import { lowestQuote } from "../lib/compare.js";

export default function ProductDetail() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const {
    catalog,
    lists,
    items,
    location,
    radiusMi,
    includeMember,
    acceptedSwapIds,
    alerts,
    addOrUpdateItem,
    addAlert
  } = useAppState();
  const product = catalog.products.find(
    (entry) => entry.id === productId
  );
  const [hideStale, setHideStale] = useState(false);
  const [pickedStale, setPickedStale] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [listId, setListId] = useState(lists[0]?.id || "");
  const existing = items.find(
    (item) =>
      item.list_id === listId && item.product_id === productId
  );
  const [quantity, setQuantity] = useState(
    existing?.quantity || 1
  );
  const [chartStoreId, setChartStoreId] = useState(null);

  const rows = useMemo(() => {
    if (!product) return [];
    return catalog.prices
      .filter((row) => row.product_id === product.id)
      .map((row) => ({
        ...row,
        store: catalog.stores.find(
          (store) => store.id === row.store_id
        )
      }))
      .filter((row) => row.store)
      .sort(
        (a, b) =>
          a.price - b.price ||
          a.store.distance_mi - b.store.distance_mi
      );
  }, [catalog.prices, catalog.stores, product]);

  if (!product) {
    return (
      <Screen title="Item" backTo="/">
        <div className="empty">
          <h2>Item not found</h2>
          <Link className="btn primary" to="/">
            Back home
          </Link>
        </div>
      </Screen>
    );
  }

  const visible = hideStale
    ? rows.filter((row) => !isStale(row.updated_at, DEMO_NOW))
    : rows;
  const cheapestId = visible[0]?.id;
  const warningRow =
    pickedStale ||
    (params.get("warning") === "stale"
      ? rows.find((row) => isStale(row.updated_at, DEMO_NOW))
      : null);
  const chartRow =
    visible.find((row) => row.store_id === chartStoreId) ||
    visible[0] ||
    rows[0];
  const history = catalog.price_history
    .filter(
      (point) =>
        point.product_id === product.id &&
        point.store_id === chartRow?.store_id
    )
    .sort((a, b) => a.recorded_on.localeCompare(b.recorded_on));
  const quote = lowestQuote({
    productId: product.id,
    prices: catalog.prices,
    stores: catalog.stores,
    radiusMi,
    includeMember,
    now: DEMO_NOW,
    swaps: catalog.product_swaps,
    acceptedSwapIds
  });
  const alertSaved = alerts.some(
    (alert) => alert.product_id === product.id
  );
  const detailTitle =
    product.list_unit === "each"
      ? `${product.name}, each`
      : product.name;

  function closeWarning() {
    setPickedStale(null);
    if (params.get("warning")) {
      const next = new URLSearchParams(params);
      next.delete("warning");
      setParams(next, { replace: true });
    }
  }

  function onListChange(nextId) {
    setListId(nextId);
    const match = items.find(
      (item) =>
        item.list_id === nextId &&
        item.product_id === product.id
    );
    setQuantity(match?.quantity || 1);
  }

  return (
    <Screen
      title={product.name}
      backTo={`/search?q=${encodeURIComponent(product.name)}`}
      dock={
        <div className="btn-row">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const match = items.find(
                (item) =>
                  item.list_id === listId &&
                  item.product_id === product.id
              );
              setQuantity(match?.quantity || 1);
              setAddOpen(true);
            }}>
            Add to list
          </button>
          <button
            type="button"
            className="btn ghost"
            onClick={() => setAlertOpen(true)}>
            {alertSaved ? "Alert saved" : "Price alert"}
          </button>
        </div>
      }>
      <div className="product-layout">
        <div className="product-head">
          <div className="photo">Photo</div>
          <div>
            <h2 className="product-title">{detailTitle}</h2>
            <p className="muted">
              {product.category} | {product.size_label}
            </p>
            <div className="chips tight">
              {(product.dietary || []).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="product-prices">
          <div className="section-title">
            <h2>Price by store</h2>
          </div>
          {hideStale ? (
            <button
              type="button"
              className="text-link inline"
              onClick={() => setHideStale(false)}>
              Show older prices
            </button>
          ) : null}
          <div className="stack cards-grid">
            {visible.map((row) => {
              const stale = isStale(row.updated_at, DEMO_NOW);
              return (
                <button
                  key={row.id}
                  type="button"
                  className="card price-row"
                  onClick={() => {
                    if (stale) setPickedStale(row);
                    else setChartStoreId(row.store_id);
                  }}>
                  <div>
                    <div className="name-line">
                      <strong>{row.store.name}</strong>
                      {row.id === cheapestId ? (
                        <span className="badge cheap">
                          Cheapest
                        </span>
                      ) : null}
                      {row.is_sale ? (
                        <span className="badge sale">Sale</span>
                      ) : null}
                      {stale ? (
                        <span className="badge old">
                          {ageOld(row.updated_at, DEMO_NOW)}
                        </span>
                      ) : null}
                    </div>
                    <p className="muted">
                      {miles(row.store.distance_mi)}
                    </p>
                  </div>
                  <div className="price-col">
                    <strong>{money(row.price)}</strong>
                    <span>{unitCaption(row, product)}</span>
                  </div>
                </button>
              );
            })}
          </div>
          {visible.length === 0 ? (
            <p className="muted">
              No fresh prices at stores within {radiusMi} mi.
            </p>
          ) : null}
        </div>

        <div className="product-history">
          <div className="section-title">
            <h2>Price history (30 days)</h2>
            <span className="muted">
              {chartRow?.store.name}
            </span>
          </div>
          {history.length ? (
            <div className="chart">
              <PriceChart points={history} />
              <div className="chart-labels">
                <span>
                  {shortDate(history[0].recorded_on)}:{" "}
                  {money(history[0].price)}
                </span>
                <span className="today">
                  Today:{" "}
                  {money(history[history.length - 1].price)}
                </span>
              </div>
            </div>
          ) : (
            <p className="muted">
              No 30 day history for this store yet.
            </p>
          )}
        </div>
      </div>

      {warningRow ? (
        <Sheet title="This price is old" onClose={closeWarning}>
          <p>
            {warningRow.store.name} last checked {product.name}{" "}
            {ageLabel(warningRow.updated_at, DEMO_NOW)}. The
            price may have changed.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn primary"
              onClick={() => {
                setHideStale(true);
                setChartStoreId(null);
                closeWarning();
              }}>
              Show fresh prices
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={closeWarning}>
              Keep browsing
            </button>
          </div>
        </Sheet>
      ) : null}

      {addOpen ? (
        <Sheet
          title="Add to list"
          onClose={() => setAddOpen(false)}>
          {lists.length === 0 ? (
            <p>Create a list on the List tab first.</p>
          ) : (
            <>
              <div className="stack">
                {lists.map((list) => {
                  const count = items.filter(
                    (item) => item.list_id === list.id
                  ).length;
                  return (
                    <label key={list.id} className="choice">
                      <input
                        type="radio"
                        name="list"
                        checked={listId === list.id}
                        onChange={() => onListChange(list.id)}
                      />
                      <span>
                        <strong>{list.name}</strong>
                        <span className="muted">
                          {" "}
                          {countNoun(count, "item")}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="stepper">
                <span>Quantity</span>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() =>
                    setQuantity((value) =>
                      Math.max(1, value - 1)
                    )
                  }>
                  -
                </button>
                <strong>{quantity}</strong>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() =>
                    setQuantity((value) =>
                      Math.min(99, value + 1)
                    )
                  }>
                  +
                </button>
              </div>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  addOrUpdateItem(listId, product.id, quantity);
                  navigate("/list");
                }}>
                {existing ? "Update" : "Add to"}{" "}
                {lists.find((list) => list.id === listId)?.name}
              </button>
            </>
          )}
        </Sheet>
      ) : null}

      {alertOpen ? (
        <Sheet
          title="Price alert"
          onClose={() => setAlertOpen(false)}>
          <p>
            Save an alert for {product.name} near{" "}
            {location?.zip}. We will flag it on this device if
            the lowest fresh price drops below{" "}
            {money(quote?.unit ?? rows[0]?.price)}.
          </p>
          <button
            type="button"
            className="btn primary sheet-btn"
            onClick={() => {
              addAlert({
                product_id: product.id,
                name: product.name,
                zip: location?.zip,
                below: quote?.unit ?? rows[0]?.price
              });
              setAlertOpen(false);
            }}>
            {alertSaved ? "Update alert" : "Save alert"}
          </button>
        </Sheet>
      ) : null}
    </Screen>
  );
}
