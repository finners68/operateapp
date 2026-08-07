-- Per-person seats/names on a shared flight journey.
-- Boarding passes stay on travel_tickets; ticket_reference = passenger id.

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS passengers jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.journeys.passengers IS
  'Flight passengers: [{id, name, seat}]. Boarding passes link via travel_tickets.ticket_reference = passenger id.';

-- Backfill from Legacy seat notes when passengers empty
UPDATE public.journeys j
SET passengers = jsonb_build_array(
  jsonb_build_object(
    'id', gen_random_uuid()::text,
    'name', '',
    'seat', btrim(regexp_replace(j.journey_notes, '^Legacy seat:\s*', '', 'i'))
  )
)
WHERE j.deleted_at IS NULL
  AND j.journey_type = 'flight'
  AND j.passengers = '[]'::jsonb
  AND j.journey_notes ~* '^Legacy seat:';

-- Flights that have boarding passes but no passenger meta yet
WITH flight_need AS (
  SELECT
    j.id AS journey_id,
    COALESCE(
      NULLIF(btrim(regexp_replace(COALESCE(j.journey_notes, ''), '^Legacy seat:\s*', '', 'i')), ''),
      (
        SELECT NULLIF(btrim(t.seat_number), '')
        FROM public.travel_tickets t
        WHERE t.journey_id = j.id AND t.deleted_at IS NULL
        ORDER BY t.sort_order, t.created_at
        LIMIT 1
      ),
      ''
    ) AS seat,
    COALESCE(
      (
        SELECT NULLIF(btrim(t.passenger_name), '')
        FROM public.travel_tickets t
        WHERE t.journey_id = j.id AND t.deleted_at IS NULL
        ORDER BY t.sort_order, t.created_at
        LIMIT 1
      ),
      ''
    ) AS pname,
    gen_random_uuid()::text AS pax_id
  FROM public.journeys j
  WHERE j.deleted_at IS NULL
    AND j.journey_type = 'flight'
    AND j.passengers = '[]'::jsonb
    AND EXISTS (
      SELECT 1 FROM public.travel_tickets t
      WHERE t.journey_id = j.id AND t.deleted_at IS NULL
    )
)
UPDATE public.journeys j
SET passengers = jsonb_build_array(
  jsonb_build_object('id', fn.pax_id, 'name', fn.pname, 'seat', fn.seat)
)
FROM flight_need fn
WHERE j.id = fn.journey_id;

-- Point existing tickets at the first passenger and copy seat/name when blank
UPDATE public.travel_tickets t
SET
  ticket_reference = COALESCE(NULLIF(t.ticket_reference, ''), j.passengers->0->>'id'),
  seat_number = COALESCE(NULLIF(btrim(t.seat_number), ''), NULLIF(j.passengers->0->>'seat', '')),
  passenger_name = COALESCE(NULLIF(btrim(t.passenger_name), ''), NULLIF(j.passengers->0->>'name', '')),
  updated_at = now()
FROM public.journeys j
WHERE t.journey_id = j.id
  AND t.deleted_at IS NULL
  AND j.deleted_at IS NULL
  AND jsonb_typeof(j.passengers) = 'array'
  AND jsonb_array_length(j.passengers) > 0
  AND (
    t.ticket_reference IS NULL
    OR btrim(t.ticket_reference) = ''
    OR t.seat_number IS NULL
    OR btrim(t.seat_number) = ''
  );
