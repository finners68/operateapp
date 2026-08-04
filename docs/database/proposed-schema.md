# Operate — Proposed PostgreSQL Schema

## Executive summary

### 1. Current data model (as-is)

Operate uses a **single client-side store** (`store`) persisted to localStorage and synchronised to Supabase. Shows and calendar logistics share one polymorphic `events[]` array discriminated by `kind`. Most operational detail on a show — hotel, finance, promoter, drivers, advance, contacts — lives in **JSONB columns** on `shows`. Global collections (contacts, invoices, itineraries, packing, artists) live in **JSONB arrays** on `org_settings`. Travel exists in **three parallel shapes**: embedded show flights, calendar logistics legs, and embedded show hotel/drivers.

Tour Mode uses **computed runs** (grouped consecutive shows) that are not stored; a separate **named trips** table exists but is secondary in the UI.

### 2. Biggest structural problems

| Problem | Impact |
|---------|--------|
| Finance embedded in `shows.finance` JSON | Crew users can read fees via RLS on shows; no audit trail |
| Duplicate travel/accommodation models | Sync conflicts, incomplete Trip Mode timelines, migration complexity |
| Contacts/invoices in org_settings JSON | No FK integrity, no reuse, poor querying |
| `legacy_id` text keys everywhere | Works offline but weak referential integrity in Postgres |
| Mixed sync coverage | Reminders local-only; trip.packing not synced; orphan cleanup incomplete |
| Packed logistics `info` JSON | Fields not queryable; import recovery fragile |
| Polymorphic events array | Hard to enforce constraints; calendar vs show concerns mixed |

### 3. Recommended target structure

A **normalised, org-scoped relational model** with:

- Clear entity tables: organisations → artists → tours → shows → journeys → files
- Reusable **contacts** and **companies** with junction tables for show/tour assignments
- **Unified journeys** table subtyped into flight, ground, rail, ferry, stay (hotel booking)
- **show_financials** separated from shows with restrictive RLS
- Central **files** table with typed link tables
- **Computed tour runs** materialised optionally later; named tours as first-class `tours`
- `legacy_id` retained during migration; UUID primary keys for all new rows

### 4. Approximate table count

**52 core business tables** + 8 reference/lookup tables + 6 link/junction tables + **8 recommended views** ≈ **66 database objects**.

Grouped:

| Domain | Tables |
|--------|--------|
| Accounts & access | 5 |
| Organisations & settings | 4 |
| Artists & tours | 6 |
| Shows & venue | 8 |
| Contacts & companies | 5 |
| Travel & journeys | 8 |
| Accommodation | 4 |
| Operations (checklists, tasks, reminders) | 8 |
| Finance & invoices | 7 |
| Files | 5 |
| Ideas, notes, content | 4 |
| Reference/lookup | 8 |

### 5. Essential changes (do first)

1. Extract **show_financials** + RLS excluding crew
2. Normalise **contacts** and **show_contacts** out of JSON
3. Unify **journeys** (merge show flights + logistics_items travel/stay)
4. Central **files** + boarding_passes linked to journeys
5. Add **legacy_id** + **deleted_at** columns for safe dual-write migration

### 6. Can wait

- Materialised tour runs table (keep computing in app initially)
- Guest list normalisation (currently text in advance)
- Expense categories reference table (free text works initially)
- Venue spaces sub-rooms
- Full company hierarchy

### 7. Decisions requiring product owner input

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Should computed auto-runs be persisted as tours, or stay derived? | Persist optional `tours.is_auto_generated` runs later; keep derived for v1 |
| 2 | Can one show have multiple artists (b2b)? | Add `show_artists` junction; primary artist on show row |
| 3 | Should crew edit show deal/finance? | No — owner/manager only on financial tables |
| 4 | Should reminders sync to cloud? | Yes — new `reminders` table with push notification metadata |
| 5 | Retire named `store.trips[]` or merge with auto-runs? | Merge conceptually into `tours`; deprecate duplicate packing on trip object |
| 6 | Single journey model replacing embedded show hotel/flights/drivers? | Yes — embed only as UI cache during transition |
| 7 | Timezone per show venue? | Add `shows.venue_timezone` (IANA text); store set times as local + UTC |
| 8 | Currency per org or per deal? | Org `base_currency`; deal keeps `currency_code`; store amounts as numeric + code |

