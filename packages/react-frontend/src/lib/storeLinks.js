export function storeItemsPath(store) {
  const path = `/stores/${encodeURIComponent(store.id)}`;
  return store.source === "kroger"
    ? `${path}?source=kroger`
    : path;
}
