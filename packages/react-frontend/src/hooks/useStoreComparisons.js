import { useEffect, useRef, useState } from "react";
import { loadOpenData } from "../data/openData.js";
import { loadKrogerStores } from "../data/kroger.js";
import { runComparisonFeed } from "../lib/comparisonFeeds.js";
import { coordinatesOf } from "../lib/geo.js";

function useFeed(request) {
  const key = request ? JSON.stringify(request) : null;
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState(null);
  const running = useRef(false);
  useEffect(() => {
    const refresh = () => {
      if (!running.current) setRevision((value) => value + 1);
    };
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(refresh, 4 * 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    if (!key) return;
    running.current = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      let latest = {};
      const update = (result) => {
        latest = result;
        if (!controller.signal.aborted)
          setResponse({ key, revision, result, pending: true });
      };
      try {
        await runComparisonFeed(JSON.parse(key), {
          loadOpen: loadOpenData,
          loadKroger: loadKrogerStores,
          signal: controller.signal,
          update
        });
        if (!controller.signal.aborted)
          setResponse({
            key,
            revision,
            result: latest,
            pending: false
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setResponse({
            key,
            revision,
            result: { ...latest, error: error.message },
            pending: false
          });
      } finally {
        if (!controller.signal.aborted) running.current = false;
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
      running.current = false;
    };
  }, [key, revision]);
  const current =
    key &&
    response?.key === key &&
    response.revision === revision
      ? response
      : null;
  return {
    entries: current?.result?.entries || {},
    ...current?.result,
    pending: Boolean(key && (!current || current.pending)),
    refresh: () => setRevision((value) => value + 1)
  };
}

export function useStoreComparisons({
  stores,
  queries,
  location,
  radiusMi,
  dietary
}) {
  const point = coordinatesOf(location);
  const active = queries.length && point;
  const providers = [
    ...new Set(
      stores
        .filter((store) => store.source === "weekly-ads")
        .map((store) => store.provider)
    )
  ].sort();
  const mapped = stores
    .filter((store) => store.source === "openstreetmap")
    .map((store) => store.id)
    .sort();
  const family = stores
    .filter((store) => store.source === "kroger")
    .map((store) => store.id)
    .sort();
  const weekly = useFeed(
    active && providers.length
      ? { kind: "weekly", providers }
      : null
  );
  const community = useFeed(
    active && mapped.length
      ? { kind: "community", storeIds: mapped, dietary }
      : null
  );
  const kroger = useFeed(
    active
      ? {
          kind: "kroger",
          queries,
          storeIds: family,
          location: point,
          radiusMi,
          dietary
        }
      : null
  );
  return {
    weekly,
    community,
    kroger,
    pending:
      weekly.pending || community.pending || kroger.pending,
    refresh: () => {
      weekly.refresh();
      community.refresh();
      kroger.refresh();
    }
  };
}
