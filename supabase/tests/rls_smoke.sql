-- RLS smoke tests (run while authenticated as a test user in SQL editor, or via client)
-- 1. Should only return orgs you belong to:
select * from public.orgs where id in (select public.user_org_ids());

-- 2. Add a teammate manually (replace UUIDs):
-- insert into public.org_members (org_id, user_id, role)
-- values ('YOUR-ORG-UUID', 'TEAMMATE-USER-UUID', 'manager');
