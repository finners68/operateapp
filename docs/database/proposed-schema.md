# Operate — Proposed PostgreSQL Schema (Revision 2)

**Status:** Step 1 — target design for approval. No SQL, no migrations, no application changes.

---

## Plain-English summary (Revision 2)

### 1. What changed from the first proposal

| Area | First proposal | Revision 2 |
|------|----------------|------------|
| Journeys | Included hotel stays and calendar markers | **Movement only** (flight, rail, ground, ferry, walk) |
| Journey ↔ show | Required `show_id` | Optional `related_show_id` and optional `tour_id` |
| Show timing | Three tables (`advance_schedule`, `schedule_items`, `timeline_steps`) | **One** `show_schedule_items` table |
| Contacts | `contacts.company_id` (single company) | **`company_contacts`** many-to-many |
| Boarding passes | `boarding_passes` + `journey_files` overlap | **`boarding_passes` only**; `journey_files` for other docs |
| Flight seat | On `flight_journeys` | On **`boarding_passes`** |
| Settings | Mixed in `org_settings` JSON + cloud tab/PIN | **Org / user / device** split; PIN and tab stay local |
| Packing | Org-wide JSON array | **`packing_lists`** + **`packing_list_items`** |
| Finance | Mentioned income/payments tables | **`show_financials`** + **`show_expenses` only** (matches app) |
| Invoices | Unclear multi-show | **`show_id` optional FK**; no link table (app is one show per invoice) |
| Tours | Auto-runs materialisation discussed | **User-created tours only**; auto-runs stay in frontend |
| Artists | `show_artists` in initial build | **Primary artist only**; multi-artist deferred |
| Reminders | Org-level sync implied | **User-scoped** with optional show/tour/journey links |
| Guest lists | Normalisation considered | **Deferred**; free text kept in advance fields |
| Table prefixes | Inconsistent | **`organisation_*`, `show_*`, `journey_*`, etc.** |

### 2. Overlapping tables combined or removed

**Combined into `show_schedule_items`:**
- `show_advance_schedule_items`
- `show_timeline_steps`
- calendar `marker` logistics rows (when tied to a show)

**Removed from journeys:**
- Hotel stays → `hotel_bookings`
- Markers → `show_schedule_items`

**Removed (not needed for current app):**
- `show_income`, `show_payments`
- `invoice_shows`
- `hotel_booking_guests`, `hotel_rooms`
- `journey_files` for boarding passes (passes use `boarding_passes` only)
- `organisation_security_settings` in Supabase (PIN is device-local)
- `show_artists` (deferred)
- `passenger` tables (deferred)

**Renamed / clarified:**
- `trip_*` → **`tour_*`** (align with product language)
- `start` / `startDate` → **`start_date`**, **`end_date`**

### 3. Deferred future tables

| Table | Reason deferred |
|-------|-----------------|
| `show_artists` | B2B / multi-artist not in current app |
| `guest_lists` | No guest-list management UI |
| `guest_list_entries` | Same |
| `hotel_booking_guests` | No per-guest room tracking in app |
| `hotel_rooms` | Same |
| `invoice_shows` | App creates one invoice per show (`eventId`) |
| `show_income` | No separate income ledger in app |
| `show_payments` | Paid flag + invoices sufficient today |
| `tour_auto_runs` (materialised) | Auto-runs computed in frontend |
| `passengers` | No passenger management |

### 4. Revised immediate table count

| Category | Count |
|----------|------:|
| **Required for current features** | **38** |
| Lookup / reference tables | 6 |
| **Immediate build total** | **44 tables** |
| Recommended views (not tables) | 8 |
| Deferred tables (not in build) | 9 |

Down from ~52 business tables in revision 1.

### 5. Tables required for current functionality

**Access & org (8):** `profiles`, `organisations`, `organisation_members`, `organisation_invites`, `usage_events`, `organisation_settings`, `organisation_billing_profiles`, `organisation_exchange_rates`

**Users (1):** `user_preferences`

**Roster & tours (3):** `artists`, `tours`, `venues`

**Shows (6):** `shows`, `show_advances`, `show_checklist_items`, `show_schedule_items`, `show_contacts`

**Contacts (3):** `contacts`, `companies`, `company_contacts`

**Travel (6):** `journeys`, `flight_journeys`, `rail_journeys`, `ferry_journeys`, `ground_transfers`, `ground_transfer_contacts`

**Hotels (3):** `hotels`, `hotel_bookings`, `hotel_booking_shows`

