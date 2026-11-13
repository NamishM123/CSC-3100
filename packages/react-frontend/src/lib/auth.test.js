import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import {
  appUser,
  authCallbackError,
  authErrorMessage,
  authRedirectUrl,
  passwordValidationError,
  createPasswordAccount,
  resendVerificationEmail,
  signupRedirectUrl
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
    "/account-security",
    "/account-security?next=/list",
    "/location"
  ]) {
    assert.equal(safeDest(value), null);
    assert.equal(
      authRedirectUrl("https://pantry.example", value),
      "https://pantry.example/sign-in"
    );
    assert.equal(
      signupRedirectUrl("https://pantry.example", value),
      "https://pantry.example/sign-in?signup=confirmed"
    );
  }
  assert.equal(
    signupRedirectUrl(
      "https://pantry.example",
      "/list?sort=price"
    ),
    "https://pantry.example/sign-in?next=%2Flist%3Fsort%3Dprice&signup=confirmed"
  );
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

test("legacy account and OAuth failures produce actionable errors", () => {
  assert.match(
    authErrorMessage({ code: "email_not_confirmed" }),
    /Verify your email before signing in/
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

function authClient(fetch) {
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

const signupDetails = {
  name: " Shopper ",
  email: " shopper@example.com ",
  password: "a long unique passphrase",
  emailRedirectTo: signupRedirectUrl(
    "https://pantry.example",
    "/list"
  )
};
const confirmationSettings = async () => ({
  mailer_autoconfirm: false
});

test("password signup requests a confirmation link with the correct redirect and creates no session", async () => {
  let requests = 0;
  const client = authClient(async (url, options) => {
    requests += 1;
    const target = new URL(url);
    assert.equal(target.pathname, "/auth/v1/signup");
    assert.equal(
      target.searchParams.get("redirect_to"),
      signupDetails.emailRedirectTo
    );
    assert.equal(options.method, "POST");
    const body = JSON.parse(options.body);
    assert.equal(body.email, "shopper@example.com");
    assert.equal(body.password, signupDetails.password);
    assert.deepEqual(body.data, { name: "Shopper" });
    return Response.json({
      id: "new-shopper",
      email: "shopper@example.com",
      identities: []
    });
  });
  const data = await createPasswordAccount(
    client,
    confirmationSettings,
    signupDetails
  );
  assert.equal(data.user.id, "new-shopper");
  assert.equal(data.session, null);
  assert.equal(
    (await client.auth.getSession()).data.session,
    null
  );
  assert.equal(requests, 1);
});

test("signup cannot bypass email verification when confirmation is disabled or settings are unknown", async () => {
  for (const settings of [
    { mailer_autoconfirm: true },
    {},
    null
  ]) {
    let requests = 0;
    const client = authClient(async () => {
      requests += 1;
      return Response.json({});
    });
    await assert.rejects(
      createPasswordAccount(
        client,
        async () => settings,
        signupDetails
      ),
      /temporarily unavailable/
    );
    assert.equal(requests, 0);
  }
});

test("signup stops before creating an account when settings cannot be fetched", async () => {
  let requests = 0;
  const client = authClient(async () => {
    requests += 1;
    return Response.json({});
  });
  const failure = new TypeError("Network unavailable");
  await assert.rejects(
    createPasswordAccount(
      client,
      async () => {
        throw failure;
      },
      signupDetails
    ),
    (error) => error === failure
  );
  assert.equal(requests, 0);
});

test("signup failures propagate and a missing user never appears successful", async () => {
  const code = "user_already_exists";
  const client = authClient(async () =>
    Response.json(
      { code, msg: "User already registered" },
      {
        status: 422,
        headers: { "X-Supabase-Api-Version": "2024-01-01" }
      }
    )
  );
  await assert.rejects(
    createPasswordAccount(
      client,
      confirmationSettings,
      signupDetails
    ),
    { code }
  );
  const invalidClient = authClient(async () =>
    Response.json({})
  );
  await assert.rejects(
    createPasswordAccount(
      invalidClient,
      confirmationSettings,
      signupDetails
    ),
    /try signing in/
  );
});

test("an unexpected automatic signup session is signed out instead of bypassing confirmation", async () => {
  const paths = [];
  const client = authClient(async (url) => {
    const target = new URL(url);
    paths.push(target.pathname);
    if (target.pathname === "/auth/v1/logout") {
      assert.equal(target.searchParams.get("scope"), "local");
      return new Response(null, { status: 204 });
    }
    return Response.json({
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      expires_in: 3600,
      token_type: "bearer",
      user: { id: "new-shopper", email: "shopper@example.com" }
    });
  });
  await assert.rejects(
    createPasswordAccount(
      client,
      confirmationSettings,
      signupDetails
    ),
    /verification is temporarily unavailable/
  );
  assert.deepEqual(paths, [
    "/auth/v1/signup",
    "/auth/v1/logout"
  ]);
  assert.equal(
    (await client.auth.getSession()).data.session,
    null
  );
});

test("resending requests a signup verification email without a password or session", async () => {
  let requests = 0;
  const client = authClient(async (url, options) => {
    requests += 1;
    const target = new URL(url);
    assert.equal(target.pathname, "/auth/v1/resend");
    assert.equal(
      target.searchParams.get("redirect_to"),
      signupDetails.emailRedirectTo
    );
    const body = JSON.parse(options.body);
    assert.equal(body.type, "signup");
    assert.equal(body.email, "shopper@example.com");
    assert.equal(Object.hasOwn(body, "password"), false);
    return Response.json({});
  });
  await resendVerificationEmail(client, signupDetails);
  assert.equal(requests, 1);
  assert.equal(
    (await client.auth.getSession()).data.session,
    null
  );
});

test("resend rejects empty addresses without making requests and preserves service rate limits", async () => {
  let requests = 0;
  const client = authClient(async () => {
    requests += 1;
    return Response.json(
      {
        code: "over_email_send_rate_limit",
        msg: "Email rate limit exceeded"
      },
      {
        status: 429,
        headers: { "X-Supabase-Api-Version": "2024-01-01" }
      }
    );
  });
  await assert.rejects(
    resendVerificationEmail(client, { email: " " }),
    /Enter your email/
  );
  assert.equal(requests, 0);
  await assert.rejects(
    resendVerificationEmail(client, signupDetails),
    { code: "over_email_send_rate_limit" }
  );
  assert.equal(requests, 1);
  assert.match(
    authErrorMessage({ code: "over_email_send_rate_limit" }),
    /wait a few minutes/
  );
});
