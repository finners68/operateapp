/* Generated from the operate-dev Supabase project (tudcrrkhlkhxnoisvzpk).
   Regenerate with: npx supabase gen types typescript --project-id tudcrrkhlkhxnoisvzpk --schema public > src/types/supabase.generated.ts
   This file is types only. It does not change the database or the data already saved. */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      artists: {
        Row: {
          artist_notes: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          id: string
          is_default: boolean
          legacy_id: string | null
          organisation_id: string
          updated_at: string
        }
        Insert: {
          artist_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          id?: string
          is_default?: boolean
          legacy_id?: string | null
          organisation_id: string
          updated_at?: string
        }
        Update: {
          artist_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          id?: string
          is_default?: boolean
          legacy_id?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artists_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_done: boolean
          item_label: string
          legacy_id: string | null
          organisation_id: string
          show_id: string | null
          sort_order: number
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_done?: boolean
          item_label: string
          legacy_id?: string | null
          organisation_id: string
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_done?: boolean
          item_label?: string
          legacy_id?: string | null
          organisation_id?: string
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "checklist_items_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "checklist_items_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "checklist_items_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "checklist_items_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      companies: {
        Row: {
          company_name: string
          company_notes: string | null
          created_at: string
          deleted_at: string | null
          id: string
          legacy_id: string | null
          organisation_id: string
          updated_at: string
        }
        Insert: {
          company_name: string
          company_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_id?: string | null
          organisation_id: string
          updated_at?: string
        }
        Update: {
          company_name?: string
          company_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          legacy_id?: string | null
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "companies_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      company_contacts: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string
          is_primary: boolean
          job_title: string | null
          organisation_id: string
          sort_order: number
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string
          is_primary?: boolean
          job_title?: string | null
          organisation_id: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string
          is_primary?: boolean
          job_title?: string | null
          organisation_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "company_contacts_company_fk"
            columns: ["company_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "company_contacts_contact_fk"
            columns: ["contact_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "company_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          contact_notes: string | null
          created_at: string
          deleted_at: string | null
          display_name: string
          email_address: string | null
          first_name: string | null
          id: string
          last_name: string | null
          legacy_id: string | null
          organisation_id: string
          phone_number: string | null
          updated_at: string
          whatsapp_number: string | null
        }
        Insert: {
          contact_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name: string
          email_address?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legacy_id?: string | null
          organisation_id: string
          phone_number?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Update: {
          contact_notes?: string | null
          created_at?: string
          deleted_at?: string | null
          display_name?: string
          email_address?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          legacy_id?: string | null
          organisation_id?: string
          phone_number?: string | null
          updated_at?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket_name: string
          created_at: string
          deleted_at: string | null
          file_description: string | null
          file_size_bytes: number | null
          file_title: string | null
          id: string
          legacy_id: string | null
          mime_type: string | null
          organisation_id: string
          original_filename: string | null
          storage_path: string
          updated_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          bucket_name?: string
          created_at?: string
          deleted_at?: string | null
          file_description?: string | null
          file_size_bytes?: number | null
          file_title?: string | null
          id?: string
          legacy_id?: string | null
          mime_type?: string | null
          organisation_id: string
          original_filename?: string | null
          storage_path: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          bucket_name?: string
          created_at?: string
          deleted_at?: string | null
          file_description?: string | null
          file_size_bytes?: number | null
          file_title?: string | null
          id?: string
          legacy_id?: string | null
          mime_type?: string | null
          organisation_id?: string
          original_filename?: string | null
          storage_path?: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_booking_shows: {
        Row: {
          created_at: string
          hotel_booking_id: string
          organisation_id: string
          show_id: string
        }
        Insert: {
          created_at?: string
          hotel_booking_id: string
          organisation_id: string
          show_id: string
        }
        Update: {
          created_at?: string
          hotel_booking_id?: string
          organisation_id?: string
          show_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_booking_shows_booking_fk"
            columns: ["hotel_booking_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "hotel_bookings"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "hotel_booking_shows_booking_fk"
            columns: ["hotel_booking_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "hotel_schedule"
            referencedColumns: ["hotel_booking_id", "organisation_id"]
          },
          {
            foreignKeyName: "hotel_booking_shows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_booking_shows_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "hotel_booking_shows_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "hotel_booking_shows_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      hotel_bookings: {
        Row: {
          booking_reference: string | null
          check_in_date: string
          check_out_date: string
          created_at: string
          deleted_at: string | null
          hotel_id: string
          id: string
          is_done: boolean
          legacy_id: string | null
          organisation_id: string
          room_notes: Json | null
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          booking_reference?: string | null
          check_in_date: string
          check_out_date: string
          created_at?: string
          deleted_at?: string | null
          hotel_id: string
          id?: string
          is_done?: boolean
          legacy_id?: string | null
          organisation_id: string
          room_notes?: Json | null
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          booking_reference?: string | null
          check_in_date?: string
          check_out_date?: string
          created_at?: string
          deleted_at?: string | null
          hotel_id?: string
          id?: string
          is_done?: boolean
          legacy_id?: string | null
          organisation_id?: string
          room_notes?: Json | null
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_bookings_hotel_fk"
            columns: ["hotel_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "hotel_bookings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hotel_bookings_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "hotel_bookings_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      hotels: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string | null
          created_at: string
          deleted_at: string | null
          email_address: string | null
          hotel_name: string
          hotel_notes: Json | null
          id: string
          legacy_id: string | null
          organisation_id: string
          phone_number: string | null
          postal_code: string | null
          region: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          email_address?: string | null
          hotel_name: string
          hotel_notes?: Json | null
          id?: string
          legacy_id?: string | null
          organisation_id: string
          phone_number?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          email_address?: string | null
          hotel_name?: string
          hotel_notes?: Json | null
          id?: string
          legacy_id?: string | null
          organisation_id?: string
          phone_number?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          idea_note: string | null
          idea_title: string | null
          idea_type: string
          is_done: boolean
          legacy_id: string | null
          organisation_id: string
          priority_level: string | null
          show_id: string | null
          sort_order: number
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          idea_note?: string | null
          idea_title?: string | null
          idea_type?: string
          is_done?: boolean
          legacy_id?: string | null
          organisation_id: string
          priority_level?: string | null
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          idea_note?: string | null
          idea_title?: string | null
          idea_type?: string
          is_done?: boolean
          legacy_id?: string | null
          organisation_id?: string
          priority_level?: string | null
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ideas_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "ideas_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "ideas_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "ideas_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "ideas_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      invoice_line_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          line_amount: number | null
          line_description: string | null
          line_label: string
          organisation_id: string
          quantity: number
          sort_order: number
          unit_amount: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          line_amount?: number | null
          line_description?: string | null
          line_label: string
          organisation_id: string
          quantity?: number
          sort_order?: number
          unit_amount: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          line_amount?: number | null
          line_description?: string | null
          line_label?: string
          organisation_id?: string
          quantity?: number
          sort_order?: number
          unit_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_line_items_invoice_fk"
            columns: ["invoice_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "invoice_line_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_address: string | null
          client_email_address: string | null
          client_name: string
          created_at: string
          currency_code: string
          deleted_at: string | null
          due_date: string | null
          id: string
          invoice_date: string
          invoice_notes: string | null
          invoice_number: string
          invoice_status: string
          legacy_id: string | null
          organisation_id: string
          payment_terms_days: number
          show_id: string | null
          updated_at: string
        }
        Insert: {
          client_address?: string | null
          client_email_address?: string | null
          client_name: string
          created_at?: string
          currency_code?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_notes?: string | null
          invoice_number: string
          invoice_status?: string
          legacy_id?: string | null
          organisation_id: string
          payment_terms_days?: number
          show_id?: string | null
          updated_at?: string
        }
        Update: {
          client_address?: string | null
          client_email_address?: string | null
          client_name?: string
          created_at?: string
          currency_code?: string
          deleted_at?: string | null
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_notes?: string | null
          invoice_number?: string
          invoice_status?: string
          legacy_id?: string | null
          organisation_id?: string
          payment_terms_days?: number
          show_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "invoices_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "invoices_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      itinerary_submission_files: {
        Row: {
          created_at: string
          file_id: string
          id: string
          itinerary_submission_id: string
          organisation_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          itinerary_submission_id: string
          organisation_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          itinerary_submission_id?: string
          organisation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_submission_files_file_fk"
            columns: ["file_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "itinerary_submission_files_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_submission_files_submission_fk"
            columns: ["itinerary_submission_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "itinerary_submissions"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      itinerary_submissions: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          organisation_id: string
          raw_scan_response: Json | null
          source_filename: string | null
          submission_status: string
          submitted_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          organisation_id: string
          raw_scan_response?: Json | null
          source_filename?: string | null
          submission_status?: string
          submitted_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          organisation_id?: string
          raw_scan_response?: Json | null
          source_filename?: string | null
          submission_status?: string
          submitted_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_submissions_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_coach_details: {
        Row: {
          coach_service_number: string | null
          created_at: string
          journey_id: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          coach_service_number?: string | null
          created_at?: string
          journey_id: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          coach_service_number?: string | null
          created_at?: string
          journey_id?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_coach_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_coach_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_coach_details_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_contacts: {
        Row: {
          contact_id: string
          contact_role: string
          created_at: string
          journey_id: string
          organisation_id: string
          sort_order: number
        }
        Insert: {
          contact_id: string
          contact_role?: string
          created_at?: string
          journey_id: string
          organisation_id: string
          sort_order?: number
        }
        Update: {
          contact_id?: string
          contact_role?: string
          created_at?: string
          journey_id?: string
          organisation_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "journey_contacts_contact_fk"
            columns: ["contact_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_contacts_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_contacts_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_ferry_details: {
        Row: {
          arrival_port_code: string | null
          created_at: string
          departure_port_code: string | null
          ferry_service_number: string | null
          journey_id: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          arrival_port_code?: string | null
          created_at?: string
          departure_port_code?: string | null
          ferry_service_number?: string | null
          journey_id: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          arrival_port_code?: string | null
          created_at?: string
          departure_port_code?: string | null
          ferry_service_number?: string | null
          journey_id?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_ferry_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_ferry_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_ferry_details_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_files: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_description: string | null
          file_id: string
          file_title: string | null
          file_type: string
          id: string
          journey_id: string
          organisation_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_description?: string | null
          file_id: string
          file_title?: string | null
          file_type?: string
          id?: string
          journey_id: string
          organisation_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_description?: string | null
          file_id?: string
          file_title?: string | null
          file_type?: string
          id?: string
          journey_id?: string
          organisation_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_files_file_fk"
            columns: ["file_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_files_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_files_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_files_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_flight_details: {
        Row: {
          arrival_airport_iata: string | null
          arrival_gate: string | null
          arrival_terminal: string | null
          created_at: string
          departure_airport_iata: string | null
          departure_gate: string | null
          departure_terminal: string | null
          flight_number: string | null
          journey_id: string
          organisation_id: string
          updated_at: string
        }
        Insert: {
          arrival_airport_iata?: string | null
          arrival_gate?: string | null
          arrival_terminal?: string | null
          created_at?: string
          departure_airport_iata?: string | null
          departure_gate?: string | null
          departure_terminal?: string | null
          flight_number?: string | null
          journey_id: string
          organisation_id: string
          updated_at?: string
        }
        Update: {
          arrival_airport_iata?: string | null
          arrival_gate?: string | null
          arrival_terminal?: string | null
          created_at?: string
          departure_airport_iata?: string | null
          departure_gate?: string | null
          departure_terminal?: string | null
          flight_number?: string | null
          journey_id?: string
          organisation_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_flight_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_flight_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_flight_details_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_ground_details: {
        Row: {
          arrangement: string | null
          created_at: string
          ground_transport_type: string | null
          journey_id: string
          organisation_id: string
          pickup_instructions: string | null
          preferred_method: string | null
          updated_at: string
          vehicle_details: string | null
        }
        Insert: {
          arrangement?: string | null
          created_at?: string
          ground_transport_type?: string | null
          journey_id: string
          organisation_id: string
          pickup_instructions?: string | null
          preferred_method?: string | null
          updated_at?: string
          vehicle_details?: string | null
        }
        Update: {
          arrangement?: string | null
          created_at?: string
          ground_transport_type?: string | null
          journey_id?: string
          organisation_id?: string
          pickup_instructions?: string | null
          preferred_method?: string | null
          updated_at?: string
          vehicle_details?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journey_ground_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_ground_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_ground_details_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_passengers: {
        Row: {
          booking_reference: string | null
          created_at: string
          id: string
          journey_id: string
          name: string | null
          organisation_id: string
          seat: string | null
          updated_at: string
        }
        Insert: {
          booking_reference?: string | null
          created_at?: string
          id?: string
          journey_id: string
          name?: string | null
          organisation_id: string
          seat?: string | null
          updated_at?: string
        }
        Update: {
          booking_reference?: string | null
          created_at?: string
          id?: string
          journey_id?: string
          name?: string | null
          organisation_id?: string
          seat?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_passengers_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_passengers_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_passengers_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_rail_details: {
        Row: {
          arrival_platform: string | null
          arrival_station_code: string | null
          created_at: string
          departure_platform: string | null
          departure_station_code: string | null
          journey_id: string
          organisation_id: string
          train_number: string | null
          updated_at: string
        }
        Insert: {
          arrival_platform?: string | null
          arrival_station_code?: string | null
          created_at?: string
          departure_platform?: string | null
          departure_station_code?: string | null
          journey_id: string
          organisation_id: string
          train_number?: string | null
          updated_at?: string
        }
        Update: {
          arrival_platform?: string | null
          arrival_station_code?: string | null
          created_at?: string
          departure_platform?: string | null
          departure_station_code?: string | null
          journey_id?: string
          organisation_id?: string
          train_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_rail_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_rail_details_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: true
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "journey_rail_details_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          arrival_at: string | null
          arrival_location_address: string | null
          arrival_location_kind: string | null
          arrival_location_name: string | null
          booking_reference: string | null
          created_at: string
          delay_description: string | null
          deleted_at: string | null
          departure_at: string | null
          departure_location_address: string | null
          departure_location_kind: string | null
          departure_location_name: string | null
          id: string
          is_done: boolean
          is_live_status: boolean
          journey_status: string | null
          journey_title: string | null
          journey_type: string
          legacy_id: string | null
          note_items: Json | null
          operator_name: string | null
          organisation_id: string
          related_show_id: string | null
          sort_order: number
          status_updated_at: string | null
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          arrival_at?: string | null
          arrival_location_address?: string | null
          arrival_location_kind?: string | null
          arrival_location_name?: string | null
          booking_reference?: string | null
          created_at?: string
          delay_description?: string | null
          deleted_at?: string | null
          departure_at?: string | null
          departure_location_address?: string | null
          departure_location_kind?: string | null
          departure_location_name?: string | null
          id?: string
          is_done?: boolean
          is_live_status?: boolean
          journey_status?: string | null
          journey_title?: string | null
          journey_type: string
          legacy_id?: string | null
          note_items?: Json | null
          operator_name?: string | null
          organisation_id: string
          related_show_id?: string | null
          sort_order?: number
          status_updated_at?: string | null
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          arrival_at?: string | null
          arrival_location_address?: string | null
          arrival_location_kind?: string | null
          arrival_location_name?: string | null
          booking_reference?: string | null
          created_at?: string
          delay_description?: string | null
          deleted_at?: string | null
          departure_at?: string | null
          departure_location_address?: string | null
          departure_location_kind?: string | null
          departure_location_name?: string | null
          id?: string
          is_done?: boolean
          is_live_status?: boolean
          journey_status?: string | null
          journey_title?: string | null
          journey_type?: string
          legacy_id?: string | null
          note_items?: Json | null
          operator_name?: string | null
          organisation_id?: string
          related_show_id?: string | null
          sort_order?: number
          status_updated_at?: string | null
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_show_fk"
            columns: ["related_show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "journeys_show_fk"
            columns: ["related_show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "journeys_show_fk"
            columns: ["related_show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "journeys_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "journeys_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      note_folders: {
        Row: {
          created_at: string
          deleted_at: string | null
          folder_name: string
          id: string
          legacy_id: string | null
          organisation_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          folder_name: string
          id?: string
          legacy_id?: string | null
          organisation_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          folder_name?: string
          id?: string
          legacy_id?: string | null
          organisation_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_folders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          created_at: string
          deleted_at: string | null
          folder_id: string | null
          folder_name: string | null
          id: string
          legacy_id: string | null
          note_body: string | null
          note_title: string | null
          organisation_id: string
          show_id: string | null
          sort_order: number
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          folder_name?: string | null
          id?: string
          legacy_id?: string | null
          note_body?: string | null
          note_title?: string | null
          organisation_id: string
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          folder_id?: string | null
          folder_name?: string | null
          id?: string
          legacy_id?: string | null
          note_body?: string | null
          note_title?: string | null
          organisation_id?: string
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_fk"
            columns: ["folder_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "note_folders"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "notes_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "notes_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "notes_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "notes_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "notes_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      organisation_billing_profiles: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          bank_account_name: string | null
          bank_account_number: string | null
          bank_iban: string | null
          bank_sort_code: string | null
          bank_swift_bic: string | null
          billing_email_address: string | null
          billing_name: string | null
          billing_phone_number: string | null
          city: string | null
          country_code: string | null
          created_at: string
          organisation_id: string
          payment_notes: string | null
          postal_code: string | null
          region: string | null
          tax_identifier: string | null
          updated_at: string
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_sort_code?: string | null
          bank_swift_bic?: string | null
          billing_email_address?: string | null
          billing_name?: string | null
          billing_phone_number?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          organisation_id: string
          payment_notes?: string | null
          postal_code?: string | null
          region?: string | null
          tax_identifier?: string | null
          updated_at?: string
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          bank_account_name?: string | null
          bank_account_number?: string | null
          bank_iban?: string | null
          bank_sort_code?: string | null
          bank_swift_bic?: string | null
          billing_email_address?: string | null
          billing_name?: string | null
          billing_phone_number?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          organisation_id?: string
          payment_notes?: string | null
          postal_code?: string | null
          region?: string | null
          tax_identifier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_billing_profiles_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_exchange_rates: {
        Row: {
          currency_code: string
          organisation_id: string
          rate_to_base: number
          updated_at: string
        }
        Insert: {
          currency_code: string
          organisation_id: string
          rate_to_base: number
          updated_at?: string
        }
        Update: {
          currency_code?: string
          organisation_id?: string
          rate_to_base?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_exchange_rates_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_invites: {
        Row: {
          accepted_at: string | null
          accepted_by_user_id: string | null
          created_at: string
          created_by_user_id: string
          email_address: string
          expires_at: string
          id: string
          invite_token: string
          invited_role: string
          organisation_id: string
          revoked_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id: string
          email_address: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_role: string
          organisation_id: string
          revoked_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by_user_id?: string | null
          created_at?: string
          created_by_user_id?: string
          email_address?: string
          expires_at?: string
          id?: string
          invite_token?: string
          invited_role?: string
          organisation_id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organisation_invites_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_members: {
        Row: {
          created_at: string
          joined_at: string
          member_role: string
          organisation_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          joined_at?: string
          member_role: string
          organisation_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          joined_at?: string
          member_role?: string
          organisation_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_members_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisation_settings: {
        Row: {
          account_type: string | null
          base_currency_code: string
          created_at: string
          home_airport_iata: string | null
          home_header_file_id: string | null
          invoice_default_terms_days: number
          invoice_next_sequence: number
          invoice_prefix: string
          organisation_id: string
          store_sequence: number
          updated_at: string
        }
        Insert: {
          account_type?: string | null
          base_currency_code?: string
          created_at?: string
          home_airport_iata?: string | null
          home_header_file_id?: string | null
          invoice_default_terms_days?: number
          invoice_next_sequence?: number
          invoice_prefix?: string
          organisation_id: string
          store_sequence?: number
          updated_at?: string
        }
        Update: {
          account_type?: string | null
          base_currency_code?: string
          created_at?: string
          home_airport_iata?: string | null
          home_header_file_id?: string | null
          invoice_default_terms_days?: number
          invoice_next_sequence?: number
          invoice_prefix?: string
          organisation_id?: string
          store_sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisation_settings_header_file_fk"
            columns: ["home_header_file_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "organisation_settings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          deleted_at: string | null
          id: string
          organisation_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          organisation_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          deleted_at?: string | null
          id?: string
          organisation_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      packing_list_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_done: boolean
          item_label: string
          organisation_id: string
          packing_list_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_done?: boolean
          item_label: string
          organisation_id: string
          packing_list_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_done?: boolean
          item_label?: string
          organisation_id?: string
          packing_list_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_list_items_list_fk"
            columns: ["packing_list_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "packing_lists"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "packing_list_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      packing_lists: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_archived: boolean
          is_organisation_template: boolean
          list_name: string
          organisation_id: string
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          is_organisation_template?: boolean
          list_name: string
          organisation_id: string
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_archived?: boolean
          is_organisation_template?: boolean
          list_name?: string
          organisation_id?: string
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "packing_lists_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "packing_lists_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "packing_lists_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      pending_show_imports: {
        Row: {
          created_at: string
          decision: string | null
          id: string
          initial_payload: Json | null
          itinerary_id: string
          organisation_id: string
          payload: Json | null
          show_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          decision?: string | null
          id?: string
          initial_payload?: Json | null
          itinerary_id: string
          organisation_id: string
          payload?: Json | null
          show_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          decision?: string | null
          id?: string
          initial_payload?: Json | null
          itinerary_id?: string
          organisation_id?: string
          payload?: Json | null
          show_id?: string | null
          status?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email_address: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_address?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email_address?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_dismissed: boolean
          is_fired: boolean
          journey_id: string | null
          organisation_id: string
          remind_at: string
          reminder_kind: string
          reminder_label: string
          show_id: string | null
          tour_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_dismissed?: boolean
          is_fired?: boolean
          journey_id?: string | null
          organisation_id: string
          remind_at: string
          reminder_kind?: string
          reminder_label: string
          show_id?: string | null
          tour_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_dismissed?: boolean
          is_fired?: boolean
          journey_id?: string | null
          organisation_id?: string
          remind_at?: string
          reminder_kind?: string
          reminder_label?: string
          show_id?: string | null
          tour_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "reminders_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "reminders_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "reminders_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "reminders_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "reminders_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "reminders_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      schedule_items: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          is_all_day: boolean
          is_done: boolean
          item_notes: string | null
          item_title: string
          legacy_id: string | null
          organisation_id: string
          schedule_item_type: string
          scheduled_date: string | null
          scheduled_end_date: string | null
          scheduled_end_time: string | null
          scheduled_time: string | null
          show_id: string | null
          sort_order: number
          tour_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_all_day?: boolean
          is_done?: boolean
          item_notes?: string | null
          item_title: string
          legacy_id?: string | null
          organisation_id: string
          schedule_item_type?: string
          scheduled_date?: string | null
          scheduled_end_date?: string | null
          scheduled_end_time?: string | null
          scheduled_time?: string | null
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_all_day?: boolean
          is_done?: boolean
          item_notes?: string | null
          item_title?: string
          legacy_id?: string | null
          organisation_id?: string
          schedule_item_type?: string
          scheduled_date?: string | null
          scheduled_end_date?: string | null
          scheduled_end_time?: string | null
          scheduled_time?: string | null
          show_id?: string | null
          sort_order?: number
          tour_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_items_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_items_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "schedule_items_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "schedule_items_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "schedule_items_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "schedule_items_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      show_advances: {
        Row: {
          access_notes: string | null
          catering_notes: string | null
          created_at: string
          curfew_notes: string | null
          dressing_room_notes: string | null
          general_remarks: string | null
          guestlist_notes: string | null
          navigation_address: string | null
          organisation_id: string
          parking_notes: string | null
          running_order: Json
          show_id: string
          soundcheck_notes: string | null
          stage_name: string | null
          updated_at: string
          wifi_notes: string | null
        }
        Insert: {
          access_notes?: string | null
          catering_notes?: string | null
          created_at?: string
          curfew_notes?: string | null
          dressing_room_notes?: string | null
          general_remarks?: string | null
          guestlist_notes?: string | null
          navigation_address?: string | null
          organisation_id: string
          parking_notes?: string | null
          running_order?: Json
          show_id: string
          soundcheck_notes?: string | null
          stage_name?: string | null
          updated_at?: string
          wifi_notes?: string | null
        }
        Update: {
          access_notes?: string | null
          catering_notes?: string | null
          created_at?: string
          curfew_notes?: string | null
          dressing_room_notes?: string | null
          general_remarks?: string | null
          guestlist_notes?: string | null
          navigation_address?: string | null
          organisation_id?: string
          parking_notes?: string | null
          running_order?: Json
          show_id?: string
          soundcheck_notes?: string | null
          stage_name?: string | null
          updated_at?: string
          wifi_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "show_advances_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_advances_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_advances_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      show_contacts: {
        Row: {
          company_id: string | null
          contact_id: string | null
          contact_notes: string | null
          contact_role: string
          created_at: string
          id: string
          is_primary: boolean
          organisation_id: string
          show_id: string
          sort_order: number
        }
        Insert: {
          company_id?: string | null
          contact_id?: string | null
          contact_notes?: string | null
          contact_role?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          organisation_id: string
          show_id: string
          sort_order?: number
        }
        Update: {
          company_id?: string | null
          contact_id?: string | null
          contact_notes?: string | null
          contact_role?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          organisation_id?: string
          show_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "show_contacts_company_fk"
            columns: ["company_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "show_contacts_contact_fk"
            columns: ["contact_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "show_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_contacts_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_contacts_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_contacts_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      show_expenses: {
        Row: {
          created_at: string
          currency_code: string
          deleted_at: string | null
          expense_amount: number
          expense_label: string
          expense_notes: string | null
          id: string
          organisation_id: string
          show_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_code: string
          deleted_at?: string | null
          expense_amount: number
          expense_label: string
          expense_notes?: string | null
          id?: string
          organisation_id: string
          show_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_code?: string
          deleted_at?: string | null
          expense_amount?: number
          expense_label?: string
          expense_notes?: string | null
          id?: string
          organisation_id?: string
          show_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_expenses_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_expenses_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_expenses_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_expenses_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      show_files: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_description: string | null
          file_id: string
          file_title: string | null
          file_type: string
          id: string
          organisation_id: string
          show_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_description?: string | null
          file_id: string
          file_title?: string | null
          file_type?: string
          id?: string
          organisation_id: string
          show_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_description?: string | null
          file_id?: string
          file_title?: string | null
          file_type?: string
          id?: string
          organisation_id?: string
          show_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_files_file_fk"
            columns: ["file_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "show_files_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_files_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_files_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_files_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      show_financials: {
        Row: {
          agreed_fee_amount: number | null
          commission_percent: number | null
          created_at: string
          currency_code: string | null
          deal_type: string | null
          financial_notes: string | null
          is_estimated: boolean
          is_not_disclosed: boolean
          is_paid: boolean
          organisation_id: string
          per_diem_amount: number | null
          show_id: string
          updated_at: string
        }
        Insert: {
          agreed_fee_amount?: number | null
          commission_percent?: number | null
          created_at?: string
          currency_code?: string | null
          deal_type?: string | null
          financial_notes?: string | null
          is_estimated?: boolean
          is_not_disclosed?: boolean
          is_paid?: boolean
          organisation_id: string
          per_diem_amount?: number | null
          show_id: string
          updated_at?: string
        }
        Update: {
          agreed_fee_amount?: number | null
          commission_percent?: number | null
          created_at?: string
          currency_code?: string | null
          deal_type?: string | null
          financial_notes?: string | null
          is_estimated?: boolean
          is_not_disclosed?: boolean
          is_paid?: boolean
          organisation_id?: string
          per_diem_amount?: number | null
          show_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_financials_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "outstanding_payments"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_financials_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "show_overview"
            referencedColumns: ["show_id", "organisation_id"]
          },
          {
            foreignKeyName: "show_financials_show_fk"
            columns: ["show_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      shows: {
        Row: {
          color_key: string | null
          content_plan: string | null
          created_at: string
          deleted_at: string | null
          event_name: string | null
          id: string
          internal_notes: Json | null
          is_set_done: boolean
          legacy_id: string | null
          no_accommodation: boolean
          organisation_id: string
          primary_artist_id: string | null
          set_end_date: string | null
          set_end_time: string | null
          set_start_date: string | null
          set_start_time: string | null
          show_date: string
          show_status: string
          show_timezone_snapshot: string | null
          text_color_key: string | null
          tour_id: string | null
          updated_at: string
          venue_arrival_time: string | null
          venue_id: string | null
          venue_name: string | null
        }
        Insert: {
          color_key?: string | null
          content_plan?: string | null
          created_at?: string
          deleted_at?: string | null
          event_name?: string | null
          id?: string
          internal_notes?: Json | null
          is_set_done?: boolean
          legacy_id?: string | null
          no_accommodation?: boolean
          organisation_id: string
          primary_artist_id?: string | null
          set_end_date?: string | null
          set_end_time?: string | null
          set_start_date?: string | null
          set_start_time?: string | null
          show_date: string
          show_status?: string
          show_timezone_snapshot?: string | null
          text_color_key?: string | null
          tour_id?: string | null
          updated_at?: string
          venue_arrival_time?: string | null
          venue_id?: string | null
          venue_name?: string | null
        }
        Update: {
          color_key?: string | null
          content_plan?: string | null
          created_at?: string
          deleted_at?: string | null
          event_name?: string | null
          id?: string
          internal_notes?: Json | null
          is_set_done?: boolean
          legacy_id?: string | null
          no_accommodation?: boolean
          organisation_id?: string
          primary_artist_id?: string | null
          set_end_date?: string | null
          set_end_time?: string | null
          set_start_date?: string | null
          set_start_time?: string | null
          show_date?: string
          show_status?: string
          show_timezone_snapshot?: string | null
          text_color_key?: string | null
          tour_id?: string | null
          updated_at?: string
          venue_arrival_time?: string | null
          venue_id?: string | null
          venue_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_artist_fk"
            columns: ["primary_artist_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "artists"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "shows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "shows_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "shows_venue_fk"
            columns: ["venue_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      tour_contacts: {
        Row: {
          contact_id: string
          contact_role: string
          created_at: string
          is_primary: boolean
          organisation_id: string
          sort_order: number
          tour_id: string
        }
        Insert: {
          contact_id: string
          contact_role?: string
          created_at?: string
          is_primary?: boolean
          organisation_id: string
          sort_order?: number
          tour_id: string
        }
        Update: {
          contact_id?: string
          contact_role?: string
          created_at?: string
          is_primary?: boolean
          organisation_id?: string
          sort_order?: number
          tour_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_contacts_contact_fk"
            columns: ["contact_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "tour_contacts_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_contacts_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tour_overview"
            referencedColumns: ["tour_id", "organisation_id"]
          },
          {
            foreignKeyName: "tour_contacts_tour_fk"
            columns: ["tour_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id", "organisation_id"]
          },
        ]
      }
      tours: {
        Row: {
          color_key: string | null
          created_at: string
          deleted_at: string | null
          end_date: string | null
          id: string
          is_archived: boolean
          legacy_id: string | null
          organisation_id: string
          start_date: string | null
          tour_name: string
          tour_notes: string | null
          updated_at: string
        }
        Insert: {
          color_key?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean
          legacy_id?: string | null
          organisation_id: string
          start_date?: string | null
          tour_name: string
          tour_notes?: string | null
          updated_at?: string
        }
        Update: {
          color_key?: string | null
          created_at?: string
          deleted_at?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean
          legacy_id?: string | null
          organisation_id?: string
          start_date?: string | null
          tour_name?: string
          tour_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tours_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_tickets: {
        Row: {
          created_at: string
          deleted_at: string | null
          file_id: string | null
          id: string
          journey_id: string
          legacy_id: string | null
          organisation_id: string
          passenger_name: string | null
          seat_number: string | null
          sort_order: number
          ticket_description: string | null
          ticket_reference: string | null
          ticket_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          file_id?: string | null
          id?: string
          journey_id: string
          legacy_id?: string | null
          organisation_id: string
          passenger_name?: string | null
          seat_number?: string | null
          sort_order?: number
          ticket_description?: string | null
          ticket_reference?: string | null
          ticket_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          file_id?: string | null
          id?: string
          journey_id?: string
          legacy_id?: string | null
          organisation_id?: string
          passenger_name?: string | null
          seat_number?: string | null
          sort_order?: number
          ticket_description?: string | null
          ticket_reference?: string | null
          ticket_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_tickets_file_fk"
            columns: ["file_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "travel_tickets_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id", "organisation_id"]
          },
          {
            foreignKeyName: "travel_tickets_journey_fk"
            columns: ["journey_id", "organisation_id"]
            isOneToOne: false
            referencedRelation: "travel_schedule"
            referencedColumns: ["journey_id", "organisation_id"]
          },
          {
            foreignKeyName: "travel_tickets_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          id: string
          last_open_tab: string | null
          organisation_id: string
          ui_preferences: Json
          updated_at: string
          usb_reminder_enabled: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_open_tab?: string | null
          organisation_id: string
          ui_preferences?: Json
          updated_at?: string
          usb_reminder_enabled?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_open_tab?: string | null
          organisation_id?: string
          ui_preferences?: Json
          updated_at?: string
          usb_reminder_enabled?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      venues: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          country_code: string | null
          created_at: string
          deleted_at: string | null
          id: string
          latitude: number | null
          legacy_id: string | null
          longitude: number | null
          organisation_id: string
          postal_code: string | null
          region: string | null
          updated_at: string
          venue_name: string
          venue_notes: string | null
          venue_timezone: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          legacy_id?: string | null
          longitude?: number | null
          organisation_id: string
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          venue_name: string
          venue_notes?: string | null
          venue_timezone?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          latitude?: number | null
          legacy_id?: string | null
          longitude?: number | null
          organisation_id?: string
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          venue_name?: string
          venue_notes?: string | null
          venue_timezone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "venues_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      hotel_schedule: {
        Row: {
          booking_reference: string | null
          check_in_date: string | null
          check_out_date: string | null
          hotel_booking_id: string | null
          hotel_name: string | null
          is_done: boolean | null
          linked_show_dates: string[] | null
          organisation_id: string | null
          tour_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hotel_bookings_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      outstanding_payments: {
        Row: {
          agreed_fee_amount: number | null
          currency_code: string | null
          is_paid: boolean | null
          organisation_id: string | null
          show_date: string | null
          show_id: string | null
          venue_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      show_overview: {
        Row: {
          artist_name: string | null
          city: string | null
          country_code: string | null
          organisation_id: string | null
          set_end_time: string | null
          set_start_time: string | null
          show_date: string | null
          show_id: string | null
          show_status: string | null
          show_timezone_snapshot: string | null
          tour_name: string | null
          venue_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shows_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_overview: {
        Row: {
          end_date: string | null
          is_archived: boolean | null
          organisation_id: string | null
          show_count: number | null
          start_date: string | null
          tour_id: string | null
          tour_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tours_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_schedule: {
        Row: {
          arrival_at: string | null
          arrival_location_name: string | null
          coach_service_number: string | null
          departure_at: string | null
          departure_location_name: string | null
          ferry_service_number: string | null
          flight_number: string | null
          is_done: boolean | null
          journey_id: string | null
          journey_status: string | null
          journey_title: string | null
          journey_type: string | null
          organisation_id: string | null
          related_show_date: string | null
          tour_name: string | null
          train_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "journeys_organisation_id_fkey"
            columns: ["organisation_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_organisation_invite_v2: {
        Args: { p_invite_token: string }
        Returns: string
      }
      create_organisation_v2: {
        Args: { p_organisation_name: string }
        Returns: string
      }
      infer_ground_transport_type: { Args: { src: string }; Returns: string }
      journey_passenger_uuid: {
        Args: { p_journey_id: string; p_raw_id: string }
        Returns: string
      }
      user_can_write_org: { Args: { p_org_id: string }; Returns: boolean }
      user_org_ids: { Args: never; Returns: string[] }
      v2_can_manage_organisation: {
        Args: { p_organisation_id: string }
        Returns: boolean
      }
      v2_is_organisation_member: {
        Args: { p_organisation_id: string }
        Returns: boolean
      }
      v2_is_organisation_owner: {
        Args: { p_organisation_id: string }
        Returns: boolean
      }
      v2_storage_path_organisation_id: {
        Args: { p_storage_path: string }
        Returns: string
      }
      v2_users_share_organisation: {
        Args: { p_other_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
