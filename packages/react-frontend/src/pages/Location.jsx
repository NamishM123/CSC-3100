import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate
} from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { coordinatesOf, lookupZip } from "../lib/geo.js";
import { safeDest } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";

function useFinish() {
  const route = useLocation();
  const { setLocation } = useAppState();
  const [leaving, setLeaving] = useState(false);

  function finish(place) {
    setLocation(place);
    setLeaving(true);
  }

  const redirect = leaving ? (
    <Navigate to={safeDest(route.state?.from) || "/"} replace />
  ) : null;

  return { finish, redirect };
}

export function AllowLocation() {
  const { finish, redirect } = useFinish();
  const navigate = useNavigate();
  const route = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (redirect) return redirect;

  function saveDevice(position) {
    const coordinates = coordinatesOf(position.coords);
    if (!coordinates) {
      setBusy(false);
      setError(
        "No location was returned. Try again or enter a ZIP code."
      );
      return;
    }
    finish({
      ...coordinates,
      city: "Your location",
      zip: null,
      source: "device",
      accuracy: position.coords.accuracy,
      demoNote: false
    });
  }

  function allow() {
    setBusy(true);
    setError("");
    if (!navigator.geolocation) {
      setBusy(false);
      setError(
        "This browser cannot share your location. Enter a ZIP code instead."
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      saveDevice,
      (error) => {
        setBusy(false);
        if (error.code === 1) {
          navigate("/location/zip", {
            state: { denied: true, from: route.state?.from }
          });
          return;
        }
        setError(
          "Unable to get your location. Try again or enter a ZIP code."
        );
      },
      {
        timeout: 10000,
        maximumAge: 300000,
        enableHighAccuracy: true
      }
    );
  }

  return (
    <Screen title="Allow location" chrome={false}>
      <div className="auth">
        <div className="auth-brand">
          <div className="logo-mark" aria-hidden="true" />
          <h1>Find groceries near you</h1>
          <p className="lede">
            Your choice helps us find nearby stores.
          </p>
        </div>
        <div className="auth-panel">
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="actions">
            <button
              className="btn primary"
              type="button"
              disabled={busy}
              onClick={allow}>
              {busy ? "Checking location..." : "Allow location"}
            </button>
            <Link
              className="btn ghost"
              to="/location/zip"
              state={route.state}>
              Use ZIP code instead
            </Link>
          </div>
          <p className="fine">
            You can change your location anytime in Profile.
          </p>
        </div>
      </div>
    </Screen>
  );
}

export function EnterZip() {
  const { finish, redirect } = useFinish();
  const route = useLocation();
  const denied = Boolean(route.state?.denied);
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (redirect) return redirect;

  async function onSubmit(event) {
    event.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a 5 digit ZIP code.");
      return;
    }
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      finish(await lookupZip(zip));
    } catch (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <Screen title="ZIP code" chrome={false}>
      <div className="auth">
        <div className="auth-brand">
          <div className="logo-mark" aria-hidden="true" />
          <h1>
            {denied ? "Location is off" : "Enter a ZIP code"}
          </h1>
          <p className="lede">
            {denied
              ? "The browser did not share your location. Enter a ZIP code to see nearby stores."
              : "Use a ZIP code to see nearby stores."}
          </p>
        </div>
        <div className="auth-panel">
          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              <span>ZIP code</span>
              <input
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={5}
                placeholder="e.g. 93405"
                required
                disabled={busy}
                value={zip}
                onChange={(event) => {
                  setZip(
                    event.target.value
                      .replace(/\D/g, "")
                      .slice(0, 5)
                  );
                  setError("");
                }}
              />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <div className="actions">
              <button
                className="btn primary"
                type="submit"
                disabled={busy}>
                {busy ? "Finding location..." : "Show Stores"}
              </button>
              <Link
                className="btn ghost"
                to="/location"
                state={route.state}>
                Use Location Instead
              </Link>
            </div>
          </form>
        </div>
      </div>
    </Screen>
  );
}
