-- ════════════════════════════════════════════════════════════════════════
-- M3 — Matching Engine
--
-- Score (spec §19), each component 0..1 × weight:
--   category    10  exact category_id
--   brand       15  pg_trgm similarity
--   model       15  pg_trgm similarity
--   color       10  exact (case-insensitive); 0.5 if one contains the other
--   location    20  exact location_id
--   date        10  1 within a day, linear decay to 0 at 7 days
--   description 20  0.5 × trigram + 0.5 × semantic (Gemini embeddings)
-- Exact identifier match (HMAC equality, spec §18A) → 100.
-- Candidates scoring ≥ 40 are stored in match_candidates (many-to-many).
-- Matching never decides ownership (spec §20): it only opens candidates.
-- ════════════════════════════════════════════════════════════════════════

-- ─── Vector indexes for semantic search ─────────────────────────────────

create index idx_lost_items_embedding on public.lost_items
  using hnsw (description_embedding extensions.vector_cosine_ops);
create index idx_found_items_embedding on public.found_items
  using hnsw (description_embedding extensions.vector_cosine_ops);

-- Trigram indexes speed up fuzzy brand/model/title comparisons.
create index idx_lost_items_title_trgm  on public.lost_items  using gin (title extensions.gin_trgm_ops);
create index idx_found_items_title_trgm on public.found_items using gin (title extensions.gin_trgm_ops);

create index idx_match_candidates_lost  on public.match_candidates (lost_item_id, status);
create index idx_match_candidates_found on public.match_candidates (found_item_id);
create index idx_match_candidates_open  on public.match_candidates (status, score desc);

-- ─── RLS on match_candidates ────────────────────────────────────────────

create policy "Matches: lost-item owner or admin can read"
  on public.match_candidates for select
  using (public.owns_lost_item(lost_item_id) or public.is_admin());

create policy "Matches: admins can update"
  on public.match_candidates for update
  using (public.is_admin())
  with check (public.is_admin());

-- Candidates are written by the engine (service role) only.
revoke insert, update, delete on public.match_candidates from anon, authenticated;
grant update (status) on public.match_candidates to authenticated;

-- ─── Scoring ────────────────────────────────────────────────────────────

-- Gemini embeddings are anisotropic: unrelated texts still score ~0.5–0.6
-- cosine similarity. Rescale so 0.55 → 0 and ≥ 0.90 → 1 before blending.
create or replace function public.rescale_semantic(cosine_similarity double precision)
returns double precision
language sql immutable
as $$
  select least(1.0, greatest(0.0, (cosine_similarity - 0.55) / 0.35));
$$;

create or replace function public.text_trgm(a text, b text)
returns double precision
language sql immutable
set search_path = public, extensions
as $$
  select case
    when nullif(trim(a), '') is null or nullif(trim(b), '') is null then 0.0
    when lower(trim(a)) = lower(trim(b)) then 1.0
    else similarity(lower(trim(a)), lower(trim(b)))::double precision
  end;
$$;

create or replace function public.color_score(a text, b text)
returns double precision
language sql immutable
as $$
  select case
    when nullif(trim(a), '') is null or nullif(trim(b), '') is null then 0.0
    when lower(trim(a)) = lower(trim(b)) then 1.0
    when position(lower(trim(a)) in lower(trim(b))) > 0
      or position(lower(trim(b)) in lower(trim(a))) > 0 then 0.5
    else 0.0
  end;
$$;

