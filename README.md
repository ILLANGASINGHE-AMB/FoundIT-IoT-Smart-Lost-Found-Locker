# FoundIT — Smart Lost & Found

FoundIT is a web app for lost-and-found on campus. People report items they lost
or found, a matching engine pairs them up, owners prove ownership through a
claim workflow, and items are handed back at physical **FoundIT Box**
collection points that have QR codes.

**Stack:** React 19 + Vite + TypeScript · React Router · TanStack Query ·
React Hook Form + Zod · Supabase (Auth · Postgres · Storage · Realtime · Edge
Functions) · Google Gemini embeddings · Vercel hosting.

---

## Modules and branches

| Module | Branch | Status |
|---|---|---|
| M1: Authentication & User Profiles (+ Phase 0 foundation) | `Auth-&-Profiles` | ✅ Implemented |
| M2: Lost & Found Item Management | `Lost-&-Found-Management` | ✅ Implemented |
| M3: Matching Engine (Gemini) | `Matching-Engine` | ✅ Implemented |
| M4: Claims, Collection & QR | `Claims-Collection-QR` | ✅ Implemented |
| M5: Admin Dashboard & Notifications | `Admin-&-Notifications` | ✅ Implemented |

Each module branch builds on the one before it
(`Auth → Lost & Found → Matching → Claims → Admin`). This means every branch
runs end-to-end, and `Admin-&-Notifications` contains the complete app.

## What's in this branch (M1 + Phase 0)

**Phase 0 foundation**
- `supabase/migrations/…_foundation.sql` creates **every table** in the data
  model, turns RLS on everywhere (deny-all by default), and adds the shared
  helpers `is_admin()` / `is_collection_officer()`.
- `supabase/seed.sql` adds the demo categories, campus locations and three
  FoundIT Box collection points.
- `src/types` holds the shared TypeScript row types and status enums.
- `src/lib/supabase.ts` is the typed Supabase client.
- `supabase/functions/_shared` has the Edge Function helpers that every
  module uses (`{ data, error }` envelope, auth, audit logging).
- The React Router skeleton has a route for every page, and modules replace
  the placeholder routes.

**M1: Authentication & profiles**
- Register (password-strength rules), login, email verification, forgot
  password and reset password, all through Supabase Auth.
- A `profiles` row is created automatically by the `on_auth_user_created`
  trigger.
- RLS lets users read and update only their own profile, and admins read
  every profile. Users can never change their own `role` or
  `is_collection_officer` (enforced with column-level grants).
- `admin_update_user()` is an RPC that lets admins change a user's role or
  collection-officer flag. Every change is audit-logged.
- Profile page: view and edit details, upload a profile photo to the
  `avatars` bucket, change password, sign out of all devices.
- `<ProtectedRoute>`, `<AdminRoute>` and `<GuestRoute>`. Redirects keep the
  `?redirect=` parameter, which the QR flow relies on.
- `<AppLayout>` shell: sidebar on desktop, bottom tab bar on mobile
  (Home · Lost · Found · Matches · Profile).
- `/admin/users` lists users with search, role filter and pagination.

---

## What's in this branch (M2: Lost & Found Item Management)

- **Report lost / found item** (`/lost/new`, `/found/new`): a three-step
  wizard (basic info → details → photos & privacy) with Zod validation.
  Fields: category, title, brand, model, colour, optional unique
  identifier, description, date, location (from the controlled
  `locations` list) and photos. Lost reports also take **private
  ownership information**.
- **Edge Functions** `create-lost-item` and `create-found-item`:
  - The identifier is stored as `HMAC-SHA256(IDENTIFIER_HMAC_SECRET, TYPE:VALUE)`
    (spec §13). The raw value is never stored.
  - Lost reports get a claim credential `FND-XXXX-XXXX-XXXX`. Only its HMAC is
    stored (in `lost_item_secrets`, which clients cannot read at all), and the
    plain code is shown **once** in `<ClaimCredentialModal>`.
  - Found items handed in at a FoundIT Box start as `IN_STORAGE`. The
    collection point can be pre-filled through
    `/found/new?collection_point_id=…&location_id=…` (used by the QR flow).
  - After saving, both functions call the Matching Engine (`find-matches`)
    in the background.
