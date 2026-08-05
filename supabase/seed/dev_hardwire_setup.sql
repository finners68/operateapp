-- Dev hardwire setup — V2 schema, no auth required
-- Run once in Supabase SQL Editor after operate_database_v2_schema_final.sql
-- Creates one org + anon RLS so the app syncs without sign-in
-- Copy OPERATE_ORG_ID from the NOTICE output into Netlify env

DO $$
DECLARE
  v_org_id uuid;
  pol text;
  v2_tables text[] := ARRAY[
    'shows', 'journeys', 'schedule_items', 'checklist_items', 'tours',
    'organisation_settings', 'files', 'travel_tickets', 'show_files',
    'hotel_bookings', 'ideas', 'notes', 'contacts', 'venues', 'artists',
    'show_advances', 'show_financials', 'show_expenses', 'invoices',
    'packing_lists', 'packing_list_items', 'itinerary_submissions'
  ];
  tbl text;
BEGIN
  SELECT id INTO v_org_id FROM public.organisations WHERE organisation_name = 'Operate Dev' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.organisations (organisation_name)
    VALUES ('Operate Dev')
    RETURNING id INTO v_org_id;
    INSERT INTO public.organisation_settings (organisation_id)
    VALUES (v_org_id)
    ON CONFLICT (organisation_id) DO NOTHING;
  END IF;

  FOREACH tbl IN ARRAY v2_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS dev_anon_%I ON public.%I', tbl, tbl);
  END LOOP;

  DROP POLICY IF EXISTS dev_anon_storage_select ON storage.objects;
  DROP POLICY IF EXISTS dev_anon_storage_insert ON storage.objects;
  DROP POLICY IF EXISTS dev_anon_storage_update ON storage.objects;
  DROP POLICY IF EXISTS dev_anon_storage_delete ON storage.objects;

  pol := format('organisation_id = %L', v_org_id);

  FOREACH tbl IN ARRAY v2_tables LOOP
    EXECUTE format(
      'CREATE POLICY dev_anon_%I ON public.%I FOR ALL TO anon USING (%s) WITH CHECK (%s)',
      tbl, tbl, pol, pol
    );
  END LOOP;

  EXECUTE format(
    'CREATE POLICY dev_anon_storage_select ON storage.objects FOR SELECT TO anon
     USING (bucket_id = ''operate-documents-v2'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);
  EXECUTE format(
    'CREATE POLICY dev_anon_storage_insert ON storage.objects FOR INSERT TO anon
     WITH CHECK (bucket_id = ''operate-documents-v2'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);
  EXECUTE format(
    'CREATE POLICY dev_anon_storage_update ON storage.objects FOR UPDATE TO anon
     USING (bucket_id = ''operate-documents-v2'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);
  EXECUTE format(
    'CREATE POLICY dev_anon_storage_delete ON storage.objects FOR DELETE TO anon
     USING (bucket_id = ''operate-documents-v2'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);

  RAISE NOTICE 'V2 dev hardwire ready. Set Netlify OPERATE_ORG_ID=%', v_org_id;
  RAISE NOTICE 'Also set OPERATE_DEV_MODE=true and SYNC_ENABLED=true';
END $$;
