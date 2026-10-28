// Writes a normalized catalog into Supabase using the service role
// key. Upserts on the primary key so re-running ingestion refreshes
// prices in place instead of creating duplicates. Order matters:
// chains and products are referenced by stores and prices, so they
// go first.

const WRITE_ORDER = ["store_chains", "stores", "products", "prices"];

export async function createWriter(config) {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(
    config.supabase.url,
    config.supabase.serviceKey,
    { auth: { persistSession: false } }
  );
  return new SupabaseWriter(client);
}

export class SupabaseWriter {
  constructor(client) {
    this.client = client;
  }

  async write(catalog) {
    const written = {};
    for (const table of WRITE_ORDER) {
      const rows = catalog[table] || [];
      if (rows.length === 0) {
        written[table] = 0;
        continue;
      }
      const { error } = await this.client
        .from(table)
        .upsert(rows, { onConflict: "id" });
      if (error) {
        throw new Error(
          `Supabase upsert into ${table} failed: ${error.message}`
        );
      }
      written[table] = rows.length;
    }
    return written;
  }
}
