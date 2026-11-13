export function storeItemsPath(store) {
  const path = `/stores/${encodeURIComponent(store.id)}`;
  return ["kroger", "openstreetmap", "weekly-ads"].includes(
    store.source
  )
    ? `${path}?source=${store.source}`
    : path;
}
