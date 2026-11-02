// Each explicit test is a new notification. Reusing a tag silently replaces
// the previous one in many browsers instead of showing a fresh alert.
export function createTestNotification(source = "browser") {
  return {
    id: `price-pantry-test:${globalThis.crypto.randomUUID()}`,
    title: "Price Pantry notifications are working",
    body:
      source === "server"
        ? "This test was sent by your local server."
        : "This test came from the app running on this device.",
    url: "/profile"
  };
}
