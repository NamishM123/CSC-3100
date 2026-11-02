import Screen from "./Screen.jsx";
import MfaCodeForm from "./MfaCodeForm.jsx";
import authenticatorHelpQr from "../assets/authenticator-help-qr.svg";
import { useAppState } from "../state/useAppState.js";

const AUTHENTICATOR_HELP_URL =
  "https://support.google.com/accounts/answer/1066447";

export default function MfaChallenge() {
  const { mfaFactors, verifyMfa, signOut } = useAppState();
  return (
    <Screen title="Two-factor authentication" chrome={false}>
      <div className="auth">
        <div className="auth-panel">
          <h1>Verify your sign-in</h1>
          <p>
            {mfaFactors.length
              ? "Enter the six-digit code from your authenticator app."
              : "This account has a second factor this app cannot verify. Contact support for help."}
          </p>
          {mfaFactors.length ? (
            <aside
              className="mfa-help"
              aria-labelledby="mfa-help-heading">
              <h2 id="mfa-help-heading">
                Need help finding your code?
              </h2>
              <img
                className="mfa-qr"
                src={authenticatorHelpQr}
                width="196"
                height="196"
                alt="QR code linking to the Google Authenticator help guide"
              />
              <p className="fine">
                Scan with your phone&apos;s camera for
                authenticator instructions, or open the guide
                below.
              </p>
              <a
                className="text-link"
                href={AUTHENTICATOR_HELP_URL}
                target="_blank"
                rel="noopener noreferrer">
                Open authenticator help
              </a>
              <p className="fine">
                To sign in, open your authenticator app and
                enter the current code for Price Pantry below.
              </p>
            </aside>
          ) : null}
          <MfaCodeForm
            factors={mfaFactors}
            onVerify={verifyMfa}
            onCancel={signOut}
            cancelLabel="Use a different account"
          />
          <p className="fine">
            Lost your authenticator? Restore its backup, choose
            another enrolled authenticator, or contact support.
          </p>
        </div>
      </div>
    </Screen>
  );
}
