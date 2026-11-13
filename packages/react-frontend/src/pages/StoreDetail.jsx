import { useState } from "react";
import {
  Link,
  useParams,
  useSearchParams
} from "react-router-dom";
import Screen from "../components/Screen.jsx";
import KrogerStoreDetail from "../components/KrogerStoreDetail.jsx";
import CommunityStoreDetail from "../components/CommunityStoreDetail.jsx";
import WeeklyAdDetail from "../components/WeeklyAdDetail.jsx";
import DietaryNotice from "../components/DietaryNotice.jsx";
import { priceClock } from "../lib/catalog.js";
import { ageLabel, miles, money } from "../lib/format.js";
import {
  productMatchesQuery,
  dietaryStatus
} from "../lib/search.js";
import { listedUnit } from "../lib/compare.js";
import { useAppState } from "../state/useAppState.js";

export default function StoreDetail() {
  const { storeId } = useParams();
  const [params] = useSearchParams();
  const { catalog, dietary, includeMember } = useAppState();
  const [query, setQuery] = useState("");
  const store = catalog.stores.find(
    (entry) =>
      entry.id === storeId ||
      entry.alternate_ids?.includes(storeId)
  );

  if (store?.source === "weekly-ads")
    return <WeeklyAdDetail key={store.id} storeId={store.id} />;
  if (store?.source === "kroger")
    return (
      <KrogerStoreDetail key={store.id} storeId={store.id} />
    );
  if (store?.source === "openstreetmap")
    return (
      <CommunityStoreDetail key={store.id} storeId={store.id} />
    );
  if (params.get("source") === "kroger") {
    return (
      <KrogerStoreDetail key={storeId} storeId={storeId} />
    );
  }
  if (params.get("source") === "weekly-ads")
    return <WeeklyAdDetail key={storeId} provider={storeId} />;
  if (params.get("source") === "openstreetmap")
    return (
      <CommunityStoreDetail key={storeId} storeId={storeId} />
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
        row.product &&
        productMatchesQuery(row.product, query) &&
        dietaryStatus(row.product, dietary).ok
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
          ? ` | prices updated ${ageLabel(newest.updated_at, priceClock(newest))}`
          : ""}
      </p>
      <DietaryNotice />
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
      <div className="stack cards-grid">
        {rows.map((row) => (
          <Link
            key={row.id}
            className="card price-row"
            to={`/product/${row.product.id}`}>
            <div>
              <strong>{row.product.name}</strong>
              <p className="muted">
                {row.in_stock ? "In stock" : "Out of stock"} |
                updated{" "}
                {ageLabel(row.updated_at, priceClock(row))}
              </p>
            </div>
            <div className="price-col">
              <strong>
                {row.in_stock
                  ? money(listedUnit(row, includeMember))
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
