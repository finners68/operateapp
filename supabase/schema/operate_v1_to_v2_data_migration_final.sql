-- =====================================================================
-- OPERATE: V1 -> V2 DATA MIGRATION
-- Tables and database metadata only
--
-- This script:
--   * Reads only from public.*_v1 tables
--   * Inserts into the new V2 tables
--   * Leaves every V1 table and row untouched
--   * Migrates file metadata and relationships, but NOT Storage objects
--   * Produces a file-copy manifest for the physical files
--   * Produces an exceptions report for ambiguous/unmigrated values
--
-- Run this whole file as ONE query in the Supabase SQL Editor.
-- Do not run individual sections separately.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '15min';
SET LOCAL TIME ZONE 'UTC';


-- =====================================================================
-- 1. PRE-FLIGHT
-- =====================================================================

DO $preflight$
DECLARE
    required_table text;
    v1_tables text[] := ARRAY[
        'ideas_v1',
        'logistics_items_v1',
        'notes_v1',
        'org_members_v1',
        'org_settings_v1',
        'orgs_v1',
        'profiles_v1',
        'show_checklist_items_v1',
        'show_files_v1',
        'show_flight_passes_v1',
        'show_flights_v1',
        'show_timeline_steps_v1',
        'shows_v1',
        'trips_v1'
    ];
    v2_tables text[] := ARRAY[
        'profiles',
        'organisations',
        'organisation_members',
        'organisation_settings',
        'organisation_billing_profiles',
        'organisation_exchange_rates',
        'user_preferences',
        'artists',
        'tours',
        'venues',
        'shows',
        'show_advances',
        'schedule_items',
        'checklist_items',
        'contacts',
        'companies',
        'company_contacts',
        'show_contacts',
        'tour_contacts',
        'journeys',
        'journey_contacts',
        'hotels',
        'hotel_bookings',
        'hotel_booking_shows',
        'files',
        'travel_tickets',
        'journey_files',
        'show_files',
        'show_financials',
        'show_expenses',
        'invoices',
        'invoice_line_items',
        'packing_lists',
        'packing_list_items',
        'ideas',
        'notes',
        'itinerary_submissions',
        'itinerary_submission_files'
    ];
BEGIN
    FOREACH required_table IN ARRAY v1_tables LOOP
        IF to_regclass(format('public.%I', required_table)) IS NULL THEN
            RAISE EXCEPTION 'Missing required V1 table public.%', required_table;
        END IF;
    END LOOP;

    FOREACH required_table IN ARRAY v2_tables LOOP
        IF to_regclass(format('public.%I', required_table)) IS NULL THEN
            RAISE EXCEPTION 'Missing required V2 table public.%', required_table;
        END IF;
    END LOOP;

    IF EXISTS (SELECT 1 FROM public.organisations) THEN
        RAISE EXCEPTION
            'V2 already contains organisation rows. This migration is intentionally one-time and has not run.';
    END IF;
END
$preflight$;


-- V2 schema correction: this value existed in V1 and was agreed for migration.
ALTER TABLE public.organisation_settings
    ADD COLUMN IF NOT EXISTS store_sequence integer NOT NULL DEFAULT 1
    CHECK (store_sequence > 0);


-- =====================================================================
-- 2. DURABLE MIGRATION REPORTS
--
-- These live outside public, so they are not exposed through the API.
-- Keep them until the file-copy and exception review are complete.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS migration_v1_to_v2;

DROP TABLE IF EXISTS migration_v1_to_v2.exceptions;
DROP TABLE IF EXISTS migration_v1_to_v2.file_copy_manifest;
DROP TABLE IF EXISTS migration_v1_to_v2.run_summary;

CREATE TABLE migration_v1_to_v2.exceptions (
    section text NOT NULL,
    source_table text NOT NULL,
    source_identifier text,
    issue text NOT NULL,
    source_value text
);

CREATE TABLE migration_v1_to_v2.file_copy_manifest (
    source_table text NOT NULL,
    source_identifier text NOT NULL,
    old_storage_path text NOT NULL,
    new_bucket_name text NOT NULL,
    new_storage_path text NOT NULL,
    target_file_id uuid NOT NULL
);

CREATE TABLE migration_v1_to_v2.run_summary (
    target text PRIMARY KEY,
    migrated_rows bigint NOT NULL
);