---

## Architecture decisions

### Artists belong to organisations

**Decision:** `artists.organisation_id` FK. Artists are roster entries, not tour-owned. Shows reference `shows.primary_artist_id`. Optional `show_artists` for co-billing.

**Excluded:** Artists owned by tours only — tours rotate; artists persist across tours.

### One show, multiple artists

**Decision:** Support via `show_artists (show_id, artist_id, billing_order)` junction. `shows.primary_artist_id` remains for default display. Current app only stores one `artist` string — migrate to primary artist name match.

**Product decision needed** for b2b fee splits (not in app today).

### Journeys link to show, tour, or both

**Decision:** Every journey has **required `show_id`** (primary anchor). Optional **`tour_id`** when part of a named/auto tour span. Optional **`organisation_id`** denormalised for RLS index.

Journeys do not use polymorphic parent_type. Markers/deadlines become `show_schedule_items` with `item_kind = 'marker'`.

### Hotels and venues — separate tables

**Decision:** **Do not** use a generic locations table.

- `venues` — performance locations (name, address, city, country, timezone, geo)
- `hotels` — accommodation properties (reusable property record)
- `hotel_bookings` — stay linked to show + hotel + check-in/out dates

Different lifecycles and attributes justify separation.

### Drivers as contacts

**Decision:** **Yes.** `ground_transfers` table with journey-specific pickup_time, pickup_location, notes, is_self_arranged (noGround). Assign driver via `ground_transfer_assignments (ground_transfer_id, contact_id, assignment_role)`.

### Promoters as companies and contacts

**Decision:** `companies` for promoter org; `contacts` for people. `show_contacts` junction with `contact_role` (promoter, production, venue_manager, …). Legacy `show.promoter` maps to one `show_contacts` row with role `artist_liaison`.

### Notes — separate parent tables vs polymorphic

**Decision:** Single `notes` table with **nullable FKs**: `show_id`, `tour_id`, `organisation_id` (for org-wide). Check: at least one parent or `is_org_wide = true`. Avoid `parent_type`/`parent_id`.

Same pattern for `ideas`.

### Files — central table

**Decision:** `files` stores storage_path, mime_type, size_bytes, uploaded_by. Link via:

- `show_files (show_id, file_id, file_purpose)`
- `journey_files (journey_id, file_id, file_purpose)` — includes boarding_pass
- `invoice_files`, `hotel_booking_files`

### Boarding passes belong to journeys

**Decision:** `boarding_passes (journey_id, file_id, passenger_name, seat_number)`. Journey must be `journey_kind = 'flight'`. Merges `show_flight_passes` and logistics pass JSON.

### Show finance protection

**Decision:** Table `show_financials` with RLS:

- SELECT/INSERT/UPDATE/DELETE: owner, manager
- crew: **no access** (separate view `show_public` excluding finance)

Invoices link to `show_financials` not raw show row.

### Organisation ownership

**Decision:** Keep `orgs` + `org_members.role`. All business tables include `organisation_id`. RLS helper functions: `user_in_org(org_id)`, `user_can_manage_org(org_id)` (owner|manager).

### Legacy IDs

**Decision:** Retain `legacy_id text` on all migrated entities until Phase 13. Unique constraint `(organisation_id, legacy_id)`. New offline clients generate UUID v4 as `id` immediately; `legacy_id` populated for backward compatibility during dual-write.

### Offline UUIDs

**Decision:** Client generates UUID v4 primary keys. Postgres uses same UUID — no server-assigned IDs required for insert. `created_at_client` optional for conflict debugging.

### Deletions and tombstones

**Decision:** Add `deleted_at timestamptz` nullable on syncable tables. Sync protocol: tombstone wins over missing row (safer than `_known` set). Keep `_known` during transition.

### Timestamps and timezones

**Decision:**

