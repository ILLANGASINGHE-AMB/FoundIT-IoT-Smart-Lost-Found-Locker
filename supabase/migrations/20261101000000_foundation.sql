-- ════════════════════════════════════════════════════════════════════════
-- FoundIT — Phase 0 foundation migration
--
-- Creates every table in the data model (spec §7) so all five modules code
-- against the same schema from day one. Row Level Security is switched ON
-- for every table with NO policies (deny-all); each module's own migration
-- adds the policies, indexes, triggers and functions it owns.
--
-- Embedding columns are vector(768): the Matching Engine uses Google Gemini
-- embeddings (gemini-embedding-001, truncated to 768 dims) instead of the
-- in-process MiniLM model mentioned in spec §18C.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_trgm with schema extensions;
create extension if not exists vector with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ─── Shared helpers ─────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── profiles (owned by M1) ─────────────────────────────────────────────

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  full_name             text not null default '',
  email                 text not null,
  phone                 text,
  address               text,
  bio                   text,
  role                  text not null default 'user' check (role in ('user', 'admin')),
  is_collection_officer boolean not null default false,
  profile_image         text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Role helpers used by every module's RLS policies. SECURITY DEFINER so a
-- policy on profiles can call them without recursing into its own RLS.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_collection_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_collection_officer
  );
$$;

-- ─── Lookups (owned by M2 / M4) ─────────────────────────────────────────

create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  description text,
  created_at  timestamptz not null default now()
);

create table public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  building    text,
  campus_zone text,
  created_at  timestamptz not null default now()
);

create table public.collection_points (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) > 0),
  location_id uuid references public.locations (id),
  address     text,
  description text,
  contact     text,
  status      text not null default 'ACTIVE' check (status in ('ACTIVE', 'INACTIVE')),
  qr_slug     text not null unique,
  qr_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Items (owned by M2) ────────────────────────────────────────────────

