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
| M2: Lost & Found Item Management | `Lost-&-Found-Management` | ⏳ Placeholder routes |
| M3: Matching Engine (Gemini) | `Matching-Engine` | ⏳ Placeholder routes |
| M4: Claims, Collection & QR | `Claims-Collection-QR` | ⏳ Placeholder routes |
| M5: Admin Dashboard & Notifications | `Admin-&-Notifications` | ⏳ Placeholder routes |

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
   and add your exact production URL `https://<your-app>.vercel.app/**` (never a
   bare `https://*.vercel.app/**` wildcard) and
   `http://localhost:5173/**` to **Redirect URLs**.
4. Make yourself an admin (SQL Editor):
   ```sql
   update public.profiles set role = 'admin', is_collection_officer = true
   where email = 'you@example.com';
   ```
5. Optional: enable the Google provider under **Auth → Providers**, then set
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
