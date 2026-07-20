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
| `SYNC_ENABLED` | `true` — optional background sync when signed in |
| `OPERATE_ORG_ID` | UUID of your single dev org (from seed SQL) |

Apply to **Production** (and Deploy previews if you use them).

Do **not** add `service_role` — browser app only needs the anon key.

### Single-org dev testing

1. Run [`seed/dev_single_org.sql`](seed/dev_single_org.sql) in Supabase SQL Editor
2. Link your test user as `owner` on that org
3. Set `OPERATE_ORG_ID` + `SYNC_ENABLED=true` + `REQUIRE_AUTH=false`
4. Open app → Settings → Account → **Sign in to sync** (magic link, once)
5. Local tour data uploads to Postgres; edits sync in background

See [`seed/README.md`](seed/README.md) for details.

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
4. Settings → Account → sign in → edit a show → Account shows **Synced**
5. Supabase Table Editor → `shows` rows appear

## 5. Hard refresh after deploy

Clear site data or hard refresh once so service worker `operate-v4` loads.

## Re-enable magic-link gate later

Set `REQUIRE_AUTH=true` and redeploy.
