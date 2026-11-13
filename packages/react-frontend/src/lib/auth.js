import { safeDest } from "./format.js";

export const MIN_PASSWORD_LENGTH = 15;

export function passwordValidationError(password) {
  if (
    typeof password !== "string" ||
    [...password].length < MIN_PASSWORD_LENGTH
  ) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters. A long, unique passphrase works well.`;
  }
  if (new TextEncoder().encode(password).length > 72) {
    return "Use a password of at most 72 UTF-8 bytes (some characters use more than one byte).";
  }
  return "";
}

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

export function signupRedirectUrl(origin, destination) {
  const url = new URL(authRedirectUrl(origin, destination));
  url.searchParams.set("signup", "confirmed");
  return url.href;
}

export async function createPasswordAccount(
  client,
  readSettings,
  { name, email, password, emailRedirectTo }
) {
  const validation = passwordValidationError(password);
  if (validation) throw new Error(validation);
  const settings = await readSettings();
  // Confirmation must be enforced by Auth, not just by this screen.
  if (settings?.mailer_autoconfirm !== false) {
    throw new Error(
      "Email verification is temporarily unavailable. Please try again later."
    );
  }
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name: name.trim() },
      emailRedirectTo
    }
  });
  if (error) throw error;
  if (data?.session) {
    await client.auth.signOut({ scope: "local" });
    throw new Error(
      "Email verification is temporarily unavailable. Please try again later."
    );
  }
  if (!data?.user?.id) {
    throw new Error(
      "Unable to finish creating your account. Please try signing in."
    );
  }
  return data;
}

export async function resendVerificationEmail(
  client,
  { email, emailRedirectTo }
) {
  const clean = email.trim();
  if (!clean.includes("@"))
    throw new Error("Enter your email address above first.");
  const { error } = await client.auth.resend({
    type: "signup",
    email: clean,
    options: { emailRedirectTo }
  });
  if (error) throw error;
}

export function authErrorMessage(error) {
  switch (error?.code) {
    case "mfa_verification_failed":
    case "mfa_challenge_expired":
      return "That code is incorrect or expired. Enter the current code from your authenticator app.";
    case "mfa_totp_enroll_not_enabled":
    case "mfa_totp_verify_not_enabled":
      return "Authenticator setup is currently unavailable. Please contact support.";
    case "weak_password":
      return "Choose a longer, unique password that meets the account password requirements.";
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "email_not_confirmed":
      return "Verify your email before signing in. Check your inbox and spam folder, or request a new confirmation email below.";
    case "user_already_exists":
      return "An account already exists. Try signing in.";
    case "signup_disabled":
      return "Account creation is currently unavailable.";
    case "email_address_not_authorized":
      return "Verification emails are currently unavailable for this address. Please contact support.";
    case "provider_disabled":
      return "Google sign-in is not available yet. Please use email and password.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
    case "over_sms_send_rate_limit":
    case "mfa_verification_rejected":
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
