import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";
import { AppStateContext } from "./useAppState.js";
import {
  notificationPermission,
  requestNotificationPermission,
  showBrowserNotification
} from "../lib/browserNotifications.js";
import {
  enablePush,
  syncPush,
  pushAction,
  disablePush
} from "../lib/pushNotifications.js";
import {
  notificationWatch,
  findSaleNotifications
} from "../lib/saleNotifications.js";

function readSettings(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return {
      enabled: saved?.enabled === true,
      mode: saved?.mode === "push" ? "push" : "browser",
      history: Array.isArray(saved?.history)
        ? saved.history.slice(0, 30)
        : [],
      seen: Array.isArray(saved?.seen)
        ? saved.seen.slice(-10000)
        : [],
      clearedAt: saved?.clearedAt || ""
    };
  } catch {
    return {
      enabled: false,
      mode: "browser",
      history: [],
      seen: [],
      clearedAt: ""
    };
  }
}

export default function NotificationState({
  appState,
  children
}) {
  const userId = appState.user?.id;
  const key = `price-pantry-notifications:${userId || "signed-out"}`;
  const [settings, setSettings] = useState(() =>
    readSettings(key)
  );
  const seen = useRef(new Set(settings.seen));
  const [permission, setPermission] = useState(
    notificationPermission
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [ready, setReady] = useState(false);
  const watchJson = JSON.stringify(notificationWatch(appState));
  const catalogJson = JSON.stringify({
    products: appState.catalog.products,
    stores: appState.catalog.stores,
    prices: appState.catalog.prices
  });
  const { enabled, mode } = settings;
  const { refreshCatalog } = appState;

  const record = useCallback((history) => {
    setSettings((current) => ({
      ...current,
      history: [
        ...new Map(
          [...current.history, ...history]
            .filter((entry) => entry.sentAt > current.clearedAt)
            .map((entry) => [entry.id, entry])
        ).values()
      ]
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
        .slice(0, 30)
    }));
  }, []);

  useEffect(() => {
    if (!userId) return;
    try {
      localStorage.setItem(key, JSON.stringify(settings));
    } catch {
      /* Memory-only settings still work. */
    }
  }, [key, settings, userId]);

  useEffect(() => {
    const focus = () => setPermission(notificationPermission());
    const storage = (event) => {
      if (event.key === key) {
        const saved = readSettings(key);
        seen.current = new Set(saved.seen);
        setSettings(saved);
      }
    };
    window.addEventListener("focus", focus);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("focus", focus);
      window.removeEventListener("storage", storage);
    };
  }, [key]);

  useEffect(() => {
    if (!userId || !enabled) return;
    void refreshCatalog();
    const timer = setInterval(refreshCatalog, 60000);
    window.addEventListener("focus", refreshCatalog);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshCatalog);
    };
  }, [userId, enabled, refreshCatalog]);

  const browserCheck = useCallback(async () => {
    const run = async () => {
      const latest = readSettings(key);
      for (const id of latest.seen) seen.current.add(id);
      let sent = 0;
      for (const notification of findSaleNotifications(
        JSON.parse(watchJson),
        JSON.parse(catalogJson)
      )) {
        if (seen.current.has(notification.id)) continue;
        await showBrowserNotification(notification);
        seen.current.add(notification.id);
        const history = {
          ...notification,
          sentAt: new Date().toISOString()
        };
        // Persist before releasing the cross-tab lock, so another tab cannot
        // announce the same offer while React's persistence effect is pending.
        try {
          const saved = readSettings(key);
          localStorage.setItem(
            key,
            JSON.stringify({
              ...saved,
              seen: [...seen.current].slice(-10000),
              history: [history, ...saved.history].slice(0, 30)
            })
          );
        } catch {
          /* The current tab still deduplicates in memory. */
        }
        setSettings((current) => ({
          ...current,
          seen: [...seen.current].slice(-10000),
          history: [history, ...current.history].slice(0, 30)
        }));
        sent++;
        if (sent >= 20) break;
      }
      return sent;
    };
    if (navigator.locks)
      return navigator.locks.request(
        `price-pantry-alerts:${userId}`,
        { ifAvailable: true },
        (lock) => (lock ? run() : 0)
      );
    return run();
  }, [key, userId, watchJson, catalogJson]);

  useEffect(() => {
    if (!userId || !enabled || permission !== "granted") return;
    let active = true,
      running = false;
    async function sync() {
      if (!active || running) return;
      running = true;
      try {
        if (mode === "push") {
          const result = await syncPush(JSON.parse(watchJson));
          if (active) record(result.history);
        } else await browserCheck();
        if (active) {
          setReady(true);
          setError("");
        }
      } catch (failure) {
        if (active) {
          setReady(false);
          setError(failure.message);
        }
      } finally {
        running = false;
      }
    }
    void sync();
    const timer = setInterval(sync, 60000);
    window.addEventListener("focus", sync);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", sync);
    };
  }, [
    userId,
    enabled,
    permission,
    mode,
    watchJson,
    browserCheck,
    record
  ]);

  useEffect(() => {
    const received = (event) => {
      if (
        enabled &&
        mode === "push" &&
        event.data?.type === "PRICE_PANTRY_NOTIFICATION" &&
        event.data.notification.accountId === userId
      )
        record([
          {
            ...event.data.notification,
            sentAt: new Date().toISOString()
          }
        ]);
    };
    navigator.serviceWorker?.addEventListener(
      "message",
      received
    );
    return () =>
      navigator.serviceWorker?.removeEventListener(
        "message",
        received
      );
  }, [enabled, mode, userId, record]);

  async function changeEnabled(value) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (value) {
        if (!JSON.parse(watchJson).location)
          throw new Error(
            "Choose your location before enabling notifications."
          );
        await requestNotificationPermission();
        setPermission(notificationPermission());
        if (mode === "push")
          record(
            (await enablePush(JSON.parse(watchJson))).history
          );
        setSettings((current) => ({
          ...current,
          enabled: true
        }));
        setReady(true);
        setStatus(
          mode === "push"
            ? "Background alerts enabled. Keep the local server and your computer running."
            : "Alerts enabled while this app is open."
        );
      } else {
        if (mode === "push") await disablePush();
        setSettings((current) => ({
          ...current,
          enabled: false
        }));
        setReady(false);
        setStatus("Notifications turned off on this device.");
      }
    } catch (failure) {
      setPermission(notificationPermission());
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function action(test) {
    if (busy) return;
    setBusy(true);
    setError("");
    setStatus("");
    try {
      if (mode === "push") {
        await syncPush(JSON.parse(watchJson));
        const result = await pushAction(
          test ? "test" : "check"
        );
        record(result.history);
      } else if (test)
        await showBrowserNotification({
          id: "price-pantry-test",
          title: "Price Pantry notifications are working",
          body: "This test came from the app running on this device.",
          url: "/profile"
        });
      else await browserCheck();
      setReady(true);
      setStatus(
        test
          ? "Test notification sent. Check your device's notification center."
          : "Saved items checked. New matching offers appear below; previously sent offers are not repeated."
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }

  async function signOut(everywhere = false) {
    if (mode === "push" && (enabled || everywhere)) {
      try {
        await disablePush(everywhere);
      } catch {
        /* Signing out must remain possible when offline. */
      }
    }
    const disabled = { ...settings, enabled: false };
    setSettings(disabled);
    setReady(false);
    try {
      localStorage.setItem(key, JSON.stringify(disabled));
    } catch {
      /* Auth still signs out. */
    }
    if (everywhere) await appState.signOutEverywhere();
    else await appState.signOut();
  }

  return (
    <AppStateContext.Provider
      value={{
        ...appState,
        saleNotifications: enabled,
        notificationMode: mode,
        notificationPermission: permission,
        notificationReady: ready && permission === "granted",
        notificationBusy: busy,
        notificationError: error,
        notificationStatus: status,
        saleNotificationHistory: settings.history,
        setSaleNotifications: changeEnabled,
        setNotificationMode(value) {
          if (
            !enabled &&
            !busy &&
            ["browser", "push"].includes(value)
          ) {
            setSettings((current) => ({
              ...current,
              mode: value
            }));
            setError("");
            setStatus("");
          }
        },
        testNotification: () => action(true),
        checkNotifications: () => action(false),
        clearSaleNotificationHistory() {
          setSettings((current) => ({
            ...current,
            history: [],
            clearedAt: new Date().toISOString()
          }));
        },
        signOut: () => signOut(),
        signOutEverywhere: () => signOut(true)
      }}>
      {children}
    </AppStateContext.Provider>
  );
}
