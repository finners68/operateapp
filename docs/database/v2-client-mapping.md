# V2 client mapping (UUID-native frontend)

The app is **V2-native**. In-memory `store.v2` holds Postgres entity collections. Screens keep the same look by reading **composed view projections** (`store.events`, `store.trips`, …) built from those collections. Entity **primary keys are UUIDs**.

**Never query `*_v1` tables.**

## Architecture

| Layer | Role |
|-------|------|
| `store.v2.*` | Source of truth after load (shows, journeys, tours, …) |
| `store.events` / `trips` / … | Look-identical view projections (composed) |
| `js/db-v2-repo.js` | Fetch org + upsert/delete by `id` |
| `js/db-v2-compose.js` | V2 collections → view projections |
| `js/db-v2-push.js` | View mutations → V2 upserts by UUID |
| Local key | `operate.v2.state` (legacy `artisthq.v2` is cleared on boot) |

## IDs

- App entity ids = Postgres `uuid` primary keys
- New rows: client generates UUID (`newUuid()` / `uid()`), then upserts with that `id`
- `legacy_id` may still hold **classification tags** for migrated rows (`show_flight:…`, `logistics:…`, `show_hotel:…`) so compose can tell show-embedded flights from calendar travel. New app logic must not treat `legacy_id` as the UI id.

## View projection map

| View field | V2 source |
|------------|-----------|
| `store.trips[]` | `tours` |
| `store.events[kind=show]` | `shows` + venues/artists/journeys/hotels/… |
| `store.events[kind=travel]` | `journeys` classified as calendar travel |
| `store.events[kind=stay]` | `hotel_bookings` (+ hotels) classified as stays |
| `store.events[kind=marker]` | `schedule_items` (`calendar_marker`) |
| Show `flights[]` | `journeys` (`show_flight` / related show + flight) |
| Show `drivers[]` | `journeys` ground_transfer + `journey_contacts` |
| Show `hotel` | `hotel_bookings` tagged `show_hotel:` |
| `store.ideas` / `notes` | `ideas` / `notes` |
| Settings | `organisation_settings`, billing, fx, `user_preferences` |

## Writes

- Upsert on primary key `id` (not `organisation_id,legacy_id`)
- Overnight journeys: `v2NormalizeJourneyTimes` ensures `arrival_at >= departure_at`
- Storage bucket: `operate-documents-v2`

## Auth RPCs

- `create_organisation_v2`
- `accept_organisation_invite_v2`

## Realtime

Filter `organisation_id=eq.{id}` on core V2 tables. Finance tables stay off realtime. Handlers patch `store.v2` when possible, then reload/recompose.
