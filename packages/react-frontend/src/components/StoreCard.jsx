import { Link } from "react-router-dom";
import { miles } from "../lib/format.js";

export default function StoreCard({ store, variant, age, to }) {
  return (
    <Link className="card store-card" to={to}>
      <div>
        <strong>{store.name}</strong>
        <p className="muted">
          {variant === "drive"
            ? `${miles(store.distance_mi)} | ${store.hours_label}`
            : `${store.hours_label} | prices ${age}`}
        </p>
      </div>
      {variant === "drive" ? (
        <div className="drive">
          <strong>{store.drive_minutes} min</strong>
          <span>drive</span>
        </div>
      ) : (
        <strong className="distance">
          {miles(store.distance_mi)}
        </strong>
      )}
    </Link>
  );
}
