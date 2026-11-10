-- M4 tests: claim RLS, write lockdown, cancel, uniqueness, answer
-- similarity, attempt counting, collection point admin + slug rules.
-- Reuses data from 01–03 (Alice's open match on Bob's found calculator).
\set alice '00000000-0000-0000-0000-00000000000a'
\set bob   '00000000-0000-0000-0000-00000000000b'
\set admin '00000000-0000-0000-0000-0000000000ad'

-- Private-answer fuzzy matching (threshold 0.45 in the Edge Function).
do $$
declare stored text := 'Scratch near AC button, blue sticker';
begin
  assert answer_similarity('scratch near the AC button', stored) >= 0.45, 'paraphrase passes';
  assert answer_similarity('Blue sticker', stored) >= 0.45, 'partial detail passes';
  assert answer_similarity('red case with my initials', stored) < 0.45,
    format('wrong answer must fail: %s', answer_similarity('red case with my initials', stored));
  assert answer_similarity('', stored) = 0;
end $$;

-- The Edge Function (service role) opens a claim from Alice's match.
set role service_role;
insert into claims (id, match_candidate_id, lost_item_id, found_item_id, claimant_id)
select '77777777-7777-7777-7777-777777777777', id, lost_item_id, found_item_id, :'alice'
from match_candidates where lost_item_id = '11111111-1111-1111-1111-111111111111';
update match_candidates set status = 'CONVERTED_TO_CLAIM' where lost_item_id = '11111111-1111-1111-1111-111111111111';
update lost_items set status = 'CLAIM_PENDING' where id = '11111111-1111-1111-1111-111111111111';
update found_items set status = 'CLAIM_PENDING' where id = '22222222-2222-2222-2222-222222222222';
insert into claim_attempts (claim_id, attempted_by, attempt_type, result) values
  ('77777777-7777-7777-7777-777777777777', :'alice', 'PRIVATE_ATTRIBUTE', 'FAILED'),
  ('77777777-7777-7777-7777-777777777777', :'alice', 'PRIVATE_ATTRIBUTE', 'FAILED'),
  ('77777777-7777-7777-7777-777777777777', :'alice', 'PRIVATE_ATTRIBUTE', 'PASSED');
do $$ begin
  assert claim_failed_attempts('77777777-7777-7777-7777-777777777777') = 2;
  -- A second active claim by the same user on the same found item is rejected.
  begin
    insert into claims (lost_item_id, found_item_id, claimant_id)
    values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-00000000000a');
    raise exception 'duplicate active claim should fail';
  exception when unique_violation then null;
  end;
end $$;
reset role;

-- Bob (finder) sees nothing of Alice's claim; nobody can write claim data.
set role authenticated;
set request.jwt.claim.sub = :'bob';
do $$ begin
  assert (select count(*) from claims) = 0;
  assert (select count(*) from claim_attempts) = 0;
  begin
    perform cancel_claim('77777777-7777-7777-7777-777777777777');
    raise exception 'bob cannot cancel alice''s claim';
  exception when no_data_found then null;
  end;
end $$;

set request.jwt.claim.sub = :'alice';
do $$ begin
  assert (select count(*) from claims) = 1, 'alice sees own claim';
  assert (select count(*) from claim_attempts) = 3, 'alice sees own attempts';
  begin
    insert into claim_attempts (claim_id, attempted_by, attempt_type, result)
    values ('77777777-7777-7777-7777-777777777777', auth.uid(), 'CLAIM_CODE', 'PASSED');
    raise exception 'clients must not write attempts';
  exception when insufficient_privilege then null;
  end;
  begin
    update claims set status = 'APPROVED';
    raise exception 'clients must not update claims';
  exception when insufficient_privilege then null;
  end;
end $$;

-- Alice withdraws: candidate re-opens, statuses roll back.
select status from cancel_claim('77777777-7777-7777-7777-777777777777');
do $$ begin
  begin
    perform cancel_claim('77777777-7777-7777-7777-777777777777');
    raise exception 'cannot cancel twice';
  exception when invalid_parameter_value then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select status from claims where id = '77777777-7777-7777-7777-777777777777') = 'CANCELLED';
  assert (select status from match_candidates where lost_item_id = '11111111-1111-1111-1111-111111111111') = 'OPEN';
  assert (select status from lost_items where id = '11111111-1111-1111-1111-111111111111') = 'MATCHED';
  assert (select status from found_items where id = '22222222-2222-2222-2222-222222222222') = 'MATCHED';
  assert (select count(*) from audit_logs where action = 'CANCELLED_CLAIM') = 1;
end $$;

-- Collection points: users read active ones only; admins manage; slug rules.
update collection_points set status = 'INACTIVE' where qr_slug = 'fot-9vd2ke';
set role authenticated;
set request.jwt.claim.sub = :'alice';
do $$ begin
  assert (select count(*) from collection_points) = 2, 'inactive point hidden from users';
end $$;
update collection_points set name = 'hacked';  -- 0 rows for non-admins
set request.jwt.claim.sub = :'admin';
do $$ begin
  assert (select count(*) from collection_points) = 3, 'admin sees all points';
  insert into collection_points (name, qr_slug) values ('Gym Box', 'gym-a1b2c3');
  begin
    insert into collection_points (name, qr_slug) values ('Bad', 'Has Spaces!');
    raise exception 'slug format must be enforced';
  exception when check_violation then null;
  end;
end $$;
reset role;
do $$ begin
  assert not exists (select 1 from collection_points where name = 'hacked');
  assert exists (select 1 from collection_points where qr_slug = 'gym-a1b2c3');
end $$;
update collection_points set status = 'ACTIVE' where qr_slug = 'fot-9vd2ke';
\echo 'claims tests passed'
