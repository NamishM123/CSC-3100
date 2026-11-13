-- Apply after 202610290002_mfa_access.sql, on either schema variant.
begin;
create table if not exists public.account_list_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null default '{"lists":[],"items":[]}'::jsonb,
  revision bigint not null default 1 check (revision > 0),
  constraint list_document_shape check (
    jsonb_typeof(document) = 'object'
    and document ? 'lists' and document ? 'items'
    and jsonb_typeof(document->'lists') = 'array'
    and jsonb_typeof(document->'items') = 'array'
    and octet_length(document::text) <= 1048576
  )
);
alter table public.account_list_state enable row level security;
revoke all on public.account_list_state from anon, authenticated;
grant select, insert, update, delete on public.account_list_state to authenticated;
drop policy if exists "Own saved lists" on public.account_list_state;
create policy "Own saved lists" on public.account_list_state
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
drop policy if exists "Require enrolled MFA" on public.account_list_state;
create policy "Require enrolled MFA" on public.account_list_state
  as restrictive for all to authenticated
  using ((select public.mfa_access_allowed()))
  with check ((select public.mfa_access_allowed()));
comment on table public.account_list_state is
  'Account-owned shopping intent and store SKU choices. Never a price cache.';
commit;
