# Operate Database Planning — AI Upload Bundle

Use this folder to give another AI everything it needs to interpret Operate’s database redesign **without access to the repository**.

## Downloadable zip files

Ready-made bundles in [`downloads/`](./downloads/):

| File | Contents |
|------|----------|
| [`operate-database-planning-minimum.zip`](./downloads/operate-database-planning-minimum.zip) | 5 planning docs + interpretation prompt + README |
| [`operate-database-planning-with-source.zip`](./downloads/operate-database-planning-with-source.zip) | Minimum bundle + `state.js`, `db.js`, `sync.js`, `shows.js`, `calendar.js`, `trip.js`, migrations 001 & 003 |

Download either zip and upload its contents to your other AI session.

---

## Minimum bundle (5 files — upload these)

Upload in this order:

| # | File | Purpose |
|---|------|---------|
| 1 | [proposed-schema.md](./proposed-schema.md) | **Start here.** Summary, problems, target ~52 tables, architecture decisions, JSON policy, views, RLS |
| 2 | [current-data-inventory.md](./current-data-inventory.md) | Every field stored today, CRUD paths, Supabase mapping, conflicting shapes |
| 3 | [schema-erd.md](./schema-erd.md) | Mermaid ER diagrams |
| 4 | [data-migration-map.md](./data-migration-map.md) | Old field → new table mapping (DIRECT / TRANSFORM / SPLIT / OBSOLETE / DECIDE) |
| 5 | [migration-plan.md](./migration-plan.md) | 13-phase rollout, dual-write, risks, rollback |

Copy-paste paths (relative to repo root):

```
docs/database/proposed-schema.md
docs/database/current-data-inventory.md
docs/database/schema-erd.md
docs/database/data-migration-map.md
docs/database/migration-plan.md
```

Also attach [INTERPRETATION-PROMPT.md](./INTERPRETATION-PROMPT.md) as the instruction prompt for the other AI.

---

## Optional bundle (verify plan against code)

Add these **only if** the interpreting AI must cross-check the docs against the live app:

### Application store and sync

```
js/state.js
js/db.js
js/sync.js
```

### Current Supabase schema

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/003_collab_security.sql
```

Skip `supabase/migrations/combined_dev_setup.sql` unless discussing dev hardwire (001+002 only, not 003).

### Feature CRUD (pick by topic)

```
js/shows.js      — shows, finance, hotel, flights, advance, contacts
js/calendar.js   — logistics legs (travel/stay/marker)
js/trip.js       — Tour Mode, packing, named trips
js/app.js        — invoices, global contacts, settings
js/auth.js       — org membership, roles, invites
```

See [optional-source-manifest.txt](./optional-source-manifest.txt) for the full optional list.

---

## Recommended upload sizes

| Goal | Files | Count |
|------|-------|-------|
| Interpret the plan | 5 docs + INTERPRETATION-PROMPT.md | **6 files** |
| Validate plan vs code | 6 above + state.js + db.js + 001 + 003 | **10 files** |
| Deep implementation review | 10 above + shows.js + calendar.js + trip.js | **13 files** |

---

## Do not upload

- Entire `js/` folder (inventory doc already extracts fields)
- `.env` or any secrets
- Full demo seed in `state.js` (inventory covers field shapes)
- All migrations (001 + 003 are enough)

---

## Product decisions for the interpreting AI

The other AI should resolve **DECIDE** items documented in `proposed-schema.md` and `data-migration-map.md`:

1. Persist auto-grouped tour runs vs keep computed
2. Multi-artist b2b / fee splits
3. Retire show-embedded flights UI after journey unification
4. Sync reminders to cloud
5. Guest lists — text vs normalised entries

Full prompt with tasks: [INTERPRETATION-PROMPT.md](./INTERPRETATION-PROMPT.md)

---

## Context

These documents were produced as **research and planning only**. No application code, SQL migrations, or Supabase config were changed as part of this work.
