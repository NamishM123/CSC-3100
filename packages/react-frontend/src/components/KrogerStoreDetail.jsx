import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useKrogerSearch } from "../hooks/useKrogerSearch.js";
import { useMapLocation } from "../hooks/useMapLocation.js";
import { ageLabel, miles } from "../lib/format.js";
import { dietaryStatus } from "../lib/search.js";
import { useAppState } from "../state/useAppState.js";
import LiveProductCard from "./LiveProductCard.jsx";
import Screen from "./Screen.jsx";
import DietaryNotice from "./DietaryNotice.jsx";

const FEATURED_QUERIES = ["milk", "eggs", "bread"];

export default function KrogerStoreDetail({ storeId }) {
  const state = useAppState();
  const route = useLocation();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const location = useMapLocation(state.location);
  const { current, pending, error, refresh, receivedAt } =
    useKrogerSearch({
      location: location.place,
      radiusMi: state.radiusMi,
      storeId,
      dietary: state.dietary,
      queries: query ? [query] : FEATURED_QUERIES
    });
  const resultStore = current?.stores.find(
    (store) => store.id === storeId
  );
  const store =
    resultStore ||
    (route.state?.store?.id === storeId
      ? route.state.store
      : null);
  const results = resultStore?.results || [];
  const now = Math.max(state.now, receivedAt || 0);
  const checkedAt = results
    .map((result) => result.checkedAt)
    .filter(Boolean)
    .sort()[0];
  const products = [
    ...new Map(
      results.flatMap((result) =>
        (result.products || []).map((product) => [
          product.id,
          { product, result }
        ])
      )
    ).values()
  ].filter(
    ({ product }) => dietaryStatus(product, state.dietary).ok
  );

  return (
    <Screen
      title={store?.name || "Store items"}
      backTo="/stores">
      {store ? (
        <>
          <p className="meta">
            {miles(store.distance_mi)} away
          </p>
          <p>{store.address}</p>
          <Link
            className="text-link store-items-link"
            to="/stores"
            state={{ selectedStoreId: storeId }}>
            Show on map
          </Link>
        </>
      ) : null}
      <form
        className="search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(draft.trim());
        }}>
        <label
          className="sr-only"
          htmlFor="kroger-store-search">
          Search this store
        </label>
        <input
          id="kroger-store-search"
          value={draft}
          maxLength={120}
          placeholder="Search this store"
          onChange={(event) => setDraft(event.target.value)}
        />
        <button className="text-link" type="submit">
          Search
        </button>
      </form>
      <div className="section-title">
        <h2>
          {query
            ? `Results for “${query}”`
            : "Everyday essentials"}
        </h2>
        <button
          type="button"
          className="text-link"
          disabled={pending || !location.place}
          onClick={refresh}>
          Refresh prices
        </button>
      </div>
      {!query ? (
        <p className="muted">
          Browse milk, eggs, and bread, or search for other
          items at this store.
        </p>
      ) : (
        <button
          type="button"
          className="text-link"
          onClick={() => {
            setDraft("");
            setQuery("");
          }}>
          Browse essentials
        </button>
      )}
      {location.loading || pending ? (
        <p role="status">Loading store items...</p>
      ) : null}
      <DietaryNotice limited={current?.dietaryLimited} />
      {location.error || error ? (
        <div className="card" role="alert">
          <p>{location.error || error}</p>
          <button
            type="button"
            className="text-link"
            onClick={location.error ? location.retry : refresh}>
            Try again
          </button>
        </div>
      ) : null}
      {current && !resultStore ? (
        <p role="status">
          This store is no longer available within your search
          radius. <Link to="/stores">Find nearby stores</Link>.
        </p>
      ) : null}
      {results
        .filter((result) => result.error)
        .map((result) => (
          <p key={result.query} className="error" role="alert">
            {result.query}: {result.error}
          </p>
        ))}
      {results.some((result) => result.truncated) ? (
        <p className="fine">
          Results limited. Search with a brand or size to narrow
          the results.
        </p>
      ) : null}
      <div className="stack cards-grid" aria-busy={pending}>
        {products.map(({ product, result }) => (
          <LiveProductCard
            key={product.id}
            product={product}
            storeId={storeId}
            query={result.query}
            fresh={
              now - Date.parse(result.checkedAt) >= 0 &&
              now - Date.parse(result.checkedAt) < 5 * 60 * 1000
            }
          />
        ))}
      </div>
      {resultStore &&
      !products.length &&
      !results.some((result) => result.error) ? (
        <p className="muted">
          No items match this search and your dietary filters at
          this store. Try another item.
        </p>
      ) : null}
      {checkedAt ? (
        <p className="fine">
          Prices and stock can change before checkout. Updated{" "}
          {ageLabel(checkedAt, now)}.
        </p>
      ) : null}
    </Screen>
  );
}
