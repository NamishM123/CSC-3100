import { money } from "../lib/format.js";

export default function PriceChart({ points }) {
  if (!points.length) return null;
  const width = 320;
  const height = 112;
  const values = points.map((point) => point.price);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.35 || 0.02;
  const low = min - pad;
  const high = max + pad;
  const coords = points.map((point, index) => {
    const x =
      points.length === 1
        ? width / 2
        : (index / (points.length - 1)) * (width - 16) + 8;
    const y =
      10 +
      ((high - point.price) / (high - low)) * (height - 24);
    return [x, y];
  });
  const path = coords
    .map(
      (coord, index) =>
        `${index === 0 ? "M" : "L"}${coord[0]},${coord[1]}`
    )
    .join(" ");
  const first = points[0].price;
  const last = points[points.length - 1].price;

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Price moved from ${money(first)} to ${money(last)} over 30 days`}>
      <path
        d={path}
        fill="none"
        stroke="#2E7D32"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
