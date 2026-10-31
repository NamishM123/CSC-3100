import assert from "node:assert/strict";
import test from "node:test";
import {
  enrollTotp,
  readMfaSession,
  verifyTotp
} from "./mfa.js";

const user = { id: "shopper", email: "shopper@example.com" };
const session = { user, access_token: "exact-session-token" };
const factor = {
  id: "authenticator",
  status: "verified",
  factor_type: "totp"
};
function client(level, factors = []) {
  return {
    auth: {
      getUser: async (token) => {
        assert.equal(token, session.access_token);
        return {
          data: { user: { ...user, factors } },
          error: null
        };
      },
      mfa: {
        getAuthenticatorAssuranceLevel: async (token) => {
          assert.equal(token, session.access_token);
          return { data: { currentLevel: level }, error: null };
        },
        listFactors: async () => ({
          data: { all: factors },
          error: null
        })
      }
    }
  };
}

test("password-only and restored sessions remain locked for enrolled users", async () => {
  for (const level of ["aal1", null]) {
    const result = await readMfaSession(
      client(level, [factor]),
      session
    );
    assert.equal(result.user, null);
    assert.equal(result.hasSession, true);
    assert.equal(result.mfaRequired, true);
    assert.deepEqual(result.mfaFactors, [factor]);
  }
});

test("unenrolled, unfinished-setup, and MFA-verified sessions receive the expected access", async () => {
  for (const [level, factors] of [
    ["aal1", []],
    ["aal1", [{ ...factor, status: "unverified" }]],
    ["aal2", [factor]]
  ]) {
    const result = await readMfaSession(
      client(level, factors),
      session
    );
    assert.equal(result.user.id, user.id);
    assert.equal(result.mfaRequired, false);
  }
  assert.equal(
    (await readMfaSession(null, null)).hasSession,
    false
  );
});

test("cached profile fields cannot hide MFA or override the authenticated identity", async () => {
  const cached = {
    ...session,
    user: { ...user, factors: [], email: "forged@example.com" }
  };
  assert.equal(
    (await readMfaSession(client("aal1", [factor]), cached))
      .user,
    null
  );
  assert.equal(
    (await readMfaSession(client("aal2", [factor]), cached))
      .user.email,
    user.email
  );
  await assert.rejects(
    readMfaSession(client("aal1"), {
      ...session,
      user: { id: "other" }
    }),
    /verify your session/
  );
});

test("failed identity or assurance checks never grant app access", async () => {
  for (const failed of ["identity", "assurance"]) {
    const auth = client("aal2", [factor]);
    if (failed === "identity")
      auth.auth.getUser = async () => ({
        error: new Error("invalid token")
      });
    else
      auth.auth.mfa.getAuthenticatorAssuranceLevel =
        async () => ({ error: new Error("invalid token") });
    await assert.rejects(
      readMfaSession(auth, session),
      /invalid token/
    );
  }
});

test("an unsupported verified factor still locks the account", async () => {
  const result = await readMfaSession(
    client("aal1", [{ ...factor, factor_type: "phone" }]),
    session
  );
  assert.equal(result.mfaRequired, true);
  assert.equal(result.user, null);
  assert.deepEqual(result.mfaFactors, []);
});

test("verification validates code format and propagates Auth rejection", async () => {
  const calls = [];
  const auth = client("aal1");
  auth.auth.mfa.challengeAndVerify = async (value) => {
    calls.push(value);
    return {
      error:
        value.code === "123456"
          ? null
          : new Error("Expired code")
    };
  };
  for (const code of [
    "",
    "12345",
    "1234567",
    "12a456",
    " 123456"
  ])
    await assert.rejects(
      verifyTotp(auth, "factor", code),
      /six-digit/
    );
  assert.equal(calls.length, 0);
  await assert.rejects(
    verifyTotp(auth, "factor", "000000"),
    /Expired code/
  );
  await verifyTotp(auth, "factor", "123456");
  assert.deepEqual(calls.at(-1), {
    factorId: "factor",
    code: "123456"
  });
});

test("setup preserves verified factors, removes abandoned setups, and safely encodes QR SVG", async () => {
  const auth = client("aal2", [
    factor,
    { ...factor, id: "pending", status: "unverified" }
  ]);
  const removed = [];
  auth.auth.mfa.unenroll = async ({ factorId }) => {
    removed.push(factorId);
    return { error: null };
  };
  auth.auth.mfa.enroll = async ({ factorType }) => {
    assert.equal(factorType, "totp");
    return {
      data: {
        id: "new",
        totp: {
          secret: "SETUPKEY",
          qr_code:
            'data:image/svg+xml;utf-8,<svg fill="#000"></svg>'
        }
      },
      error: null
    };
  };
  const setup = await enrollTotp(auth);
  assert.deepEqual(removed, ["pending"]);
  assert.match(setup.totp.qr_code, /%23000/);
  assert.equal(setup.totp.secret, "SETUPKEY");
});

test("enrollment and cleanup errors do not appear successful", async () => {
  const auth = client("aal1");
  auth.auth.mfa.enroll = async () => ({
    error: new Error("Enrollment disabled")
  });
  await assert.rejects(enrollTotp(auth), /Enrollment disabled/);
  const abandoned = client("aal1", [
    { ...factor, status: "unverified" }
  ]);
  abandoned.auth.mfa.unenroll = async () => ({
    error: new Error("Cleanup failed")
  });
  await assert.rejects(enrollTotp(abandoned), /Cleanup failed/);
});
