import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { validateAuthConfig } from "../../react-frontend/src/lib/authConfig.js";

export function publicAuthConfig() {
  let frontend = {};
  if (process.env.NODE_ENV !== "production") {
    try {
      frontend = parseEnv(
        readFileSync(
          new URL(
            "../../react-frontend/.env.local",
            import.meta.url
          ),
          "utf8"
        )
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return validateAuthConfig(
    process.env.SUPABASE_URL || frontend.VITE_SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      frontend.VITE_SUPABASE_PUBLISHABLE_KEY ||
      frontend.VITE_SUPABASE_ANON_KEY,
    { allowLocalHttp: process.env.NODE_ENV !== "production" }
  );
}
