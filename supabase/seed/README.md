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
