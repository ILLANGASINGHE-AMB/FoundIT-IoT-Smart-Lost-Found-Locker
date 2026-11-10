-- FoundIT demo seed data (run by `supabase db reset`, or paste into the
-- Supabase SQL editor once after `supabase db push`).

insert into public.categories (name, description) values
  ('Electronics', 'Phones, laptops, chargers, earphones, calculators'),
  ('Documents',   'ID cards, NIC, passports, certificates'),
  ('Books',       'Textbooks, notebooks, novels'),
  ('Stationery',  'Pens, pencil cases, geometry boxes'),
  ('Bags',        'Backpacks, handbags, laptop bags'),
  ('Clothing',    'Jackets, hoodies, caps, scarves'),
  ('Keys',        'House keys, vehicle keys, key tags'),
  ('Accessories', 'Watches, jewellery, glasses, wallets'),
  ('Water Bottles & Umbrellas', 'Bottles, flasks, umbrellas'),
  ('Other',       'Anything that does not fit another category')
on conflict (name) do nothing;

insert into public.locations (name, building, campus_zone) values
  ('University Library',                  'Library Complex', 'Central'),
  ('Lecture Hall A',                      'Main Building',   'Central'),
  ('Lecture Hall B',                      'Main Building',   'Central'),
  ('Faculty of Technology - Building A',  'Building A',      'Technology'),
  ('Faculty of Technology - Building B',  'Building B',      'Technology'),
  ('Computer Lab 1',                      'IT Centre',       'Technology'),
  ('Main Canteen',                        'Student Centre',  'Central'),
  ('Student Centre',                      'Student Centre',  'Central'),
  ('Sports Complex',                      'Gymnasium',       'Sports'),
  ('Main Gate & Car Park',                null,              'Entrance'),
  ('Hostel Block 1',                      'Hostel',          'Residential'),
  ('Bus Stop',                            null,              'Entrance')
on conflict (name) do nothing;

insert into public.collection_points (name, location_id, address, description, contact, qr_slug)
select v.name, l.id, v.address, v.description, v.contact, v.qr_slug
from (values
  ('University Library FoundIT Box', 'University Library', 'Ground floor, next to the issue desk',
   'Staffed 8am–6pm on weekdays', 'library-desk@foundit.app', 'lib-7k4p92'),
  ('Student Centre FoundIT Box', 'Student Centre', 'Help desk, Student Centre lobby',
   'Staffed 9am–5pm on weekdays', 'studentcentre@foundit.app', 'stc-x3m8q1'),
  ('Faculty of Technology FoundIT Box', 'Faculty of Technology - Building A', 'Building A reception',
   'Staffed 8:30am–4:30pm on weekdays', 'tech-office@foundit.app', 'fot-9vd2ke')
) as v(name, location_name, address, description, contact, qr_slug)
join public.locations l on l.name = v.location_name
on conflict (qr_slug) do nothing;

-- To make yourself an administrator after signing up, run (SQL editor):
--   update public.profiles set role = 'admin', is_collection_officer = true
--   where email = 'you@example.com';
