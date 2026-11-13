import { money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";
import AddItemToList from "./AddItemToList.jsx";

export default function LiveProductCard({
  product,
  storeId,
  query,
  fresh
}) {
  const { dietary } = useAppState();
  const exactQuery = [
    product.name,
    product.size_label === "Size unavailable"
      ? ""
      : product.size_label
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className="card search-product-card">
      {product.image_url ? (
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
        />
      ) : null}
      <div>
        <strong>{product.name}</strong>
        <p className="muted">{product.size_label}</p>
        <p>
          {fresh ? money(product.price) : "Refresh prices"}
          {" · "}
          {product.availability === "in_stock"
            ? "In stock"
            : product.availability === "out_of_stock"
              ? "Out of stock"
              : "Stock unconfirmed"}
        </p>
        {dietary.length ? (
          <p className="fine">
            Matches available dietary information. Check the
            package label.
          </p>
        ) : null}
        {product.dietary_facts ? (
          <a
            className="fine"
            href={product.dietary_facts.source_url}
            target="_blank"
            rel="noreferrer">
            Dietary data: Open Food Facts (ODbL)
          </a>
        ) : null}
        <AddItemToList
          request={{
            query:
              exactQuery.length <= 120 ? exactQuery : query,
            name: product.name,
            image_url: product.image_url,
            size_label: product.size_label,
            storeSelections: { [storeId]: product.id }
          }}
        />
      </div>
    </article>
  );
}
