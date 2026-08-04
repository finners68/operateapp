# Operate — Data Migration Map

Maps every current field to its proposed destination.  
**Action codes:** DIRECT | TRANSFORM | SPLIT | TEMP | OBSOLETE | DECIDE

---

## Root store

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `store._seq` | `organisation_settings.store_sequence` | DIRECT | Rename |
| `store._known` | sync metadata (client) | TEMP | Replace with tombstone protocol later |
| `store.activeTripId` | `organisation_settings.active_tour_id` | TRANSFORM | Resolve legacy_id → tours.id UUID |
| `store.activeShowId` | `organisation_settings.active_show_id` | TRANSFORM | Resolve legacy_id → shows.id UUID |
| `store.tab` | `organisation_settings.last_tab` | DIRECT | UI preference |
| `store.drivers[]` | — | OBSOLETE | Unused seed key |
| `store.hotels[]` | — | OBSOLETE | Unused seed key |

---

## Settings

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `settings.artistName` | `artists.display_name` (is_default=true) | TRANSFORM | Create default artist row |
| `settings.packingTemplate` | `organisation_settings.packing_template` | DIRECT | Keep JSON template |
| `settings.baseCurrency` | `organisation_settings.base_currency_code` | DIRECT | |
| `settings.baseCurrencyAuto` | app logic | TEMP | Derive from home_airport in app until setting stored |
| `settings.fx.*` | `organisation_exchange_rates` | SPLIT | One row per currency code |
| `settings.billing.name` | `organisation_billing_profiles.billing_name` | DIRECT | |
| `settings.billing.address` | `organisation_billing_profiles.billing_address` | DIRECT | |
| `settings.billing.taxId` | `organisation_billing_profiles.tax_identifier` | DIRECT | |
| `settings.billing.iban` | `organisation_billing_profiles.bank_iban` | DIRECT | |
| `settings.billing.email` | `organisation_billing_profiles.billing_email` | DIRECT | |
| `settings.invoicePrefix` | `organisation_settings.invoice_prefix` | DIRECT | |
| `settings.invoiceSeq` | `organisation_settings.invoice_next_sequence` | DIRECT | |
| `settings.invoiceTerms` | `organisation_settings.invoice_default_terms_days` | DIRECT | |
| `settings.accountType` | `organisation_settings.account_type` | DIRECT | |
| `settings.homeAirport` | `organisation_settings.home_airport_iata` | DIRECT | |
| `settings.homeHeader` | `files` + `organisation_settings.home_header_file_id` | TRANSFORM | Create file row from storage path |
| `settings._homeHeaderPath` | `files.storage_path` | TRANSFORM | |
| `settings._homeHeaderUrl` | — | OBSOLETE | Runtime cache only |
| `settings.security.enabled` | `organisation_security_settings.is_passcode_enabled` | DIRECT | |
| `settings.security.pin` | `organisation_security_settings.passcode_hash` | DIRECT | |
| `settings.security.scope` | `organisation_security_settings.lock_scope` | DIRECT | |
| `settings.security.biometric` | `organisation_security_settings.is_biometric_enabled` | DIRECT | |
| `settings.usbReminder` | `organisation_settings.usb_reminder_enabled` | DIRECT | |

---

## Artists

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `artists[].id` | `artists.legacy_id` | DIRECT | |
| `artists[].name` | `artists.display_name` | DIRECT | |
| `show.artist` (string) | `shows.primary_artist_id` | TRANSFORM | Match or create artist by name |

---

