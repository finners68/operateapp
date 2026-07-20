-- Single-org dev seed — run once in Supabase SQL Editor
-- 1. Create a test user first (Authentication → Users, or magic-link sign-in once)
-- 2. Replace YOUR-USER-UUID below with that user's id
-- 3. Save the org id returned — set it as OPERATE_ORG_ID in Netlify env

insert into public.orgs (name)
values ('Operate Dev')
returning id;

-- After running the above, paste the org UUID and user UUID here:
/*
insert into public.org_members (org_id, user_id, role)
values ('YOUR-ORG-UUID', 'YOUR-USER-UUID', 'owner');

insert into public.org_settings (org_id, settings)
values ('YOUR-ORG-UUID', '{}'::jsonb)
on conflict (org_id) do nothing;
*/

-- Or as a single block once you have both UUIDs:
-- insert into public.org_members (org_id, user_id, role)
-- values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'owner');
-- insert into public.org_settings (org_id, settings)
-- values ('00000000-0000-0000-0000-000000000001', '{}'::jsonb)
-- on conflict (org_id) do nothing;
