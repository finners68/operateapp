-- Rebuild journey_passengers so id is globally unique (PRIMARY KEY (id)).
-- Old table is kept as journey_passengers_legacy until row counts are verified.
-- No other table has a foreign key to journey_passengers.
-- travel_tickets.ticket_reference is a loose text link; remap by (journey_id, old id).

CREATE TABLE public.journey_passengers_v2 (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    journey_id uuid NOT NULL,
    name text,
    seat text,
    booking_reference text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT journey_passengers_v2_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE public.journey_passenger_id_map (
    old_id uuid NOT NULL,
    journey_id uuid NOT NULL,
    new_id uuid NOT NULL,
    PRIMARY KEY (journey_id, old_id)
);

INSERT INTO public.journey_passenger_id_map (old_id, journey_id, new_id)
SELECT id, journey_id, gen_random_uuid()
FROM public.journey_passengers;

INSERT INTO public.journey_passengers_v2 (
    id, organisation_id, journey_id, name, seat, booking_reference, created_at, updated_at
)
SELECT
    m.new_id,
    p.organisation_id,
    p.journey_id,
    p.name,
    p.seat,
    p.booking_reference,
    p.created_at,
    now()
FROM public.journey_passengers p
JOIN public.journey_passenger_id_map m
  ON m.old_id = p.id
 AND m.journey_id = p.journey_id;

UPDATE public.travel_tickets t
SET ticket_reference = m.new_id::text,
    updated_at = now()
FROM public.journey_passenger_id_map m
WHERE t.journey_id = m.journey_id
  AND t.deleted_at IS NULL
  AND NULLIF(btrim(t.ticket_reference), '') IS NOT NULL
  AND t.ticket_reference = m.old_id::text;

CREATE INDEX journey_passengers_v2_journey_idx
    ON public.journey_passengers_v2 (journey_id);
CREATE INDEX journey_passengers_v2_org_journey_idx
    ON public.journey_passengers_v2 (organisation_id, journey_id);

CREATE TRIGGER journey_passengers_v2_set_updated_at
    BEFORE UPDATE ON public.journey_passengers_v2
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.journey_passengers_v2 ENABLE ROW LEVEL SECURITY;

CREATE POLICY journey_passengers_v2_member_access
ON public.journey_passengers_v2
FOR ALL
TO authenticated
USING (public.v2_is_organisation_member(organisation_id))
WITH CHECK (public.v2_is_organisation_member(organisation_id));

DO $$
DECLARE
  jake_org uuid := '1ba17032-5bb2-4310-afa7-3a6fc5e94df4';
  fin_org uuid := 'e8fc13af-4b2d-4eed-a5ef-92fd703b03e5';
  pol text;
BEGIN
  pol := format('organisation_id in (%L::uuid, %L::uuid)', jake_org, fin_org);
  EXECUTE format(
    'CREATE POLICY dev_anon_journey_passengers_v2 ON public.journey_passengers_v2 FOR ALL TO anon USING (%s) WITH CHECK (%s)',
    pol, pol
  );
END $$;

GRANT ALL ON TABLE public.journey_passengers_v2 TO anon, authenticated, service_role;

ALTER TABLE public.journey_passengers RENAME TO journey_passengers_legacy;

ALTER INDEX IF EXISTS public.journey_passengers_pkey
  RENAME TO journey_passengers_legacy_pkey;
ALTER INDEX IF EXISTS public.journey_passengers_journey_idx
  RENAME TO journey_passengers_legacy_journey_idx;
ALTER INDEX IF EXISTS public.journey_passengers_org_idx
  RENAME TO journey_passengers_legacy_org_idx;
ALTER INDEX IF EXISTS public.journey_passengers_id_organisation_id_key
  RENAME TO journey_passengers_legacy_id_org_journey_key;

ALTER TABLE public.journey_passengers_v2 RENAME TO journey_passengers;

ALTER INDEX public.journey_passengers_v2_pkey RENAME TO journey_passengers_pkey;
ALTER INDEX public.journey_passengers_v2_journey_idx RENAME TO journey_passengers_journey_idx;
ALTER INDEX public.journey_passengers_v2_org_journey_idx RENAME TO journey_passengers_org_journey_idx;

ALTER TABLE public.journey_passengers
  RENAME CONSTRAINT journey_passengers_v2_journey_fk TO journey_passengers_journey_fk;
ALTER TABLE public.journey_passengers
  RENAME CONSTRAINT journey_passengers_v2_organisation_id_fkey TO journey_passengers_organisation_id_fkey;

DROP POLICY IF EXISTS journey_passengers_v2_member_access ON public.journey_passengers;
CREATE POLICY journey_passengers_v2_member_access
ON public.journey_passengers
FOR ALL
TO authenticated
USING (public.v2_is_organisation_member(organisation_id))
WITH CHECK (public.v2_is_organisation_member(organisation_id));

DROP POLICY IF EXISTS dev_anon_journey_passengers_v2 ON public.journey_passengers;
DO $$
DECLARE
  jake_org uuid := '1ba17032-5bb2-4310-afa7-3a6fc5e94df4';
  fin_org uuid := 'e8fc13af-4b2d-4eed-a5ef-92fd703b03e5';
  pol text;
BEGIN
  pol := format('organisation_id in (%L::uuid, %L::uuid)', jake_org, fin_org);
  EXECUTE format(
    'CREATE POLICY dev_anon_journey_passengers ON public.journey_passengers FOR ALL TO anon USING (%s) WITH CHECK (%s)',
    pol, pol
  );
END $$;

ALTER TRIGGER journey_passengers_v2_set_updated_at ON public.journey_passengers
  RENAME TO journey_passengers_set_updated_at;

-- journey_passengers is now the source of truth. Do not copy JSON passenger
-- ids onto the table (the same JSON id is reused across journeys).
CREATE OR REPLACE FUNCTION public.sync_journey_subtypes_from_parent()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  iata_dep char(3);
  iata_arr char(3);
  gtype text;
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

  RETURN NEW;
END;
$$;

COMMENT ON TABLE public.journey_passengers IS
  'One row per person on a journey. id is globally unique. Source of truth; not synced from journeys.passengers JSON.';
COMMENT ON TABLE public.journey_passengers_legacy IS
  'Pre-rebuild copy of journey_passengers. Keep until row counts are verified, then drop.';
COMMENT ON TABLE public.journey_passenger_id_map IS
  'Maps (old passenger id, journey_id) to the new unique journey_passengers.id.';
