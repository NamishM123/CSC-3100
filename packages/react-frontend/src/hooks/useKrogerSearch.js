import { useEffect, useState } from "react";
import { loadKrogerStores } from "../data/kroger.js";

// Responses live only in memory. Reopening a saved list always fetches prices.
export function useKrogerSearch(body) {
  const requestKey = JSON.stringify(body);
  const [revision, setRevision] = useState(0);
  const [response, setResponse] = useState(null);
  const [failure, setFailure] = useState(null);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("focus", refresh);
    const visible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", visible);
    const timer = setInterval(refresh, 4 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
      clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    const request = JSON.parse(requestKey);
    if (
      !request.location ||
      !request.queries.length ||
      request.queries.length > 20
    )
      return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await loadKrogerStores(
          request,
          controller.signal
        );
        if (!controller.signal.aborted)
          setResponse({
            key: requestKey,
            revision,
            result,
            receivedAt: Date.now()
          });
      } catch (error) {
        if (!controller.signal.aborted)
          setFailure({
            key: requestKey,
            revision,
            message:
              error.message ||
              "Kroger search failed. Please retry."
          });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, revision]);
  const current =
    response?.key === requestKey &&
    response.revision === revision
      ? response.result
      : null;
  const error =
    failure?.key === requestKey && failure.revision === revision
      ? failure.message
      : "";
  return {
    current,
    receivedAt: current ? response.receivedAt : null,
    error,
    pending:
      !!body.location &&
      body.queries.length > 0 &&
      body.queries.length <= 20 &&
      !current &&
      !error,
    refresh: () => setRevision((value) => value + 1)
  };
}