**Files (4):** `files`, `boarding_passes`, `journey_files`, `show_files`

**Finance (4):** `show_financials`, `show_expenses`, `invoices`, `invoice_line_items`

**Packing (2):** `packing_lists`, `packing_list_items`

**Reminders (1):** `reminders`

**Content (4):** `ideas`, `notes`, `itinerary_submissions`, `itinerary_submission_files`

**Tour contacts (1):** `tour_contacts`

### 6. Remaining product decisions

| # | Question | Recommendation |
|---|----------|----------------|
| 1 | Should Trip Mode “live” anchor sync across devices? | **No for v1** — keep `active_show_id` device-local; optional `user_preferences.active_show_id` later |
| 2 | Shared reminder on a show vs per-user only? | **Per-user `reminders.user_id`**; same show can have multiple users’ reminders |
| 3 | Rail journeys without detail in current imports? | **`rail_journeys`** subtype for consistency; minimal columns OK |
| 4 | Org-wide default packing template storage? | **`packing_lists`** row with `is_organisation_template = true` |
| 5 | Itinerary inbox retention period? | Product policy only; schema supports `itinerary_submissions` |

### 7. Main structure (simple diagram)

```text
organisations
├── organisation_settings, billing, exchange_rates
├── artists, contacts, companies, packing_lists (templates)
├── tours ── tour_contacts
│     ├── shows ── show_advances, show_schedule_items, show_checklist_items
│     │              show_contacts, show_financials, show_expenses
│     ├── journeys ── flight_journeys | rail_journeys | ferry_journeys | ground_transfers
│     │              boarding_passes → files
│     │              journey_files (non-pass docs)
│     └── hotel_bookings ── hotels
│                        └── hotel_booking_shows (multi-show stays)
├── invoices → invoice_line_items
├── ideas, notes, reminders (user-scoped)
└── files (central storage metadata)

user_preferences (per user, per org)
device-local: tab, PIN, biometric, _known sync sets (not in Postgres)
```

---

## Design principles (unchanged intent)

- One obvious table per real-world object the app uses today
- UUID primary keys, explicit foreign keys, descriptive column names
- `organisation_id` on org-owned rows for RLS and indexing
- `created_at`, `updated_at` on business tables
- `legacy_id` optional during migration from client IDs
- Minimal JSON; core business data never in JSONB

---

## Naming conventions

| Pattern | Example |
|---------|---------|
| Foreign keys | `related_show_id`, `tour_id`, `organisation_id` |
| Timestamps | `departure_at`, `created_at` |
| Dates | `show_date`, `check_in_date` |
| Money | `agreed_fee_amount` + `currency_code` |
| Booleans | `is_paid`, `is_archived`, `has_boarding_pass` |

Avoid: `dep`, `arr`, `ref`, `fstatus`, `prio`, `sub`.

---

## Table prefix groups (Supabase readability)

Tables sort together when prefixed consistently:

| Prefix | Tables |
|--------|--------|
| `organisation_*` | settings, billing, exchange_rates, members, invites |
| `tour_*` | tours, tour_contacts |
| `show_*` | shows, advances, schedule_items, checklist_items, contacts, financials, expenses, files |
| `journey_*` | journeys, flight_journeys, rail_journeys, ferry_journeys, ground_transfers, ground_transfer_contacts, files |
| `hotel_*` | hotels, hotel_bookings, hotel_booking_shows |
| `invoice_*` | invoices, line_items |
| `packing_*` | packing_lists, packing_list_items |

Unprefixed where globally clear: `contacts`, `companies`, `company_contacts`, `artists`, `venues`, `files`, `boarding_passes`, `reminders`, `ideas`, `notes`, `profiles`, `organisations`.

---

## Required tables (detail)

### Access and organisations

#### `profiles`
Existing auth mirror. `id` → auth.users, `display_name`, `email`, timestamps.

#### `organisations`
Workspace. `id`, `organisation_name`, timestamps, optional `deleted_at`.

#### `organisation_members`
`organisation_id`, `user_id`, `member_role` (owner | manager | crew), `created_at`. PK composite.

#### `organisation_invites`
Token-based invites. Unchanged purpose from migration 003.

#### `usage_events`
Edge-function rate limits. No client access.

#### `organisation_settings`
**Shared org configuration only.**

