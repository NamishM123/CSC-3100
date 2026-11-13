import { getSupabaseClient } from "../lib/supabase.js";

export async function loadOpenData(body, signal) {
  const client = getSupabaseClient();
  const { data, error } = client
    ? await client.auth.getSession()
    : {};
  if (error || !data?.session)
    throw new Error(
      "Sign in again to load community store data."
    );
  const response = await fetch("/api/open-data", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${data.session.access_token}`
    },
    body: JSON.stringify(body),
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(55000)
    ])
  });
  if (
    !response.headers
      .get("Content-Type")
      ?.includes("application/json")
  )
    throw new Error(
      "Community store data is unavailable on this deployment. For local use, start npm run dev:local."
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error ||
        "Community data could not load. Please retry."
    );
  return result;
}
