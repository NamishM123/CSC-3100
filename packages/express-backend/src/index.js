import { createApp } from "./app.js";
import { notificationRuntime } from "./notifications/runtime.js";

const notifications = notificationRuntime();
const app = createApp({ notifications });
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
  console.log(
    `Local backend listening at http://${HOST}:${PORT}; notification checks run every ${process.env.PUSH_CHECK_INTERVAL_SECONDS || 60} seconds.`
  );
  notifications.start();
});

for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    server.close(() =>
      notifications.close().then(() => process.exit(0))
    );
  });
