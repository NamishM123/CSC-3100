import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { notificationStore } from "./store.js";
import { notificationService } from "./service.js";
import {
  validateSubscription,
  validateWatch
} from "./validation.js";
import { createApp } from "../app.js";
import * as mock from "../../../react-frontend/src/data/mock.js";

const bytes = Buffer.alloc(65, 1);
bytes[0] = 4;
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/local-test",
  keys: {
    p256dh: bytes.toString("base64url"),
    auth: Buffer.alloc(16, 1).toString("base64url")
  }
};
const watch = {
  productIds: ["prod-bananas"],
  location: { latitude: 35.27, longitude: -120.66 },
  radiusMi: 5,
  includeMember: true,
  demo: true,
  alerts: []
};

function fixture(t, path = ":memory:") {
  const store = notificationStore(path);
  t.after(() => store.close());
  const sends = [];
  const push = {
    failure: null,
    async send(subscription, notification) {
      if (this.failure) throw this.failure;
      sends.push({ subscription, notification });
    }
  };
  const service = notificationService({
    store,
    sendPush: (...args) => push.send(...args),
    getCatalog: async () => mock,
    publicKey: "public-key"
  });
  return { store, sends, push, service };
}

test("background checks deliver durable watches and concurrent runs do not repeat offers", async (t) => {
  const { store, sends, service } = fixture(t);
  const saved = store.save("user", subscription, watch);
  await Promise.all([service.runAll(), service.runAll()]);
  assert.equal(sends.length, 1);
  assert.equal(sends[0].notification.accountId, "user");
  assert.match(sends[0].notification.title, /Demo/);
  assert.equal(store.history(saved.id).length, 1);
  await service.runAll();
  assert.equal(sends.length, 1);
  store.remove(saved.id);
  await service.runAll();
  assert.equal(sends.length, 1);
});

test("failed sends can retry and expired subscriptions are removed", async (t) => {
  const { store, sends, push, service } = fixture(t);
  store.save("user", subscription, watch);
  push.failure = new Error("temporary");
  assert.equal((await service.runAll()).failed, 1);
  push.failure = null;
  await service.runAll();
  assert.equal(sends.length, 1);
  const second = {
    ...subscription,
    endpoint: subscription.endpoint + "-expired"
  };
  store.save("user", second, watch);
  push.failure = Object.assign(new Error("gone"), {
    statusCode: 410
  });
  await service.runAll();
  assert.equal(store.owned("user", second.endpoint), undefined);
});

test("delivery continues beyond the first 20 offers on subsequent passes", async (t) => {
  const { store } = fixture(t);
  store.save("user", subscription, watch);
  const sale = mock.prices.find((row) => row.is_sale);
  const stores = Array.from({ length: 25 }, (_, index) => ({
    ...mock.stores[0],
    id: `store-${index}`
  }));
  const catalog = {
    ...mock,
    stores,
    prices: stores.map((store) => ({
      ...sale,
      store_id: store.id
    }))
  };
  const sent = [];
  const service = notificationService({
    store,
    getCatalog: async () => catalog,
    sendPush: async (_subscription, notification) =>
      sent.push(notification.id)
  });
  await service.runAll();
  assert.equal(sent.length, 20);
  await service.runAll();
  assert.equal(sent.length, 25);
  assert.equal(new Set(sent).size, 25);
});

test("stale claims can recover without allowing an old worker to finish a new claim", (t) => {
  const { store } = fixture(t);
  const saved = store.save("user", subscription, watch),
    notification = { id: "crashed-offer" };
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  const oldToken = store.claim(saved.id, notification);
  now += 300001;
  const newToken = store.claim(saved.id, notification);
  assert.ok(newToken);
  assert.notEqual(newToken, oldToken);
  store.release(saved.id, notification.id, oldToken);
  store.sent(saved.id, notification.id, oldToken);
  assert.equal(store.history(saved.id).length, 0);
  store.sent(saved.id, notification.id, newToken);
  assert.equal(store.history(saved.id).length, 1);
});