- `timestamptz` for absolute instants (created_at, flight departure UTC)
- `date` + `time` columns for venue-local show times where timezone matters
- `shows.venue_timezone text` (IANA, e.g. `Europe/Amsterdam`)
- View layer converts for display

### Currencies

**Decision:** `organisation_settings.base_currency_code char(3)`. Money columns: `amount numeric(12,2)` + `currency_code char(3)`. FX rates in `organisation_exchange_rates (organisation_id, currency_code, rate_to_base)`.

### Lookup values

| Domain | Approach |
|--------|----------|
| show status | Reference table `show_statuses` (confirmed, hold, cancelled) |
| idea type | Reference table `idea_types` (matches IDEA_TYPES in app) |
| invoice status | Reference table `invoice_statuses` |
| journey kind | Reference table `journey_kinds` (flight, ground, rail, ferry, stay, marker) |
| contact role | Reference table `contact_roles` (seeded, extensible) |
| priority | CHECK constraint on ideas: high, med, low |
| org member role | CHECK: owner, manager, crew |

---

## Naming conventions

- Foreign keys: `{entity}_id`
- Timestamps: `{action}_at`
- Dates: `{event}_date`
- Money: `{description}_amount` + `currency_code`
- Booleans: `is_{state}`, `has_{feature}`
- No abbreviations: use `departure_airport_id` not `dep`

---

## Proposed tables

### Accounts and access

#### `profiles`
| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| id | uuid | NO | — | PK, FK → auth.users |
| display_name | text | YES | — | |
| email | text | YES | — | |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

**RLS:** self read/update.

#### `organisations`
| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | gen_random_uuid() |
| name | text | NO | — |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES | — |

#### `organisation_members`
| Column | Type | Null | Default |
|--------|------|------|---------|
| organisation_id | uuid | NO | FK → organisations CASCADE |
| user_id | uuid | NO | FK → auth.users CASCADE |
| member_role | text | NO | CHECK owner/manager/crew |
| created_at | timestamptz | NO | now() |

**PK:** (organisation_id, user_id)  
**Index:** (user_id)

#### `organisation_invites`
| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | gen_random_uuid() |
| organisation_id | uuid | NO | FK CASCADE |
| email | text | NO | — |
| invite_role | text | NO | CHECK |
| invite_token | text | NO | UNIQUE |
| invited_by_user_id | uuid | YES | FK |
| accepted_at | timestamptz | YES | — |
| created_at | timestamptz | NO | now() |

#### `usage_events` (retain)
Rate-limit ledger for edge functions — unchanged purpose.

---

### Organisation settings

#### `organisation_settings`
| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| organisation_id | uuid | NO | PK/FK | |
| base_currency_code | char(3) | NO | 'EUR' | |
| home_airport_iata | char(3) | YES | — | |
| account_type | text | YES | 'dj' | CHECK dj/manager/tm/agent |
| invoice_prefix | text | YES | 'AHQ' | |
| invoice_next_sequence | integer | NO | 1 | |
| invoice_default_terms_days | integer | NO | 14 | |
| packing_template | jsonb | YES | '[]' | **JSON — UI template only** |
| home_header_file_id | uuid | YES | FK → files | |
| usb_reminder_enabled | boolean | NO | true | |
| active_tour_id | uuid | YES | FK → tours | replaces active_trip_id |
| active_show_id | uuid | YES | FK → shows | |
| last_tab | text | YES | 'home' | UI preference |
| store_sequence | integer | NO | 1 | replaces _seq |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |

#### `organisation_billing_profiles`
| Column | Type | Null | Notes |
|--------|------|------|-------|
| organisation_id | uuid | NO | PK/FK |
| billing_name | text | YES | |
| billing_address | text | YES | |
| tax_identifier | text | YES | Sensitive |
| bank_iban | text | YES | Sensitive |
| billing_email | text | YES | |
| updated_at | timestamptz | NO | |

**RLS:** owner/manager only (sensitive).

