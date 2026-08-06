-- Denormalized venue label on shows, kept in sync with venues.venue_name both ways.
ALTER TABLE public.shows
  ADD COLUMN IF NOT EXISTS venue_name text;

COMMENT ON COLUMN public.shows.venue_name IS
  'Mirrored from venues.venue_name for easy reading; kept in sync both ways by trigger.';

UPDATE public.shows s
SET venue_name = v.venue_name
FROM public.venues v
WHERE s.venue_id = v.id
  AND (s.venue_name IS DISTINCT FROM v.venue_name);

CREATE OR REPLACE FUNCTION public.mirror_show_venue_name()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.venue_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- If show has no name but has a venue, copy from venue.
  IF (NEW.venue_name IS NULL OR btrim(NEW.venue_name) = '') THEN
    UPDATE public.shows s
    SET venue_name = v.venue_name,
        updated_at = now()
    FROM public.venues v
    WHERE s.id = NEW.id
      AND v.id = NEW.venue_id
      AND v.organisation_id = NEW.organisation_id
      AND s.venue_name IS DISTINCT FROM v.venue_name;
    RETURN NEW;
  END IF;

  -- Show name wins: push to venues when name or venue link changed.
  IF TG_OP = 'INSERT'
     OR NEW.venue_name IS DISTINCT FROM OLD.venue_name
     OR NEW.venue_id IS DISTINCT FROM OLD.venue_id THEN
    UPDATE public.venues v
    SET venue_name = NEW.venue_name,
        updated_at = now()
    WHERE v.id = NEW.venue_id
      AND v.organisation_id = NEW.organisation_id
      AND v.venue_name IS DISTINCT FROM NEW.venue_name;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mirror_venue_name_to_shows()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.venue_name IS DISTINCT FROM OLD.venue_name THEN
    UPDATE public.shows s
    SET venue_name = NEW.venue_name,
        updated_at = now()
    WHERE s.venue_id = NEW.id
      AND s.organisation_id = NEW.organisation_id
      AND s.venue_name IS DISTINCT FROM NEW.venue_name;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shows_mirror_venue_name ON public.shows;
CREATE TRIGGER trg_shows_mirror_venue_name
  AFTER INSERT OR UPDATE OF venue_name, venue_id
  ON public.shows
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_show_venue_name();

DROP TRIGGER IF EXISTS trg_venues_mirror_name_to_shows ON public.venues;
CREATE TRIGGER trg_venues_mirror_name_to_shows
  AFTER UPDATE OF venue_name
  ON public.venues
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_venue_name_to_shows();
