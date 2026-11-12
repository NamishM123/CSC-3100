import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadKrogerStores } from "../data/kroger.js";
import {
  listSearchQuery,
  rankKrogerStores
} from "../lib/recommendations.js";
import { miles, money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

export default function KrogerRecommendations({ items }) {
  const state = useAppState();
  const [response, setResponse] = useState(null);
  const [failure, setFailure] = useState(null);
  const [revision, setRevision] = useState(0);
  const [clock, setClock] = useState(Date.now);
  const queries = [
    ...new Set(
      items
        .filter((item) => !item.checked && item.quantity > 0)
        .map((item) =>
          listSearchQuery(item, state.catalog.products)
        )
    )
  ].sort();
  // Quantity and SKU changes only recalculate scores; they don't repeat API calls.
  const requestKey = JSON.stringify({
    location: state.location,
    radiusMi: state.radiusMi,
    queries
  });
  useEffect(() => {
    const timer = setInterval(
      () => setClock(Date.now()),
      30000
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const body = JSON.parse(requestKey);
    if (
      !body.location ||
      !body.queries.length ||
      body.queries.length > 20
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await loadKrogerStores(
          body,
          controller.signal
        );
        if (!controller.signal.aborted) {
          setClock(Date.now());
          setFailure(null);
          setResponse({ key: requestKey, revision, result });
        }
      } catch (reason) {
        if (!controller.signal.aborted) {
          setResponse(null);
          setFailure({
            key: requestKey,
            revision,
            message:
              reason.message ||
              "Kroger search failed. Please retry."
          });
        }
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, revision]);

  const current =
    response?.key === requestKey &&
    response?.revision === revision
      ? response.result
      : null;
  const error =
    failure?.key === requestKey &&
    failure?.revision === revision
      ? failure.message
      : "";
  const ranked = rankKrogerStores({
    stores: current?.stores || [],
    items,
    products: state.catalog.products,
    priceWeight: state.krogerPriceWeight,
    now: clock
  });
  const pricePercent = Math.round(
    (state.krogerPriceWeight ?? 0.7) * 100
  );
  const pending =
    queries.length > 0 &&
    state.location &&
    queries.length <= 20 &&
    !current &&
    !error;

  return (
    <section
      className="kroger-recommendations stack"
      aria-labelledby="kroger-heading"
      aria-busy={!!pending}>
      <div className="list-head">
        <h2 id="kroger-heading">
          Nearby Kroger recommendations
        </h2>
        <button
          type="button"
          className="text-link"
          disabled={!!pending || !queries.length}
          onClick={() => setRevision((value) => value + 1)}>
          Refresh prices
        </button>
      </div>
      <p className="muted">
        Compare Kroger family stores using your list, product
        choices, prices, and distance. Quantities count packages
        of the size you select.
      </p>
      <label className="field">
        <span>
          Price priority: {pricePercent}% · distance priority:{" "}
          {100 - pricePercent}%
        </span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={pricePercent}
          onChange={(event) =>
            state.setKrogerPriceWeight(
              Number(event.target.value) / 100
            )
          }
        />
      </label>
      <label className="field">
        <span>Search radius (miles)</span>
        <select
          value={state.radiusMi}
          onChange={(event) =>
            state.setRadius(Number(event.target.value))
          }>
          {[...new Set([1, 5, 10, 25, 50, 100, state.radiusMi])]
            .sort((a, b) => a - b)
            .map((radius) => (
              <option key={radius} value={radius}>
                {radius} miles
              </option>
            ))}
        </select>
      </label>
      <p className="fine">
        Scores run from 0 to 100 and combine price and distance,
        scaled by list coverage. Stores with every item rank
        first. Missing items never count as free. Distance is
        straight-line miles from your location or ZIP center.
      </p>
      {!state.location ? (
        <p>
          <Link to="/location">Choose a location</Link> to
          compare stores.
        </p>
      ) : null}
      {!queries.length ? (
        <p>
          Add items or uncheck purchased items to compare
          stores.
        </p>
      ) : null}
      {queries.length > 20 ? (
        <p role="alert">
          Compare up to 20 different item searches at a time.
          Remove or check off some items.
        </p>
      ) : null}
      {pending ? (
        <p role="status">
          Checking nearby stores and item prices…
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {current?.limitedStores ? (
        <p className="fine">
          Showing the nearest {current.maxStores} Kroger family
          stores returned in your radius.
        </p>
      ) : null}
      {current && !ranked.length ? (
        <p>
          No Kroger family stores were found in this radius. Try
          a wider radius or another location.
        </p>
      ) : null}
      {ranked.map((row, index) => (
        <article className="card stack" key={row.store.id}>
          <div className="kroger-store-heading">
            <div>
              <h3>{row.store.name}</h3>
              <p className="muted">
                {miles(row.store.distance_mi)} ·{" "}
                {row.store.address}
              </p>
            </div>
            <strong>{row.score}/100</strong>
          </div>
          {index === 0 && row.complete ? (
            <span className="badge cheap">
              Recommended for your choices
            </span>
          ) : null}
          <p>
            <strong>
              {row.matched
                ? money(row.total)
                : "No confirmed total"}
            </strong>
            {row.matched
              ? row.complete
                ? " basket total"
                : " partial total"
              : ""}{" "}
            · {row.matched}/{row.lines.length} items with
            confirmed stock and price
          </p>
          {row.lines.map((line) => (
            <div
              className="kroger-product-choice"
              key={line.item.id}>
              <label className="field">
                <span>
                  {line.query} × {line.item.quantity}
                </span>
                <select
                  aria-label={`Choose ${line.query} at ${row.store.name}`}
                  value={line.pinned || ""}
                  onChange={(event) =>
                    state.setStoreProduct(
                      line.item.id,
                      row.store.id,
                      event.target.value
                    )
                  }>
                  <option value="">
                    {line.ambiguous
                      ? "Choose a product to confirm"
                      : "Use cheapest confirmed match"}
                  </option>
                  {line.pinned &&
                  !line.options.some(
                    (product) => product.id === line.pinned
                  ) ? (
                    <option value={line.pinned}>
                      Previously selected product unavailable
                    </option>
                  ) : null}
                  {line.options.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} · {product.size_label} ·{" "}
                      {product.price == null
                        ? "Price unavailable"
                        : money(product.price)}
                      {product.availability !== "in_stock"
                        ? ` · ${product.availability === "out_of_stock" ? "Out of stock" : "Stock unconfirmed"}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                {line.selected
                  ? `${line.selected.name} · ${line.selected.size_label} · `
                  : ""}
                {line.status}
                {line.lineTotal != null
                  ? ` · ${money(line.lineTotal)}`
                  : ""}
              </p>
              {line.error ? (
                <p className="error">{line.error}</p>
              ) : null}
              {line.truncated ? (
                <p className="fine">
                  Search results were limited. Add a brand or
                  size to your list item to narrow the search.
                </p>
              ) : null}
            </div>
          ))}
        </article>
      ))}
      {current ? (
        <p className="fine">
          Kroger results are separate from the sample catalog.
          Stock and prices can change before checkout. Refresh
          after five minutes to keep scoring current.
        </p>
      ) : null}
    </section>
  );
}
