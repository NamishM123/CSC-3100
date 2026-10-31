import { appUser } from "./auth.js";

export async function readMfaSession(client, session) {
  if (!session)
    return {
      user: null,
      hasSession: false,
      mfaRequired: false,
      mfaFactors: []
    };
  // Validate this exact token with Auth and read current factors, not a stale
  // user/factor list from browser storage.
  const [identity, assurance] = await Promise.all([
    client.auth.getUser(session.access_token),
    client.auth.mfa.getAuthenticatorAssuranceLevel(
      session.access_token
    )
  ]);
  if (identity.error) throw identity.error;
  if (assurance.error) throw assurance.error;
  if (
    !identity.data.user ||
    identity.data.user.id !== session.user.id
  )
    throw new Error(
      "Unable to verify your session. Please sign in again."
    );
  const verified = (identity.data.user.factors || []).filter(
    (factor) => factor.status === "verified"
  );
  const mfaRequired =
    verified.length > 0 &&
    assurance.data.currentLevel !== "aal2";
  return {
    user: mfaRequired ? null : appUser(identity.data.user),
    hasSession: true,
    mfaRequired,
    mfaFactors: verified.filter(
      (factor) => factor.factor_type === "totp"
    )
  };
}

export async function verifyTotp(client, factorId, code) {
  if (!/^\d{6}$/.test(code))
    throw new Error(
      "Enter the six-digit code from your authenticator app."
    );
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId,
    code
  });
  if (error) throw error;
}

export async function enrollTotp(client) {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw error;
  for (const factor of data.all.filter(
    (factor) =>
      factor.factor_type === "totp" &&
      factor.status === "unverified"
  )) {
    const { error } = await client.auth.mfa.unenroll({
      factorId: factor.id
    });
    if (error) throw error;
  }
  const result = await client.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Price Pantry",
    friendlyName: `Price Pantry ${new Date().toISOString()}`
  });
  if (result.error) throw result.error;
  const qr = result.data.totp.qr_code;
  const svg = qr.startsWith("data:")
    ? qr.slice(qr.indexOf(",") + 1)
    : qr;
  return {
    ...result.data,
    totp: {
      ...result.data.totp,
      qr_code: svg.startsWith("<")
        ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
        : qr
    }
  };
}
