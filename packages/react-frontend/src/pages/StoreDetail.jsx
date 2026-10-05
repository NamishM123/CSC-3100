import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { DEMO_NOW } from "../data/mock.js";
import { ageLabel, miles, money } from "../lib/format.js";
import { productMatchesQuery } from "../lib/search.js";
import { useAppState } from "../state/useAppState.js";

export default function StoreDetail() {
  const { storeId } = useParams();
  const { catalog } = useAppState();
  const [query, setQuery] = useState("");
  const store = catalog.stores.find(
    (entry) => entry.id === storeId
  );

  if (!store) {
    return (
      <Screen title="Store" backTo="/stores">
        <div className="empty">
          <h2>Store not found</h2>
          <Link className="btn primary" to="/stores">
            All stores
          </Link>
        </div>
      </Screen>
    );
  }

  const rows = catalog.prices
    .filter((row) => row.store_id === store.id)
    .map((row) => ({
      ...row,
      product: catalog.products.find(
        (product) => product.id === row.product_id
      )
    }))
    .filter(
      (row) =>
        row.product && productMatchesQuery(row.product, query)
    )
    .sort((a, b) =>
      a.product.name.localeCompare(b.product.name)
    );
  const newest = [...rows].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at)
  )[0];

  return (
    <Screen title={store.name} backTo="/stores">
      <p className="meta">
        {miles(store.distance_mi)} | {store.hours_label}
      </p>
      <p>
        {store.address}
        <br />
        {store.city}, {store.state} {store.zip}
      </p>
      <p className="muted">
        {store.drive_minutes} min drive
        {newest
          ? ` | prices updated ${ageLabel(newest.updated_at, DEMO_NOW)}`
          : ""}
      </p>
      <form
        className="search"
        role="search"
        onSubmit={(event) => event.preventDefault()}>
        <label className="sr-only" htmlFor="store-search">
          Search this store
        </label>
        <input
          id="store-search"
          value={query}
          placeholder="Search this store"
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <div className="stack">
        {rows.map((row) => (
          <Link
            key={row.id}
            className="card price-row"
            to={`/product/${row.product.id}`}>
            <div>
              <strong>{row.product.name}</strong>
              <p className="muted">
                {row.in_stock ? "In stock" : "Out of stock"} |
                updated {ageLabel(row.updated_at, DEMO_NOW)}
              </p>
            </div>
            <div className="price-col">
              <strong>
                {row.in_stock
                  ? money(row.price)
                  : "Unavailable"}
              </strong>
              <span>{row.product.list_unit}</span>
            </div>
          </Link>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="muted">
          No items match that search at this store.
        </p>
      ) : null}
    </Screen>
  );
}
