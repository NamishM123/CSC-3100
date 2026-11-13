import { Link, useLocation } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import MfaSettings from "../components/MfaSettings.jsx";
import { safeDest } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

export default function AccountSecurity() {
  const { location, mfaFactors } = useAppState();
  const route = useLocation();
  const destination = safeDest(route.state?.from);

  return (
    <Screen title="Account security" chrome={false}>
      <div className="auth stack">
        <h1>Your account is ready</h1>
        <p className="lede">
          Add an authenticator app for an extra sign-in check.
          Codes work without email or text messages. You can
          also set this up later in Profile.
        </p>
        <MfaSettings />
        <Link
          className="btn primary"
          to={location ? destination || "/" : "/location"}
          state={{ from: destination }}
          replace>
          {mfaFactors.length ? "Continue" : "Skip for now"}
        </Link>
      </div>
    </Screen>
  );
}
