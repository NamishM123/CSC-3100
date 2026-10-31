import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import Sheet from "../components/Sheet.jsx";
import MfaSettings from "../components/MfaSettings.jsx";
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
          Showing the San Luis Obispo demo catalog.
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
            Include member prices in totals.
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

      <section className="profile-block row">
        <div>
          <h2>Sale notifications</h2>
          <p className="muted">
            Saved on this device for list items. Not sent yet.
          </p>
        </div>
        <button
          type="button"
          className={
            state.saleNotifications ? "switch on" : "switch"
          }
          role="switch"
          aria-checked={state.saleNotifications}
          aria-label="Sale notifications"
          onClick={() =>
            state.setSaleNotifications(!state.saleNotifications)
          }>
          <span />
        </button>
      </section>

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
              onClick={() => state.toggleDietary(filter)}>
              {filter}
            </button>
          ))}
        </div>
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
                <span>{term}</span>
                <button
                  type="button"
                  className="text-link"
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
          className="btn ghost"
          onClick={() => {
            state.resetDemo();
          }}>
          Reset demo lists
        </button>
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
                    miles <= 0 ||
                    miles > 50
                  ) {
                    return;
                  }

                  state.setRadius(miles);
                  setRadiusOpen(false);
                }}>
                <label htmlFor="custom-radius-input">
                  Enter radius in miles (up to 50)
                </label>

                <div className="custom-radius-row">
                  <input
                    id="custom-radius-input"
                    type="number"
                    min="0.1"
                    max="50"
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
