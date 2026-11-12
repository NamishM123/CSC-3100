import { useEffect, useState } from "react";
import { loadKrogerStores } from "../data/kroger.js";
import { coordinatesOf } from "../lib/geo.js";

export function useKrogerLocations(place, radiusMi) {
  const coordinates = coordinatesOf(place);
  const requestKey = coordinates
    ? JSON.stringify({
        location: coordinates,
        radiusMi,
        queries: []
      })
    : null;
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!requestKey) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await loadKrogerStores(
          JSON.parse(requestKey),
          controller.signal
        );
        if (!controller.signal.aborted)
          setResponse({ key: requestKey, attempt, result });
      } catch (error) {
        if (!controller.signal.aborted)
          setResponse({
            key: requestKey,
            attempt,
            error:
              error.message ||
              "Unable to load nearby Kroger stores."
          });
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, attempt]);

  const current =
    requestKey &&
    response?.key === requestKey &&
    response.attempt === attempt
      ? response
      : null;
  return {
    stores: current?.result?.stores || [],
    limitedStores: current?.result?.limitedStores || false,
    maxStores: current?.result?.maxStores,
    loading: Boolean(requestKey && !current),
    error: current?.error || "",
    ready: Boolean(current?.result),
    retry: () => setAttempt((value) => value + 1)
  };
}
