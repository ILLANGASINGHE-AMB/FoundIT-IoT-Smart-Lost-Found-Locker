-- M5 tests: notification RLS, audit log access, stats/analytics, expiry.
\set alice '00000000-0000-0000-0000-00000000000a'
\set bob   '00000000-0000-0000-0000-00000000000b'
\set admin '00000000-0000-0000-0000-0000000000ad'

insert into notifications (user_id, title, message, type) values
  (:'alice', 'Match!', 'A match was found', 'MATCH'),
  (:'alice', 'Claim', 'Claim approved', 'CLAIM'),
  (:'bob',   'Hi Bob', 'For bob only', 'SYSTEM');

-- Users only see and update their own notifications; cannot create any.
set role authenticated;
set request.jwt.claim.sub = :'alice';
do $$
declare s jsonb;
begin
  assert (select count(*) from notifications) = 2, 'alice sees own notifications';
  assert (select count(*) from audit_logs) = 0, 'users cannot read audit logs';
  begin
    insert into notifications (user_id, title, message) values (auth.uid(), 'x', 'y');
    raise exception 'clients must not create notifications';
  exception when insufficient_privilege then null;
  end;
  begin
    update notifications set title = 'changed';
    raise exception 'only is_read is updatable';
  exception when insufficient_privilege then null;
  end;
  s := user_dashboard_stats();
  assert (s ->> 'unread_notifications')::int = 2, s::text;
  assert (s ->> 'open_matches')::int = 1, s::text;     -- Alice's re-opened calculator match
  assert (s ->> 'lost_items')::int = 2, s::text;
  begin
    perform admin_dashboard_stats();
    raise exception 'non-admin stats must fail';
  exception when insufficient_privilege then null;
  end;
  begin
    perform expire_unclaimed_items();
    raise exception 'non-admin expiry must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
update notifications set is_read = true;  -- marks only her own
reset role;
do $$ begin
  assert (select count(*) from notifications where is_read) = 2;
  assert (select is_read from notifications where title = 'Hi Bob') = false;
end $$;

-- Admin: stats, analytics, audit log access.
set role authenticated;
set request.jwt.claim.sub = :'admin';
do $$
declare s jsonb; a jsonb;
begin
  s := admin_dashboard_stats();
  assert (s ->> 'users')::int = 3, s::text;
  assert (s ->> 'lost_items')::int = 4, s::text;
  assert (s ->> 'open_matches')::int = 1, s::text;
  assert s ? 'recovery_rate';
  a := admin_analytics(6);
  assert jsonb_array_length(a -> 'monthly') = 6, a::text;
  assert jsonb_array_length(a -> 'by_category') >= 2, a::text;
  assert (a -> 'kpis' ->> 'total_found')::int = 2, a::text;
  assert (select count(*) from audit_logs) > 0, 'admin reads audit logs';
  assert (select count(*) from notifications) = 3, 'admin reads all notifications';
end $$;
reset role;

-- Expiry: only overdue, unclaimed found items; open candidates dismissed.
update found_items set retention_expires_at = now() - interval '1 day'
  where id = '22222222-2222-2222-2222-222222222222';  -- MATCHED, has an OPEN candidate
do $$ begin
  assert expire_unclaimed_items() = 1;
  assert (select status from found_items where id = '22222222-2222-2222-2222-222222222222') = 'UNCLAIMED_EXPIRED';
  assert (select status from match_candidates where found_item_id = '22222222-2222-2222-2222-222222222222') = 'DISMISSED';
  assert (select count(*) from audit_logs where action = 'EXPIRED_UNCLAIMED_ITEM') = 1;
  assert (select count(*) from notifications where title = 'Unclaimed items expired') = 1, 'admin notified';
  assert expire_unclaimed_items() = 0, 'idempotent';
end $$;
\echo 'admin tests passed'

-- Bulk status change: admin only, audited, CHECK constraints still apply.
set role authenticated;
set request.jwt.claim.sub = :'alice';
do $$ begin
  begin
    perform admin_set_item_status('lost', array['44444444-4444-4444-4444-444444444444']::uuid[], 'CANCELLED');
    raise exception 'non-admin bulk update must fail';
  exception when insufficient_privilege then null;
  end;
end $$;
set request.jwt.claim.sub = :'admin';
do $$ begin
  assert admin_set_item_status('lost', array['44444444-4444-4444-4444-444444444444']::uuid[], 'CANCELLED') = 1;
  begin
    perform admin_set_item_status('lost', array['44444444-4444-4444-4444-444444444444']::uuid[], 'NOT_A_STATUS');
    raise exception 'invalid status must fail';
  exception when check_violation then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select status from lost_items where id = '44444444-4444-4444-4444-444444444444') = 'CANCELLED';
  assert (select count(*) from audit_logs where action = 'ADMIN_SET_ITEM_STATUS') = 1;
end $$;
\echo 'admin bulk status tests passed'
