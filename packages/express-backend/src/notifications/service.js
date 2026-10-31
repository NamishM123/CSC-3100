import { findSaleNotifications } from "../../../react-frontend/src/lib/saleNotifications.js";
import {
  httpError,
  validateSubscription,
  validateWatch
} from "./validation.js";

export function notificationService({
  store,
  getCatalog,
  sendPush,
  publicKey,
  intervalSeconds = 60
}) {
  let running;
  async function deliver(row, deadline = Date.now() + 30000) {
    let sent = 0,
      attempts = 0;
    for (const notification of findSaleNotifications(
      row.watch,
      await getCatalog(row.watch.demo)
    )) {
      if (attempts >= 20 || Date.now() >= deadline) break;
      const token = store.claim(row.id, notification);
      if (!token) continue;
      attempts++;
      try {
        await sendPush(row.subscription, {
          ...notification,
          accountId: row.user_id
        });
      } catch (error) {
        store.release(row.id, notification.id, token);
        if ([404, 410].includes(error.statusCode)) {
          store.remove(row.id);
          throw httpError(
            410,
            "This push subscription expired. Turn notifications off and on again."
          );
        }
        throw error;
      }
      store.sent(row.id, notification.id, token);
      sent++;
    }
    store.checked(row.id);
    return sent;
  }
  return {
    async runAll() {
      if (running) return running;
      running = (async () => {
        const rows = store.list();
        let sent = 0,
          failed = 0,
          processed = 0;
        const deadline = Date.now() + 45000;
        for (
          let offset = 0;
          offset < rows.length && Date.now() < deadline;
          offset += 5
        ) {
          await Promise.all(
            rows.slice(offset, offset + 5).map(async (row) => {
              try {
                sent += await deliver(row, deadline);
              } catch {
                failed++;
              } finally {
                processed++;
                store.checked(row.id);
              }
            })
          );
        }
        return { sent, failed, processed };
      })();
      try {
        return await running;
      } finally {
        running = null;
      }
    },
    settled() {
      return running || Promise.resolve();
    },
    async handler(req, res) {
      try {
        if (req.method === "GET")
          return res.json({ publicKey, intervalSeconds });
        const body = req.body || {};
        if (req.method === "PUT") {
          const saved = store.save(
            req.user.id,
            validateSubscription(body.subscription),
            validateWatch(body.watch)
          );
          return res.json({ history: store.history(saved.id) });
        }
        if (req.method === "DELETE" && body.all === true) {
          store.removeUser(req.user.id);
          return res.json({ disabled: true });
        }
        if (
          typeof body.endpoint !== "string" ||
          body.endpoint.length > 2048
        )
          throw httpError(
            400,
            "Invalid subscription endpoint."
          );
        const saved = store.owned(req.user.id, body.endpoint);
        if (req.method === "DELETE") {
          if (saved) store.remove(saved.id);
          return res.json({ disabled: true });
        }
        if (req.method !== "POST") {
          res.setHeader("Allow", "GET, PUT, POST, DELETE");
          throw httpError(405, "Method not allowed.");
        }
        if (!saved)
          throw httpError(
            404,
            "Turn background notifications on for this device first."
          );
        if (body.action === "test") {
          try {
            await sendPush(saved.subscription, {
              id: "price-pantry-test",
              title: "Price Pantry notifications are working",
              body: "This test was sent by your local server.",
              url: "/profile"
            });
          } catch (error) {
            if ([404, 410].includes(error.statusCode)) {
              store.remove(saved.id);
              throw httpError(
                410,
                "This push subscription expired. Turn notifications off and on again."
              );
            }
            throw error;
          }
        } else if (body.action === "check")
          await deliver(saved);
        else if (body.action !== "status")
          throw httpError(400, "Unknown notification action.");
        return res.json({
          history: store.history(saved.id),
          checkedAt: new Date().toISOString()
        });
      } catch (error) {
        return res.status(error.status || 503).json({
          error: error.status
            ? error.message
            : "Notification delivery failed. Check the local backend and your connection, then retry."
        });
      }
    }
  };
}