| Column | Type | Notes |
|--------|------|-------|
| organisation_id | uuid PK/FK | |
| base_currency_code | char(3) | NOT NULL |
| home_airport_iata | char(3) | Tour grouping helper |
| account_type | text | dj, manager, tm, agent |
| invoice_prefix | text | |
| invoice_next_sequence | integer | |
| invoice_default_terms_days | integer | |
| usb_reminder_enabled | boolean | Org default for USB reminders |
| home_header_file_id | uuid FK → files | Branding |
| store_sequence | integer | Client ID generation helper during migration |
| created_at, updated_at | timestamptz | |

**Not stored here (device-local):** `tab`, `active_show_id`, PIN, biometric, scroll position, `_known`.

#### `organisation_billing_profiles`
Invoice “from” block: `billing_name`, `billing_address`, `tax_identifier`, `bank_iban`, `billing_email`. RLS: owner/manager only.

#### `organisation_exchange_rates`
`(organisation_id, currency_code)` PK, `rate_to_base`, `updated_at`.

#### `user_preferences`
Per user per organisation. **Not shared org state.**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| user_id | uuid FK | |
| last_open_tab | text | Optional cross-device UI restore |
| ui_preferences | jsonb | See JSON section — flexible UI only |
| created_at, updated_at | timestamptz | |

**Unique:** `(organisation_id, user_id)`

**`active_show_id` / Trip Mode:** Today the app stores these in `org_settings` and syncs them org-wide, which is wrong for multi-user. **Recommendation:** Trip Mode live anchor is **device-local** (localStorage / IndexedDB), not Postgres. If cross-device Trip Mode is wanted later, add `user_preferences.active_show_id` — not `organisation_settings`.

---

### Artists and tours

#### `artists`
`organisation_id`, `legacy_id`, `display_name`, `is_default`, timestamps, optional `deleted_at`.

#### `tours`
**User-created or user-confirmed tours only.** Auto-detected runs stay computed in the frontend (`runs()` in `js/state.js`).

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| legacy_id | text | Maps old `trip.id` |
| tour_name | text | NOT NULL |
| color_key | text | |
| start_date | date | **Final name** (replaces `start` / `startDate`) |
| end_date | date | |
| is_archived | boolean | |
| created_at, updated_at, deleted_at | | |

Shows link via `shows.tour_id`. Naming fix: app UI writes `startDate` but sync maps `t.start` — migration normalises to `start_date`.

#### `tour_contacts`
` tour_id`, `contact_id`, `contact_role`, `is_primary`, `sort_order`. Reuses central `contacts` (including emergency contacts with role `emergency`).

---

### Venues and shows

#### `venues`
Reusable performance locations: `venue_name`, address fields, `venue_timezone` (IANA), optional lat/long, `organisation_id`, timestamps, `deleted_at`.

#### `shows`
Operational show record **without finance JSON.**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| legacy_id | text | |
| tour_id | uuid FK nullable | Named tour |
| primary_artist_id | uuid FK nullable | **One primary artist only** |
| venue_id | uuid FK nullable | |
| show_date | date | NOT NULL |
| show_status | text FK → show_statuses | |
| color_key | text | |
| set_start_time | time | Venue-local |
| set_end_time | time | |
| venue_arrival_time | time | |
| venue_timezone | text | IANA |
| internal_notes | text | |
| content_plan | text | |
| is_set_done | boolean | Trip Mode |
| created_at, updated_at, deleted_at | | |

**Deferred:** `show_artists` junction documented below under Future.

Crew RLS: SELECT allowed on `shows` (and related ops tables). **No access** to `show_financials`.

#### `show_advances`
One row per show. Text fields from current `advance` object:

`stage_name`, `access_notes`, `soundcheck_notes`, `curfew_notes`, `dressing_room_notes`, **`guestlist_notes`** (unstructured — no guest tables), `catering_notes`, `parking_notes`, `wifi_notes`, `navigation_address`, `general_remarks`, `updated_at`.

Advance **timed schedule rows** migrate to `show_schedule_items`, not duplicate columns here.

#### `show_schedule_items`
**Single schedule table** replacing timeline steps, advance schedule array, and show-linked markers.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| show_id | uuid FK | NOT NULL |
| schedule_item_type | text FK → schedule_item_types | |
| item_title | text | |
| item_notes | text | |
| scheduled_date | date | Optional for all-day markers |
| scheduled_time | time | Optional |
| scheduled_end_time | time | Optional |
| is_all_day | boolean | Markers, deadlines |
| is_done | boolean | Trip Mode / prep progress |
| sort_order | integer | |
| created_at, updated_at, deleted_at | | |

