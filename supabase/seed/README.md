# Dev seed — single org, single account

Run [`dev_single_org.sql`](dev_single_org.sql) in Supabase SQL Editor.

1. Sign in once (magic link) so a user exists in **Authentication → Users**
2. Copy that user's **UUID** and **email**
3. Run the org insert; copy the returned `id`
4. Link the user as `owner` on that org (member + settings inserts)
5. Set Netlify env vars:

| Key | Value |
|-----|-------|
| `OPERATE_ORG_ID` | org UUID from step 3 |
| `OPERATE_ALLOWED_USER_ID` | user UUID from step 2 |
| `OPERATE_ALLOWED_EMAIL` | user email from step 2 |
| `SYNC_ENABLED` | `true` |
| `REQUIRE_AUTH` | `false` (optional — app opens immediately) |

Only that user can sign in and sync. Any other account is rejected and edits stay local-only.

---

# Dev hardwire — no sign-in

For quick dev testing when magic link is not working. **Not for production.**

Run [`dev_hardwire_setup.sql`](dev_hardwire_setup.sql) in Supabase SQL Editor (after `combined_dev_setup.sql`).

1. Copy `OPERATE_ORG_ID` from the SQL NOTICE output
2. Set Netlify env vars:

| Key | Value |
|-----|-------|
| `OPERATE_ORG_ID` | org UUID from NOTICE |
| `OPERATE_DEV_MODE` | `true` |
| `SYNC_ENABLED` | `true` |
| `REQUIRE_AUTH` | `false` |

Do **not** set `OPERATE_ALLOWED_USER_ID` or `OPERATE_ALLOWED_EMAIL`.

3. Redeploy. Open the app in the **same browser** that has your local tour data (`artisthq.v2` in localStorage).
4. On first load, local data uploads to the dev org if the cloud org is empty. Toast: "Uploaded local tour to cloud".

Anyone with the app URL can read and write that org. Remove anon policies before going to production.
