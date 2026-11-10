-- M1 tests: profile trigger, RLS, privilege escalation protection.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@test.dev', '{"full_name":"Alice A","phone":"0771234567"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@test.dev',   '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.dev', '{"full_name":"Ada Admin"}');
update public.profiles set role = 'admin' where email = 'admin@test.dev';

do $$ begin
  assert (select full_name from profiles where email='alice@test.dev') = 'Alice A', 'name from metadata';
  assert (select full_name from profiles where email='bob@test.dev') = 'bob', 'name fallback';
  assert (select count(*) from categories) >= 9, 'seed categories';
  assert (select count(*) from collection_points) = 3, 'seed collection points';
end $$;

-- As Alice
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from profiles) = 1, 'alice sees only own profile';
  assert public.is_admin() = false;
end $$;
update profiles set phone = '0700000000' where id = auth.uid();
do $$ begin
  begin
    update profiles set role = 'admin' where id = auth.uid();
    raise exception 'escalation should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform admin_update_user('00000000-0000-0000-0000-00000000000b', 'admin');
    raise exception 'non-admin rpc should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from lost_item_secrets;
    raise exception 'secrets must be unreadable';
  exception when insufficient_privilege then null;
  end;
end $$;
update profiles set phone = 'x' where id = '00000000-0000-0000-0000-00000000000b'; -- silently 0 rows
reset role;
do $$ begin
  assert (select phone from profiles where email='alice@test.dev') = '0700000000';
  assert (select phone from profiles where email='bob@test.dev') is null;
end $$;

-- As admin
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000ad';
do $$ begin
  assert (select count(*) from profiles) = 3, 'admin sees all';
  perform admin_update_user('00000000-0000-0000-0000-00000000000b', 'admin', true);
end $$;
reset role;
do $$ begin
  assert (select is_collection_officer from profiles where email='bob@test.dev');
  assert (select count(*) from audit_logs where action='UPDATED_USER_ROLE') = 1;
end $$;
\echo 'auth tests passed'
