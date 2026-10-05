import { useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { useAppState } from "../state/useAppState.js";
import { safeDest } from "../lib/format.js";

const WRONG_PASSWORD = "wrongpassword";

export default function SignIn() {
  const { user, location, signIn } = useAppState();
  const route = useLocation();
  const [email, setEmail] = useState("namish@calpoly.edu");
  const [password, setPassword] = useState("password");
  const [error, setError] = useState("");

  if (user) {
    const dest = safeDest(route.state?.from);
    if (!location) {
      return (
        <Navigate
          to="/location"
          replace
          state={{ from: dest }}
        />
      );
    }
    return <Navigate to={dest || "/"} replace />;
  }

  function continueWith(account) {
    signIn(account);
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!email.includes("@")) {
      setError("Enter an email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (password === WRONG_PASSWORD) {
      setError("Wrong password. Try again.");
      return;
    }
    const local = email.split("@")[0];
    const name =
      local.toLowerCase() === "namish" ? "Namish" : local;
    continueWith({ email, name });
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
          <form className="form" onSubmit={onSubmit} noValidate>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
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
                autoComplete="current-password"
                aria-invalid={
                  error === "Wrong password. Try again."
                }
                aria-describedby={
                  error ? "sign-in-error" : undefined
                }
                className={
                  error === "Wrong password. Try again."
                    ? "invalid"
                    : undefined
                }
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
              />
            </label>
            {error ? (
              <p
                id="sign-in-error"
                className="error"
                role="alert">
                {error}
              </p>
            ) : null}
            <div className="actions">
              <button className="btn primary" type="submit">
                Sign in
              </button>
            </div>
          </form>
          <div className="actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() =>
                continueWith({
                  email: "namish@calpoly.edu",
                  name: "Namish"
                })
              }>
              Continue with Google
            </button>
          </div>
          <p className="center">
            <Link className="text-link" to="/sign-up">
              No account? Create one
            </Link>
          </p>
          <button
            className="btn ghost demo"
            type="button"
            onClick={() => {
              setPassword(WRONG_PASSWORD);
              setError("Wrong password. Try again.");
            }}>
            Demo branch: sign in with wrong password
          </button>
        </div>
      </div>
    </Screen>
  );
}
