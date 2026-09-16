-- Drop leftover type-specific columns from public.journeys now that
-- route/times live on the parent and details live on subtype tables.
-- Recreate travel_schedule first so it no longer reads the old columns.

DROP VIEW IF EXISTS public.travel_schedule;
CREATE VIEW public.travel_schedule
WITH (security_invoker = true)
AS
SELECT
    j.id AS journey_id,
    j.organisation_id,
    j.journey_type,
    j.journey_title,
    j.departure_at,
    j.arrival_at,
    j.departure_location_name,
    j.arrival_location_name,
    fd.flight_number,
    rd.train_number,
    fe.ferry_service_number,
    cd.coach_service_number,
    j.journey_status,
    j.is_done,
    t.tour_name,
    s.show_date AS related_show_date
FROM public.journeys AS j
LEFT JOIN public.tours AS t
    ON t.id = j.tour_id
LEFT JOIN public.shows AS s
    ON s.id = j.related_show_id
LEFT JOIN public.journey_flight_details AS fd
    ON fd.journey_id = j.id
LEFT JOIN public.journey_rail_details AS rd
    ON rd.journey_id = j.id
LEFT JOIN public.journey_ferry_details AS fe
    ON fe.journey_id = j.id
LEFT JOIN public.journey_coach_details AS cd
    ON cd.journey_id = j.id
WHERE j.deleted_at IS NULL;

GRANT SELECT ON public.travel_schedule TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._tmp_journey_notes_text(src text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed jsonb;
  note text;
BEGIN
  IF src IS NULL OR btrim(src) = '' THEN
    RETURN NULL;
  END IF;
  IF btrim(src) ~* '^Legacy seat:' THEN
    RETURN NULL;
  END IF;
  IF left(btrim(src), 1) = '{' THEN
    BEGIN
      parsed := btrim(src)::jsonb;
      note := NULLIF(btrim(coalesce(parsed->>'note', '')), '');
      RETURN note;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;
  RETURN NULLIF(btrim(src), '');
END;
$$;

UPDATE public.journeys j
SET note_items = coalesce(
  CASE WHEN jsonb_typeof(j.note_items) = 'array' THEN j.note_items ELSE '[]'::jsonb END,
  '[]'::jsonb
) || jsonb_build_array(
  jsonb_build_object('id', 'legacy-notes', 'text', public._tmp_journey_notes_text(j.journey_notes))
)
WHERE public._tmp_journey_notes_text(j.journey_notes) IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(j.note_items) = 'array' THEN j.note_items ELSE '[]'::jsonb END
    ) n
    WHERE lower(btrim(coalesce(n->>'text', ''))) = lower(public._tmp_journey_notes_text(j.journey_notes))
  );

DROP FUNCTION IF EXISTS public._tmp_journey_notes_text(text);

DROP TRIGGER IF EXISTS trg_sync_journey_subtypes ON public.journeys;
DROP FUNCTION IF EXISTS public.sync_journey_subtypes_from_parent();

ALTER TABLE public.journeys
  DROP COLUMN IF EXISTS departure_location_code,
  DROP COLUMN IF EXISTS arrival_location_code,
  DROP COLUMN IF EXISTS flight_number,
  DROP COLUMN IF EXISTS departure_airport_iata,
  DROP COLUMN IF EXISTS arrival_airport_iata,
  DROP COLUMN IF EXISTS departure_terminal,
  DROP COLUMN IF EXISTS arrival_terminal,
  DROP COLUMN IF EXISTS departure_gate,
  DROP COLUMN IF EXISTS arrival_gate,
  DROP COLUMN IF EXISTS train_number,
  DROP COLUMN IF EXISTS departure_station_name,
  DROP COLUMN IF EXISTS arrival_station_name,
  DROP COLUMN IF EXISTS departure_platform,
  DROP COLUMN IF EXISTS arrival_platform,
  DROP COLUMN IF EXISTS ferry_service_number,
  DROP COLUMN IF EXISTS departure_port_name,
  DROP COLUMN IF EXISTS arrival_port_name,
  DROP COLUMN IF EXISTS coach_service_number,
  DROP COLUMN IF EXISTS pickup_location,
  DROP COLUMN IF EXISTS dropoff_location,
  DROP COLUMN IF EXISTS pickup_instructions,
  DROP COLUMN IF EXISTS vehicle_details,
  DROP COLUMN IF EXISTS journey_notes,
  DROP COLUMN IF EXISTS passengers;

COMMENT ON TABLE public.journeys IS
  'Movement only: shared route, times, operator, booking, and status. Type-specific details live on journey_*_details.';
