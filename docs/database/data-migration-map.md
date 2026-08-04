# Operate — Data Migration Map (Revision 2)

Maps current application fields to the **revision 2** target schema.  
Action codes: **DIRECT** | **TRANSFORM** | **SPLIT** | **TEMP** | **OBSOLETE** | **DEFERRED**

---

## Root store

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `store._seq` | `organisation_settings.store_sequence` | DIRECT | |
| `store._known` | device sync metadata | TEMP | Tombstones on `deleted_at` later |
| `store.activeTripId` | **device-local** (not org Postgres) | TRANSFORM | Was wrongly in `org_settings`; optional future `user_preferences` |
| `store.activeShowId` | **device-local** Trip Mode anchor | TRANSFORM | Same |
| `store.tab` | **device-local** or `user_preferences.last_open_tab` | TRANSFORM | Not org-wide setting |
| `store.drivers[]`, `store.hotels[]` | — | OBSOLETE | Unused seed keys |

---

## Settings split

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `settings.baseCurrency` | `organisation_settings.base_currency_code` | DIRECT | |
| `settings.fx.*` | `organisation_exchange_rates` | SPLIT | |
| `settings.billing.*` | `organisation_billing_profiles` | DIRECT | |
| `settings.invoicePrefix/Seq/Terms` | `organisation_settings` | DIRECT | |
| `settings.accountType` | `organisation_settings.account_type` | DIRECT | |
| `settings.homeAirport` | `organisation_settings.home_airport_iata` | DIRECT | |
| `settings.homeHeader` | `files` + `organisation_settings.home_header_file_id` | TRANSFORM | |
| `settings.security.*` | **device-local only** | OBSOLETE | No raw PIN in Supabase |
| `settings.usbReminder` | `organisation_settings.usb_reminder_enabled` | DIRECT | |
| `settings.packingTemplate` | `packing_lists` (is_organisation_template=true) + items | TRANSFORM | Not JSON |
| UI preferences | `user_preferences.ui_preferences` | TRANSFORM | JSON allowed |

---

## Artists and tours

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `artists[]` | `artists` | TRANSFORM | |
| `show.artist` string | `shows.primary_artist_id` | TRANSFORM | Match/create artist |
| `trip.id` | `tours.legacy_id` | DIRECT | |
| `trip.name` | `tours.tour_name` | DIRECT | |
| `trip.start` / `trip.startDate` | `tours.start_date` | TRANSFORM | **Normalise naming** |
| `trip.end` / `trip.endDate` | `tours.end_date` | TRANSFORM | |
| `trip.archived` | `tours.is_archived` | DIRECT | |
| `trip.checklist/timeline/emergency` | `tour_checklist_items`, `show_schedule_items` (if timed), `tour_contacts` | TRANSFORM | Emergency → contacts |
| computed `runs()` | frontend only | OBSOLETE | Not persisted |
| `show.tripId` | `shows.tour_id` | TRANSFORM | UUID FK |
| multi-artist b2b | `show_artists` | **DEFERRED** | |

---

## Shows — core

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `show.id` | `shows.legacy_id` + UUID | TRANSFORM | |
| `show.venue/city/country/venueAddr` | `venues` + `shows.venue_id` | TRANSFORM | Dedupe venues |
| `show.date` | `shows.show_date` | DIRECT | |
| `show.setTime/endTime/arrival` | `set_start_time`, `set_end_time`, `venue_arrival_time` | DIRECT | |
| `show.status/color` | `show_status`, `color_key` | DIRECT | |
| `show.notes/content/setDone` | `internal_notes`, `content_plan`, `is_set_done` | DIRECT | |
| `show.flightNo/terminal/gate/fstatus/delay/fiUpdated/fiLive` | primary `flight_journeys` row | TRANSFORM | Not on shows table |

---

## Show schedules (unified)

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `show.timeline[]` | `show_schedule_items` | TRANSFORM | Map title → item_title, time → scheduled_time |
| `show.advance.schedule[]` | `show_schedule_items` | TRANSFORM | Types: soundcheck, doors, custom |
| `advance.soundcheck/curfew` (text) | `show_schedule_items` OR `show_advances.*_notes` | TRANSFORM | Prefer schedule row if timed |
| `marker` logistics | `show_schedule_items` | TRANSFORM | type = calendar_marker |
| `show.checklist[]` | `show_checklist_items` | DIRECT | **Separate from schedule** |
| `show.advance.*` text fields | `show_advances` | DIRECT | Including guestlist_notes text |
| `show.advance.guestlist` | `show_advances.guestlist_notes` | TEMP | **DEFERRED** normalisation |

---

## Hotels (not journeys)

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `show.hotel.*` | `hotels` + `hotel_bookings` + `hotel_booking_shows` | TRANSFORM | One show link in junction |
| `stay` logistics leg | `hotel_bookings` + junction | TRANSFORM | **Not a journey** |
| multi-show hotel stay | `hotel_booking_shows` (multiple rows) | TRANSFORM | Optional `tour_id` on booking |

---

