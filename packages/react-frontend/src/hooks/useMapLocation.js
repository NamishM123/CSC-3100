import { useEffect, useState } from "react";
import { coordinatesOf, lookupZip } from "../lib/geo.js";

// Resolve older saved ZIP-only locations without guessing a map center.
export function useMapLocation(location) {
  const latitude = location?.latitude;
  const longitude = location?.longitude;
  const zip = location?.zip;
  const [result, setResult] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (coordinatesOf({ latitude, longitude }) || !zip) return;
    const controller = new AbortController();
    lookupZip(zip, { signal: controller.signal })
      .then((place) => {
        if (!controller.signal.aborted) {
          setResult({ zip, place, error: "" });
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setResult({ zip, place: null, error: error.message });
        }
      });
    return () => controller.abort();
  }, [latitude, longitude, zip, attempt]);

  const matches = result != null && result.zip === zip;
  const place = coordinatesOf(location)
    ? location
    : matches
      ? result.place
      : null;
  const error = matches ? result.error : "";
  return {
    place,
    error,
    loading: !place && !error && Boolean(zip),
    retry() {
      setResult(null);
      setAttempt((value) => value + 1);
    }
  };
}
