import { useState } from "react";
import {
  Link,
  Navigate,
  useLocation,
  useNavigate
} from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { cityForZip } from "../data/mock.js";
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

  if (redirect) return redirect;

  function saveDevice() {
    finish({
      city: "San Luis Obispo",
      zip: "93405",
      source: "device",
      demoNote: false
    });
  }

  function allow() {
    setBusy(true);
    if (!navigator.geolocation) {
      saveDevice();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => saveDevice(),
      (error) => {
        setBusy(false);
        if (error.code === 1) {
          navigate("/location/zip", {
            state: { denied: true, from: route.state?.from }
          });
          return;
        }
        saveDevice();
      },
      { timeout: 2500, maximumAge: 600000 }
    );
  }

  return (
    <Screen title="Allow location" chrome={false}>
      <div className="auth">
        <div className="logo-mark" aria-hidden="true" />
        <h1>See stores near you</h1>
        <p className="lede">
          Allow location so Price Pantry can list grocery stores
          within a few miles.
        </p>
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
            Enter a ZIP code
          </Link>
        </div>
        <p className="fine">
          You can change this later in Profile.
        </p>
      </div>
    </Screen>
  );
}

export function EnterZip() {
  const { finish, redirect } = useFinish();
  const route = useLocation();
  const denied = Boolean(route.state?.denied);
  const [zip, setZip] = useState("93405");
  const [error, setError] = useState("");

  if (redirect) return redirect;

  function onSubmit(event) {
    event.preventDefault();
    if (!/^\d{5}$/.test(zip)) {
      setError("Enter a 5 digit ZIP code.");
      return;
    }
    const city = cityForZip(zip);
    finish({
      city: city || `Near ${zip}`,
      zip,
      source: "zip",
      demoNote: !city
    });
  }

  return (
    <Screen title="ZIP code" chrome={false}>
      <div className="auth">
        <div className="logo-mark" aria-hidden="true" />
        <h1>
          {denied ? "Location is off" : "Enter a ZIP code"}
        </h1>
        <p className="lede">
          {denied
            ? "The browser did not share your location. Enter a ZIP code to see nearby stores."
            : "Use a ZIP code if you would rather not share your location."}
        </p>
        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>ZIP code</span>
            <input
              inputMode="numeric"
              autoComplete="postal-code"
              maxLength={5}
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
            <button className="btn primary" type="submit">
              Show stores
            </button>
            <Link
              className="btn ghost"
              to="/location"
              state={route.state}>
              Try location again
            </Link>
          </div>
        </form>
      </div>
    </Screen>
  );
}
