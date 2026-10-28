import PriceChart from "../PriceChart.jsx";
import { money, shortDate } from "../../lib/format.js";

export default function PriceHistory({ history, store }) {
  return (
    <div className="product-history">
      <div className="section-title">
        <h2>Price history (30 days)</h2>
        <span className="muted">{store?.name}</span>
      </div>
      {history.length ? (
        <div className="chart">
          <PriceChart points={history} />
          <div className="chart-labels">
            <span>{shortDate(history[0].recorded_on)}: {money(history[0].price)}</span>
            <span className="today">Today: {money(history[history.length - 1].price)}</span>
          </div>
        </div>
      ) : <p className="muted">No 30 day history for this store yet.</p>}
    </div>
  );
}
