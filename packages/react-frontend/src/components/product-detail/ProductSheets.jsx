import Sheet from "../Sheet.jsx";
import { priceClock } from "../../lib/catalog.js";
import { ageLabel, money } from "../../lib/format.js";

export function StalePriceSheet({
  row,
  product,
  onClose,
  onShowFresh
}) {
  if (!row) return null;
  return (
    <Sheet title="This price is old" onClose={onClose}>
      <p>
        {row.store.name} last checked {product.name}{" "}
        {ageLabel(row.updated_at, priceClock(row))}. The price
        may have changed.
      </p>
      <div className="actions">
        <button
          type="button"
          className="btn primary"
          onClick={onShowFresh}>
          Show fresh prices
        </button>
        <button
          type="button"
          className="btn ghost"
          onClick={onClose}>
          Keep browsing
        </button>
      </div>
    </Sheet>
  );
}

export function PriceAlertSheet({
  open,
  product,
  location,
  quote,
  fallbackPrice,
  saved,
  onClose,
  onSave
}) {
  if (!open) return null;
  const below = quote?.unit ?? fallbackPrice;
  return (
    <Sheet title="Price alert" onClose={onClose}>
      <p>
        Save an alert for {product.name} near {location?.zip}.
        We will flag it on this device if the lowest fresh price
        drops below {money(below)}.
      </p>
      <button
        type="button"
        className="btn primary sheet-btn"
        onClick={() => onSave(below)}>
        {saved ? "Update alert" : "Save alert"}
      </button>
    </Sheet>
  );
}
