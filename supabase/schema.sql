-- Price Pantry's initial Supabase schema.
-- Run this file in the Supabase SQL Editor for a new project.
-- Text IDs are intentional: they match the existing mock IDs, such as
-- "prod-bananas" and "store-tj".

create table public.store_chains (
  id text primary key,
  name text not null,
  code text
);

create table public.stores (
  id text primary key,
  chain_id text references public.store_chains(id),
  name text not null,
  address text,
  city text,
  state text,
  zip text,
  latitude numeric,
  longitude numeric,
  distance_mi numeric,
  drive_minutes integer,
  hours_label text
);

create table public.products (
  id text primary key,
  name text not null,
  short_name text,
  list_unit text,
  category text,
  size_label text,
  unit_amount numeric,
  unit text,
  dietary jsonb not null default '[]'::jsonb,
  dietary_conflicts jsonb not null default '[]'::jsonb,
  dietary_verified boolean not null default false,
  also_try jsonb not null default '[]'::jsonb,
  keywords jsonb not null default '[]'::jsonb
);

create table public.prices (
  id text primary key,
  store_id text not null references public.stores(id),
  product_id text not null references public.products(id),
  price numeric not null,
  regular_price numeric,
  unit_price numeric,
  unit text,
  is_member_price boolean not null default false,
  is_sale boolean not null default false,
  in_stock boolean not null default true,
  updated_at timestamptz,
  source text
);

create table public.product_swaps (
  id text primary key,
  product_id text not null references public.products(id),
  store_id text not null references public.stores(id),
  name text not null,
  size_label text,
  price numeric not null
);

create table public.shopping_lists (
  id text primary key,
  name text not null,
  owner_name text,
  shared_with jsonb not null default '[]'::jsonb
);

create table public.shopping_list_items (
  id text primary key,
  list_id text not null references public.shopping_lists(id) on delete cascade,
  product_id text not null references public.products(id),
  quantity integer not null default 1 check (quantity > 0),
  checked boolean not null default false
);

create table public.price_history (
  id text primary key,
  product_id text not null references public.products(id),
  store_id text not null references public.stores(id),
  recorded_on date not null,
  price numeric not null
);

create index prices_product_id_idx on public.prices(product_id);
create index prices_store_id_idx on public.prices(store_id);
create index price_history_product_store_idx
  on public.price_history(product_id, store_id);
create index shopping_list_items_list_id_idx
  on public.shopping_list_items(list_id);

-- This prototype currently reads data directly from the browser. These
-- policies allow public, read-only demo data. Do not use these policies for
-- real users' private shopping lists; replace them with Auth-based policies
-- before adding persistent user accounts or write operations.
alter table public.store_chains enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.prices enable row level security;
alter table public.product_swaps enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.price_history enable row level security;

create policy "Demo catalog is publicly readable"
  on public.store_chains for select to anon using (true);
create policy "Demo stores are publicly readable"
  on public.stores for select to anon using (true);
create policy "Demo products are publicly readable"
  on public.products for select to anon using (true);
create policy "Demo prices are publicly readable"
  on public.prices for select to anon using (true);
create policy "Demo substitutes are publicly readable"
  on public.product_swaps for select to anon using (true);
create policy "Demo lists are publicly readable"
  on public.shopping_lists for select to anon using (true);
create policy "Demo list items are publicly readable"
  on public.shopping_list_items for select to anon using (true);
create policy "Demo price history is publicly readable"
  on public.price_history for select to anon using (true);
