import {
  mkdirSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import webpush from "web-push";
import * as mock from "../../../react-frontend/src/data/mock.js";
import { publicAuthConfig } from "../config.js";
import { notificationStore } from "./store.js";
import { notificationService } from "./service.js";

export function pushSettings() {
  const directory = resolve(
    process.env.PUSH_DATA_DIR ||
      fileURLToPath(
        new URL("../../.local/notifications", import.meta.url)
      )
  );
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "vapid.json");
  let keys;
  if (
    process.env.VAPID_PUBLIC_KEY ||
    process.env.VAPID_PRIVATE_KEY
  ) {
    if (
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.VAPID_PRIVATE_KEY
    )
      throw new Error(
        "Configure both VAPID keys, or omit both to use locally generated keys."
      );
    keys = {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY
    };
  } else {
    try {
      keys = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      keys = webpush.generateVAPIDKeys();
      try {
        writeFileSync(path, JSON.stringify(keys), {
          flag: "wx",
          mode: 0o600
        });
      } catch (error) {
        if (error.code !== "EEXIST") throw error;
        keys = JSON.parse(readFileSync(path, "utf8"));
      }
    }
  }
  const intervalSeconds = Number(
    process.env.PUSH_CHECK_INTERVAL_SECONDS || 60
  );
  if (
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 15 ||
    intervalSeconds > 86400
  )
    throw new Error(
      "PUSH_CHECK_INTERVAL_SECONDS must be between 15 and 86400."
    );
  return {
    ...keys,
    directory,
    intervalSeconds,
    subject:
      process.env.VAPID_SUBJECT ||
      "mailto:local-development@example.invalid"
  };
}

export function notificationRuntime() {
  const settings = pushSettings();
  const store = notificationStore(
    join(settings.directory, "notifications.sqlite")
  );
  let cache;
  async function getCatalog(demo) {
    if (demo) return mock;
    if (!cache) {
      cache = (async () => {
        const { url, key } = publicAuthConfig();
        const values = await Promise.all(
          ["stores", "products", "prices"].map(
            async (table) => {
              const filter =
                table === "prices"
                  ? `&updated_at=gte.${encodeURIComponent(new Date(Date.now() - 7 * 86400000).toISOString())}&order=updated_at.desc`
                  : "";
              const response = await fetch(
                `${url}/rest/v1/${table}?select=*&limit=5000${filter}`,
                {
                  headers: { apikey: key },
                  signal: AbortSignal.timeout(10000),
                  redirect: "error"
                }
              );
              if (!response.ok)
                throw new Error(
                  "Live sale catalog is unavailable."
                );
              return response.json();
            }
          )
        );
        return {
          stores: values[0],
          products: values[1],
          prices: values[2]
        };
      })();
      setTimeout(() => {
        cache = undefined;
      }, 5000).unref();
    }
    return cache;
  }
  const service = notificationService({
    store,
    getCatalog,
    publicKey: settings.publicKey,
    intervalSeconds: settings.intervalSeconds,
    sendPush: (subscription, notification) =>
      webpush.sendNotification(
        subscription,
        JSON.stringify(notification),
        {
          TTL: 3600,
          timeout: 5000,
          vapidDetails: {
            subject: settings.subject,
            publicKey: settings.publicKey,
            privateKey: settings.privateKey
          }
        }
      )
  });
  let timer;
  return {
    ...service,
    start() {
      const check = () =>
        service
          .runAll()
          .then((result) => {
            if (result.failed)
              console.warn(
                `Notification check: ${result.failed} device(s) failed; later checks will retry.`
              );
          })
          .catch(() =>
            console.warn(
              "Notification check failed; inspect local configuration and connectivity."
            )
          );
      timer = setInterval(
        check,
        settings.intervalSeconds * 1000
      );
      timer.unref();
      void check();
    },
    async close() {
      clearInterval(timer);
      await service.settled();
      store.close();
    }
  };
}
