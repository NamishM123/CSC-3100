import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  appUser,
  authCallbackError,
  authErrorMessage,
  authRedirectUrl,
  passwordValidationError,
  resendConfirmationEmail
} from "./auth.js";
import { safeDest } from "./format.js";

test("auth redirects retain internal destinations and reject external URLs", () => {
  assert.equal(
    authRedirectUrl(
      "https://pantry.example",
      "/list?sort=price"
    ),
    "https://pantry.example/sign-in?next=%2Flist%3Fsort%3Dprice"
  );
  for (const value of [
    "//evil.example",
    "/\\evil.example",
    "/\nevil.example",
    "https://evil.example",
    "/sign-in",
    "/sign-up",
    "/location"
  ]) {
    assert.equal(safeDest(value), null);
    assert.equal(
      authRedirectUrl("https://pantry.example", value),
      "https://pantry.example/sign-in"
    );
  }
});

test("signup accepts long passphrases while respecting bcrypt's byte limit", () => {
  assert.match(
    passwordValidationError("short password"),
    /at least 15/
  );
  assert.equal(
    passwordValidationError("a long unique passphrase"),
    ""
  );
  assert.equal(passwordValidationError("x".repeat(72)), "");
  assert.match(
    passwordValidationError("x".repeat(73)),
    /72 UTF-8 bytes/
  );
  assert.equal(passwordValidationError("é".repeat(36)), "");
  assert.match(
    passwordValidationError("é".repeat(37)),
    /72 UTF-8 bytes/
  );
});

test("authenticated profiles use Supabase identity and provider metadata", () => {
  assert.equal(appUser(null), null);
  assert.deepEqual(
    appUser({
      id: "auth-id",
      email: "shopper@example.com",
      user_metadata: { full_name: "  Grocery Shopper  " }
    }),
    {
      id: "auth-id",
      email: "shopper@example.com",
      name: "Grocery Shopper"
    }
  );
  assert.equal(
    appUser({
      id: "auth-id",
      email: "shopper@example.com",
      user_metadata: { name: 123 }
    }).name,
    "shopper"
  );
});

test("confirmation and OAuth failures produce actionable errors", () => {
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }),
    /Confirm your email/
  );
  assert.match(
    authCallbackError("?error_code=otp_expired", ""),
    /expired/
  );
  assert.match(
    authCallbackError("", "#error=access_denied"),
    /cancelled/
  );
  assert.equal(authCallbackError("?code=valid-code", ""), "");
});

function emailClient(fetch) {
  return createClient(
    "https://auth.example",
    "public-test-key",
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      },
      global: { fetch }
    }
  );
}

test("verification resend reaches Auth with the signup type and safe login callback", async () => {
  for (const destination of ["/list", "https://evil.example"]) {
    let requests = 0;
    const client = emailClient(async (url, options) => {
      requests += 1;
      const target = new URL(url);
      assert.equal(target.pathname, "/auth/v1/resend");
      assert.equal(options.method, "POST");
      assert.equal(
        target.searchParams.get("redirect_to"),
        destination === "/list"
          ? "https://pantry.example/sign-in?next=%2Flist"
          : "https://pantry.example/sign-in"
      );
      const body = JSON.parse(options.body);
      assert.equal(body.type, "signup");
      assert.equal(body.email, "shopper@example.com");
      return Response.json({});
    });
    await resendConfirmationEmail(client, {
      email: " shopper@example.com ",
      origin: "https://pantry.example",
      destination
    });
    assert.equal(requests, 1);
  }
});

test("email delivery and rate-limit failures reject instead of reporting success", async () => {
  for (const [status, code] of [
    [429, "over_email_send_rate_limit"],
    [400, "email_address_not_authorized"]
  ]) {
    const client = emailClient(async () =>
      Response.json(
        { code, msg: "Email could not be sent" },
        {
          status,
          headers: { "X-Supabase-Api-Version": "2024-01-01" }
        }
      )
    );
    await assert.rejects(
      resendConfirmationEmail(client, {
        email: "shopper@example.com",
        origin: "https://pantry.example"
      }),
      { code }
    );
  }
});
