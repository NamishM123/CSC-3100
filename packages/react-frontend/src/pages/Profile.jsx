import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import MfaSettings from "../components/MfaSettings.jsx";
import NotificationSettings from "../components/NotificationSettings.jsx";
import { DIETARY_FILTERS } from "../data/mock.js";
import { money } from "../lib/format.js";
import { useAppState } from "../state/useAppState.js";
import { authErrorMessage } from "../lib/auth.js";

const RADIUS_OPTIONS = [1, 5, 10, 15];

export default function Profile() {
  const state = useAppState();
  const navigate = useNavigate();
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [customRadius, setCustomRadius] = useState("");
  const [customSelected, setCustomSelected] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const initial = (state.user?.name || "P")
    .slice(0, 1)
    .toUpperCase();

  async function logOut(everywhere = false) {
    setSignOutError("");
    setSigningOut(true);
    try {
      if (everywhere) await state.signOutEverywhere();
      else await state.signOut();
      navigate("/sign-in", { replace: true });
    } catch (error) {
      setSignOutError(authErrorMessage(error));
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen
      title="Profile"
      chrome={false}
      className="profile-page">
      <div className="profile-head">
        <span className="avatar large">{initial}</span>
        <div>
          <h1>{state.user?.name}</h1>
          <p className="muted">{state.user?.email}</p>
        </div>
      </div>

      <MfaSettings />

      <section className="profile-block">
        <h2>Location</h2>
        <p>
          {state.location?.city} {state.location?.zip}
        </p>
        <button
          type="button"
          className="text-link"
          onClick={() => navigate("/location/zip")}>
          Change ZIP
        </button>
        <p className="fine">
          Live Kroger stores and community grocery locations
          follow your selected location.
        </p>
      </section>

      <section className="profile-block">
        <h2>Search radius</h2>
        <p>{state.radiusMi} miles</p>
        <button
          type="button"
          className="text-link"
          onClick={() => setRadiusOpen(true)}>
          Change radius
        </button>
      </section>

      <section className="profile-block row">
        <div>
          <h2>Safeway Club</h2>
          <p className="muted">
            Use marked member prices in catalog prices and
            totals. This does not link a loyalty account or
            change Kroger prices.
          </p>
        </div>
        <button
          type="button"
          className={
            state.includeMember ? "switch on" : "switch"
          }
          role="switch"
          aria-checked={state.includeMember}
          aria-label="Include member prices"
          onClick={() =>
            state.setIncludeMember(!state.includeMember)
          }>
          <span />
        </button>
      </section>

      <NotificationSettings />

      <section className="profile-block">
        <h2>Dietary filters</h2>
        <div className="chips">
          {DIETARY_FILTERS.map((filter) => (
            <button
              key={filter}
              type="button"
              className={
                state.dietary.includes(filter)
                  ? "chip on"
                  : "chip"
              }
              aria-pressed={state.dietary.includes(filter)}
              onClick={() => state.toggleDietary(filter)}>
              {filter}
            </button>
          ))}
        </div>
        <p className="fine">
          Filters apply to browsing and recommendations.
          Products need a supporting dietary claim or ingredient
          data; conflicts and unknowns are excluded. Barcode
          checks use Open Food Facts when available. Check
          package labels for allergies.
        </p>
      </section>

      <section className="profile-block">
        <h2>Price alerts</h2>
        {state.alerts.length === 0 ? (
          <p className="muted">No price alerts yet.</p>
        ) : (
          <ul className="plain-list">
            {state.alerts.map((alert) => (
              <li key={alert.product_id}>
                {alert.name} below {money(alert.below)} near{" "}
                {alert.zip}
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    state.removeAlert(alert.product_id)
                  }>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="profile-block">
        <div className="section-title">
          <h2>Recent searches</h2>
          {state.recentSearches.length ? (
            <button
              type="button"
              className="text-link"
              onClick={state.clearSearches}>
              Clear
            </button>
          ) : null}
        </div>
        {state.recentSearches.length === 0 ? (
          <p className="muted">Search history is empty.</p>
        ) : (
          <ul className="plain-list">
            {state.recentSearches.map((term) => (
              <li key={term}>
                <Link
                  className="text-link"
                  to={`/search?q=${encodeURIComponent(term)}`}>
                  {term}
                </Link>
                <button
                  type="button"
                  className="text-link"
                  aria-label={`Remove ${term} from recent searches`}
                  onClick={() => state.removeSearch(term)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="actions">
        <button
          type="button"
          className="btn primary"
          disabled={signingOut}
          onClick={() => logOut()}>
          {signingOut ? "Signing out..." : "Sign out"}
        </button>
        <button
          type="button"
          className="btn ghost"
          disabled={signingOut}
          onClick={() => logOut(true)}>
          Sign out all devices
        </button>
      </div>

      {signOutError ? (
        <p className="error" role="alert">
          {signOutError}
        </p>
      ) : null}

      {radiusOpen ? (
        <Sheet
          title="Search radius"
          onClose={() => setRadiusOpen(false)}>
          <div className="stack">
            {RADIUS_OPTIONS.map((miles) => (
              <button
                key={miles}
                type="button"
                className={
                  miles === state.radiusMi
                    ? "choice on"
                    : "choice"
                }
                onClick={() => {
                  state.setRadius(miles);
                  setRadiusOpen(false);
                }}>
                {miles} miles
              </button>
            ))}

            <button
              type="button"
              className={
                customSelected ? "choice on" : "choice"
              }
              onClick={() => {
                setCustomSelected(true);
                setCustomRadius(
                  customRadius ||
                    (!RADIUS_OPTIONS.includes(state.radiusMi)
                      ? String(state.radiusMi)
                      : "20")
                );
              }}>
              Custom
            </button>

            {customSelected && (
              <form
                className="custom-radius"
                onSubmit={(event) => {
                  event.preventDefault();
                  const miles = Number(customRadius);

                  if (
                    customRadius.trim() === "" ||
                    !Number.isFinite(miles) ||
                    miles < 1 ||
                    miles > 100
                  ) {
                    return;
                  }

                  state.setRadius(miles);
                  setRadiusOpen(false);
                }}>
                <label htmlFor="custom-radius-input">
                  Enter radius in miles (1 to 100)
                </label>

                <div className="custom-radius-row">
                  <input
                    id="custom-radius-input"
                    type="number"
                    min="1"
                    max="100"
                    step="any"
                    placeholder="e.g. 20"
                    value={customRadius}
                    onChange={(event) =>
                      setCustomRadius(event.target.value)
                    }
                    required
                  />

                  <button className="btn primary" type="submit">
                    Apply
                  </button>
                </div>
              </form>
            )}
          </div>
        </Sheet>
      ) : null}
    </Screen>
  );
}
