-- Additive parent + subtype journeys architecture.
-- Old journeys columns are kept for dual-write until a later cleanup migration.

CREATE OR REPLACE FUNCTION public.journey_passenger_uuid(p_journey_id uuid, p_raw_id text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_raw_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      THEN p_raw_id::uuid
    ELSE (
      substr(md5(p_journey_id::text || ':' || coalesce(p_raw_id, '')), 1, 8) || '-' ||
      substr(md5(p_journey_id::text || ':' || coalesce(p_raw_id, '')), 9, 4) || '-' ||
      '4' || substr(md5(p_journey_id::text || ':' || coalesce(p_raw_id, '')), 13, 3) || '-' ||
      '8' || substr(md5(p_journey_id::text || ':' || coalesce(p_raw_id, '')), 17, 3) || '-' ||
      substr(md5(p_journey_id::text || ':' || coalesce(p_raw_id, '')), 21, 12)
    )::uuid
  END;
$$;

ALTER TABLE public.journeys
  ALTER COLUMN journey_title DROP NOT NULL;

ALTER TABLE public.journeys
  DROP CONSTRAINT IF EXISTS journeys_journey_type_check;

ALTER TABLE public.journeys
  ADD CONSTRAINT journeys_journey_type_check
  CHECK (
    journey_type = ANY (ARRAY[
      'flight'::text,
      'rail'::text,
      'ground_transfer'::text,
      'ferry'::text,
      'coach'::text,
      'walk'::text,
      'cycle'::text,
      'other'::text
    ])
  );

-- Universal route backfill from type-specific columns (only when empty).
UPDATE public.journeys
SET departure_location_name = NULLIF(btrim(departure_station_name), '')
WHERE journey_type = 'rail'
  AND (departure_location_name IS NULL OR btrim(departure_location_name) = '')
  AND NULLIF(btrim(departure_station_name), '') IS NOT NULL;

UPDATE public.journeys
SET arrival_location_name = NULLIF(btrim(arrival_station_name), '')
WHERE journey_type = 'rail'
  AND (arrival_location_name IS NULL OR btrim(arrival_location_name) = '')
  AND NULLIF(btrim(arrival_station_name), '') IS NOT NULL;

UPDATE public.journeys
SET departure_location_name = NULLIF(btrim(departure_port_name), '')
WHERE journey_type = 'ferry'
  AND (departure_location_name IS NULL OR btrim(departure_location_name) = '')
  AND NULLIF(btrim(departure_port_name), '') IS NOT NULL;

UPDATE public.journeys
SET arrival_location_name = NULLIF(btrim(arrival_port_name), '')
WHERE journey_type = 'ferry'
  AND (arrival_location_name IS NULL OR btrim(arrival_location_name) = '')
  AND NULLIF(btrim(arrival_port_name), '') IS NOT NULL;

UPDATE public.journeys
SET departure_location_name = NULLIF(btrim(pickup_location), '')
WHERE journey_type = 'ground_transfer'
  AND (departure_location_name IS NULL OR btrim(departure_location_name) = '')
  AND NULLIF(btrim(pickup_location), '') IS NOT NULL;

UPDATE public.journeys
SET arrival_location_name = NULLIF(btrim(dropoff_location), '')
WHERE journey_type = 'ground_transfer'
  AND (arrival_location_name IS NULL OR btrim(arrival_location_name) = '')
  AND NULLIF(btrim(dropoff_location), '') IS NOT NULL;

-- Useful leftover journey_notes into note_items, without duplicating.
UPDATE public.journeys j
SET note_items = coalesce(j.note_items, '[]'::jsonb) || jsonb_build_array(
  jsonb_build_object('id', 'legacy-notes', 'text', btrim(j.journey_notes))
)
WHERE j.deleted_at IS NULL
  AND NULLIF(btrim(j.journey_notes), '') IS NOT NULL
  AND left(btrim(j.journey_notes), 1) <> '{'
  AND j.journey_notes !~* '^Legacy seat:'
  AND (
    j.note_items IS NULL
    OR jsonb_typeof(j.note_items) <> 'array'
    OR NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(
        CASE WHEN jsonb_typeof(j.note_items) = 'array' THEN j.note_items ELSE '[]'::jsonb END
      ) n
      WHERE lower(btrim(coalesce(n->>'text', ''))) = lower(btrim(j.journey_notes))
    )
  );

