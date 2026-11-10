-- M2 tests: item visibility, edit guards, private info, images, storage.
-- Users: a (alice, owner), b (bob, finder), ad (admin). Created by t1.
\set alice '00000000-0000-0000-0000-00000000000a'
\set bob   '00000000-0000-0000-0000-00000000000b'
update profiles set role='user', is_collection_officer=false where email='bob@test.dev';

-- Service role creates reports (as the Edge Functions do).
set role service_role;
insert into lost_items (id, user_id, category_id, location_id, title, description, brand, color, date_lost)
select '11111111-1111-1111-1111-111111111111', :'alice', c.id, l.id,
       'Casio calculator', 'Black Casio fx-991ES PLUS scientific calculator', 'Casio', 'Black', current_date - 2
from categories c, locations l where c.name='Electronics' and l.name='Lecture Hall A';
insert into lost_item_private values ('11111111-1111-1111-1111-111111111111', 'Scratch near AC button');
insert into lost_item_secrets (lost_item_id, claim_code_hash) values ('11111111-1111-1111-1111-111111111111', 'abc');
insert into found_items (id, finder_id, category_id, location_id, title, description, brand, color, date_found)
select '22222222-2222-2222-2222-222222222222', :'bob', c.id, l.id,
       'Calculator', 'Casio scientific calculator, black', 'casio', 'black', current_date - 1
from categories c, locations l where c.name='Electronics' and l.name='Lecture Hall A';
reset role;

-- Bob: cannot see Alice's lost item or private info; sees own found item.
set role authenticated;
set request.jwt.claim.sub = :'bob';
do $$ begin
  assert (select count(*) from lost_items) = 0, 'bob sees no lost items';
  assert (select count(*) from lost_item_private) = 0, 'bob sees no private info';
  assert (select count(*) from found_items) = 1, 'bob sees own found item';
  begin
    insert into lost_items (user_id, category_id, location_id, title, description, date_lost)
    values (auth.uid(), (select id from categories limit 1), (select id from locations limit 1), 't', 'd', current_date);
    raise exception 'direct insert should fail';
  exception when insufficient_privilege then null;
  end;
  begin
    update found_items set status = 'RETURNED' where id = '22222222-2222-2222-2222-222222222222';
    raise exception 'finder status change should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
update found_items set color = 'Black' where id = '22222222-2222-2222-2222-222222222222';

-- Alice: sees own lost item + private info, NOT bob's found item (no match yet).
set request.jwt.claim.sub = :'alice';
do $$ begin
  assert (select count(*) from lost_items) = 1;
  assert (select private_ownership_info from lost_item_private) = 'Scratch near AC button';
  assert (select count(*) from found_items) = 0, 'unmatched found item hidden';
  begin
    update lost_items set status = 'RESOLVED' where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'owner cannot resolve';
  exception when insufficient_privilege then null;
  end;
end $$;
update lost_items set title = 'Casio fx-991 calculator' where id = '11111111-1111-1111-1111-111111111111';
update lost_item_private set private_ownership_info = 'Scratch near AC button, blue sticker'
  where lost_item_id = '11111111-1111-1111-1111-111111111111';

-- Images: alice can attach to own item with correct path only.
insert into item_images (lost_item_id, uploaded_by, storage_path)
values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'lost/11111111-1111-1111-1111-111111111111/a.jpg');
do $$ begin
  begin
    insert into item_images (lost_item_id, uploaded_by, storage_path)
    values ('11111111-1111-1111-1111-111111111111', auth.uid(), 'found/22222222-2222-2222-2222-222222222222/x.jpg');
    raise exception 'wrong path should fail';
  exception when insufficient_privilege then null;
  end;
  assert public.item_object_access('lost/11111111-1111-1111-1111-111111111111/a.jpg', true);
  assert not public.item_object_access('found/22222222-2222-2222-2222-222222222222/a.jpg', true);
  assert not public.item_object_access('lost/not-a-uuid/a.jpg', false);
end $$;

-- Match created → alice can now view bob's found item.
reset role;
insert into match_candidates (lost_item_id, found_item_id, score)
values ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 90);
set role authenticated;
set request.jwt.claim.sub = :'alice';
do $$ begin
  assert (select count(*) from found_items) = 1, 'matched found item visible';
  assert public.item_object_access('found/22222222-2222-2222-2222-222222222222/a.jpg', false);
end $$;

-- Cancel is allowed; after that, edits are blocked.
update lost_items set status = 'CANCELLED' where id = '11111111-1111-1111-1111-111111111111';
do $$ begin
  begin
    update lost_items set title = 'again' where id = '11111111-1111-1111-1111-111111111111';
    raise exception 'edit after cancel should fail';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  assert (select title from lost_items) = 'Casio fx-991 calculator';
  assert (select status from lost_items) = 'CANCELLED';
  assert (select color from found_items) = 'Black';
end $$;
update lost_items set status = 'LOST';
delete from match_candidates;
\echo 'items tests passed'
