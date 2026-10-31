import assert from "node:assert/strict";
import test from "node:test";
import { validateAuthConfig } from "./authConfig.js";

const url = "https://project.supabase.co";
const key = "sb_publishable_test";
const jwt = (role) =>
  `header.${btoa(JSON.stringify({ role }))}.signature`;

test("only public publishable or legacy anon credentials are accepted", () => {
  assert.equal(validateAuthConfig(url, key).url, url);
  assert.equal(
    validateAuthConfig(url, jwt("anon")).key,
    jwt("anon")
  );
  for (const value of [
    "sb_secret_private",
    jwt("service_role"),
    jwt("authenticated"),
    "malformed",
    "",
    undefined
  ]) {
    assert.throws(() => validateAuthConfig(url, value));
  }
});

test("remote HTTP, URL credentials, and misleading localhost names are blocked", () => {
  for (const value of [
    "http://project.supabase.co",
    "https://name:password@project.supabase.co",
    "https://project.supabase.co?token=secret",
    "https://project.supabase.co#secret",
    "http://localhost.evil.test",
    "file:///tmp/auth",
    "not a url"
  ]) {
    assert.throws(() =>
      validateAuthConfig(value, key, { allowLocalHttp: true })
    );
  }
  assert.throws(() =>
    validateAuthConfig("http://localhost:54321", key)
  );
  assert.equal(
    validateAuthConfig("http://127.0.0.1:54321", key, {
      allowLocalHttp: true
    }).url,
    "http://127.0.0.1:54321"
  );
});

test("configuration errors never echo private key values", () => {
  const secret = "sb_secret_do_not_print_me";
  assert.throws(
    () => validateAuthConfig(url, secret),
    (error) => !error.message.includes(secret)
  );
});
