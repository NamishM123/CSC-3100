import { createClient } from "@supabase/supabase-js";
import { validateAuthConfig } from "./authConfig.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY;

let client;
let configuration;
try {
  configuration = validateAuthConfig(url, key, {
    allowLocalHttp: import.meta.env.DEV
  });
} catch {
  // Build-time validation gives developers the actionable error without keys.
  configuration = null;
}

export function supabaseConfigured() {
  return Boolean(configuration);
}

export function getSupabaseClient() {
  if (!supabaseConfigured()) return null;
  if (typeof window !== "undefined" && !window.isSecureContext)
    return null;
  client ??= createClient(
    configuration.url,
    configuration.key,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce"
      }
    }
  );
  return client;
}

export async function googleSignInEnabled() {
  if (!supabaseConfigured()) return false;
  const response = await fetch(
    `${url.replace(/\/$/, "")}/auth/v1/settings`,
    {
      headers: { apikey: key },
      signal: AbortSignal.timeout(15000)
    }
  );
  if (!response.ok) {
    throw new Error(
      "Unable to check sign-in options. Try again."
    );
  }
  const settings = await response.json();
  return settings.external?.google === true;
}
