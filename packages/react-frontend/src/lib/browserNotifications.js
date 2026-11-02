let registrationPromise;

export function notificationPermission(root = globalThis) {
  return root.isSecureContext &&
    root.Notification &&
    root.navigator?.serviceWorker
    ? root.Notification.permission
    : "unsupported";
}

export async function requestNotificationPermission(
  root = globalThis
) {
  const permission = notificationPermission(root);
  if (permission === "unsupported")
    throw new Error(
      "Notifications need a supported browser on HTTPS or localhost. On iPhone/iPad, open an installed Home Screen app."
    );
  if (permission === "denied")
    throw new Error(
      "Notifications are blocked. Allow them in your browser's site settings and retry."
    );
  if (permission === "granted") return;
  if (
    (await root.Notification.requestPermission()) !== "granted"
  )
    throw new Error(
      "Notification permission was not granted. You can try again from your browser's site settings."
    );
}

export async function notificationRegistration() {
  if (notificationPermission() === "unsupported")
    throw new Error(
      "Browser notifications are unavailable here."
    );
  if (!registrationPromise) {
    registrationPromise = navigator.serviceWorker
      .register("/notifications-sw.js", { scope: "/" })
      .then(
        (registration) =>
          new Promise((resolve, reject) => {
            if (registration.active?.state === "activated")
              return resolve(registration);
            const worker =
              registration.installing ||
              registration.waiting ||
              registration.active;
            if (!worker)
              return reject(
                new Error(
                  "Notification worker did not start. Refresh and retry."
                )
              );
            const timeout = setTimeout(() => {
              worker.removeEventListener(
                "statechange",
                changed
              );
              reject(
                new Error(
                  "Notification setup timed out. Refresh and retry."
                )
              );
            }, 12000);
            function changed() {
              if (
                worker.state === "activated" ||
                worker.state === "redundant"
              ) {
                clearTimeout(timeout);
                worker.removeEventListener(
                  "statechange",
                  changed
                );
                if (worker.state === "activated")
                  resolve(registration);
                else
                  reject(
                    new Error(
                      "Notification setup failed. Refresh and retry."
                    )
                  );
              }
            }
            worker.addEventListener("statechange", changed);
            changed();
          })
      )
      .catch((error) => {
        registrationPromise = undefined;
        throw error;
      });
  }
  return registrationPromise;
}

export async function showBrowserNotification(notification) {
  if (notificationPermission() !== "granted")
    throw new Error(
      "Allow browser notifications before sending alerts."
    );
  const registration = await notificationRegistration();
  await registration.showNotification(notification.title, {
    body: notification.body,
    tag: notification.id,
    icon: "/favicon.svg",
    data: { url: notification.url }
  });
}
