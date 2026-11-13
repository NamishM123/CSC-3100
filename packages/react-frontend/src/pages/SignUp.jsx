import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import AuthLoading from "../components/AuthLoading.jsx";
import ResendVerification from "../components/ResendVerification.jsx";
import { useAppState } from "../state/useAppState.js";
import { safeDest } from "../lib/format.js";
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  passwordValidationError
} from "../lib/auth.js";

export default function SignUp() {
  const {
    user,
    location,
    authLoading,
    hasSession,
    signUp,
    signInWithGoogle
  } = useAppState();
  const route = useLocation();
  const destination = safeDest(route.state?.from);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [confirmationEmail, setConfirmationEmail] =
    useState("");

  if (authLoading) return <AuthLoading />;
  if (hasSession && !user)
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{ from: destination }}
      />
    );
  if (user) {
    return (
      <Navigate
        to={location ? destination || "/" : "/location"}
        state={{ from: destination }}
        replace
      />
    );
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setError("");
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!email.trim().includes("@")) {
      setError("Enter an email address.");
      return;
    }
    const passwordError = passwordValidationError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setPending("password");
    try {
      await signUp({ name, email, password }, destination);
      setConfirmationEmail(email.trim());
    } catch (error) {
      setError(authErrorMessage(error));
    } finally {
      setPassword("");
      setPending("");
    }
  }

  async function onGoogleSignIn() {
    if (pending) return;
    setError("");
    setPending("google");
    try {
      await signInWithGoogle(destination);
    } catch (error) {
      setError(authErrorMessage(error));
      setPending("");
    }
  }

  if (confirmationEmail) {
    return (
      <Screen title="Verify your email" chrome={false}>
        <div className="auth">
          <div className="auth-brand">
            <div className="logo-mark" aria-hidden="true" />
            <h1>Check your email</h1>
            <p className="lede">
              Confirm your email to finish creating your
              account.
            </p>
          </div>
          <div className="auth-panel stack">
            <p role="status">
              Check <strong>{confirmationEmail}</strong> for a
              verification link. Open it to confirm your email,
              then return here to sign in.
            </p>
            <p className="fine">
              Check your spam folder if you don&apos;t see it.
            </p>
            <ResendVerification
              email={confirmationEmail}
              destination={destination}
            />
            <Link
              className="btn primary"
              to="/sign-in"
              state={{
                from: destination,
                email: confirmationEmail
              }}>
              Back to sign in
            </Link>
            <button
              className="text-link"
              type="button"
              onClick={() => setConfirmationEmail("")}>
              Use a different email
            </button>
          </div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="Create account" chrome={false}>
      <div className="auth">
        <div className="auth-brand">
          <div className="logo-mark" aria-hidden="true" />
          <h1>Create an account</h1>
          <p className="lede">
            Save lists and come back to the same searches.
            We&apos;ll email you a link to verify your address.
          </p>
        </div>
        <div className="auth-panel">
          <form className="form" onSubmit={onSubmit}>
            <label className="field">
              <span>Name</span>
              <input
                name="name"
                autoComplete="name"
                required
                disabled={Boolean(pending)}
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setError("");
                }}
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
                disabled={Boolean(pending)}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={MIN_PASSWORD_LENGTH}
                maxLength={72}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                disabled={Boolean(pending)}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
            </label>
            <button
              className="btn primary"
              type="submit"
              disabled={Boolean(pending)}
              aria-busy={pending === "password"}>
              {pending === "password"
                ? "Creating account..."
                : "Create account"}
            </button>
          </form>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="actions">
            <button
              className="btn ghost"
              type="button"
              disabled={Boolean(pending)}
              aria-busy={pending === "google"}
              onClick={onGoogleSignIn}>
              {pending === "google"
                ? "Connecting to Google..."
                : "Continue with Google"}
            </button>
          </div>
          <p className="center">
            <Link
              className="text-link"
              to="/sign-in"
              state={{ from: destination }}>
              Already have an account? Sign in
            </Link>
          </p>
        </div>
      </div>
    </Screen>
  );
}
