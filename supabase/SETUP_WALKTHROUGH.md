# Supabase dev project — step-by-step walkthrough

Follow these steps in order. Each step takes about 5 minutes.

---

## Step A — Create the project

1. Open **https://supabase.com/dashboard**
2. Sign in (or create a free account)
3. Click **New project**
4. Fill in:
   - **Name:** `operate-dev`
   - **Database password:** generate a strong password and save it in your password manager
   - **Region:** pick the closest to you (e.g. West EU / London)
5. Click **Create new project**
6. Wait ~2 minutes until the dashboard shows **Project is ready**

---

## Step B — Run migrations (one paste)

1. In the left sidebar, click **SQL Editor**
2. Click **New query**
3. Open this file in your repo and copy **all** of it:
   ```
   supabase/migrations/combined_dev_setup.sql
   ```
4. Paste into the SQL Editor
5. Click **Run** (or Ctrl+Enter)
6. You should see **Success. No rows returned**

**Verify:**
- **Table Editor** → you see `shows`, `orgs`, `org_members`, `org_settings`, etc.
- **Storage** → bucket `operate-documents` exists (private)

---

## Step C — Enable magic-link auth

1. Go to **Authentication** → **Providers** → **Email**
2. Ensure **Enable Email provider** is ON
3. Ensure **Confirm email** is OFF (optional, makes dev easier) OR leave ON if you prefer
4. Under **Email OTP / Magic Link**, ensure magic link is enabled

5. Go to **Authentication** → **URL Configuration**
6. Set **Site URL** to: `http://localhost:3000`
7. Under **Redirect URLs**, add:
   ```
   http://localhost:3000/**
   http://127.0.0.1:3000/**
   ```
8. Click **Save**

---

## Step D — Copy API credentials

1. Go to **Project Settings** (gear icon) → **API**
2. Copy **Project URL** (looks like `https://xxxxx.supabase.co`)
3. Copy **anon public** key (starts with `eyJ...`)

---

## Step E — Wire the app

Run this in PowerShell from the repo root:

```powershell
.\scripts\setup-dev.ps1
```

It will prompt for URL and anon key, write `js/config.js`, and verify the connection.

Or edit `js/config.js` manually:

```js
window.OPERATE_CONFIG = {
  SUPABASE_URL: 'https://YOUR-REF.supabase.co',
  SUPABASE_ANON_KEY: 'eyJ...',
};
```

---

## Step F — First live test

```powershell
npx serve . -l 3000
```

Open **http://localhost:3000**

| Action | Expected |
|--------|----------|
| Page loads | Auth sheet appears (blurred app behind) |
| Enter your email → Send magic link | Email arrives within ~30s |
| Click link in email | Redirects back; signed in; data visible |
| Edit a show | Settings → Account shows "Synced" |
| Upload a boarding pass | Image loads (Storage signed URL) |

---

## Troubleshooting

**Magic link redirect fails**
- Redirect URL must match exactly (including port 3000)
- Site URL must be `http://localhost:3000`

**401 / 403 on sync**
- Confirm migrations ran successfully
- Sign out and sign in again

**Images don't load**
- Check Storage bucket `operate-documents` exists
- Check browser Network tab for signed URL errors

---

## Next: deploy edge functions (optional)

See [`supabase/functions/README.md`](functions/README.md) for `scan-itinerary` and `flight-status`.
