import { useState } from "react";
import { authErrorMessage } from "../lib/auth.js";
import { useAppState } from "../state/useAppState.js";

export default function ResendVerification({
  email,
  destination
}) {
  const { resendVerification } = useAppState();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function resend() {
    if (pending) return;
    setError("");
    setSentTo("");
    setPending(true);
    const address = email.trim();
    try {
      await resendVerification(address, destination);
      setSentTo(address);
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <button
        className="text-link"
        type="button"
        disabled={pending}
        aria-busy={pending}
        onClick={resend}>
        {pending ? "Sending..." : "Resend verification email"}
      </button>
      {sentTo ? (
        <p className="fine" role="status">
          If {sentTo} has an unconfirmed account, a new
          verification link has been sent. Check your inbox and
          spam folder.
        </p>
      ) : null}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