## Shows — core fields

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.id` | `shows.legacy_id` + new UUID | TRANSFORM | |
| `show.kind` | implied (shows table) | DIRECT | |
| `show.tripId` | `shows.tour_id` | TRANSFORM | legacy_id → UUID |
| `show.status` | `shows.show_status` | DIRECT | |
| `show.color` | `shows.color_key` | DIRECT | |
| `show.venue` | `venues.venue_name` + `shows.venue_id` | TRANSFORM | Dedupe venues by normalised name+city |
| `show.city` | `venues.city_name` | TRANSFORM | |
| `show.country` | `venues.country_code` | TRANSFORM | |
| `show.date` | `shows.show_date` | DIRECT | |
| `show.setTime` | `shows.set_start_time` | DIRECT | |
| `show.endTime` | `shows.set_end_time` | DIRECT | |
| `show.arrival` | `shows.venue_arrival_time` | DIRECT | |
| `show.venueAddr` | `venues.address_line` | TRANSFORM | |
| `show.notes` | `shows.internal_notes` | DIRECT | |
| `show.content` | `shows.content_plan` | DIRECT | |
| `show.setDone` | `shows.is_set_done` | DIRECT | |
| `show.flightNo` | `flight_journeys.flight_number` OR drop | DECIDE | Prefer journey row; show-level legacy widget |
| `show.terminal` | `flight_journeys.terminal_name` | TRANSFORM | Link to primary flight journey |
| `show.gate` | `flight_journeys.gate_name` | TRANSFORM | |
| `show.fstatus` | `flight_journeys.flight_status` | TRANSFORM | |
| `show.delay` | `flight_journeys.delay_description` | TRANSFORM | |
| `show.fiUpdated` | `flight_journeys.status_updated_at` | TRANSFORM | ms → timestamptz |
| `show.fiLive` | `flight_journeys.is_live_status` | TRANSFORM | |

---

## Shows — hotel

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.hotel.name` | `hotels.hotel_name` | TRANSFORM | Create/reuse hotel |
| `show.hotel.address` | `hotels.address_line` | TRANSFORM | |
| `show.hotel.postcode` | `hotels.postcode` | TRANSFORM | |
| `show.hotel.checkin` | `hotel_bookings.check_in_date` | TRANSFORM | Create booking linked to show |
| `show.hotel.checkout` | `hotel_bookings.check_out_date` | TRANSFORM | |
| `show.hotel.conf` | `hotel_bookings.booking_reference` | TRANSFORM | |
| `show.hotel.notes` | `hotel_bookings.room_notes` | TRANSFORM | |
| `show.hotel.done` | `hotel_bookings.is_done` | TRANSFORM | |
| `stay.place` (logistics) | `hotels.hotel_name` | TRANSFORM | Merge duplicate hotel sources |
| `stay.addr` | `hotels.address_line` | TRANSFORM | |
| `stay.bookingRef` | `hotel_bookings.booking_reference` | TRANSFORM | |
| `stay.info` (check-in) | `hotel_bookings.room_notes` OR journey title | TRANSFORM | |
| `stay` leg row | `journeys` + `hotel_stays` | TRANSFORM | kind=hotel_stay |

---

## Shows — finance

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.finance.fee` | `show_financials.agreed_fee_amount` | TRANSFORM | numeric |
| `show.finance.currency` | `show_financials.currency_code` | DIRECT | |
| `show.finance.dealType` | `show_financials.deal_type` | DIRECT | |
| `show.finance.commission` | `show_financials.commission_percent` | DIRECT | |
| `show.finance.perDiem` | `show_financials.per_diem_amount` | DIRECT | |
| `show.finance.paid` | `show_financials.is_paid` | DIRECT | |
| `show.finance.estimated` | `show_financials.is_estimated` | DIRECT | |
| `show.finance.notDisclosed` | `show_financials.is_not_disclosed` | DIRECT | |
| `show.finance.expenses[]` | `show_expenses` rows | SPLIT | One row per expense |
| `show.finance.expenses[].id` | `show_expenses.id` (new UUID) | TRANSFORM | legacy_id optional |
| `show.finance.expenses[].label` | `show_expenses.expense_label` | DIRECT | |
| `show.finance.expenses[].amount` | `show_expenses.expense_amount` | DIRECT | |

---

## Shows — promoter and contacts

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.promoter.name` | `contacts.display_name` | TRANSFORM | Create contact |
| `show.promoter.phone` | `contacts.phone_number` | TRANSFORM | |
| `show.promoter.whatsapp` | `contacts.whatsapp_number` | TRANSFORM | |
| — | `show_contacts` (role=artist_liaison) | TRANSFORM | Junction row |
| `show.contacts[].name` | `contacts.display_name` | TRANSFORM | Dedupe by phone+name |
| `show.contacts[].role` | `show_contacts.contact_role` | DIRECT | |
| `show.contacts[].phone` | `contacts.phone_number` | TRANSFORM | |
| `show.contacts[].whatsapp` | `contacts.whatsapp_number` | TRANSFORM | |
| `store.contacts[]` | `contacts` + optional `companies` | TRANSFORM | Global rolodex |

---

