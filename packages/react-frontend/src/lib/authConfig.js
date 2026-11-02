// Shared by the browser and Vite's build configuration; never print key values.
export function validateAuthConfig(
  url,
  key,
  { allowLocalHttp = false } = {}
) {
  if (!url || !key)
    throw new Error(
      "Set both the Supabase URL and a public publishable/anon key."
    );
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The Supabase URL is invalid.");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    parsed.hostname
  );
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.protocol !== "https:" &&
      !(allowLocalHttp && local && parsed.protocol === "http:"))
  ) {
    throw new Error(
      "Supabase must use HTTPS. Local HTTP is allowed only during development."
    );
  }
  let publicKey =
    typeof key === "string" &&
    key.startsWith("sb_publishable_");
  if (
    !publicKey &&
    typeof key === "string" &&
    key.split(".").length === 3
  ) {
    try {
      // Classification only; this does not verify tokens or authorize requests.
      const payload = key
        .split(".")[1]
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      publicKey = JSON.parse(atob(payload)).role === "anon";
    } catch {
      /* Reject malformed or private keys below. */
    }
  }
  if (!publicKey)
    throw new Error(
      "Use a Supabase publishable or legacy anon key. Secret/service-role keys must never enter a frontend build."
    );
  return { url: parsed.href.replace(/\/$/, ""), key };
}
