-- Temporary: anon read/write for hardcoded JAKE + FIN workspaces (no login).
-- Applied on operate-dev as migration hardwire_anon_jake_and_fin.

do $$
declare
  jake_org uuid := '1ba17032-5bb2-4310-afa7-3a6fc5e94df4';
  fin_org uuid := 'e8fc13af-4b2d-4eed-a5ef-92fd703b03e5';
  pol text;
  r record;
  tbl text;
  v2_tables text[] := array[
    'shows','journeys','schedule_items','checklist_items','tours',
    'organisation_settings','organisation_billing_profiles','organisation_exchange_rates',
    'user_preferences','files','travel_tickets','show_files','journey_files',
    'hotels','hotel_bookings','hotel_booking_shows','ideas','note_folders','notes',
    'contacts','venues','artists','show_advances','show_financials','show_expenses',
    'invoices','invoice_line_items','packing_lists','packing_list_items',
    'itinerary_submissions','itinerary_submission_files','companies','company_contacts',
    'show_contacts','tour_contacts','journey_contacts','reminders','organisation_members'
  ];
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where policyname like 'dev_anon_%'
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;

  pol := format('organisation_id in (%L::uuid, %L::uuid)', jake_org, fin_org);

  execute format(
    'create policy dev_anon_organisations on public.organisations for all to anon using (id in (%L::uuid, %L::uuid)) with check (id in (%L::uuid, %L::uuid))',
    jake_org, fin_org, jake_org, fin_org
  );

  foreach tbl in array v2_tables loop
    if to_regclass('public.' || tbl) is null then
      continue;
    end if;
    execute format(
      'create policy dev_anon_%I on public.%I for all to anon using (%s) with check (%s)',
      tbl, tbl, pol, pol
    );
  end loop;

  execute format(
    'create policy dev_anon_storage_select on storage.objects for select to anon
     using (bucket_id = ''operate-documents-v2'' and (storage.foldername(name))[1]::uuid in (%L::uuid, %L::uuid))',
    jake_org, fin_org);
  execute format(
    'create policy dev_anon_storage_insert on storage.objects for insert to anon
     with check (bucket_id = ''operate-documents-v2'' and (storage.foldername(name))[1]::uuid in (%L::uuid, %L::uuid))',
    jake_org, fin_org);
  execute format(
    'create policy dev_anon_storage_update on storage.objects for update to anon
     using (bucket_id = ''operate-documents-v2'' and (storage.foldername(name))[1]::uuid in (%L::uuid, %L::uuid))',
    jake_org, fin_org);
  execute format(
    'create policy dev_anon_storage_delete on storage.objects for delete to anon
     using (bucket_id = ''operate-documents-v2'' and (storage.foldername(name))[1]::uuid in (%L::uuid, %L::uuid))',
    jake_org, fin_org);
end $$;
