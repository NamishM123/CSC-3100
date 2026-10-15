import { useState } from "react";

export default function ProductImage({
    src,
    alt,
    className = "",
}) {
    const [failed, setFailed] = useState(false);

    return (
        <div className={`proudct-image ${className}`}>
            {!failed && src ? (
                <img
                    src={src}
                    alt={alt}
                    loading="lazy"
                    onError={() => setFailed(true)}
                />
            ) : (
                <div
                    className="product-image_placeholder"
                    role="img"
                    aria-label={`${alt || "Product"} image unavailable`}
                >
                    <span aria-hidden="true">$</span>
                </div>
            )}
        </div>
    );
}