# Database tests

Plain-SQL tests for the RLS policies, triggers and functions. Each file uses
`assert`, so the first failure aborts with an error. They insert test users and
data, so **only run them against a disposable local database**:

```bash
supabase db reset                     # fresh local DB with migrations + seed
for f in supabase/tests/*.sql; do
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres \
       -v ON_ERROR_STOP=1 -q -f "$f" || break
done
```

Run them in order: later files reuse the users created by `01_auth_rls.sql`.