CREATE TABLE IF NOT EXISTS public.journey_flight_details (
    journey_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    flight_number text,
    departure_airport_iata char(3)
        CHECK (departure_airport_iata IS NULL OR departure_airport_iata ~ '^[A-Z]{3}$'),
    arrival_airport_iata char(3)
        CHECK (arrival_airport_iata IS NULL OR arrival_airport_iata ~ '^[A-Z]{3}$'),
    departure_terminal text,
    arrival_terminal text,
    departure_gate text,
    arrival_gate text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (journey_id, organisation_id),
    CONSTRAINT journey_flight_details_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.journey_rail_details (
    journey_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    train_number text,
    departure_station_code text,
    arrival_station_code text,
    departure_platform text,
    arrival_platform text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (journey_id, organisation_id),
    CONSTRAINT journey_rail_details_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.journey_ground_details (
    journey_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    ground_transport_type text
        CHECK (
            ground_transport_type IS NULL
            OR ground_transport_type = ANY (ARRAY[
                'taxi'::text,
                'uber'::text,
                'private_car'::text,
                'chauffeur'::text,
                'shuttle'::text,
                'minibus'::text,
                'bus'::text,
                'other'::text
            ])
        ),
    pickup_instructions text,
    vehicle_details text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (journey_id, organisation_id),
    CONSTRAINT journey_ground_details_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.journey_ferry_details (
    journey_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    ferry_service_number text,
    departure_port_code text,
    arrival_port_code text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (journey_id, organisation_id),
    CONSTRAINT journey_ferry_details_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.journey_coach_details (
    journey_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    coach_service_number text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (journey_id, organisation_id),
    CONSTRAINT journey_coach_details_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.journey_passengers (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    journey_id uuid NOT NULL,
    name text,
    seat text,
    booking_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (journey_id, id),
    UNIQUE (id, organisation_id, journey_id),
    CONSTRAINT journey_passengers_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS journey_flight_details_org_idx
    ON public.journey_flight_details (organisation_id);
CREATE INDEX IF NOT EXISTS journey_rail_details_org_idx
    ON public.journey_rail_details (organisation_id);
CREATE INDEX IF NOT EXISTS journey_ground_details_org_idx
    ON public.journey_ground_details (organisation_id);
CREATE INDEX IF NOT EXISTS journey_ferry_details_org_idx
    ON public.journey_ferry_details (organisation_id);
CREATE INDEX IF NOT EXISTS journey_coach_details_org_idx
    ON public.journey_coach_details (organisation_id);
CREATE INDEX IF NOT EXISTS journey_passengers_org_idx
    ON public.journey_passengers (organisation_id);
CREATE INDEX IF NOT EXISTS journey_passengers_journey_idx
    ON public.journey_passengers (journey_id);

DROP TRIGGER IF EXISTS journey_flight_details_set_updated_at ON public.journey_flight_details;
CREATE TRIGGER journey_flight_details_set_updated_at
    BEFORE UPDATE ON public.journey_flight_details
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS journey_rail_details_set_updated_at ON public.journey_rail_details;
CREATE TRIGGER journey_rail_details_set_updated_at
    BEFORE UPDATE ON public.journey_rail_details
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS journey_ground_details_set_updated_at ON public.journey_ground_details;
CREATE TRIGGER journey_ground_details_set_updated_at
    BEFORE UPDATE ON public.journey_ground_details
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS journey_ferry_details_set_updated_at ON public.journey_ferry_details;
CREATE TRIGGER journey_ferry_details_set_updated_at
    BEFORE UPDATE ON public.journey_ferry_details
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS journey_coach_details_set_updated_at ON public.journey_coach_details;
CREATE TRIGGER journey_coach_details_set_updated_at
    BEFORE UPDATE ON public.journey_coach_details
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS journey_passengers_set_updated_at ON public.journey_passengers;
CREATE TRIGGER journey_passengers_set_updated_at
    BEFORE UPDATE ON public.journey_passengers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.infer_ground_transport_type(src text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN src ~* '\buber\b' THEN 'uber'
    WHEN src ~* '\btaxi\b' THEN 'taxi'
    WHEN src ~* 'chauffeur|private driver' THEN 'chauffeur'
    WHEN src ~* '\bshuttle\b' THEN 'shuttle'
    WHEN src ~* '\bminibus\b' THEN 'minibus'
    WHEN src ~* '\bbus\b' THEN 'bus'
    WHEN src ~* 'private car' THEN 'private_car'
    ELSE NULL
  END;
$$;

INSERT INTO public.journey_flight_details (
    journey_id, organisation_id, flight_number,
    departure_airport_iata, arrival_airport_iata,
    departure_terminal, arrival_terminal, departure_gate, arrival_gate
)
SELECT
    j.id,
    j.organisation_id,
    NULLIF(btrim(j.flight_number), ''),
    CASE
      WHEN upper(btrim(j.departure_airport_iata::text)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(j.departure_airport_iata::text))::char(3)
      WHEN upper(btrim(j.departure_location_code)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(j.departure_location_code))::char(3)
      ELSE NULL
    END,
    CASE
      WHEN upper(btrim(j.arrival_airport_iata::text)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(j.arrival_airport_iata::text))::char(3)
      WHEN upper(btrim(j.arrival_location_code)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(j.arrival_location_code))::char(3)
      ELSE NULL
    END,
    NULLIF(btrim(j.departure_terminal), ''),
    NULLIF(btrim(j.arrival_terminal), ''),
    NULLIF(btrim(j.departure_gate), ''),
    NULLIF(btrim(j.arrival_gate), '')
FROM public.journeys j
WHERE j.journey_type = 'flight'
  AND (
    NULLIF(btrim(j.flight_number), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_airport_iata::text), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_airport_iata::text), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_location_code), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_location_code), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_terminal), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_terminal), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_gate), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_gate), '') IS NOT NULL
  )
