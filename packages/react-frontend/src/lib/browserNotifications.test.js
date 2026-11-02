import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  notificationPermission,
  requestNotificationPermission
} from "./browserNotifications.js";

test("permission is requested by opt-in and blocked/insecure/unsupported browsers get actionable errors", async () => {
  const root = {
    isSecureContext: true,
    navigator: { serviceWorker: {} },
    Notification: {
      permission: "default",
      requestPermission: async () => "granted"
    }
  };
  assert.equal(notificationPermission(root), "default");
  await requestNotificationPermission(root);
  root.Notification.permission = "denied";
  await assert.rejects(
    requestNotificationPermission(root),
    /site settings/
  );
  root.isSecureContext = false;
  assert.equal(notificationPermission(root), "unsupported");
  await assert.rejects(
    requestNotificationPermission(root),
    /HTTPS or localhost/
  );
});

async function worker() {
  const handlers = new Map(),
    displayed = [],
    opened = [],
    focused = [],
    messages = [];
  let clients = [];
  const self = {
    location: { origin: "http://localhost:5173" },
    skipWaiting() {},
    addEventListener: (name, fn) => handlers.set(name, fn),
    registration: {
      showNotification: async (title, options) =>
        displayed.push({ title, ...options })
    },
    clients: {
      claim() {},
      matchAll: async () => clients,
      openWindow: async (url) => opened.push(url)
    }
  };
  vm.runInNewContext(
    await readFile(
      new URL(
        "../../public/notifications-sw.js",
        import.meta.url
      ),
      "utf8"
    ),
    { self, URL }
  );
  return {
    handlers,
    displayed,
    opened,
    focused,
    messages,
    setClients(values) {
      clients = values;
    }
  };
}

test("service worker displays push with no open app and posts updates to open tabs", async () => {
  const state = await worker();
  const notification = {
    id: "offer",
    title: "Sale",
    body: "Bananas are on sale",
    accountId: "user",
    url: "/product/bananas"
  };
  let task;
  state.handlers.get("push")({
    data: { json: () => notification },
    waitUntil(value) {
      task = value;
    }
  });
  await task;
  assert.equal(state.displayed[0].title, "Sale");
  assert.equal(
    state.displayed[0].data.url,
    "http://localhost:5173/product/bananas"
  );
  state.setClients([
    { postMessage: (value) => state.messages.push(value) }
  ]);
  state.handlers.get("push")({
    data: { json: () => notification },
    waitUntil(value) {
      task = value;
    }
  });
  await task;
  assert.equal(
    state.messages[0].notification.accountId,
    "user"
  );
});

test("notification clicks reuse a window and never open external destinations", async () => {
  const state = await worker();
  let task;
  const client = {
    url: "http://localhost:5173/",
    navigate: async (url) => {
      client.url = url;
    },
    focus: async () => state.focused.push(true)
  };
  state.setClients([client]);
  state.handlers.get("notificationclick")({
    notification: {
      data: { url: "/product/bananas" },
      close() {}
    },
    waitUntil(value) {
      task = value;
    }
  });
  await task;
  assert.equal(
    client.url,
    "http://localhost:5173/product/bananas"
  );
  assert.equal(state.focused.length, 1);
  state.setClients([]);
  for (const url of [
    "https://evil.test/",
    "//evil.test/",
    "/\\evil.test/"
  ]) {
    state.handlers.get("notificationclick")({
      notification: { data: { url }, close() {} },
      waitUntil(value) {
        task = value;
      }
    });
    await task;
    assert.equal(
      state.opened.at(-1),
      "http://localhost:5173/profile"
    );
  }
});