## Journeys (movement only)

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `show.flights[]` | `journeys` + `flight_journeys` | TRANSFORM | `related_show_id` set |
| `travel` leg icon=plane | `journeys` + `flight_journeys` | TRANSFORM | Dedupe vs embedded flight |
| `travel` icon=car | `journeys` + `ground_transfers` | TRANSFORM | |
| `travel` icon=ferry | `journeys` + `ferry_journeys` | TRANSFORM | |
| `travel` icon=walk | `journeys` (kind=walk) + ground_transfers | TRANSFORM | |
| rail in imports | `journeys` + `rail_journeys` | TRANSFORM | |
| `travel.showId` | `journeys.related_show_id` | TRANSFORM | **Optional** |
| `travel.tourId` (implicit) | `journeys.tour_id` | TRANSFORM | From show.tour_id if needed |
| `show.drivers[]` | `ground_transfers` + `ground_transfer_contacts` | TRANSFORM | Not journeys alone |
| `travel.driverName/phone` | `contacts` + ground_transfer_contacts | TRANSFORM | |
| `travel.done` / `flight.done` | `journeys.is_done` | DIRECT | |
| `show_flights` table (Supabase) | `journeys` + `flight_journeys` | OBSOLETE | Single flight model |

---

## Contacts and companies

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `store.contacts[]` | `contacts` | TRANSFORM | |
| `contact.company` string | `companies` + `company_contacts` | TRANSFORM | Many-to-many |
| `show.contacts[]` | `contacts` + `show_contacts` | TRANSFORM | |
| `show.promoter` | `contacts` and/or `companies` + `show_contacts` | TRANSFORM | role = artist_liaison |
| `trip.emergency[]` | `contacts` + `tour_contacts` | TRANSFORM | role = emergency |

---

## Files and boarding passes

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `attachment.*` | `files` + `show_files` | TRANSFORM | |
| `flight.passes[]` | `files` + `boarding_passes` | TRANSFORM | journey_id + file_id only |
| `travel.passes[]` | `files` + `boarding_passes` | TRANSFORM | No journey_files duplicate |
| `flight.seat` | `boarding_passes.seat_number` | TRANSFORM | **Not on flight_journeys** |
| other travel PDFs | `files` + `journey_files` | TRANSFORM | Non-pass purposes |
| itinerary imgs | `files` + `itinerary_submission_files` | TRANSFORM | |

---

## Finance

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `show.finance.fee` | `show_financials.agreed_fee_amount` | TRANSFORM | Crew cannot SELECT |
| `show.finance.*` (except expenses) | `show_financials` columns | DIRECT | |
| `show.finance.expenses[]` | `show_expenses` | SPLIT | |
| income ledger | — | **DEFERRED** | No show_income table |
| payments ledger | — | **DEFERRED** | No show_payments table |

---

## Invoices

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `invoices[].eventId` | `invoices.show_id` | TRANSFORM | App: one invoice per show |
| `invoices[].lines[]` | `invoice_line_items` | SPLIT | |
| multi-show invoice | `invoice_shows` | **DEFERRED** | Not in current app |

---

## Packing

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `store.packing[]` | `packing_list_items` on org template list | TRANSFORM | |
| `settings.packingTemplate` | seed items on template `packing_lists` | TRANSFORM | |
| `trip.packing[]` | — | OBSOLETE | Unused by Tour Mode |

---

## Reminders

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `store.reminders[]` | `reminders` | TRANSFORM | Add `user_id` — user-specific |
| `reminder.showId` | `reminders.show_id` | DIRECT | Optional tour/journey later |
| `reminder.kind/at/label/fired` | same columns | DIRECT | |

---

## Ideas and notes

| Current location | Proposed destination | Action | Notes |
|------------------|----------------------|--------|-------|
| `ideas.*` | `ideas` (enhanced) | TRANSFORM | `prio` → `priority_level` |
| `notes.*` | `notes` (enhanced) | TRANSFORM | |

---

## Deferred mappings (no immediate target table)

| Current location | Future destination | Action |
|------------------|-------------------|--------|
| `show.advance.guestlist` (structured guests) | `guest_list_entries` | **DEFERRED** |
| b2b second artist | `show_artists` | **DEFERRED** |
| per-room hotel guests | `hotel_booking_guests` | **DEFERRED** |

---

## Supabase columns retired after migration

| Current column | Replacement |
|----------------|-------------|
| `shows.hotel`, `driver`, `promoter`, `finance`, `advance`, `show_contacts` | Relational tables |
| `shows.flight_no`, terminal, gate (show-level) | `flight_journeys` |
| `org_settings.contacts`, `invoices`, `itineraries`, `packing`, `artists` | Normal tables |
| `org_settings.active_trip_id`, `active_show_id`, `tab` | Device / user_preferences |
| `logistics_items` (travel/stay/marker) | `journeys`, `hotel_bookings`, `show_schedule_items` |
| `show_flights`, `show_flight_passes` | `journeys`, `boarding_passes` |
| `show_timeline_steps` | `show_schedule_items` |
| `trips.checklist`, `timeline`, `emergency` JSON | Relational tour/show tables |

No field is silently dropped — obsolete JSON columns remain until verification phase (Step 2+).

---

## Revision 2 mapping changes from revision 1

| Revision 1 target | Revision 2 target | Reason |
|-------------------|-------------------|--------|
| `journeys.show_id` required | `journeys.related_show_id` optional | Journeys not forced to one show |
| Hotel as journey subtype | `hotel_bookings` | Stays are not movement |
| Markers as logistics_items | `show_schedule_items` | Unified schedule |
| Three schedule tables | One `show_schedule_items` | Remove overlap |
| `contacts.company_id` | `company_contacts` | Many companies per contact |
| `journey_files` for passes | `boarding_passes` only | No duplicate link |
| Seat on `flight_journeys` | `boarding_passes.seat_number` | |
| Org tab/PIN in settings | device-local | |
| `packing` JSON | `packing_lists` | |
| `show_income`, `show_payments` | removed | Not in app |
| `invoice_shows` | removed | One show per invoice |
| `show_artists` immediate | deferred | |
