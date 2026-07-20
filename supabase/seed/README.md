# Dev seed — single org

Run [`dev_single_org.sql`](dev_single_org.sql) in Supabase SQL Editor.

1. Sign in once (magic link) so a user exists in **Authentication → Users**
2. Run the org insert; copy the returned `id`
3. Uncomment and run the member + settings inserts with your org and user UUIDs
4. Set Netlify env `OPERATE_ORG_ID` to that org UUID and `SYNC_ENABLED=true`
