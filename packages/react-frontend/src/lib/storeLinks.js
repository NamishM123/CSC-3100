export function storeItemsPath(store) {
  const path = `/stores/${encodeURIComponent(store.id)}`;
  return ["kroger", "openstreetmap"].includes(store.source)
    ? `${path}?source=${store.source}`
    : path;
}