**Supported types (lookup `schedule_item_types`):** `venue_arrival`, `soundcheck`, `doors`, `set`, `curfew`, `deadline`, `calendar_marker`, `custom`, plus any legacy timeline titles mapped to `custom`.

**Checklists stay separate** in `show_checklist_items` — prep todos, not timed schedule.

#### `show_checklist_items`
`show_id`, `item_label`, `is_done`, `sort_order`, timestamps, `deleted_at`. Same role as today’s checklist.

#### `show_contacts`
`show_id`, `contact_id`, optional `company_id` (promoter org), `contact_role`, `is_primary_liaison`, `sort_order`.

Promoter may appear as company only, contact only, or both (company on row + contact linked).

---

### Contacts and companies

#### `companies`
`organisation_id`, `company_name`, `company_notes`, timestamps, `deleted_at`.

#### `contacts`
`organisation_id`, `legacy_id`, `first_name`, `last_name`, `display_name`, `email_address`, `phone_number`, `whatsapp_number`, `contact_notes`, timestamps, `deleted_at`.

**No `company_id` on contacts** — use junction.

#### `company_contacts`
`company_id`, `contact_id`, `job_title`, `is_primary`, `sort_order`. A contact may link to many companies.

#### Drivers
Not a separate table. Ground drivers are `contacts` linked via `ground_transfer_contacts`.

---

### Journeys (movement only)

#### `journeys`
Represents **movement between places** — not hotels, not calendar notes.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| legacy_id | text | |
| journey_kind | text FK → journey_kinds | flight, rail, ground_transfer, ferry, walk |
| tour_id | uuid FK nullable | Optional tour span |
| related_show_id | uuid FK nullable | **Optional** — not required |
| journey_date | date | Primary calendar date |
| journey_title | text | Display label |
| is_done | boolean | Trip Mode |
| sort_order | integer | |
| created_at, updated_at, deleted_at | | |

**Kinds:** `flight`, `rail`, `ground_transfer`, `ferry`, `walk`.

A journey may relate to a tour only, a show only, both, or neither (rare — org-level travel).

#### `flight_journeys`
1:1 with `journeys` where kind = flight.

`flight_number`, `departure_airport_iata`, `arrival_airport_iata`, `departure_at`, `arrival_at` (timestamptz), `terminal_name`, `gate_name`, `flight_status`, `delay_description`, `status_updated_at`, `is_live_status`.

**No seat on flight row** — seat lives on `boarding_passes`.

#### `rail_journeys`
1:1 for trains. `train_number`, `departure_station`, `arrival_station`, `departure_at`, `arrival_at`.

#### `ferry_journeys`
1:1 for ferries. `ferry_operator`, `departure_port`, `arrival_port`, `departure_at`, `arrival_at`.

#### `ground_transfers`
1:1 for car/walk-style movement. `route_description`, `pickup_location`, `scheduled_pickup_time`, `is_self_arranged` (Uber/taxi mode), `transfer_notes`.

Walk journeys with kind `walk` may use minimal ground_transfers row or title-only on `journeys` — product choice at implementation.

#### `ground_transfer_contacts`
`ground_transfer_id`, `contact_id`, `assignment_role` (default `driver`), `sort_order`.

---

### Hotels and accommodation

#### `hotels`
Property catalog: `hotel_name`, address fields, `organisation_id`, timestamps, `deleted_at`.

#### `hotel_bookings`
A stay reservation — **not a journey**.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| legacy_id | text | |
| hotel_id | uuid FK | |
| tour_id | uuid FK nullable | Whole-tour block booking |
| booking_reference | text | |
| check_in_date | date | |
| check_out_date | date | |
| room_notes | text | |
| is_done | boolean | Trip Mode |
| created_at, updated_at, deleted_at | | |

**No `related_show_id` required on booking** when multiple shows covered — use junction.

#### `hotel_booking_shows`
Links one booking to **one or many shows** (e.g. Ibiza hotel across two show dates).

| Column | Type |
|--------|------|
| hotel_booking_id | uuid FK |
| show_id | uuid FK |

**PK:** `(hotel_booking_id, show_id)`

**Example:** Booking covers Fri–Sun with shows on Fri and Sat → one `hotel_bookings` row, two `hotel_booking_shows` rows, optional `tour_id` on booking for tour context.

**Not included:** `hotel_booking_guests`, `hotel_rooms` — app has no guest/room UI.

---