## Shows — drivers

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.drivers[].journey` | `ground_transfers.route_description` | TRANSFORM | + journeys row |
| `show.drivers[].time` | `ground_transfers.scheduled_pickup_time` | TRANSFORM | |
| `show.drivers[].name` | `contacts.display_name` | TRANSFORM | |
| `show.drivers[].phone` | `contacts.phone_number` | TRANSFORM | |
| `show.drivers[].whatsapp` | `contacts.whatsapp_number` | TRANSFORM | |
| `show.drivers[].pickup` | `ground_transfers.pickup_location` | TRANSFORM | |
| `show.drivers[].notes` | `ground_transfers.transfer_notes` | TRANSFORM | |
| `show.drivers[].noGround` | `ground_transfers.is_self_arranged` | DIRECT | |
| `show.drivers[].done` | `journeys.is_done` | TRANSFORM | |
| `travel.driverName` | `contacts` + `ground_transfer_assignments` | TRANSFORM | Calendar driver legs |
| `travel.phone/whatsapp` | `contacts` | TRANSFORM | |

---

## Shows — advance

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.advance.stage` | `show_advances.stage_name` | DIRECT | |
| `show.advance.access` | `show_advances.access_notes` | DIRECT | |
| `show.advance.soundcheck` | `show_advances.soundcheck_notes` | DIRECT | |
| `show.advance.curfew` | `show_advances.curfew_notes` | DIRECT | |
| `show.advance.dressingRoom` | `show_advances.dressing_room_notes` | DIRECT | |
| `show.advance.guestlist` | `show_advances.guestlist_notes` | TEMP | Text until guest_list_entries |
| `show.advance.catering` | `show_advances.catering_notes` | DIRECT | |
| `show.advance.parking` | `show_advances.parking_notes` | DIRECT | |
| `show.advance.wifi` | `show_advances.wifi_notes` | DIRECT | |
| `show.advance.navAddr` | `show_advances.navigation_address` | DIRECT | |
| `show.advance.remarks` | `show_advances.general_remarks` | DIRECT | |
| `show.advance.schedule[]` | `show_advance_schedule_items` | SPLIT | One row per entry |
| `show.advance.schedule[].time` | `show_advance_schedule_items.scheduled_time` | DIRECT | |
| `show.advance.schedule[].label` | `show_advance_schedule_items.item_label` | DIRECT | |

---

## Shows — embedded flights

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.flights[].id` | `journeys.legacy_id` | TRANSFORM | |
| `show.flights[].code` | `flight_journeys.flight_number` | DIRECT | |
| `show.flights[].from` | `flight_journeys.departure_airport_iata` | DIRECT | |
| `show.flights[].to` | `flight_journeys.arrival_airport_iata` | DIRECT | |
| `show.flights[].dep` | `flight_journeys.departure_at` | TRANSFORM | Parse `YYYY-MM-DD HH:mm` → timestamptz |
| `show.flights[].arr` | `flight_journeys.arrival_at` | TRANSFORM | |
| `show.flights[].seat` | `flight_journeys.seat_number` | DIRECT | |
| `show.flights[].done` | `journeys.is_done` | DIRECT | |
| `show.flights[].passes[]` | `boarding_passes` + `files` | TRANSFORM | |

---

## Logistics — travel legs

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `travel.id` | `journeys.legacy_id` | TRANSFORM | |
| `travel.showId` | `journeys.show_id` | TRANSFORM | |
| `travel.date` | `journeys.journey_date` | DIRECT | |
| `travel.icon=plane` | `journeys.journey_kind=flight` | TRANSFORM | |
| `travel.icon=car` | `journeys.journey_kind=ground_transfer` | TRANSFORM | |
| `travel.icon=ferry` | `journeys.journey_kind=ferry` | TRANSFORM | |
| `travel.icon=walk` | `journeys.journey_kind=walk` | TRANSFORM | |
| `travel.from/to` | `flight_journeys` OR route on ground | TRANSFORM | By kind |
| `travel.flightNo` | `flight_journeys.flight_number` | DIRECT | |
| `travel.start/end` | departure/arrival times | TRANSFORM | Combine with date |
| `travel.info` JSON v2 | respective typed columns | TRANSFORM | unpackLogisticInfo |
| `travel.passes[]` | `boarding_passes` / `journey_files` | TRANSFORM | |
| `travel.done` | `journeys.is_done` | DIRECT | |
| `marker.*` | `show_schedule_items` | TRANSFORM | kind=marker |

---

## Checklists and timelines

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.checklist[]` | `show_checklist_items` | DIRECT | Already relational; add UUID PK |
| `show.timeline[]` | `show_timeline_steps` | DIRECT | Already relational |
| `trip.checklist[]` | `tour_checklist_items` | TRANSFORM | From JSON to rows |
| `trip.timeline[]` | `tour_timeline_steps` | TRANSFORM | From JSON to rows |
| `trip.emergency[]` | `tour_emergency_contacts` | SPLIT | Prefer contact FK later |