#### `organisation_exchange_rates`
| Column | Type | Null |
|--------|------|------|
| organisation_id | uuid | NO |
| currency_code | char(3) | NO |
| rate_to_base | numeric(12,6) | NO |
| updated_at | timestamptz | NO |

**PK:** (organisation_id, currency_code)

#### `organisation_security_settings`
| Column | Type | Null | Notes |
|--------|------|------|-------|
| organisation_id | uuid | NO | PK/FK |
| is_passcode_enabled | boolean | NO | false |
| passcode_hash | text | YES | Sensitive |
| lock_scope | text | NO | finance/app |
| is_biometric_enabled | boolean | NO | false |

**RLS:** owner only.

---

### Artists and tours

#### `artists`
| Column | Type | Null | Default |
|--------|------|------|---------|
| id | uuid | NO | gen_random_uuid() |
| organisation_id | uuid | NO | FK |
| legacy_id | text | YES | migration |
| display_name | text | NO | — |
| is_default | boolean | NO | false |
| created_at | timestamptz | NO | now() |
| updated_at | timestamptz | NO | now() |
| deleted_at | timestamptz | YES | — |

**Unique:** (organisation_id, legacy_id) WHERE legacy_id IS NOT NULL

#### `tours`
| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| id | uuid | NO | gen_random_uuid() | |
| organisation_id | uuid | NO | FK | |
| legacy_id | text | YES | — | |
| tour_name | text | NO | — | |
| color_key | text | YES | — | |
| start_date | date | YES | — | |
| end_date | date | YES | — | |
| is_archived | boolean | NO | false | |
| is_auto_generated | boolean | NO | false | future: materialised runs |
| primary_show_id | uuid | YES | FK → shows | run key equivalent |
| created_at | timestamptz | NO | now() | |
| updated_at | timestamptz | NO | now() | |
| deleted_at | timestamptz | YES | — | |

#### `tour_emergency_contacts`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| tour_id | uuid | NO | FK CASCADE |
| contact_name | text | NO |
| phone_number | text | YES |
| sort_order | integer | NO | 0 |
| created_at | timestamptz | NO |

*Alternative:* link to `contacts` — prefer FK `contact_id` when contact exists.

#### `tour_checklist_items` / `tour_timeline_steps`
Mirror show checklist structure with `tour_id` FK, label/time/title/sub, is_done, sort_order.

---

### Shows and venues

#### `venues`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| venue_name | text | NO |
| address_line | text | YES |
| city_name | text | YES |
| country_code | char(2) | YES |
| postcode | text | YES |
| venue_timezone | text | YES |
| latitude | numeric(9,6) | YES |
| longitude | numeric(9,6) | YES |
| created_at | timestamptz | NO |
| updated_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `shows`
| Column | Type | Null | Notes |
|--------|------|------|-------|
| id | uuid | NO | PK |
| organisation_id | uuid | NO | RLS |
| legacy_id | text | YES | migration |
| tour_id | uuid | YES | FK → tours |
| primary_artist_id | uuid | YES | FK → artists |
| venue_id | uuid | YES | FK → venues |
| show_date | date | NO | |
| show_status | text | NO | FK → show_statuses |
| color_key | text | YES | |
| set_start_time | time | YES | local venue time |
| set_end_time | time | YES | |
| venue_arrival_time | time | YES | |
| venue_timezone | text | YES | IANA |
| internal_notes | text | YES | was notes |
| content_plan | text | YES | was content |
| is_set_done | boolean | NO | false |
| created_at | timestamptz | NO | |
| updated_at | timestamptz | NO | |
| deleted_at | timestamptz | YES | |

**Excluded from shows:** hotel, finance, promoter, drivers, advance — separate tables.

#### `show_artists`
| Column | Type | Null |
|--------|------|------|
| show_id | uuid | NO |
| artist_id | uuid | NO |
| billing_order | integer | NO | 0 |

**PK:** (show_id, artist_id)

#### `show_advances`
One row per show (1:1).

