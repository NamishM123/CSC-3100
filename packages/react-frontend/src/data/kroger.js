import { getSupabaseClient } from "../lib/supabase.js";

export async function loadKrogerStores(body, signal) {
  const client = getSupabaseClient();
  const { data, error } = client
    ? await client.auth.getSession()
    : {};
  if (error || !data?.session)
    throw new Error("Sign in again to search Kroger stores.");
  const response = await fetch("/api/kroger", {
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
      "Kroger search is unavailable on this deployment. For local use, start npm run dev:local."
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.error || "Kroger search failed. Please retry."
    );
  if (!Array.isArray(result.stores))
    throw new Error(
      "Kroger returned an invalid response. Please retry."
    );
  return result;
}
