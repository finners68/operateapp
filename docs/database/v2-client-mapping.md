# V2 client mapping (Supabase sync layer)

The UI keeps the in-memory `store` shape (`artisthq.v2`). `js/db.js` adapts between `store` and V2 Postgres tables. **Never query `*_v1` tables.**

## Column renames

| V1 / store | V2 |
|------------|-----|
| `org_id` | `organisation_id` |
| `orgs` | `organisations` |
| `org_members.role` | `organisation_members.member_role` |
| `trips.name` | `tours.tour_name` |
| `trips.archived` | `tours.is_archived` |
| `ideas.prio` (`med`) | `ideas.priority_level` (`medium`) |
| `settings.accountType` (`tm`) | `organisation_settings.account_type` (`tour_manager`) |
| `org_settings.seq` | `organisation_settings.store_sequence` |

## Legacy ID prefixes (migration)

Migrated rows may use prefixed `legacy_id` values. The load path strips these back to store IDs:

| Prefix | Entity |
|--------|--------|
| `show_flight:` | Embedded show flight → `journeys` + `store.events[].flights[]` |
| `show_primary_flight:` | Show-level flight widget fields on show event |
| `logistics:` | Calendar travel leg → `journeys` |
| `logistics_marker:` | Calendar marker → `schedule_items` |
| `logistics_stay:` | Calendar stay → `hotel_bookings` |
| `show_hotel:` | Embedded show hotel → `event.hotel` |
| `show_timeline:` | Show timeline step → `schedule_items` |
| `show_checklist:` | Show checklist → `checklist_items` |

Push writes the same prefixes for compatibility with migrated data.

## Query map

| Operation (old) | V2 target |
|-----------------|-----------|
| `org_members` | `organisation_members` |
| RPC `create_org` | RPC `create_organisation_v2` |
| `org_settings` blob | `organisation_settings`, `organisation_billing_profiles`, `organisation_exchange_rates`, `user_preferences`, `contacts`, `invoices`, `packing_lists`, `artists`, `itinerary_submissions` |
| `trips` | `tours` + `checklist_items` / `schedule_items` / `tour_contacts` |
| `shows` JSON fields | `shows`, `venues`, `artists`, `show_advances`, `show_financials`, `show_expenses`, `show_contacts`, `journeys`, `hotel_bookings` |
| `logistics_items` | `journeys`, `hotel_bookings`, `schedule_items` |
| `show_flights` / passes | `journeys`, `files`, `travel_tickets` |
| `show_files` | `files`, `show_files` |
| `show_checklist_items` | `checklist_items` |
| `show_timeline_steps` | `schedule_items` |
| `ideas`, `notes` | same table names, `organisation_id` |
| RPC `accept_invite` | RPC `accept_organisation_invite_v2` |
| `org_invites` | `organisation_invites` |
| Storage `operate-documents` | `operate-documents-v2` + `files` registry |

## Realtime (`js/sync.js`)

Filter: `organisation_id=eq.{id}` on: `shows`, `journeys`, `schedule_items`, `checklist_items`, `tours`, `organisation_settings`, `files`, `travel_tickets`, `show_files`, `hotel_bookings`, `ideas`, `notes`, `contacts`.

Finance tables (`show_financials`, `invoices`) are omitted from realtime so crew reloads stay safe.