| Column | Type | Null |
|--------|------|------|
| show_id | uuid | NO | PK/FK |
| organisation_id | uuid | NO |
| stage_name | text | YES |
| access_notes | text | YES |
| soundcheck_notes | text | YES |
| curfew_notes | text | YES |
| dressing_room_notes | text | YES |
| guestlist_notes | text | YES |
| catering_notes | text | YES |
| parking_notes | text | YES |
| wifi_notes | text | YES |
| navigation_address | text | YES |
| general_remarks | text | YES |
| updated_at | timestamptz | NO |

#### `show_advance_schedule_items`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| show_id | uuid | NO | FK |
| scheduled_time | time | YES |
| item_label | text | NO |
| sort_order | integer | NO |

#### `show_schedule_items`
For markers/deadlines currently in logistics_items kind=marker.

| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| show_id | uuid | YES |
| tour_id | uuid | YES |
| item_date | date | NO |
| item_title | text | NO |
| is_all_day | boolean | NO | true |
| sort_order | integer | NO |

#### `show_checklist_items` (retain, enhance)
Add `organisation_id`, UUID PK (keep legacy_id), FK to show UUID not legacy.

#### `show_timeline_steps` (retain, enhance)
Same pattern as checklist.

---

### Contacts and companies

#### `companies`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| company_name | text | NO |
| company_notes | text | YES |
| created_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `contacts`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| legacy_id | text | YES |
| company_id | uuid | YES | FK |
| first_name | text | YES | split from name |
| last_name | text | YES | |
| display_name | text | NO | computed or stored |
| email_address | text | YES | |
| phone_number | text | YES | |
| whatsapp_number | text | YES | |
| contact_notes | text | YES | |
| created_at | timestamptz | NO |
| updated_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `show_contacts`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| show_id | uuid | NO | FK |
| contact_id | uuid | NO | FK |
| contact_role | text | NO | FK → contact_roles |
| is_primary_liaison | boolean | NO | false |
| sort_order | integer | NO |

**Unique partial:** one primary liaison per show (optional constraint).

#### `tour_contacts`
Same pattern with `tour_id`.

---

### Travel and journeys (unified)

#### `journey_kinds` (reference)
Values: `flight`, `ground_transfer`, `rail`, `ferry`, `hotel_stay`, `walk`, `marker`

#### `journeys`
| Column | Type | Null | Notes |
|--------|------|------|-------|
| id | uuid | NO | PK |
| organisation_id | uuid | NO | |
| legacy_id | text | YES | |
| show_id | uuid | NO | FK — primary anchor |
| tour_id | uuid | YES | FK |
| journey_kind | text | NO | FK → journey_kinds |
| journey_date | date | NO | |
| title | text | YES | |
| is_done | boolean | NO | false |
| sort_order | integer | NO | 0 |
| created_at | timestamptz | NO | |
| updated_at | timestamptz | NO | |
| deleted_at | timestamptz | YES | |

#### `flight_journeys`
| Column | Type | Null |
|--------|------|------|
| journey_id | uuid | NO | PK/FK |
| flight_number | text | YES |
| departure_airport_iata | char(3) | YES |
| arrival_airport_iata | char(3) | YES |
| departure_at | timestamptz | YES |
| arrival_at | timestamptz | YES |
| seat_number | text | YES |
| terminal_name | text | YES |
| gate_name | text | YES |
| flight_status | text | YES |
| delay_description | text | YES |
| status_updated_at | timestamptz | YES |
| is_live_status | boolean | NO | false |

#### `ground_transfers`
| Column | Type | Null |
|--------|------|------|
| journey_id | uuid | NO | PK/FK |
| route_description | text | YES | was journey |
| pickup_location | text | YES |
| scheduled_pickup_time | time | YES |
| is_self_arranged | boolean | NO | false (noGround) |
| transfer_notes | text | YES |

#### `ground_transfer_assignments`
| Column | Type | Null |
|--------|------|------|
| ground_transfer_id | uuid | NO | FK |
| contact_id | uuid | NO | FK |
| assignment_role | text | NO | driver |

#### `hotel_stays` (journey subtype for calendar stays)
| Column | Type | Null |
|--------|------|------|
| journey_id | uuid | NO | PK/FK |
| hotel_booking_id | uuid | YES | FK |

