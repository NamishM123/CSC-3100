export default function ProductHeader({ product, title }) {
  return (
    <div className="product-head">
      <div className="photo">
        <img
          src={product.image_url}
          alt={product.name}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      </div>
      <div>
        <h2 className="product-title">{title}</h2>
        <p className="muted">
          {product.category} | {product.size_label}
        </p>
        <div className="chips tight">
          {(product.dietary || []).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
