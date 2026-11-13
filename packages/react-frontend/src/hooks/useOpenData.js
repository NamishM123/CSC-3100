import { useEffect, useState } from "react";
import { loadOpenData } from "../data/openData.js";

export function useOpenData(body) {
  const key = body ? JSON.stringify(body) : null;
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState(null);
  useEffect(() => {
    if (!key) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await loadOpenData(
          JSON.parse(key),
          controller.signal
        );
        if (!controller.signal.aborted)
          setResponse({ key, attempt, result });
      } catch (error) {
        if (!controller.signal.aborted)
          setResponse({
            key,
            attempt,
            error:
              error.message || "Community data could not load."
          });
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, attempt]);
  const current =
    response?.key === key && response.attempt === attempt
      ? response
      : null;
  return {
    data: current?.result,
    error: current?.error || "",
    loading: Boolean(key && !current),
    retry: () => setAttempt((value) => value + 1)
  };
}
