# Operate — Database Migration Plan

Phased migration from the current JSON-heavy Supabase schema to the normalised structure in `proposed-schema.md`.  
**Principle:** Add new structure alongside old fields; dual-write; validate; then retire old columns. Never big-bang replace.

---

## Phase 0 — Prepare schema and documentation

| Item | Detail |
|------|--------|
| **Tables added** | None (documentation only) |
| **Application code** | None |
| **Data migrated** | None |
| **Tests** | Review docs with product owner; sign off DECIDE items in `data-migration-map.md` |
| **Rollback** | N/A |
| **Risks** | Unresolved dual-model decisions (runs vs trips, unified journeys) cause rework |
| **Completion criteria** | Product owner answers 8 decision items in `proposed-schema.md`; docs approved |

**Deliverables:** This documentation set (complete).

---

## Phase 1 — Add new tables without removing old fields

| Item | Detail |
|------|--------|
| **Tables added** | `venues`, `hotels`, `companies`, `contacts`, `contact_roles`, `show_statuses`, `journey_kinds`, `invoice_statuses`, `files`, `organisation_billing_profiles`, `organisation_exchange_rates`, `organisation_security_settings`, `artists` (enhanced), `show_advances`, `show_advance_schedule_items`, `show_financials`, `show_expenses`, `invoices`, `invoice_line_items`, `journeys`, `flight_journeys`, `ground_transfers`, `ground_transfer_assignments`, `hotel_bookings`, `boarding_passes`, `packing_list_items`, `reminders`, `itinerary_submissions`, `show_contacts`, `tour_emergency_contacts`, `tour_checklist_items`, `tour_timeline_steps`, `deleted_at` on existing tables |
| **Application code** | None yet — SQL migrations + RLS policies only |
| **Data migrated** | None |
| **Tests** | Migration applies cleanly on empty DB; RLS policy tests per role |
| **Rollback** | Drop new tables (no app dependency) |
| **Risks** | Migration file size; policy mistakes |
| **Completion criteria** | All new tables exist; old columns untouched; RLS tested in Supabase dashboard |

---

## Phase 2 — One-time backfill scripts (server-side)

| Item | Detail |
|------|--------|
| **Tables populated** | All Phase 1 tables from existing `shows`, `org_settings`, `logistics_items`, etc. |
| **Application code** | SQL/RPC scripts only (not app JS yet) |
| **Data migrated** | Full org backfill in maintenance window or per-org job |
| **Tests** | Row counts match; spot-check 10 shows per org; finance totals match `money.eventCalc` |
| **Rollback** | Truncate new tables; retain old JSON |
| **Risks** | Hotel/venue deduplication errors; duplicate journeys from dual flight models |
| **Completion criteria** | Validation report: 100% shows have venue_id; 100% finance rows; journey count documented |

**Backfill order:**
1. artists, venues, hotels (dedupe)
2. contacts, companies, show_contacts
3. show_financials, show_expenses
4. journeys from show.flights + logistics_items
5. hotel_bookings from show.hotel + stay legs
6. files, boarding_passes
7. invoices, packing, reminders (if local export available)
8. tour JSON → tour_* child tables

---

## Phase 3 — Migrate reusable contacts, companies, venues

| Item | Detail |
|------|--------|
| **Focus** | Read path for contacts and venues in app |
| **Application code** | `js/db.js` load: merge `contacts` table + legacy JSON; `shows.js` contact sheets write to new tables |
| **Data migrated** | Live dual-write: new contact → `contacts` + legacy JSON (temporary) |
| **Tests** | Create/edit/delete contact; appears in global list and show assignment |
| **Rollback** | Feature flag `USE_NORMALISED_CONTACTS=false` reads JSON only |
| **Risks** | Dedupe collisions on name alone |
| **Completion criteria** | 2 weeks dual-write with zero contact data loss in test org |

---

## Phase 4 — Migrate hotels and hotel bookings

| Item | Detail |
|------|--------|
| **Focus** | Replace `show.hotel` JSON and stay legs |
| **Application code** | `saveHotel()`, calendar stay legs → `hotel_bookings` + `journeys` |
| **Data migrated** | Dual-write hotel JSON + booking rows |
| **Tests** | Trip Mode timeline shows hotel; booking ref searchable |
| **Rollback** | Read from JSON if booking row missing |
| **Risks** | Two hotel sources diverge during dual-write |
| **Completion criteria** | All shows with hotel JSON have matching booking row |

