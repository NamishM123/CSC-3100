-- Price Pantry live-lookup schema, matching schema.dbml.
-- Fresh Supabase projects only: run this file in the Supabase SQL Editor.
-- For an existing prototype, use migrations/202610280001_live_lookup_schema.sql.
-- Text IDs, nullability, and timestamps follow the DBML. Job states are enforced
-- from its status note. The application supplies IDs and observation times.
-- API pricing access depends on the team's Instacart endpoint permissions.

begin;

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

create table public.stores (
  id text primary key,
  retailer text not null,
  name text not null,
  address text,
  latitude numeric,
  longitude numeric
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

create table public.products (
  id text primary key,
  name text not null,
  size_label text
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

-- Users, searches, jobs, and cached observations are accessible only through
-- a trusted backend until user-specific Auth policies are designed. Never
-- expose the service_role key in the frontend.
alter table public.users enable row level security;
alter table public.search_requests enable row level security;
alter table public.stores enable row level security;
alter table public.fetch_jobs enable row level security;
alter table public.products enable row level security;
alter table public.price_results enable row level security;

create policy "Stores are publicly readable"
  on public.stores for select to anon, authenticated using (true);
create policy "Products are publicly readable"
  on public.products for select to anon, authenticated using (true);

commit;
