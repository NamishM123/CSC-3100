import react from "@vitejs/plugin-react";
import { env as processEnv } from "node:process";
import { defineConfig, loadEnv } from "vite";
import { validateAuthConfig } from "./src/lib/authConfig.js";

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const url = env.VITE_SUPABASE_URL;
  const key =
    env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    env.VITE_SUPABASE_ANON_KEY;
  if (
    command === "build" &&
    processEnv.VERCEL === "1" &&
    (!url || !key)
  ) {
    throw new Error(
      "Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in the Vercel project's environment variables, then redeploy. Sign-in requires Supabase."
    );
  }
  // Stop private keys from reaching generated JS, rather than detecting them
  // only after the browser has downloaded the bundle.
  if (url || key) {
    const options = { allowLocalHttp: command === "serve" };
    validateAuthConfig(url, key, options);
    for (const configuredKey of [
      env.VITE_SUPABASE_PUBLISHABLE_KEY,
      env.VITE_SUPABASE_ANON_KEY
    ].filter(Boolean)) {
      validateAuthConfig(url, configuredKey, options);
    }
  }
  return {
    plugins: [react()],
    server: { proxy: { "/api": "http://127.0.0.1:8000" } }
  };
});
