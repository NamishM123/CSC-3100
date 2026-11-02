import { useState } from "react";
import { useAppState } from "../state/useAppState.js";
import { getSupabaseClient } from "../lib/supabase.js";
import { enrollTotp, verifyTotp } from "../lib/mfa.js";
import { authErrorMessage } from "../lib/auth.js";
import MfaCodeForm from "./MfaCodeForm.jsx";

export default function MfaSettings() {
  const { mfaFactors, refreshAuth } = useAppState();
  const [enrollment, setEnrollment] = useState(null);
  const [removing, setRemoving] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const client = getSupabaseClient();
  async function start() {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      setEnrollment(await enrollTotp(client));
    } catch (failure) {
      setError(authErrorMessage(failure));
    } finally {
      setBusy(false);
    }
  }
  async function cancelSetup() {
    const { error } = await client.auth.mfa.unenroll({
      factorId: enrollment.id
    });
    if (error) throw error;
    setEnrollment(null);
  }
  return (
    <section
      className="profile-block"
      aria-labelledby="mfa-heading">
      <h2 id="mfa-heading">Two-factor authentication</h2>
      <p className="muted">
        {mfaFactors.length
          ? "On. An authenticator code is required when you sign in."
          : "Add an authenticator code to protect your account."}
      </p>
      {enrollment ? (
        <div className="stack">
          <p>
            Scan this QR code with Google Authenticator,
            Microsoft Authenticator, or another authenticator
            app.
          </p>
          <img
            className="mfa-qr"
            src={enrollment.totp.qr_code}
            width="220"
            height="220"
            alt="QR code to set up Price Pantry in your authenticator app"
          />
          <details>
            <summary>Can&apos;t scan the code?</summary>
            <p>
              Enter this setup key in your authenticator app:
            </p>
            <code className="mfa-secret">
              {enrollment.totp.secret}
            </code>
          </details>
          <p className="fine">
            Keep a secure authenticator backup before enabling.
            Price Pantry does not issue recovery codes.
          </p>
          <MfaCodeForm
            factors={[{ id: enrollment.id }]}
            submitLabel="Enable two-factor authentication"
            onCancel={cancelSetup}
            onVerify={async (factorId, code) => {
              await verifyTotp(client, factorId, code);
              setEnrollment(null);
              setStatus("Two-factor authentication enabled.");
              await refreshAuth();
            }}
          />
        </div>
      ) : removing ? (
        <div className="stack">
          <p>
            {mfaFactors.length === 1
              ? "Removing this authenticator turns off two-factor authentication. Enter its current code to confirm."
              : "Enter this authenticator's current code to remove it."}
          </p>
          <MfaCodeForm
            factors={[removing]}
            submitLabel="Remove authenticator"
            onCancel={() => setRemoving(null)}
            onVerify={async (factorId, code) => {
              await verifyTotp(client, factorId, code);
              const { error } = await client.auth.mfa.unenroll({
                factorId
              });
              if (error) throw error;
              setRemoving(null);
              setStatus("Authenticator removed.");
              const refreshed =
                await client.auth.refreshSession();
              if (refreshed.error) throw refreshed.error;
              await refreshAuth();
            }}
          />
        </div>
      ) : (
        <>
          {mfaFactors.map((factor, index) => (
            <div className="section-title" key={factor.id}>
              <span>Authenticator {index + 1}</span>
              <button
                className="text-link"
                type="button"
                disabled={busy}
                onClick={() => {
                  setRemoving(factor);
                  setStatus("");
                  setError("");
                }}>
                Remove
              </button>
            </div>
          ))}
          <button
            className="text-link"
            type="button"
            disabled={busy}
            onClick={start}>
            {busy
              ? "Preparing setup..."
              : mfaFactors.length
                ? "Add another authenticator"
                : "Set up two-factor authentication"}
          </button>
        </>
      )}
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
    </section>
  );
}
