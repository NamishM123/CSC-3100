import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import AuthLoading from "../components/AuthLoading.jsx";
import MfaChallenge from "../components/MfaChallenge.jsx";
import { useAppState } from "../state/useAppState.js";
import { safeDest } from "../lib/format.js";
import {
  authCallbackError,
  authErrorMessage
} from "../lib/auth.js";

export default function SignIn() {
  const {
    user,
    location,
    authLoading,
    authError,
    hasSession,
    mfaRequired,
    refreshAuth,
    signOut,
    signIn,
    signInWithGoogle
  } = useAppState();
  const route = useLocation();
  const destination = safeDest(
    route.state?.from ||
      new URLSearchParams(route.search).get("next")
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() =>
    authCallbackError(route.search, window.location.hash)
  );
  const [pending, setPending] = useState("");
  const message = error || authError;

  if (authLoading) return <AuthLoading />;
  if (mfaRequired) return <MfaChallenge />;
  if (hasSession && !user)
    return (
      <Screen title="Sign-in check" chrome={false}>
        <p className="error" role="alert">
          {message ||
            "Unable to check account security. Please try again."}
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={() =>
            refreshAuth().catch((failure) =>
              setError(authErrorMessage(failure))
            )
          }>
          Try again
        </button>
        <button
          className="btn ghost"
          type="button"
          onClick={() =>
            signOut().catch((failure) =>
              setError(authErrorMessage(failure))
            )
          }>
          Sign out
        </button>
      </Screen>
    );
  if (user) {
    if (!location) {
      return (
        <Navigate
          to="/location"
          replace
          state={{ from: destination }}
        />
      );
    }
    return <Navigate to={destination || "/"} replace />;
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (pending) return;
    setError("");
    if (!email.trim().includes("@")) {
      setError("Enter an email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setPending("password");
    try {
      await signIn({ email, password });
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

  return (
    <Screen title="Sign in" chrome={false}>
      <div className="auth">
        <div className="auth-brand">
          <div className="logo-mark" aria-hidden="true" />
          <h1>Price Pantry</h1>
          <p className="lede">
            Find the cheapest groceries near you and split your
            list across stores.
          </p>
        </div>
        <div className="auth-panel">
          <form className="form" onSubmit={onSubmit}>
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
                autoComplete="current-password"
                required
                disabled={Boolean(pending)}
                aria-invalid={Boolean(message)}
                aria-describedby={
                  message ? "sign-in-error" : undefined
                }
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
            </label>
            {message ? (
              <p
                id="sign-in-error"
                className="error"
                role="alert">
                {message}
              </p>
            ) : null}
            <div className="actions">
              <button
                className="btn primary"
                type="submit"
                disabled={Boolean(pending)}
                aria-busy={pending === "password"}>
                {pending === "password"
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </div>
          </form>
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
              to="/sign-up"
              state={{ from: destination }}>
              No account? Create one
            </Link>
          </p>
        </div>
      </div>
    </Screen>
  );
}
