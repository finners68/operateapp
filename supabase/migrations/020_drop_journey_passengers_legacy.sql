-- Drop the passenger-rebuild backup tables now that row counts are verified.
-- Live source of truth remains public.journey_passengers.
-- Do not drop journeys subtype columns or journeys.passengers in this migration.

DROP TABLE IF EXISTS public.journey_passenger_id_map;
DROP TABLE IF EXISTS public.journey_passengers_legacy;
