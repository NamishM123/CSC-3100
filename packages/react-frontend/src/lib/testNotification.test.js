import assert from "node:assert/strict";
import test from "node:test";
import { createTestNotification } from "./testNotification.js";

test("manual tests have distinct notification IDs so browsers do not silently replace them", () => {
  const notifications = Array.from({ length: 20 }, () =>
    createTestNotification()
  );
  assert.equal(
    new Set(notifications.map(({ id }) => id)).size,
    20
  );
  for (const notification of notifications) {
    assert.match(notification.id, /^price-pantry-test:/);
    assert.equal(notification.url, "/profile");
  }
  const server = createTestNotification("server");
  assert.match(server.body, /local server/);
  assert.notEqual(server.id, notifications[0].id);
});
