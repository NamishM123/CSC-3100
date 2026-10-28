import { safeDest } from "./format.js";

export function appUser(user) {
  if (!user) return null;
  const metadata = user.user_metadata || {};
  const email = user.email || "";
  const name = [metadata.name, metadata.full_name].find(
    (value) => typeof value === "string" && value.trim()
  );
  return {
    id: user.id,
    email,
    name: name?.trim() || email.split("@")[0] || "Shopper"
  };
}

export function authRedirectUrl(origin, destination) {
  const url = new URL("/sign-in", origin);
  const next = safeDest(destination);
  if (next) url.searchParams.set("next", next);
  return url.href;
}

export function authErrorMessage(error) {
  switch (error?.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Confirm your email before signing in.";
    case "user_already_exists":
      return "An account already exists. Try signing in.";
    case "signup_disabled":
      return "Account creation is currently unavailable.";
    case "provider_disabled":
      return "Google sign-in is not available yet. Please use email and password.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Please wait a few minutes and try again.";
    default:
      if (
        error instanceof TypeError ||
        error?.name === "TimeoutError" ||
        error?.name === "AuthRetryableFetchError"
      ) {
        return "Unable to connect. Check your connection and try again.";
      }
      return (
        error?.message || "Unable to sign in. Please try again."
      );
  }
}

export function authCallbackError(search, hash) {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const code =
    query.get("error_code") || fragment.get("error_code");
  const error = query.get("error") || fragment.get("error");
  if (!code && !error) return "";
  if (code === "otp_expired") {
    return "This confirmation link has expired. Request a new one or try signing in.";
  }
  if (error === "access_denied") {
    return "Sign-in was cancelled or the link is no longer valid. Please try again.";
  }
  return "Unable to finish signing in. Please try again.";
}