-- Scores every candidate pair for one item. Exactly one of the arguments
-- is non-null. Returns pairs regardless of threshold.
create or replace function public.score_match_pairs(p_lost_id uuid, p_found_id uuid)
returns table (lost_item_id uuid, found_item_id uuid, score numeric, score_breakdown jsonb)
language sql stable
security definer
set search_path = public, extensions
as $$
  with pairs as (
    select
      l.id as l_id, f.id as f_id,
      l.category_id as l_cat, f.category_id as f_cat,
      l.location_id as l_loc, f.location_id as f_loc,
      l.brand as l_brand, f.brand as f_brand,
      l.model as l_model, f.model as f_model,
      l.color as l_color, f.color as f_color,
      l.title as l_title, f.title as f_title,
      l.description as l_desc, f.description as f_desc,
      (f.date_found - l.date_lost) as days_apart,
      case when l.description_embedding is not null and f.description_embedding is not null
           then 1 - (l.description_embedding <=> f.description_embedding) end as semantic,
      (ls.identifier_value_hmac is not null
        and ls.identifier_value_hmac = fs.identifier_value_hmac
        and l.identifier_type = f.identifier_type) as identifier_exact
    from public.lost_items l
    join public.found_items f on true
    left join public.lost_item_secrets ls on ls.lost_item_id = l.id
    left join public.found_item_secrets fs on fs.found_item_id = f.id
    where (p_lost_id is null or l.id = p_lost_id)
      and (p_found_id is null or f.id = p_found_id)
      and l.status in ('LOST', 'MATCHED')
      and f.status in ('FOUND', 'IN_STORAGE', 'MATCHED')
      and l.user_id <> f.finder_id
      -- Found no more than a day before it was lost, nor > 90 days after.
      and f.date_found >= l.date_lost - 1
      and f.date_found <= l.date_lost + 90
  ),
  parts as (
    select
      l_id, f_id, identifier_exact, days_apart, semantic,
      (l_cat = f_cat)::int::double precision                         as s_category,
      text_trgm(l_brand, f_brand)                                    as s_brand,
      text_trgm(l_model, f_model)                                    as s_model,
      color_score(l_color, f_color)                                  as s_color,
      (l_loc = f_loc)::int::double precision                         as s_location,
      case when abs(days_apart) <= 1 then 1.0
           else greatest(0.0, 1.0 - (abs(days_apart) - 1) / 6.0) end as s_date,
      greatest(text_trgm(l_title, f_title), text_trgm(l_desc, f_desc)) as s_trigram
    from pairs
  ),
  scored as (
    select *,
      case when semantic is null then s_trigram
           else 0.5 * s_trigram + 0.5 * rescale_semantic(semantic) end as s_description
    from parts
  )
  select
    l_id,
    f_id,
    case when identifier_exact then 100.00
    else round((
        10 * s_category + 15 * s_brand + 15 * s_model + 10 * s_color
      + 20 * s_location + 10 * s_date + 20 * s_description)::numeric, 2)
    end,
    jsonb_build_object(
      'category', jsonb_build_object('score', round(s_category::numeric, 3), 'weight', 10, 'contribution', round((10 * s_category)::numeric, 2), 'method', 'exact'),
      'brand',    jsonb_build_object('score', round(s_brand::numeric, 3),    'weight', 15, 'contribution', round((15 * s_brand)::numeric, 2),    'method', 'trigram'),
      'model',    jsonb_build_object('score', round(s_model::numeric, 3),    'weight', 15, 'contribution', round((15 * s_model)::numeric, 2),    'method', 'trigram'),
      'color',    jsonb_build_object('score', round(s_color::numeric, 3),    'weight', 10, 'contribution', round((10 * s_color)::numeric, 2),    'method', 'exact'),
      'location', jsonb_build_object('score', round(s_location::numeric, 3), 'weight', 20, 'contribution', round((20 * s_location)::numeric, 2), 'method', 'exact'),
      'date',     jsonb_build_object('score', round(s_date::numeric, 3),     'weight', 10, 'contribution', round((10 * s_date)::numeric, 2),     'method', 'decay',
                                     'days_apart', days_apart),
      'description', jsonb_build_object(
                    'score', round(s_description::numeric, 3), 'weight', 20,
                    'contribution', round((20 * s_description)::numeric, 2),
                    'method', case when semantic is null then 'trigram' else 'blend' end,
                    'trigram_similarity', round(s_trigram::numeric, 3),
                    'semantic_similarity', round(semantic::numeric, 3)),
      'semantic_similarity', round(semantic::numeric, 3),
      'identifier_exact', identifier_exact
    )
  from scored;
