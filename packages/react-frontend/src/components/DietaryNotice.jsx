import { useAppState } from "../state/useAppState.js";

export default function DietaryNotice({ limited = false }) {
  const { dietary } = useAppState();
  if (!dietary.length) return null;
  return (
    <p className="fine dietary-notice" role="status">
      Filtering for {dietary.join(", ")}. Products with
      conflicts or insufficient dietary information are hidden
      from matches and excluded from totals. Check package
      labels for allergies.
      {limited
        ? " Some barcode checks could not finish; those products need a supporting claim to appear. Try refreshing later."
        : ""}
    </p>
  );
}
