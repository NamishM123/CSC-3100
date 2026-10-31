import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import { httpError } from "./validation.js";

export function notificationStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`
    pragma foreign_keys = on;
    pragma busy_timeout = 5000;
    pragma journal_mode = WAL;
    create table if not exists subscriptions (
      id text primary key, user_id text not null, endpoint text not null unique,
      subscription text not null, watch text not null, updated_at integer not null,
      last_checked_at integer not null default 0
    );
    create index if not exists subscriptions_checked on subscriptions(last_checked_at);
    create table if not exists deliveries (
      subscription_id text not null references subscriptions(id) on delete cascade,
      offer_id text not null, token text not null, claimed_at integer not null,
      sent_at integer, notification text not null, primary key(subscription_id, offer_id)
    );
  `);
  const row = (value) =>
    value && {
      ...value,
      subscription: JSON.parse(value.subscription),
      watch: JSON.parse(value.watch)
    };
  return {
    close() {
      db.close();
    },
    save(userId, subscription, watch) {
      const existing = db
        .prepare(
          "select * from subscriptions where endpoint = ?"
        )
        .get(subscription.endpoint);
      if (existing && existing.user_id !== userId)
        throw httpError(
          409,
          "Reconnect this browser's notifications for this account."
        );
      const id = existing?.id || randomUUID();
      db.prepare(
        `insert into subscriptions(id,user_id,endpoint,subscription,watch,updated_at) values(?,?,?,?,?,?)
        on conflict(endpoint) do update set subscription=excluded.subscription,watch=excluded.watch,updated_at=excluded.updated_at where subscriptions.user_id=excluded.user_id`
      ).run(
        id,
        userId,
        subscription.endpoint,
        JSON.stringify(subscription),
        JSON.stringify(watch),
        Date.now()
      );
      const saved = row(
        db
          .prepare(
            "select * from subscriptions where endpoint=?"
          )
          .get(subscription.endpoint)
      );
      if (saved.user_id !== userId)
        throw httpError(
          409,
          "Reconnect this browser's notifications for this account."
        );
      return saved;
    },
    owned(userId, endpoint) {
      return row(
        db
          .prepare(
            "select * from subscriptions where user_id=? and endpoint=?"
          )
          .get(userId, endpoint)
      );
    },
    remove(id) {
      db.prepare("delete from subscriptions where id=?").run(
        id
      );
    },
    removeUser(userId) {
      db.prepare(
        "delete from subscriptions where user_id=?"
      ).run(userId);
    },
    list() {
      return db
        .prepare(
          "select * from subscriptions order by last_checked_at limit 100"
        )
        .all()
        .map(row);
    },
    checked(id) {
      db.prepare(
        "update subscriptions set last_checked_at=? where id=?"
      ).run(Date.now(), id);
    },
    history(id) {
      return db
        .prepare(
          "select notification,sent_at from deliveries where subscription_id=? and sent_at is not null order by sent_at desc limit 30"
        )
        .all(id)
        .map((entry) => ({
          ...JSON.parse(entry.notification),
          sentAt: new Date(entry.sent_at).toISOString()
        }));
    },
    claim(id, notification) {
      const token = randomUUID(),
        now = Date.now();
      const result = db
        .prepare(
          `insert into deliveries(subscription_id,offer_id,token,claimed_at,notification) values(?,?,?,?,?)
        on conflict(subscription_id,offer_id) do update set token=excluded.token,claimed_at=excluded.claimed_at,notification=excluded.notification
        where deliveries.sent_at is null and deliveries.claimed_at < ? returning token`
        )
        .get(
          id,
          notification.id,
          token,
          now,
          JSON.stringify(notification),
          now - 300000
        );
      return result?.token;
    },
    sent(id, offerId, token) {
      db.prepare(
        "update deliveries set sent_at=? where subscription_id=? and offer_id=? and token=?"
      ).run(Date.now(), id, offerId, token);
    },
    release(id, offerId, token) {
      db.prepare(
        "delete from deliveries where subscription_id=? and offer_id=? and token=? and sent_at is null"
      ).run(id, offerId, token);
    }
  };
}
