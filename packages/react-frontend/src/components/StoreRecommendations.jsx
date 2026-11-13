import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useStoreComparisons } from "../hooks/useStoreComparisons.js";
import { listSearchQuery } from "../lib/recommendations.js";
import {
  buildComparisonStores,
  comparisonUnitLabel,
  rankStoreBaskets
} from "../lib/storeComparisons.js";
import { nearbyStores } from "../lib/geo.js";
import { miles, money } from "../lib/format.js";
import { storeItemsPath } from "../lib/storeLinks.js";
import { useAppState } from "../state/useAppState.js";
import ScoreRing from "./ScoreRing.jsx";
import DietaryNotice from "./DietaryNotice.jsx";

function StoreBasket({ row, recommended, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <article className="card stack">
      <div className="kroger-store-heading">
        <div>
          <h3>{row.store.name}</h3>
          <p className="muted">
            {[row.store.address, row.store.city]
              .filter(Boolean)
              .join(", ")}{" "}
            · {miles(row.store.distance_mi)}
          </p>
        </div>
        <ScoreRing score={row.score} />
      </div>
      {recommended ? (
        <span className="badge cheap">
          {row.estimated
            ? "Best estimated basket"
            : "Recommended for your choices"}
        </span>
      ) : null}
      <p>
        <strong>
          {row.matched ? money(row.total) : "No priced total"}
        </strong>
        {row.matched
          ? ` ${row.demo ? "sample " : row.estimated ? "estimated " : ""}${row.complete ? "basket total" : "partial total"}`
          : ""}{" "}
        · {row.matched}/{row.lines.length} items priced
        {row.demo
          ? " · Sample data"
          : ` · ${row.confirmed} confirmed in stock`}
      </p>
      {!row.complete ? (
        <div className="fine" role="status">
          <strong>Not included ({row.missing.length}):</strong>
          <ul>
            {row.missing.slice(0, 5).map((line) => (
              <li key={line.item.id}>
                <strong>{line.item.name || line.query}:</strong>{" "}
                {line.status}
              </li>
            ))}
          </ul>
          {row.missing.length > 5 ? (
            <p>
              {row.missing.length - 5} more items are listed in
              the proposed store list.
            </p>
          ) : null}
          <p>
            Missing items reduce this store&apos;s score and are
            excluded from the displayed total.
          </p>
        </div>
      ) : null}
      {row.store.feedError ? (
        <p className="error" role="status">
          {row.store.feedError}
        </p>
      ) : null}
      <details
        open={expanded}
        onToggle={(event) =>
          setExpanded(event.currentTarget.open)
        }>
        <summary>
          Proposed store list · {row.lines.length} items
        </summary>
        {expanded ? (
          <div className="stack">
            {row.lines.map((line) => (
              <div
                className="kroger-product-choice"
                key={line.item.id}>
                {line.selected?.image_url ? (
                  <img
                    className="list-product-image"
                    src={line.selected.image_url}
                    alt=""
                    loading="lazy"
                  />
                ) : null}
                <label className="field">
                  <span>
                    {line.query} × {line.item.quantity} (
                    {comparisonUnitLabel(line.unit)})
                  </span>
                  <select
                    aria-label={`Choose ${line.query} at ${row.store.name}`}
                    disabled={
                      !line.options.length && !line.pinned
                    }
                    value={line.pinned || ""}
                    onChange={(event) =>
                      onSelect(
                        line.item.id,
                        row.store.id,
                        event.target.value
                      )
                    }>
                    <option value="">
                      {line.ambiguous
                        ? "Choose a product to confirm"
                        : "Use cheapest comparable match"}
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
                      <option
                        key={product.id}
                        value={product.id}>
                        {product.name} ·{" "}
                        {product.size_label ||
                          "Size not supplied"}{" "}
                        ·{" "}
                        {product.advertised_price ||
                          money(product.price)}
                        {product.deposit_extra ? " + CRV" : ""}
                        {product.availability === "out_of_stock"
                          ? " · Out of stock"
                          : product.evidence === "demo"
                            ? " · Sample price"
                            : product.availability !==
                                "in_stock"
                              ? " · Stock unconfirmed"
                              : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <p
                  className={
                    line.lineTotal == null ? "fine" : "muted"
                  }>
                  <strong>
                    {line.item.name || line.query}:
                  </strong>{" "}
                  {line.selected
                    ? `${line.selected.name} · ${line.selected.size_label || "Size not supplied"} · `
                    : ""}
                  {line.status}
                  {line.lineTotal != null
                    ? ` · ${money(line.lineTotal)}`
                    : ""}
                </p>
                {line.selected?.description ? (
                  <p className="fine">
                    {line.selected.description}
                  </p>
                ) : null}
                {line.selected?.ends_on ? (
                  <p className="fine">
                    Advertised through {line.selected.ends_on}.
                  </p>
                ) : null}
                {line.selected?.is_member_price ? (
                  <p className="fine">
                    Member price; membership is required.
                  </p>
                ) : null}
                {line.purchase?.extra > 0 ? (
                  <p className="fine">
                    This offer requires buying{" "}
                    {line.purchase.purchased} units. The total
                    includes {line.purchase.extra} extra{" "}
                    {line.purchase.extra === 1
                      ? "unit"
                      : "units"}{" "}
                    to meet the multi-buy requirement.
                  </p>
                ) : null}
                {line.selected?.deposit_extra ? (
                  <p className="fine">
                    Additional CRV deposit is not included in
                    this estimate.
                  </p>
                ) : null}
                {line.error ? (
                  <p className="error">{line.error}</p>
                ) : null}
                {line.truncated ? (
                  <p className="fine">
                    Search results were limited. Add a brand or
                    size to narrow the match.
                  </p>
                ) : null}
                {line.selected?.source_url?.startsWith(
                  "https://"
                ) ? (
                  <a
                    className="text-link"
                    href={line.selected.source_url}
                    target="_blank"
                    rel="noreferrer">
                    View price source
                  </a>
                ) : null}
                {line.selected?.dietary_facts ? (
                  <a
                    className="fine"
                    href={
                      line.selected.dietary_facts.source_url
                    }
                    target="_blank"
                    rel="noreferrer">
                    Dietary data: Open Food Facts (ODbL)
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </details>
      <Link
        className="text-link"
        to={storeItemsPath(row.store)}
        state={{ store: row.store }}>
        View store items and source details
      </Link>
      {row.store.feedWarnings?.map((warning) => (
        <p className="fine" key={warning}>
          {warning}
        </p>
      ))}
    </article>
  );
}

export default function StoreRecommendations({ items }) {
  const state = useAppState();
  const [clock, setClock] = useState(Date.now);
  const active = items.filter(
    (item) => !item.checked && item.quantity > 0
  );
  const queries = [
    ...new Set(
      active.map((item) =>
        listSearchQuery(item, state.catalog.products)
      )
    )
  ].sort();
  const stores = nearbyStores(
    state.catalog.stores,
    state.location,
    state.radiusMi
  );
  const feeds = useStoreComparisons({
    stores,
    queries,
    location: state.location,
    radiusMi: state.radiusMi,
    dietary: state.dietary
  });
  useEffect(() => {
    const timer = setInterval(
      () => setClock(Date.now()),
      30000
    );
    return () => clearInterval(timer);
  }, []);
  const ranked = rankStoreBaskets({
    stores: buildComparisonStores({
      catalog: state.catalog,
      kroger: feeds.kroger,
      weekly: feeds.weekly,
      community: feeds.community,
      location: state.location,
      radiusMi: state.radiusMi,
      includeMember: state.includeMember
    }),
    items,
    products: state.catalog.products,
    priceWeight: state.krogerPriceWeight,
    dietary: state.dietary,
    now: Math.max(clock, state.now || 0)
  });
  const real = ranked.filter((row) => !row.demo);
  const samples = ranked.filter((row) => row.demo);
  const units = ranked[0]?.lines || [];
  const pricePercent = Math.round(
    (state.krogerPriceWeight ?? 0.7) * 100
  );
  const directory = state.storeDirectory;
  const discoveryPending =
    directory?.community.loading || directory?.kroger.loading;
  return (
    <section
      className="kroger-recommendations stack"
      aria-labelledby="store-comparison-heading"
      aria-busy={feeds.pending || !!discoveryPending}>
      <div className="list-head">
        <h2 id="store-comparison-heading">
          Compare all nearby stores
        </h2>
        <button
          className="text-link"
          type="button"
          disabled={!queries.length}
          onClick={() => {
            feeds.refresh();
            void state.refreshCatalog();
          }}>
          Refresh prices
        </button>
      </div>
      <p className="muted">
        A proposed list for each store, including incomplete
        baskets. Retailer stock, advertised offers, and dated
        community reports are labeled separately. Estimated
        prices do not confirm stock.
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
              <option value={radius} key={radius}>
                {radius} miles
              </option>
            ))}
        </select>
      </label>
      <p className="fine">
        Scores combine price and straight-line distance,
        multiplied by the fraction of list items priced.
        Complete priced baskets rank first. Missing items are
        never free: scoring allows for their cost using prices
        at other stores, while displayed totals include only the
        priced items. Compare matching sizes; quantities mean
        the selected package, each, or weight unit.
      </p>
      {units.some(
        (line) =>
          line.availableUnits.length > 1 ||
          line.item.comparisonUnit
      ) ? (
        <fieldset className="card stack">
          <legend>Comparison units</legend>
          <p className="fine">
            Choose a shared pricing unit for each item.
            Per-pound prices and per-item prices are kept
            separate. Automatic uses the unit priced by the most
            stores.
          </p>
          {units
            .filter(
              (line) =>
                line.availableUnits.length > 1 ||
                line.item.comparisonUnit
            )
            .map((line) => (
              <label className="field" key={line.item.id}>
                <span>{line.item.name || line.query}</span>
                <select
                  value={line.item.comparisonUnit || ""}
                  onChange={(event) =>
                    state.setComparisonUnit(
                      line.item.id,
                      event.target.value
                    )
                  }>
                  <option value="">
                    Automatic ({comparisonUnitLabel(line.unit)})
                  </option>
                  {line.availableUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {comparisonUnitLabel(unit)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
        </fieldset>
      ) : null}
      <DietaryNotice
        limited={
          feeds.kroger.dietaryLimited ||
          feeds.community.dietaryLimited
        }
      />
      {!state.location ? (
        <p>
          <Link to="/location">Choose a location</Link> to
          compare stores.
        </p>
      ) : null}
      {!active.length ? (
        <p>
          Add items or uncheck purchased items to compare
          stores.
        </p>
      ) : null}
      {discoveryPending ? (
        <p role="status">Finding additional nearby stores...</p>
      ) : null}
      {directory?.community.error ? (
        <p className="fine" role="status">
          {directory.community.error} Some mapped stores may be
          missing.{" "}
          <button
            className="text-link"
            type="button"
            onClick={directory.community.retry}>
            Retry store discovery
          </button>
        </p>
      ) : null}
      {directory?.kroger.error ? (
        <p className="fine" role="status">
          {directory.kroger.error}
        </p>
      ) : null}
      {state.radiusMi > 25 ||
      directory?.community.data?.limitedStores ||
      directory?.community.data?.mapFallback ? (
        <p className="fine">
          Community location discovery covers the nearest 25
          miles and up to 60 stores.
          {directory?.community.data?.mapFallback
            ? " Full map discovery is temporarily unavailable; only locations known to Open Prices are included."
            : ""}{" "}
          All stores currently available in the app are included
          in these comparisons.
        </p>
      ) : null}
      {directory?.kroger.limitedStores ? (
        <p className="fine">
          Retailer location discovery reached its limit;
          additional branches may exist.
        </p>
      ) : null}
      {feeds.pending ? (
        <p role="status">
          Checking store prices. Available comparisons appear as
          each source responds.
        </p>
      ) : null}
      {[feeds.kroger, feeds.weekly, feeds.community].map(
        (feed, index) => (
          <div key={index}>
            {feed.error ? (
              <p className="error" role="alert">
                {feed.error}
              </p>
            ) : null}
            {feed.pending && feed.total > 0 ? (
              <p className="fine">
                {
                  [
                    "Retailer searches",
                    "Weekly-ad publishers",
                    "Community store reports"
                  ][index]
                }{" "}
                checked: {feed.completed || 0}/{feed.total}
              </p>
            ) : null}
            {feed.warnings?.map((warning) => (
              <p className="fine" key={warning}>
                {warning}
              </p>
            ))}
          </div>
        )
      )}
      {real
        .filter((row) => row.matched > 0)
        .map((row, index) => (
          <StoreBasket
            key={row.store.id}
            row={row}
            recommended={
              index === 0 && row.complete && !feeds.pending
            }
            onSelect={state.setStoreProduct}
          />
        ))}
      {active.length > 0 &&
      !ranked.length &&
      !discoveryPending ? (
        <p>
          No stores are currently available within this radius.
          Try a wider radius.
        </p>
      ) : null}
      {samples.length ? (
        <section
          className="stack"
          aria-label="Built-in sample store comparisons">
          <h3>Built-in sample stores ({samples.length})</h3>
          <p className="fine">
            These built-in prices are illustrative. Their scores
            are calculated separately and never influence
            real-store recommendations.
          </p>
          <div className="stack">
            {samples.map((row) => (
              <StoreBasket
                key={row.store.id}
                row={row}
                onSelect={state.setStoreProduct}
              />
            ))}
          </div>
        </section>
      ) : null}
      {real.some((row) => !row.matched) ? (
        <section
          className="stack"
          aria-label="Stores without comparable prices">
          <h3>Stores without comparable prices</h3>
          {real
            .filter((row) => !row.matched)
            .map((row) => (
              <StoreBasket
                key={row.store.id}
                row={row}
                onSelect={state.setStoreProduct}
              />
            ))}
        </section>
      ) : null}
      {active.length ? (
        <p className="fine">
          Retailer prices refresh when you return and every four
          minutes. Source caches still apply. Community
          estimates require reports less than seven days old;
          advertised offers must be within their sale dates. A
          missing offer means availability is unknown unless the
          retailer explicitly reports out of stock.
        </p>
      ) : null}
      {Object.keys(feeds.community.entries).length ? (
        <p className="fine">
          Community price reports:{" "}
          <a
            href="https://prices.openfoodfacts.org"
            target="_blank"
            rel="noreferrer">
            Open Prices / Open Food Facts
          </a>{" "}
          (ODbL). Reported observations are separate from
          retailer stock confirmations.
        </p>
      ) : null}
    </section>
  );
}
