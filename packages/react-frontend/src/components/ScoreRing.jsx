export default function ScoreRing({ score }) {
  const value = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : 0;
  const rating =
    value >= 85
      ? { label: "Excellent", tone: "excellent" }
      : value >= 65
        ? { label: "Good", tone: "good" }
        : value >= 40
          ? { label: "Fair", tone: "fair" }
          : { label: "Poor match", tone: "poor" };

  return (
    <div
      className={`score-ring ${rating.tone}`}
      role="img"
      aria-label={`${value} out of 100: ${rating.label}`}>
      <div className="score-ring-dial" aria-hidden="true">
        <svg viewBox="0 0 80 80" focusable="false">
          <circle
            className="score-ring-track"
            cx="40"
            cy="40"
            r="34"
          />
          <circle
            className="score-ring-progress"
            cx="40"
            cy="40"
            r="34"
            pathLength="100"
            strokeDasharray={`${value} 100`}
          />
        </svg>
        <span className="score-ring-value">
          <strong>{value}</strong>
          <span>/100</span>
        </span>
      </div>
      <span className="score-ring-label" aria-hidden="true">
        {rating.label}
      </span>
    </div>
  );
}
