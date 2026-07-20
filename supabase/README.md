# Operate — Supabase setup

**New to Supabase?** Start with the click-by-click guide: [`SETUP_WALKTHROUGH.md`](SETUP_WALKTHROUGH.md)

Quick wire-up after creating a project:

```powershell
.\scripts\setup-dev.ps1
npx serve . -l 3000
```

Verify: `node scripts/verify-supabase.mjs`

---

## 1. Create projects

Create two Supabase projects (recommended):

| Environment | Purpose |
|-------------|---------|
| **Dev** | Local testing, schema experiments |
| **Prod** | Live team data |

Enable **Point-in-Time Recovery** on prod.

## 2. Run migrations

In each project, open **SQL Editor** and run in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_storage.sql`

Or link the CLI and run `supabase db push` if you use the Supabase CLI locally.

## 3. Auth (magic link)

In **Authentication → Providers → Email**:

- Enable Email provider
- Enable **Magic Link** (OTP)
- Set **Site URL** to your app origin (e.g. `http://localhost:8080` or your deployed URL)
- Add redirect URLs for dev and prod

Users sign in with email only — no passwords.

## 4. API keys

In **Project Settings → API**:

- Copy **Project URL**
- Copy **anon / publishable** key (safe for the browser)

Create `js/config.js` from the example:

```bash
cp js/config.example.js js/config.js
```

Fill in `SUPABASE_URL` and `SUPABASE_ANON_KEY`.

**Never** put the `service_role` key in the client.

## 5. Realtime

Migrations add tables to `supabase_realtime`. Confirm under **Database → Replication** that the listed tables are enabled.

## 6. Storage

Migration `002_storage.sql` creates private bucket `operate-documents`. Files use signed URLs in the app.

Path pattern: `{org_id}/{show_id}/{uuid}-{filename}`

## 7. Add teammates

There is no self-serve invite UI yet. As an **owner**, run in SQL Editor (replace UUIDs):

```sql
insert into public.org_members (org_id, user_id, role)
values ('YOUR-ORG-UUID', 'TEAMMATE-AUTH-USER-UUID', 'manager');
-- or 'crew' for read-only
```

Roles:

| Role | Access |
|------|--------|
| `owner` | Full read/write |
| `manager` | Full read/write |
| `crew` | Read-only |

## 8. First sign-in flow

1. Open the app with valid `js/config.js`
2. Enter email → magic link
3. On first login, an org is created and local `artisthq.v2` data is uploaded once
4. Other devices sign in with the same email (or are added via SQL) and receive synced data

## 9. RLS smoke test

See `supabase/tests/rls_smoke.sql`.

## 10. Local dev

Serve the folder over HTTP (service worker requires it):

```bash
npx serve .
# or python -m http.server 8080
```

Without `js/config.js`, the app runs **local-only** from `localStorage` as before.
