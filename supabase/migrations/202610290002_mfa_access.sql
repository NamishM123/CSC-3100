-- Safe to apply to either schema variant, with or without the push feature.
-- Re-runnable, including after creating additional protected tables below.
begin;

create or replace function public.mfa_access_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    coalesce(auth.jwt()->>'aal', 'aal1') = 'aal2'
    or not exists (
      select 1 from auth.mfa_factors
      where user_id = auth.uid() and status = 'verified'
    )
  );
$$;
revoke all on function public.mfa_access_allowed() from public, anon, authenticated;
grant execute on function public.mfa_access_allowed() to anon, authenticated;

-- This function accepts no user ID and exposes only the caller's access boolean.
-- A restrictive policy cannot grant access or replace an ownership policy.
do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'users', 'search_requests', 'fetch_jobs', 'price_results',
    'shopping_lists', 'shopping_list_items', 'push_subscriptions', 'push_deliveries'
  ] loop
    if to_regclass(format('public.%I', protected_table)) is not null then
      execute format('alter table public.%I enable row level security', protected_table);
      execute format('drop policy if exists "Require enrolled MFA" on public.%I', protected_table);
      execute format(
        'create policy "Require enrolled MFA" on public.%I as restrictive for all to anon, authenticated using ((select public.mfa_access_allowed())) with check ((select public.mfa_access_allowed()))',
        protected_table
      );
      -- Prototype lists have no reliable ownership column. Keep them closed to
      -- browser clients until explicit owner/member policies are designed.
      if protected_table in ('shopping_lists', 'shopping_list_items') then
        execute format('drop policy if exists "Require list ownership implementation" on public.%I', protected_table);
        execute format(
          'create policy "Require list ownership implementation" on public.%I as restrictive for all to anon, authenticated using (false) with check (false)',
          protected_table
        );
      end if;
    end if;
  end loop;
end;
$$;

-- Public product/store/price catalog access is unchanged. Service-role workers
-- bypass RLS and must enforce MFA and ownership in every user-facing API.
commit;
