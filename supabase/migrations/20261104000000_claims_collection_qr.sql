-- ════════════════════════════════════════════════════════════════════════
-- M4 — Claims, Collection & QR System
--   claims · claim_verifications · claim_attempts · collections ·
--   collection_points (QR slugs)
--
-- Every state change goes through Edge Functions (service role): clients
-- can read their own claim data but never write it directly, and can never
-- insert claim_attempts (rate-limit log, spec §31).
-- ════════════════════════════════════════════════════════════════════════

-- ─── claims ─────────────────────────────────────────────────────────────

create policy "Claims: claimant or admin can read"
  on public.claims for select
  using (claimant_id = auth.uid() or public.is_admin());

revoke insert, update, delete on public.claims from anon, authenticated;

-- One active claim per user per found item.
create unique index uq_claims_active_per_claimant
  on public.claims (found_item_id, claimant_id)
  where status in ('PENDING', 'UNDER_REVIEW', 'APPROVED');

create index idx_claims_claimant on public.claims (claimant_id, submitted_at desc);
create index idx_claims_status   on public.claims (status, submitted_at desc);
create index idx_claims_found    on public.claims (found_item_id);

-- ─── claim_verifications / claim_attempts / collections ─────────────────

create or replace function public.owns_claim(p_claim_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.claims where id = p_claim_id and claimant_id = auth.uid());
$$;

create policy "Verifications: claimant or admin can read"
  on public.claim_verifications for select
  using (public.owns_claim(claim_id) or public.is_admin());

create policy "Attempts: own attempts or admin"
  on public.claim_attempts for select
  using (attempted_by = auth.uid() or public.is_admin());

create policy "Collections: claimant or admin can read"
  on public.collections for select
  using (public.owns_claim(claim_id) or public.is_admin());

revoke insert, update, delete on public.claim_verifications from anon, authenticated;
revoke insert, update, delete on public.claim_attempts      from anon, authenticated;
revoke insert, update, delete on public.collections         from anon, authenticated;

create index idx_claim_attempts_window on public.claim_attempts (claim_id, created_at desc);
create index idx_claim_verifications_claim on public.claim_verifications (claim_id);

-- Failed verification attempts on a claim inside the rate-limit window.
create or replace function public.claim_failed_attempts(p_claim_id uuid, p_window interval default interval '24 hours')
returns integer
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.claim_attempts
  where claim_id = p_claim_id and result = 'FAILED' and created_at > now() - p_window;
$$;

revoke execute on function public.claim_failed_attempts(uuid, interval) from public, anon;
grant execute on function public.claim_failed_attempts(uuid, interval) to authenticated, service_role;

-- Fuzzy comparison for private-attribute answers ("scratch near AC button"
-- vs "small scratch beside the AC button").
create or replace function public.answer_similarity(answer text, expected text)
returns double precision
language sql immutable
set search_path = public, extensions
as $$
  select case
    when nullif(trim(answer), '') is null or nullif(trim(expected), '') is null then 0.0
    else greatest(
      similarity(lower(answer), lower(expected)),
      word_similarity(lower(answer), lower(expected)),
      word_similarity(lower(expected), lower(answer))
    )::double precision
  end;
$$;

revoke execute on function public.answer_similarity(text, text) from public, anon, authenticated;
grant execute on function public.answer_similarity(text, text) to service_role;

-- Claimant withdraws a claim that has not been approved yet.
create or replace function public.cancel_claim(p_claim_id uuid)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.claims;
begin
  select * into c from public.claims where id = p_claim_id for update;
  if c.id is null or c.claimant_id <> auth.uid() then
    raise exception 'Claim not found' using errcode = 'P0002';
  end if;
  if c.status not in ('PENDING', 'UNDER_REVIEW') then
    raise exception 'Only pending claims can be cancelled' using errcode = '22023';
  end if;

  update public.claims set status = 'CANCELLED', is_locked = false where id = c.id returning * into c;

  -- Re-open the candidate so the owner can try again later, and roll item
  -- statuses back if nothing else is in flight.
  update public.match_candidates set status = 'OPEN'
  where id = c.match_candidate_id and status = 'CONVERTED_TO_CLAIM';

  update public.lost_items set status = 'MATCHED'
  where id = c.lost_item_id and status = 'CLAIM_PENDING';

  update public.found_items fi
  set status = case when fi.collection_point_id is null then 'MATCHED' else 'IN_STORAGE' end
  where fi.id = c.found_item_id and fi.status = 'CLAIM_PENDING'
    and not exists (select 1 from public.claims o
                    where o.found_item_id = fi.id and o.id <> c.id
                      and o.status in ('PENDING', 'UNDER_REVIEW', 'APPROVED'));

  insert into public.audit_logs (user_id, action, entity_type, entity_id)
  values (auth.uid(), 'CANCELLED_CLAIM', 'claim', c.id);
  return c;
end;
$$;

revoke execute on function public.cancel_claim(uuid) from public, anon;
grant execute on function public.cancel_claim(uuid) to authenticated;

-- ─── collection_points (QR) ─────────────────────────────────────────────

create policy "Collection points: admins manage"
  on public.collection_points for all
  using (public.is_admin())
  with check (public.is_admin());

create index idx_collection_points_slug_active on public.collection_points (qr_slug) where qr_active;

-- Lowercase URL-safe slugs only (they are printed into QR codes).
alter table public.collection_points
  add constraint collection_points_qr_slug_format check (qr_slug ~ '^[a-z0-9_-]{6,32}$');
