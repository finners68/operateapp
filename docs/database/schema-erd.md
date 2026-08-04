# Operate — Proposed Schema ERD (Revision 2)

Target structure after revision 2. Journeys are **movement only**. Schedules are **one table**. Hotels are **separate from journeys**.

---

## 1. Organisations, users, and access

```mermaid
erDiagram
  auth_users ||--o| profiles : has
  organisations ||--o{ organisation_members : has
  auth_users ||--o{ organisation_members : belongs
  organisations ||--o{ organisation_invites : invites
  organisations ||--|| organisation_settings : has
  organisations ||--o| organisation_billing_profiles : has
  organisations ||--o{ organisation_exchange_rates : has
  organisations ||--o{ user_preferences : has
  auth_users ||--o{ user_preferences : owns
```

---

## 2. Artists, tours, venues, shows

```mermaid
erDiagram
  organisations ||--o{ artists : roster
  organisations ||--o{ tours : has
  organisations ||--o{ venues : has
  tours ||--o{ shows : contains
  artists ||--o{ shows : primary_artist
  venues ||--o{ shows : hosted_at
  shows ||--|| show_advances : has
  shows ||--o{ show_schedule_items : schedule
  shows ||--o{ show_checklist_items : checklist
  shows ||--o{ show_contacts : assigns
  schedule_item_types ||--o{ show_schedule_items : typed
```

**Note:** `show_timeline_steps`, `show_advance_schedule_items`, and show markers are **not** separate tables — all are `show_schedule_items`.

---

## 3. Contacts and companies

```mermaid
erDiagram
  organisations ||--o{ companies : has
  organisations ||--o{ contacts : has
  companies ||--o{ company_contacts : employs
  contacts ||--o{ company_contacts : works_at
  shows ||--o{ show_contacts : assigns
  contacts ||--o{ show_contacts : linked
  companies ||--o{ show_contacts : optional_promoter
  tours ||--o{ tour_contacts : assigns
  contacts ||--o{ tour_contacts : linked
```

---

## 4. Journeys and movement (no hotels, no markers)

```mermaid
erDiagram
  organisations ||--o{ journeys : has
  tours ||--o{ journeys : optional
  shows ||--o{ journeys : related_show_optional
  journey_kinds ||--o{ journeys : typed
  journeys ||--o| flight_journeys : flight_detail
  journeys ||--o| rail_journeys : rail_detail
  journeys ||--o| ferry_journeys : ferry_detail
  journeys ||--o| ground_transfers : ground_detail
  ground_transfers ||--o{ ground_transfer_contacts : assigns
  contacts ||--o{ ground_transfer_contacts : driver
  journeys ||--o{ boarding_passes : has
  files ||--o{ boarding_passes : scan
  journeys ||--o{ journey_files : other_docs
  files ||--o{ journey_files : attached
```

**Main route:**

```text
organisations
  → tours
  → shows
      → show_schedule_items
      → show_contacts
      → journeys (optional related_show_id)
          → flight_journeys | rail_journeys | ferry_journeys | ground_transfers
          → boarding_passes → files
          → journey_files (non-pass documents only)
      → hotel_bookings → hotels
                      → hotel_booking_shows (multi-show)
      → show_financials
      → show_checklist_items
```

---

## 5. Hotels (not journeys)

```mermaid
erDiagram
  organisations ||--o{ hotels : has
  hotels ||--o{ hotel_bookings : booked
  tours ||--o{ hotel_bookings : optional_tour
  hotel_bookings ||--o{ hotel_booking_shows : covers
  shows ||--o{ hotel_booking_shows : linked
```

One booking spanning multiple shows uses **multiple rows** in `hotel_booking_shows`, not a forced single `show_id` on the booking.

---

## 6. Finance and invoices

```mermaid
erDiagram
  shows ||--|| show_financials : deal
  shows ||--o{ show_expenses : costs
  shows ||--o{ invoices : optional_show
  invoices ||--o{ invoice_line_items : lines
  invoice_statuses ||--o{ invoices : status
```

No `invoice_shows`, `show_income`, or `show_payments` in immediate schema.

---

## 7. Files, packing, reminders, content

```mermaid
erDiagram
  organisations ||--o{ files : stores
  shows ||--o{ show_files : attachments
  files ||--o{ show_files : linked
  organisations ||--o{ packing_lists : has
  tours ||--o{ packing_lists : optional
  packing_lists ||--o{ packing_list_items : items
  auth_users ||--o{ reminders : owns
  shows ||--o{ reminders : optional
  tours ||--o{ reminders : optional
  journeys ||--o{ reminders : optional
  organisations ||--o{ ideas : has
  organisations ||--o{ notes : has
  organisations ||--o{ itinerary_submissions : inbox
  itinerary_submissions ||--o{ itinerary_submission_files : scans
  files ||--o{ itinerary_submission_files : attached
```

---

## 8. Deferred (not in immediate build)

```mermaid
erDiagram
  shows ||--o{ show_artists : DEFERRED
  artists ||--o{ show_artists : DEFERRED
  shows ||--o{ guest_lists : DEFERRED
  guest_lists ||--o{ guest_list_entries : DEFERRED
```

---

## Revision 2 vs revision 1

| Removed from journeys | Moved to |
|----------------------|----------|
| Hotel stay | `hotel_bookings` |
| Calendar marker | `show_schedule_items` |

| Merged tables | Into |
|---------------|------|
| `show_timeline_steps` | `show_schedule_items` |
| `show_advance_schedule_items` | `show_schedule_items` |
| Marker logistics | `show_schedule_items` |

| Removed overlap | Resolution |
|-----------------|------------|
| `boarding_passes` + `journey_files` for same pass | `boarding_passes` only |
| `show_flights` parallel model | `journeys` + `flight_journeys` only |
| Org-wide packing JSON | `packing_lists` + items |
| PIN/tab in org settings | Device-local + `user_preferences` |

---

## Current vs target (high level)

```mermaid
flowchart LR
  subgraph current [Current]
    E[events polymorphic]
    SJ[shows JSON blobs]
    OS[org_settings JSON]
  end

  subgraph target [Revision 2]
    SH[shows]
    JN[journeys movement only]
    HB[hotel_bookings]
    SS[show_schedule_items unified]
    CT[contacts companies]
    FN[show_financials]
  end

  E --> SH
  E --> JN
  E --> HB
  E --> SS
  SJ --> CT
  SJ --> FN
  SJ --> SS
  OS --> CT
```