$$;

-- Runs matching for one item and stores candidates. Returns only the
-- candidates that are NEW (so the caller can notify their owners).
create or replace function public.run_matching(p_item_type text, p_item_id uuid, p_threshold numeric default 40)
returns table (id uuid, lost_item_id uuid, found_item_id uuid, score numeric, owner_id uuid)
language plpgsql
security definer
set search_path = public, extensions
as $$
#variable_conflict use_column
begin
  if p_item_type not in ('lost', 'found') then
    raise exception 'item_type must be lost or found' using errcode = '22023';
  end if;

  drop table if exists _scores;
  create temporary table _scores on commit drop as
    select * from public.score_match_pairs(
      case when p_item_type = 'lost' then p_item_id end,
      case when p_item_type = 'found' then p_item_id end);

  -- Refresh scores of existing OPEN candidates (e.g. after an edit).
  update public.match_candidates mc
  set score = s.score, score_breakdown = s.score_breakdown
  from _scores s
  where mc.lost_item_id = s.lost_item_id
    and mc.found_item_id = s.found_item_id
    and mc.status = 'OPEN';

  return query
  with inserted as (
    insert into public.match_candidates (lost_item_id, found_item_id, score, score_breakdown)
    select s.lost_item_id, s.found_item_id, s.score, s.score_breakdown
    from _scores s
    where s.score >= p_threshold
    on conflict on constraint match_candidates_lost_item_id_found_item_id_key do nothing
    returning match_candidates.id, match_candidates.lost_item_id,
              match_candidates.found_item_id, match_candidates.score
  ),
  bump_lost as (
    update public.lost_items li set status = 'MATCHED'
    where li.id in (select i.lost_item_id from inserted i) and li.status = 'LOST'
  ),
  bump_found as (
    update public.found_items fi set status = 'MATCHED'
    where fi.id in (select i.found_item_id from inserted i) and fi.status = 'FOUND'
  )
  select i.id, i.lost_item_id, i.found_item_id, i.score, li.user_id
  from inserted i
  join public.lost_items li on li.id = i.lost_item_id;
end;
$$;

revoke execute on function public.score_match_pairs(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.run_matching(text, uuid, numeric) from public, anon, authenticated;
grant execute on function public.score_match_pairs(uuid, uuid) to service_role;
grant execute on function public.run_matching(text, uuid, numeric) to service_role;

-- ─── "Not my item": owner dismisses a candidate ─────────────────────────

create or replace function public.dismiss_match(p_match_id uuid)
returns public.match_candidates
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.match_candidates;
begin
  select * into m from public.match_candidates where id = p_match_id for update;
  if m.id is null or not (public.owns_lost_item(m.lost_item_id) or public.is_admin()) then
    raise exception 'Match not found' using errcode = 'P0002';
  end if;
  if m.status <> 'OPEN' then
    raise exception 'This match has already been %', lower(m.status) using errcode = '22023';
  end if;

  -- Never deleted: dismissed candidates stay for the audit trail (spec §22).
  update public.match_candidates set status = 'DISMISSED' where id = p_match_id returning * into m;

  update public.lost_items li set status = 'LOST'
  where li.id = m.lost_item_id and li.status = 'MATCHED'
    and not exists (select 1 from public.match_candidates
                    where lost_item_id = m.lost_item_id and status = 'OPEN');

  update public.found_items fi set status = case when fi.collection_point_id is null then 'FOUND' else 'IN_STORAGE' end
  where fi.id = m.found_item_id and fi.status = 'MATCHED'
    and not exists (select 1 from public.match_candidates
                    where found_item_id = m.found_item_id and status = 'OPEN');

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'DISMISSED_MATCH', 'match_candidate', m.id,
          jsonb_build_object('score', m.score));
  return m;
end;
$$;

revoke execute on function public.dismiss_match(uuid) from public, anon;
grant execute on function public.dismiss_match(uuid) to authenticated;