ON CONFLICT (journey_id) DO NOTHING;

INSERT INTO public.journey_rail_details (
    journey_id, organisation_id, train_number,
    departure_station_code, arrival_station_code,
    departure_platform, arrival_platform
)
SELECT
    j.id,
    j.organisation_id,
    NULLIF(btrim(j.train_number), ''),
    CASE WHEN upper(btrim(j.departure_location_code)) ~ '^[A-Z0-9]{2,8}$'
      THEN upper(btrim(j.departure_location_code)) ELSE NULL END,
    CASE WHEN upper(btrim(j.arrival_location_code)) ~ '^[A-Z0-9]{2,8}$'
      THEN upper(btrim(j.arrival_location_code)) ELSE NULL END,
    NULLIF(btrim(j.departure_platform), ''),
    NULLIF(btrim(j.arrival_platform), '')
FROM public.journeys j
WHERE j.journey_type = 'rail'
  AND (
    NULLIF(btrim(j.train_number), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_platform), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_platform), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_location_code), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_location_code), '') IS NOT NULL
  )
ON CONFLICT (journey_id) DO NOTHING;

INSERT INTO public.journey_ferry_details (
    journey_id, organisation_id, ferry_service_number,
    departure_port_code, arrival_port_code
)
SELECT
    j.id,
    j.organisation_id,
    NULLIF(btrim(j.ferry_service_number), ''),
    CASE WHEN upper(btrim(j.departure_location_code)) ~ '^[A-Z0-9]{2,8}$'
      THEN upper(btrim(j.departure_location_code)) ELSE NULL END,
    CASE WHEN upper(btrim(j.arrival_location_code)) ~ '^[A-Z0-9]{2,8}$'
      THEN upper(btrim(j.arrival_location_code)) ELSE NULL END
FROM public.journeys j
WHERE j.journey_type = 'ferry'
  AND (
    NULLIF(btrim(j.ferry_service_number), '') IS NOT NULL
    OR NULLIF(btrim(j.departure_location_code), '') IS NOT NULL
    OR NULLIF(btrim(j.arrival_location_code), '') IS NOT NULL
  )
ON CONFLICT (journey_id) DO NOTHING;

INSERT INTO public.journey_coach_details (
    journey_id, organisation_id, coach_service_number
)
SELECT
    j.id,
    j.organisation_id,
    NULLIF(btrim(j.coach_service_number), '')
FROM public.journeys j
WHERE j.journey_type = 'coach'
  AND NULLIF(btrim(j.coach_service_number), '') IS NOT NULL
ON CONFLICT (journey_id) DO NOTHING;

