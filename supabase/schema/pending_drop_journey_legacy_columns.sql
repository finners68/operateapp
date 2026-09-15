-- PENDING / DO NOT APPLY YET
-- Destructive cleanup of obsolete journeys columns.
-- Only run after the app has been verified on the parent + subtype architecture
-- and no code still reads or writes these columns.

-- Columns that will be removed from public.journeys:
--   departure_location_code, arrival_location_code
--   flight_number, departure_airport_iata, arrival_airport_iata,
--   departure_terminal, arrival_terminal, departure_gate, arrival_gate
--   train_number, departure_station_name, arrival_station_name,
--   departure_platform, arrival_platform
--   ferry_service_number, departure_port_name, arrival_port_name
--   coach_service_number
--   pickup_location, dropoff_location, pickup_instructions, vehicle_details
--   journey_notes, passengers

-- Also drop public.sync_journey_subtypes_from_parent() once dual-write ends.

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

DROP TRIGGER IF EXISTS trg_sync_journey_subtypes ON public.journeys;
DROP FUNCTION IF EXISTS public.sync_journey_subtypes_from_parent();
