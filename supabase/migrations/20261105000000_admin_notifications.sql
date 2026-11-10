-- ════════════════════════════════════════════════════════════════════════
-- M5 — Admin Dashboard & Notifications
--   notifications · audit_logs · stats/analytics RPCs · unclaimed expiry
-- ════════════════════════════════════════════════════════════════════════

-- ─── notifications ──────────────────────────────────────────────────────

create policy "Notifications: users read own, admins read all"
  on public.notifications for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Notifications: users mark own as read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Notifications: users delete own"
  on public.notifications for delete
  using (user_id = auth.uid());

-- Rows are created by Edge Functions / server code only.
revoke insert, update on public.notifications from anon, authenticated;
grant update (is_read) on public.notifications to authenticated;

create index idx_notifications_user_unread on public.notifications (user_id, is_read, created_at desc);
create index idx_notifications_user_type   on public.notifications (user_id, type, created_at desc);

-- ─── audit_logs (admin read-only; written with the service role) ────────

create policy "Audit logs: admins read"
  on public.audit_logs for select
  using (public.is_admin());

revoke insert, update, delete on public.audit_logs from anon, authenticated;

create index idx_audit_logs_action_created on public.audit_logs (action, created_at desc);
create index idx_audit_logs_created        on public.audit_logs (created_at desc);

-- ─── Realtime: live bell + admin activity feed (RLS applies) ────────────

do $$
begin
  alter publication supabase_realtime add table public.notifications;
  alter publication supabase_realtime add table public.audit_logs;
exception
  when undefined_object then raise notice 'supabase_realtime publication not found; skipping';
  when duplicate_object then null;
end $$;

-- ─── User dashboard counts (RLS-scoped, security invoker) ───────────────

create or replace function public.user_dashboard_stats()
returns jsonb
language sql stable
set search_path = public
as $$
  select jsonb_build_object(
    'lost_items',   (select count(*) from lost_items  where user_id = auth.uid() and status <> 'CANCELLED'),
    'found_items',  (select count(*) from found_items where finder_id = auth.uid()),
    'open_matches', (select count(*) from match_candidates mc
                       join lost_items li on li.id = mc.lost_item_id
                      where li.user_id = auth.uid() and mc.status = 'OPEN'),
    'active_claims',(select count(*) from claims
                      where claimant_id = auth.uid() and status in ('PENDING', 'UNDER_REVIEW', 'APPROVED')),
    'ready_to_collect', (select count(*) from claims where claimant_id = auth.uid() and status = 'APPROVED'),
    'unread_notifications', (select count(*) from notifications
                              where user_id = auth.uid() and not is_read and channel = 'IN_APP')
  );
$$;

revoke execute on function public.user_dashboard_stats() from public, anon;
grant execute on function public.user_dashboard_stats() to authenticated;

-- ─── Admin dashboard stats ──────────────────────────────────────────────

create or replace function public.admin_dashboard_stats()
returns jsonb
language plpgsql stable
security definer
set search_path = public
as $$
declare
  resolved bigint;
  reportable bigint;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  select count(*) filter (where status = 'RESOLVED'),
         count(*) filter (where status <> 'CANCELLED')
    into resolved, reportable
  from lost_items;

  return jsonb_build_object(
    'users',               (select count(*) from profiles),
    'lost_items',          (select count(*) from lost_items),
    'found_items',         (select count(*) from found_items),
    'open_matches',        (select count(*) from match_candidates where status = 'OPEN'),
    'pending_claims',      (select count(*) from claims where status in ('PENDING', 'UNDER_REVIEW')),
    'locked_claims',       (select count(*) from claims where is_locked),
    'ready_for_collection',(select count(*) from claims where status = 'APPROVED'),
    'resolved_cases',      resolved,
    'unclaimed_expired',   (select count(*) from found_items where status = 'UNCLAIMED_EXPIRED'),
    'items_in_storage',    (select count(*) from found_items where status in ('IN_STORAGE', 'CLAIM_PENDING', 'CLAIMED')),
    'recovery_rate',       case when reportable = 0 then 0
                                else round(100.0 * resolved / reportable, 1) end
  );
end;
$$;

revoke execute on function public.admin_dashboard_stats() from public, anon;
grant execute on function public.admin_dashboard_stats() to authenticated;

-- ─── Admin analytics (spec §41 "Analytics") ─────────────────────────────

