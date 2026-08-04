# Operate — Proposed Schema ERD

This diagram reflects the target structure in `proposed-schema.md`. It is divided into logical sections for readability.

---

## 1. Accounts, organisations, and access

```mermaid
erDiagram
  auth_users ||--o| profiles : "has"
  organisations ||--o{ organisation_members : "has"
  auth_users ||--o{ organisation_members : "belongs"
  organisations ||--o{ organisation_invites : "invites"
  organisations ||--|| organisation_settings : "has"
  organisations ||--o| organisation_billing_profiles : "has"
  organisations ||--o{ organisation_exchange_rates : "has"
  organisations ||--o| organisation_security_settings : "has"
```

---

## 2. Artists, tours, and shows

```mermaid
erDiagram
  organisations ||--o{ artists : "roster"
  organisations ||--o{ tours : "has"
  organisations ||--o{ venues : "has"
  tours ||--o{ shows : "contains"
  artists ||--o{ shows : "primary_artist"
  venues ||--o{ shows : "hosted_at"
  shows ||--o{ show_artists : "co_billing"
  artists ||--o{ show_artists : "performs"
  shows ||--|| show_advances : "has"
  shows ||--o{ show_advance_schedule_items : "schedule"
  shows ||--o{ show_checklist_items : "checklist"
  shows ||--o{ show_timeline_steps : "timeline"
  shows ||--o{ show_schedule_items : "markers"
  tours ||--o{ tour_checklist_items : "checklist"
  tours ||--o{ tour_timeline_steps : "timeline"
  tours ||--o{ tour_emergency_contacts : "emergency"
```

---

## 3. Contacts, companies, and assignments

```mermaid
erDiagram
  organisations ||--o{ companies : "has"
  organisations ||--o{ contacts : "has"
  companies ||--o{ contacts : "employs"
  shows ||--o{ show_contacts : "assigns"
  contacts ||--o{ show_contacts : "linked"
  tours ||--o{ tour_contacts : "assigns"
  contacts ||--o{ tour_contacts : "linked"
  contact_roles ||--o{ show_contacts : "role"
```

---

## 4. Travel, journeys, and boarding passes

```mermaid
erDiagram
  shows ||--o{ journeys : "anchors"
  tours ||--o{ journeys : "optional"
  journey_kinds ||--o{ journeys : "typed"
  journeys ||--o| flight_journeys : "flight_detail"
  journeys ||--o| ground_transfers : "ground_detail"
  ground_transfers ||--o{ ground_transfer_assignments : "assigns"
  contacts ||--o{ ground_transfer_assignments : "driver"
  journeys ||--o{ boarding_passes : "has"
  journeys ||--o{ journey_files : "documents"
  files ||--o{ boarding_passes : "scan"
  files ||--o{ journey_files : "attached"
```

**Major route (as requested):**

```text
organisations
  → artists
  → tours
  → shows
      → venues
      → show_schedule_items
      → show_contacts
      → journeys
          → flight_journeys
          → ground_transfers
          → boarding_passes
      → hotel_bookings
      → show_financials
      → show_checklist_items
```

---

## 5. Accommodation

```mermaid
erDiagram
  organisations ||--o{ hotels : "has"
  shows ||--o{ hotel_bookings : "books"
  hotels ||--o{ hotel_bookings : "property"
  hotel_bookings ||--o{ hotel_booking_guests : "guests"
  contacts ||--o{ hotel_booking_guests : "guest"
  hotel_bookings ||--o{ hotel_stays : "via_journey"
  journeys ||--o| hotel_stays : "calendar_stay"
  hotel_bookings ||--o{ hotel_booking_files : "documents"
  files ||--o{ hotel_booking_files : "attached"
```

---

## 6. Finance and invoices

```mermaid
erDiagram
  shows ||--|| show_financials : "deal"
  shows ||--o{ show_expenses : "costs"
  shows ||--o{ invoices : "billed"
  invoices ||--o{ invoice_line_items : "lines"
  invoice_statuses ||--o{ invoices : "status"
  invoices ||--o{ invoice_files : "documents"
  files ||--o{ invoice_files : "attached"
```

---

## 7. Files, ideas, notes, and operations

```mermaid
erDiagram
  organisations ||--o{ files : "stores"
  shows ||--o{ show_files : "attachments"
  files ||--o{ show_files : "linked"
  organisations ||--o{ packing_list_items : "packing"
  shows ||--o{ reminders : "reminders"
  organisations ||--o{ itinerary_submissions : "inbox"
  shows ||--o{ itinerary_submissions : "linked"
  itinerary_submissions ||--o{ itinerary_submission_files : "scans"
  files ||--o{ itinerary_submission_files : "attached"
  organisations ||--o{ ideas : "has"
  shows ||--o{ ideas : "linked"
  tours ||--o{ ideas : "linked"
  organisations ||--o{ notes : "has"
  shows ||--o{ notes : "optional"
  tours ||--o{ notes : "optional"
  organisation_settings ||--o| files : "home_header"
```

---

## Relationship notes

| From | To | Cardinality | Delete behaviour |
|------|-----|-------------|------------------|
| shows | tours | N:1 optional | SET NULL on tour delete |
| journeys | shows | N:1 required | CASCADE |
| hotel_bookings | shows | N:1 | CASCADE |
| show_financials | shows | 1:1 | CASCADE |
| boarding_passes | journeys | N:1 | CASCADE |
| show_contacts | contacts | N:1 | RESTRICT (prefer soft-delete contacts) |
| files | organisation | N:1 | CASCADE with storage cleanup job |

---

## Current vs proposed (high-level)

```mermaid
flowchart LR
  subgraph current [Current]
    E[store.events polymorphic]
    SJ[shows JSON blobs]
    OS[org_settings JSON arrays]
  end

  subgraph proposed [Proposed]
    SH[shows]
    JN[journeys]
    CT[contacts]
    FN[show_financials]
    FL[files]
  end

  E --> SH
  E --> JN
  SJ --> CT
  SJ --> FN
  OS --> CT
  OS --> FL
```

This ERD is the target state after all migration phases complete. During transition, legacy JSON columns remain readable alongside new tables (dual-write period).
