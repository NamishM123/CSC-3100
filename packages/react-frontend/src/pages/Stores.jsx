import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import StoreCard from "../components/StoreCard.jsx";
import StoreMap from "../components/StoreMap.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { ageOld } from "../lib/format.js";
import { nearbyStores } from "../lib/geo.js";
import { useMapLocation } from "../hooks/useMapLocation.js";
import { useKrogerLocations } from "../hooks/useKrogerLocations.js";
import { useAppState } from "../state/useAppState.js";
import { storeItemsPath } from "../lib/storeLinks.js";

export default function Stores() {
  const { catalog, location, radiusMi } = useAppState();
  const route = useLocation();
  const [mode, setMode] = useState("map");
  const [selectedStoreId, setSelectedStoreId] = useState(
    route.state?.selectedStoreId || null
  );
  const [focusRequest, setFocusRequest] = useState(0);
  const { place, loading, error, retry } =
    useMapLocation(location);
  const kroger = useKrogerLocations(place, radiusMi);
  const stores = useMemo(
    () =>
      nearbyStores(
        [...catalog.stores, ...kroger.stores],
        place,
        radiusMi
      ),
    [catalog.stores, kroger.stores, place, radiusMi]
  );

  function ageFor(storeId) {
    const times = catalog.prices
      .filter(
        (row) => row.store_id === storeId && row.updated_at
      )
      .map((row) => row.updated_at)
      .sort();
    return times[0]
      ? ageOld(times[0], DEMO_NOW)
      : "age unavailable";
  }

  return (
    <Screen title="Stores" chrome={false}>
      <div className="list-head">
        <h1>Stores near {location?.zip || "your location"}</h1>
        <Link
          className="text-link"
          to="/location/zip"
          state={{ from: "/stores" }}>
          Change location
        </Link>
      </div>
      <p className="fine">
        Within {radiusMi} miles. Distances are straight-line
        estimates.
      </p>
      {kroger.loading ? (
        <p className="fine" role="status">
          Finding nearby Kroger family stores...
        </p>
      ) : null}
      {kroger.error ? (
        <div className="card" role="alert">
          <p>{kroger.error}</p>
          <button
            type="button"
            className="text-link"
            onClick={kroger.retry}>
            Retry Kroger stores
          </button>
        </div>
      ) : null}
      {kroger.ready && kroger.stores.length === 0 ? (
        <p className="fine" role="status">
          No Kroger family stores were found within {radiusMi}{" "}
          miles. Try a larger search radius in your profile.
        </p>
      ) : null}
      {kroger.limitedStores ? (
        <p className="fine">
          Showing the nearest {kroger.maxStores} Kroger family
          stores.
        </p>
      ) : null}
      <div
        className="segment"
        role="tablist"
        aria-label="Store view">
        <button
          id="stores-map-tab"
          type="button"
          role="tab"
          aria-selected={mode === "map"}
          aria-controls="stores-view"
          className={mode === "map" ? "on" : ""}
          onClick={() => setMode("map")}>
          Map
        </button>
        <button
          id="stores-list-tab"
          type="button"
          role="tab"
          aria-selected={mode === "list"}
          aria-controls="stores-view"
          className={mode === "list" ? "on" : ""}
          onClick={() => setMode("list")}>
          List
        </button>
      </div>
      {loading ? (
        <p className="muted" role="status">
          Finding your map location...
        </p>
      ) : null}
      {error || (!place && !loading) ? (
        <div
          className="card store-map-unavailable"
          role="alert">
          <p>{error || "Choose a location to load the map."}</p>
          {error ? (
            <button
              type="button"
              className="text-link"
              onClick={retry}>
              Try again
            </button>
          ) : null}
          <Link to="/location/zip" state={{ from: "/stores" }}>
            Enter a ZIP code
          </Link>
        </div>
      ) : null}
      {place ? (
        <div
          id="stores-view"
          role="tabpanel"
          aria-labelledby={
            mode === "map"
              ? "stores-map-tab"
              : "stores-list-tab"
          }
          className={
            mode === "map"
              ? "stores-layout map-mode"
              : "stores-layout list-mode"
          }>
          {mode === "map" ? (
            <StoreMap
              place={place}
              stores={stores}
              radiusMi={radiusMi}
              selectedStoreId={selectedStoreId}
              focusRequest={focusRequest}
              onSelectStore={setSelectedStoreId}
            />
          ) : null}
          <div className="stack cards-grid">
            {stores.map((store) => (
              <div
                key={store.id}
                className={
                  selectedStoreId === store.id
                    ? "store-result selected"
                    : "store-result"
                }>
                <StoreCard
                  store={store}
                  variant="distance"
                  age={ageFor(store.id)}
                  to={storeItemsPath(store)}
                  onSelect={() => {
                    setSelectedStoreId(store.id);
                    setMode("map");
                    setFocusRequest((value) => value + 1);
                  }}
                />
              </div>
            ))}
            {stores.length === 0 &&
            !kroger.loading &&
            !kroger.error ? (
              <div className="card empty">
                <h2>No stores in this area yet</h2>
                <p className="muted">
                  No available store locations are within{" "}
                  {radiusMi} miles.
                </p>
                <Link className="text-link" to="/profile">
                  Change search radius
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Screen>
  );
}
