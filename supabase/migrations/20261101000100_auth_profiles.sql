-- ════════════════════════════════════════════════════════════════════════
-- M1 — Authentication & User Profiles
-- ════════════════════════════════════════════════════════════════════════

-- ─── Auto-create a profile for every new auth user ──────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, profile_image)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profiles.email in sync when a user changes their email address.
create or replace function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set email = coalesce(new.email, '') where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ─── RLS on profiles ────────────────────────────────────────────────────

create policy "Profiles: users read own row"
  on public.profiles for select
  using (id = auth.uid());

create policy "Profiles: admins read all rows"
  on public.profiles for select
  using (public.is_admin());

create policy "Profiles: users update own row"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Column-level grants: a user may only edit their own contact fields.
-- role / is_collection_officer / email can never be changed from the client;
-- admins change them through admin_update_user() below.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, phone, address, bio, profile_image)
  on public.profiles to authenticated;

-- ─── Admin: change a user's role / collection-officer flag ──────────────

create or replace function public.admin_update_user(
  target_user_id        uuid,
  new_role              text default null,
  new_is_collection_officer boolean default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.profiles;
begin
  if not public.is_admin() then
    raise exception 'Only administrators can change user roles'
      using errcode = '42501';
  end if;

  if new_role is not null and new_role not in ('user', 'admin') then
    raise exception 'Invalid role %', new_role using errcode = '22023';
  end if;

  if target_user_id = auth.uid() and new_role = 'user' then
    raise exception 'You cannot remove your own admin role'
      using errcode = '42501';
  end if;

  update public.profiles
  set role = coalesce(new_role, role),
      -- Collection-officer duties are an admin permission flag (spec §4.4).
      is_collection_officer = case
        when coalesce(new_role, role) <> 'admin' then false
        else coalesce(new_is_collection_officer, is_collection_officer)
      end
  where id = target_user_id
  returning * into updated;

  if updated.id is null then
    raise exception 'User not found' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(), 'UPDATED_USER_ROLE', 'profile', target_user_id,
    jsonb_build_object('role', updated.role,
                       'is_collection_officer', updated.is_collection_officer)
  );

  return updated;
end;
$$;

revoke execute on function public.admin_update_user(uuid, text, boolean) from public, anon;
grant execute on function public.admin_update_user(uuid, text, boolean) to authenticated;

-- ─── Storage: profile images ────────────────────────────────────────────
-- Public-read bucket; each user may only write inside their own folder:
--   avatars/{user_id}/{file}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Avatars: users upload to own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Avatars: users update own files"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Avatars: users delete own files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
