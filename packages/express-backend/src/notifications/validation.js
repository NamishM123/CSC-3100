export function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function validateSubscription(value) {
  let endpoint;
  try {
    endpoint = new URL(value.endpoint);
  } catch {
    throw httpError(400, "Invalid push subscription.");
  }
  const host = endpoint.hostname;
  const allowed =
    host === "fcm.googleapis.com" ||
    host === "web.push.apple.com" ||
    host === "updates.push.services.mozilla.com" ||
    host.endsWith(".push.services.mozilla.com") ||
    host.endsWith(".notify.windows.com");
  if (
    !allowed ||
    endpoint.protocol !== "https:" ||
    endpoint.username ||
    endpoint.password ||
    endpoint.hash ||
    (endpoint.port && endpoint.port !== "443") ||
    endpoint.href.length > 2048
  )
    throw httpError(400, "Unsupported push endpoint.");
  const validKey = (key, length) =>
    typeof key === "string" &&
    /^[A-Za-z0-9_-]+={0,2}$/.test(key) &&
    Buffer.from(key, "base64url").length === length;
  if (
    !validKey(value.keys?.p256dh, 65) ||
    Buffer.from(value.keys.p256dh, "base64url")[0] !== 4 ||
    !validKey(value.keys?.auth, 16)
  )
    throw httpError(400, "Invalid push keys.");
  return {
    endpoint: endpoint.href,
    keys: { p256dh: value.keys.p256dh, auth: value.keys.auth }
  };
}

export function validateWatch(value) {
  const id = (value) =>
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128;
  const numeric = (value) =>
    typeof value === "number" && Number.isFinite(value);
  if (
    !value ||
    !Array.isArray(value.productIds) ||
    value.productIds.length > 200 ||
    !value.productIds.every(id) ||
    !numeric(value.location?.latitude) ||
    Math.abs(value.location.latitude) > 90 ||
    !numeric(value.location?.longitude) ||
    Math.abs(value.location.longitude) > 180 ||
    !numeric(value.radiusMi) ||
    value.radiusMi <= 0 ||
    value.radiusMi > 50 ||
    typeof value.includeMember !== "boolean" ||
    typeof value.demo !== "boolean" ||
    !Array.isArray(value.alerts) ||
    value.alerts.length > 100 ||
    !value.alerts.every(
      (alert) =>
        id(alert.productId) &&
        numeric(alert.below) &&
        alert.below > 0 &&
        alert.below <= 10000
    )
  ) {
    throw httpError(
      400,
      "Invalid notification watch. Check your location, radius, and saved items."
    );
  }
  return {
    productIds: [...new Set(value.productIds)],
    location: {
      latitude: value.location.latitude,
      longitude: value.location.longitude
    },
    radiusMi: value.radiusMi,
    includeMember: value.includeMember,
    demo: value.demo,
    alerts: value.alerts.map(({ productId, below }) => ({
      productId,
      below
    }))
  };
}