---

## Phase 5 — Migrate travel and flights (unified journeys)

| Item | Detail |
|------|--------|
| **Focus** | Merge `show.flights[]` and `logistics_items` travel into `journeys` |
| **Application code** | `saveFlight()`, `saveLogisticFor()`, `saveItem()`, Trip Mode timeline reads journeys |
| **Data migrated** | Dual-write to old + new; dedupe embedded vs leg for same route |
| **Tests** | Boarding pass upload on both old flight and new journey paths; calendar display |
| **Rollback** | Timeline reads old events array |
| **Risks** | Highest complexity phase; duplicate timeline entries |
| **Completion criteria** | Single journey row per physical leg; passes linked; no duplicate Trip Mode items |

**Product decision required:** Retire show-embedded flights UI or keep as view on journeys.

---

## Phase 6 — Migrate files and boarding passes

| Item | Detail |
|------|--------|
| **Focus** | Central `files` table; unify `show_flight_passes`, `show_files`, logistics passes |
| **Application code** | `db.js` upload/resolve; `attachPassToShowFlight`, `attachPassToLogisticsItem` |
| **Data migrated** | Backfill `files` from storage paths; link boarding_passes |
| **Tests** | Offline IndexedDB blob + cloud sync; pass thumbnail; delete orphan file |
| **Rollback** | Fall back to legacy_id in show_files |
| **Risks** | Storage path migration; signed URL cache invalidation |
| **Completion criteria** | All storage objects have `files` row; no orphaned paths in bucket |

---

## Phase 7 — Migrate finance

| Item | Detail |
|------|--------|
| **Focus** | `show_financials` RLS; crew cannot SELECT fees |
| **Application code** | `saveFinance()`, `viewFinance()`, `togglePaid()` → new tables; crew app uses `show_overview` view |
| **Data migrated** | Dual-write finance JSON + show_financials |
| **Tests** | Crew user SQL test: cannot select show_financials; owner can; invoice generation |
| **Rollback** | Read finance JSON |
| **Risks** | Breaking crew app if it still reads shows.finance |
| **Completion criteria** | Pen test: crew role zero rows from show_financials; totals match |

---

## Phase 8 — Migrate checklists, timelines, tour data, reminders

| Item | Detail |
|------|--------|
| **Focus** | Tour JSON arrays; local reminders |
| **Application code** | Checklist/timeline CRUD; `pwa.js` reminders → `reminders` table |
| **Data migrated** | trip.checklist/timeline/emergency; store.reminders export on upgrade |
| **Tests** | Trip checklist toggle syncs cross-device; USB reminder fires |
| **Rollback** | Local reminders fallback |
| **Risks** | Reminders were local-only — users lose on reinstall until this phase |
| **Completion criteria** | Reminders sync; tour checklist in relational tables |

---

## Phase 9 — Update application reads

| Item | Detail |
|------|--------|
| **Focus** | All views read from normalised tables first |
| **Application code** | `loadFromSupabase` builds store from joins/views; reduce JSON assembly |
| **Data migrated** | None (read switch) |
| **Tests** | Full regression: home, calendar, show detail, Tour Mode, finance, ideas, notes |
| **Rollback** | Feature flag per domain |
| **Risks** | Performance — mitigate with views and indexes |
| **Completion criteria** | App functions with JSON columns empty in test org |

---

## Phase 10 — Dual-write old and new structures

| Item | Detail |
|------|--------|
| **Focus** | `pushToSupabase` writes both legacy columns and new tables |
| **Application code** | `js/db.js` push/pull sync layer |
| **Data migrated** | Ongoing |
| **Tests** | Edit on device A, pull on device B; conflict on same field |
| **Rollback** | Stop writing new tables |
| **Risks** | Crew full-push still fails on owner tables — fix role-scoped push |
| **Completion criteria** | 30-day dual-write period with monitoring; zero sync errors in Sentry/logs |

---

## Phase 11 — Validate migrated data

