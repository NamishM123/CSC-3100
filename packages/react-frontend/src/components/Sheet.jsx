import { createContext, useContext, useEffect } from "react";
import { createPortal } from "react-dom";

const OverlayContext = createContext(null);

export function OverlayProvider({ node, children }) {
  return (
    <OverlayContext.Provider value={node}>
      {children}
    </OverlayContext.Provider>
  );
}

export default function Sheet({ title, onClose, children }) {
  const node = useContext(OverlayContext);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!node) return null;

  return createPortal(
    <div className="sheet-layer">
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>,
    node
  );
}