- **Photos** go to a private `item-images` Storage bucket
  (`lost/{id}/…`, `found/{id}/…`). The bucket enforces JPEG/PNG/WebP and
  5 MB server-side, and the client validates the same rules. The limit is
  10 photos per report. Photos are shown through signed URLs. On mobile you
  can take a photo directly (`capture="environment"`).
- **My Lost Items / My Found Items** lists with status filters, detail pages
  with image gallery, status timeline, edit and cancel actions.
- **RLS:** a lost report and its private info are visible only to the owner
  and admins. A found report is visible to its finder, admins, and owners
  of a lost item the matching engine paired with it. Owners can edit only
  while a report is active and can only *cancel* (triggers enforce this).

Hirushan's Express/PostgreSQL prototype (`server/`, `database/local/`) was
ported to Supabase. Its table design, validation rules, transactional
claim-code creation and photo-upload-with-retry flow carry over into the
migration, the Edge Functions and the new report form.

## What's in this branch (M3: Matching Engine)

- **Semantic matching with Google Gemini** (spec §18C). The
  `generate-embedding` Edge Function embeds each report's title,
  category, brand, model, colour and description with
  `gemini-embedding-001` (task type `SEMANTIC_SIMILARITY`). The vector is
  truncated to 768 dimensions, L2-normalised and stored in
  `description_embedding` (pgvector, HNSW cosine index).
- **Scoring** happens in Postgres (`score_match_pairs`, spec §19):

  | Attribute | Weight | Method |
  |---|---:|---|
  | Category | 10 | exact `category_id` |
  | Brand | 15 | `pg_trgm` similarity |
  | Model | 15 | `pg_trgm` similarity |
  | Colour | 10 | exact (0.5 if one contains the other) |
  | Location | 20 | exact `location_id` |
  | Date | 10 | full within 1 day, decays to 0 at 7 days |
  | Description | 20 | 0.5 × trigram + 0.5 × Gemini similarity |

  An exact identifier match (equal HMACs, spec §18A) scores **100**.
  Gemini cosine similarity is rescaled (0.55 → 0, ≥ 0.90 → 1), because
  unrelated texts still score around 0.5–0.6 raw. The raw value is kept in
  `score_breakdown.semantic_similarity` for the UI.
- **`find-matches`** runs after every new lost or found report and after
  every edit. It stores candidates scoring ≥ 40% in `match_candidates`
  (many-to-many, so identical items each get their own candidate, spec §21),
  moves items to `MATCHED`, and notifies each lost item's owner (in-app,
  plus email once M5 is deployed). If Gemini is unavailable, matching still
  runs on the lexical signals.
- **"Not my item"** calls the `dismiss_match()` RPC, which sets the
  candidate to `DISMISSED` (it is never deleted) and reverts statuses when
  no open candidates remain. Re-running matching never brings back a
  dismissed candidate.
- **UI:** `/matches` lists matches sorted by score with status filters.
  `/matches/:id` shows your item and the found item side by side (stacked
  on mobile, with the score banner at full width), a score ring, the
  per-attribute breakdown with the method used, the "AI-matched on
  meaning" badge, and **Start claim** / **Not my item** buttons. The
  lost-item page lists its matches and has a "Check again" button.
- **RLS:** a candidate is visible only to the lost item's owner and admins.
  Only the engine (service role) can create candidates.

## What's in this branch (M4: Claims, Collection & QR)

**Claim workflow** (spec §23–25, §29–31). Every state change goes through
an Edge Function.

