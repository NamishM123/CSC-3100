import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Screen from "../components/Screen.jsx";
import { useAppState } from "../state/useAppState.js";

export default function SignUp() {
  const { user, location, signIn } = useAppState();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) {
    return (
      <Navigate to={location ? "/" : "/location"} replace />
    );
  }

  function onSubmit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!email.includes("@")) {
      setError("Enter an email address.");
      return;
    }
    if (password.length < 4) {
      setError("Use at least 4 characters.");
      return;
    }
    signIn({ name: name.trim(), email: email.trim() });
  }

  return (
    <Screen title="Create account" chrome={false}>
      <div className="auth">
        <div className="auth-brand">
          <div className="logo-mark" aria-hidden="true" />
          <h1>Create an account</h1>
          <p className="lede">
            Save lists and come back to the same searches.
          </p>
        </div>
        <div className="auth-panel">
          <form className="form" onSubmit={onSubmit} noValidate>
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
              />
            </label>
            {error ? (
              <p className="error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="btn primary" type="submit">
              Create account
            </button>
          </form>
          <p className="center">
            <Link className="text-link" to="/sign-in">
              Already have an account? Sign in
            </Link>
          </p>
        </div>
      </div>
    </Screen>
  );
}
