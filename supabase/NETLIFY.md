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

Apply to **Production** (and Deploy previews if you use them).

Do **not** add `service_role` — browser app only needs the anon key.

## 3. Deploy

Push to the branch Netlify watches. Each build runs:

```
node scripts/generate-config.mjs
```

That writes `js/config.js` from env vars before publish.

## 4. Verify

1. Open https://operate-app.netlify.app/
2. Auth sheet should appear (not local-only)
3. DevTools → Network → `js/config.js` returns 200 with your Supabase URL
4. Magic-link sign-in → edit a show → Settings → Account shows "Synced"

## 5. Hard refresh after deploy

Clear site data or hard refresh once so service worker `operate-v4` loads.