| Function | Who can call it | What it does |
|---|---|---|
| `submit-claim` | Lost-item owner (or an admin on the owner's behalf) | Opens a `PENDING` claim from an open match and notifies admins |
| `verify-claim` | Claimant | Step 1: fuzzy-compares the private ownership detail server-side (`pg_trgm`, threshold 0.45) |
| `verify-claim-code` | Claimant | Step 2: HMACs the `FND-…` credential and compares it in constant time. On success the claim moves to `UNDER_REVIEW` |
| `recover-claim-credential` | Lost-item owner | Re-verifies the private detail, issues a new code and invalidates the old one. Logged as `RECOVERED_CLAIM_CREDENTIAL` |
| `approve-claim` / `reject-claim` | Admin | Approve (assigns the collection point and auto-rejects competing claims) or reject with a reason. Notifies the claimant |
| `complete-collection` | Collection officer | Checks the credential presented at the desk, or records a manual identity override. Marks the claim `COMPLETED`, the lost item `RESOLVED` and the found item `RETURNED`, and writes a `collections` row |
| `log-qr-scan` | Anyone (public) | Resolves an active FoundIT Box by `qr_slug` and logs `QR_SCAN_*` to `audit_logs` |

- **Abuse protection:** every verification attempt is written to
  `claim_attempts`, which clients cannot insert into. Five failures within
  24 hours lock the claim (`is_locked`, `UNDER_REVIEW`), log
  `LOCKED_CLAIM_ATTEMPTS`, and notify the admins and the claimant.
  Credential recovery is limited to 5 failures per day per item.
- **RLS:** claims, verifications, attempts and collections are visible only
  to the claimant and admins, and clients have no write access at all. A
  user can hold at most one active claim per found item. Claimants can
  withdraw a pending claim with the `cancel_claim()` RPC.
- **UI:** `/claims` (status filters and credential recovery),
  `/claims/new/:matchId`, and `/claims/:id`. The claim page has a
  step-by-step verification wizard with an `<AttemptCounter>`, a status
  timeline (Submitted → Under review → Approved → Collected), verification
  results, and collection details. The lost-item page gets a "Recover
  credential" button.
- **QR system** (spec §27): `/q/:slug` is public and has large tap targets
  (88 px) for one-handed use.
  - "I found something" opens `/found/new` with the box and location
    pre-filled.
  - "I lost something" goes to the login page (which returns here
    afterwards), or to `/claims?at=<box>`, which lists your matches held at
    that box.
  - Inactive or unknown codes show a friendly page.
  - `<QRCodeDisplay>` renders an SVG QR code with download and print
    actions. The admin collection-point page in M5 uses it.
- **PWA** (`vite-plugin-pwa`): installable, with a manifest, FoundIT icons,
  and a precached app shell so the QR landing and auth pages open offline.
  An "Add to Home Screen" prompt appears on mobile after a scan.

## What's in this branch (M5: Admin Dashboard & Notifications)

This branch contains **the complete app**: all five modules merged together.

- **Notifications** (spec §32–33):
  - The `notify-user` Edge Function, which only other functions can call
    (service role), inserts an `IN_APP` row and, for critical events, sends
    an email through **Resend**. Critical events are: possible match found,
    claim approved or rejected, item ready for collection, item collected,
    and credential reset.
  - `<NotificationBell>` in the top bar shows a live unread badge
    (Supabase Realtime) and a preview of the latest 3. A toast appears when
    a notification arrives, and related screens refresh.
  - `/notifications` has paging, filters by type and unread, and mark
    as read / mark all as read.
- **User dashboard:** summary cards for lost items, open matches, active
  claims and items found (from the `user_dashboard_stats()` RPC), a
  "ready for collection" banner, the last 5 notifications, quick actions,
  and the FoundIT Boxes.
- **Admin console** (`/admin`, lazy-loaded; tabs on desktop, hamburger menu
  on mobile):
  - **Overview:** recovery-rate KPI, "needs attention" alerts (locked,
    pending and ready-to-collect claims), counts, and a live activity feed
    (Realtime on `audit_logs`).
  - **Claims:** status tabs and a review screen showing both items side by
    side, the owner's private detail next to the claimant's answer, the
    attempts log and the score breakdown. Actions are approve (with
    collection point), reject or revoke, and complete collection (officer
    only: credential or audited manual override).
  - **Matches:** every candidate with its breakdown. Actions are dismiss,
    convert to claim (opened on the owner's behalf), and override status.
  - **Items:** lost and found tabs, filters (status, category, location,
    date range, search), bulk status changes (`admin_set_item_status()`,
    audited), and an "Expire overdue items" button.
  - **Collection points:** add, edit, deactivate; **generate QR**
    (SVG download and print); rotate QR (a new nanoid slug, after which
    old prints stop working); turn the QR on or off.
  - **Users:** search, role, collection-officer flag.
  - **Analytics** (Recharts): lost vs found over time, monthly recovery
    rate, items by category, items by location, claim-status distribution,
    and KPI cards. Every chart has a table view. The colour palette was
    checked for colour-blind safety.
- **Unclaimed expiry:** `expire_unclaimed_items()` marks found items past
  `retention_expires_at` (90 days by default) as `UNCLAIMED_EXPIRED`,
  dismisses their open candidates, logs `EXPIRED_UNCLAIMED_ITEM`, and
  notifies admins. **pg_cron** runs it daily at 00:00 UTC. Admins can also
  run it from the `expire-unclaimed-items` function.
- **RLS:** users read and mark only their own notifications and can never
  create them. Audit logs are readable by admins only and are never
  writable from the client.

`foundit - Copy.zip` (the original UI snapshot committed to this branch) is
kept unchanged.

## Local development

```bash
npm install
cp .env.example .env.local     # fill in your Supabase URL + anon key
npm run dev                    # http://localhost:5173
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build |
| `npm run lint` | oxlint |

## Backend setup (Supabase)

1. Create a project at [supabase.com](https://supabase.com).
2. Link it and push the schema:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push                 # applies supabase/migrations/*
   ```
   Then run `supabase/seed.sql` once in **SQL Editor** to load the demo data.
3. Under **Auth → URL Configuration**, set **Site URL** to your Vercel URL
   and add `https://<your-app>.vercel.app/**` and
   `http://localhost:5173/**` to **Redirect URLs**.
4. Make yourself an admin (SQL Editor):
   ```sql
   update public.profiles set role = 'admin', is_collection_officer = true
   where email = 'you@example.com';
   ```
5. Set the Edge Function secrets and deploy the functions:
   ```bash
   supabase secrets set \
     IDENTIFIER_HMAC_SECRET="$(openssl rand -hex 32)" \
     CLAIM_CODE_SECRET="$(openssl rand -hex 32)" \
     GEMINI_API_KEY="<key from https://aistudio.google.com/apikey>" \
     RESEND_API_KEY="<key from https://resend.com>" \
     EMAIL_FROM="FoundIT <noreply@your-verified-domain>" \
     APP_URL="https://<your-app>.vercel.app"
   # optional: GEMINI_EMBEDDING_MODEL (default gemini-embedding-001),
   #           ALLOWED_ORIGIN (CORS, default *)
   supabase functions deploy
   ```
   Keep `IDENTIFIER_HMAC_SECRET` and `CLAIM_CODE_SECRET` stable: rotating
   them invalidates the stored identifier and claim-code hashes. Without
   `RESEND_API_KEY`, notifications are in-app only. Without
   `GEMINI_API_KEY`, matching falls back to text similarity.
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to Edge
   Functions automatically.
   pg_cron is enabled by the M5 migration. If your project refuses it, turn
   on **Database → Extensions → pg_cron** and run
   `select cron.schedule('foundit-expire-unclaimed-items', '0 0 * * *', 'select public.expire_unclaimed_items()');`
6. Optional: enable the Google provider under **Auth → Providers**, then set
   `VITE_ENABLE_GOOGLE_AUTH=true`.

## Deploy (Vercel)

1. Import the GitHub repo in Vercel. Pick the branch to deploy
   (`Admin-&-Notifications` has the full app; merge it into `main` for
   production).
2. Framework preset: **Vite** (already set in `vercel.json`, which also adds
   the single-page-app rewrite so deep links like `/q/lib-7k4p92` work).
3. Add these environment variables: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` and `VITE_APP_URL` (the deployed URL).
4. Deploy, then add the Vercel URL to the Supabase Auth redirect URLs (see
   step 3 above).

## Project structure

```
src/
  components/{layout,routing,ui}   app shell, route guards, shared UI primitives
  context/ hooks/                  AuthProvider + useAuth()
  lib/                             supabase client, query client, errors, formatting
  pages/                           one folder per area (auth, dashboard, profile, admin, …)
  services/                        data access (auth.ts, profile.ts, …)
  styles/app.css                   shared design primitives (buttons, forms, cards, tables)
  types/                           shared row types + enums
supabase/
  migrations/                      one migration per module
  functions/                       Edge Functions (+ _shared helpers)
  seed.sql
```
