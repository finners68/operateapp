# Netlify production setup — operate-app.netlify.app

## 1. Supabase auth URLs

**Authentication → URL Configuration**

| Setting | Value |
|---------|-------|
| Site URL | `https://operate-app.netlify.app` |
| Redirect URLs | `https://operate-app.netlify.app/**` |

**Authentication → Providers → Email** — enable magic link.

## 2. Netlify environment variables

Site → **Environment variables** → Add:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | your anon public key (`eyJ...`) |
| `REQUIRE_AUTH` | `false` — app opens immediately (no auth overlay) |
| `SYNC_ENABLED` | `true` — background sync when signed in or in dev mode |

Apply to **Production** (and Deploy previews if you use them).

Do **not** add `service_role` — browser app only needs the anon key.

### Option A — Dev hardwire (no sign-in)

Use this for quick dev testing. No magic link required.

1. Run [`seed/dev_hardwire_setup.sql`](seed/dev_hardwire_setup.sql) in Supabase SQL Editor
2. Copy `OPERATE_ORG_ID` from the NOTICE output
3. Set Netlify:

| Key | Value |
|-----|-------|
| `OPERATE_ORG_ID` | UUID from seed NOTICE |
| `OPERATE_DEV_MODE` | `true` |
| `SYNC_ENABLED` | `true` |
| `REQUIRE_AUTH` | `false` |

4. Redeploy. Open app in the browser that has local tour data — it uploads once if the cloud org is empty.
5. Settings → Account shows **Dev mode · synced**

Do **not** set `OPERATE_ALLOWED_USER_ID` / `OPERATE_ALLOWED_EMAIL` in this mode.

See [`seed/README.md`](seed/README.md) for details.

### Option B — Single-org with magic link

1. Run [`seed/dev_single_org.sql`](seed/dev_single_org.sql) in Supabase SQL Editor
2. Link your test user as `owner` on that org
3. Set `OPERATE_ORG_ID`, `OPERATE_ALLOWED_USER_ID`, `OPERATE_ALLOWED_EMAIL`, `SYNC_ENABLED=true`, `REQUIRE_AUTH=false`
4. Open app → Settings → Account → **Sign in to sync** (magic link, once, as the allowed email)
5. Local tour data uploads to Postgres; edits sync in background

Only the configured user can sync. Other accounts are signed out immediately and cannot push changes.

## 3. Deploy

Push to the branch Netlify watches. Each build runs:

```
node scripts/generate-config.mjs
```

That writes `js/config.js` from env vars before publish.

## 4. Verify

1. Open https://operate-app.netlify.app/
2. App opens immediately (no auth sheet when `REQUIRE_AUTH=false`)
3. DevTools → Network → `js/config.js` shows `SYNC_ENABLED: true` and `OPERATE_ORG_ID`
4. **Dev mode:** Settings → Account shows **Dev · synced**; Supabase `shows` table fills on first load
5. **Auth mode:** Settings → Account → sign in → edit a show → Account shows **Synced**

## 5. Hard refresh after deploy

Clear site data or hard refresh once so the latest service worker loads.

## Re-enable magic-link gate later

Set `REQUIRE_AUTH=true` and redeploy. Remove `OPERATE_DEV_MODE` and anon RLS policies if switching back to auth mode.
