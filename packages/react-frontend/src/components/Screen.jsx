import { useEffect } from "react";
import { Link } from "react-router-dom";

export default function Screen({
  title,
  backTo,
  chrome = true,
  children,
  dock
}) {
  useEffect(() => {
    document.title = title
      ? `${title} · Price Pantry`
      : "Price Pantry";
  }, [title]);

  return (
    <div className="screen">
      <div className="screen-body">
        {chrome ? (
          <div className="topbar">
            {backTo ? (
              <Link className="back" to={backTo}>
                {"< Back"}
              </Link>
            ) : null}
            {title ? <h1>{title}</h1> : null}
          </div>
        ) : null}
        {children}
      </div>
      {dock ? <div className="dock">{dock}</div> : null}
    </div>
  );
}
