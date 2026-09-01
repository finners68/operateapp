-- Let the app read Make import status, and allow status=applied when Make finishes.
-- Make should run when hotel/travel/contacts are written into the show:
--   update public.pending_show_imports
--   set status = 'applied'
--   where show_id = :show_id and organisation_id = :organisation_id;

alter table public.pending_show_imports
  drop constraint if exists pending_show_imports_status_check;

alter table public.pending_show_imports
  add constraint pending_show_imports_status_check
  check (status = any (array['pending'::text, 'ready'::text, 'processing'::text, 'applied'::text, 'failed'::text]));

do $$
declare
  jake_org uuid := '1ba17032-5bb2-4310-afa7-3a6fc5e94df4';
  fin_org uuid := 'e8fc13af-4b2d-4eed-a5ef-92fd703b03e5';
begin
  drop policy if exists dev_anon_pending_show_imports on public.pending_show_imports;
  execute format(
    'create policy dev_anon_pending_show_imports on public.pending_show_imports for all to anon using (organisation_id in (%L::uuid, %L::uuid)) with check (organisation_id in (%L::uuid, %L::uuid))',
    jake_org, fin_org, jake_org, fin_org
  );
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'pending_show_imports'
  ) then
    alter publication supabase_realtime add table public.pending_show_imports;
  end if;
end $$;
