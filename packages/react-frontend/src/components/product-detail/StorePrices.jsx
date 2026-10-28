import { DEMO_NOW } from "../../data/mock.js";
import { ageOld, isStale, miles } from "../../lib/format.js";
import StorePriceCard from "../StorePriceCard.jsx";

export default function StorePrices({
  product,
  rows,
  hideStale,
  radiusMi,
  onShowOlder,
  onSelect
}) {
  const visible = hideStale
    ? rows.filter((row) => !isStale(row.updated_at, DEMO_NOW))
    : rows;
  const cheapestId = visible[0]?.id;

  return (
    <div className="product-prices">
      <div className="section-title"><h2>Price by store</h2></div>
      {hideStale ? (
        <button type="button" className="text-link inline" onClick={onShowOlder}>
          Show older prices
        </button>
      ) : null}
      <div className="stack cards-grid">
        {visible.map((row) => {
          const stale = isStale(row.updated_at, DEMO_NOW);
          return (
            <StorePriceCard
              key={row.id}
              row={row}
              product={product}
              cheapest={row.id === cheapestId}
              stale={stale}
              staleLabel={ageOld(row.updated_at, DEMO_NOW)}
              details={miles(row.store.distance_mi)}
              onClick={() => onSelect(row, stale)}
            />
          );
        })}
      </div>
      {visible.length === 0 ? (
        <p className="muted">No fresh prices at stores within {radiusMi} mi.</p>
      ) : null}
    </div>
  );
}