*Links journey row to booking record below.*

---

### Accommodation

#### `hotels`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| hotel_name | text | NO |
| address_line | text | YES |
| postcode | text | YES |
| city_name | text | YES |
| country_code | char(2) | YES |
| created_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `hotel_bookings`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| show_id | uuid | NO | FK |
| hotel_id | uuid | NO | FK |
| booking_reference | text | YES |
| check_in_date | date | YES |
| check_out_date | date | YES |
| room_notes | text | YES |
| is_done | boolean | NO | false |
| created_at | timestamptz | NO |
| updated_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `hotel_booking_guests`
| Column | Type | Null |
|--------|------|------|
| hotel_booking_id | uuid | NO |
| contact_id | uuid | YES | FK |
| guest_name | text | YES | when not in contacts |

---

### Finance

#### `show_financials`
| Column | Type | Null | Notes |
|--------|------|------|-------|
| show_id | uuid | NO | PK/FK |
| organisation_id | uuid | NO | |
| agreed_fee_amount | numeric(12,2) | NO | 0 |
| currency_code | char(3) | NO | |
| deal_type | text | YES | |
| commission_percent | numeric(5,2) | YES | |
| per_diem_amount | numeric(12,2) | YES | |
| is_paid | boolean | NO | false |
| is_estimated | boolean | NO | false |
| is_not_disclosed | boolean | NO | false |
| updated_at | timestamptz | NO | |

**RLS:** owner/manager only — **no crew access**.

#### `show_expenses`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| show_id | uuid | NO | FK |
| organisation_id | uuid | NO |
| expense_label | text | NO |
| expense_amount | numeric(12,2) | NO |
| currency_code | char(3) | NO |
| sort_order | integer | NO |

#### `invoices`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| legacy_id | text | YES |
| show_id | uuid | NO | FK |
| invoice_number | text | NO |
| invoice_date | date | NO |
| client_name | text | YES |
| client_address | text | YES |
| currency_code | char(3) | NO |
| invoice_status | text | NO | FK |
| payment_terms_days | integer | NO |
| created_at | timestamptz | NO |
| updated_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `invoice_line_items`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| invoice_id | uuid | NO | FK |
| line_label | text | NO |
| line_amount | numeric(12,2) | NO |
| sort_order | integer | NO |

---

### Files

#### `files`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| legacy_id | text | YES |
| storage_path | text | NO |
| original_filename | text | YES |
| mime_type | text | YES |
| file_size_bytes | bigint | YES |
| uploaded_by_user_id | uuid | YES |
| created_at | timestamptz | NO |
| deleted_at | timestamptz | YES |

#### `boarding_passes`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| journey_id | uuid | NO | FK → flight journeys |
| file_id | uuid | NO | FK → files |
| passenger_name | text | YES |
| seat_number | text | YES |
| legacy_id | text | YES |

#### `show_files`
| Column | Type | Null |
|--------|------|------|
| show_id | uuid | NO |
| file_id | uuid | NO |
| file_purpose | text | NO | attachment, header, … |

#### `journey_files`
| Column | Type | Null |
|--------|------|------|
| journey_id | uuid | NO |
| file_id | uuid | NO |
| file_purpose | text | NO | boarding_pass, document |

---

### Operations

#### `packing_list_items` (org-global, replaces org_settings.packing)
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| item_label | text | NO |
| is_done | boolean | NO | false |
| sort_order | integer | NO |

#### `reminders` (new — synced)
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| show_id | uuid | NO | FK |
| reminder_kind | text | NO | manual, usb |
| remind_at | timestamptz | NO |
| reminder_label | text | YES |
| is_fired | boolean | NO | false |
| created_by_user_id | uuid | YES |

#### `itinerary_submissions`
| Column | Type | Null |
|--------|------|------|
| id | uuid | NO |
| organisation_id | uuid | NO |
| show_id | uuid | YES | FK |
| source_description | text | YES |
| submission_date | date | YES |
| submission_time | time | YES |
| submission_notes | text | YES |
| created_at | timestamptz | NO |

