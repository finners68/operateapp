-- =====================================================================
-- OPERATE DATABASE V2
-- Empty relational schema created alongside the existing *_v1 tables
--
-- IMPORTANT:
--   * This script does NOT copy any V1 data.
--   * This script does NOT delete or alter any *_v1 table.
--   * It creates the new V2 tables, constraints, indexes, RLS policies,
--     helper functions, auth profile trigger, and a private V2 file bucket.
--   * Run the whole file as one query in the Supabase SQL Editor.
-- =====================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '10min';

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- =====================================================================
-- 1. PRE-FLIGHT CHECKS
-- =====================================================================

DO $preflight$
DECLARE
    required_v1_table text;
    new_table_name text;

    required_v1_tables text[] := ARRAY[
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

    new_tables text[] := ARRAY[
        'profiles',
        'organisations',
        'organisation_members',
        'organisation_invites',
        'files',
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
        'travel_tickets',
        'journey_files',
        'show_files',
        'show_financials',
        'show_expenses',
        'invoices',
        'invoice_line_items',
        'packing_lists',
        'packing_list_items',
        'reminders',
        'ideas',
        'notes',
        'itinerary_submissions',
        'itinerary_submission_files'
    ];
BEGIN
    FOREACH required_v1_table IN ARRAY required_v1_tables
    LOOP
        IF to_regclass(format('public.%I', required_v1_table)) IS NULL THEN
            RAISE EXCEPTION
                'Required V1 table public.% does not exist. Run Step 1 first.',
                required_v1_table;
        END IF;
    END LOOP;

    FOREACH new_table_name IN ARRAY new_tables
    LOOP
        IF to_regclass(format('public.%I', new_table_name)) IS NOT NULL THEN
            RAISE EXCEPTION
                'New table public.% already exists. No V2 changes were applied.',
                new_table_name;
        END IF;
    END LOOP;
END
$preflight$;


-- =====================================================================
-- 2. SHARED UPDATED_AT TRIGGER
-- =====================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$function$;


-- =====================================================================
-- 3. CORE ORGANISATION AND USER TABLES
-- =====================================================================

CREATE TABLE public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name text,
    email_address text,
    avatar_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organisations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_name text NOT NULL,
    created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

CREATE TABLE public.organisation_members (
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    member_role text NOT NULL
        CHECK (member_role IN ('owner', 'manager', 'crew')),
    joined_at timestamptz NOT NULL DEFAULT now(),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organisation_id, user_id)
);

CREATE TABLE public.organisation_invites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    email_address text NOT NULL,
    invited_role text NOT NULL
        CHECK (invited_role IN ('manager', 'crew')),
    invite_token uuid NOT NULL DEFAULT gen_random_uuid(),
    created_by_user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    accepted_at timestamptz,
    accepted_by_user_id uuid
        REFERENCES auth.users(id) ON DELETE SET NULL,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (invite_token),
    CHECK (expires_at > created_at)
);


-- =====================================================================
-- 4. CENTRAL FILE METADATA
--
-- Actual file bytes live in Supabase Storage.
-- Every file record points to its bucket and object path.
-- =====================================================================

CREATE TABLE public.files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    bucket_name text NOT NULL DEFAULT 'operate-documents-v2'
        CHECK (bucket_name = 'operate-documents-v2'),
    storage_path text NOT NULL,
    original_filename text,
    file_title text,
    file_description text,
    mime_type text,
    file_size_bytes bigint CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    uploaded_by_user_id uuid
        REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (bucket_name, storage_path),
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX files_organisation_legacy_id_idx
    ON public.files (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;


-- =====================================================================
-- 5. ORGANISATION SETTINGS
-- =====================================================================

CREATE TABLE public.organisation_settings (
    organisation_id uuid PRIMARY KEY
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    base_currency_code char(3) NOT NULL DEFAULT 'GBP'
        CHECK (base_currency_code ~ '^[A-Z]{3}$'),
    home_airport_iata char(3)
        CHECK (home_airport_iata IS NULL OR home_airport_iata ~ '^[A-Z]{3}$'),
    account_type text
        CHECK (
            account_type IS NULL
            OR account_type IN ('dj', 'manager', 'tour_manager', 'agent', 'other')
        ),
    invoice_prefix text NOT NULL DEFAULT 'INV',
    invoice_next_sequence integer NOT NULL DEFAULT 1
        CHECK (invoice_next_sequence > 0),
    invoice_default_terms_days integer NOT NULL DEFAULT 30
        CHECK (invoice_default_terms_days >= 0),
    home_header_file_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organisation_settings_header_file_fk
        FOREIGN KEY (home_header_file_id, organisation_id)
        REFERENCES public.files(id, organisation_id)
        ON DELETE SET NULL (home_header_file_id)
);

CREATE TABLE public.organisation_billing_profiles (
    organisation_id uuid PRIMARY KEY
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    billing_name text,
    billing_email_address text,
    billing_phone_number text,
    address_line_1 text,
    address_line_2 text,
    city text,
    region text,
    postal_code text,
    country_code char(2)
        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    tax_identifier text,
    bank_account_name text,
    bank_account_number text,
    bank_sort_code text,
    bank_iban text,
    bank_swift_bic text,
    payment_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.organisation_exchange_rates (
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    currency_code char(3) NOT NULL
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    rate_to_base numeric(18, 8) NOT NULL
        CHECK (rate_to_base > 0),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (organisation_id, currency_code)
);

CREATE TABLE public.user_preferences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    usb_reminder_enabled boolean NOT NULL DEFAULT true,
    last_open_tab text,
    ui_preferences jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (organisation_id, user_id)
);


-- =====================================================================
-- 6. ARTISTS, TOURS, VENUES, AND SHOWS
-- =====================================================================

CREATE TABLE public.artists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    display_name text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    artist_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX artists_organisation_legacy_id_idx
    ON public.artists (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.tours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    tour_name text NOT NULL,
    color_key text,
    start_date date,
    end_date date,
    is_archived boolean NOT NULL DEFAULT false,
    tour_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id),
    CHECK (
        start_date IS NULL
        OR end_date IS NULL
        OR end_date >= start_date
    )
);