create or replace function public.admin_analytics(p_months integer default 6)
returns jsonb
language plpgsql stable
security definer
set search_path = public
as $$
declare
  since date := (date_trunc('month', now()) - make_interval(months => greatest(p_months, 1) - 1))::date;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'since', since,

    'by_category', coalesce((
      select jsonb_agg(row_to_json(t) order by t.total desc)
      from (
        select c.name,
               (select count(*) from lost_items  l where l.category_id = c.id and l.created_at >= since) as lost,
               (select count(*) from found_items f where f.category_id = c.id and f.created_at >= since) as found,
               (select count(*) from lost_items  l where l.category_id = c.id and l.created_at >= since)
             + (select count(*) from found_items f where f.category_id = c.id and f.created_at >= since) as total
        from categories c
      ) t where t.total > 0), '[]'::jsonb),

    'by_location', coalesce((
      select jsonb_agg(row_to_json(t) order by t.total desc)
      from (
        select loc.name,
               (select count(*) from lost_items  l where l.location_id = loc.id and l.created_at >= since)
             + (select count(*) from found_items f where f.location_id = loc.id and f.created_at >= since) as total
        from locations loc
      ) t where t.total > 0), '[]'::jsonb),

    'monthly', coalesce((
      select jsonb_agg(row_to_json(t) order by t.month)
      from (
        select to_char(m, 'YYYY-MM') as month,
               (select count(*) from lost_items  where date_trunc('month', created_at) = m) as lost,
               (select count(*) from found_items where date_trunc('month', created_at) = m) as found,
               (select count(*) from claims where status = 'COMPLETED' and date_trunc('month', completed_at) = m) as recovered,
               case when (select count(*) from lost_items where date_trunc('month', created_at) = m and status <> 'CANCELLED') = 0
                    then 0
                    else round(100.0 *
                      (select count(*) from lost_items where date_trunc('month', created_at) = m and status = 'RESOLVED')
                      / (select count(*) from lost_items where date_trunc('month', created_at) = m and status <> 'CANCELLED'), 1)
               end as recovery_rate
        from generate_series(since::timestamptz, date_trunc('month', now()), interval '1 month') as m
      ) t), '[]'::jsonb),

    'claim_status', coalesce((
      select jsonb_agg(row_to_json(t))
      from (select status, count(*) as count from claims group by status) t), '[]'::jsonb),

    'kpis', jsonb_build_object(
      'total_lost',  (select count(*) from lost_items),
      'total_found', (select count(*) from found_items),
      'matched',     (select count(distinct lost_item_id) from match_candidates),
      'recovered',   (select count(*) from claims where status = 'COMPLETED'),
      'avg_recovery_hours', (
        select round(avg(extract(epoch from (c.completed_at - li.created_at)) / 3600)::numeric, 1)
        from claims c join lost_items li on li.id = c.lost_item_id
        where c.status = 'COMPLETED'),
      'unclaimed_expiry_rate', (
        select case when count(*) = 0 then 0
               else round(100.0 * count(*) filter (where status = 'UNCLAIMED_EXPIRED') / count(*), 1) end
        from found_items where retention_expires_at < now() or status in ('RETURNED', 'UNCLAIMED_EXPIRED'))
    )
  );
end;
$$;

revoke execute on function public.admin_analytics(integer) from public, anon;
grant execute on function public.admin_analytics(integer) to authenticated;

-- ─── Unclaimed item expiry (scheduled) ──────────────────────────────────

create or replace function public.expire_unclaimed_items()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_ids uuid[];
  n integer;
begin
  -- Admins may trigger it manually. pg_cron and the service role call it
  -- without a user JWT (auth.uid() is null); anon has no EXECUTE grant.
  -- (current_user can't be used here: SECURITY DEFINER makes it the owner.)
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  with expired as (
    update found_items
    set status = 'UNCLAIMED_EXPIRED'
    where retention_expires_at < now()
      and status in ('FOUND', 'IN_STORAGE', 'MATCHED')
    returning id, title, collection_point_id
  ), logged as (
    insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
    select auth.uid(), 'EXPIRED_UNCLAIMED_ITEM', 'found_item', e.id,
           jsonb_build_object('title', e.title, 'collection_point_id', e.collection_point_id)
    from expired e
    returning entity_id
  )
  select array_agg(entity_id) into expired_ids from logged;

  n := coalesce(array_length(expired_ids, 1), 0);
  if n = 0 then
    return 0;
  end if;

  update match_candidates set status = 'DISMISSED'
  where found_item_id = any (expired_ids) and status = 'OPEN';

  insert into notifications (user_id, title, message, type, link)
  select p.id,
         'Unclaimed items expired',
         format('%s found item(s) passed their retention period and were marked unclaimed.', n),
         'SYSTEM',
         '/admin/items?tab=found&status=UNCLAIMED_EXPIRED'
  from profiles p where p.role = 'admin';

  return n;
end;
$$;

revoke execute on function public.expire_unclaimed_items() from public, anon;
grant execute on function public.expire_unclaimed_items() to authenticated, service_role;

-- Daily at 00:00 UTC via pg_cron (available on Supabase). Skipped when the
-- extension is not installable (e.g. plain local Postgres).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('foundit-expire-unclaimed-items', '0 0 * * *',
                          'select public.expire_unclaimed_items()');
  else
    raise notice 'pg_cron not available; schedule expire_unclaimed_items() manually';
  end if;
end $$;

-- ─── Admin bulk item status change (audited) ────────────────────────────

create or replace function public.admin_set_item_status(p_kind text, p_ids uuid[], p_status text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  if p_kind = 'lost' then
    update lost_items set status = p_status where id = any (p_ids) and status <> p_status;
  elsif p_kind = 'found' then
    update found_items set status = p_status where id = any (p_ids) and status <> p_status;
  else
    raise exception 'p_kind must be lost or found' using errcode = '22023';
  end if;
  get diagnostics n = row_count;

  insert into audit_logs (user_id, action, entity_type, entity_id, metadata)
  select auth.uid(), 'ADMIN_SET_ITEM_STATUS', p_kind || '_item', id, jsonb_build_object('status', p_status)
  from unnest(p_ids) as id;

  return n;
end;
$$;

revoke execute on function public.admin_set_item_status(text, uuid[], text) from public, anon;
grant execute on function public.admin_set_item_status(text, uuid[], text) to authenticated;