#### `itinerary_submission_files`
| Column | Type | Null |
|--------|------|------|
| itinerary_submission_id | uuid | NO |
| file_id | uuid | NO |

---

### Ideas and notes

#### `ideas` (enhance existing)
Add UUID PK, organisation_id, FK show_id/tour_id UUID, legacy_id, created_at timestamptz.

#### `notes` (enhance existing)
Add optional show_id, tour_id FKs; created_at; UUID PK.

---

## JSON and JSONB — explicit retention list

| Location | Column | Why JSON is retained |
|----------|--------|----------------------|
| `organisation_settings` | `packing_template` | UI template list; low business value as rows until user saves |
| `itinerary_submissions` | `raw_scan_response` (new, optional) | Raw OpenAI vision output from edge function — unpredictable fields |
| `journeys` | none | — |
| `show_advances` | none | schedule items normalised to child table |
| Future: `import_batches` | `source_payload` | One-off ABOSS/import dumps during migration only |

**Everything else** listed in current JSON columns should migrate to relational tables per this schema.

---

## Recommended views

### `show_overview`
Joins: shows → venues → primary_artist → tour → show_statuses. Excludes finance.  
**Purpose:** Crew-safe show list/detail header.

### `show_finance_overview`
Joins: shows → show_financials → show_expenses → invoices.  
**Purpose:** Finance tab; manager/owner only via security barrier or RLS on underlying tables.

### `tour_overview`
Joins: tours → shows (count, date range) → tour_emergency_contacts.  
**Purpose:** Tours list and dashboard.

### `travel_schedule`
Joins: journeys → flight_journeys / ground_transfers → shows → boarding_passes.  
**Purpose:** Calendar and Trip Mode timeline source.

### `hotel_schedule`
Joins: hotel_bookings → hotels → shows.  
**Purpose:** Accommodation report across tour.

### `show_contact_summary`
Joins: show_contacts → contacts → companies.  
**Purpose:** Contact sheet export, day-of contact list.

### `outstanding_payments`
Joins: show_financials → shows where is_paid = false.  
**Purpose:** Finance dashboard widget.

### `missing_documents`
Joins: shows → journeys LEFT JOIN boarding_passes/files HAVING missing passes before show_date.  
**Purpose:** Ops checklist.

### `upcoming_shows`
Joins: shows → venues WHERE show_date >= current_date AND status = confirmed.  
**Purpose:** Home screen next-show queries.

---

## Indexes (cross-cutting)

- `(organisation_id, show_date)` on shows
- `(organisation_id, journey_date)` on journeys
- `(organisation_id, legacy_id)` unique where not null on all migrated tables
- `(show_id)` on all show-child tables
- `(organisation_id, deleted_at)` partial WHERE deleted_at IS NULL for active-row queries

---

## RLS summary (proposed)

| Table group | owner | manager | crew |
|-------------|-------|---------|------|
| shows, venues, journeys, contacts | R/W | R/W | R / W* |
| show_checklist, show_timeline | R/W | R/W | R/W |
| show_financials, invoices, billing | R/W | R/W | **deny** |
| organisation_security_settings | R/W | deny | deny |
| files | R/W | R/W | R read, W limited |

*Crew write on journeys/checklists matches current 003 policy intent but requires scoped client push, not full-store upsert.

---

## Tables explicitly excluded or deferred

| Suggested table | Decision |
|-----------------|----------|
| Generic `locations` | Excluded — venues and hotels differ |
| `drivers` standalone | Excluded — use contacts + ground_transfers |
| `tasks` generic | Deferred — checklist items sufficient today |
| `guest_list_entries` | Deferred — guestlist is text in advance |
| `venue_spaces` | Deferred — not in app |
| `airports` reference | Optional lookup later; IATA codes sufficient initially |
| Polymorphic `notes_parent` | Excluded — nullable FKs instead |

---

## Uncertain shapes requiring follow-up

Documented in `current-data-inventory.md` § Conflicting shapes. Migration plan Phase 0 resolves these with product sign-off before dual-write begins.
