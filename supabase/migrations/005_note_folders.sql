-- Real note folders (UUID) + notes.folder_id FK. folder_name stays mirrored.

CREATE TABLE IF NOT EXISTS public.note_folders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    folder_name text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS note_folders_org_name_lower_idx
    ON public.note_folders (organisation_id, lower(folder_name))
    WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS note_folders_organisation_legacy_id_idx
    ON public.note_folders (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

ALTER TABLE public.notes
    ADD COLUMN IF NOT EXISTS folder_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_folder_fk'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_folder_fk
      FOREIGN KEY (folder_id, organisation_id)
      REFERENCES public.note_folders(id, organisation_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS notes_folder_id_idx
    ON public.notes (folder_id)
    WHERE folder_id IS NOT NULL;

-- Migrate distinct folder labels into note_folders
INSERT INTO public.note_folders (organisation_id, folder_name)
SELECT DISTINCT n.organisation_id, btrim(n.folder_name)
FROM public.notes n
WHERE n.folder_name IS NOT NULL
  AND btrim(n.folder_name) <> ''
  AND n.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.note_folders f
    WHERE f.organisation_id = n.organisation_id
      AND lower(f.folder_name) = lower(btrim(n.folder_name))
      AND f.deleted_at IS NULL
  );

-- Link notes to folders by name (case-insensitive)
UPDATE public.notes n
SET folder_id = f.id
FROM public.note_folders f
WHERE n.organisation_id = f.organisation_id
  AND n.folder_id IS NULL
  AND n.folder_name IS NOT NULL
  AND lower(btrim(n.folder_name)) = lower(f.folder_name)
  AND f.deleted_at IS NULL;

-- Mirror folder_name from folder row
UPDATE public.notes n
SET folder_name = f.folder_name
FROM public.note_folders f
WHERE n.folder_id = f.id
  AND n.folder_name IS DISTINCT FROM f.folder_name;

-- Keep notes.folder_name mirrored when folder is renamed
CREATE OR REPLACE FUNCTION public.mirror_note_folder_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.folder_name IS DISTINCT FROM OLD.folder_name THEN
    UPDATE public.notes n
    SET folder_name = NEW.folder_name,
        updated_at = now()
    WHERE n.folder_id = NEW.id
      AND n.organisation_id = NEW.organisation_id
      AND n.folder_name IS DISTINCT FROM NEW.folder_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_note_folders_mirror_name ON public.note_folders;
CREATE TRIGGER trg_note_folders_mirror_name
  AFTER UPDATE OF folder_name
  ON public.note_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_note_folder_name();

-- When note.folder_id changes, mirror folder_name onto the note
CREATE OR REPLACE FUNCTION public.mirror_note_folder_id_label()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.folder_id IS NULL THEN
    NEW.folder_name := NULL;
  ELSIF TG_OP = 'INSERT'
        OR NEW.folder_id IS DISTINCT FROM OLD.folder_id
        OR NEW.folder_name IS NULL
        OR btrim(NEW.folder_name) = '' THEN
    SELECT f.folder_name INTO NEW.folder_name
    FROM public.note_folders f
    WHERE f.id = NEW.folder_id
      AND f.organisation_id = NEW.organisation_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notes_mirror_folder_label ON public.notes;
CREATE TRIGGER trg_notes_mirror_folder_label
  BEFORE INSERT OR UPDATE OF folder_id, folder_name
  ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_note_folder_id_label();

ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS note_folders_v2_member_access ON public.note_folders;
CREATE POLICY note_folders_v2_member_access
ON public.note_folders
FOR ALL
TO authenticated
USING (public.v2_is_organisation_member(organisation_id))
WITH CHECK (public.v2_is_organisation_member(organisation_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.note_folders TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.note_folders TO service_role;
