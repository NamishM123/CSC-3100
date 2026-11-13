import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useOpenData } from "../hooks/useOpenData.js";
import { useMapLocation } from "../hooks/useMapLocation.js";
import { distanceMiles } from "../lib/geo.js";
import {
  dietaryStatus,
  productMatchesQuery
} from "../lib/search.js";
import { miles, money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";
import Screen from "./Screen.jsx";
import DietaryNotice from "./DietaryNotice.jsx";
import AddItemToList from "./AddItemToList.jsx";

export default function CommunityStoreDetail({ storeId }) {
  const state = useAppState();
  const route = useLocation();
  const [query, setQuery] = useState("");
  const location = useMapLocation(state.location);
  const { data, loading, error, retry } = useOpenData({
    action: "inventory",
    storeId,
    dietary: state.dietary
  });
  const store =
    data?.store ||
    (route.state?.store?.id === storeId
      ? route.state.store
      : null);
  const distance = distanceMiles(location.place, store);
  const offers = (data?.offers || []).filter(
    (offer) =>
      productMatchesQuery(offer, query) &&
      dietaryStatus(offer, state.dietary).ok
  );
  return (
    <Screen
      title={store?.name || "Store items"}
      backTo="/stores">
      {store ? (
        <>
          <p>
            {[store.address, store.city, store.state, store.zip]
              .filter(Boolean)
              .join(", ")}
          </p>
          {distance != null ? (
            <p className="meta">{miles(distance)} away</p>
          ) : null}
          <Link
            className="text-link store-items-link"
            to="/stores"
            state={{ selectedStoreId: storeId }}>
            Show on map
          </Link>
        </>
      ) : null}
      <div className="section-title">
        <h2>Community price reports</h2>
        <button
          className="text-link"
          type="button"
          disabled={loading}
          onClick={retry}>
          Refresh
        </button>
      </div>
      <p className="muted">
        Reported prices from the last 90 days. These are dated
        observations, and do not confirm today&apos;s price or
        stock.
      </p>
      <DietaryNotice limited={data?.dietaryLimited} />
      <form
        className="search"
        role="search"
        onSubmit={(event) => event.preventDefault()}>
        <label
          className="sr-only"
          htmlFor="community-store-search">
          Search reported items
        </label>
        <input
          id="community-store-search"
          placeholder="Search reported items"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      {loading ? (
        <p role="status">Loading community price reports...</p>
      ) : null}
      {error ? (
        <div className="card" role="alert">
          <p>{error}</p>
          <button
            className="text-link"
            type="button"
            onClick={retry}>
            Try again
          </button>
        </div>
      ) : null}
      <div className="stack cards-grid" aria-busy={loading}>
        {offers.map((offer) => (
          <article key={offer.id} className="card stack">
            <div className="price-row">
              <strong>{offer.name}</strong>
              <div className="price-col">
                <strong>{money(offer.price)}</strong>
                <span>{offer.unit}</span>
              </div>
            </div>
            <p className="muted">
              Reported {offer.observed_on} · Stock unconfirmed
              {offer.is_discounted
                ? " · Discounted price; conditions may apply"
                : ""}
            </p>
            <a
              className="text-link"
              href={offer.source_url}
              target="_blank"
              rel="noreferrer">
              View price report
            </a>
            {offer.dietary_facts ? (
              <a
                className="fine"
                href={offer.dietary_facts.source_url}
                target="_blank"
                rel="noreferrer">
                Dietary data: Open Food Facts (ODbL)
              </a>
            ) : null}
            <AddItemToList
              request={{
                query: offer.name.slice(0, 120),
                name: offer.name
              }}
            />
          </article>
        ))}
      </div>
      {data && !offers.length ? (
        <p className="muted">
          {data.offers.length
            ? "No reported items match your search and dietary filters."
            : "No recent community price reports for this store yet. Current inventory is not available from this source."}
        </p>
      ) : null}
      {data?.limited ? (
        <p className="fine">
          Showing the latest 50 price reports. Search filters
          these loaded reports.
        </p>
      ) : null}
      <p className="fine">
        Locations:{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer">
          OpenStreetMap contributors
        </a>
        . Prices:{" "}
        <a
          href="https://prices.openfoodfacts.org"
          target="_blank"
          rel="noreferrer">
          Open Prices / Open Food Facts
        </a>{" "}
        (ODbL). Reports are kept separate from confirmed live
        store totals.
      </p>
    </Screen>
  );
}
