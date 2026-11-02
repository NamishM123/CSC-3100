import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import { verifiedSession } from "./auth.js";
import { createApp } from "./app.js";

const factor = { status: "verified", factor_type: "totp" };
const user = {
  id: "user-a",
  email: "a@example.com",
  factors: [factor]
};
function token(claims) {
  return `header.${Buffer.from(JSON.stringify({ sub: user.id, ...claims })).toString("base64url")}.signature`;
}

test("server MFA checks require verified tokens and reject pending second-factor sessions", async () => {
  const identity = async () => user;
  for (const claims of [{ aal: "aal1" }, {}])
    await assert.rejects(
      verifiedSession(token(claims), identity),
      { status: 403 }
    );
  const session = await verifiedSession(
    token({ aal: "aal2" }),
    identity
  );
  assert.deepEqual(session, {
    id: user.id,
    email: user.email,
    assuranceLevel: "aal2"
  });
  await assert.rejects(
    verifiedSession(token({ aal: "aal2" }), async () => null),
    { status: 401 }
  );
  await assert.rejects(verifiedSession("bad token", identity), {
    status: 401
  });
  await assert.rejects(
    verifiedSession(
      token({ sub: "other", aal: "aal2" }),
      identity
    ),
    { status: 401 }
  );
});

test("no-factor and unverified setups retain normal password sign-in access", async () => {
  for (const factors of [
    undefined,
    [],
    [{ status: "unverified" }]
  ]) {
    assert.equal(
      (
        await verifiedSession(
          token({ aal: "aal1" }),
          async () => ({ ...user, factors })
        )
      ).id,
      user.id
    );
  }
});

test("HTTP guard, security headers, body limits, and fail-closed Auth behavior", async (t) => {
  const calls = [];
  const app = createApp({
    auth: {
      getUser: async (value) => {
        calls.push(value);
        if (value === "offline")
          throw new Error("private infrastructure detail");
        return value === "forged" ? null : user;
      }
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
  const call = (path, token, options = {}) =>
    fetch(base + path, {
      ...options,
      headers: {
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    });
  const health = await call("/health");
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("x-powered-by"), null);
  assert.equal(
    health.headers.get("x-content-type-options"),
    "nosniff"
  );
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.equal((await call("/api/session")).status, 401);
  assert.equal(calls.length, 0);
  assert.equal(
    (await call("/api/session?access_token=forged")).status,
    401
  );
  assert.equal(
    (await call("/api/session", "forged")).status,
    401
  );
  assert.equal(
    (await call("/api/session", token({ aal: "aal1" }))).status,
    403
  );
  const allowed = await call(
    "/api/session",
    token({ aal: "aal2" })
  );
  assert.equal(allowed.status, 200);
  assert.equal(
    allowed.headers.get("cache-control"),
    "no-store"
  );
  assert.deepEqual(await allowed.json(), {
    user: {
      id: user.id,
      email: user.email,
      assuranceLevel: "aal2"
    }
  });
  const offline = await call("/api/session", "offline");
  assert.equal(offline.status, 503);
  assert.doesNotMatch(
    await offline.text(),
    /private infrastructure/
  );
  const badJson = await call("/api/session", null, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: '{"secret":"do not echo"'
  });
  assert.equal(badJson.status, 400);
  assert.doesNotMatch(await badJson.text(), /do not echo/);
  assert.equal(
    (
      await call("/api/session", null, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ padding: "x".repeat(17000) })
      })
    ).status,
    413
  );
});

test("both Vercel deployment roots enforce compatible browser security policies", async () => {
  const root = JSON.parse(
    await readFile(
      new URL("../../../vercel.json", import.meta.url),
      "utf8"
    )
  );
  const frontend = JSON.parse(
    await readFile(
      new URL(
        "../../react-frontend/vercel.json",
        import.meta.url
      ),
      "utf8"
    )
  );
  assert.deepEqual(root.headers, frontend.headers);
  const headers = Object.fromEntries(
    root.headers[0].headers.map(({ key, value }) => [
      key,
      value
    ])
  );
  const policy = headers["Content-Security-Policy"];
  const script = policy
    .split(";")
    .find((value) => value.trim().startsWith("script-src"));
  assert.equal(script.trim(), "script-src 'self'");
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /https:\/\/\*\.supabase\.co/);
  assert.match(policy, /https:\/\/api\.zippopotam\.us/);
  assert.match(policy, /https:\/\/tile\.openstreetmap\.org/);
  assert.equal(headers["X-Frame-Options"], "DENY");
});
