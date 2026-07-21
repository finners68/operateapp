-- Dev hardwire setup — no auth required
-- Run once in Supabase SQL Editor after combined_dev_setup.sql
-- Creates one org + anon RLS so the app syncs without sign-in
-- Copy OPERATE_ORG_ID from the NOTICE output into Netlify env

DO $$
DECLARE
  v_org_id uuid;
  pol text;
BEGIN
  SELECT id INTO v_org_id FROM public.orgs WHERE name = 'Operate Dev' LIMIT 1;
  IF v_org_id IS NULL THEN
    INSERT INTO public.orgs (name) VALUES ('Operate Dev') RETURNING id INTO v_org_id;
  END IF;

  INSERT INTO public.org_settings (org_id, settings)
  VALUES (v_org_id, '{}'::jsonb)
  ON CONFLICT (org_id) DO NOTHING;

  DROP POLICY IF EXISTS dev_anon_shows ON public.shows;
  DROP POLICY IF EXISTS dev_anon_logistics ON public.logistics_items;
  DROP POLICY IF EXISTS dev_anon_flights ON public.show_flights;
  DROP POLICY IF EXISTS dev_anon_passes ON public.show_flight_passes;
  DROP POLICY IF EXISTS dev_anon_files ON public.show_files;
  DROP POLICY IF EXISTS dev_anon_checklist ON public.show_checklist_items;
  DROP POLICY IF EXISTS dev_anon_timeline ON public.show_timeline_steps;
  DROP POLICY IF EXISTS dev_anon_ideas ON public.ideas;
  DROP POLICY IF EXISTS dev_anon_notes ON public.notes;
  DROP POLICY IF EXISTS dev_anon_trips ON public.trips;
  DROP POLICY IF EXISTS dev_anon_settings ON public.org_settings;
  DROP POLICY IF EXISTS dev_anon_storage_select ON storage.objects;
  DROP POLICY IF EXISTS dev_anon_storage_insert ON storage.objects;
  DROP POLICY IF EXISTS dev_anon_storage_update ON storage.objects;
  DROP POLICY IF EXISTS dev_anon_storage_delete ON storage.objects;

  pol := format('org_id = %L', v_org_id);

  EXECUTE format(
    'CREATE POLICY dev_anon_shows ON public.shows FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_logistics ON public.logistics_items FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_flights ON public.show_flights FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_passes ON public.show_flight_passes FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_files ON public.show_files FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_checklist ON public.show_checklist_items FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_timeline ON public.show_timeline_steps FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_ideas ON public.ideas FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_notes ON public.notes FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_trips ON public.trips FOR ALL TO anon USING (%s) WITH CHECK (%s)', pol, pol);
  EXECUTE format(
    'CREATE POLICY dev_anon_settings ON public.org_settings FOR ALL TO anon USING (org_id = %L) WITH CHECK (org_id = %L)',
    v_org_id, v_org_id);

  EXECUTE format(
    'CREATE POLICY dev_anon_storage_select ON storage.objects FOR SELECT TO anon
     USING (bucket_id = ''operate-documents'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);
  EXECUTE format(
    'CREATE POLICY dev_anon_storage_insert ON storage.objects FOR INSERT TO anon
     WITH CHECK (bucket_id = ''operate-documents'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);
  EXECUTE format(
    'CREATE POLICY dev_anon_storage_update ON storage.objects FOR UPDATE TO anon
     USING (bucket_id = ''operate-documents'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);
  EXECUTE format(
    'CREATE POLICY dev_anon_storage_delete ON storage.objects FOR DELETE TO anon
     USING (bucket_id = ''operate-documents'' AND (storage.foldername(name))[1]::uuid = %L)', v_org_id);

  RAISE NOTICE 'Dev hardwire ready. Set Netlify OPERATE_ORG_ID=%', v_org_id;
  RAISE NOTICE 'Also set OPERATE_DEV_MODE=true and SYNC_ENABLED=true';
END $$;
