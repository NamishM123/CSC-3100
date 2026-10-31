import express from "express";
import { requireAuth } from "./auth.js";

export function createApp({ auth } = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    );
    if (process.env.NODE_ENV === "production")
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000"
      );
    next();
  });
  app.use(express.json({ limit: "16kb" }));
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/session", requireAuth(auth), (req, res) =>
    res.json({ user: req.user })
  );
  app.use((_req, res) =>
    res.status(404).json({ error: "Not found." })
  );
  // The fourth argument is required by Express's error-handler signature.
  app.use((error, _req, res, _next) => {
    const status =
      error.status === 413
        ? 413
        : error.type === "entity.parse.failed"
          ? 400
          : 500;
    res.status(status).json({
      error:
        status === 413
          ? "Request is too large."
          : status === 400
            ? "Invalid request."
            : "Request failed. Please try again."
    });
  });
  return app;
}
