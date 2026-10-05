import { Link } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { useAppState } from "../state/useAppState.js";

export default function Missing() {
  const { user } = useAppState();
  return (
    <Screen title="Not found" chrome={false}>
      <div className="empty">
        <h2>Page not found</h2>
        <p>That screen is not part of Price Pantry.</p>
        <Link
          className="btn primary"
          to={user ? "/" : "/sign-in"}>
          Go back
        </Link>
      </div>
    </Screen>
  );
}
