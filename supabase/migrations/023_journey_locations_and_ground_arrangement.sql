-- Additive location + ground-arrangement fields.
-- Keeps the existing parent journeys + 1:1 subtype architecture.
-- Does not drop columns, rewrite historical location names, or add hotel/venue FKs.

ALTER TABLE public.journeys
  ADD COLUMN IF NOT EXISTS departure_location_kind text,
  ADD COLUMN IF NOT EXISTS departure_location_address text,
  ADD COLUMN IF NOT EXISTS arrival_location_kind text,
  ADD COLUMN IF NOT EXISTS arrival_location_address text;

ALTER TABLE public.journeys
  DROP CONSTRAINT IF EXISTS journeys_departure_location_kind_check,
  DROP CONSTRAINT IF EXISTS journeys_arrival_location_kind_check;

ALTER TABLE public.journeys
  ADD CONSTRAINT journeys_departure_location_kind_check
    CHECK (
      departure_location_kind IS NULL OR departure_location_kind = ANY (ARRAY[
        'airport'::text,
        'hotel'::text,
        'venue'::text,
        'station'::text,
        'port'::text,
        'custom'::text
      ])
    ),
  ADD CONSTRAINT journeys_arrival_location_kind_check
    CHECK (
      arrival_location_kind IS NULL OR arrival_location_kind = ANY (ARRAY[
        'airport'::text,
        'hotel'::text,
        'venue'::text,
        'station'::text,
        'port'::text,
        'custom'::text
      ])
    );

ALTER TABLE public.journey_ground_details
  ADD COLUMN IF NOT EXISTS arrangement text,
  ADD COLUMN IF NOT EXISTS preferred_method text;

ALTER TABLE public.journey_ground_details
  DROP CONSTRAINT IF EXISTS journey_ground_details_arrangement_check,
  DROP CONSTRAINT IF EXISTS journey_ground_details_preferred_method_check;

ALTER TABLE public.journey_ground_details
  ADD CONSTRAINT journey_ground_details_arrangement_check
    CHECK (
      arrangement IS NULL OR arrangement = ANY (ARRAY[
        'pre_arranged'::text,
        'arrange_at_time'::text
      ])
    ),
  ADD CONSTRAINT journey_ground_details_preferred_method_check
    CHECK (
      preferred_method IS NULL OR preferred_method = ANY (ARRAY[
        'uber'::text,
        'taxi'::text,
        'either'::text
      ])
    );

-- Safe location-kind backfill from obvious tokens only. Names are not rewritten.
UPDATE public.journeys
SET departure_location_kind = 'hotel'
WHERE deleted_at IS NULL
  AND departure_location_kind IS NULL
  AND lower(btrim(coalesce(departure_location_name, ''))) = 'hotel';

UPDATE public.journeys
SET arrival_location_kind = 'hotel'
WHERE deleted_at IS NULL
  AND arrival_location_kind IS NULL
  AND lower(btrim(coalesce(arrival_location_name, ''))) = 'hotel';

UPDATE public.journeys
SET departure_location_kind = 'venue'
WHERE deleted_at IS NULL
  AND departure_location_kind IS NULL
  AND lower(btrim(coalesce(departure_location_name, ''))) = 'venue';

UPDATE public.journeys
SET arrival_location_kind = 'venue'
WHERE deleted_at IS NULL
  AND arrival_location_kind IS NULL
  AND lower(btrim(coalesce(arrival_location_name, ''))) = 'venue';

UPDATE public.journeys
SET departure_location_kind = 'airport'
WHERE deleted_at IS NULL
  AND departure_location_kind IS NULL
  AND lower(btrim(coalesce(departure_location_name, ''))) = 'airport';

UPDATE public.journeys
SET arrival_location_kind = 'airport'
WHERE deleted_at IS NULL
  AND arrival_location_kind IS NULL
  AND lower(btrim(coalesce(arrival_location_name, ''))) = 'airport';

UPDATE public.journeys
SET departure_location_kind = 'airport'
WHERE deleted_at IS NULL
  AND journey_type = 'flight'
  AND departure_location_kind IS NULL;

UPDATE public.journeys
SET arrival_location_kind = 'airport'
WHERE deleted_at IS NULL
  AND journey_type = 'flight'
  AND arrival_location_kind IS NULL;

UPDATE public.journeys
SET departure_location_kind = 'station'
WHERE deleted_at IS NULL
  AND journey_type = 'rail'
  AND departure_location_kind IS NULL;

UPDATE public.journeys
SET arrival_location_kind = 'station'
WHERE deleted_at IS NULL
  AND journey_type = 'rail'
  AND arrival_location_kind IS NULL;

UPDATE public.journeys
SET departure_location_kind = 'port'
WHERE deleted_at IS NULL
  AND journey_type = 'ferry'
  AND departure_location_kind IS NULL;

UPDATE public.journeys
SET arrival_location_kind = 'port'
WHERE deleted_at IS NULL
  AND journey_type = 'ferry'
  AND arrival_location_kind IS NULL;

-- Conservative ground arrangement backfill. Ambiguous rows stay null so
-- compose can keep using the legacy inference fallback.
UPDATE public.journey_ground_details gd
SET
  arrangement = 'arrange_at_time',
  preferred_method = CASE gd.ground_transport_type
    WHEN 'uber' THEN 'uber'
    WHEN 'taxi' THEN 'taxi'
    ELSE 'either'
  END
FROM public.journeys j
WHERE gd.journey_id = j.id
  AND gd.arrangement IS NULL
  AND gd.ground_transport_type IN ('uber', 'taxi', 'other')
  AND (j.operator_name IS NULL OR btrim(j.operator_name) = '' OR lower(btrim(j.operator_name)) = 'driver')
  AND NOT EXISTS (
    SELECT 1
    FROM public.journey_contacts jc
    WHERE jc.journey_id = j.id
      AND jc.contact_role = 'driver'
  );

UPDATE public.journey_ground_details gd
SET arrangement = 'pre_arranged'
FROM public.journeys j
WHERE gd.journey_id = j.id
  AND gd.arrangement IS NULL
  AND (
    gd.ground_transport_type IN ('private_car', 'chauffeur', 'shuttle', 'minibus', 'bus')
    OR (
      NULLIF(btrim(j.operator_name), '') IS NOT NULL
      AND lower(btrim(j.operator_name)) <> 'driver'
    )
    OR EXISTS (
      SELECT 1
      FROM public.journey_contacts jc
      WHERE jc.journey_id = j.id
        AND jc.contact_role = 'driver'
    )
  );
