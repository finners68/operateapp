/**
 * Handy names for the database rows the screens already understand.
 * The full generated list from the live operate-dev database is in supabase.generated.ts.
 * These shorter names stay in use so a generated-file refresh does not rewrite the screens.
 * Nothing here changes the database.
 */

export interface DbTour {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  tour_name: string;
  color_key?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_archived?: boolean;
  tour_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DbVenue {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  venue_name: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  venue_timezone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  venue_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DbShow {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  tour_id?: string | null;
  primary_artist_id?: string | null;
  venue_id?: string | null;
  venue_name?: string | null;
  event_name?: string | null;
  show_date: string;
  show_status?: string;
  color_key?: string | null;
  venue_arrival_time?: string | null;
  set_start_time?: string | null;
  set_end_time?: string | null;
  set_end_date?: string | null;
  show_timezone_snapshot?: string | null;
  internal_notes?: string | null;
  content_plan?: string | null;
  is_set_done?: boolean;
  no_accommodation?: boolean;
  set_start_date?: string | null;
  text_color_key?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DbContact {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  display_name: string;
  email_address?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  contact_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export type DbJourneyType =
  | 'flight'
  | 'rail'
  | 'ground_transfer'
  | 'ferry'
  | 'coach'
  | 'walk'
  | 'other';

export interface DbJourney {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  tour_id?: string | null;
  related_show_id?: string | null;
  journey_type: DbJourneyType;
  journey_title: string;
  booking_reference?: string | null;
  operator_name?: string | null;
  departure_at?: string | null;
  arrival_at?: string | null;
  departure_location_name?: string | null;
  departure_location_code?: string | null;
  arrival_location_name?: string | null;
  arrival_location_code?: string | null;
  departure_location_kind?: string | null;
  arrival_location_kind?: string | null;
  departure_location_address?: string | null;
  arrival_location_address?: string | null;
  flight_number?: string | null;
  departure_airport_iata?: string | null;
  arrival_airport_iata?: string | null;
  journey_status?: string | null;
  is_done?: boolean;
  journey_notes?: string | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DbHotel {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  hotel_name: string;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  region?: string | null;
  postal_code?: string | null;
  country_code?: string | null;
  phone_number?: string | null;
  email_address?: string | null;
  hotel_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export interface DbHotelBooking {
  id: string;
  organisation_id: string;
  legacy_id?: string | null;
  hotel_id: string;
  tour_id?: string | null;
  booking_reference?: string | null;
  check_in_date: string;
  check_out_date: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

/** In-memory collections kept under `store.v2`. */
export interface V2Collections {
  organisation_settings: Record<string, unknown> | null;
  organisation_billing_profiles: Record<string, unknown> | null;
  organisation_exchange_rates: Record<string, unknown>[];
  user_preferences: Record<string, unknown> | null;
  artists: Record<string, unknown>[];
  tours: DbTour[];
  venues: DbVenue[];
  shows: DbShow[];
  show_advances: Record<string, unknown>[];
  show_financials: Record<string, unknown>[];
  show_expenses: Record<string, unknown>[];
  journeys: DbJourney[];
  journey_flight_details: Record<string, unknown>[];
  journey_rail_details: Record<string, unknown>[];
  journey_ground_details: Record<string, unknown>[];
  journey_ferry_details: Record<string, unknown>[];
  journey_coach_details: Record<string, unknown>[];
  journey_passengers: Record<string, unknown>[];
  hotels: DbHotel[];
  hotel_bookings: DbHotelBooking[];
  hotel_booking_shows: Record<string, unknown>[];
  schedule_items: Record<string, unknown>[];
  checklist_items: Record<string, unknown>[];
  contacts: DbContact[];
  show_contacts: Record<string, unknown>[];
  tour_contacts: Record<string, unknown>[];
  journey_contacts: Record<string, unknown>[];
  files: Record<string, unknown>[];
  show_files: Record<string, unknown>[];
  travel_tickets: Record<string, unknown>[];
  invoices: Record<string, unknown>[];
  invoice_line_items: Record<string, unknown>[];
  packing_lists: Record<string, unknown>[];
  packing_list_items: Record<string, unknown>[];
  itinerary_submissions: Record<string, unknown>[];
  itinerary_submission_files: Record<string, unknown>[];
  ideas: Record<string, unknown>[];
  note_folders: Record<string, unknown>[];
  notes: Record<string, unknown>[];
}
