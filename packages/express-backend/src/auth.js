function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

// Validate with Auth before interpreting the JWT. Never authorize a decoded
// bearer token by itself, or trust MFA flags sent in a request body.
export async function verifiedSession(token, getUser) {
  if (!token) throw failure(401, "Sign in to continue.");
  const user = await getUser(token);
  if (!user?.id)
    throw failure(
      401,
      "Your session is invalid or expired. Sign in again."
    );
  let claims;
  try {
    claims = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(
        "utf8"
      )
    );
  } catch {
    throw failure(
      401,
      "Your session is invalid or expired. Sign in again."
    );
  }
  if (claims?.sub !== user.id)
    throw failure(
      401,
      "Your session is invalid or expired. Sign in again."
    );
  if (
    (user.factors || []).some(
      (factor) => factor.status === "verified"
    ) &&
    claims.aal !== "aal2"
  ) {
    throw failure(
      403,
      "Complete two-factor authentication to continue."
    );
  }
  return {
    id: user.id,
    email: user.email,
    assuranceLevel: claims.aal || "aal1"
  };
}

async function getSupabaseUser(token) {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY;
  if (!url || !key)
    throw failure(
      503,
      "Authentication is temporarily unavailable."
    );
  const base = new URL(url);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(
    base.hostname
  );
  if (
    base.username ||
    base.password ||
    base.search ||
    base.hash ||
    (base.protocol !== "https:" &&
      !(
        process.env.NODE_ENV !== "production" &&
        local &&
        base.protocol === "http:"
      ))
  ) {
    throw failure(
      503,
      "Authentication is temporarily unavailable."
    );
  }
  const response = await fetch(
    `${base.href.replace(/\/$/, "")}/auth/v1/user`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${token}`
      },
      redirect: "error",
      signal: AbortSignal.timeout(10000)
    }
  );
  if ([401, 403].includes(response.status)) return null;
  if (!response.ok)
    throw failure(
      503,
      "Authentication is temporarily unavailable."
    );
  return response.json();
}

export function requireAuth({
  getUser = getSupabaseUser
} = {}) {
  return async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const token = req.headers.authorization?.match(
      /^Bearer ([^\s]+)$/i
    )?.[1];
    try {
      req.user = await verifiedSession(token, getUser);
      next();
    } catch (error) {
      res.status(error.status || 503).json({
        error: error.status
          ? error.message
          : "Authentication is temporarily unavailable."
      });
    }
  };
}
