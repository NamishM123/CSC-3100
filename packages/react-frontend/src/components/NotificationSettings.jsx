import { Link } from "react-router-dom";
import { useAppState } from "../state/useAppState.js";

export default function NotificationSettings() {
  const state = useAppState();
  return (
    <>
      <section className="profile-block row">
        <div>
          <h2>Sale notifications</h2>
          <p className="muted">
            Get alerts for sales on outstanding list items and
            your saved price targets.
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
          aria-describedby="notification-status"
          disabled={state.notificationBusy}
          onClick={() =>
            state.setSaleNotifications(!state.saleNotifications)
          }>
          <span />
        </button>
      </section>
      <section
        className="profile-block"
        aria-label="Notification delivery">
        <fieldset
          className="notification-modes"
          disabled={
            state.saleNotifications || state.notificationBusy
          }>
          <legend>Delivery mode</legend>
          <label>
            <input
              type="radio"
              name="notification-mode"
              checked={state.notificationMode === "browser"}
              onChange={() =>
                state.setNotificationMode("browser")
              }
            />{" "}
            While the app is open
          </label>
          <label>
            <input
              type="radio"
              name="notification-mode"
              checked={state.notificationMode === "push"}
              onChange={() => state.setNotificationMode("push")}
            />{" "}
            Background via local server
          </label>
        </fieldset>
        <p className="fine">
          Turn notifications off before changing delivery mode.
        </p>
        <p id="notification-status" className="muted">
          {state.notificationPermission === "denied"
            ? "Notifications are blocked in your browser's site settings."
            : state.notificationPermission === "unsupported"
              ? "Notifications need a supported browser on HTTPS or localhost. On iPhone/iPad, open an installed Home Screen app."
              : !state.saleNotifications
                ? "Choose a delivery mode, then turn notifications on and allow browser permission."
                : state.notificationMode === "push"
                  ? "The local server checks saved watches every minute while it is running. Keep this computer awake and online."
                  : "This tab checks saved items every minute while it is open. Browser suspension can delay checks."}
        </p>
        {state.catalog.pricesAreDemo !== false ? (
          <p className="fine">
            The current sample prices produce clearly labeled
            demo alerts.
          </p>
        ) : null}
        <div className="actions">
          <button
            type="button"
            className="btn ghost"
            disabled={
              !state.saleNotifications ||
              state.notificationBusy ||
              state.notificationPermission !== "granted"
            }
            onClick={state.testNotification}>
            Send test notification
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={
              !state.saleNotifications ||
              state.notificationBusy ||
              state.notificationPermission !== "granted"
            }
            onClick={state.checkNotifications}>
            Check saved items now
          </button>
        </div>
        {state.notificationBusy ? (
          <p role="status">Working on notifications...</p>
        ) : null}
        {state.notificationError ? (
          <p className="error" role="alert">
            {state.notificationError}
          </p>
        ) : null}
        {state.notificationStatus ? (
          <p role="status">{state.notificationStatus}</p>
        ) : null}
      </section>
      <section className="profile-block">
        <div className="section-title">
          <h2>Recent notifications</h2>
          {state.saleNotificationHistory.length ? (
            <button
              type="button"
              className="text-link"
              onClick={state.clearSaleNotificationHistory}>
              Clear history
            </button>
          ) : null}
        </div>
        {state.saleNotificationHistory.length ? (
          <ul className="plain-list">
            {state.saleNotificationHistory.map(
              (notification) => (
                <li key={notification.id}>
                  <Link to={notification.url}>
                    {notification.demo ? "Demo: " : ""}
                    {notification.body}
                  </Link>
                </li>
              )
            )}
          </ul>
        ) : (
          <p className="muted">
            No sale or price alerts sent yet.
          </p>
        )}
      </section>
    </>
  );
}
