-- Upgrade the original Price Pantry prototype to the schema.dbml lookup model.
-- Apply once to a database initialized with the original supabase/schema.sql.
-- This migration keeps all existing tables, columns, rows, and demo policies.
-- Legacy prices/history/lists are retained; they are not fabricated into new
-- API observations, which require real search, job, source, and expiry context.
-- The existing frontend can continue reading legacy tables while its data
-- layer is updated. Fresh databases should use supabase/schema.sql instead.

begin;

-- Retailer is the only required DBML column missing from the existing stores.
-- Prefer the known chain name; use the store name for stores without a chain.
alter table public.stores add column retailer text;
update public.stores as store
set retailer = coalesce(chain.name, store.name)
from public.store_chains as chain
where store.chain_id = chain.id;
update public.stores set retailer = name where retailer is null;
alter table public.stores alter column retailer set not null;

create table public.users (
  id text primary key,
  name text
);

create table public.search_requests (
  id text primary key,
  user_id text not null references public.users(id),
  query text not null,
  zip text not null,
  radius_mi numeric not null,
  requested_at timestamptz not null
);

create table public.fetch_jobs (
  id text primary key,
  search_request_id text not null references public.search_requests(id),
  store_id text not null references public.stores(id),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  error_message text
);

create table public.price_results (
  id text primary key,
  fetch_job_id text not null references public.fetch_jobs(id),
  product_id text not null references public.products(id),
  price numeric not null,
  currency text not null,
  unit_caption text,
  in_stock boolean,
  source_url text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null
);

create index search_requests_user_id_requested_at_idx
  on public.search_requests(user_id, requested_at desc);
create index search_requests_query_location_idx
  on public.search_requests(query, zip, radius_mi);
create index fetch_jobs_search_request_id_idx
  on public.fetch_jobs(search_request_id);
create index fetch_jobs_store_id_idx on public.fetch_jobs(store_id);
create index price_results_fetch_job_id_idx on public.price_results(fetch_job_id);
create index price_results_product_id_expires_at_idx
  on public.price_results(product_id, expires_at);
create index price_results_expires_at_idx on public.price_results(expires_at);

comment on table public.fetch_jobs is
  'Tracks API lookup work. Keep jobs while price results reference them.';
comment on table public.products is
  'Products recorded as they are discovered through live API lookups.';
comment on table public.price_results is
  'Temporary cached observations; store context comes from fetch_job_id.';
comment on column public.price_results.in_stock is
  'Null means availability is unknown.';
comment on column public.price_results.expires_at is
  'Application code must ignore expired rows and workers must clean them up.';

-- Foreign keys deliberately do not cascade: delete cached results before their
-- jobs, then search requests. Deleting a search must not silently delete cache.
-- No scheduler or automatic expiration is created by this schema.

-- Existing stores/products already have RLS and public demo read policies.
-- New tables have no client policies: access them through the trusted backend.
alter table public.users enable row level security;
alter table public.search_requests enable row level security;
alter table public.fetch_jobs enable row level security;
alter table public.price_results enable row level security;

commit;