---

## Attachments and files

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `show.attachments[]` | `files` + `show_files` | TRANSFORM | |
| `attachment._storagePath` | `files.storage_path` | DIRECT | |
| `show_flight_passes.*` | `boarding_passes` | TRANSFORM | |
| `logistics_items.passes` JSON | `boarding_passes` | TRANSFORM | Dedupe with show_files |
| `itinerary.imgs[]` | `files` + `itinerary_submission_files` | TRANSFORM | |

---

## Trips / tours

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `trip.id` | `tours.legacy_id` | DIRECT | |
| `trip.name` | `tours.tour_name` | DIRECT | |
| `trip.color` | `tours.color_key` | DIRECT | |
| `trip.start/startDate` | `tours.start_date` | TRANSFORM | Normalise field name |
| `trip.end/endDate` | `tours.end_date` | TRANSFORM | |
| `trip.archived` | `tours.is_archived` | DIRECT | |
| `trip.packing[]` | — | OBSOLETE | Not used by Tour Mode; use org packing |
| `trip.attachments[]` | `tour_files` (future) | DECIDE | Not synced today |
| computed `runs()` | `tours.is_auto_generated=true` | DECIDE | Optional materialisation |

---

## Ideas, notes, invoices, packing, reminders

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `ideas.*` | `ideas` table (enhanced) | TRANSFORM | legacy_id + UUID FKs |
| `ideas.created` | `ideas.created_at` | TRANSFORM | ms → timestamptz |
| `notes.*` | `notes` table (enhanced) | TRANSFORM | |
| `notes.created` | `notes.created_at` | TRANSFORM | Add column |
| `invoices[]` | `invoices` + `invoice_line_items` | SPLIT | From JSON array |
| `invoices[].lines[]` | `invoice_line_items` | SPLIT | |
| `packing[]` | `packing_list_items` | TRANSFORM | From JSON array |
| `reminders[]` | `reminders` | TRANSFORM | **New table — currently local only** |

---

## Itineraries inbox

| Current location | Proposed destination | Action | Transformation notes |
|------------------|----------------------|--------|----------------------|
| `itinerary.id` | `itinerary_submissions.id` | TRANSFORM | |
| `itinerary.source` | `itinerary_submissions.source_description` | DIRECT | |
| `itinerary.date/time/note` | submission_* columns | DIRECT | |
| `itinerary.showId` | `itinerary_submissions.show_id` | TRANSFORM | |
| `itinerary.created` | `itinerary_submissions.created_at` | TRANSFORM | |
| scan API response | `itinerary_submissions.raw_scan_response` | TEMP | JSON optional |

---

## Supabase columns retired after migration

| Current column | Status | Replacement |
|----------------|--------|-------------|
| `shows.hotel` | TEMP then OBSOLETE | hotel_bookings |
| `shows.driver` | TEMP then OBSOLETE | ground_transfers |
| `shows.promoter` | TEMP then OBSOLETE | show_contacts |
| `shows.finance` | TEMP then OBSOLETE | show_financials |
| `shows.advance` | TEMP then OBSOLETE | show_advances |
| `shows.show_contacts` | TEMP then OBSOLETE | show_contacts junction |
| `org_settings.contacts` | TEMP then OBSOLETE | contacts |
| `org_settings.invoices` | TEMP then OBSOLETE | invoices |
| `org_settings.itineraries` | TEMP then OBSOLETE | itinerary_submissions |
| `org_settings.packing` | TEMP then OBSOLETE | packing_list_items |
| `org_settings.artists` | TEMP then OBSOLETE | artists |
| `logistics_items.passes` | TEMP then OBSOLETE | boarding_passes |
| `logistics_items.info` packed JSON | TEMP then OBSOLETE | typed journey columns |
| `trips.checklist/timeline/emergency` | TEMP then OBSOLETE | tour_* child tables |

**No field is silently dropped** — each is mapped, marked obsolete only after verification, or flagged DECIDE for product input.

---

## Fields needing product decision

| Field / concept | Options |
|-----------------|---------|
| Computed tour runs | Keep derived vs materialise as `tours.is_auto_generated` |
| `show.flightNo` at show level | Drop vs migrate to nearest flight journey |
| `trip.packing[]` | Discard vs merge into org packing |
| `trip.attachments[]` | Implement tour_files vs discard |
| Multi-artist b2b billing | show_artists only vs fee split table |
| Guest list text | Keep in advance vs `guest_list_entries` |
| Reminder sync scope | All devices vs per-user reminders |
