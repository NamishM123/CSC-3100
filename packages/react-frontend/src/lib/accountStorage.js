const PREFIX = "price-pantry-account:";
const FIELDS = [
  "location",
  "lists",
  "items",
  "activeListId",
  "justAddedProductId",
  "recentSearches",
  "listsDirty",
  "includeMember",
  "suggestSwaps",
  "acceptedSwapIds",
  "saleNotifications",
  "dietary",
  "alerts",
  "routePlan",
  "radiusMi"
];

function persistable(state) {
  return Object.fromEntries(
    FIELDS.filter((key) => Object.hasOwn(state, key)).map(
      (key) => [key, state[key]]
    )
  );
}

export function loadAccountState(storage, userId) {
  if (!userId) return {};
  try {
    const state = JSON.parse(storage.getItem(PREFIX + userId));
    return state &&
      typeof state === "object" &&
      !Array.isArray(state)
      ? persistable(state)
      : {};
  } catch {
    return {};
  }
}

export function saveAccountState(storage, userId, state) {
  if (!userId) return;
  try {
    storage.setItem(
      PREFIX + userId,
      JSON.stringify(persistable(state))
    );
  } catch {
    /* Private browsing or full storage should not break the app. */
  }
}

export function clearAccountState(storage, userId) {
  try {
    if (userId) storage.removeItem(PREFIX + userId);
    storage.removeItem("price-pantry-demo");
  } catch {
    /* Local sign-out still proceeds. */
  }
}