create table public.lost_items (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  category_id           uuid not null references public.categories (id),
  location_id           uuid not null references public.locations (id),
  title                 text not null check (length(trim(title)) > 0),
  description           text not null check (length(trim(description)) > 0),
  brand                 text,
  model                 text,
  color                 text,
  identifier_type       text,
  date_lost             date not null,
  status                text not null default 'LOST' check (status in (
                          'LOST', 'MATCHED', 'FOUND', 'CLAIM_PENDING',
                          'CLAIMED', 'RESOLVED', 'CANCELLED')),
  retention_expires_at  timestamptz,
  description_embedding extensions.vector(768),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Private ownership information (spec §15). Split out of lost_items so a
-- column can never leak through a broad SELECT: owner + admins only.
create table public.lost_item_private (
  lost_item_id           uuid primary key references public.lost_items (id) on delete cascade,
  private_ownership_info text,
  updated_at             timestamptz not null default now()
);

-- Server-only secrets: claim credential hash and identifier HMAC (spec §13,
-- §24). RLS on with no policies + no grants = only the service role (Edge
-- Functions) can ever read these.
create table public.lost_item_secrets (
  lost_item_id          uuid primary key references public.lost_items (id) on delete cascade,
  claim_code_hash       text,
  identifier_value_hmac text,
  code_issued_at        timestamptz,
  updated_at            timestamptz not null default now()
);

create table public.found_items (
  id                    uuid primary key default gen_random_uuid(),
  finder_id             uuid not null references public.profiles (id) on delete cascade,
  category_id           uuid not null references public.categories (id),
  location_id           uuid not null references public.locations (id),
  title                 text not null check (length(trim(title)) > 0),
  description           text not null check (length(trim(description)) > 0),
  brand                 text,
  model                 text,
  color                 text,
  identifier_type       text,
  date_found            date not null,
  status                text not null default 'FOUND' check (status in (
                          'FOUND', 'MATCHED', 'IN_STORAGE', 'CLAIM_PENDING',
                          'CLAIMED', 'RETURNED', 'UNCLAIMED_EXPIRED', 'CLOSED')),
  collection_point_id   uuid references public.collection_points (id),
  retention_expires_at  timestamptz not null default (now() + interval '90 days'),
  description_embedding extensions.vector(768),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.found_item_secrets (
  found_item_id         uuid primary key references public.found_items (id) on delete cascade,
  identifier_value_hmac text,
  updated_at            timestamptz not null default now()
);

create table public.item_images (
  id            uuid primary key default gen_random_uuid(),
  lost_item_id  uuid references public.lost_items (id) on delete cascade,
  found_item_id uuid references public.found_items (id) on delete cascade,
  uploaded_by   uuid not null references public.profiles (id) on delete cascade,
  storage_path  text not null unique,
  created_at    timestamptz not null default now(),
  check (
    (lost_item_id is not null and found_item_id is null)
    or (lost_item_id is null and found_item_id is not null)
  )
);

-- ─── Matching (owned by M3) ─────────────────────────────────────────────

create table public.match_candidates (
  id              uuid primary key default gen_random_uuid(),
  lost_item_id    uuid not null references public.lost_items (id) on delete cascade,
  found_item_id   uuid not null references public.found_items (id) on delete cascade,
  score           numeric(5, 2) not null check (score between 0 and 100),
  score_breakdown jsonb not null default '{}'::jsonb,
  status          text not null default 'OPEN'
                    check (status in ('OPEN', 'DISMISSED', 'CONVERTED_TO_CLAIM')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (lost_item_id, found_item_id)
);

-- ─── Claims & collection (owned by M4) ──────────────────────────────────

create table public.claims (
  id                       uuid primary key default gen_random_uuid(),
  match_candidate_id       uuid references public.match_candidates (id) on delete set null,
  lost_item_id             uuid not null references public.lost_items (id) on delete cascade,
  found_item_id            uuid not null references public.found_items (id) on delete cascade,
  claimant_id              uuid not null references public.profiles (id) on delete cascade,
  status                   text not null default 'PENDING' check (status in (
                             'PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED',
                             'CANCELLED', 'COMPLETED')),
  is_locked                boolean not null default false,
  private_attribute_answer text,
  collection_point_id      uuid references public.collection_points (id),
  rejection_reason         text,
  submitted_at             timestamptz not null default now(),
  reviewed_at              timestamptz,
  approved_at              timestamptz,
  rejected_at              timestamptz,
  completed_at             timestamptz,
  reviewed_by              uuid references public.profiles (id),
  updated_at               timestamptz not null default now()
);

create table public.claim_verifications (
  id                uuid primary key default gen_random_uuid(),
  claim_id          uuid not null references public.claims (id) on delete cascade,
  verification_type text not null check (verification_type in (
                      'PRIVATE_ATTRIBUTE', 'CLAIM_CODE', 'IDENTIFIER', 'ADMIN_REVIEW')),
  result            text not null check (result in ('PASSED', 'FAILED')),
  verified_by       uuid references public.profiles (id),
  notes             text,
  created_at        timestamptz not null default now()
);

create table public.claim_attempts (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null references public.claims (id) on delete cascade,
  attempted_by uuid not null references public.profiles (id) on delete cascade,
  attempt_type text not null check (attempt_type in ('PRIVATE_ATTRIBUTE', 'CLAIM_CODE')),
  result       text not null check (result in ('PASSED', 'FAILED')),
  created_at   timestamptz not null default now()
);

create table public.collections (
  id           uuid primary key default gen_random_uuid(),
  claim_id     uuid not null unique references public.claims (id) on delete cascade,
  collected_by uuid not null references public.profiles (id),
  collected_at timestamptz not null default now(),
  notes        text
);

-- ─── Notifications & audit (owned by M5) ────────────────────────────────

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text not null,
  message    text not null,
  type       text not null default 'SYSTEM'
               check (type in ('MATCH', 'CLAIM', 'COLLECTION', 'SYSTEM')),
  channel    text not null default 'IN_APP' check (channel in ('IN_APP', 'EMAIL')),
  link       text,
  is_read    boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- ─── updated_at triggers ────────────────────────────────────────────────

create trigger profiles_updated_at          before update on public.profiles          for each row execute function public.set_updated_at();
create trigger collection_points_updated_at before update on public.collection_points for each row execute function public.set_updated_at();
create trigger lost_items_updated_at        before update on public.lost_items        for each row execute function public.set_updated_at();
create trigger lost_item_private_updated_at before update on public.lost_item_private for each row execute function public.set_updated_at();
create trigger lost_item_secrets_updated_at before update on public.lost_item_secrets for each row execute function public.set_updated_at();
create trigger found_items_updated_at       before update on public.found_items       for each row execute function public.set_updated_at();
create trigger found_item_secrets_updated_at before update on public.found_item_secrets for each row execute function public.set_updated_at();
create trigger match_candidates_updated_at  before update on public.match_candidates  for each row execute function public.set_updated_at();
create trigger claims_updated_at            before update on public.claims            for each row execute function public.set_updated_at();

-- ─── Baseline security: RLS on everywhere, deny-all until modules add policies

alter table public.profiles            enable row level security;
alter table public.categories          enable row level security;
alter table public.locations           enable row level security;
alter table public.collection_points   enable row level security;
alter table public.lost_items          enable row level security;
alter table public.lost_item_private   enable row level security;
alter table public.lost_item_secrets   enable row level security;
alter table public.found_items         enable row level security;
alter table public.found_item_secrets  enable row level security;
alter table public.item_images         enable row level security;
alter table public.match_candidates    enable row level security;
alter table public.claims              enable row level security;
alter table public.claim_verifications enable row level security;
alter table public.claim_attempts      enable row level security;
alter table public.collections         enable row level security;
alter table public.notifications       enable row level security;
alter table public.audit_logs          enable row level security;

-- Secret tables: belt and braces — no client role may touch them at all.
revoke all on public.lost_item_secrets  from anon, authenticated;
revoke all on public.found_item_secrets from anon, authenticated;

-- Shared lookups are readable by everyone (needed by report forms and the
-- public QR landing page). Writes stay admin-only (added by later modules).
create policy "Lookups: categories readable by all"
  on public.categories for select using (true);
create policy "Lookups: locations readable by all"
  on public.locations for select using (true);
create policy "Lookups: active collection points readable by all"
  on public.collection_points for select using (status = 'ACTIVE' or public.is_admin());
