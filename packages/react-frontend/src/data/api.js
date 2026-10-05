// Reads Supabase when both Vite env vars are set. Any
// missing config or failed query leaves that collection
// null so the UI keeps src/data/mock.js.
//
// Expected tables and columns (see mock.js for examples):
// store_chains: id, name, code
// stores: id, chain_id, name, address, city, state, zip,
//   latitude, longitude, distance_mi, drive_minutes, hours_label
// products: id, name, short_name, list_unit, category,
//   size_label, unit_amount, unit, dietary, dietary_conflicts,
//   dietary_verified, also_try, keywords
// prices: id, store_id, product_id, price, regular_price,
//   unit_price, unit, is_member_price, is_sale, in_stock,
//   updated_at, source
// shopping_lists: id, name, owner_name, shared_with
// shopping_list_items: id, list_id, product_id, quantity, checked
// price_history (optional): id, product_id, store_id,
//   recorded_on, price

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    }
  }
  return [];
}

function num(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function asPeople(value) {
  return asArray(value).map((person) => {
    if (typeof person === "string") {
      return {
        name: person,
        initial: person.slice(0, 1).toUpperCase()
      };
    }
    const name = person.name || "Member";
    return {
      name,
      initial: person.initial || name.slice(0, 1).toUpperCase()
    };
  });
}

function normalizeChain(row) {
  return { ...row };
}

function normalizeStore(row) {
  return {
    ...row,
    distance_mi: num(row.distance_mi) ?? 0,
    drive_minutes: num(row.drive_minutes) ?? 0,
    latitude: num(row.latitude),
    longitude: num(row.longitude)
  };
}

function normalizeProduct(row) {
  return {
    ...row,
    unit_amount: num(row.unit_amount),
    dietary: asArray(row.dietary),
    dietary_conflicts: asArray(row.dietary_conflicts),
    also_try: asArray(row.also_try),
    keywords: asArray(row.keywords),
    dietary_verified: Boolean(row.dietary_verified)
  };
}

function normalizePrice(row) {
  const price = num(row.price);
  return {
    ...row,
    price,
    regular_price:
      row.regular_price == null
        ? price
        : num(row.regular_price),
    unit_price:
      row.unit_price == null ? null : num(row.unit_price),
    is_member_price: Boolean(row.is_member_price),
    is_sale: Boolean(row.is_sale),
    in_stock: row.in_stock !== false && row.in_stock !== "false"
  };
}

function normalizeList(row) {
  return {
    ...row,
    shared_with: asPeople(row.shared_with)
  };
}

function normalizeItem(row) {
  return {
    ...row,
    quantity: num(row.quantity) ?? 1,
    checked: Boolean(row.checked)
  };
}

function normalizeHistory(row) {
  return {
    ...row,
    price: num(row.price)
  };
}

async function readTable(supabase, table) {
  const { data, error } = await supabase
    .from(table)
    .select("*");
  if (error) {
    console.warn(
      `Price Pantry could not read ${table}. Mock rows stay in use.`,
      error.message
    );
    return null;
  }
  return data;
}

export function supabaseConfigured() {
  return Boolean(
    import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_ANON_KEY
  );
}

export async function loadRemoteCatalog() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  try {
    const { createClient } =
      await import("@supabase/supabase-js");
    const supabase = createClient(url, key);
    const [
      storeChains,
      stores,
      products,
      prices,
      shoppingLists,
      shoppingListItems,
      priceHistory
    ] = await Promise.all([
      readTable(supabase, "store_chains"),
      readTable(supabase, "stores"),
      readTable(supabase, "products"),
      readTable(supabase, "prices"),
      readTable(supabase, "shopping_lists"),
      readTable(supabase, "shopping_list_items"),
      readTable(supabase, "price_history")
    ]);

    // Empty tables keep the mock catalog so a brand new
    // Supabase project does not blank the prototype. A table
    // replaces mock data once it has at least one row.
    return {
      store_chains: storeChains?.map(normalizeChain) ?? null,
      stores: stores?.map(normalizeStore) ?? null,
      products: products?.map(normalizeProduct) ?? null,
      prices: prices?.map(normalizePrice) ?? null,
      shopping_lists: shoppingLists?.map(normalizeList) ?? null,
      shopping_list_items:
        shoppingListItems?.map(normalizeItem) ?? null,
      price_history: priceHistory?.map(normalizeHistory) ?? null
    };
  } catch (error) {
    console.warn("Price Pantry is using mock data.", error);
    return null;
  }
}