-- =====================================================================
-- 3. TEMPORARY HELPER FUNCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION pg_temp.v1_det_uuid(p_key text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
    SELECT (
        substr(md5(p_key), 1, 8) || '-' ||
        substr(md5(p_key), 9, 4) || '-' ||
        substr(md5(p_key), 13, 4) || '-' ||
        substr(md5(p_key), 17, 4) || '-' ||
        substr(md5(p_key), 21, 12)
    )::uuid
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_normalise(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT NULLIF(
        regexp_replace(lower(trim(coalesce(p_value, ''))), '\s+', ' ', 'g'),
        ''
    )
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_array(p_value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE
        WHEN p_value IS NULL OR p_value = 'null'::jsonb THEN '[]'::jsonb
        WHEN jsonb_typeof(p_value) = 'array' THEN p_value
        WHEN jsonb_typeof(p_value) IN ('object', 'string', 'number', 'boolean')
            THEN jsonb_build_array(p_value)
        ELSE '[]'::jsonb
    END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_text(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    key_name text;
    candidate text;
BEGIN
    IF p_value IS NULL OR p_value = 'null'::jsonb THEN
        RETURN NULL;
    END IF;

    IF jsonb_typeof(p_value) IN ('string', 'number', 'boolean') THEN
        candidate := NULLIF(trim(p_value #>> '{}'), '');
        IF candidate IS NOT NULL THEN
            RETURN candidate;
        END IF;
    END IF;

    FOREACH key_name IN ARRAY p_keys LOOP
        candidate := NULLIF(trim(p_value ->> key_name), '');
        IF candidate IS NOT NULL THEN
            RETURN candidate;
        END IF;
    END LOOP;

    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_object_text(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    key_name text;
    candidate text;
BEGIN
    IF p_value IS NULL
       OR p_value = 'null'::jsonb
       OR jsonb_typeof(p_value) <> 'object'
    THEN
        RETURN NULL;
    END IF;

    FOREACH key_name IN ARRAY p_keys LOOP
        candidate := NULLIF(trim(p_value ->> key_name), '');
        IF candidate IS NOT NULL THEN
            RETURN candidate;
        END IF;
    END LOOP;

    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_bool(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    candidate text;
BEGIN
    candidate := lower(pg_temp.v1_text(p_value, VARIADIC p_keys));

    IF candidate IN ('true', 't', '1', 'yes', 'y', 'on', 'paid', 'done') THEN
        RETURN true;
    ELSIF candidate IN ('false', 'f', '0', 'no', 'n', 'off', 'unpaid', 'not done') THEN
        RETURN false;
    END IF;

    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_numeric(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    candidate text;
BEGIN
    candidate := pg_temp.v1_text(p_value, VARIADIC p_keys);
    IF candidate IS NULL THEN
        RETURN NULL;
    END IF;

    candidate := regexp_replace(candidate, '[^0-9.\-]', '', 'g');

    IF candidate IS NULL OR candidate IN ('', '-', '.', '-.') THEN
        RETURN NULL;
    END IF;

    BEGIN
        RETURN candidate::numeric;
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_integer(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    candidate numeric;
BEGIN
    candidate := pg_temp.v1_numeric(p_value, VARIADIC p_keys);
    IF candidate IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN trunc(candidate)::integer;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_date(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    candidate text;
BEGIN
    candidate := pg_temp.v1_text(p_value, VARIADIC p_keys);
    IF candidate IS NULL THEN
        RETURN NULL;
    END IF;

    BEGIN
        RETURN candidate::date;
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_timestamp(
    p_value jsonb,
    VARIADIC p_keys text[]
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    candidate text;
BEGIN
    candidate := pg_temp.v1_text(p_value, VARIADIC p_keys);
    IF candidate IS NULL THEN
        RETURN NULL;
    END IF;

    BEGIN
        RETURN candidate::timestamptz;
    EXCEPTION WHEN others THEN
        RETURN NULL;
    END;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_time_n(
    p_value text,
    p_position integer DEFAULT 1
)
RETURNS time
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    matched text[];
    match_number integer := 0;
BEGIN
    IF p_value IS NULL OR trim(p_value) = '' OR p_position < 1 THEN
        RETURN NULL;
    END IF;

    FOR matched IN
        SELECT regexp_matches(
            p_value,
            '([0-2]?[0-9]):([0-5][0-9])',
            'g'
        )
    LOOP
        match_number := match_number + 1;
        IF match_number = p_position THEN
            BEGIN
                RETURN (lpad(matched[1], 2, '0') || ':' || matched[2])::time;
            EXCEPTION WHEN others THEN
                RETURN NULL;
            END;
        END IF;
    END LOOP;

    RETURN NULL;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_datetime(
    p_date date,
    p_value text,
    p_position integer DEFAULT 1
)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    parsed_time time;
BEGIN
    IF p_value IS NULL OR trim(p_value) = '' THEN
        RETURN NULL;
    END IF;

    BEGIN
        IF p_value ~ '\d{4}-\d{2}-\d{2}' THEN
            RETURN p_value::timestamptz;
        END IF;
    EXCEPTION WHEN others THEN
        NULL;
    END;

    parsed_time := pg_temp.v1_time_n(p_value, p_position);

    IF p_date IS NULL OR parsed_time IS NULL THEN
        RETURN NULL;
    END IF;

    RETURN (p_date + parsed_time) AT TIME ZONE 'UTC';
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_country_code(p_value text)
RETURNS char(2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    normalised text := lower(trim(coalesce(p_value, '')));
BEGIN
    IF normalised ~ '^[a-z]{2}$' THEN
        RETURN upper(normalised)::char(2);
    END IF;

    RETURN CASE normalised
        WHEN 'united kingdom' THEN 'GB'
        WHEN 'uk' THEN 'GB'
        WHEN 'great britain' THEN 'GB'
        WHEN 'england' THEN 'GB'
        WHEN 'wales' THEN 'GB'
        WHEN 'scotland' THEN 'GB'
        WHEN 'northern ireland' THEN 'GB'
        WHEN 'germany' THEN 'DE'
        WHEN 'spain' THEN 'ES'
        WHEN 'france' THEN 'FR'
        WHEN 'italy' THEN 'IT'
        WHEN 'ireland' THEN 'IE'
        WHEN 'netherlands' THEN 'NL'
        WHEN 'belgium' THEN 'BE'
        WHEN 'portugal' THEN 'PT'
        WHEN 'austria' THEN 'AT'
        WHEN 'switzerland' THEN 'CH'
        WHEN 'united states' THEN 'US'
        WHEN 'usa' THEN 'US'
        WHEN 'united arab emirates' THEN 'AE'
        WHEN 'uae' THEN 'AE'
        ELSE NULL
    END;
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_contact_name(p_value jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    first_name text;
    last_name text;
    result text;
BEGIN
    result := pg_temp.v1_text(
        p_value,
        'display_name', 'displayName', 'full_name', 'fullName',
        'contact_name', 'contactName', 'driver_name', 'driverName',
        'promoter_name', 'promoterName', 'name', 'label', 'title'
    );

    IF result IS NOT NULL THEN
        RETURN result;
    END IF;

    first_name := pg_temp.v1_text(p_value, 'first_name', 'firstName', 'first');
    last_name := pg_temp.v1_text(p_value, 'last_name', 'lastName', 'last');

    result := NULLIF(trim(concat_ws(' ', first_name, last_name)), '');

    RETURN coalesce(
        result,
        pg_temp.v1_text(p_value, 'email', 'email_address', 'emailAddress'),
        pg_temp.v1_text(p_value, 'phone', 'phone_number', 'phoneNumber', 'mobile')
    );
END
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_company_name(p_value jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT pg_temp.v1_object_text(
        p_value,
        'company', 'company_name', 'companyName',
        'organisation', 'organization', 'business'
    )
$$;

CREATE OR REPLACE FUNCTION pg_temp.v1_storage_path(
    p_organisation_id uuid,
    p_old_path text,
    p_fallback_name text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    cleaned text;
BEGIN
    cleaned := regexp_replace(
        coalesce(
            NULLIF(trim(p_fallback_name), ''),
            NULLIF(trim(p_old_path), ''),
            'file'
        ),
        '^/+',
        ''
    );

    cleaned := regexp_replace(cleaned, '\.\./', '', 'g');

    RETURN p_organisation_id::text || '/legacy/' || cleaned;
END
$$;


-- =====================================================================
-- 4. PROFILES, ORGANISATIONS, AND MEMBERS
-- =====================================================================

INSERT INTO public.profiles (
    id,
    display_name,
    email_address,
    created_at,
    updated_at
)
SELECT
    p.id,
    p.display_name,
    p.email,
    p.created_at,
    p.updated_at
FROM public.profiles_v1 AS p
ON CONFLICT (id)
DO UPDATE SET
    display_name = EXCLUDED.display_name,
    email_address = EXCLUDED.email_address,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.organisations (
    id,
    organisation_name,
    created_by_user_id,
    created_at,
    updated_at
)
SELECT
    o.id,
    o.name,
    (
        SELECT m.user_id
        FROM public.org_members_v1 AS m
        WHERE m.org_id = o.id
        ORDER BY
            CASE m.role
                WHEN 'owner' THEN 1
                WHEN 'manager' THEN 2
                ELSE 3
            END,
            m.created_at
        LIMIT 1
    ),
    o.created_at,
    o.updated_at
FROM public.orgs_v1 AS o;

INSERT INTO public.organisation_members (
    organisation_id,
    user_id,
    member_role,
    joined_at,
    created_at
)
SELECT
    m.org_id,
    m.user_id,
    m.role,
    m.created_at,
    m.created_at
FROM public.org_members_v1 AS m;


-- =====================================================================
-- 5. ORGANISATION SETTINGS, BILLING, EXCHANGE RATES, USER PREFERENCES
-- =====================================================================

INSERT INTO public.organisation_settings (
    organisation_id,
    base_currency_code,
    home_airport_iata,
    account_type,
    invoice_prefix,
    invoice_next_sequence,
    invoice_default_terms_days,
    store_sequence,
    created_at,
    updated_at
)
SELECT
    o.id,
    CASE
        WHEN upper(coalesce(
            s.settings ->> 'baseCurrency',
            s.settings ->> 'base_currency',
            s.settings ->> 'currency',
            'GBP'
        )) ~ '^[A-Z]{3}$'
        THEN upper(coalesce(
            s.settings ->> 'baseCurrency',
            s.settings ->> 'base_currency',
            s.settings ->> 'currency',
            'GBP'
        ))::char(3)
        ELSE 'GBP'::char(3)
    END,
    CASE
        WHEN upper(coalesce(
            s.settings ->> 'homeAirport',
            s.settings ->> 'home_airport',
            ''
        )) ~ '^[A-Z]{3}$'
        THEN upper(coalesce(
            s.settings ->> 'homeAirport',
            s.settings ->> 'home_airport'
        ))::char(3)
        ELSE NULL
    END,
    CASE lower(coalesce(
        s.settings ->> 'accountType',
        s.settings ->> 'account_type',
        ''
    ))
        WHEN 'dj' THEN 'dj'
        WHEN 'manager' THEN 'manager'
        WHEN 'tm' THEN 'tour_manager'
        WHEN 'tour manager' THEN 'tour_manager'
        WHEN 'tour_manager' THEN 'tour_manager'
        WHEN 'agent' THEN 'agent'
        WHEN '' THEN NULL
        ELSE 'other'
    END,
    coalesce(
        nullif(s.settings ->> 'invoicePrefix', ''),
        nullif(s.settings ->> 'invoice_prefix', ''),
        'INV'
    ),
    greatest(
        coalesce(
            pg_temp.v1_integer(
                s.settings,
                'invoiceSeq', 'invoiceSequence', 'invoice_next_sequence'
            ),
            1
        ),
        1
    ),
    greatest(
        coalesce(
            pg_temp.v1_integer(
                s.settings,
                'invoiceTerms', 'invoiceTermsDays', 'invoice_default_terms_days'
            ),
            30
        ),
        0
    ),
    greatest(coalesce(s.seq, 1), 1),
    coalesce(s.created_at, o.created_at),
    coalesce(s.updated_at, o.updated_at)
FROM public.orgs_v1 AS o
LEFT JOIN public.org_settings_v1 AS s
    ON s.org_id = o.id;

INSERT INTO public.organisation_billing_profiles (
    organisation_id,
    billing_name,
    billing_email_address,
    billing_phone_number,
    address_line_1,
    address_line_2,
    city,
    region,
    postal_code,
    country_code,
    tax_identifier,
    bank_account_name,
    bank_account_number,
    bank_sort_code,
    bank_iban,
    bank_swift_bic,
    payment_notes,
    created_at,
    updated_at
)
SELECT
    s.org_id,
    coalesce(
        s.settings #>> '{billing,name}',
        s.settings #>> '{billing,billingName}',
        s.settings #>> '{billing,companyName}'
    ),
    coalesce(
        s.settings #>> '{billing,email}',
        s.settings #>> '{billing,billingEmail}'
    ),
    coalesce(
        s.settings #>> '{billing,phone}',
        s.settings #>> '{billing,billingPhone}'
    ),
    coalesce(
        s.settings #>> '{billing,addressLine1}',
        s.settings #>> '{billing,address_line_1}',
        s.settings #>> '{billing,address}'
    ),
    coalesce(
        s.settings #>> '{billing,addressLine2}',
        s.settings #>> '{billing,address_line_2}'
    ),
    s.settings #>> '{billing,city}',
    coalesce(
        s.settings #>> '{billing,region}',
        s.settings #>> '{billing,county}'
    ),
    coalesce(
        s.settings #>> '{billing,postalCode}',
        s.settings #>> '{billing,postcode}'
    ),
    pg_temp.v1_country_code(coalesce(
        s.settings #>> '{billing,countryCode}',
        s.settings #>> '{billing,country}'
    )),
    coalesce(
        s.settings #>> '{billing,taxIdentifier}',
        s.settings #>> '{billing,vatNumber}'
    ),
    s.settings #>> '{billing,bankAccountName}',
    s.settings #>> '{billing,bankAccountNumber}',
    s.settings #>> '{billing,sortCode}',
    s.settings #>> '{billing,iban}',
    coalesce(
        s.settings #>> '{billing,swift}',
        s.settings #>> '{billing,bic}'
    ),
    s.settings #>> '{billing,paymentNotes}',
    s.created_at,
    s.updated_at
FROM public.org_settings_v1 AS s
WHERE jsonb_typeof(s.settings -> 'billing') = 'object'
  AND s.settings -> 'billing' <> '{}'::jsonb;

WITH fx_objects AS (
    SELECT
        s.org_id,
        CASE
            WHEN jsonb_typeof(s.settings #> '{fx,rates}') = 'object'
                THEN s.settings #> '{fx,rates}'
            WHEN jsonb_typeof(s.settings -> 'fx') = 'object'
                THEN s.settings -> 'fx'
            ELSE '{}'::jsonb
        END AS rates,
        s.updated_at
    FROM public.org_settings_v1 AS s
),
object_rates AS (
    SELECT
        f.org_id,
        upper(e.key) AS currency_code,
        regexp_replace(e.value #>> '{}', '[^0-9.\-]', '', 'g') AS rate_text,
        f.updated_at
    FROM fx_objects AS f
    CROSS JOIN LATERAL jsonb_each(f.rates) AS e(key, value)
    WHERE upper(e.key) ~ '^[A-Z]{3}$'
),
array_rates AS (
    SELECT
        s.org_id,
        upper(pg_temp.v1_text(x.item, 'currency', 'currencyCode', 'code')) AS currency_code,
        pg_temp.v1_numeric(x.item, 'rate', 'rateToBase', 'value') AS rate_value,
        s.updated_at
    FROM public.org_settings_v1 AS s
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(s.settings #> '{fx,rates}') = 'array'
                THEN s.settings #> '{fx,rates}'
            WHEN jsonb_typeof(s.settings -> 'fx') = 'array'
                THEN s.settings -> 'fx'
            ELSE '[]'::jsonb
        END
    ) AS x(item)
)
INSERT INTO public.organisation_exchange_rates (
    organisation_id,
    currency_code,
    rate_to_base,
    updated_at
)
SELECT
    org_id,
    currency_code::char(3),
    rate_value,
    updated_at
FROM (
    SELECT
        org_id,
        currency_code,
        CASE
            WHEN rate_text ~ '^-?[0-9]+(\.[0-9]+)?$'
                THEN rate_text::numeric
            ELSE NULL
        END AS rate_value,
        updated_at
    FROM object_rates

    UNION ALL

    SELECT
        org_id,
        currency_code,
        rate_value,
        updated_at
    FROM array_rates
) AS combined
WHERE currency_code ~ '^[A-Z]{3}$'
  AND rate_value > 0
ON CONFLICT (organisation_id, currency_code)
DO UPDATE SET
    rate_to_base = EXCLUDED.rate_to_base,
    updated_at = EXCLUDED.updated_at;

INSERT INTO public.user_preferences (
    organisation_id,
    user_id,
    usb_reminder_enabled,
    last_open_tab,
    ui_preferences,
    created_at,
    updated_at
)
SELECT
    m.org_id,
    m.user_id,
    coalesce(
        pg_temp.v1_bool(
            s.settings,
            'usbReminder', 'usb_reminder', 'usbReminderEnabled'
        ),
        true
    ),
    s.tab,
    '{}'::jsonb,
    greatest(m.created_at, coalesce(s.created_at, m.created_at)),
    coalesce(s.updated_at, m.created_at)
FROM public.org_members_v1 AS m
LEFT JOIN public.org_settings_v1 AS s
    ON s.org_id = m.org_id;


-- =====================================================================
-- 6. ARTISTS
-- =====================================================================

CREATE TEMP TABLE v1_artist_sources AS
SELECT
    s.org_id AS organisation_id,
    pg_temp.v1_text(
        x.item,
        'display_name', 'displayName', 'name', 'artist', 'label'
    ) AS artist_name,
    pg_temp.v1_text(x.item, 'id', 'legacy_id', 'legacyId') AS legacy_id,
    coalesce(
        pg_temp.v1_bool(x.item, 'is_default', 'isDefault', 'default'),
        false
    ) AS is_default,
    pg_temp.v1_text(x.item, 'notes', 'note', 'artistNotes') AS artist_notes,
    x.ord::integer AS source_order
FROM public.org_settings_v1 AS s
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(s.artists)
) WITH ORDINALITY AS x(item, ord)

UNION ALL

SELECT
    sh.org_id,
    sh.artist,
    NULL,
    false,
    NULL,
    1000000
FROM public.shows_v1 AS sh
WHERE nullif(trim(sh.artist), '') IS NOT NULL;

DELETE FROM v1_artist_sources
WHERE pg_temp.v1_normalise(artist_name) IS NULL;

INSERT INTO public.artists (
    id,
    organisation_id,
    legacy_id,
    display_name,
    is_default,
    artist_notes,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid(
        'artist:' || organisation_id::text || ':' ||
        pg_temp.v1_normalise(artist_name)
    ),
    organisation_id,
    min(legacy_id) FILTER (WHERE legacy_id IS NOT NULL),
    min(artist_name),
    bool_or(is_default),
    min(artist_notes) FILTER (WHERE artist_notes IS NOT NULL),
    now(),
    now()
FROM v1_artist_sources
GROUP BY
    organisation_id,
    pg_temp.v1_normalise(artist_name);


-- =====================================================================
-- 7. TOURS
-- =====================================================================

INSERT INTO public.tours (
    id,
    organisation_id,
    legacy_id,
    tour_name,
    color_key,
    start_date,
    end_date,
    is_archived,
    created_at,
    updated_at
)
SELECT
    t.id,
    t.org_id,
    t.legacy_id,
    coalesce(nullif(trim(t.name), ''), 'Unnamed tour'),
    t.color,
    t.start_date,
    t.end_date,
    coalesce(t.archived, false),
    t.created_at,
    t.updated_at
FROM public.trips_v1 AS t;


-- =====================================================================
-- 8. VENUES
-- =====================================================================

CREATE TEMP TABLE v1_venue_sources AS
SELECT
    sh.org_id AS organisation_id,
    sh.id AS show_id,
    sh.venue AS venue_name,
    sh.venue_addr AS address_line_1,
    sh.city,
    sh.country,
    pg_temp.v1_det_uuid(
        'venue:' || sh.org_id::text || ':' ||
        coalesce(pg_temp.v1_normalise(sh.venue), '') || ':' ||
        coalesce(pg_temp.v1_normalise(sh.city), '') || ':' ||
        coalesce(pg_temp.v1_normalise(sh.country), '') || ':' ||
        coalesce(pg_temp.v1_normalise(sh.venue_addr), '')
    ) AS venue_id
FROM public.shows_v1 AS sh
WHERE nullif(trim(sh.venue), '') IS NOT NULL;

INSERT INTO public.venues (
    id,
    organisation_id,
    venue_name,
    address_line_1,
    city,
    country_code,
    created_at,
    updated_at
)
SELECT
    venue_id,
    organisation_id,
    min(venue_name),
    min(address_line_1) FILTER (WHERE address_line_1 IS NOT NULL),
    min(city) FILTER (WHERE city IS NOT NULL),
    pg_temp.v1_country_code(
        min(country) FILTER (WHERE country IS NOT NULL)
    ),
    now(),
    now()
FROM v1_venue_sources
GROUP BY venue_id, organisation_id;


-- =====================================================================
-- 9. SHOWS
-- =====================================================================

INSERT INTO public.shows (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    primary_artist_id,
    venue_id,
    show_date,
    show_status,
    color_key,
    venue_arrival_time,
    set_start_time,
    set_end_time,
    show_timezone_snapshot,
    internal_notes,
    content_plan,
    is_set_done,
    created_at,
    updated_at
)
SELECT
    sh.id,
    sh.org_id,
    sh.legacy_id,
    t.id,
    CASE
        WHEN nullif(trim(sh.artist), '') IS NULL THEN NULL
        ELSE pg_temp.v1_det_uuid(
            'artist:' || sh.org_id::text || ':' ||
            pg_temp.v1_normalise(sh.artist)
        )
    END,
    vs.venue_id,
    sh.show_date,
    CASE lower(coalesce(sh.status, 'confirmed'))
        WHEN 'draft' THEN 'draft'
        WHEN 'hold' THEN 'hold'
        WHEN 'pending' THEN 'hold'
        WHEN 'tentative' THEN 'hold'
        WHEN 'confirmed' THEN 'confirmed'
        WHEN 'cancelled' THEN 'cancelled'
        WHEN 'canceled' THEN 'cancelled'
        ELSE 'confirmed'
    END,
    sh.color,
    pg_temp.v1_time_n(sh.arrival, 1),
    pg_temp.v1_time_n(sh.set_time, 1),
    coalesce(
        pg_temp.v1_time_n(sh.end_time, 1),
        pg_temp.v1_time_n(sh.set_time, 2)
    ),
    NULL,
    sh.notes,
    sh.content,
    coalesce(sh.set_done, false),
    sh.created_at,
    sh.updated_at
FROM public.shows_v1 AS sh
LEFT JOIN public.trips_v1 AS t
    ON t.org_id = sh.org_id
   AND (
        t.legacy_id = sh.trip_legacy_id
        OR t.id::text = sh.trip_legacy_id
   )
LEFT JOIN v1_venue_sources AS vs
    ON vs.show_id = sh.id;


INSERT INTO migration_v1_to_v2.exceptions (
    section,
    source_table,
    source_identifier,
    issue,
    source_value
)
SELECT
    'shows',
    'shows_v1',
    sh.id::text,
    'Unrecognised show status was mapped to confirmed',
    sh.status
FROM public.shows_v1 AS sh
WHERE sh.status IS NOT NULL
  AND lower(sh.status) NOT IN (
      'draft', 'hold', 'pending', 'tentative',
      'confirmed', 'cancelled', 'canceled'
  );


-- =====================================================================
-- 10. SHOW ADVANCES
-- =====================================================================

INSERT INTO public.show_advances (
    show_id,
    organisation_id,
    stage_name,
    access_notes,
    soundcheck_notes,
    curfew_notes,
    dressing_room_notes,
    guestlist_notes,
    catering_notes,
    parking_notes,
    wifi_notes,
    navigation_address,
    general_remarks,
    created_at,
    updated_at
)
SELECT
    sh.id,
    sh.org_id,
    pg_temp.v1_text(sh.advance, 'stage_name', 'stageName', 'stage'),
    pg_temp.v1_text(sh.advance, 'access_notes', 'accessNotes', 'access'),
    pg_temp.v1_text(
        sh.advance,
        'soundcheck_notes', 'soundcheckNotes', 'soundcheck'
    ),
    pg_temp.v1_text(sh.advance, 'curfew_notes', 'curfewNotes', 'curfew'),
    pg_temp.v1_text(
        sh.advance,
        'dressing_room_notes', 'dressingRoomNotes', 'dressingRoom'
    ),
    pg_temp.v1_text(
        sh.advance,
        'guestlist_notes', 'guestlistNotes', 'guestlist', 'guestList'
    ),
    pg_temp.v1_text(
        sh.advance,
        'catering_notes', 'cateringNotes', 'catering'
    ),
    pg_temp.v1_text(sh.advance, 'parking_notes', 'parkingNotes', 'parking'),
    pg_temp.v1_text(sh.advance, 'wifi_notes', 'wifiNotes', 'wifi'),
    pg_temp.v1_text(
        sh.advance,
        'navigation_address', 'navigationAddress', 'address'
    ),
    pg_temp.v1_text(
        sh.advance,
        'general_remarks', 'generalRemarks', 'remarks', 'notes'
    ),
    sh.created_at,
    sh.updated_at
FROM public.shows_v1 AS sh
WHERE sh.advance IS NOT NULL
  AND sh.advance <> 'null'::jsonb
  AND sh.advance <> '{}'::jsonb;


-- =====================================================================
-- 11. CHECKLISTS
-- =====================================================================

INSERT INTO public.checklist_items (
    id,
    organisation_id,
    legacy_id,
    show_id,
    item_label,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid('show_checklist:' || c.id::text),
    c.org_id,
    'show_checklist:' || c.legacy_id,
    c.show_id,
    c.label,
    coalesce(c.done, false),
    coalesce(c.sort_order, 0),
    c.created_at,
    c.updated_at
FROM public.show_checklist_items_v1 AS c;

INSERT INTO public.checklist_items (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    item_label,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid(
        'tour_checklist:' || t.id::text || ':' || x.ord::text
    ),
    t.org_id,
    'tour_checklist:' || t.legacy_id || ':' || x.ord::text,
    t.id,
    coalesce(
        pg_temp.v1_text(x.item, 'label', 'title', 'name', 'item'),
        'Checklist item'
    ),
    coalesce(
        pg_temp.v1_bool(x.item, 'done', 'is_done', 'isDone', 'completed'),
        false
    ),
    coalesce(
        pg_temp.v1_integer(x.item, 'sort_order', 'sortOrder', 'order'),
        x.ord::integer - 1
    ),
    t.created_at,
    t.updated_at
FROM public.trips_v1 AS t
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(t.checklist)
) WITH ORDINALITY AS x(item, ord);


-- =====================================================================
-- 12. SCHEDULE ITEMS
-- =====================================================================

INSERT INTO public.schedule_items (
    id,
    organisation_id,
    legacy_id,
    show_id,
    schedule_item_type,
    item_title,
    item_notes,
    scheduled_date,
    scheduled_time,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid('show_timeline:' || st.id::text),
    st.org_id,
    'show_timeline:' || st.legacy_id,
    st.show_id,
    'custom',
    coalesce(nullif(trim(st.title), ''), 'Schedule item'),
    st.sub,
    sh.show_date,
    pg_temp.v1_time_n(st.time, 1),
    coalesce(st.done, false),
    coalesce(st.sort_order, 0),
    st.created_at,
    st.updated_at
FROM public.show_timeline_steps_v1 AS st
JOIN public.shows_v1 AS sh
    ON sh.id = st.show_id;

INSERT INTO public.schedule_items (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    schedule_item_type,
    item_title,
    item_notes,
    scheduled_date,
    scheduled_time,
    scheduled_end_time,
    is_all_day,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid(
        'tour_timeline:' || t.id::text || ':' || x.ord::text
    ),
    t.org_id,
    'tour_timeline:' || t.legacy_id || ':' || x.ord::text,
    t.id,
    CASE lower(coalesce(
        pg_temp.v1_text(x.item, 'type', 'kind'),
        'custom'
    ))
        WHEN 'deadline' THEN 'deadline'
        WHEN 'marker' THEN 'calendar_marker'
        WHEN 'calendar_marker' THEN 'calendar_marker'
        ELSE 'custom'
    END,
    coalesce(
        pg_temp.v1_text(x.item, 'title', 'label', 'name'),
        'Tour schedule item'
    ),
    pg_temp.v1_text(x.item, 'notes', 'note', 'sub', 'info'),
    coalesce(
        pg_temp.v1_date(x.item, 'date', 'scheduledDate', 'item_date'),
        t.start_date
    ),
    pg_temp.v1_time_n(
        pg_temp.v1_text(x.item, 'time', 'startTime', 'start_time'),
        1
    ),
    pg_temp.v1_time_n(
        pg_temp.v1_text(x.item, 'endTime', 'end_time'),
        1
    ),
    coalesce(
        pg_temp.v1_bool(x.item, 'allDay', 'all_day', 'isAllDay'),
        false
    ),
    coalesce(
        pg_temp.v1_bool(x.item, 'done', 'isDone', 'completed'),
        false
    ),
    coalesce(
        pg_temp.v1_integer(x.item, 'sortOrder', 'sort_order', 'order'),
        x.ord::integer - 1
    ),
    t.created_at,
    t.updated_at
FROM public.trips_v1 AS t
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(t.timeline)
) WITH ORDINALITY AS x(item, ord);

INSERT INTO public.schedule_items (
    id,
    organisation_id,
    legacy_id,
    show_id,
    schedule_item_type,
    item_title,
    item_notes,
    scheduled_date,
    scheduled_time,
    scheduled_end_time,
    is_all_day,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid(
        'advance_schedule:' || sh.id::text || ':' || x.ord::text
    ),
    sh.org_id,
    'advance_schedule:' || sh.legacy_id || ':' || x.ord::text,
    sh.id,
    CASE lower(coalesce(
        pg_temp.v1_text(x.item, 'type', 'kind'),
        'custom'
    ))
        WHEN 'soundcheck' THEN 'soundcheck'
        WHEN 'doors' THEN 'doors'
        WHEN 'set' THEN 'set'
        WHEN 'curfew' THEN 'curfew'
        WHEN 'deadline' THEN 'deadline'
        WHEN 'marker' THEN 'calendar_marker'
        WHEN 'calendar_marker' THEN 'calendar_marker'
        ELSE 'custom'
    END,
    coalesce(
        pg_temp.v1_text(x.item, 'title', 'label', 'name', 'type'),
        'Schedule item'
    ),
    pg_temp.v1_text(x.item, 'notes', 'note', 'sub', 'info'),
    coalesce(
        pg_temp.v1_date(x.item, 'date', 'scheduledDate'),
        sh.show_date
    ),
    pg_temp.v1_time_n(
        pg_temp.v1_text(x.item, 'time', 'startTime', 'start_time'),
        1
    ),
    pg_temp.v1_time_n(
        pg_temp.v1_text(x.item, 'endTime', 'end_time'),
        1
    ),
    coalesce(
        pg_temp.v1_bool(x.item, 'allDay', 'all_day', 'isAllDay'),
        false
    ),
    coalesce(
        pg_temp.v1_bool(x.item, 'done', 'isDone', 'completed'),
        false
    ),
    coalesce(
        pg_temp.v1_integer(x.item, 'sortOrder', 'sort_order', 'order'),
        x.ord::integer - 1
    ),
    sh.created_at,
    sh.updated_at
FROM public.shows_v1 AS sh
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(
        CASE
            WHEN jsonb_typeof(sh.advance -> 'schedule') = 'array'
                THEN sh.advance -> 'schedule'
            WHEN jsonb_typeof(sh.advance -> 'timeline') = 'array'
                THEN sh.advance -> 'timeline'
            ELSE '[]'::jsonb
        END
    )
) WITH ORDINALITY AS x(item, ord)
WHERE NOT EXISTS (
    SELECT 1
    FROM public.schedule_items AS existing
    WHERE existing.show_id = sh.id
      AND pg_temp.v1_normalise(existing.item_title) =
          pg_temp.v1_normalise(
              coalesce(
                  pg_temp.v1_text(x.item, 'title', 'label', 'name', 'type'),
                  'Schedule item'
              )
          )
      AND existing.scheduled_time IS NOT DISTINCT FROM
          pg_temp.v1_time_n(
              pg_temp.v1_text(x.item, 'time', 'startTime', 'start_time'),
              1
          )
);


-- =====================================================================
-- 13. CONTACT SOURCE STAGING
-- =====================================================================

CREATE TEMP TABLE v1_contact_sources (
    organisation_id uuid NOT NULL,
    source_kind text NOT NULL,
    parent_id uuid,
    source_ordinal integer NOT NULL,
    default_role text,
    payload jsonb NOT NULL
);

INSERT INTO v1_contact_sources
SELECT
    s.org_id,
    'organisation_contact',
    NULL,
    x.ord::integer,
    'other',
    x.item
FROM public.org_settings_v1 AS s
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(s.contacts)
) WITH ORDINALITY AS x(item, ord);

INSERT INTO v1_contact_sources
SELECT
    sh.org_id,
    'show_contact',
    sh.id,
    x.ord::integer,
    'other',
    x.item
FROM public.shows_v1 AS sh
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(sh.show_contacts)
) WITH ORDINALITY AS x(item, ord);

INSERT INTO v1_contact_sources
SELECT
    sh.org_id,
    'promoter',
    sh.id,
    x.ord::integer,
    'promoter',
    x.item
FROM public.shows_v1 AS sh
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(sh.promoter)
) WITH ORDINALITY AS x(item, ord)
WHERE sh.promoter IS NOT NULL
  AND sh.promoter <> 'null'::jsonb;

INSERT INTO v1_contact_sources
SELECT
    sh.org_id,
    'driver',
    sh.id,
    x.ord::integer,
    'driver',
    x.item
FROM public.shows_v1 AS sh
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(sh.driver)
) WITH ORDINALITY AS x(item, ord)
WHERE sh.driver IS NOT NULL
  AND sh.driver <> 'null'::jsonb;

INSERT INTO v1_contact_sources
SELECT
    t.org_id,
    'tour_emergency',
    t.id,
    x.ord::integer,
    'emergency',
    x.item
FROM public.trips_v1 AS t
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(t.emergency)
) WITH ORDINALITY AS x(item, ord);


CREATE TEMP TABLE v1_contacts_normalised AS
SELECT
    cs.*,
    pg_temp.v1_text(
        cs.payload,
        'id', 'legacy_id', 'legacyId', 'contactId'
    ) AS legacy_id,
    pg_temp.v1_contact_name(cs.payload) AS display_name,
    pg_temp.v1_object_text(
        cs.payload,
        'first_name', 'firstName', 'first'
    ) AS first_name,
    pg_temp.v1_object_text(
        cs.payload,
        'last_name', 'lastName', 'last'
    ) AS last_name,
    pg_temp.v1_object_text(
        cs.payload,
        'email_address', 'emailAddress', 'email'
    ) AS email_address,
    pg_temp.v1_object_text(
        cs.payload,
        'phone_number', 'phoneNumber', 'phone', 'mobile'
    ) AS phone_number,
    pg_temp.v1_object_text(
        cs.payload,
        'whatsapp_number', 'whatsappNumber', 'whatsapp'
    ) AS whatsapp_number,
    pg_temp.v1_object_text(
        cs.payload,
        'contact_notes', 'contactNotes', 'notes', 'note'
    ) AS contact_notes,
    pg_temp.v1_company_name(cs.payload) AS company_name,
    pg_temp.v1_object_text(
        cs.payload,
        'job_title', 'jobTitle', 'position'
    ) AS job_title,
    CASE lower(coalesce(
        pg_temp.v1_object_text(cs.payload, 'role', 'contactRole', 'type'),
        cs.default_role,
        'other'
    ))
        WHEN 'artist liaison' THEN 'artist_liaison'
        WHEN 'artist_liaison' THEN 'artist_liaison'
        WHEN 'promoter' THEN 'promoter'
        WHEN 'production' THEN 'production'
        WHEN 'venue manager' THEN 'venue_manager'
        WHEN 'venue_manager' THEN 'venue_manager'
        WHEN 'driver' THEN 'driver'
        WHEN 'emergency' THEN 'emergency'
        ELSE 'other'
    END AS show_role
FROM v1_contact_sources AS cs;

ALTER TABLE v1_contacts_normalised
    ADD COLUMN contact_key text,
    ADD COLUMN contact_id uuid,
    ADD COLUMN company_id uuid;

UPDATE v1_contacts_normalised
SET
    contact_key = CASE
        WHEN legacy_id IS NOT NULL
            THEN 'legacy:' || legacy_id
        WHEN email_address IS NOT NULL
            THEN 'email:' || lower(trim(email_address))
        WHEN phone_number IS NOT NULL
            THEN 'phone:' || regexp_replace(phone_number, '[^0-9+]', '', 'g')
        ELSE 'name:' || coalesce(pg_temp.v1_normalise(display_name), '')
    END;

UPDATE v1_contacts_normalised
SET
    contact_id = pg_temp.v1_det_uuid(
        'contact:' || organisation_id::text || ':' || contact_key
    )
WHERE display_name IS NOT NULL
   OR email_address IS NOT NULL
   OR phone_number IS NOT NULL;

UPDATE v1_contacts_normalised
SET
    company_id = pg_temp.v1_det_uuid(
        'company:' || organisation_id::text || ':' ||
        pg_temp.v1_normalise(company_name)
    )
WHERE pg_temp.v1_normalise(company_name) IS NOT NULL;


INSERT INTO public.contacts (
    id,
    organisation_id,
    legacy_id,
    first_name,
    last_name,
    display_name,
    email_address,
    phone_number,
    whatsapp_number,
    contact_notes,
    created_at,
    updated_at
)
SELECT
    contact_id,
    organisation_id,
    min(legacy_id) FILTER (WHERE legacy_id IS NOT NULL),
    min(first_name) FILTER (WHERE first_name IS NOT NULL),
    min(last_name) FILTER (WHERE last_name IS NOT NULL),
    min(coalesce(display_name, email_address, phone_number)),
    min(email_address) FILTER (WHERE email_address IS NOT NULL),
    min(phone_number) FILTER (WHERE phone_number IS NOT NULL),
    min(whatsapp_number) FILTER (WHERE whatsapp_number IS NOT NULL),
    min(contact_notes) FILTER (WHERE contact_notes IS NOT NULL),
    now(),
    now()
FROM v1_contacts_normalised
WHERE contact_id IS NOT NULL
GROUP BY contact_id, organisation_id;

INSERT INTO public.companies (
    id,
    organisation_id,
    company_name,
    created_at,
    updated_at
)
SELECT
    company_id,
    organisation_id,
    min(company_name),
    now(),
    now()
FROM v1_contacts_normalised
WHERE company_id IS NOT NULL
GROUP BY company_id, organisation_id;

INSERT INTO public.company_contacts (
    organisation_id,
    company_id,
    contact_id,
    job_title,
    is_primary,
    sort_order,
    created_at
)
SELECT
    organisation_id,
    company_id,
    contact_id,
    min(job_title) FILTER (WHERE job_title IS NOT NULL),
    bool_or(
        coalesce(
            pg_temp.v1_bool(payload, 'isPrimary', 'is_primary', 'primary'),
            false
        )
    ),
    min(source_ordinal),
    now()
FROM v1_contacts_normalised
WHERE company_id IS NOT NULL
  AND contact_id IS NOT NULL
GROUP BY organisation_id, company_id, contact_id
ON CONFLICT DO NOTHING;


INSERT INTO public.show_contacts (
    id,
    organisation_id,
    show_id,
    contact_id,
    company_id,
    contact_role,
    is_primary,
    contact_notes,
    sort_order,
    created_at
)
SELECT
    pg_temp.v1_det_uuid(
        'show_contact:' || parent_id::text || ':' ||
        source_kind || ':' || source_ordinal::text
    ),
    organisation_id,
    parent_id,
    contact_id,
    company_id,
    show_role,
    coalesce(
        pg_temp.v1_bool(payload, 'isPrimary', 'is_primary', 'primary'),
        false
    ),
    contact_notes,
    source_ordinal - 1,
    now()
FROM v1_contacts_normalised
WHERE source_kind IN ('show_contact', 'promoter')
  AND parent_id IS NOT NULL
  AND (contact_id IS NOT NULL OR company_id IS NOT NULL)
ON CONFLICT DO NOTHING;

INSERT INTO public.tour_contacts (
    organisation_id,
    tour_id,
    contact_id,
    contact_role,
    is_primary,
    sort_order,
    created_at
)
SELECT
    organisation_id,
    parent_id,
    contact_id,
    'emergency',
    coalesce(
        pg_temp.v1_bool(payload, 'isPrimary', 'is_primary', 'primary'),
        false
    ),
    source_ordinal - 1,
    now()
FROM v1_contacts_normalised
WHERE source_kind = 'tour_emergency'
  AND parent_id IS NOT NULL
  AND contact_id IS NOT NULL
ON CONFLICT DO NOTHING;


INSERT INTO migration_v1_to_v2.exceptions (
    section,
    source_table,
    source_identifier,
    issue,
    source_value
)
SELECT
    'contacts',
    CASE source_kind
        WHEN 'organisation_contact' THEN 'org_settings_v1.contacts'
        WHEN 'show_contact' THEN 'shows_v1.show_contacts'
        WHEN 'promoter' THEN 'shows_v1.promoter'
        WHEN 'driver' THEN 'shows_v1.driver'
        WHEN 'tour_emergency' THEN 'trips_v1.emergency'
        ELSE source_kind
    END,
    coalesce(parent_id::text, organisation_id::text) || ':' ||
        source_ordinal::text,
    'Contact payload had no usable name, email, phone, or company',
    payload::text
FROM v1_contacts_normalised
WHERE contact_id IS NULL
  AND company_id IS NULL;


-- =====================================================================
-- 14. JOURNEYS FROM SHOW FLIGHTS
-- =====================================================================

CREATE TEMP TABLE v1_show_flight_journey_map AS
SELECT
    sf.id AS source_flight_id,
    pg_temp.v1_det_uuid('show_flight:' || sf.id::text) AS journey_id
FROM public.show_flights_v1 AS sf;

INSERT INTO public.journeys (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    related_show_id,
    journey_type,
    journey_title,
    departure_at,
    arrival_at,
    departure_location_name,
    departure_location_code,
    arrival_location_name,
    arrival_location_code,
    flight_number,
    departure_airport_iata,
    arrival_airport_iata,
    is_done,
    journey_notes,
    sort_order,
    created_at,
    updated_at
)
SELECT
    map.journey_id,
    sf.org_id,
    'show_flight:' || sf.legacy_id,
    s.tour_id,
    sf.show_id,
    'flight',
    coalesce(nullif(trim(sf.code), ''), 'Flight'),
    pg_temp.v1_datetime(v1s.show_date, sf.dep, 1),
    CASE
        WHEN pg_temp.v1_datetime(v1s.show_date, sf.arr, 1)
             < pg_temp.v1_datetime(v1s.show_date, sf.dep, 1)
        THEN pg_temp.v1_datetime(v1s.show_date + 1, sf.arr, 1)
        ELSE pg_temp.v1_datetime(v1s.show_date, sf.arr, 1)
    END,
    sf.from_code,
    upper(nullif(trim(sf.from_code), '')),
    sf.to_code,
    upper(nullif(trim(sf.to_code), '')),
    sf.code,
    CASE
        WHEN upper(coalesce(sf.from_code, '')) ~ '^[A-Z]{3}$'
        THEN upper(sf.from_code)::char(3)
        ELSE NULL
    END,
    CASE
        WHEN upper(coalesce(sf.to_code, '')) ~ '^[A-Z]{3}$'
        THEN upper(sf.to_code)::char(3)
        ELSE NULL
    END,
    false,
    CASE
        WHEN nullif(trim(sf.seat), '') IS NOT NULL
        THEN 'Legacy seat: ' || sf.seat
        ELSE NULL
    END,
    coalesce(sf.sort_order, 0),
    sf.created_at,
    sf.updated_at
FROM public.show_flights_v1 AS sf
JOIN v1_show_flight_journey_map AS map
    ON map.source_flight_id = sf.id
JOIN public.shows_v1 AS v1s
    ON v1s.id = sf.show_id
JOIN public.shows AS s
    ON s.id = sf.show_id;


-- Show-level flight widget data becomes a flight journey only when no
-- explicit show_flights_v1 row exists.
INSERT INTO public.journeys (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    related_show_id,
    journey_type,
    journey_title,
    flight_number,
    departure_terminal,
    departure_gate,
    journey_status,
    delay_description,
    status_updated_at,
    is_live_status,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid('show_primary_flight:' || sh.id::text),
    sh.org_id,
    'show_primary_flight:' || sh.legacy_id,
    s.tour_id,
    sh.id,
    'flight',
    coalesce(nullif(trim(sh.flight_no), ''), 'Flight'),
    sh.flight_no,
    sh.terminal,
    sh.gate,
    sh.fstatus,
    sh.delay,
    sh.fi_updated,
    coalesce(sh.fi_live, false),
    -1,
    sh.created_at,
    sh.updated_at
FROM public.shows_v1 AS sh
JOIN public.shows AS s
    ON s.id = sh.id
WHERE nullif(trim(sh.flight_no), '') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.show_flights_v1 AS sf
      WHERE sf.show_id = sh.id
  );


-- Apply show-level live flight details to the first explicit flight journey.
WITH first_flights AS (
    SELECT DISTINCT ON (j.related_show_id)
        j.id,
        j.related_show_id
    FROM public.journeys AS j
    WHERE j.journey_type = 'flight'
      AND j.related_show_id IS NOT NULL
    ORDER BY j.related_show_id, j.sort_order, j.created_at, j.id
)
UPDATE public.journeys AS j
SET
    departure_terminal = coalesce(j.departure_terminal, sh.terminal),
    departure_gate = coalesce(j.departure_gate, sh.gate),
    journey_status = coalesce(j.journey_status, sh.fstatus),
    delay_description = coalesce(j.delay_description, sh.delay),
    status_updated_at = coalesce(j.status_updated_at, sh.fi_updated),
    is_live_status = j.is_live_status OR coalesce(sh.fi_live, false),
    updated_at = greatest(j.updated_at, sh.updated_at)
FROM first_flights AS ff
JOIN public.shows_v1 AS sh
    ON sh.id = ff.related_show_id
WHERE j.id = ff.id;


-- =====================================================================
-- 15. JOURNEYS AND MARKERS FROM LOGISTICS
-- =====================================================================

CREATE TEMP TABLE v1_logistics_journey_map AS
SELECT
    li.id AS source_logistics_id,
    pg_temp.v1_det_uuid('logistics_travel:' || li.id::text) AS journey_id
FROM public.logistics_items_v1 AS li
WHERE li.kind = 'travel';

INSERT INTO public.journeys (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    related_show_id,
    journey_type,
    journey_title,
    departure_at,
    arrival_at,
    departure_location_name,
    arrival_location_name,
    flight_number,
    train_number,
    ferry_service_number,
    coach_service_number,
    pickup_instructions,
    is_done,
    journey_notes,
    sort_order,
    created_at,
    updated_at
)
SELECT
    map.journey_id,
    li.org_id,
    'logistics:' || li.legacy_id,
    s.tour_id,
    coalesce(li.show_id, legacy_show.id),
    CASE
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(plane|flight|airport|✈)'
            THEN 'flight'
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(train|rail)'
            THEN 'rail'
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(ferry|boat|ship)'
            THEN 'ferry'
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(walk|walking|foot)'
            THEN 'walk'
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(coach|bus)'
            THEN 'coach'
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(car|taxi|uber|van|driver|transfer)'
            THEN 'ground_transfer'
        ELSE 'other'
    END,
    coalesce(nullif(trim(li.title), ''), 'Travel'),
    pg_temp.v1_datetime(li.item_date, li.start_time, 1),
    CASE
        WHEN pg_temp.v1_datetime(li.item_date, li.end_time, 1)
             < pg_temp.v1_datetime(li.item_date, li.start_time, 1)
        THEN pg_temp.v1_datetime(li.item_date + 1, li.end_time, 1)
        ELSE pg_temp.v1_datetime(li.item_date, li.end_time, 1)
    END,
    pg_temp.v1_text(
        to_jsonb(li),
        'departure', 'from', 'pickup'
    ),
    pg_temp.v1_text(
        to_jsonb(li),
        'arrival', 'to', 'dropoff'
    ),
    CASE
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(plane|flight|airport|✈)'
        THEN nullif(trim(li.info), '')
        ELSE NULL
    END,
    CASE
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(train|rail)'
        THEN nullif(trim(li.info), '')
        ELSE NULL
    END,
    CASE
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(ferry|boat|ship)'
        THEN nullif(trim(li.info), '')
        ELSE NULL
    END,
    CASE
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(coach|bus)'
        THEN nullif(trim(li.info), '')
        ELSE NULL
    END,
    CASE
        WHEN lower(coalesce(li.icon, '') || ' ' || coalesce(li.title, '')) ~
             '(car|taxi|uber|van|driver|transfer)'
        THEN li.info
        ELSE NULL
    END,
    coalesce(li.done, false),
    li.info,
    0,
    li.created_at,
    li.updated_at
FROM public.logistics_items_v1 AS li
JOIN v1_logistics_journey_map AS map
    ON map.source_logistics_id = li.id
LEFT JOIN public.shows AS direct_show
    ON direct_show.id = li.show_id
LEFT JOIN public.shows AS legacy_show
    ON legacy_show.organisation_id = li.org_id
   AND legacy_show.legacy_id = li.show_legacy_id
LEFT JOIN public.shows AS resolved_show
    ON resolved_show.id = coalesce(li.show_id, legacy_show.id)
LEFT JOIN public.shows AS s
    ON s.id = resolved_show.id
WHERE li.kind = 'travel';


INSERT INTO public.schedule_items (
    id,
    organisation_id,
    legacy_id,
    show_id,
    schedule_item_type,
    item_title,
    item_notes,
    scheduled_date,
    scheduled_time,
    scheduled_end_time,
    is_all_day,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid('logistics_marker:' || li.id::text),
    li.org_id,
    'logistics_marker:' || li.legacy_id,
    coalesce(li.show_id, legacy_show.id),
    'calendar_marker',
    coalesce(nullif(trim(li.title), ''), 'Calendar marker'),
    li.info,
    li.item_date,
    pg_temp.v1_time_n(li.start_time, 1),
    pg_temp.v1_time_n(li.end_time, 1),
    coalesce(li.all_day, false),
    coalesce(li.done, false),
    0,
    li.created_at,
    li.updated_at
FROM public.logistics_items_v1 AS li
LEFT JOIN public.shows AS legacy_show
    ON legacy_show.organisation_id = li.org_id
   AND legacy_show.legacy_id = li.show_legacy_id
WHERE li.kind = 'marker'
  AND coalesce(li.show_id, legacy_show.id) IS NOT NULL;

INSERT INTO migration_v1_to_v2.exceptions (
    section,
    source_table,
    source_identifier,
    issue,
    source_value
)
SELECT
    'schedule',
    'logistics_items_v1',
    li.id::text,
    'Organisation-level calendar marker has no show or tour parent in V2',
    to_jsonb(li)::text
FROM public.logistics_items_v1 AS li
LEFT JOIN public.shows AS legacy_show
    ON legacy_show.organisation_id = li.org_id
   AND legacy_show.legacy_id = li.show_legacy_id
WHERE li.kind = 'marker'
  AND coalesce(li.show_id, legacy_show.id) IS NULL;


-- =====================================================================
-- 16. DRIVER JOURNEYS AND JOURNEY CONTACTS
-- =====================================================================

CREATE TEMP TABLE v1_driver_links AS
SELECT
    cn.organisation_id,
    cn.parent_id AS show_id,
    cn.source_ordinal,
    cn.contact_id,
    cn.payload,
    coalesce(
        (
            SELECT j.id
            FROM public.journeys AS j
            WHERE j.related_show_id = cn.parent_id
              AND j.journey_type = 'ground_transfer'
            ORDER BY j.departure_at NULLS LAST, j.id
            LIMIT 1
        ),
        pg_temp.v1_det_uuid(
            'show_driver_journey:' || cn.parent_id::text || ':' ||
            cn.source_ordinal::text
        )
    ) AS journey_id
FROM v1_contacts_normalised AS cn
WHERE cn.source_kind = 'driver'
  AND cn.parent_id IS NOT NULL
  AND cn.contact_id IS NOT NULL;

INSERT INTO public.journeys (
    id,
    organisation_id,
    legacy_id,
    tour_id,
    related_show_id,
    journey_type,
    journey_title,
    pickup_location,
    dropoff_location,
    pickup_instructions,
    vehicle_details,
    journey_notes,
    sort_order,
    created_at,
    updated_at
)
SELECT
    dl.journey_id,
    dl.organisation_id,
    'show_driver:' || dl.show_id::text || ':' || dl.source_ordinal::text,
    s.tour_id,
    dl.show_id,
    'ground_transfer',
    coalesce(
        pg_temp.v1_text(
            dl.payload,
            'title', 'transferName', 'route', 'type'
        ),
        'Ground transfer'
    ),
    pg_temp.v1_text(
        dl.payload,
        'pickup', 'pickupLocation', 'from'
    ),
    pg_temp.v1_text(
        dl.payload,
        'dropoff', 'dropoffLocation', 'to'
    ),
    pg_temp.v1_text(
        dl.payload,
        'pickupInstructions', 'instructions'
    ),
    pg_temp.v1_text(
        dl.payload,
        'vehicle', 'vehicleDetails', 'car'
    ),
    pg_temp.v1_text(
        dl.payload,
        'notes', 'note', 'transferNotes'
    ),
    dl.source_ordinal - 1,
    now(),
    now()
FROM v1_driver_links AS dl
JOIN public.shows AS s
    ON s.id = dl.show_id
WHERE NOT EXISTS (
    SELECT 1
    FROM public.journeys AS existing
    WHERE existing.id = dl.journey_id
);

INSERT INTO public.journey_contacts (
    organisation_id,
    journey_id,
    contact_id,
    contact_role,
    sort_order,
    created_at
)
SELECT
    organisation_id,
    journey_id,
    contact_id,
    'driver',
    source_ordinal - 1,
    now()
FROM v1_driver_links
ON CONFLICT DO NOTHING;


-- =====================================================================
-- 17. HOTELS AND BOOKINGS
-- =====================================================================

CREATE TEMP TABLE v1_show_hotel_sources AS
SELECT
    sh.id AS show_id,
    sh.org_id AS organisation_id,
    sh.show_date,
    sh.trip_legacy_id,
    sh.hotel AS payload,
    coalesce(
        pg_temp.v1_text(
            sh.hotel,
            'hotel_name', 'hotelName', 'name', 'title', 'hotel'
        ),
        CASE
            WHEN jsonb_typeof(sh.hotel) = 'string'
            THEN sh.hotel #>> '{}'
            ELSE NULL
        END
    ) AS hotel_name,
    coalesce(
        pg_temp.v1_date(
            sh.hotel,
            'check_in_date', 'checkInDate', 'checkIn', 'from'
        ),
        sh.show_date
    ) AS check_in_date,
    coalesce(
        pg_temp.v1_date(
            sh.hotel,
            'check_out_date', 'checkOutDate', 'checkOut', 'to'
        ),
        sh.show_date + 1
    ) AS check_out_date
FROM public.shows_v1 AS sh
WHERE sh.hotel IS NOT NULL
  AND sh.hotel <> 'null'::jsonb
  AND sh.hotel <> '{}'::jsonb;

ALTER TABLE v1_show_hotel_sources
    ADD COLUMN hotel_id uuid,
    ADD COLUMN booking_id uuid;

UPDATE v1_show_hotel_sources
SET
    hotel_id = pg_temp.v1_det_uuid(
        'hotel:' || organisation_id::text || ':' ||
        coalesce(pg_temp.v1_normalise(hotel_name), 'unnamed:' || show_id::text)
    ),
    booking_id = pg_temp.v1_det_uuid(
        'show_hotel_booking:' || show_id::text
    );

INSERT INTO public.hotels (
    id,
    organisation_id,
    hotel_name,
    address_line_1,
    city,
    country_code,
    phone_number,
    email_address,
    hotel_notes,
    created_at,
    updated_at
)
SELECT
    hotel_id,
    organisation_id,
    min(coalesce(nullif(trim(hotel_name), ''), 'Unnamed hotel')),
    min(pg_temp.v1_object_text(
        payload,
        'address', 'hotelAddress', 'addressLine1', 'address_line_1'
    )) FILTER (
        WHERE pg_temp.v1_text(
            payload,
            'address', 'hotelAddress', 'addressLine1', 'address_line_1'
        ) IS NOT NULL
    ),
    min(pg_temp.v1_object_text(payload, 'city')) FILTER (
        WHERE pg_temp.v1_object_text(payload, 'city') IS NOT NULL
    ),
    pg_temp.v1_country_code(
        min(pg_temp.v1_object_text(payload, 'country', 'countryCode')) FILTER (
            WHERE pg_temp.v1_object_text(payload, 'country', 'countryCode') IS NOT NULL
        )
    ),
    min(pg_temp.v1_object_text(payload, 'phone', 'phoneNumber')) FILTER (
        WHERE pg_temp.v1_object_text(payload, 'phone', 'phoneNumber') IS NOT NULL
    ),
    min(pg_temp.v1_object_text(payload, 'email', 'emailAddress')) FILTER (
        WHERE pg_temp.v1_object_text(payload, 'email', 'emailAddress') IS NOT NULL
    ),
    min(pg_temp.v1_object_text(payload, 'notes', 'hotelNotes')) FILTER (
        WHERE pg_temp.v1_object_text(payload, 'notes', 'hotelNotes') IS NOT NULL
    ),
    now(),
    now()
FROM v1_show_hotel_sources
GROUP BY hotel_id, organisation_id;

INSERT INTO public.hotel_bookings (
    id,
    organisation_id,
    legacy_id,
    hotel_id,
    tour_id,
    booking_reference,
    check_in_date,
    check_out_date,
    room_notes,
    booking_notes,
    is_done,
    created_at,
    updated_at
)
SELECT
    hs.booking_id,
    hs.organisation_id,
    'show_hotel:' || hs.show_id::text,
    hs.hotel_id,
    s.tour_id,
    pg_temp.v1_object_text(
        hs.payload,
        'booking_reference', 'bookingReference', 'bookingRef', 'reference'
    ),
    hs.check_in_date,
    greatest(hs.check_out_date, hs.check_in_date),
    pg_temp.v1_object_text(
        hs.payload,
        'room_notes', 'roomNotes', 'room', 'rooms'
    ),
    pg_temp.v1_object_text(hs.payload, 'notes', 'hotelNotes', 'bookingNotes'),
    coalesce(
        pg_temp.v1_bool(hs.payload, 'done', 'isDone', 'completed'),
        false
    ),
    now(),
    now()
FROM v1_show_hotel_sources AS hs
JOIN public.shows AS s
    ON s.id = hs.show_id;

INSERT INTO public.hotel_booking_shows (
    organisation_id,
    hotel_booking_id,
    show_id,
    created_at
)
SELECT
    organisation_id,
    booking_id,
    show_id,
    now()
FROM v1_show_hotel_sources;


CREATE TEMP TABLE v1_logistics_stays AS
SELECT
    li.*,
    coalesce(li.show_id, legacy_show.id) AS resolved_show_id,
    coalesce(nullif(trim(li.title), ''), 'Unnamed hotel') AS hotel_name,
    pg_temp.v1_det_uuid(
        'hotel:' || li.org_id::text || ':' ||
        pg_temp.v1_normalise(
            coalesce(nullif(trim(li.title), ''), 'Unnamed hotel')
        )
    ) AS hotel_id,
    pg_temp.v1_det_uuid('logistics_stay:' || li.id::text) AS booking_id
FROM public.logistics_items_v1 AS li
LEFT JOIN public.shows AS legacy_show
    ON legacy_show.organisation_id = li.org_id
   AND legacy_show.legacy_id = li.show_legacy_id
WHERE li.kind = 'stay';

INSERT INTO public.hotels (
    id,
    organisation_id,
    hotel_name,
    hotel_notes,
    created_at,
    updated_at
)
SELECT
    ls.hotel_id,
    ls.org_id,
    min(ls.hotel_name),
    min(ls.info) FILTER (WHERE ls.info IS NOT NULL),
    min(ls.created_at),
    max(ls.updated_at)
FROM v1_logistics_stays AS ls
WHERE NOT EXISTS (
    SELECT 1
    FROM public.hotels AS existing
    WHERE existing.id = ls.hotel_id
)
GROUP BY ls.hotel_id, ls.org_id;

INSERT INTO public.hotel_bookings (
    id,
    organisation_id,
    legacy_id,
    hotel_id,
    tour_id,
    booking_reference,
    check_in_date,
    check_out_date,
    booking_notes,
    is_done,
    created_at,
    updated_at
)
SELECT
    ls.booking_id,
    ls.org_id,
    'logistics_stay:' || ls.legacy_id,
    ls.hotel_id,
    s.tour_id,
    NULL,
    ls.item_date,
    ls.item_date + 1,
    ls.info,
    coalesce(ls.done, false),
    ls.created_at,
    ls.updated_at
FROM v1_logistics_stays AS ls
LEFT JOIN public.shows AS s
    ON s.id = ls.resolved_show_id
WHERE NOT EXISTS (
    SELECT 1
    FROM v1_show_hotel_sources AS hs
    WHERE hs.show_id = ls.resolved_show_id
      AND pg_temp.v1_normalise(hs.hotel_name) =
          pg_temp.v1_normalise(ls.hotel_name)
);

INSERT INTO public.hotel_booking_shows (
    organisation_id,
    hotel_booking_id,
    show_id,
    created_at
)
SELECT
    ls.org_id,
    ls.booking_id,
    ls.resolved_show_id,
    ls.created_at
FROM v1_logistics_stays AS ls
WHERE ls.resolved_show_id IS NOT NULL
  AND EXISTS (
      SELECT 1
      FROM public.hotel_bookings AS hb
      WHERE hb.id = ls.booking_id
  );


-- =====================================================================
-- 18. SHOW FINANCE AND EXPENSES
-- =====================================================================

INSERT INTO public.show_financials (
    show_id,
    organisation_id,
    agreed_fee_amount,
    currency_code,
    deal_type,
    commission_percent,
    per_diem_amount,
    is_paid,
    is_estimated,
    is_not_disclosed,
    financial_notes,
    created_at,
    updated_at
)
SELECT
    sh.id,
    sh.org_id,
    CASE
        WHEN pg_temp.v1_numeric(
            sh.finance,
            'fee', 'agreedFee', 'agreed_fee', 'amount'
        ) IS NULL
        THEN NULL
        ELSE greatest(
            pg_temp.v1_numeric(
                sh.finance,
                'fee', 'agreedFee', 'agreed_fee', 'amount'
            ),
            0
        )
    END,
    CASE
        WHEN upper(coalesce(
            pg_temp.v1_text(
                sh.finance,
                'currency', 'currencyCode', 'currency_code'
            ),
            'GBP'
        )) ~ '^[A-Z]{3}$'
        THEN upper(coalesce(
            pg_temp.v1_text(
                sh.finance,
                'currency', 'currencyCode', 'currency_code'
            ),
            'GBP'
        ))::char(3)
        ELSE 'GBP'::char(3)
    END,
    pg_temp.v1_text(sh.finance, 'dealType', 'deal_type', 'deal'),
    CASE
        WHEN pg_temp.v1_numeric(
            sh.finance,
            'commissionPercent', 'commission_percent', 'commission'
        ) IS NULL
        THEN NULL
        ELSE least(
            greatest(
                pg_temp.v1_numeric(
                    sh.finance,
                    'commissionPercent', 'commission_percent', 'commission'
                ),
                0
            ),
            100
        )
    END,
    CASE
        WHEN pg_temp.v1_numeric(
            sh.finance,
            'perDiem', 'per_diem', 'perDiemAmount'
        ) IS NULL
        THEN NULL
        ELSE greatest(
            pg_temp.v1_numeric(
                sh.finance,
                'perDiem', 'per_diem', 'perDiemAmount'
            ),
            0
        )
    END,
    coalesce(
        pg_temp.v1_bool(sh.finance, 'paid', 'isPaid', 'is_paid'),
        false
    ),
    coalesce(
        pg_temp.v1_bool(
            sh.finance,
            'estimated', 'isEstimated', 'is_estimated'
        ),
        false
    ),
    coalesce(
        pg_temp.v1_bool(
            sh.finance,
            'notDisclosed', 'isNotDisclosed', 'is_not_disclosed'
        ),
        false
    ),
    pg_temp.v1_text(sh.finance, 'notes', 'financialNotes'),
    sh.created_at,
    sh.updated_at
FROM public.shows_v1 AS sh
WHERE sh.finance IS NOT NULL
  AND sh.finance <> 'null'::jsonb
  AND sh.finance <> '{}'::jsonb;

INSERT INTO public.show_expenses (
    id,
    organisation_id,
    show_id,
    expense_label,
    expense_amount,
    currency_code,
    expense_notes,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid(
        'show_expense:' || sh.id::text || ':' || x.ord::text
    ),
    sh.org_id,
    sh.id,
    coalesce(
        pg_temp.v1_text(x.item, 'label', 'name', 'title', 'description'),
        'Expense'
    ),
    greatest(
        coalesce(
            pg_temp.v1_numeric(x.item, 'amount', 'value', 'cost'),
            0
        ),
        0
    ),
    CASE
        WHEN upper(coalesce(
            pg_temp.v1_text(
                x.item,
                'currency', 'currencyCode', 'currency_code'
            ),
            pg_temp.v1_text(
                sh.finance,
                'currency', 'currencyCode', 'currency_code'
            ),
            'GBP'
        )) ~ '^[A-Z]{3}$'
        THEN upper(coalesce(
            pg_temp.v1_text(
                x.item,
                'currency', 'currencyCode', 'currency_code'
            ),
            pg_temp.v1_text(
                sh.finance,
                'currency', 'currencyCode', 'currency_code'
            ),
            'GBP'
        ))::char(3)
        ELSE 'GBP'::char(3)
    END,
    pg_temp.v1_text(x.item, 'notes', 'note'),
    x.ord::integer - 1,
    sh.created_at,
    sh.updated_at
FROM public.shows_v1 AS sh
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(sh.finance -> 'expenses')
) WITH ORDINALITY AS x(item, ord)
WHERE sh.finance IS NOT NULL;


-- =====================================================================
-- 19. PACKING LISTS
-- =====================================================================

CREATE TEMP TABLE v1_packing_sources AS
SELECT
    s.org_id AS organisation_id,
    x.item,
    x.ord::integer AS source_order,
    'packing'::text AS source_name
FROM public.org_settings_v1 AS s
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(s.packing)
) WITH ORDINALITY AS x(item, ord)

UNION ALL

SELECT
    s.org_id,
    x.item,
    100000 + x.ord::integer,
    'settings.packingTemplate'
FROM public.org_settings_v1 AS s
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(
        coalesce(
            s.settings -> 'packingTemplate',
            s.settings -> 'packing_template'
        )
    )
) WITH ORDINALITY AS x(item, ord);

CREATE TEMP TABLE v1_packing_lists AS
SELECT DISTINCT
    organisation_id,
    pg_temp.v1_det_uuid(
        'packing_list:default:' || organisation_id::text
    ) AS packing_list_id
FROM v1_packing_sources;

INSERT INTO public.packing_lists (
    id,
    organisation_id,
    list_name,
    is_organisation_template,
    is_archived,
    created_at,
    updated_at
)
SELECT
    packing_list_id,
    organisation_id,
    'Default packing list',
    true,
    false,
    now(),
    now()
FROM v1_packing_lists;

INSERT INTO public.packing_list_items (
    id,
    organisation_id,
    packing_list_id,
    item_label,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    pg_temp.v1_det_uuid(
        'packing_item:' || ps.organisation_id::text || ':' ||
        pg_temp.v1_normalise(
            coalesce(
                pg_temp.v1_text(ps.item, 'label', 'name', 'title', 'item'),
                'Packing item ' || ps.source_order::text
            )
        )
    ),
    ps.organisation_id,
    pl.packing_list_id,
    coalesce(
        pg_temp.v1_text(ps.item, 'label', 'name', 'title', 'item'),
        'Packing item'
    ),
    coalesce(
        pg_temp.v1_bool(ps.item, 'done', 'isDone', 'is_done', 'packed'),
        false
    ),
    min(ps.source_order) OVER (
        PARTITION BY
            ps.organisation_id,
            pg_temp.v1_normalise(
                coalesce(
                    pg_temp.v1_text(
                        ps.item,
                        'label', 'name', 'title', 'item'
                    ),
                    'Packing item ' || ps.source_order::text
                )
            )
    ),
    now(),
    now()
FROM v1_packing_sources AS ps
JOIN v1_packing_lists AS pl
    USING (organisation_id)
WHERE pg_temp.v1_text(ps.item, 'label', 'name', 'title', 'item') IS NOT NULL
ON CONFLICT (id) DO NOTHING;


-- =====================================================================
-- 20. IDEAS AND NOTES
-- =====================================================================

INSERT INTO public.ideas (
    id,
    organisation_id,
    legacy_id,
    show_id,
    tour_id,
    idea_type,
    idea_title,
    idea_note,
    priority_level,
    is_done,
    sort_order,
    created_at,
    updated_at
)
SELECT
    i.id,
    i.org_id,
    i.legacy_id,
    sh.id,
    t.id,
    CASE lower(coalesce(i.type, 'other'))
        WHEN 'reel' THEN 'reel'
        WHEN 'caption' THEN 'caption'
        WHEN 'hook' THEN 'hook'
        WHEN 'youtube' THEN 'youtube'
        WHEN 'podcast' THEN 'podcast'
        WHEN 'interview' THEN 'interview'
        WHEN 'location' THEN 'location'
        ELSE 'other'
    END,
    i.title,
    i.note,
    CASE lower(coalesce(i.prio, ''))
        WHEN 'low' THEN 'low'
        WHEN 'medium' THEN 'medium'
        WHEN 'med' THEN 'medium'
        WHEN 'high' THEN 'high'
        WHEN 'urgent' THEN 'high'
        ELSE NULL
    END,
    coalesce(i.done, false),
    coalesce(i.sort_order, 0),
    i.created_at,
    i.updated_at
FROM public.ideas_v1 AS i
LEFT JOIN public.shows AS sh
    ON sh.organisation_id = i.org_id
   AND (
        sh.legacy_id = i.event_legacy_id
        OR sh.id::text = i.event_legacy_id
   )
LEFT JOIN public.tours AS t
    ON t.organisation_id = i.org_id
   AND (
        t.legacy_id = i.trip_legacy_id
        OR t.id::text = i.trip_legacy_id
   );

INSERT INTO public.notes (
    id,
    organisation_id,
    legacy_id,
    note_title,
    note_body,
    folder_name,
    sort_order,
    created_at,
    updated_at
)
SELECT
    n.id,
    n.org_id,
    n.legacy_id,
    n.title,
    n.body,
    n.folder,
    coalesce(n.sort_order, 0),
    n.created_at,
    coalesce(n.note_updated, n.updated_at)
FROM public.notes_v1 AS n;


-- =====================================================================
-- 21. INVOICES
-- =====================================================================

CREATE TEMP TABLE v1_invoice_sources AS
SELECT
    s.org_id AS organisation_id,
    x.item AS payload,
    x.ord::integer AS source_order,
    s.created_at,
    s.updated_at,
    coalesce(
        pg_temp.v1_text(
            x.item,
            'id', 'legacy_id', 'legacyId', 'invoiceId'
        ),
        x.ord::text
    ) AS source_id,
    coalesce(
        pg_temp.v1_text(
            x.item,
            'invoiceNumber', 'invoice_number', 'number'
        ),
        'MIG-' || x.ord::text
    ) AS base_invoice_number
FROM public.org_settings_v1 AS s
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(s.invoices)
) WITH ORDINALITY AS x(item, ord);

ALTER TABLE v1_invoice_sources
    ADD COLUMN invoice_id uuid,
    ADD COLUMN invoice_number text,
    ADD COLUMN show_id uuid;

UPDATE v1_invoice_sources
SET
    invoice_id = pg_temp.v1_det_uuid(
        'invoice:' || organisation_id::text || ':' || source_id
    );

WITH numbered AS (
    SELECT
        ctid,
        base_invoice_number,
        row_number() OVER (
            PARTITION BY organisation_id, base_invoice_number
            ORDER BY source_order
        ) AS duplicate_number
    FROM v1_invoice_sources
)
UPDATE v1_invoice_sources AS source
SET invoice_number = CASE
    WHEN numbered.duplicate_number = 1
        THEN numbered.base_invoice_number
    ELSE numbered.base_invoice_number || '-' ||
         numbered.duplicate_number::text
END
FROM numbered
WHERE source.ctid = numbered.ctid;

UPDATE v1_invoice_sources AS source
SET show_id = (
    SELECT sh.id
    FROM public.shows AS sh
    WHERE sh.organisation_id = source.organisation_id
      AND (
          sh.legacy_id = pg_temp.v1_text(
              source.payload,
              'eventId', 'event_id', 'showId', 'show_id'
          )
          OR sh.id::text = pg_temp.v1_text(
              source.payload,
              'eventId', 'event_id', 'showId', 'show_id'
          )
      )
    LIMIT 1
);

INSERT INTO public.invoices (
    id,
    organisation_id,
    legacy_id,
    show_id,
    invoice_number,
    invoice_date,
    due_date,
    client_name,
    client_email_address,
    client_address,
    currency_code,
    invoice_status,
    payment_terms_days,
    invoice_notes,
    created_at,
    updated_at
)
SELECT
    invoice_id,
    organisation_id,
    source_id,
    show_id,
    invoice_number,
    coalesce(
        pg_temp.v1_date(payload, 'invoiceDate', 'invoice_date', 'date'),
        created_at::date
    ),
    CASE
        WHEN pg_temp.v1_date(payload, 'dueDate', 'due_date') IS NULL
            THEN NULL
        ELSE greatest(
            pg_temp.v1_date(payload, 'dueDate', 'due_date'),
            coalesce(
                pg_temp.v1_date(payload, 'invoiceDate', 'invoice_date', 'date'),
                created_at::date
            )
        )
    END,
    coalesce(
        pg_temp.v1_text(
            payload,
            'clientName', 'client_name', 'customerName', 'customer'
        ),
        'Unknown client'
    ),
    pg_temp.v1_text(
        payload,
        'clientEmail', 'client_email', 'email'
    ),
    pg_temp.v1_text(
        payload,
        'clientAddress', 'client_address', 'address'
    ),
    CASE
        WHEN upper(coalesce(
            pg_temp.v1_text(
                payload,
                'currency', 'currencyCode', 'currency_code'
            ),
            'GBP'
        )) ~ '^[A-Z]{3}$'
        THEN upper(coalesce(
            pg_temp.v1_text(
                payload,
                'currency', 'currencyCode', 'currency_code'
            ),
            'GBP'
        ))::char(3)
        ELSE 'GBP'::char(3)
    END,
    CASE lower(coalesce(
        pg_temp.v1_text(payload, 'status', 'invoiceStatus'),
        'draft'
    ))
        WHEN 'draft' THEN 'draft'
        WHEN 'sent' THEN 'sent'
        WHEN 'paid' THEN 'paid'
        WHEN 'void' THEN 'void'
        WHEN 'cancelled' THEN 'void'
        ELSE 'draft'
    END,
    greatest(
        coalesce(
            pg_temp.v1_integer(
                payload,
                'paymentTermsDays', 'payment_terms_days',
                'termsDays', 'terms'
            ),
            30
        ),
        0
    ),
    pg_temp.v1_text(payload, 'notes', 'invoiceNotes'),
    created_at,
    updated_at
FROM v1_invoice_sources;

INSERT INTO public.invoice_line_items (
    id,
    organisation_id,
    invoice_id,
    line_label,
    line_description,
    quantity,
    unit_amount,
    sort_order,
    created_at
)
SELECT
    pg_temp.v1_det_uuid(
        'invoice_line:' || invoice.invoice_id::text || ':' || x.ord::text
    ),
    invoice.organisation_id,
    invoice.invoice_id,
    coalesce(
        pg_temp.v1_text(
            x.item,
            'label', 'name', 'title', 'description'
        ),
        'Invoice item'
    ),
    pg_temp.v1_text(x.item, 'description', 'notes', 'note'),
    greatest(
        coalesce(
            pg_temp.v1_numeric(x.item, 'quantity', 'qty'),
            1
        ),
        0.001
    ),
    coalesce(
        pg_temp.v1_numeric(
            x.item,
            'unitAmount', 'unit_amount', 'rate', 'price', 'amount'
        ),
        0
    ),
    x.ord::integer - 1,
    invoice.created_at
FROM v1_invoice_sources AS invoice
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(
        coalesce(
            invoice.payload -> 'lines',
            invoice.payload -> 'lineItems',
            invoice.payload -> 'items'
        )
    )
) WITH ORDINALITY AS x(item, ord);


-- =====================================================================
-- 22. FILE METADATA AND SHOW FILE LINKS
--
-- Actual objects are not copied. The result manifest at the end tells
-- you the old and new paths.
-- =====================================================================

CREATE TEMP TABLE v1_show_file_sources AS
SELECT
    sf.*,
    coalesce(sf.show_id, legacy_show.id) AS resolved_show_id,
    pg_temp.v1_det_uuid('file:show_file:' || sf.id::text) AS target_file_id,
    pg_temp.v1_det_uuid('show_file_link:' || sf.id::text) AS target_link_id,
    pg_temp.v1_storage_path(
        sf.org_id,
        sf.storage_path,
        'show-files/' || sf.id::text || '/' ||
            coalesce(nullif(sf.name, ''), 'document')
    ) AS target_storage_path
FROM public.show_files_v1 AS sf
LEFT JOIN public.shows AS legacy_show
    ON legacy_show.organisation_id = sf.org_id
   AND legacy_show.legacy_id = sf.parent_legacy_id;

INSERT INTO public.files (
    id,
    organisation_id,
    legacy_id,
    bucket_name,
    storage_path,
    original_filename,
    file_title,
    mime_type,
    created_at,
    updated_at
)
SELECT
    target_file_id,
    org_id,
    'show_file:' || legacy_id,
    'operate-documents-v2',
    target_storage_path,
    name,
    name,
    mime_type,
    created_at,
    updated_at
FROM v1_show_file_sources
WHERE nullif(trim(storage_path), '') IS NOT NULL;

INSERT INTO public.show_files (
    id,
    organisation_id,
    show_id,
    file_id,
    file_type,
    file_title,
    sort_order,
    created_at,
    updated_at
)
SELECT
    target_link_id,
    org_id,
    resolved_show_id,
    target_file_id,
    CASE lower(coalesce(file_role, 'other'))
        WHEN 'contract' THEN 'contract'
        WHEN 'rider' THEN 'artist_rider'
        WHEN 'artist_rider' THEN 'artist_rider'
        WHEN 'technical_rider' THEN 'technical_rider'
        WHEN 'tech_rider' THEN 'technical_rider'
        WHEN 'venue' THEN 'venue_document'
        WHEN 'venue_document' THEN 'venue_document'
        WHEN 'schedule' THEN 'schedule'
        ELSE 'other'
    END,
    name,
    coalesce(sort_order, 0),
    created_at,
    updated_at
FROM v1_show_file_sources
WHERE resolved_show_id IS NOT NULL
  AND nullif(trim(storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.file_copy_manifest
SELECT
    'show_files_v1',
    id::text,
    storage_path,
    'operate-documents-v2',
    target_storage_path,
    target_file_id
FROM v1_show_file_sources
WHERE nullif(trim(storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.exceptions
SELECT
    'files',
    'show_files_v1',
    id::text,
    CASE
        WHEN resolved_show_id IS NULL
            THEN 'Could not resolve the V2 show for this file'
        ELSE 'File row has no storage_path'
    END,
    to_jsonb(v1_show_file_sources)::text
FROM v1_show_file_sources
WHERE resolved_show_id IS NULL
   OR nullif(trim(storage_path), '') IS NULL;


-- =====================================================================
-- 23. FLIGHT PASSES -> FILES + TRAVEL TICKETS
-- =====================================================================

CREATE TEMP TABLE v1_flight_pass_sources AS
SELECT
    fp.*,
    map.journey_id,
    pg_temp.v1_det_uuid('file:flight_pass:' || fp.id::text) AS target_file_id,
    pg_temp.v1_det_uuid('travel_ticket:flight_pass:' || fp.id::text)
        AS target_ticket_id,
    pg_temp.v1_storage_path(
        fp.org_id,
        fp.storage_path,
        'journeys/' || map.journey_id::text || '/tickets/' ||
            fp.id::text || '/' ||
            coalesce(nullif(fp.name, ''), 'ticket')
    ) AS target_storage_path
FROM public.show_flight_passes_v1 AS fp
JOIN v1_show_flight_journey_map AS map
    ON map.source_flight_id = fp.flight_id;

INSERT INTO public.files (
    id,
    organisation_id,
    legacy_id,
    bucket_name,
    storage_path,
    original_filename,
    file_title,
    mime_type,
    created_at,
    updated_at
)
SELECT
    target_file_id,
    org_id,
    'flight_pass:' || legacy_id,
    'operate-documents-v2',
    target_storage_path,
    name,
    name,
    mime_type,
    created_at,
    updated_at
FROM v1_flight_pass_sources
WHERE nullif(trim(storage_path), '') IS NOT NULL;

INSERT INTO public.travel_tickets (
    id,
    organisation_id,
    legacy_id,
    journey_id,
    file_id,
    ticket_type,
    seat_number,
    sort_order,
    created_at,
    updated_at
)
SELECT
    source.target_ticket_id,
    source.org_id,
    'flight_pass:' || source.legacy_id,
    source.journey_id,
    source.target_file_id,
    'boarding_pass',
    sf.seat,
    coalesce(source.sort_order, 0),
    source.created_at,
    source.updated_at
FROM v1_flight_pass_sources AS source
JOIN public.show_flights_v1 AS sf
    ON sf.id = source.flight_id
WHERE nullif(trim(source.storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.file_copy_manifest
SELECT
    'show_flight_passes_v1',
    id::text,
    storage_path,
    'operate-documents-v2',
    target_storage_path,
    target_file_id
FROM v1_flight_pass_sources
WHERE nullif(trim(storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.exceptions
SELECT
    'files',
    'show_flight_passes_v1',
    id::text,
    'Flight pass row has no storage_path',
    to_jsonb(v1_flight_pass_sources)::text
FROM v1_flight_pass_sources
WHERE nullif(trim(storage_path), '') IS NULL;


-- =====================================================================
-- 24. LOGISTICS PASSES -> FILES + TRAVEL TICKETS
-- =====================================================================

CREATE TEMP TABLE v1_logistics_pass_sources AS
SELECT
    li.id AS logistics_id,
    li.org_id,
    li.legacy_id AS logistics_legacy_id,
    map.journey_id,
    x.item AS payload,
    x.ord::integer AS source_order,
    pg_temp.v1_text(
        x.item,
        'storage_path', 'storagePath', 'path', 'filePath'
    ) AS old_storage_path,
    pg_temp.v1_text(
        x.item,
        'name', 'filename', 'fileName', 'originalFilename'
    ) AS file_name,
    pg_temp.v1_text(
        x.item,
        'mime_type', 'mimeType', 'type'
    ) AS mime_type,
    pg_temp.v1_det_uuid(
        'file:logistics_pass:' || li.id::text || ':' || x.ord::text
    ) AS target_file_id,
    pg_temp.v1_det_uuid(
        'travel_ticket:logistics_pass:' || li.id::text || ':' ||
        x.ord::text
    ) AS target_ticket_id
FROM public.logistics_items_v1 AS li
JOIN v1_logistics_journey_map AS map
    ON map.source_logistics_id = li.id
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(li.passes)
) WITH ORDINALITY AS x(item, ord)
WHERE li.kind = 'travel';

ALTER TABLE v1_logistics_pass_sources
    ADD COLUMN target_storage_path text;

UPDATE v1_logistics_pass_sources
SET target_storage_path = pg_temp.v1_storage_path(
    org_id,
    old_storage_path,
    'journeys/' || journey_id::text || '/tickets/' ||
        coalesce(nullif(file_name, ''), target_file_id::text)
);

INSERT INTO public.files (
    id,
    organisation_id,
    legacy_id,
    bucket_name,
    storage_path,
    original_filename,
    file_title,
    mime_type,
    created_at,
    updated_at
)
SELECT
    target_file_id,
    org_id,
    'logistics_pass:' || logistics_legacy_id || ':' ||
        source_order::text,
    'operate-documents-v2',
    target_storage_path,
    file_name,
    file_name,
    mime_type,
    now(),
    now()
FROM v1_logistics_pass_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

INSERT INTO public.travel_tickets (
    id,
    organisation_id,
    legacy_id,
    journey_id,
    file_id,
    ticket_type,
    passenger_name,
    seat_number,
    ticket_reference,
    ticket_description,
    sort_order,
    created_at,
    updated_at
)
SELECT
    target_ticket_id,
    org_id,
    'logistics_pass:' || logistics_legacy_id || ':' ||
        source_order::text,
    journey_id,
    target_file_id,
    CASE
        WHEN j.journey_type = 'flight' THEN 'boarding_pass'
        WHEN j.journey_type = 'rail' THEN 'rail_ticket'
        WHEN j.journey_type = 'ferry' THEN 'ferry_ticket'
        WHEN j.journey_type = 'coach' THEN 'coach_ticket'
        ELSE 'other'
    END,
    pg_temp.v1_text(payload, 'passenger', 'passengerName', 'nameOnTicket'),
    pg_temp.v1_text(payload, 'seat', 'seatNumber'),
    pg_temp.v1_text(payload, 'reference', 'ticketReference', 'bookingRef'),
    pg_temp.v1_text(payload, 'description', 'notes', 'note'),
    source_order - 1,
    now(),
    now()
FROM v1_logistics_pass_sources AS source
JOIN public.journeys AS j
    ON j.id = source.journey_id
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.file_copy_manifest
SELECT
    'logistics_items_v1.passes',
    logistics_id::text || ':' || source_order::text,
    old_storage_path,
    'operate-documents-v2',
    target_storage_path,
    target_file_id
FROM v1_logistics_pass_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.exceptions
SELECT
    'files',
    'logistics_items_v1.passes',
    logistics_id::text || ':' || source_order::text,
    'Pass payload has no recognised storage path',
    payload::text
FROM v1_logistics_pass_sources
WHERE nullif(trim(old_storage_path), '') IS NULL;


-- =====================================================================
-- 25. ITINERARY SUBMISSIONS
-- =====================================================================

CREATE TEMP TABLE v1_itinerary_sources AS
SELECT
    s.org_id AS organisation_id,
    x.item AS payload,
    x.ord::integer AS source_order,
    s.created_at,
    s.updated_at,
    pg_temp.v1_det_uuid(
        'itinerary_submission:' || s.org_id::text || ':' || x.ord::text
    ) AS submission_id
FROM public.org_settings_v1 AS s
CROSS JOIN LATERAL jsonb_array_elements(
    pg_temp.v1_array(s.itineraries)
) WITH ORDINALITY AS x(item, ord);

INSERT INTO public.itinerary_submissions (
    id,
    organisation_id,
    submission_status,
    source_filename,
    raw_scan_response,
    error_message,
    created_at,
    updated_at
)
SELECT
    submission_id,
    organisation_id,
    CASE lower(coalesce(
        pg_temp.v1_text(payload, 'status'),
        'processed'
    ))
        WHEN 'pending' THEN 'pending'
        WHEN 'processing' THEN 'processing'
        WHEN 'failed' THEN 'failed'
        ELSE 'processed'
    END,
    pg_temp.v1_text(payload, 'filename', 'fileName', 'name'),
    payload,
    pg_temp.v1_text(payload, 'error', 'errorMessage'),
    created_at,
    updated_at
FROM v1_itinerary_sources;

ALTER TABLE v1_itinerary_sources
    ADD COLUMN old_storage_path text,
    ADD COLUMN file_name text,
    ADD COLUMN target_file_id uuid,
    ADD COLUMN target_storage_path text;

UPDATE v1_itinerary_sources
SET
    old_storage_path = pg_temp.v1_text(
        payload,
        'storage_path', 'storagePath', 'path', 'filePath'
    ),
    file_name = pg_temp.v1_text(
        payload,
        'filename', 'fileName', 'name', 'originalFilename'
    ),
    target_file_id = pg_temp.v1_det_uuid(
        'file:itinerary:' || submission_id::text
    );

UPDATE v1_itinerary_sources
SET target_storage_path = pg_temp.v1_storage_path(
    organisation_id,
    old_storage_path,
    'itineraries/' || submission_id::text || '/' ||
        coalesce(nullif(file_name, ''), target_file_id::text)
);

INSERT INTO public.files (
    id,
    organisation_id,
    legacy_id,
    bucket_name,
    storage_path,
    original_filename,
    file_title,
    mime_type,
    created_at,
    updated_at
)
SELECT
    target_file_id,
    organisation_id,
    'itinerary:' || source_order::text,
    'operate-documents-v2',
    target_storage_path,
    file_name,
    file_name,
    pg_temp.v1_object_text(payload, 'mime_type', 'mimeType', 'type'),
    created_at,
    updated_at
FROM v1_itinerary_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

INSERT INTO public.itinerary_submission_files (
    id,
    organisation_id,
    itinerary_submission_id,
    file_id,
    created_at
)
SELECT
    pg_temp.v1_det_uuid(
        'itinerary_file_link:' || submission_id::text
    ),
    organisation_id,
    submission_id,
    target_file_id,
    created_at
FROM v1_itinerary_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.file_copy_manifest
SELECT
    'org_settings_v1.itineraries',
    organisation_id::text || ':' || source_order::text,
    old_storage_path,
    'operate-documents-v2',
    target_storage_path,
    target_file_id
FROM v1_itinerary_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;


-- =====================================================================
-- 26. SETTINGS HOME HEADER FILE METADATA
-- =====================================================================

CREATE TEMP TABLE v1_home_header_sources AS
SELECT
    s.org_id,
    coalesce(
        s.settings -> 'homeHeader',
        s.settings -> 'home_header'
    ) AS payload,
    pg_temp.v1_text(
        coalesce(
            s.settings -> 'homeHeader',
            s.settings -> 'home_header'
        ),
        'storage_path', 'storagePath', 'path', 'filePath', 'url'
    ) AS old_storage_path,
    pg_temp.v1_text(
        coalesce(
            s.settings -> 'homeHeader',
            s.settings -> 'home_header'
        ),
        'name', 'filename', 'fileName'
    ) AS file_name,
    pg_temp.v1_det_uuid(
        'file:home_header:' || s.org_id::text
    ) AS target_file_id,
    s.created_at,
    s.updated_at
FROM public.org_settings_v1 AS s
WHERE coalesce(
        s.settings -> 'homeHeader',
        s.settings -> 'home_header'
    ) IS NOT NULL;

ALTER TABLE v1_home_header_sources
    ADD COLUMN target_storage_path text;

UPDATE v1_home_header_sources
SET target_storage_path = pg_temp.v1_storage_path(
    org_id,
    old_storage_path,
    'branding/home-header-' || target_file_id::text
);

INSERT INTO public.files (
    id,
    organisation_id,
    legacy_id,
    bucket_name,
    storage_path,
    original_filename,
    file_title,
    created_at,
    updated_at
)
SELECT
    target_file_id,
    org_id,
    'home_header',
    'operate-documents-v2',
    target_storage_path,
    file_name,
    coalesce(file_name, 'Home header'),
    created_at,
    updated_at
FROM v1_home_header_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

UPDATE public.organisation_settings AS settings
SET home_header_file_id = source.target_file_id
FROM v1_home_header_sources AS source
WHERE settings.organisation_id = source.org_id
  AND nullif(trim(source.old_storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.file_copy_manifest
SELECT
    'org_settings_v1.settings.homeHeader',
    org_id::text,
    old_storage_path,
    'operate-documents-v2',
    target_storage_path,
    target_file_id
FROM v1_home_header_sources
WHERE nullif(trim(old_storage_path), '') IS NOT NULL;

INSERT INTO migration_v1_to_v2.exceptions
SELECT
    'files',
    'org_settings_v1.settings.homeHeader',
    org_id::text,
    'Home header exists but has no recognised storage path',
    payload::text
FROM v1_home_header_sources
WHERE nullif(trim(old_storage_path), '') IS NULL;


-- =====================================================================
-- 27. REMINDERS AND DEVICE-LOCAL STATE
-- =====================================================================

INSERT INTO migration_v1_to_v2.exceptions (
    section,
    source_table,
    source_identifier,
    issue,
    source_value
)
SELECT
    'device-local',
    'org_settings_v1',
    s.org_id::text,
    'active_trip_id and active_show_id were intentionally not migrated; Trip Mode anchor remains device-local',
    jsonb_build_object(
        'active_trip_id', s.active_trip_id,
        'active_show_id', s.active_show_id
    )::text
FROM public.org_settings_v1 AS s
WHERE s.active_trip_id IS NOT NULL
   OR s.active_show_id IS NOT NULL;


-- =====================================================================
-- 28. VALIDATION
-- =====================================================================

DO $validate$
DECLARE
    expected_count bigint;
    actual_count bigint;
BEGIN
    SELECT count(*) INTO expected_count FROM public.orgs_v1;
    SELECT count(*) INTO actual_count FROM public.organisations;
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Organisation count mismatch. V1 %, V2 %',
            expected_count, actual_count;
    END IF;

    SELECT count(*) INTO expected_count FROM public.profiles_v1;
    SELECT count(*) INTO actual_count
    FROM public.profiles AS p
    WHERE EXISTS (
        SELECT 1
        FROM public.profiles_v1 AS v1
        WHERE v1.id = p.id
    );
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Not every V1 profile exists in V2. V1 %, migrated %',
            expected_count, actual_count;
    END IF;

    SELECT count(*) INTO expected_count FROM public.org_members_v1;
    SELECT count(*) INTO actual_count FROM public.organisation_members;
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Organisation member count mismatch. V1 %, V2 %',
            expected_count, actual_count;
    END IF;

    SELECT count(*) INTO expected_count FROM public.trips_v1;
    SELECT count(*) INTO actual_count FROM public.tours;
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Tour count mismatch. V1 %, V2 %',
            expected_count, actual_count;
    END IF;

    SELECT count(*) INTO expected_count FROM public.shows_v1;
    SELECT count(*) INTO actual_count FROM public.shows;
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Show count mismatch. V1 %, V2 %',
            expected_count, actual_count;
    END IF;

    SELECT count(*) INTO expected_count FROM public.ideas_v1;
    SELECT count(*) INTO actual_count FROM public.ideas;
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Ideas count mismatch. V1 %, V2 %',
            expected_count, actual_count;
    END IF;

    SELECT count(*) INTO expected_count FROM public.notes_v1;
    SELECT count(*) INTO actual_count FROM public.notes;
    IF expected_count <> actual_count THEN
        RAISE EXCEPTION
            'Notes count mismatch. V1 %, V2 %',
            expected_count, actual_count;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.shows AS sh
        LEFT JOIN public.organisations AS o
            ON o.id = sh.organisation_id
        WHERE o.id IS NULL
    ) THEN
        RAISE EXCEPTION 'V2 contains a show with no organisation.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.journeys AS j
        LEFT JOIN public.organisations AS o
            ON o.id = j.organisation_id
        WHERE o.id IS NULL
    ) THEN
        RAISE EXCEPTION 'V2 contains a journey with no organisation.';
    END IF;
END
$validate$;

COMMIT;


-- =====================================================================
-- 29. MIGRATION SUMMARY
-- =====================================================================

INSERT INTO migration_v1_to_v2.run_summary (target, migrated_rows)
SELECT *
FROM (
    VALUES
        ('organisations', (SELECT count(*) FROM public.organisations)),
        ('profiles', (SELECT count(*) FROM public.profiles)),
        ('organisation_members', (SELECT count(*) FROM public.organisation_members)),
        ('artists', (SELECT count(*) FROM public.artists)),
        ('tours', (SELECT count(*) FROM public.tours)),
        ('venues', (SELECT count(*) FROM public.venues)),
        ('shows', (SELECT count(*) FROM public.shows)),
        ('show_advances', (SELECT count(*) FROM public.show_advances)),
        ('schedule_items', (SELECT count(*) FROM public.schedule_items)),
        ('checklist_items', (SELECT count(*) FROM public.checklist_items)),
        ('contacts', (SELECT count(*) FROM public.contacts)),
        ('companies', (SELECT count(*) FROM public.companies)),
        ('show_contacts', (SELECT count(*) FROM public.show_contacts)),
        ('tour_contacts', (SELECT count(*) FROM public.tour_contacts)),
        ('journeys', (SELECT count(*) FROM public.journeys)),
        ('journey_contacts', (SELECT count(*) FROM public.journey_contacts)),
        ('hotels', (SELECT count(*) FROM public.hotels)),
        ('hotel_bookings', (SELECT count(*) FROM public.hotel_bookings)),
        ('show_financials', (SELECT count(*) FROM public.show_financials)),
        ('show_expenses', (SELECT count(*) FROM public.show_expenses)),
        ('invoices', (SELECT count(*) FROM public.invoices)),
        ('invoice_line_items', (SELECT count(*) FROM public.invoice_line_items)),
        ('packing_lists', (SELECT count(*) FROM public.packing_lists)),
        ('packing_list_items', (SELECT count(*) FROM public.packing_list_items)),
        ('ideas', (SELECT count(*) FROM public.ideas)),
        ('notes', (SELECT count(*) FROM public.notes)),
        ('files metadata', (SELECT count(*) FROM public.files)),
        ('travel_tickets', (SELECT count(*) FROM public.travel_tickets)),
        ('show_files links', (SELECT count(*) FROM public.show_files)),
        ('itinerary_submissions', (SELECT count(*) FROM public.itinerary_submissions))
) AS summary(target, migrated_rows);

SELECT
    target,
    migrated_rows
FROM migration_v1_to_v2.run_summary
ORDER BY target;


-- The manifest remains available later at:
--   migration_v1_to_v2.file_copy_manifest
SELECT
    source_table,
    source_identifier,
    old_storage_path,
    new_bucket_name,
    new_storage_path,
    target_file_id
FROM migration_v1_to_v2.file_copy_manifest
ORDER BY source_table, source_identifier;


-- Exceptions remain available later at:
--   migration_v1_to_v2.exceptions
-- Review every exception. V1 remains untouched, so no source data is lost.
SELECT
    section,
    source_table,
    source_identifier,
    issue,
    source_value
FROM migration_v1_to_v2.exceptions
ORDER BY section, source_table, source_identifier;
