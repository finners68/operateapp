# Prompt for Interpreting AI

Copy everything below the line into your other AI session, then attach the files listed in [README.md](./README.md).

---

You are reviewing **Operate**’s database redesign planning documents for a tour-management PWA (shows, travel, finance, Trip Mode). The app currently uses a single client-side `store` synced to Supabase with heavy JSONB columns.

## Files attached

**Required (read in this order):**

1. `proposed-schema.md` — target schema and architecture decisions
2. `current-data-inventory.md` — what the app stores today
3. `schema-erd.md` — ER diagrams
4. `data-migration-map.md` — field-level migration mapping
5. `migration-plan.md` — phased implementation plan

**Optional (if attached):** `js/state.js`, `js/db.js`, `supabase/migrations/001_initial_schema.sql`, `supabase/migrations/003_collab_security.sql`, and feature JS files — use these only to verify or challenge the docs.

## Your tasks

### 1. Summarise the target model

In plain language, explain:

- The main entities and how they relate (organisations → shows → journeys → files, etc.)
- What moves out of JSON into relational tables
- How finance will be protected from crew users
- Approximately how many tables are proposed

### 2. Flag gaps and risks

Review the five documents and list:

- Missing entities or fields not mapped in `data-migration-map.md`
- Contradictions between `current-data-inventory.md` and `proposed-schema.md`
- Migration phases that seem under-scoped or over-scoped
- RLS or sync risks for offline/multi-device use

### 3. Resolve DECIDE items

For each item below, state a **recommendation** and **rationale**. If you need product input, say what question to ask the owner.

| # | Decision | Options |
|---|----------|---------|
| 1 | **Auto-grouped tour runs** | Keep computed in app (`runs()`) vs persist as `tours.is_auto_generated` rows |
| 2 | **Multi-artist b2b shows** | Single primary artist only vs `show_artists` junction vs fee split table |
| 3 | **Show-embedded flights UI** | Retire after unified `journeys` vs keep as view alias |
| 4 | **Reminders** | Stay local-only vs sync to new `reminders` table |
| 5 | **Guest lists** | Keep as text in `show_advances.guestlist_notes` vs normalise to `guest_list_entries` |

### 4. Answer these specific questions

1. Is the unified `journeys` model (merging `show.flights[]` and `logistics_items` travel/stay) the right call? What edge cases break?
2. Should `hotels` and `venues` stay separate tables (as proposed) or share a generic locations table?
3. Are ~52 tables too many, about right, or still too bundled?
4. What should Phase 1 SQL migrations include vs defer?
5. What is the single highest-risk step in the 13-phase plan?

### 5. Output format

Structure your response as:

```
## Executive summary
(3–5 sentences)

## Target model overview
(bullet list of major table groups)

## Gaps and risks
(numbered list)

## DECIDE recommendations
(table: decision | recommendation | rationale)

## Answers to specific questions
(1–5)

## Suggested next step
(one concrete action for the product owner)
```

Do not write SQL migrations or application code unless explicitly asked. This is interpretation and review only.
