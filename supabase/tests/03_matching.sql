-- M3 tests: scoring, thresholds, identifier exact match, RLS, dismissal.
-- Reuses users from 01 and items from 02 (Alice's lost Casio 1111…,
-- Bob's found calculator 2222…).
\set alice '00000000-0000-0000-0000-00000000000a'
\set bob   '00000000-0000-0000-0000-00000000000b'
\set admin '00000000-0000-0000-0000-0000000000ad'

set role service_role;
-- Similar embeddings for the two calculators (cosine ≈ 0.99).
update lost_items  set description_embedding = '{0.9,0.1,0.2,0.1}' where id = '11111111-1111-1111-1111-111111111111';
update found_items set description_embedding = '{0.88,0.12,0.21,0.1}' where id = '22222222-2222-2222-2222-222222222222';

-- Bob also lost something identical-looking: must never match his own find.
insert into lost_items (id, user_id, category_id, location_id, title, description, brand, color, date_lost)
select '33333333-3333-3333-3333-333333333333', :'bob', c.id, l.id,
       'Casio calculator', 'Black Casio scientific calculator', 'Casio', 'Black', current_date - 1
from categories c, locations l where c.name='Electronics' and l.name='Lecture Hall A';

-- An unrelated report: different category, location, a week+ apart.
insert into lost_items (id, user_id, category_id, location_id, title, description, color, date_lost)
select '44444444-4444-4444-4444-444444444444', :'admin', c.id, l.id,
       'Red umbrella', 'Folding umbrella with wooden handle', 'Red', current_date - 9
from categories c, locations l where c.name='Water Bottles & Umbrellas' and l.name='Sports Complex';
reset role;

-- Matching is service-role only.
set role authenticated;
set request.jwt.claim.sub = :'alice';
do $$ begin
  begin
    perform * from run_matching('found', '22222222-2222-2222-2222-222222222222');
    raise exception 'users must not run matching';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

set role service_role;
create temp table r1 as select * from run_matching('found', '22222222-2222-2222-2222-222222222222');
reset role;
do $$
declare m record;
begin
  assert (select count(*) from r1) = 1, format('expected 1 new candidate, got %s', (select count(*) from r1));
  select * into m from match_candidates where lost_item_id = '11111111-1111-1111-1111-111111111111';
  assert m.score >= 75, format('calculator score too low: %s', m.score); -- model blank on both sides → 0 of 15
  assert (m.score_breakdown -> 'description' ->> 'method') = 'blend';
  assert (m.score_breakdown ->> 'semantic_similarity')::numeric > 0.95;
  assert (m.score_breakdown -> 'location' ->> 'contribution')::numeric = 20;
  assert (select owner_id from r1) = '00000000-0000-0000-0000-00000000000a';
  assert not exists (select 1 from match_candidates where lost_item_id = '33333333-3333-3333-3333-333333333333'), 'no self match';
  assert not exists (select 1 from match_candidates where lost_item_id = '44444444-4444-4444-4444-444444444444'), 'umbrella below threshold';
  assert (select status from lost_items where id = '11111111-1111-1111-1111-111111111111') = 'MATCHED';
  assert (select status from found_items where id = '22222222-2222-2222-2222-222222222222') = 'MATCHED';
  raise notice 'calculator match score: %', m.score;
end $$;

-- Idempotent: re-running creates nothing new.
set role service_role;
do $$ begin
  assert (select count(*) from run_matching('found', '22222222-2222-2222-2222-222222222222')) = 0, 'rerun must not duplicate';
  assert (select count(*) from run_matching('lost', '11111111-1111-1111-1111-111111111111')) = 0, 'reverse direction no dup';
end $$;

-- Exact identifier match → 100 even with a vague description.
insert into lost_items (id, user_id, category_id, location_id, title, description, identifier_type, date_lost)
select '55555555-5555-5555-5555-555555555555', :'alice', c.id, l.id,
       'Student ID card', 'My ID card', 'STUDENT_ID', current_date - 3
from categories c, locations l where c.name='Documents' and l.name='Main Canteen';
insert into lost_item_secrets (lost_item_id, identifier_value_hmac) values ('55555555-5555-5555-5555-555555555555', 'hmac-xyz');
insert into found_items (id, finder_id, category_id, location_id, title, description, identifier_type, date_found)
select '66666666-6666-6666-6666-666666666666', :'admin', c.id, l.id,
       'Card', 'Plastic card found on the floor', 'STUDENT_ID', current_date
from categories c, locations l where c.name='Other' and l.name='Bus Stop';
insert into found_item_secrets (found_item_id, identifier_value_hmac) values ('66666666-6666-6666-6666-666666666666', 'hmac-xyz');
do $$ begin
  assert (select score from run_matching('found', '66666666-6666-6666-6666-666666666666')) = 100, 'identifier exact = 100';
end $$;
reset role;

-- RLS: Alice sees her 2 candidates, Bob sees none.
set role authenticated;
set request.jwt.claim.sub = :'bob';
do $$ begin
  assert (select count(*) from match_candidates) = 0, 'bob sees no candidates';
end $$;
set request.jwt.claim.sub = :'alice';
do $$ begin
  assert (select count(*) from match_candidates) = 2, 'alice sees her candidates';
end $$;
-- Direct status edits by a non-admin silently affect 0 rows (admin-only policy).
update match_candidates set status = 'CONVERTED_TO_CLAIM';
do $$ begin
  assert (select count(*) from match_candidates where status = 'OPEN') = 2;
  perform dismiss_match((select id from match_candidates where lost_item_id = '55555555-5555-5555-5555-555555555555'));
  begin
    perform dismiss_match((select id from match_candidates where lost_item_id = '55555555-5555-5555-5555-555555555555'));
    raise exception 'double dismiss should fail';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select status from lost_items where id = '55555555-5555-5555-5555-555555555555') = 'LOST', 'reverts to LOST';
  assert (select status from found_items where id = '66666666-6666-6666-6666-666666666666') = 'FOUND', 'found reverts';
  assert (select count(*) from audit_logs where action = 'DISMISSED_MATCH') = 1;
  -- Dismissed candidates are kept, and are not resurrected by re-running.
  assert (select count(*) from match_candidates where status = 'DISMISSED') = 1;
end $$;
set role service_role;
do $$ begin
  assert (select count(*) from run_matching('lost', '55555555-5555-5555-5555-555555555555')) = 0, 'no resurrection';
end $$;
reset role;
\echo 'matching tests passed'