### Files and boarding passes

#### `files`
Central file metadata. `organisation_id`, `legacy_id`, `storage_path`, `original_filename`, `mime_type`, `file_size_bytes`, `uploaded_by_user_id`, timestamps, `deleted_at`.

#### `boarding_passes`
**Only path for boarding-pass files.**

| Column | Type |
|--------|------|
| id | uuid PK |
| organisation_id | uuid FK |
| journey_id | uuid FK → journeys (flight) |
| file_id | uuid FK → files |
| passenger_name | text nullable |
| seat_number | text nullable |
| legacy_id | text |
| created_at, updated_at |

**No `journey_files` row for boarding passes.**

#### `journey_files`
Non-pass travel documents only: confirmations, train tickets, itineraries, supporting PDFs.

`journey_id`, `file_id`, `file_purpose` (booking_confirmation, train_ticket, itinerary, other).

#### `show_files`
Show attachments (contracts, riders, etc.). `show_id`, `file_id`, `file_purpose`.

---

### Finance (current app scope only)

The app stores per show: fee, currency, deal type, commission %, per diem, paid flag, estimated, not disclosed, and a list of expenses `{label, amount}`. Invoices are separate entities with lines.

**Included:**

#### `show_financials`
1:1 with show. RLS: **owner and manager only** — crew denied.

`show_id` PK, `organisation_id`, `agreed_fee_amount`, `currency_code`, `deal_type`, `commission_percent`, `per_diem_amount`, `is_paid`, `is_estimated`, `is_not_disclosed`, `updated_at`.

#### `show_expenses`
`id`, `show_id`, `organisation_id`, `expense_label`, `expense_amount`, `currency_code`, `sort_order`, `deleted_at`.

**Excluded (no current app need):** `show_income`, `show_payments`.

#### `invoices`
Current app: `createInvoiceFromEvent(eid)` — **one invoice per show**, `eventId` required.

| Column | Type |
|--------|------|
| id | uuid PK |
| organisation_id | uuid FK |
| legacy_id | text |
| show_id | uuid FK nullable | Set when invoice is for one show |
| invoice_number | text |
| invoice_date | date |
| client_name | text |
| client_address | text |
| currency_code | char(3) |
| invoice_status | text FK |
| payment_terms_days | integer |
| timestamps, deleted_at | |

**No `invoice_shows` junction** — not needed until multi-show invoicing exists.

#### `invoice_line_items`
`invoice_id`, `line_label`, `line_amount`, `sort_order`.

---

### Packing lists

Replaces `org_settings.packing` JSON array.

#### `packing_lists`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| tour_id | uuid FK nullable | When list belongs to a tour |
| list_name | text | e.g. "Default template", "Summer tour" |
| is_organisation_template | boolean | Reusable template |
| is_archived | boolean | |
| created_at, updated_at | | |

#### `packing_list_items`
`packing_list_id`, `item_label`, `is_done`, `sort_order`, `deleted_at`.

Tour Mode today uses a **global** org packing list — model as one `packing_lists` row with `is_organisation_template = true` and no `tour_id`. Per-tour lists attach via `tour_id`.

**Not included:** user-specific packing lists unless product requests later (`user_id` on `packing_lists` — deferred).

---

### Reminders

Cloud-synced, **user-specific**. One user dismissing does not dismiss for others.

#### `reminders`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| organisation_id | uuid FK | |
| user_id | uuid FK | Owner of reminder |
| show_id | uuid FK nullable | |
| tour_id | uuid FK nullable | |
| journey_id | uuid FK nullable | |
| reminder_kind | text | manual, usb |
| remind_at | timestamptz | |
| reminder_label | text | |
| is_fired | boolean | |
| created_at, updated_at | |

At least one of show/tour/journey should be set for context (check constraint at implementation).

**Not in scope:** Web Push subscription storage.

---

### Content

#### `ideas`, `notes`
Enhance existing tables: UUID PKs, `organisation_id`, FK `show_id` / `tour_id` as UUIDs, `legacy_id`, timestamps. Priority column renamed `priority_level` in migration (avoid `prio`).

#### `itinerary_submissions` + `itinerary_submission_files`
Inbox for scanned itineraries. Optional `raw_scan_response jsonb` for OpenAI payload — see JSON section.

---

## Lookup tables (6)

