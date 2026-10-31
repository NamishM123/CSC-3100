import { useState } from "react";
import { authErrorMessage } from "../lib/auth.js";

export default function MfaCodeForm({
  factors,
  onVerify,
  onCancel,
  submitLabel = "Verify",
  cancelLabel = "Cancel"
}) {
  const [factorId, setFactorId] = useState(
    factors[0]?.id || ""
  );
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onVerify(factorId, code);
      setCode("");
    } catch (failure) {
      setCode("");
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="form" onSubmit={submit}>
      {factors.length > 1 ? (
        <label className="field">
          <span>Authenticator</span>
          <select
            value={factorId}
            disabled={busy}
            onChange={(event) =>
              setFactorId(event.target.value)
            }>
            {factors.map((factor, index) => (
              <option key={factor.id} value={factor.id}>
                {factor.friendly_name ||
                  `Authenticator ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="field">
        <span>Authenticator code</span>
        <input
          name="totp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
          disabled={busy}
          value={code}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? "mfa-code-error" : undefined
          }
          onChange={(event) => {
            setCode(
              event.target.value.replace(/\D/g, "").slice(0, 6)
            );
            setError("");
          }}
        />
      </label>
      {error ? (
        <p id="mfa-code-error" className="error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <button
          className="btn primary"
          type="submit"
          disabled={busy || !factorId}
          aria-busy={busy}>
          {busy ? "Verifying..." : submitLabel}
        </button>
        {onCancel ? (
          <button
            className="btn ghost"
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                await onCancel();
              } catch (failure) {
                setError(authErrorMessage(failure));
              } finally {
                setBusy(false);
              }
            }}>
            {cancelLabel}
          </button>
        ) : null}
      </div>
    </form>
  );
}
