import { useEffect, useRef, useState } from "react";
import { authErrorMessage } from "../lib/auth.js";

export default function EmailVerificationDialog({
  email,
  onBackToLogin,
  onResend
}) {
  const dialog = useRef(null);
  const [secondsRemaining, setSecondsRemaining] = useState(60);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);

  useEffect(() => {
    if (!secondsRemaining) return;
    const timer = setTimeout(
      () => setSecondsRemaining((seconds) => seconds - 1),
      1000
    );
    return () => clearTimeout(timer);
  }, [secondsRemaining]);

  async function resend() {
    if (pending || secondsRemaining) return;
    setPending(true);
    setError("");
    setStatus("");
    try {
      await onResend();
      setStatus("A new verification email has been sent.");
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setSecondsRemaining(60);
      setPending(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="verification-dialog"
      aria-labelledby="verification-title"
      aria-describedby="verification-description"
      onCancel={(event) => {
        event.preventDefault();
        onBackToLogin();
      }}>
      <div className="stack">
        <h2 id="verification-title">Verification email sent</h2>
        <p id="verification-description">
          We sent a verification link to{" "}
          <strong>{email}</strong>. Open the email and verify
          your address, then return to the login page to sign
          in.
        </p>
        <p className="muted">
          Can&apos;t find it? Check your spam or junk folder.
        </p>
        <button
          className="btn primary"
          type="button"
          onClick={onBackToLogin}>
          Back to login
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={pending || secondsRemaining > 0}
          aria-busy={pending}
          onClick={resend}>
          {pending
            ? "Sending verification email..."
            : secondsRemaining
              ? `Resend email in ${secondsRemaining}s`
              : "Resend verification email"}
        </button>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        {status ? <p role="status">{status}</p> : null}
      </div>
    </dialog>
  );
}
