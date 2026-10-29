import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import StoreCard from "../components/StoreCard.jsx";
import StoreMap from "../components/StoreMap.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { ageOld } from "../lib/format.js";
import { nearbyStores } from "../lib/geo.js";
import { useMapLocation } from "../hooks/useMapLocation.js";
import { useAppState } from "../state/useAppState.js";

export default function Stores() {
  const { catalog, location, radiusMi } = useAppState();
  const [mode, setMode] = useState("map");
  const { place, loading, error, retry } =
    useMapLocation(location);
  const stores = useMemo(
    () => nearbyStores(catalog.stores, place, radiusMi),
    [catalog.stores, place, radiusMi]
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
      {catalog.storesAreDemo ? (
        <p className="fine store-data-note">
          Sample store locations are available in San Luis
          Obispo. The map follows your selected location.
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
              sample={catalog.storesAreDemo}
            />
          ) : null}
          <div className="stack cards-grid">
            {stores.map((store) => (
              <StoreCard
                key={store.id}
                store={store}
                variant="distance"
                age={ageFor(store.id)}
                to={`/stores/${store.id}`}
              />
            ))}
            {stores.length === 0 ? (
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
