-- Two organisations: JAKE (existing tour data) and FIN (new empty org).
-- Applied on operate-dev as migration two_orgs_jake_and_fin.
-- Safe to re-run: uses ON CONFLICT / IF EXISTS patterns.

do $$
declare
  jake_org uuid := '1ba17032-5bb2-4310-afa7-3a6fc5e94df4';
  jake_user uuid := '6ad23ac4-f1da-4e02-b352-b736906821d5'; -- jakepr1@outlook.com
  fin_user uuid := 'f29a6726-0960-440c-9189-b0e7d24a5b23';  -- finlayhare68@hotmail.com
  fin_org uuid;
  r record;
begin
  update public.organisations
  set organisation_name = 'JAKE'
  where id = jake_org;

  delete from public.organisation_members
  where organisation_id = jake_org and user_id = fin_user;

  insert into public.organisation_members (organisation_id, user_id, member_role)
  values (jake_org, jake_user, 'owner')
  on conflict (organisation_id, user_id) do update
    set member_role = excluded.member_role;

  select id into fin_org
  from public.organisations
  where organisation_name = 'FIN'
  limit 1;

  if fin_org is null then
    insert into public.organisations (organisation_name, created_by_user_id)
    values ('FIN', fin_user)
    returning id into fin_org;

    insert into public.organisation_settings (organisation_id)
    values (fin_org)
    on conflict (organisation_id) do nothing;
  end if;

  insert into public.organisation_members (organisation_id, user_id, member_role)
  values (fin_org, fin_user, 'owner')
  on conflict (organisation_id, user_id) do update
    set member_role = excluded.member_role;

  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname like 'dev_anon_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'storage'
      and policyname like 'dev_anon_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;
