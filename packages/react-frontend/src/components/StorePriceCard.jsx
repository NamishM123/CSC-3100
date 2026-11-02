import { money, unitCaption } from "../lib/format.js";

export default function StorePriceCard({
  as: Component = "button",
  row,
  product,
  cheapest,
  stale,
  staleLabel,
  details,
  to,
  onClick
}) {
  const interaction = Component === "button" ? { type: "button", onClick } : { to };

  return (
    <Component className="card price-row" {...interaction}>
      <div>
        <div className="name-line">
          <strong>{row.store.name}</strong>
          {cheapest ? <span className="badge cheap">Cheapest</span> : null}
          {row.is_sale ? <span className="badge sale">Sale</span> : null}
          {stale ? <span className="badge old">{staleLabel}</span> : null}
        </div>
        <p className="muted">{details}</p>
      </div>
      <div className="price-col">
        <strong>{money(row.price)}</strong>
        <span>{unitCaption(row, product)}</span>
      </div>
    </Component>
  );
}
