/* Notifications only: this worker does not cache or intercept app requests. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim())
);

function notificationUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin &&
      typeof value === "string" &&
      value.startsWith("/") &&
      !value.startsWith("//")
      ? url.href
      : new URL("/profile", self.location.origin).href;
  } catch {
    return new URL("/profile", self.location.origin).href;
  }
}

self.addEventListener("push", (event) => {
  let notification;
  try {
    notification = event.data.json();
  } catch {
    return;
  }
  if (
    typeof notification?.title !== "string" ||
    typeof notification.body !== "string"
  )
    return;
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(
        notification.title.slice(0, 150),
        {
          body: notification.body.slice(0, 1000),
          tag: String(notification.id || "price-pantry"),
          icon: "/favicon.svg",
          data: { url: notificationUrl(notification.url) }
        }
      );
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });
      for (const client of clients)
        client.postMessage({
          type: "PRICE_PANTRY_NOTIFICATION",
          notification
        });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = notificationUrl(event.notification.data?.url);
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });
      const client =
        clients.find((client) => client.url === target) ||
        clients.find(
          (client) =>
            new URL(client.url).origin === self.location.origin
        );
      if (client) {
        if (client.url !== target && client.navigate)
          await client.navigate(target);
        await client.focus();
      } else await self.clients.openWindow(target);
    })()
  );
});