INSERT INTO public.journey_ground_details (
    journey_id, organisation_id, ground_transport_type,
    pickup_instructions, vehicle_details
)
SELECT
    j.id,
    j.organisation_id,
    COALESCE(
      public.infer_ground_transport_type(j.vehicle_details),
      public.infer_ground_transport_type(j.pickup_instructions),
      public.infer_ground_transport_type(j.journey_title),
      public.infer_ground_transport_type(j.operator_name)
    ),
    NULLIF(btrim(j.pickup_instructions), ''),
    NULLIF(btrim(j.vehicle_details), '')
FROM public.journeys j
WHERE j.journey_type = 'ground_transfer'
  AND (
    NULLIF(btrim(j.pickup_instructions), '') IS NOT NULL
    OR NULLIF(btrim(j.vehicle_details), '') IS NOT NULL
    OR public.infer_ground_transport_type(j.vehicle_details) IS NOT NULL
    OR public.infer_ground_transport_type(j.pickup_instructions) IS NOT NULL
    OR public.infer_ground_transport_type(j.journey_title) IS NOT NULL
    OR public.infer_ground_transport_type(j.operator_name) IS NOT NULL
  )
ON CONFLICT (journey_id) DO NOTHING;

INSERT INTO public.journey_passengers (
    id, organisation_id, journey_id, name, seat, booking_reference
)
SELECT
    public.journey_passenger_uuid(j.id, elem->>'id'),
    j.organisation_id,
    j.id,
    NULLIF(btrim(coalesce(elem->>'name', '')), ''),
    NULLIF(btrim(coalesce(elem->>'seat', '')), ''),
    NULLIF(btrim(coalesce(elem->>'booking_reference', elem->>'bookingRef', '')), '')
FROM public.journeys j
CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(j.passengers) = 'array' THEN j.passengers
      WHEN jsonb_typeof(j.passengers) = 'object' THEN jsonb_build_array(j.passengers)
      ELSE '[]'::jsonb
    END
) elem
WHERE j.deleted_at IS NULL
  AND elem IS NOT NULL
  AND jsonb_typeof(elem) = 'object'
ON CONFLICT (journey_id, id) DO NOTHING;

UPDATE public.travel_tickets t
SET ticket_reference = public.journey_passenger_uuid(t.journey_id, t.ticket_reference)::text,
    updated_at = now()
WHERE t.deleted_at IS NULL
  AND NULLIF(btrim(t.ticket_reference), '') IS NOT NULL
  AND t.ticket_reference !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.journey_passengers p
    WHERE p.journey_id = t.journey_id
      AND p.id = public.journey_passenger_uuid(t.journey_id, t.ticket_reference)
  );

ALTER TABLE public.journey_flight_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_rail_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_ground_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_ferry_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_coach_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_passengers ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  member_tables text[] := ARRAY[
    'journey_flight_details',
    'journey_rail_details',
    'journey_ground_details',
    'journey_ferry_details',
    'journey_coach_details',
    'journey_passengers'
  ];
BEGIN
  FOREACH tbl IN ARRAY member_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', tbl || '_v2_member_access', tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
       USING (public.v2_is_organisation_member(organisation_id))
       WITH CHECK (public.v2_is_organisation_member(organisation_id))',
      tbl || '_v2_member_access', tbl
    );
    EXECUTE format('GRANT ALL ON TABLE public.%I TO anon, authenticated, service_role', tbl);
  END LOOP;
END $$;

DO $$
DECLARE
  jake_org uuid := '1ba17032-5bb2-4310-afa7-3a6fc5e94df4';
  fin_org uuid := 'e8fc13af-4b2d-4eed-a5ef-92fd703b03e5';
  pol text;
  tbl text;
  extra text[] := ARRAY[
    'journey_flight_details',
    'journey_rail_details',
    'journey_ground_details',
    'journey_ferry_details',
    'journey_coach_details',
    'journey_passengers'
  ];
BEGIN
  pol := format('organisation_id in (%L::uuid, %L::uuid)', jake_org, fin_org);
  FOREACH tbl IN ARRAY extra LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'dev_anon_' || tbl, tbl);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO anon USING (%s) WITH CHECK (%s)',
      'dev_anon_' || tbl, tbl, pol, pol
    );
  END LOOP;
END $$;

COMMENT ON TABLE public.journey_flight_details IS
  'Flight-only enrichment. Route/times live on public.journeys.';
COMMENT ON TABLE public.journey_rail_details IS
  'Rail-only enrichment. Route/times live on public.journeys.';
COMMENT ON TABLE public.journey_ground_details IS
  'Ground-transfer enrichment. Route/times live on public.journeys.';
