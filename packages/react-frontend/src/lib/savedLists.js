// Persist shopping intent and SKU choices, never price observations.
export function listDocument(state = {}) {
  const lists = (state.lists || [])
    .filter((list) => list.id !== "list-weekly")
    .map(({ id, name }) => ({ id, name }));
  const ids = new Set(lists.map((list) => list.id));
  const items = (state.items || [])
    .filter((item) => ids.has(item.list_id))
    .map((item) => {
      const fields = [
        "id",
        "list_id",
        "product_id",
        "query",
        "name",
        "image_url",
        "size_label",
        "quantity",
        "checked",
        "storeSelections"
      ];
      return Object.fromEntries(
        fields
          .filter((key) => Object.hasOwn(item, key))
          .map((key) => [key, item[key]])
      );
    });
  return {
    lists,
    items,
    activeListId: ids.has(state.activeListId)
      ? state.activeListId
      : lists[0]?.id || null,
    krogerPriceWeight: state.krogerPriceWeight ?? 0.7
  };
}

export class ListConflictError extends Error {
  constructor() {
    super(
      "Your lists changed on another device. Reload saved lists before editing again."
    );
    this.name = "ListConflictError";
  }
}

// Writes are serialized. A revision check prevents one tab/device from
// silently overwriting changes saved by another.
export class SavedListRepository {
  constructor(client, userId) {
    this.client = client;
    this.userId = userId;
    this.revision = null;
    this.baseline = null;
    this.queue = Promise.resolve();
    this.loaded = false;
    this.loadSequence = 0;
  }

  async load() {
    if (!this.client || !this.userId)
      throw new Error("Sign in to load saved lists.");
    const sequence = ++this.loadSequence;
    const { data, error } = await this.client
      .from("account_list_state")
      .select("document, revision")
      .eq("user_id", this.userId)
      .maybeSingle();
    if (error)
      throw new Error(
        "Unable to load your saved lists. Please retry."
      );
    if (sequence !== this.loadSequence)
      return data ? listDocument(data.document) : null;
    this.revision = data?.revision ?? null;
    this.baseline = data
      ? JSON.stringify(listDocument(data.document))
      : null;
    this.loaded = true;
    return data ? listDocument(data.document) : null;
  }

  save(state) {
    const document = listDocument(state);
    const task = this.queue.then(async () => {
      if (!this.loaded)
        throw new Error("Load your saved lists before saving.");
      const serialized = JSON.stringify(document);
      if (serialized === this.baseline) return;
      const revision = (this.revision ?? 0) + 1;
      const table = this.client.from("account_list_state");
      const request =
        this.revision === null
          ? table.insert({
              user_id: this.userId,
              document,
              revision
            })
          : table
              .update({ document, revision })
              .eq("user_id", this.userId)
              .eq("revision", this.revision);
      const { data, error } = await request
        .select("revision")
        .maybeSingle();
      if (error?.code === "23505" || (!error && !data))
        throw new ListConflictError();
      if (error)
        throw new Error(
          "Unable to save your lists. Keep this tab open and retry."
        );
      this.revision = data.revision;
      this.baseline = serialized;
    });
    this.queue = task.catch(() => {});
    return task;
  }
}
