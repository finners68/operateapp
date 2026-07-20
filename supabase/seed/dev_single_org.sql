-- Single-org + single-account dev seed — run once in Supabase SQL Editor
-- 1. Sign in once (magic link) so a user exists in Authentication → Users
-- 2. Copy that user's id and email
-- 3. Run the org insert below; copy the returned org id
-- 4. Run the member + settings block with your UUIDs
-- 5. Set Netlify env: OPERATE_ORG_ID, OPERATE_ALLOWED_USER_ID, OPERATE_ALLOWED_EMAIL, SYNC_ENABLED=true

insert into public.orgs (name)
values ('Operate Dev')
returning id;

-- Replace YOUR-ORG-UUID and YOUR-USER-UUID, then run:
/*
insert into public.org_members (org_id, user_id, role)
values ('YOUR-ORG-UUID', 'YOUR-USER-UUID', 'owner');

insert into public.org_settings (org_id, settings)
values ('YOUR-ORG-UUID', '{}'::jsonb)
on conflict (org_id) do nothing;
*/

-- Netlify env (Production):
-- OPERATE_ORG_ID=<org uuid from above>
-- OPERATE_ALLOWED_USER_ID=<user uuid from Authentication → Users>
-- OPERATE_ALLOWED_EMAIL=<same email you signed in with>
-- SYNC_ENABLED=true
-- REQUIRE_AUTH=false
