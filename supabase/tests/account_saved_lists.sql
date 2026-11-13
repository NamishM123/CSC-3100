-- Run in the Supabase SQL Editor after the saved-list migration.
-- Uses real RLS roles; all fixture users and lists roll back.
begin;
select set_config('test_lists.alice', gen_random_uuid()::text, true);
select set_config('test_lists.bob', gen_random_uuid()::text, true);
insert into auth.users (id) values
  (current_setting('test_lists.alice')::uuid),
  (current_setting('test_lists.bob')::uuid);

do $$ begin
  if has_table_privilege('anon', 'public.account_list_state', 'select') then
    raise exception 'Anonymous role must not read saved lists';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test_lists.alice'),
  'role', 'authenticated', 'aal', 'aal1'
)::text, true);
insert into public.account_list_state (user_id, document)
values (auth.uid(), '{"lists":[{"id":"test-list","name":"Private"}],"items":[]}'::jsonb);

do $$ begin
  if (select count(*) from public.account_list_state) <> 1 then
    raise exception 'Owner must be able to read their saved lists';
  end if;
  begin
    insert into public.account_list_state (user_id)
      values (current_setting('test_lists.bob')::uuid);
    raise exception 'Cross-account insert must fail';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test_lists.bob'),
  'role', 'authenticated', 'aal', 'aal1'
)::text, true);
do $$
declare changed integer;
begin
  if exists (select 1 from public.account_list_state) then
    raise exception 'Another account must not see private lists';
  end if;
  update public.account_list_state set document = '{"lists":[],"items":[]}'::jsonb
    where user_id = current_setting('test_lists.alice')::uuid;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-account update must affect zero rows'; end if;
  delete from public.account_list_state where user_id = current_setting('test_lists.alice')::uuid;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Cross-account delete must affect zero rows'; end if;
end $$;

select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('test_lists.alice'),
  'role', 'authenticated', 'aal', 'aal1'
)::text, true);
do $$ begin
  update public.account_list_state set revision = revision + 1 where user_id = auth.uid();
  if not found then raise exception 'Owner must be able to update'; end if;
  delete from public.account_list_state where user_id = auth.uid();
  if not found then raise exception 'Owner must be able to delete'; end if;
end $$;
rollback;