| Table | Values |
|-------|--------|
| `show_statuses` | confirmed, hold, cancelled |
| `journey_kinds` | flight, rail, ground_transfer, ferry, walk |
| `schedule_item_types` | venue_arrival, soundcheck, doors, set, curfew, deadline, calendar_marker, custom |
| `invoice_statuses` | draft, sent, paid |
| `idea_types` | reel, caption, hook, youtube, podcast, interview, location, other |
| `contact_roles` | artist_liaison, promoter, production, venue_manager, driver, emergency, other |

---

## Deferred tables (documented, not in immediate build)

### `show_artists` (future B2B)
`show_id`, `artist_id`, `billing_order`. Fee splitting deferred.

### `guest_lists` / `guest_list_entries` (future)
Only when guest-list management is built. Until then: `show_advances.guestlist_notes` text.

### Other deferred
See section 3 above.

---

## JSON fields (complete list)

| Location | Column | Justification |
|----------|--------|---------------|
| `user_preferences` | `ui_preferences` | Flexible UI toggles/layout — unpredictable keys |
| `organisation_settings` | none | Removed — was dumping ground in v1 |
| `itinerary_submissions` | `raw_scan_response` | Raw third-party API (OpenAI vision) — unpredictable |
| Import staging (future) | `source_payload` | Temporary ABOSS/import blobs — not in immediate build |

**Everything else** — hotels, bookings, contacts, finance, invoices, journeys, schedules, checklists, passes — **relational only**.

---

## `deleted_at` — where and why

Include `deleted_at` only on entities that users **delete independently while offline** and that must tombstone-sync:

| Table | Why |
|-------|-----|
| shows | User deletes show |
| show_checklist_items, show_schedule_items | Delete line items |
| show_contacts | Remove assignment |
| journeys + subtype rows | Delete travel leg (cascade from journey) |
| hotel_bookings | Remove stay |
| contacts, companies | Delete from rolodex |
| files | Delete attachment/pass |
| show_expenses | Delete expense line |
| invoices | Delete invoice |
| packing_list_items | Remove packing row |
| ideas, notes | Delete content |

**Omit `deleted_at`** on: lookup tables, `show_financials` (1:1 — delete with show), `show_advances` (1:1), `organisation_settings`, junction rows (hard delete OK), `boarding_passes` (delete with file/journey).

---

## Recommended views

| View | Plain English |
|------|---------------|
| `show_overview` | One row per show: venue, artist, date, status, city, tour name — **no money** |
| `tour_overview` | Tour name, dates, show count, cities, archived flag |
| `travel_schedule` | All journeys with flight/train/ferry/ground details, related show and tour names, sorted by date |
| `hotel_schedule` | Hotel bookings with hotel name, dates, booking ref, linked show names |
| `show_contact_summary` | Show + all contacts and companies with roles and phones |
| `outstanding_payments` | Shows where financials.is_paid = false with fee amounts (manager view) |
| `missing_documents` | Upcoming shows/journeys missing boarding passes or key attachments |
| `upcoming_shows` | Confirmed shows from today forward with venue and countdown fields |

Views do not weaken RLS — underlying table policies still apply; finance views restricted to owner/manager.

---

## Flights — single source of truth

**Final state:** All flight data lives in `journeys` + `flight_journeys` + `boarding_passes`.

The show detail UI may still look like “show flights”, but reads/writes journey rows filtered by `related_show_id`. **No parallel `show_flights` table** in the target schema.

Show-level live flight widget fields (`flight_no`, terminal, gate on show) migrate onto the **primary flight journey** for that show, or the nearest journey by date.

---

## RLS summary

| Data | owner | manager | crew |
|------|-------|---------|------|
| shows, venues, schedules, checklists, journeys, hotels | R/W | R/W | R (W on checklist/schedule/journey per policy) |
| show_financials, show_expenses, invoices, billing | R/W | R/W | **deny** |
| reminders | own rows | own rows | own rows |
| user_preferences | own row | own row | own row |

---

## Migration notes (design only)

- `legacy_id` retained on migrated entities during transition
- Current `store.trips[]` → `tours` with `start_date` / `end_date`
- Current markers (`kind: marker`) → `show_schedule_items` with type `calendar_marker`
- Current stay legs → `hotel_bookings` + optional `hotel_booking_shows`
- Current travel legs + `show.flights[]` → unified `journeys` (dedupe carefully)
- Current `show.timeline[]` + `advance.schedule[]` → `show_schedule_items`
- Current `org_settings.active_*` and `tab` → device-local, not Postgres org settings

Implementation rollout is **Step 2** — not covered in this document.
