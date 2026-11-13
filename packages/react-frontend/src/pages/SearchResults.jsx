import { useState } from "react";
import {
  Link,
  useNavigate,
  useSearchParams
} from "react-router-dom";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import StorePriceCard from "../components/StorePriceCard.jsx";
import AddItemToList from "../components/AddItemToList.jsx";
import LiveProductSearch from "../components/LiveProductSearch.jsx";
import { DIETARY_FILTERS } from "../data/mock.js";
import { priceClock } from "../lib/catalog.js";
import { useAppState } from "../state/useAppState.js";
import {
  ageLabel,
  isStale,
  miles,
  money
} from "../lib/format.js";
import {
  dietaryStatus,
  findProduct,
  productMatchesQuery
} from "../lib/search.js";

export default function SearchResults() {
  const {
    catalog,
    radiusMi,
    dietary,
    toggleDietary,
    clearDietary,
    rememberSearch
  } = useAppState();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get("q") || "";
  const [draft, setDraft] = useState(query);
  const [within, setWithin] = useState(false);
  const [dietOpen, setDietOpen] = useState(false);
  const found = findProduct(catalog.products, query);
  const status = dietaryStatus(found.primary, dietary);
  const matches = catalog.products.filter(
    (product) =>
      query.trim() &&
      productMatchesQuery(product, query) &&
      dietaryStatus(product, dietary).ok
  );

  function runSearch(term) {
    const clean = term.trim();
    if (!clean) return;
    rememberSearch(clean);
    navigate(`/search?q=${encodeURIComponent(clean)}`);
  }

  const rows = found.primary
    ? catalog.prices
        .filter((row) => row.product_id === found.primary.id)
        .map((row) => ({
          ...row,
          store: catalog.stores.find(
            (store) => store.id === row.store_id
          )
        }))
        .filter((row) => row.store)
        .filter((row) =>
          within ? row.store.distance_mi <= radiusMi : true
        )
        .sort(
          (a, b) =>
            a.price - b.price ||
            a.store.distance_mi - b.store.distance_mi
        )
    : [];
  const cheapestId = rows[0]?.id;

  return (
    <Screen title="Results" backTo="/">
      <form
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch(draft);
        }}>
        <SearchIcon />
        <label className="sr-only" htmlFor="results-search">
          Search an item
        </label>
        <input
          id="results-search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
      </form>
      <div className="chips">
        <button
          type="button"
          className="chip on"
          aria-pressed="true">
          Lowest price
        </button>
        <button
          type="button"
          className={within ? "chip on" : "chip"}
          aria-pressed={within}
          onClick={() => setWithin((value) => !value)}>
          Within {radiusMi} mi
        </button>
        <button
          type="button"
          className={dietary.length ? "chip on" : "chip"}
          aria-pressed={dietary.length > 0}
          onClick={() => setDietOpen(true)}>
          Dietary{dietary.length ? ` (${dietary.length})` : ""}
        </button>
      </div>

      {!found.primary ? (
        <div className="empty">
          <h2>No catalog match for &quot;{query}&quot;</h2>
          <p>
            Check the spelling, or see live Kroger results
            below.
          </p>
          {found.suggestion ? (
            <button
              type="button"
              className="btn primary"
              onClick={() => runSearch(found.suggestion.name)}>
              Did you mean {found.suggestion.name}?
            </button>
          ) : (
            <div className="chips center-chips">
              {["banana", "oat milk", "eggs"].map((term) => (
                <button
                  key={term}
                  type="button"
                  className="chip"
                  onClick={() => runSearch(term)}>
                  {term}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {found.primary && !status.ok ? (
        <div className="empty">
          <h2>Hidden by a dietary filter</h2>
          <p>
            {found.primary.name} conflicts with{" "}
            {status.conflicts.join(", ")}.
          </p>
          <button
            type="button"
            className="btn primary"
            onClick={clearDietary}>
            Clear dietary filters
          </button>
        </div>
      ) : null}

      {found.primary && status.ok ? (
        <>
          <p className="meta">
            {found.primary.name} ({found.primary.list_unit}) |{" "}
            {rows.length}{" "}
            {within
              ? `stores within ${radiusMi} mi`
              : "stores nearby"}
            , cheapest first
          </p>
          {status.unverified ? (
            <p className="banner warn">
              Dietary info is unverified for this item. It is
              not marked as safe.
            </p>
          ) : null}
          {dietary.length > 0 && !status.unverified ? (
            <p className="banner ok">
              Matches {dietary.join(", ")}.
            </p>
          ) : null}
          <div className="stack cards-grid">
            {rows.map((row) => {
              const stale = isStale(
                row.updated_at,
                priceClock(row)
              );
              const to = stale
                ? `/product/${found.primary.id}?warning=stale`
                : `/product/${found.primary.id}`;
              return (
                <StorePriceCard
                  key={row.id}
                  as={Link}
                  to={to}
                  row={row}
                  product={found.primary}
                  cheapest={row.id === cheapestId}
                  stale={stale}
                  staleLabel="Old price"
                  details={
                    <>
                      {miles(row.store.distance_mi)} | updated{" "}
                      {ageLabel(
                        row.updated_at,
                        priceClock(row)
                      )}
                    </>
                  }
                />
              );
            })}
          </div>
          {found.alsoTry.length ? (
            <p className="also">
              Also try:{" "}
              {found.alsoTry.map((product, index) => (
                <span key={product.id}>
                  {index > 0 ? ", " : null}
                  <button
                    type="button"
                    className="text-link inline"
                    onClick={() => runSearch(product.name)}>
                    {product.name}
                  </button>
                </span>
              ))}
            </p>
          ) : null}
        </>
      ) : null}

      <section className="stack">
        <h2>Catalog products</h2>
        <p className="fine">
          Built-in offers are sample prices assigned to sample
          stores. Live Kroger prices appear separately below.
        </p>
        <div className="stack cards-grid">
          {matches.map((product) => {
            const offers = catalog.prices.filter(
              (offer) =>
                offer.product_id === product.id &&
                !isStale(offer.updated_at, priceClock(offer)) &&
                offer.in_stock &&
                catalog.stores.some(
                  (store) =>
                    store.id === offer.store_id &&
                    (!within || store.distance_mi <= radiusMi)
                )
            );
            const storeNames = [
              ...new Set(
                offers.map(
                  (offer) =>
                    catalog.stores.find(
                      (store) => store.id === offer.store_id
                    )?.name
                )
              )
            ];
            return (
              <article
                className="card search-product-card"
                key={product.id}>
                <img
                  src={product.image_url}
                  alt={product.name}
                  loading="lazy"
                />
                <div>
                  <Link to={`/product/${product.id}`}>
                    <strong>{product.name}</strong>
                  </Link>
                  <p className="muted">{product.size_label}</p>
                  <p>
                    {offers.length
                      ? `From ${money(Math.min(...offers.map((offer) => offer.price)))}`
                      : "Price unavailable"}
                  </p>
                  <p className="fine">
                    {storeNames.length
                      ? storeNames.join(" · ")
                      : "No stores in this radius"}
                  </p>
                  <AddItemToList product={product} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <LiveProductSearch key={query} query={query} />
      {dietOpen ? (
        <Sheet
          title="Dietary"
          onClose={() => setDietOpen(false)}>
          <p className="muted sheet-note">
            Conflicting items are hidden. Unverified items stay
            visible with a warning.
          </p>
          <div className="stack">
            {DIETARY_FILTERS.map((filter) => (
              <label key={filter} className="checkline">
                <input
                  type="checkbox"
                  checked={dietary.includes(filter)}
                  onChange={() => toggleDietary(filter)}
                />
                {filter}
              </label>
            ))}
          </div>
          <button
            type="button"
            className="btn primary sheet-btn"
            onClick={() => setDietOpen(false)}>
            Done
          </button>
        </Sheet>
      ) : null}
    </Screen>
  );
}

function SearchIcon() {
  return (
    <svg
      className="search-icon"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true">
      <circle
        cx="10.5"
        cy="10.5"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M15.5 15.5 L20 20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
