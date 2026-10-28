import { createClient } from "@supabase/supabase-js";

const env = import.meta.env || {};
const url = env.VITE_SUPABASE_URL;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY;

let client;

export function supabaseConfigured() {
  return Boolean(url && key);
}

export function getSupabaseClient() {
  if (!supabaseConfigured()) return null;
  client ??= createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce"
    }
  });
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