COMMENT ON TABLE public.journey_ferry_details IS
  'Ferry-only enrichment. Route/times live on public.journeys.';
COMMENT ON TABLE public.journey_coach_details IS
  'Coach-only enrichment. Route/times live on public.journeys.';
COMMENT ON TABLE public.journey_passengers IS
  'Passengers for any journey. Boarding passes still link via travel_tickets.ticket_reference.';

-- Keep subtype tables filled when inbound tools still write the fat journeys columns.
CREATE OR REPLACE FUNCTION public.sync_journey_subtypes_from_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  iata_dep char(3);
  iata_arr char(3);
  gtype text;
  elem jsonb;
  pax_id uuid;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.journey_type = 'flight' THEN
    iata_dep := CASE
      WHEN upper(btrim(NEW.departure_airport_iata::text)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(NEW.departure_airport_iata::text))::char(3)
      WHEN upper(btrim(NEW.departure_location_code)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(NEW.departure_location_code))::char(3)
      ELSE NULL
    END;
    iata_arr := CASE
      WHEN upper(btrim(NEW.arrival_airport_iata::text)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(NEW.arrival_airport_iata::text))::char(3)
      WHEN upper(btrim(NEW.arrival_location_code)) ~ '^[A-Z]{3}$'
        THEN upper(btrim(NEW.arrival_location_code))::char(3)
      ELSE NULL
    END;
    IF NULLIF(btrim(NEW.flight_number), '') IS NOT NULL
       OR iata_dep IS NOT NULL OR iata_arr IS NOT NULL
       OR NULLIF(btrim(NEW.departure_terminal), '') IS NOT NULL
       OR NULLIF(btrim(NEW.arrival_terminal), '') IS NOT NULL
       OR NULLIF(btrim(NEW.departure_gate), '') IS NOT NULL
       OR NULLIF(btrim(NEW.arrival_gate), '') IS NOT NULL THEN
      INSERT INTO public.journey_flight_details (
        journey_id, organisation_id, flight_number,
        departure_airport_iata, arrival_airport_iata,
        departure_terminal, arrival_terminal, departure_gate, arrival_gate
      ) VALUES (
        NEW.id, NEW.organisation_id, NULLIF(btrim(NEW.flight_number), ''),
        iata_dep, iata_arr,
        NULLIF(btrim(NEW.departure_terminal), ''),
        NULLIF(btrim(NEW.arrival_terminal), ''),
        NULLIF(btrim(NEW.departure_gate), ''),
        NULLIF(btrim(NEW.arrival_gate), '')
      )
      ON CONFLICT (journey_id) DO UPDATE SET
        flight_number = EXCLUDED.flight_number,
        departure_airport_iata = EXCLUDED.departure_airport_iata,
        arrival_airport_iata = EXCLUDED.arrival_airport_iata,
        departure_terminal = EXCLUDED.departure_terminal,
        arrival_terminal = EXCLUDED.arrival_terminal,
        departure_gate = EXCLUDED.departure_gate,
        arrival_gate = EXCLUDED.arrival_gate;
    END IF;
  END IF;

  IF NEW.journey_type = 'rail'
     AND (
       NULLIF(btrim(NEW.train_number), '') IS NOT NULL
       OR NULLIF(btrim(NEW.departure_platform), '') IS NOT NULL
       OR NULLIF(btrim(NEW.arrival_platform), '') IS NOT NULL
       OR NULLIF(btrim(NEW.departure_location_code), '') IS NOT NULL
       OR NULLIF(btrim(NEW.arrival_location_code), '') IS NOT NULL
     ) THEN
    INSERT INTO public.journey_rail_details (
      journey_id, organisation_id, train_number,
      departure_station_code, arrival_station_code,
      departure_platform, arrival_platform
    ) VALUES (
      NEW.id, NEW.organisation_id, NULLIF(btrim(NEW.train_number), ''),
      NULLIF(btrim(NEW.departure_location_code), ''),
      NULLIF(btrim(NEW.arrival_location_code), ''),
      NULLIF(btrim(NEW.departure_platform), ''),
      NULLIF(btrim(NEW.arrival_platform), '')
    )
    ON CONFLICT (journey_id) DO UPDATE SET
      train_number = EXCLUDED.train_number,
      departure_station_code = EXCLUDED.departure_station_code,
      arrival_station_code = EXCLUDED.arrival_station_code,
      departure_platform = EXCLUDED.departure_platform,
      arrival_platform = EXCLUDED.arrival_platform;
  END IF;

  IF NEW.journey_type = 'ferry'
     AND (
       NULLIF(btrim(NEW.ferry_service_number), '') IS NOT NULL
       OR NULLIF(btrim(NEW.departure_location_code), '') IS NOT NULL
       OR NULLIF(btrim(NEW.arrival_location_code), '') IS NOT NULL
     ) THEN
    INSERT INTO public.journey_ferry_details (
      journey_id, organisation_id, ferry_service_number,
      departure_port_code, arrival_port_code
    ) VALUES (
      NEW.id, NEW.organisation_id, NULLIF(btrim(NEW.ferry_service_number), ''),
      NULLIF(btrim(NEW.departure_location_code), ''),
      NULLIF(btrim(NEW.arrival_location_code), '')
    )
    ON CONFLICT (journey_id) DO UPDATE SET
      ferry_service_number = EXCLUDED.ferry_service_number,
      departure_port_code = EXCLUDED.departure_port_code,
      arrival_port_code = EXCLUDED.arrival_port_code;
  END IF;

  IF NEW.journey_type = 'coach' AND NULLIF(btrim(NEW.coach_service_number), '') IS NOT NULL THEN
    INSERT INTO public.journey_coach_details (
      journey_id, organisation_id, coach_service_number
    ) VALUES (
      NEW.id, NEW.organisation_id, NULLIF(btrim(NEW.coach_service_number), '')
    )
    ON CONFLICT (journey_id) DO UPDATE SET
      coach_service_number = EXCLUDED.coach_service_number;
  END IF;

  IF NEW.journey_type = 'ground_transfer' THEN
    gtype := COALESCE(
      public.infer_ground_transport_type(NEW.vehicle_details),
      public.infer_ground_transport_type(NEW.pickup_instructions),
      public.infer_ground_transport_type(NEW.journey_title),
      public.infer_ground_transport_type(NEW.operator_name)
    );
    IF NULLIF(btrim(NEW.pickup_instructions), '') IS NOT NULL
       OR NULLIF(btrim(NEW.vehicle_details), '') IS NOT NULL
       OR gtype IS NOT NULL THEN
      INSERT INTO public.journey_ground_details (
        journey_id, organisation_id, ground_transport_type,
        pickup_instructions, vehicle_details
      ) VALUES (
        NEW.id, NEW.organisation_id, gtype,
        NULLIF(btrim(NEW.pickup_instructions), ''),
        NULLIF(btrim(NEW.vehicle_details), '')
      )
      ON CONFLICT (journey_id) DO UPDATE SET
        ground_transport_type = COALESCE(EXCLUDED.ground_transport_type, public.journey_ground_details.ground_transport_type),
        pickup_instructions = EXCLUDED.pickup_instructions,
        vehicle_details = EXCLUDED.vehicle_details;
    END IF;
  END IF;

  IF NEW.passengers IS NOT NULL
     AND (
       jsonb_typeof(NEW.passengers) = 'array'
       OR jsonb_typeof(NEW.passengers) = 'object'
     ) THEN
    FOR elem IN
      SELECT * FROM jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(NEW.passengers) = 'array' THEN NEW.passengers
          ELSE jsonb_build_array(NEW.passengers)
        END
      )
    LOOP
      IF jsonb_typeof(elem) <> 'object' THEN
        CONTINUE;
      END IF;
      pax_id := public.journey_passenger_uuid(NEW.id, elem->>'id');
      INSERT INTO public.journey_passengers (
        id, organisation_id, journey_id, name, seat, booking_reference
      ) VALUES (
        pax_id,
        NEW.organisation_id,
        NEW.id,
        NULLIF(btrim(coalesce(elem->>'name', '')), ''),
        NULLIF(btrim(coalesce(elem->>'seat', '')), ''),
        NULLIF(btrim(coalesce(elem->>'booking_reference', elem->>'bookingRef', '')), '')
      )
      ON CONFLICT (journey_id, id) DO UPDATE SET
        name = EXCLUDED.name,
        seat = EXCLUDED.seat,
        booking_reference = EXCLUDED.booking_reference;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_journey_subtypes ON public.journeys;
CREATE TRIGGER trg_sync_journey_subtypes
  AFTER INSERT OR UPDATE ON public.journeys
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_journey_subtypes_from_parent();