test("SQLite persists watches/deduplication across restarts and claims are exclusive across connections", async () => {
  const directory = await mkdtemp(
    join(tmpdir(), "price-pantry-store-test-")
  );
  const path = join(directory, "notifications.sqlite");
  let first, second;
  try {
    first = notificationStore(path);
    const saved = first.save("user", subscription, watch);
    const notification = { id: "offer", title: "test" };
    const token = first.claim(saved.id, notification);
    second = notificationStore(path);
    assert.equal(
      second.claim(saved.id, notification),
      undefined
    );
    assert.throws(
      () => second.save("another-user", subscription, watch),
      { status: 409 }
    );
    first.sent(saved.id, notification.id, token);
    first.close();
    first = null;
    assert.equal(second.list().length, 1);
    assert.equal(second.history(saved.id).length, 1);
    assert.equal(
      second.claim(saved.id, notification),
      undefined
    );
  } finally {
    first?.close();
    second?.close();
    // Verify the exact unique scratch path before recursive cleanup on Windows.
    assert.ok(
      resolve(directory).startsWith(resolve(tmpdir()) + sep)
    );
    assert.ok(
      basename(directory).startsWith("price-pantry-store-test-")
    );
    await rm(directory, { recursive: true, force: true });
  }
});

test("validation blocks private push destinations and bounds watch data", () => {
  validateSubscription(subscription);
  validateWatch(watch);
  for (const endpoint of [
    "http://localhost:8000",
    "https://127.0.0.1",
    "https://fcm.googleapis.com.evil.test",
    "https://user:pass@fcm.googleapis.com",
    "https://fcm.googleapis.com:444",
    "https://evil.test"
  ])
    assert.throws(
      () => validateSubscription({ ...subscription, endpoint }),
      { status: 400 }
    );
  for (const value of [
    { ...watch, location: null },
    { ...watch, radiusMi: 500 },
    { ...watch, productIds: Array(201).fill("item") },
    { ...watch, alerts: [{ productId: "item", below: -1 }] }
  ])
    assert.throws(() => validateWatch(value), { status: 400 });
});

test("HTTP APIs enforce verified MFA, per-account ownership, tests, status, and disabling", async (t) => {
  const { service, sends } = fixture(t);
  const user = (id) => ({
    id,
    email: `${id}@example.com`,
    factors: [{ status: "verified" }]
  });
  const app = createApp({
    notifications: service,
    auth: {
      getUser: async (token) =>
        token.endsWith(".invalid")
          ? null
          : user(
              JSON.parse(
                Buffer.from(token.split(".")[1], "base64url")
              ).sub
            )
    }
  });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      })
  );
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = (id, aal = "aal2") =>
    `header.${Buffer.from(JSON.stringify({ sub: id, aal })).toString("base64url")}.signature`;
  const call = (method, body, id = "user", aal = "aal2") =>
    fetch(base + "/api/notifications", {
      method,
      headers: {
        Authorization: `Bearer ${token(id, aal)}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });
  assert.equal(
    (await fetch(base + "/api/notifications")).status,
    401
  );
  for (const method of ["GET", "PUT", "POST", "DELETE"])
    assert.equal(
      (
        await call(
          method,
          method === "GET" ? undefined : {},
          "user",
          "aal1"
        )
      ).status,
      403
    );
  assert.equal((await call("GET")).status, 200);
  assert.equal(
    (
      await call("PUT", {
        subscription,
        watch,
        user_id: "other"
      })
    ).status,
    200
  );
  assert.equal(
    (await call("PUT", { subscription, watch }, "other"))
      .status,
    409
  );
  assert.equal(
    (
      await call(
        "POST",
        { endpoint: subscription.endpoint, action: "test" },
        "other"
      )
    ).status,
    404
  );
  await call(
    "DELETE",
    { endpoint: subscription.endpoint },
    "other"
  );
  assert.equal(
    (
      await call("POST", {
        endpoint: subscription.endpoint,
        action: "test"
      })
    ).status,
    200
  );
  assert.equal(sends.length, 1);
  assert.equal(
    (
      await call("POST", {
        endpoint: subscription.endpoint,
        action: "check"
      })
    ).status,
    200
  );
  const status = await (
    await call("POST", {
      endpoint: subscription.endpoint,
      action: "status"
    })
  ).json();
  assert.equal(status.history.length, 1);
  assert.equal(
    (await call("DELETE", { all: true })).status,
    200
  );
  assert.equal(
    (
      await call("POST", {
        endpoint: subscription.endpoint,
        action: "test"
      })
    ).status,
    404
  );
});
