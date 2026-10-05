import { useState } from "react";
import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import StoreCard from "../components/StoreCard.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { ageOld } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

export default function Stores() {
  const { catalog, location } = useAppState();
  const [mode, setMode] = useState("map");
  const [note, setNote] = useState("");
  const stores = [...catalog.stores].sort(
    (a, b) => a.distance_mi - b.distance_mi
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
        <h1>Stores near {location?.zip}</h1>
      </div>
      <div
        className="segment"
        role="tablist"
        aria-label="Store view">
        <button
          type="button"
          className={mode === "map" ? "on" : ""}
          onClick={() => setMode("map")}>
          Map
        </button>
        <button
          type="button"
          className={mode === "list" ? "on" : ""}
          onClick={() => setMode("list")}>
          List
        </button>
      </div>
      {mode === "map" ? (
        <div className="map">
          <span className="map-label">Map</span>
          {stores.map((store, index) => {
            const chain = catalog.store_chains.find(
              (entry) => entry.id === store.chain_id
            );
            const left =
              stores.length === 1
                ? 50
                : 16 + (index * 68) / (stores.length - 1);
            return (
              <Link
                key={store.id}
                className="pin"
                style={{ left: `${left}%` }}
                aria-label={store.name}
                to={`/stores/${store.id}`}>
                {chain?.code || store.name.slice(0, 2)}
              </Link>
            );
          })}
        </div>
      ) : null}
      <div className="stack">
        {stores.map((store) => (
          <StoreCard
            key={store.id}
            store={store}
            variant="distance"
            age={ageFor(store.id)}
            to={`/stores/${store.id}`}
          />
        ))}
      </div>
      <button
        type="button"
        className="btn ghost refresh"
        onClick={() =>
          setNote("Store list reloaded from the demo catalog.")
        }>
        Refresh stores
      </button>
      {note ? <p className="fine">{note}</p> : null}
    </Screen>
  );
}
