-- FoundIT Member 4: Claim Management, Security and QR

create extension if not exists pgcrypto;

-- Collection points (standalone base table for Member 4)
create table if not exists public.collection_points (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text,
    is_active boolean not null default true,
    qr_slug text unique,
    qr_active boolean not null default true,
    created_at timestamptz not null default now()
);

-- Claims submitted against matched lost/found items.
-- match_id will be connected to the team's matches table during integration.
create table if not exists public.claims (
    id uuid primary key default gen_random_uuid(),
    match_id uuid not null,
    claimant_id uuid not null references auth.users(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'under_review', 'verified', 'rejected', 'collected', 'locked')),
    collection_point_id uuid references public.collection_points(id),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Verification and review history
create table if not exists public.claim_verifications (
    id uuid primary key default gen_random_uuid(),
    claim_id uuid not null references public.claims(id) on delete cascade,
    verified_by uuid references auth.users(id),
    result text not null check (result in ('approved', 'rejected')),
    notes text,
    created_at timestamptz not null default now()
);

-- Failed credential attempts. Only trusted server functions should write here.
create table if not exists public.claim_attempts (
    id uuid primary key default gen_random_uuid(),
    claim_id uuid not null references public.claims(id) on delete cascade,
    success boolean not null default false,
    attempted_at timestamptz not null default now()
);

-- Collection completion record
create table if not exists public.collections (
    id uuid primary key default gen_random_uuid(),
    claim_id uuid not null unique references public.claims(id),
    collection_point_id uuid references public.collection_points(id),
    completed_by uuid not null references auth.users(id),
    completed_at timestamptz not null default now(),
    notes text
);

-- QR scan audit records
create table if not exists public.qr_scans (
    id uuid primary key default gen_random_uuid(),
    collection_point_id uuid references public.collection_points(id) on delete set null,
    scanned_at timestamptz not null default now()
);

-- Keep credential hashes in a private schema, never exposed to frontend clients.
create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create table if not exists private.claim_secrets (
    claim_id uuid primary key references public.claims(id) on delete cascade,
    credential_hash text not null,
    credential_salt text not null,
    failed_attempts integer not null default 0,
    locked_at timestamptz,
    credential_version integer not null default 1,
    updated_at timestamptz not null default now()
);

revoke all on private.claim_secrets from public, anon, authenticated;
grant usage on schema private to service_role;
grant all on private.claim_secrets to service_role;

-- Indexes
create index if not exists idx_claims_claimant on public.claims(claimant_id);
create index if not exists idx_claims_match on public.claims(match_id);
create index if not exists idx_claims_status on public.claims(status);
create index if not exists idx_attempts_claim on public.claim_attempts(claim_id);
create index if not exists idx_verifications_claim on public.claim_verifications(claim_id);
create index if not exists idx_qr_scans_point on public.qr_scans(collection_point_id);

-- Enable Row Level Security
alter table public.claims enable row level security;
alter table public.claim_verifications enable row level security;
alter table public.claim_attempts enable row level security;
alter table public.collections enable row level security;
alter table public.collection_points enable row level security;
alter table public.qr_scans enable row level security;

-- Claimants can read only their own claims.
create policy "Claimants can view their own claims"
on public.claims for select
to authenticated
using (claimant_id = auth.uid());

-- Officers and admins can view all claims.
create policy "Officers can view all claims"
on public.claims for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('officer', 'admin'));

-- Officers and admins can view verification history.
create policy "Officers can view claim verifications"
on public.claim_verifications for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('officer', 'admin'));

-- Claimants can view collection records belonging to their own claims.
create policy "Claimants can view their collection records"
on public.collections for select
to authenticated
using (
    exists (
        select 1 from public.claims
        where claims.id = collections.claim_id
        and claims.claimant_id = auth.uid()
    )
);

-- Officers and admins can view collection records.
create policy "Officers can view collection records"
on public.collections for select
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('officer', 'admin'));

-- Authenticated users can see active collection points.
create policy "Users can view active collection points"
on public.collection_points for select
to authenticated
using (is_active = true);

-- Officers and admins can manage collection points.
create policy "Officers can manage collection points"
on public.collection_points for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('officer', 'admin'))
with check ((auth.jwt() -> 'app_metadata' ->> 'role') in ('officer', 'admin'));

-- No client policies are created for claim_attempts or qr_scans.
-- Edge Functions using the service role will manage these records.
