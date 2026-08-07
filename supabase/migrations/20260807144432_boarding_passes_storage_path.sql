-- Boarding pass storage path convention (no policy change required).
--
-- App uploads boarding passes to:
--   {organisation_id}/boarding-passes/{journey_or_flight_id}/{file_id}.{ext}
-- inside bucket operate-documents-v2.
--
-- Existing storage RLS (operate_v2_storage_*) authorises by the first path
-- segment only (organisation id via v2_storage_path_organisation_id), so
-- org members keep read/write for the new boarding-passes folder and for
-- older paths (journeys/.../tickets, shows/.../documents, legacy paths).
--
-- This migration documents the convention; object ACL does not need updating.

DO $$
BEGIN
  -- Sanity: v2 bucket and org-path helper must exist for the convention above.
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'operate-documents-v2') THEN
    RAISE NOTICE 'Bucket operate-documents-v2 not found — create it before uploading boarding passes.';
  END IF;
  IF to_regprocedure('public.v2_storage_path_organisation_id(text)') IS NULL THEN
    RAISE NOTICE 'Function v2_storage_path_organisation_id(text) not found — storage RLS may be incomplete.';
  END IF;
END $$;
