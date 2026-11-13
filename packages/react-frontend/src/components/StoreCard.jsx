import { Link } from "react-router-dom";
import { miles } from "../lib/format.js";

export default function StoreCard({
  store,
  variant,
  age,
  to,
  onSelect
}) {
  return (
    <article className="card store-card">
      <div className="store-card-details">
        {onSelect ? (
          <button
            type="button"
            className="store-name"
            aria-label={`Show ${store.name} on map`}
            onClick={onSelect}>
            {store.name}
          </button>
        ) : (
          <Link
            className="store-name"
            to="/stores"
            state={{ selectedStoreId: store.id }}>
            {store.name}
          </Link>
        )}
        <p className="muted">
          {[store.address, store.city]
            .filter(Boolean)
            .join(", ")}
        </p>
        <p className="muted">
          {store.source === "demo"
            ? "Built-in sample store · Illustrative location and prices"
            : store.source === "kroger"
              ? "Kroger family store"
              : store.source === "weekly-ads"
                ? "Weekly-ad prices · Stock unconfirmed"
                : store.source === "openstreetmap"
                  ? "Community store · View reported prices"
                  : variant === "drive"
                    ? `${miles(store.distance_mi)} | ${store.hours_label}`
                    : `${store.hours_label} | prices ${age}`}
        </p>
        <Link
          className="text-link store-items-link"
          to={to}
          state={{ store }}
          aria-label={`View items at ${store.name}`}>
          View store items
        </Link>
      </div>
      {variant === "drive" &&
      Number.isFinite(store.drive_minutes) ? (
        <div className="drive">
          <strong>{store.drive_minutes} min</strong>
          <span>drive</span>
        </div>
      ) : (
        <strong className="distance">
          {miles(store.distance_mi)}
        </strong>
      )}
    </article>
  );
}