| Item | Detail |
|------|--------|
| **Focus** | Automated validation suite |
| **Checks** | Row counts; finance sum parity; journey completeness; file path existence; FK integrity |
| **Application code** | Admin validation RPC or script |
| **Tests** | Run against production snapshot (anonymised) |
| **Rollback** | N/A |
| **Risks** | Hidden edge cases in legacy JSON |
| **Completion criteria** | Validation report signed off; <0.1% rows flagged for manual fix |

---

## Phase 12 — Stop writing old fields

| Item | Detail |
|------|--------|
| **Focus** | Push stops writing JSON blobs |
| **Application code** | Remove dual-write to shows.hotel, finance, etc. |
| **Data migrated** | Final sync pass |
| **Tests** | New edits do not appear in old columns |
| **Rollback** | Re-enable dual-write flag |
| **Risks** | Old app versions still writing JSON — require min app version |
| **Completion criteria** | Old columns unchanged for 7 days while app writes new tables only |

---

## Phase 13 — Remove obsolete JSON columns

| Item | Detail |
|------|--------|
| **Focus** | DROP COLUMN after verification |
| **Columns removed** | shows.hotel, driver, promoter, finance, advance, show_contacts; org_settings.contacts, invoices, itineraries, packing, artists; logistics_items.passes; trips.checklist, timeline, emergency |
| **Application code** | Remove dead mapping code |
| **Tests** | Full regression on clean schema |
| **Rollback** | Restore from backup / point-in-time recovery only |
| **Risks** | Irreversible — only after Phase 11 sign-off |
| **Completion criteria** | Schema matches proposed-schema.md; no JSON business blobs remain except documented exceptions |

---

## Cross-cutting concerns

### Offline sync protocol (future)

| Concern | Approach |
|---------|----------|
| UUID generation | Client generates UUID v4; Postgres accepts client id |
| Tombstones | `deleted_at` set on delete; sync propagates tombstone |
| Conflict resolution | Last-write-wins on `updated_at`; finance conflicts require manager |
| `_known` set | Retire after tombstones proven in Phase 10 |

### Application version gating

Require minimum app version before Phase 12. Display upgrade prompt for old clients still writing JSON.

### Crew role push fix (required before Phase 10)

Split `pushToSupabase` by role:

- **crew:** journeys, checklist, timeline, ideas, notes only
- **manager/owner:** full push

Currently crew writes fail when push includes shows/trips/org_settings.

### Orphan cleanup fix (required before Phase 6)

Add orphan delete for `show_flights`, `show_checklist_items`, `show_timeline_steps` or deprecate those tables when journeys/checklists fully migrated.

### Min app changes by phase (summary)

| Phase | Files likely touched |
|-------|---------------------|
| 3 | `db.js`, `app.js`, `shows.js` |
| 4 | `shows.js`, `calendar.js`, `trip.js` |
| 5 | `shows.js`, `calendar.js`, `trip.js`, `state.js` |
| 6 | `db.js`, `app.js`, `trip.js` |
| 7 | `shows.js`, `app.js`, RLS only |
| 8 | `app.js`, `trip.js`, `pwa.js`, `shows.js` |
| 9–12 | `db.js`, `sync.js`, all readers |
| 13 | `db.js` cleanup |

---

## Timeline estimate (indicative)

| Phase | Duration | Dependency |
|-------|----------|------------|
| 0 | 1 week | — |
| 1 | 1–2 weeks | Phase 0 |
| 2 | 1 week | Phase 1 |
| 3–4 | 2 weeks each | Phase 2 |
| 5 | 3–4 weeks | Phase 4 |
| 6 | 2 weeks | Phase 5 |
| 7 | 2 weeks | Phase 2 backfill |
| 8 | 2 weeks | Phase 1 |
| 9–10 | 4 weeks | Phases 3–8 |
| 11 | 1 week | Phase 10 |
| 12–13 | 2 weeks | Phase 11 |

**Total:** ~6–9 months for safe full migration with dual-write validation.

---

## Success metrics

1. Zero finance fields readable by crew in SQL tests
2. All boarding passes linked to `files` + `journeys`
3. Cross-device sync passes for 10-show tour test case
4. Query `upcoming_shows` under 50ms for org with 500 shows
5. No data loss vs pre-migration export snapshot

---

## What was intentionally not included

- SQL migration file contents (per request)
- Application code changes (per request)
- Deployment steps to production Supabase

These documents are the planning baseline for implementation work in subsequent tasks.