CREATE UNIQUE INDEX tours_organisation_legacy_id_idx
    ON public.tours (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.venues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    venue_name text NOT NULL,
    address_line_1 text,
    address_line_2 text,
    city text,
    region text,
    postal_code text,
    country_code char(2)
        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    venue_timezone text,
    latitude numeric(9, 6)
        CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
    longitude numeric(9, 6)
        CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
    venue_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX venues_organisation_legacy_id_idx
    ON public.venues (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.shows (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    tour_id uuid,
    primary_artist_id uuid,
    venue_id uuid,
    show_date date NOT NULL,
    show_status text NOT NULL DEFAULT 'confirmed'
        CHECK (show_status IN ('draft', 'hold', 'confirmed', 'cancelled')),
    color_key text,
    venue_arrival_time time,
    set_start_time time,
    set_end_time time,
    -- Historical timezone snapshot for this show. Later venue edits
    -- do not rewrite previously stored show timing.
    show_timezone_snapshot text,
    internal_notes text,
    content_plan text,
    is_set_done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id),
    CONSTRAINT shows_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE SET NULL (tour_id),
    CONSTRAINT shows_artist_fk
        FOREIGN KEY (primary_artist_id, organisation_id)
        REFERENCES public.artists(id, organisation_id)
        ON DELETE SET NULL (primary_artist_id),
    CONSTRAINT shows_venue_fk
        FOREIGN KEY (venue_id, organisation_id)
        REFERENCES public.venues(id, organisation_id)
        ON DELETE SET NULL (venue_id)
);

CREATE UNIQUE INDEX shows_organisation_legacy_id_idx
    ON public.shows (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX shows_organisation_date_idx
    ON public.shows (organisation_id, show_date);

CREATE INDEX shows_tour_date_idx
    ON public.shows (tour_id, show_date)
    WHERE tour_id IS NOT NULL;

CREATE TABLE public.show_advances (
    show_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL,
    stage_name text,
    access_notes text,
    soundcheck_notes text,
    curfew_notes text,
    dressing_room_notes text,
    guestlist_notes text,
    catering_notes text,
    parking_notes text,
    wifi_notes text,
    navigation_address text,
    general_remarks text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT show_advances_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE
);


-- =====================================================================
-- 7. SCHEDULES AND CHECKLISTS
--
-- One schedule table and one checklist table can belong to either
-- a show or a tour. Exactly one parent must be supplied.
-- =====================================================================

CREATE TABLE public.schedule_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    show_id uuid,
    tour_id uuid,
    schedule_item_type text NOT NULL DEFAULT 'custom'
        CHECK (
            schedule_item_type IN (
                'venue_arrival',
                'soundcheck',
                'doors',
                'set',
                'curfew',
                'deadline',
                'calendar_marker',
                'custom'
            )
        ),
    item_title text NOT NULL,
    item_notes text,
    scheduled_date date,
    scheduled_time time,
    scheduled_end_time time,
    is_all_day boolean NOT NULL DEFAULT false,
    is_done boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT schedule_items_parent_check
        CHECK (num_nonnulls(show_id, tour_id) = 1),
    CONSTRAINT schedule_items_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT schedule_items_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX schedule_items_organisation_legacy_id_idx
    ON public.schedule_items (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX schedule_items_show_sort_idx
    ON public.schedule_items (show_id, scheduled_date, scheduled_time, sort_order)
    WHERE show_id IS NOT NULL;

CREATE INDEX schedule_items_tour_sort_idx
    ON public.schedule_items (tour_id, scheduled_date, scheduled_time, sort_order)
    WHERE tour_id IS NOT NULL;

CREATE TABLE public.checklist_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    show_id uuid,
    tour_id uuid,
    item_label text NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT checklist_items_parent_check
        CHECK (num_nonnulls(show_id, tour_id) = 1),
    CONSTRAINT checklist_items_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT checklist_items_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX checklist_items_organisation_legacy_id_idx
    ON public.checklist_items (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;


-- =====================================================================
-- 8. CONTACTS AND COMPANIES
-- =====================================================================

CREATE TABLE public.contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    first_name text,
    last_name text,
    display_name text NOT NULL,
    email_address text,
    phone_number text,
    whatsapp_number text,
    contact_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX contacts_organisation_legacy_id_idx
    ON public.contacts (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX contacts_organisation_name_idx
    ON public.contacts (organisation_id, lower(display_name));

CREATE TABLE public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    company_name text NOT NULL,
    company_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX companies_organisation_legacy_id_idx
    ON public.companies (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX companies_organisation_name_idx
    ON public.companies (organisation_id, lower(company_name));

CREATE TABLE public.company_contacts (
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    company_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    job_title text,
    is_primary boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, contact_id),
    CONSTRAINT company_contacts_company_fk
        FOREIGN KEY (company_id, organisation_id)
        REFERENCES public.companies(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT company_contacts_contact_fk
        FOREIGN KEY (contact_id, organisation_id)
        REFERENCES public.contacts(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE public.show_contacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    show_id uuid NOT NULL,
    contact_id uuid,
    company_id uuid,
    contact_role text NOT NULL DEFAULT 'other'
        CHECK (
            contact_role IN (
                'artist_liaison',
                'promoter',
                'production',
                'venue_manager',
                'driver',
                'emergency',
                'other'
            )
        ),
    is_primary boolean NOT NULL DEFAULT false,
    contact_notes text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT show_contacts_target_check
        CHECK (contact_id IS NOT NULL OR company_id IS NOT NULL),
    CONSTRAINT show_contacts_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT show_contacts_contact_fk
        FOREIGN KEY (contact_id, organisation_id)
        REFERENCES public.contacts(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT show_contacts_company_fk
        FOREIGN KEY (company_id, organisation_id)
        REFERENCES public.companies(id, organisation_id)
        ON DELETE CASCADE
);

CREATE UNIQUE INDEX show_contacts_contact_unique_idx
    ON public.show_contacts (show_id, contact_id, contact_role)
    WHERE contact_id IS NOT NULL;

CREATE UNIQUE INDEX show_contacts_company_unique_idx
    ON public.show_contacts (show_id, company_id, contact_role)
    WHERE company_id IS NOT NULL AND contact_id IS NULL;

CREATE TABLE public.tour_contacts (
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    tour_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    contact_role text NOT NULL DEFAULT 'other'
        CHECK (
            contact_role IN (
                'manager',
                'tour_manager',
                'agent',
                'emergency',
                'driver',
                'other'
            )
        ),
    is_primary boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tour_id, contact_id, contact_role),
    CONSTRAINT tour_contacts_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT tour_contacts_contact_fk
        FOREIGN KEY (contact_id, organisation_id)
        REFERENCES public.contacts(id, organisation_id)
        ON DELETE CASCADE
);


-- =====================================================================
-- 9. JOURNEYS
--
-- One journeys table covers all movement types.
-- Type-specific columns are nullable and only used when relevant.
-- =====================================================================

CREATE TABLE public.journeys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    tour_id uuid,
    related_show_id uuid,
    journey_type text NOT NULL
        CHECK (
            journey_type IN (
                'flight',
                'rail',
                'ground_transfer',
                'ferry',
                'coach',
                'walk',
                'other'
            )
        ),
    journey_title text NOT NULL,
    booking_reference text,
    operator_name text,

    departure_at timestamptz,
    arrival_at timestamptz,

    departure_location_name text,
    departure_location_code text,
    arrival_location_name text,
    arrival_location_code text,

    flight_number text,
    departure_airport_iata char(3)
        CHECK (
            departure_airport_iata IS NULL
            OR departure_airport_iata ~ '^[A-Z]{3}$'
        ),
    arrival_airport_iata char(3)
        CHECK (
            arrival_airport_iata IS NULL
            OR arrival_airport_iata ~ '^[A-Z]{3}$'
        ),
    departure_terminal text,
    arrival_terminal text,
    departure_gate text,
    arrival_gate text,

    train_number text,
    departure_station_name text,
    arrival_station_name text,
    departure_platform text,
    arrival_platform text,

    ferry_service_number text,
    departure_port_name text,
    arrival_port_name text,

    coach_service_number text,

    pickup_location text,
    dropoff_location text,
    pickup_instructions text,
    vehicle_details text,

    journey_status text,
    delay_description text,
    status_updated_at timestamptz,
    is_live_status boolean NOT NULL DEFAULT false,
    is_done boolean NOT NULL DEFAULT false,
    journey_notes text,
    sort_order integer NOT NULL DEFAULT 0,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,

    UNIQUE (id, organisation_id),

    CONSTRAINT journeys_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE SET NULL (tour_id),

    CONSTRAINT journeys_show_fk
        FOREIGN KEY (related_show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE SET NULL (related_show_id),

    CHECK (
        departure_at IS NULL
        OR arrival_at IS NULL
        OR arrival_at >= departure_at
    )
);

CREATE UNIQUE INDEX journeys_organisation_legacy_id_idx
    ON public.journeys (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX journeys_organisation_departure_idx
    ON public.journeys (organisation_id, departure_at);

CREATE INDEX journeys_tour_departure_idx
    ON public.journeys (tour_id, departure_at)
    WHERE tour_id IS NOT NULL;

CREATE INDEX journeys_show_departure_idx
    ON public.journeys (related_show_id, departure_at)
    WHERE related_show_id IS NOT NULL;

CREATE TABLE public.journey_contacts (
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    journey_id uuid NOT NULL,
    contact_id uuid NOT NULL,
    contact_role text NOT NULL DEFAULT 'other'
        CHECK (
            contact_role IN (
                'driver',
                'booking_contact',
                'operator_contact',
                'emergency',
                'other'
            )
        ),
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (journey_id, contact_id, contact_role),
    CONSTRAINT journey_contacts_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT journey_contacts_contact_fk
        FOREIGN KEY (contact_id, organisation_id)
        REFERENCES public.contacts(id, organisation_id)
        ON DELETE CASCADE
);


-- =====================================================================
-- 10. HOTELS AND BOOKINGS
-- =====================================================================

CREATE TABLE public.hotels (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    hotel_name text NOT NULL,
    address_line_1 text,
    address_line_2 text,
    city text,
    region text,
    postal_code text,
    country_code char(2)
        CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
    phone_number text,
    email_address text,
    hotel_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id)
);

CREATE UNIQUE INDEX hotels_organisation_legacy_id_idx
    ON public.hotels (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.hotel_bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    hotel_id uuid NOT NULL,
    tour_id uuid,
    booking_reference text,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    room_notes text,
    booking_notes text,
    is_done boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id),
    CONSTRAINT hotel_bookings_hotel_fk
        FOREIGN KEY (hotel_id, organisation_id)
        REFERENCES public.hotels(id, organisation_id)
        ON DELETE RESTRICT,
    CONSTRAINT hotel_bookings_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE SET NULL (tour_id),
    CHECK (check_out_date >= check_in_date)
);

CREATE UNIQUE INDEX hotel_bookings_organisation_legacy_id_idx
    ON public.hotel_bookings (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE INDEX hotel_bookings_date_idx
    ON public.hotel_bookings (organisation_id, check_in_date, check_out_date);

CREATE TABLE public.hotel_booking_shows (
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    hotel_booking_id uuid NOT NULL,
    show_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (hotel_booking_id, show_id),
    CONSTRAINT hotel_booking_shows_booking_fk
        FOREIGN KEY (hotel_booking_id, organisation_id)
        REFERENCES public.hotel_bookings(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT hotel_booking_shows_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE
);


-- =====================================================================
-- 11. TRAVEL TICKETS AND JOURNEY FILES
-- =====================================================================

CREATE TABLE public.travel_tickets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    journey_id uuid NOT NULL,
    file_id uuid NOT NULL,
    ticket_type text NOT NULL DEFAULT 'other'
        CHECK (
            ticket_type IN (
                'boarding_pass',
                'rail_ticket',
                'ferry_ticket',
                'coach_ticket',
                'other'
            )
        ),
    passenger_name text,
    seat_number text,
    ticket_reference text,
    ticket_description text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT travel_tickets_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT travel_tickets_file_fk
        FOREIGN KEY (file_id, organisation_id)
        REFERENCES public.files(id, organisation_id)
        ON DELETE CASCADE,
    UNIQUE (journey_id, file_id)
);

CREATE UNIQUE INDEX travel_tickets_organisation_legacy_id_idx
    ON public.travel_tickets (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.journey_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    journey_id uuid NOT NULL,
    file_id uuid NOT NULL,
    file_type text NOT NULL DEFAULT 'other'
        CHECK (
            file_type IN (
                'booking_confirmation',
                'itinerary',
                'receipt',
                'visa_document',
                'travel_information',
                'other'
            )
        ),
    file_title text,
    file_description text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT journey_files_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT journey_files_file_fk
        FOREIGN KEY (file_id, organisation_id)
        REFERENCES public.files(id, organisation_id)
        ON DELETE CASCADE,
    UNIQUE (journey_id, file_id)
);

CREATE TABLE public.show_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    show_id uuid NOT NULL,
    file_id uuid NOT NULL,
    file_type text NOT NULL DEFAULT 'other'
        CHECK (
            file_type IN (
                'contract',
                'artist_rider',
                'technical_rider',
                'venue_document',
                'schedule',
                'other'
            )
        ),
    file_title text,
    file_description text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT show_files_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT show_files_file_fk
        FOREIGN KEY (file_id, organisation_id)
        REFERENCES public.files(id, organisation_id)
        ON DELETE CASCADE,
    UNIQUE (show_id, file_id)
);


-- =====================================================================
-- 12. FINANCE AND INVOICES
-- =====================================================================

CREATE TABLE public.show_financials (
    show_id uuid PRIMARY KEY,
    organisation_id uuid NOT NULL,
    agreed_fee_amount numeric(14, 2)
        CHECK (agreed_fee_amount IS NULL OR agreed_fee_amount >= 0),
    currency_code char(3)
        CHECK (currency_code IS NULL OR currency_code ~ '^[A-Z]{3}$'),
    deal_type text,
    commission_percent numeric(5, 2)
        CHECK (
            commission_percent IS NULL
            OR commission_percent BETWEEN 0 AND 100
        ),
    per_diem_amount numeric(14, 2)
        CHECK (per_diem_amount IS NULL OR per_diem_amount >= 0),
    is_paid boolean NOT NULL DEFAULT false,
    is_estimated boolean NOT NULL DEFAULT false,
    is_not_disclosed boolean NOT NULL DEFAULT false,
    financial_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT show_financials_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE public.show_expenses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    show_id uuid NOT NULL,
    expense_label text NOT NULL,
    expense_amount numeric(14, 2) NOT NULL
        CHECK (expense_amount >= 0),
    currency_code char(3) NOT NULL
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    expense_notes text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT show_expenses_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE public.invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    show_id uuid,
    invoice_number text NOT NULL,
    invoice_date date NOT NULL DEFAULT current_date,
    due_date date,
    client_name text NOT NULL,
    client_email_address text,
    client_address text,
    currency_code char(3) NOT NULL DEFAULT 'GBP'
        CHECK (currency_code ~ '^[A-Z]{3}$'),
    invoice_status text NOT NULL DEFAULT 'draft'
        CHECK (invoice_status IN ('draft', 'sent', 'paid', 'void')),
    payment_terms_days integer NOT NULL DEFAULT 30
        CHECK (payment_terms_days >= 0),
    invoice_notes text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id),
    UNIQUE (organisation_id, invoice_number),
    CONSTRAINT invoices_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE SET NULL (show_id),
    CHECK (due_date IS NULL OR due_date >= invoice_date)
);

CREATE UNIQUE INDEX invoices_organisation_legacy_id_idx
    ON public.invoices (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.invoice_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    invoice_id uuid NOT NULL,
    line_label text NOT NULL,
    line_description text,
    quantity numeric(12, 3) NOT NULL DEFAULT 1
        CHECK (quantity > 0),
    unit_amount numeric(14, 2) NOT NULL,
    line_amount numeric(16, 2)
        GENERATED ALWAYS AS (round(quantity * unit_amount, 2)) STORED,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT invoice_line_items_invoice_fk
        FOREIGN KEY (invoice_id, organisation_id)
        REFERENCES public.invoices(id, organisation_id)
        ON DELETE CASCADE
);


-- =====================================================================
-- 13. PACKING LISTS AND REMINDERS
-- =====================================================================

CREATE TABLE public.packing_lists (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    tour_id uuid,
    list_name text NOT NULL,
    is_organisation_template boolean NOT NULL DEFAULT false,
    is_archived boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    UNIQUE (id, organisation_id),
    CONSTRAINT packing_lists_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE SET NULL (tour_id),
    CHECK (
        NOT is_organisation_template
        OR tour_id IS NULL
    )
);

CREATE TABLE public.packing_list_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    packing_list_id uuid NOT NULL,
    item_label text NOT NULL,
    is_done boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT packing_list_items_list_fk
        FOREIGN KEY (packing_list_id, organisation_id)
        REFERENCES public.packing_lists(id, organisation_id)
        ON DELETE CASCADE
);

CREATE TABLE public.reminders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    user_id uuid NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,
    show_id uuid,
    tour_id uuid,
    journey_id uuid,
    reminder_kind text NOT NULL DEFAULT 'manual'
        CHECK (reminder_kind IN ('manual', 'usb', 'other')),
    remind_at timestamptz NOT NULL,
    reminder_label text NOT NULL,
    is_fired boolean NOT NULL DEFAULT false,
    is_dismissed boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT reminders_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT reminders_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT reminders_journey_fk
        FOREIGN KEY (journey_id, organisation_id)
        REFERENCES public.journeys(id, organisation_id)
        ON DELETE CASCADE
);

CREATE INDEX reminders_user_time_idx
    ON public.reminders (user_id, remind_at)
    WHERE deleted_at IS NULL;


-- =====================================================================
-- 14. IDEAS, NOTES, AND ITINERARY INBOX
-- =====================================================================

CREATE TABLE public.ideas (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    show_id uuid,
    tour_id uuid,
    idea_type text NOT NULL DEFAULT 'other'
        CHECK (
            idea_type IN (
                'reel',
                'caption',
                'hook',
                'youtube',
                'podcast',
                'interview',
                'location',
                'other'
            )
        ),
    idea_title text,
    idea_note text,
    priority_level text
        CHECK (
            priority_level IS NULL
            OR priority_level IN ('low', 'medium', 'high')
        ),
    is_done boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT ideas_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE SET NULL (show_id),
    CONSTRAINT ideas_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE SET NULL (tour_id)
);

CREATE UNIQUE INDEX ideas_organisation_legacy_id_idx
    ON public.ideas (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.notes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    legacy_id text,
    show_id uuid,
    tour_id uuid,
    note_title text,
    note_body text,
    folder_name text,
    sort_order integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz,
    CONSTRAINT notes_show_fk
        FOREIGN KEY (show_id, organisation_id)
        REFERENCES public.shows(id, organisation_id)
        ON DELETE SET NULL (show_id),
    CONSTRAINT notes_tour_fk
        FOREIGN KEY (tour_id, organisation_id)
        REFERENCES public.tours(id, organisation_id)
        ON DELETE SET NULL (tour_id)
);

CREATE UNIQUE INDEX notes_organisation_legacy_id_idx
    ON public.notes (organisation_id, legacy_id)
    WHERE legacy_id IS NOT NULL;

CREATE TABLE public.itinerary_submissions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    submitted_by_user_id uuid
        REFERENCES auth.users(id) ON DELETE SET NULL,
    submission_status text NOT NULL DEFAULT 'pending'
        CHECK (
            submission_status IN (
                'pending',
                'processing',
                'processed',
                'failed'
            )
        ),
    source_filename text,
    raw_scan_response jsonb,
    error_message text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (id, organisation_id)
);

CREATE TABLE public.itinerary_submission_files (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organisation_id uuid NOT NULL
        REFERENCES public.organisations(id) ON DELETE CASCADE,
    itinerary_submission_id uuid NOT NULL,
    file_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT itinerary_submission_files_submission_fk
        FOREIGN KEY (itinerary_submission_id, organisation_id)
        REFERENCES public.itinerary_submissions(id, organisation_id)
        ON DELETE CASCADE,
    CONSTRAINT itinerary_submission_files_file_fk
        FOREIGN KEY (file_id, organisation_id)
        REFERENCES public.files(id, organisation_id)
        ON DELETE CASCADE,
    UNIQUE (itinerary_submission_id, file_id)
);


-- =====================================================================
-- 15. INDEXES FOR COMMON FOREIGN KEYS
-- =====================================================================

CREATE INDEX organisation_members_user_idx
    ON public.organisation_members (user_id);

CREATE INDEX organisation_invites_org_email_idx
    ON public.organisation_invites (organisation_id, lower(email_address));

CREATE INDEX show_contacts_show_idx
    ON public.show_contacts (show_id);

CREATE INDEX tour_contacts_tour_idx
    ON public.tour_contacts (tour_id);

CREATE INDEX journey_contacts_journey_idx
    ON public.journey_contacts (journey_id);

CREATE INDEX hotel_booking_shows_show_idx
    ON public.hotel_booking_shows (show_id);

CREATE INDEX travel_tickets_journey_idx
    ON public.travel_tickets (journey_id);

CREATE INDEX journey_files_journey_idx
    ON public.journey_files (journey_id);

CREATE INDEX show_files_show_idx
    ON public.show_files (show_id);

CREATE INDEX show_expenses_show_idx
    ON public.show_expenses (show_id);

CREATE INDEX invoice_line_items_invoice_idx
    ON public.invoice_line_items (invoice_id);

CREATE INDEX packing_list_items_list_idx
    ON public.packing_list_items (packing_list_id);


-- =====================================================================
-- 16. UPDATED_AT TRIGGERS
-- =====================================================================

DO $updated_at_triggers$
DECLARE
    table_name text;
    trigger_name text;
    tables_with_updated_at text[] := ARRAY[
        'profiles',
        'organisations',
        'files',
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
        'journeys',
        'hotels',
        'hotel_bookings',
        'travel_tickets',
        'journey_files',
        'show_files',
        'show_financials',
        'show_expenses',
        'invoices',
        'packing_lists',
        'packing_list_items',
        'reminders',
        'ideas',
        'notes',
        'itinerary_submissions'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_with_updated_at
    LOOP
        trigger_name := table_name || '_set_updated_at';

        EXECUTE format(
            'CREATE TRIGGER %I
             BEFORE UPDATE ON public.%I
             FOR EACH ROW
             EXECUTE FUNCTION public.set_updated_at()',
            trigger_name,
            table_name
        );
    END LOOP;
END
$updated_at_triggers$;


-- =====================================================================
-- 17. V2 ACCESS HELPER FUNCTIONS
--
-- These functions use V2 names and do not replace the V1 helper functions.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.v2_is_organisation_member(
    p_organisation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organisation_members
        WHERE organisation_id = p_organisation_id
          AND user_id = auth.uid()
    );
$function$;

CREATE OR REPLACE FUNCTION public.v2_can_manage_organisation(
    p_organisation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organisation_members
        WHERE organisation_id = p_organisation_id
          AND user_id = auth.uid()
          AND member_role IN ('owner', 'manager')
    );
$function$;

CREATE OR REPLACE FUNCTION public.v2_is_organisation_owner(
    p_organisation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organisation_members
        WHERE organisation_id = p_organisation_id
          AND user_id = auth.uid()
          AND member_role = 'owner'
    );
$function$;

CREATE OR REPLACE FUNCTION public.v2_users_share_organisation(
    p_other_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
    SELECT EXISTS (
        SELECT 1
        FROM public.organisation_members AS mine
        JOIN public.organisation_members AS theirs
          ON theirs.organisation_id = mine.organisation_id
        WHERE mine.user_id = auth.uid()
          AND theirs.user_id = p_other_user_id
    );
$function$;

REVOKE ALL ON FUNCTION public.v2_is_organisation_member(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_can_manage_organisation(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_is_organisation_owner(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.v2_users_share_organisation(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.v2_is_organisation_member(uuid)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.v2_can_manage_organisation(uuid)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.v2_is_organisation_owner(uuid)
    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.v2_users_share_organisation(uuid)
    TO authenticated, service_role;


-- =====================================================================
-- 18. AUTH PROFILE TRIGGER FOR FUTURE USERS
--
-- Existing users will be copied into profiles during the data migration.
-- This trigger handles users created after V2 is installed.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.profiles (
        id,
        display_name,
        email_address
    )
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'display_name',
            NEW.raw_user_meta_data ->> 'full_name'
        ),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user_v2() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created_v2 ON auth.users;

CREATE TRIGGER on_auth_user_created_v2
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_v2();


-- =====================================================================
-- 19. ORGANISATION RPC FUNCTIONS
-- =====================================================================

CREATE OR REPLACE FUNCTION public.create_organisation_v2(
    p_organisation_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    new_organisation_id uuid;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    IF NULLIF(trim(p_organisation_name), '') IS NULL THEN
        RAISE EXCEPTION 'Organisation name is required.';
    END IF;

    INSERT INTO public.organisations (
        organisation_name,
        created_by_user_id
    )
    VALUES (
        trim(p_organisation_name),
        auth.uid()
    )
    RETURNING id INTO new_organisation_id;

    INSERT INTO public.organisation_members (
        organisation_id,
        user_id,
        member_role
    )
    VALUES (
        new_organisation_id,
        auth.uid(),
        'owner'
    );

    INSERT INTO public.organisation_settings (
        organisation_id
    )
    VALUES (
        new_organisation_id
    );

    RETURN new_organisation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_organisation_invite_v2(
    p_invite_token uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
    matching_invite public.organisation_invites%ROWTYPE;
    current_email text;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication is required.';
    END IF;

    current_email := lower(COALESCE(auth.jwt() ->> 'email', ''));

    SELECT *
    INTO matching_invite
    FROM public.organisation_invites
    WHERE invite_token = p_invite_token
      AND accepted_at IS NULL
      AND revoked_at IS NULL
      AND expires_at > now()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invite is invalid, expired, accepted, or revoked.';
    END IF;

    IF lower(matching_invite.email_address) <> current_email THEN
        RAISE EXCEPTION 'This invite was issued to a different email address.';
    END IF;

    INSERT INTO public.organisation_members (
        organisation_id,
        user_id,
        member_role
    )
    VALUES (
        matching_invite.organisation_id,
        auth.uid(),
        matching_invite.invited_role
    )
    ON CONFLICT (organisation_id, user_id)
    DO UPDATE SET
        member_role = EXCLUDED.member_role;

    UPDATE public.organisation_invites
    SET
        accepted_at = now(),
        accepted_by_user_id = auth.uid()
    WHERE id = matching_invite.id;

    RETURN matching_invite.organisation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_organisation_v2(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_organisation_invite_v2(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.create_organisation_v2(text)
    TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organisation_invite_v2(uuid)
    TO authenticated;


-- =====================================================================
-- 20. ENABLE ROW LEVEL SECURITY
-- =====================================================================

DO $enable_rls$
DECLARE
    table_name text;
    all_v2_tables text[] := ARRAY[
        'profiles',
        'organisations',
        'organisation_members',
        'organisation_invites',
        'files',
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
        'travel_tickets',
        'journey_files',
        'show_files',
        'show_financials',
        'show_expenses',
        'invoices',
        'invoice_line_items',
        'packing_lists',
        'packing_list_items',
        'reminders',
        'ideas',
        'notes',
        'itinerary_submissions',
        'itinerary_submission_files'
    ];
BEGIN
    FOREACH table_name IN ARRAY all_v2_tables
    LOOP
        EXECUTE format(
            'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',
            table_name
        );
    END LOOP;
END
$enable_rls$;


-- =====================================================================
-- 21. RLS: PROFILES
-- =====================================================================

CREATE POLICY profiles_v2_select
ON public.profiles
FOR SELECT
TO authenticated
USING (
    id = auth.uid()
    OR public.v2_users_share_organisation(id)
);

CREATE POLICY profiles_v2_update
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());


-- =====================================================================
-- 22. RLS: ORGANISATIONS, MEMBERS, INVITES, SETTINGS
-- =====================================================================

CREATE POLICY organisations_v2_select
ON public.organisations
FOR SELECT
TO authenticated
USING (public.v2_is_organisation_member(id));

CREATE POLICY organisations_v2_update
ON public.organisations
FOR UPDATE
TO authenticated
USING (public.v2_can_manage_organisation(id))
WITH CHECK (public.v2_can_manage_organisation(id));

CREATE POLICY organisation_members_v2_select
ON public.organisation_members
FOR SELECT
TO authenticated
USING (
    public.v2_is_organisation_member(organisation_id)
);

CREATE POLICY organisation_members_v2_owner_write
ON public.organisation_members
FOR ALL
TO authenticated
USING (
    public.v2_is_organisation_owner(organisation_id)
)
WITH CHECK (
    public.v2_is_organisation_owner(organisation_id)
);

CREATE POLICY organisation_invites_v2_manage
ON public.organisation_invites
FOR ALL
TO authenticated
USING (
    public.v2_can_manage_organisation(organisation_id)
)
WITH CHECK (
    public.v2_can_manage_organisation(organisation_id)
);

CREATE POLICY organisation_settings_v2_select
ON public.organisation_settings
FOR SELECT
TO authenticated
USING (
    public.v2_is_organisation_member(organisation_id)
);

CREATE POLICY organisation_settings_v2_manage
ON public.organisation_settings
FOR ALL
TO authenticated
USING (
    public.v2_can_manage_organisation(organisation_id)
)
WITH CHECK (
    public.v2_can_manage_organisation(organisation_id)
);

CREATE POLICY organisation_billing_profiles_v2_manage
ON public.organisation_billing_profiles
FOR ALL
TO authenticated
USING (
    public.v2_can_manage_organisation(organisation_id)
)
WITH CHECK (
    public.v2_can_manage_organisation(organisation_id)
);

CREATE POLICY organisation_exchange_rates_v2_select
ON public.organisation_exchange_rates
FOR SELECT
TO authenticated
USING (
    public.v2_is_organisation_member(organisation_id)
);

CREATE POLICY organisation_exchange_rates_v2_manage
ON public.organisation_exchange_rates
FOR ALL
TO authenticated
USING (
    public.v2_can_manage_organisation(organisation_id)
)
WITH CHECK (
    public.v2_can_manage_organisation(organisation_id)
);

CREATE POLICY user_preferences_v2_own
ON public.user_preferences
FOR ALL
TO authenticated
USING (
    user_id = auth.uid()
    AND public.v2_is_organisation_member(organisation_id)
)
WITH CHECK (
    user_id = auth.uid()
    AND public.v2_is_organisation_member(organisation_id)
);


-- =====================================================================
-- 23. RLS: STANDARD MANAGER-WRITE TABLES
--
-- All organisation members may read.
-- Owners and managers may create, update, and delete.
-- =====================================================================

DO $manager_write_policies$
DECLARE
    table_name text;
    manager_write_tables text[] := ARRAY[
        'artists',
        'tours',
        'venues',
        'shows',
        'contacts',
        'companies',
        'company_contacts',
        'show_contacts',
        'tour_contacts',
        'hotels',
        'packing_lists'
    ];
BEGIN
    FOREACH table_name IN ARRAY manager_write_tables
    LOOP
        EXECUTE format(
            'CREATE POLICY %I
             ON public.%I
             FOR SELECT
             TO authenticated
             USING (
                 public.v2_is_organisation_member(organisation_id)
             )',
            table_name || '_v2_select',
            table_name
        );

        EXECUTE format(
            'CREATE POLICY %I
             ON public.%I
             FOR ALL
             TO authenticated
             USING (
                 public.v2_can_manage_organisation(organisation_id)
             )
             WITH CHECK (
                 public.v2_can_manage_organisation(organisation_id)
             )',
            table_name || '_v2_manage',
            table_name
        );
    END LOOP;
END
$manager_write_policies$;


-- =====================================================================
-- 24. RLS: OPERATIONAL MEMBER-WRITE TABLES
--
-- Any organisation member may read and edit these operational records.
-- =====================================================================

DO $member_write_policies$
DECLARE
    table_name text;
    member_write_tables text[] := ARRAY[
        'files',
        'show_advances',
        'schedule_items',
        'checklist_items',
        'journeys',
        'journey_contacts',
        'hotel_bookings',
        'hotel_booking_shows',
        'travel_tickets',
        'journey_files',
        'show_files',
        'packing_list_items',
        'ideas',
        'notes',
        'itinerary_submissions',
        'itinerary_submission_files'
    ];
BEGIN
    FOREACH table_name IN ARRAY member_write_tables
    LOOP
        EXECUTE format(
            'CREATE POLICY %I
             ON public.%I
             FOR ALL
             TO authenticated
             USING (
                 public.v2_is_organisation_member(organisation_id)
             )
             WITH CHECK (
                 public.v2_is_organisation_member(organisation_id)
             )',
            table_name || '_v2_member_access',
            table_name
        );
    END LOOP;
END
$member_write_policies$;


-- =====================================================================
-- 25. RLS: PRIVATE FINANCE
--
-- Crew cannot read or write these tables.
-- =====================================================================

DO $finance_policies$
DECLARE
    table_name text;
    finance_tables text[] := ARRAY[
        'show_financials',
        'show_expenses',
        'invoices',
        'invoice_line_items'
    ];
BEGIN
    FOREACH table_name IN ARRAY finance_tables
    LOOP
        EXECUTE format(
            'CREATE POLICY %I
             ON public.%I
             FOR ALL
             TO authenticated
             USING (
                 public.v2_can_manage_organisation(organisation_id)
             )
             WITH CHECK (
                 public.v2_can_manage_organisation(organisation_id)
             )',
            table_name || '_v2_private_finance',
            table_name
        );
    END LOOP;
END
$finance_policies$;


-- =====================================================================
-- 26. RLS: USER-SPECIFIC REMINDERS
-- =====================================================================

CREATE POLICY reminders_v2_own
ON public.reminders
FOR ALL
TO authenticated
USING (
    user_id = auth.uid()
    AND public.v2_is_organisation_member(organisation_id)
)
WITH CHECK (
    user_id = auth.uid()
    AND public.v2_is_organisation_member(organisation_id)
);


-- =====================================================================
-- 27. TABLE GRANTS
-- =====================================================================

DO $table_grants$
DECLARE
    table_name text;
    all_v2_tables text[] := ARRAY[
        'profiles',
        'organisations',
        'organisation_members',
        'organisation_invites',
        'files',
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
        'travel_tickets',
        'journey_files',
        'show_files',
        'show_financials',
        'show_expenses',
        'invoices',
        'invoice_line_items',
        'packing_lists',
        'packing_list_items',
        'reminders',
        'ideas',
        'notes',
        'itinerary_submissions',
        'itinerary_submission_files'
    ];
BEGIN
    FOREACH table_name IN ARRAY all_v2_tables
    LOOP
        EXECUTE format(
            'GRANT SELECT, INSERT, UPDATE, DELETE
             ON TABLE public.%I
             TO authenticated',
            table_name
        );

        EXECUTE format(
            'GRANT ALL PRIVILEGES
             ON TABLE public.%I
             TO service_role',
            table_name
        );
    END LOOP;
END
$table_grants$;


-- =====================================================================
-- 28. PRIVATE SUPABASE STORAGE BUCKET
--
-- Path convention:
--   {organisation_id}/journeys/{journey_id}/tickets/{filename}
--   {organisation_id}/journeys/{journey_id}/documents/{filename}
--   {organisation_id}/shows/{show_id}/documents/{filename}
-- =====================================================================

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit
)
VALUES (
    'operate-documents-v2',
    'operate-documents-v2',
    false,
    52428800
)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.v2_storage_path_organisation_id(
    p_storage_path text
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $function$
DECLARE
    first_path_segment text;
BEGIN
    first_path_segment := split_part(p_storage_path, '/', 1);

    IF first_path_segment ~*
       '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN
        RETURN first_path_segment::uuid;
    END IF;

    RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public.v2_storage_path_organisation_id(text)
    FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.v2_storage_path_organisation_id(text)
    TO authenticated, service_role;

DROP POLICY IF EXISTS operate_v2_storage_select
    ON storage.objects;
DROP POLICY IF EXISTS operate_v2_storage_insert
    ON storage.objects;
DROP POLICY IF EXISTS operate_v2_storage_update
    ON storage.objects;
DROP POLICY IF EXISTS operate_v2_storage_delete
    ON storage.objects;

CREATE POLICY operate_v2_storage_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'operate-documents-v2'
    AND public.v2_is_organisation_member(
        public.v2_storage_path_organisation_id(name)
    )
);

CREATE POLICY operate_v2_storage_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'operate-documents-v2'
    AND public.v2_is_organisation_member(
        public.v2_storage_path_organisation_id(name)
    )
);

CREATE POLICY operate_v2_storage_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'operate-documents-v2'
    AND public.v2_is_organisation_member(
        public.v2_storage_path_organisation_id(name)
    )
)
WITH CHECK (
    bucket_id = 'operate-documents-v2'
    AND public.v2_is_organisation_member(
        public.v2_storage_path_organisation_id(name)
    )
);

CREATE POLICY operate_v2_storage_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'operate-documents-v2'
    AND public.v2_is_organisation_member(
        public.v2_storage_path_organisation_id(name)
    )
);


-- =====================================================================
-- 29. READABLE VIEWS
--
-- security_invoker means the underlying table RLS rules still apply.
-- =====================================================================

CREATE VIEW public.show_overview
WITH (security_invoker = true)
AS
SELECT
    s.id AS show_id,
    s.organisation_id,
    s.show_date,
    s.show_status,
    s.show_timezone_snapshot,
    s.set_start_time,
    s.set_end_time,
    a.display_name AS artist_name,
    v.venue_name,
    v.city,
    v.country_code,
    t.tour_name
FROM public.shows AS s
LEFT JOIN public.artists AS a
    ON a.id = s.primary_artist_id
LEFT JOIN public.venues AS v
    ON v.id = s.venue_id
LEFT JOIN public.tours AS t
    ON t.id = s.tour_id
WHERE s.deleted_at IS NULL;

CREATE VIEW public.tour_overview
WITH (security_invoker = true)
AS
SELECT
    t.id AS tour_id,
    t.organisation_id,
    t.tour_name,
    t.start_date,
    t.end_date,
    t.is_archived,
    count(s.id) FILTER (WHERE s.deleted_at IS NULL) AS show_count
FROM public.tours AS t
LEFT JOIN public.shows AS s
    ON s.tour_id = t.id
WHERE t.deleted_at IS NULL
GROUP BY
    t.id,
    t.organisation_id,
    t.tour_name,
    t.start_date,
    t.end_date,
    t.is_archived;

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
    j.flight_number,
    j.train_number,
    j.ferry_service_number,
    j.coach_service_number,
    j.journey_status,
    j.is_done,
    t.tour_name,
    s.show_date AS related_show_date
FROM public.journeys AS j
LEFT JOIN public.tours AS t
    ON t.id = j.tour_id
LEFT JOIN public.shows AS s
    ON s.id = j.related_show_id
WHERE j.deleted_at IS NULL;

CREATE VIEW public.hotel_schedule
WITH (security_invoker = true)
AS
SELECT
    hb.id AS hotel_booking_id,
    hb.organisation_id,
    h.hotel_name,
    hb.booking_reference,
    hb.check_in_date,
    hb.check_out_date,
    hb.is_done,
    t.tour_name,
    array_remove(array_agg(s.show_date ORDER BY s.show_date), NULL)
        AS linked_show_dates
FROM public.hotel_bookings AS hb
JOIN public.hotels AS h
    ON h.id = hb.hotel_id
LEFT JOIN public.tours AS t
    ON t.id = hb.tour_id
LEFT JOIN public.hotel_booking_shows AS hbs
    ON hbs.hotel_booking_id = hb.id
LEFT JOIN public.shows AS s
    ON s.id = hbs.show_id
WHERE hb.deleted_at IS NULL
GROUP BY
    hb.id,
    hb.organisation_id,
    h.hotel_name,
    hb.booking_reference,
    hb.check_in_date,
    hb.check_out_date,
    hb.is_done,
    t.tour_name;

CREATE VIEW public.outstanding_payments
WITH (security_invoker = true)
AS
SELECT
    s.id AS show_id,
    s.organisation_id,
    s.show_date,
    v.venue_name,
    sf.agreed_fee_amount,
    sf.currency_code,
    sf.is_paid
FROM public.show_financials AS sf
JOIN public.shows AS s
    ON s.id = sf.show_id
LEFT JOIN public.venues AS v
    ON v.id = s.venue_id
WHERE sf.is_paid = false
  AND s.deleted_at IS NULL;


-- =====================================================================
-- 30. VIEW GRANTS
-- =====================================================================

GRANT SELECT ON public.show_overview TO authenticated, service_role;
GRANT SELECT ON public.tour_overview TO authenticated, service_role;
GRANT SELECT ON public.travel_schedule TO authenticated, service_role;
GRANT SELECT ON public.hotel_schedule TO authenticated, service_role;
GRANT SELECT ON public.outstanding_payments TO authenticated, service_role;


-- =====================================================================
-- 31. FINAL VALIDATION
-- =====================================================================

DO $validate$
DECLARE
    expected_table_count integer := 40;
    actual_table_count integer;
BEGIN
    SELECT count(*)
    INTO actual_table_count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN (
        'profiles',
        'organisations',
        'organisation_members',
        'organisation_invites',
        'files',
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
        'travel_tickets',
        'journey_files',
        'show_files',
        'show_financials',
        'show_expenses',
        'invoices',
        'invoice_line_items',
        'packing_lists',
        'packing_list_items',
        'reminders',
        'ideas',
        'notes',
        'itinerary_submissions',
        'itinerary_submission_files'
      );

    IF actual_table_count <> expected_table_count THEN
        RAISE EXCEPTION
            'V2 validation failed. Expected % new tables, found %.',
            expected_table_count,
            actual_table_count;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE id = 'operate-documents-v2'
    ) THEN
        RAISE EXCEPTION
            'V2 validation failed. Storage bucket was not created.';
    END IF;
END
$validate$;

COMMIT;


-- =====================================================================
-- 32. RESULT SUMMARY
-- =====================================================================

SELECT
    tablename AS new_v2_table
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE '%\_v1' ESCAPE '\'
ORDER BY tablename;

SELECT
    id AS storage_bucket,
    public,
    file_size_limit
FROM storage.buckets
WHERE id = 'operate-documents-v2';
