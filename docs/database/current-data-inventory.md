# Operate — Current Data Inventory

**Purpose:** Document everything the application currently stores, how it is used, and where it lives in Supabase.  
**Source of truth:** Application code (`js/state.js`, `js/db.js`, `js/sync.js`, feature modules). The SQL schema is secondary — several app fields are not first-class columns.

**Last reviewed:** 2026-08-04 (repository `main`, commit era post-`42790fb`).

---

## How data flows today

| Layer | Mechanism |
|-------|-----------|
| In-memory | Single `store` object |
| Local persistence | `localStorage` key `artisthq.v2` via `db.read()` / `db.write()` |
| Large binaries | IndexedDB database `operate-blobs`, store `blobs` |
| Cloud | Supabase Postgres + Storage bucket `operate-documents` |
| Sync | Debounced push (~800ms) in `js/db.js`; realtime pull in `js/sync.js` |
| IDs | Client `uid(prefix)` → `{prefix}_{uuid16}{seq}`; cloud also has Postgres `uuid` PK + `legacy_id` text |

### Root store keys

| Key | Type | Synced | Supabase location | Notes |
|-----|------|--------|-------------------|-------|
| `_seq` | number | Yes | `org_settings.seq` | Monotonic counter for ID generation |
| `_known` | string[] | No | — | Device sync metadata; orphan-delete guard |
| `activeTripId` | string \| null | Yes | `org_settings.active_trip_id` | Named trip, not computed run |
| `activeShowId` | string \| null | Yes | `org_settings.active_show_id` | Trip Mode live show |
| `tab` | string | Partial | `org_settings.tab` | UI tab; preserved locally on pull |
| `settings` | object | Yes (JSON) | `org_settings.settings` | See § Settings |
| `artists` | array | Yes (JSON) | `org_settings.artists` | Minimal roster |
| `events` | array | Yes (split) | `shows` + `logistics_items` + child tables | Polymorphic by `kind` |
| `trips` | array | Yes | `trips` | Named/manual tours |
| `ideas` | array | Yes | `ideas` | |
| `notes` | array | Yes | `notes` | |
| `contacts` | array | Yes (JSON) | `org_settings.contacts` | Global rolodex |
| `invoices` | array | Yes (JSON) | `org_settings.invoices` | |
| `itineraries` | array | Yes (JSON) | `org_settings.itineraries` | Inbox scans |
| `packing` | array | Yes (JSON) | `org_settings.packing` | Global Trip Mode checklist |
| `reminders` | array | **No** | — | Local notifications only |
| `drivers` | array | **No** | — | Legacy empty seed key; unused |
| `hotels` | array | **No** | — | Legacy empty seed key; unused |

### Derived (not stored)

| Concept | Computation | Used by |
|---------|-------------|---------|
| Tour **runs** | `runs()` groups consecutive shows | Tour Mode, Shows/Tours UI |
| Run timeline | `runTimeline(run)` merges logistics + embedded show data | Trip Mode |
| Finance totals | `money.summary()` | Finance tab, stats |

---

## Field inventory by object

Legend: **Req** = required in practice; **Sens** = sensitive; **JSON** = nested or blob column; **Multi** = array/repeatable.

### Store — Settings (`store.settings`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| settings | artistName | string | No | `'You'` | Profile, show create | seed/migrate | `editProfileName()` | Settings, show rows | — | `org_settings.settings` | Yes | No | No | No |
| settings | packingTemplate | string[] | No | 9-item list | Trip create, packing | seed | `sheetPacking()` | Settings | — | `org_settings.settings` | Yes | Yes | No | No |
| settings | baseCurrency | string | No | `'EUR'`/derived | Money display | seed/migrate | `saveCurrency()` | Finance, shows | — | `org_settings.settings` | Yes | No | No | No |
| settings | baseCurrencyAuto | boolean | No | true | Currency auto | migrate | implicit | — | — | `org_settings.settings` | Yes | No | No | No |
| settings | fx | Record\<string,number\> | No | 13 currencies | FX conversion | seed/migrate | `saveCurrency()` | Finance | — | `org_settings.settings` | Yes | No | No | No |
| settings | billing.name | string | No | `''` | Invoices | migrate | `saveBilling()` | Invoice PDF | — | `org_settings.settings` | Yes | No | No | No |
| settings | billing.address | string | No | `''` | Invoices | migrate | `saveBilling()` | Invoice PDF | — | `org_settings.settings` | Yes | No | No | No |
| settings | billing.taxId | string | No | `''` | Invoices | migrate | `saveBilling()` | Invoice PDF | — | `org_settings.settings` | Yes | No | **Yes** | No |
| settings | billing.iban | string | No | `''` | Invoices | migrate | `saveBilling()` | Invoice PDF | — | `org_settings.settings` | Yes | No | **Yes** | No |
| settings | billing.email | string | No | `''` | Invoices | migrate | `saveBilling()` | Invoice PDF | — | `org_settings.settings` | Yes | No | No | No |
| settings | invoicePrefix | string | No | `'AHQ'` | Invoice numbers | seed/migrate | `saveBilling()` | Invoices | — | `org_settings.settings` | Yes | No | No | No |
| settings | invoiceSeq | number | No | `1` | Invoice numbers | seed/migrate | `createInvoiceFromEvent()` | — | — | `org_settings.settings` | Yes | No | No | No |
| settings | invoiceTerms | number | No | `14` | Payment terms days | seed/migrate | `saveBilling()` | Invoices | — | `org_settings.settings` | Yes | No | No | No |
| settings | accountType | enum | No | `'dj'` | Onboarding copy | seed/migrate | `setAccountType()` | Settings | — | `org_settings.settings` | Yes | No | No | No |
| settings | homeAirport | string | No | `'AMS'` | Tour grouping, currency | seed/migrate | `editHomeAirport()` | Settings, runs | — | `org_settings.settings` | Yes | No | No | No |
| settings | homeHeader | string | No | null | Home hero image | upload | `uploadHomeHeader()` | Home | `removeHomeHeader()` | `org_settings.settings` (path) | Yes | No | No | No |
| settings | _homeHeaderPath | string | No | — | Storage path cache | upload | — | — | — | stripped on push | No | No | No | No |
| settings | _homeHeaderUrl | string | No | — | Signed URL cache | pull | — | — | — | not synced | No | No | No | No |
| settings | security.enabled | boolean | No | false | App lock | migrate | `toggleSecurity()` | Settings | — | `org_settings.settings` | Yes | No | No | No |
| settings | security.pin | string | No | `''` | Hashed passcode | setup | `pinSubmit()` | Lock screen | — | `org_settings.settings` | Yes | No | **Yes** | No |
| settings | security.scope | enum | No | `'finance'` | Lock scope | migrate | `setLockScope()` | Settings | — | `org_settings.settings` | Yes | No | No | No |
| settings | security.biometric | boolean | No | false | Face ID | migrate | `toggleBiometric()` | Lock screen | — | `org_settings.settings` | Yes | No | No | No |
| settings | usbReminder | boolean | No | true | USB auto-reminder | — | Settings (if exposed) | — | — | `org_settings.settings` | Yes | No | No | No |

### Store — Artists (`store.artists[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| artist | id | string | Yes | `'art_1'` | Show.artist (string name, not FK) | seed | — | — | — | `org_settings.artists[]` | Yes | No | No | **No — name only on show** |
| artist | name | string | Yes | `'You'` | Show default artist | seed | — | Settings | — | `org_settings.artists[]` | Yes | No | No | No |

### Event — Show (`store.events[]`, `kind: 'show'`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show | id | string | Yes | `uid('evt')` | Everywhere | `saveEvent()` | — | All show UI | `confirmDeleteEvent()` | `shows.legacy_id` | No | No | No | **Yes** |
| show | kind | `'show'` | Yes | `'show'` | Discriminator | create | — | — | delete event | implied | No | No | No | No |
| show | artist | string | No | settings.artistName | Show header | create | `saveEvent()` | Show, calendar | delete | `shows.artist` | No | No | No | No |
| show | tripId | string | No | null | Named trip link | create | `saveTrip` side effect | Trip list | trip delete clears | `shows.trip_legacy_id` | No | No | No | **Yes → trips** |
| show | status | enum | No | `'confirmed'` | Filters, chips | create | `saveEvent()` | Lists, badges | delete | `shows.status` | No | No | No | No |
| show | color | string | No | `'green'` | Calendar dot | create | `saveEvent()` | Calendar, lists | delete | `shows.color` | No | No | No | No |
| show | venue | string | Yes* | — | Primary label | create | `saveEvent()` | Everywhere | delete | `shows.venue` | No | No | No | No |
| show | city | string | No | — | Location | create | `saveEvent()` | Lists, maps | delete | `shows.city` | No | No | No | No |
| show | country | string | No | `''` | Location | create | `saveEvent()` | Show detail | delete | `shows.country` | No | No | No | No |
| show | date | date string | Yes | — | Scheduling | create | `saveEvent()` | Calendar, countdown | delete | `shows.show_date` | No | No | No | No |
| show | setTime | time string | No | `''` | Countdown, timeline | create | `saveEvent()`, scan | Hero, detail | delete | `shows.set_time` | No | No | No | No |
| show | endTime | time string | No | `''` | Set display | create | `saveEvent()`, scan | Detail | delete | `shows.end_time` | No | No | No | No |
| show | arrival | time string | No | `''` | Venue arrival | create | `saveEvent()` | Detail | delete | `shows.arrival` | No | No | No | No |
| show | venueAddr | string | No | `''` | Maps, advance | create | `saveEvent()`, scan | Detail | delete | `shows.venue_addr` | No | No | No | No |
| show | notes | string | No | `''` | Free text | create | `saveEventNotes()` | Detail | delete | `shows.notes` | No | No | No | No |
| show | content | string | No | `''` | Content plan | create | `saveEvent()` | Detail | delete | `shows.content` | No | No | No | No |
| show | setDone | boolean | No | false | Trip Mode | Trip Mode | `completeRunStep()` | Timeline | delete | `shows.set_done` | No | No | No | No |
| show | flightNo | string | No | — | Live flight widget | manual/API | `saveFlightInfo()` | Show detail | delete | `shows.flight_no` | No | No | No | No |
| show | terminal | string | No | — | Live flight | API/manual | `flightTrack()` | Widget | delete | `shows.terminal` | No | No | No | No |
| show | gate | string | No | — | Live flight | API/manual | `flightTrack()` | Widget | delete | `shows.gate` | No | No | No | No |
| show | fstatus | string | No | — | Live flight | API/manual | `flightTrack()` | Widget | delete | `shows.fstatus` | No | No | No | No |
| show | delay | string | No | — | Live flight | API/manual | `flightTrack()` | Widget | delete | `shows.delay` | No | No | No | No |
| show | fiUpdated | number (ms) | No | — | Staleness | API | `flightTrack()` | Widget | delete | `shows.fi_updated` | No | No | No | No |
| show | fiLive | boolean | No | — | Live badge | API | `flightTrack()` | Widget | delete | `shows.fi_live` | No | No | No | No |

### Show — Hotel (`show.hotel` object)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.hotel | name | string | No | `''` | Accommodation | `saveHotel()` | `saveHotel()` | Travel group | `removeHotel()` | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | address | string | No | `''` | Maps | `saveHotel()` | `saveHotel()` | Detail | remove | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | postcode | string | No | `''` | Address | `saveHotel()` | `saveHotel()` | Detail | remove | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | checkin | date | No | — | Timeline | `saveHotel()` | `saveHotel()` | Detail | remove | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | checkout | date | No | — | Timeline | `saveHotel()` | `saveHotel()` | Detail | remove | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | conf | string | No | — | Booking ref | `saveHotel()` | `saveHotel()` | Detail | remove | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | notes | string | No | — | Room notes | `saveHotel()` | `saveHotel()` | Detail | remove | `shows.hotel` | **Yes** | No | No | No |
| show.hotel | done | boolean | No | false | Trip Mode | Trip Mode | toggle | Timeline | remove | `shows.hotel` | **Yes** | No | No | No |

**Problems:** Duplicates calendar `kind:'stay'` legs; hotel not reusable; cannot query org-wide hotel bookings.

### Show — Finance (`show.finance` object)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.finance | fee | number | No | 0 | Deal, invoices | show create | `saveFinance()` | Finance tab | — | `shows.finance` | **Yes** | No | **Yes** | No |
| show.finance | currency | string | No | baseCurrency | Money fmt | show create | `saveFinance()` | Finance | — | `shows.finance` | **Yes** | No | No | No |
| show.finance | dealType | string | No | `'Guarantee'` | Deal label | show create | `saveFinance()` | Detail | — | `shows.finance` | **Yes** | No | No | No |
| show.finance | expenses | array | No | `[]` | Net calc | — | `saveExpense()` | Finance | `delExpense()` | `shows.finance` | **Yes** | **Yes** | **Yes** | expense.id |
| show.finance.expense | id | string | Yes | uid | — | `saveExpense()` | — | — | `delExpense()` | nested JSON | **Yes** | No | No | No |
| show.finance.expense | label | string | No | — | Display | `saveExpense()` | — | Finance | delete | nested JSON | **Yes** | No | No | No |
| show.finance.expense | amount | number | No | — | Net calc | `saveExpense()` | — | Finance | delete | nested JSON | **Yes** | No | **Yes** | No |
| show.finance | perDiem | number | No | 0 | Net calc | show create | `saveFinance()` | Finance | — | `shows.finance` | **Yes** | No | **Yes** | No |
| show.finance | commission | number | No | 0 | % deduction | show create | `saveFinance()` | Finance | — | `shows.finance` | **Yes** | No | **Yes** | No |
| show.finance | paid | boolean | No | false | Outstanding | show create | `togglePaid()`, invoice | Finance, stats | — | `shows.finance` | **Yes** | No | **Yes** | No |
| show.finance | estimated | boolean | No | false | Demo/placeholder | seed | — | Finance badge | — | `shows.finance` | **Yes** | No | No | No |
| show.finance | notDisclosed | boolean | No | false | Hide fee UI | — | `saveFinance()` | Finance | — | `shows.finance` | **Yes** | No | **Yes** | No |

**Problems:** Entire deal in JSON; crew role can SELECT shows row and read finance; no audit trail.

### Show — Promoter (`show.promoter`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.promoter | name | string | No | — | Artist liaison | `savePromoter()` | `savePromoter()` | Venue group | `removePromoter()` | `shows.promoter` | **Yes** | No | No | No |
| show.promoter | phone | string | No | — | Call | `savePromoter()` | edit | Detail, hero | remove | `shows.promoter` | **Yes** | No | No | No |
| show.promoter | whatsapp | string | No | — | WhatsApp | `savePromoter()` | edit | Detail | remove | `shows.promoter` | **Yes** | No | No | No |

### Show — Drivers (`show.drivers[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.drivers[] | id | string | Yes | uid('drv') | Trip timeline | `saveDriver()` | — | Transport | `removeDriver()` | `shows.driver` JSON array | **Yes** | **Yes** | No | **Yes** |
| show.drivers[] | journey | string | No | — | Route label | `saveDriver()` | edit | Timeline | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | time | time | No | — | Pickup | `saveDriver()` | edit | Timeline | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | name | string | No | — | Contact | `saveDriver()` | edit | Detail | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | phone | string | No | — | Call | `saveDriver()` | edit | Detail | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | whatsapp | string | No | — | Chat | `saveDriver()` | edit | Detail | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | pickup | string | No | — | Location | `saveDriver()` | edit | Detail | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | notes | string | No | — | Notes | `saveDriver()` | edit | Detail | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | noGround | boolean | No | false | Uber mode | `saveDriver()` | edit | Detail | remove | JSON | **Yes** | No | No | No |
| show.drivers[] | done | boolean | No | false | Trip Mode | Trip Mode | toggle | Timeline | remove | JSON | **Yes** | No | No | No |
| show.driver | object | — | No | mirror | Legacy | migrate | — | — | — | `shows.driver` | **Yes** | No | No | No |

**Problems:** Duplicates calendar driver legs; not linked to global contacts.

### Show — Key contacts (`show.contacts[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.contacts[] | id | string | Yes | uid | — | `saveEventContact()` | edit | Venue group | `delEventContact()` | `shows.show_contacts` | **Yes** | **Yes** | No | **Yes** |
| show.contacts[] | name | string | No | — | Display | save | edit | Detail | delete | JSON | **Yes** | No | No | No |
| show.contacts[] | role | string | No | — | Label | save | edit | Detail | delete | JSON | **Yes** | No | No | No |
| show.contacts[] | phone | string | No | — | Call | save | edit | Detail | delete | JSON | **Yes** | No | No | No |
| show.contacts[] | whatsapp | string | No | — | Chat | save | edit | Detail | delete | JSON | **Yes** | No | No | No |

### Show — Advance (`show.advance`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.advance | stage | string | No | — | Advance | `saveAdvance()` | edit | Venue group | — | `shows.advance` | **Yes** | No | No | No |
| show.advance | schedule | array | No | `[]` | Day schedule | `saveAdvance()` | edit | Detail | — | JSON | **Yes** | **Yes** | No | No |
| show.advance.schedule[] | time | string | No | — | — | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance.schedule[] | label | string | No | — | — | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | access | string | No | — | Advance | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | soundcheck | string | No | — | Advance | save/scan | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | curfew | string | No | — | Advance | save/scan | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | dressingRoom | string | No | — | Advance | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | guestlist | string | No | — | Advance | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | catering | string | No | — | Advance | save/scan | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | parking | string | No | — | Advance | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | wifi | string | No | — | Advance | save | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | navAddr | string | No | — | Maps | save/scan | edit | Detail | — | JSON | **Yes** | No | No | No |
| show.advance | remarks | string | No | — | Advance | save | edit | Detail | — | JSON | **Yes** | No | No | No |

### Show — Embedded flights (`show.flights[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.flights[] | id | string | Yes | uid('fl') | Passes | `saveFlight()` | — | Show detail | `delFlight()` | `show_flights.legacy_id` | No | **Yes** | No | **Yes** |
| show.flights[] | code | string | No | — | Flight no | save | edit | Detail | delete | `show_flights.code` | No | No | No | No |
| show.flights[] | from | string | No | — | IATA | save | edit | Detail | delete | `show_flights.from_code` | No | No | No | No |
| show.flights[] | to | string | No | — | IATA | save | edit | Detail | delete | `show_flights.to_code` | No | No | No | No |
| show.flights[] | dep | string | No | — | `YYYY-MM-DD HH:mm` | save | edit | Detail | delete | `show_flights.dep` | No | No | No | No |
| show.flights[] | arr | string | No | — | datetime string | save | edit | Detail | delete | `show_flights.arr` | No | No | No | No |
| show.flights[] | seat | string | No | — | Seat | save | edit | Detail | delete | `show_flights.seat` | No | No | No | No |
| show.flights[] | done | boolean | No | false | Trip Mode | Trip Mode | toggle | Timeline | delete | not in DB | No | No | No | No |
| show.flights[] | passes | array | No | `[]` | Boarding passes | upload | — | Pass thumb | `delFlightPass()` | `show_flight_passes` | No | **Yes** | No | pass.id |

**Problems:** Parallel model to calendar `kind:'travel'` legs; `done` not synced; dep/arr stored as text not timestamptz.

### Show — Checklist (`show.checklist[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.checklist[] | id | string | Yes | uid | — | `addEventCheckPrompt()` | — | Prep group | `delEventCheck()` | `show_checklist_items` | No | **Yes** | No | **Yes** |
| show.checklist[] | label | string | Yes | — | Display | add/sheet | edit | Detail, home | delete | column | No | No | No | No |
| show.checklist[] | done | boolean | No | false | Progress | toggle | `toggleEventCheck()` | Detail | delete | column | No | No | No | No |

### Show — Timeline (`show.timeline[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| show.timeline[] | id | string | Yes | uid | — | `saveShowTimelineStep()` | edit | Prep group | `delShowTimelineStep()` | `show_timeline_steps` | No | **Yes** | No | **Yes** |
| show.timeline[] | time | string | No | — | Schedule | save | edit | Detail | delete | column | No | No | No | No |
| show.timeline[] | title | string | No | — | Label | save | edit | Detail | delete | column | No | No | No | No |
| show.timeline[] | sub | string | No | — | Subtitle | save | edit | Detail | delete | column | No | No | No | No |
| show.timeline[] | done | boolean | No | false | Progress | toggle | toggle | Detail | delete | column | No | No | No | No |

### Show — Attachments (`show.attachments[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| attachment | id | string | Yes | uid('att') | Files | upload | — | Prep group | `delAttachment()` | `show_files` | No | **Yes** | No | **Yes** |
| attachment | kind | enum | No | image/pdf | Viewer | upload | — | Thumb | delete | derived mime | No | No | No | No |
| attachment | name | string | No | filename | Label | upload | — | Detail | delete | `show_files.name` | No | No | No | No |
| attachment | data | string | No | data URL/path | Display | upload | — | Viewer | delete | Storage + signed URL | No | No | No | No |
| attachment | _storagePath | string | No | — | Sync | upload | — | — | delete | `show_files.storage_path` | No | No | No | No |
| attachment | _idb | boolean | No | — | Offline blob | stash | — | — | — | local only | No | No | No | No |
| attachment | mime | string | No | — | MIME | upload | — | — | delete | `show_files.mime_type` | No | No | No | No |

---

### Event — Logistics travel (`kind: 'travel'`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| travel | id | string | Yes | uid('evt') | Calendar | `saveLogisticFor()` | — | Calendar, Trip | `delItem()` | `logistics_items.legacy_id` | No | No | No | **Yes** |
| travel | kind | `'travel'` | Yes | — | Discriminator | create | — | — | delete | column | No | No | No | No |
| travel | showId | string | No | auto | Show link | assign | edit | Day panel | delete | `show_legacy_id` | No | No | No | **Yes → show** |
| travel | date | date | Yes | — | Calendar | create | `saveItem()` | Calendar | delete | `item_date` | No | No | No | No |
| travel | title | string | No | normalized | Label | create | — | Row | delete | `title` | No | No | No | No |
| travel | icon | enum | No | plane | Type | create | `saveItem()` | Icon | delete | `icon` | No | No | No | No |
| travel | from | string | No | — | Route | create | save | Detail | delete | packed in `info` JSON | **Yes** | No | No | No |
| travel | to | string | No | — | Route | create | save | Detail | delete | packed in `info` JSON | **Yes** | No | No | No |
| travel | flightNo | string | No | — | Flight | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| travel | start | time | No | — | Schedule | create | save | Detail | delete | `start_time` | No | No | No | No |
| travel | end | time | No | — | Schedule | create | save | Detail | delete | `end_time` | No | No | No | No |
| travel | driverName | string | No | — | Driver leg | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| travel | phone | string | No | — | Contact | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| travel | whatsapp | string | No | — | Contact | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| travel | gate | string | No | — | Live flight | API | save | Widget | delete | packed in `info` | **Yes** | No | No | No |
| travel | terminal | string | No | — | Live flight | API | save | Widget | delete | packed in `info` | **Yes** | No | No | No |
| travel | fstatus | string | No | — | Live flight | API | save | Widget | delete | packed in `info` | **Yes** | No | No | No |
| travel | delay | string | No | — | Live flight | API | save | Widget | delete | packed in `info` | **Yes** | No | No | No |
| travel | info | string | No | — | Notes OR JSON v2 | create | save | Detail | delete | `logistics_items.info` | **Often JSON** | No | No | No |
| travel | legacyTitle | string | No | — | Import recovery | import | — | — | — | local only | No | No | No | No |
| travel | allDay | boolean | No | false | Calendar | — | — | — | delete | `all_day` | No | No | No | No |
| travel | done | boolean | No | false | Trip Mode | Trip Mode | toggle | Timeline | delete | `done` | No | No | No | No |
| travel | passes | array | No | `[]` | Boarding passes | upload | — | Calendar | `delItemPass()` | `passes` JSON + `show_files` | **Yes** | **Yes** | No | pass.id |
| travel | fiUpdated | number | No | — | Live API | API | — | — | — | **not synced** | No | No | No | No |
| travel | fiLive | boolean | No | — | Live API | API | — | — | — | **not synced** | No | No | No | No |

### Event — Logistics stay (`kind: 'stay'`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| stay | id, kind, showId, date, title, done, passes | — | — | — | Same as travel | `saveLogisticFor()` | `saveItem()` | Calendar | `delItem()` | `logistics_items` | Mixed | — | — | — |
| stay | place | string | No | — | Hotel name | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| stay | addr | string | No | — | Address | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| stay | bookingRef | string | No | — | Confirmation | create | save | Detail | delete | packed in `info` | **Yes** | No | No | No |
| stay | info | string | No | — | Check-in text | create | save | Detail | delete | `info` (JSON v2) | **Yes** | No | No | No |
| stay | icon | `'bed'` | Yes | bed | Icon | create | — | Calendar | delete | `icon` | No | No | No | No |

### Event — Marker (`kind: 'marker'`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| marker | id | string | Yes | uid | Calendar | manual/import | — | Calendar | `delItem()` | `logistics_items` | No | No | No | Yes |
| marker | date | date | Yes | — | Calendar | create | — | Day | delete | `item_date` | No | No | No | No |
| marker | title | string | Yes | — | Label | create | — | Day | delete | `title` | No | No | No | No |
| marker | allDay | boolean | No | true | Calendar | create | — | — | delete | `all_day` | No | No | No | No |

---

### Trips — Named (`store.trips[]`)

| Current object | Current field | Type | Req | Default | Used by | Created | Edited | Displayed | Deleted | Supabase | JSON | Multi | Sens | Referenced by ID |
|----------------|---------------|------|-----|---------|---------|---------|--------|-----------|---------|----------|------|-------|------|------------------|
| trip | id | string | Yes | uid('trip') | Ideas, shows | `saveTrip()` | — | Trip list | `confirmDeleteTrip()` | `trips.legacy_id` | No | No | No | **Yes** |
| trip | name | string | No | — | Label | save | edit | Lists | delete | `trips.name` | No | No | No | No |
| trip | color | string | No | — | Swatch | save | edit | Lists | delete | `trips.color` | No | No | No | No |
| trip | start / startDate | date | No | — | Range | save | edit | — | delete | `trips.start_date` | No | No | No | No |
| trip | end / endDate | date | No | — | Range | save | edit | — | delete | `trips.end_date` | No | No | No | No |
| trip | archived | boolean | No | false | Hide | — | menu (broken) | — | — | `trips.archived` | No | No | No | No |
| trip | checklist | array | No | template | Prep | create | toggle | — | — | `trips.checklist` JSON | **Yes** | **Yes** | No | item id |
| trip | timeline | array | No | `[]` | Schedule | `saveTimelineStep()` | edit | — | delete step | `trips.timeline` JSON | **Yes** | **Yes** | No | item id |
| trip | emergency | array | No | `[]` | Safety | `saveEmergency()` | edit | Trip detail | — | `trips.emergency` JSON | **Yes** | **Yes** | No | No |
| trip | packing | array | No | template | — | create | — | **Not used by Tour Mode** | — | **not synced** | No | **Yes** | No | No |
| trip | attachments | array | No | `[]` | Files | — | — | — | — | **not synced** | No | **Yes** | No | No |

**Problems:** UI primarily uses computed `runs()`, not `store.trips[]`; field name mismatch `start` vs `startDate`; archive handlers missing.

---

### Ideas, Notes, Contacts, Invoices, Itineraries, Packing, Reminders

See subsections below for remaining entities (abbreviated headers — full CRUD paths documented).

#### Ideas (`store.ideas[]` → `ideas` table)

| Field | Type | Default | Supabase | JSON | Sens | CRUD |
|-------|------|---------|----------|------|------|------|
| id | string | uid('idea') | legacy_id | No | No | save/delete |
| type | enum string | 'other' | type | No | No | saveIdea |
| title | string | — | title | No | No | save |
| note | string | '' | note | No | No | saveIdeaNote |
| prio | high/med/low | med | prio | No | No | save |
| done | boolean | false | done | No | No | toggle |
| eventId | string | null | event_legacy_id | No | No | attach/detach |
| tripId | string | null | trip_legacy_id | No | No | attach |
| created | number ms | now | **not synced** | No | No | create only |

#### Notes (`store.notes[]` → `notes` table)

| Field | Type | Default | Supabase | JSON | Sens | CRUD |
|-------|------|---------|----------|------|------|------|
| id | string | uid('note') | legacy_id | No | No | sheetNote/delete |
| title | string | '' | title | No | No | liveNoteTitle |
| body | string | '' | body | No | No | liveNoteBody |
| folder | string | '' | folder | No | No | liveNoteFolder |
| updated | number ms | now | note_updated | No | No | auto on edit |
| created | number ms | now | **not synced** | No | No | create |

#### Global contacts (`store.contacts[]` → `org_settings.contacts` JSON)

| Field | Type | Default | Supabase | JSON | Sens | CRUD |
|-------|------|---------|----------|------|------|------|
| id | string | uid('con') | nested JSON | **Yes** | No | saveContact/delContact |
| name, role, company, phone, whatsapp, email, notes | strings | — | nested | **Yes** | phone/email | save |
| created | number | now | **not synced** | Yes | No | create |

#### Invoices (`store.invoices[]` → `org_settings.invoices` JSON)

| Field | Type | Default | Supabase | JSON | Sens | CRUD |
|-------|------|---------|----------|------|------|------|
| id | string | uid('inv') | nested | **Yes** | No | create/delete |
| number | string | generated | nested | **Yes** | No | create |
| eventId | string | — | nested | **Yes** | No | create |
| date | date | today | nested | **Yes** | No | saveInvoiceMeta |
| client, clientAddr | string | — | nested | **Yes** | No | save |
| currency | string | from show | nested | **Yes** | No | create |
| lines[] | {label, amount} | — | nested | **Yes** | **Yes** | saveInvLine |
| status | draft/sent/paid | draft | nested | **Yes** | No | setInvStatus |
| terms | number | settings | nested | **Yes** | No | save |

#### Itineraries inbox (`store.itineraries[]` → `org_settings.itineraries` JSON)

| Field | Type | Supabase | JSON | CRUD |
|-------|------|----------|------|------|
| id, source, date, time, note, showId, created | various | nested | **Yes** | submit/save/del |
| imgs[] | attachment shape | nested + Storage | **Yes** | addItineraryShots |

#### Packing (`store.packing[]` → `org_settings.packing` JSON)

| Field | Type | Supabase | JSON | CRUD |
|-------|------|----------|------|------|
| id, label, done | — | nested array | **Yes** | addPackPrompt/toggle/del |

#### Reminders (`store.reminders[]` — **local only**)

| Field | Type | Supabase | CRUD |
|-------|------|----------|------|
| id, showId, kind (manual/usb), at, label, fired, triggered | — | **none** | scheduleReminder/cancel |

---

## Boarding pass / file metadata (shared shape)

Used in `show.flights[].passes`, `travel.passes`, attachments, itinerary images:

| Field | Type | Supabase paths | Problems |
|-------|------|----------------|----------|
| id | string | legacy_id in `show_flight_passes` / `show_files` | Dual tables for passes |
| kind | image/pdf | derived from mime | — |
| name | string | name column | — |
| data | string | signed URL or path | Ephemeral URLs |
| _storagePath | string | storage_path | — |
| _idb | boolean | local IndexedDB | Offline-only |
| _idbSaved | boolean | local | Offline-only |

Storage path pattern: `{org_id}/{show_id_or_folder}/{legacy_id}.{ext}` in bucket `operate-documents`.

---

## Auth & organisation (not in `store`)

| Entity | Table | Fields | App usage |
|--------|-------|--------|-----------|
| Profile | `profiles` | id, display_name, email | Auto on signup |
| Organisation | `orgs` | id, name | `create_org` RPC |
| Membership | `org_members` | org_id, user_id, role (owner/manager/crew) | RLS, invites |
| Invite | `org_invites` | email, role, token, accepted_at | `auth.js` |
| Usage | `usage_events` | kind, user_id | Edge function rate limits |

Local: `operate_org_id` in localStorage; nav state in `operate_nav` (not synced).

---

## Conflicting / uncertain shapes found in code

1. **Two tour models:** Computed `runs()` (primary UI) vs `store.trips[]` (named, partially wired). `viewTrip()` uses runs, not trip IDs.
2. **Two flight models:** `show.flights[]` (relational child table) vs calendar `kind:'travel'` legs (logistics_items with packed JSON).
3. **Two hotel models:** `show.hotel` object vs `kind:'stay'` calendar legs.
4. **Two driver models:** `show.drivers[]` vs driver fields on travel legs.
5. **Show-level flight status** (`show.flightNo`, terminal, gate…) vs leg-level — unclear which is canonical when both exist.
6. **Trip date fields:** UI writes `startDate`/`endDate`; sync maps `t.start`/`t.end` — loader sets `start`/`end` only.
7. **Packing:** Tour Mode reads global `store.packing[]`; named trips copy to `trip.packing[]` but Tour Mode ignores it.
8. **Reminders:** Not synced; will not survive cross-device or reinstall without migration plan.
9. **Finance visibility:** Crew can SELECT entire `shows` row including `finance` JSON — no column-level protection.
10. **Missing handlers:** `confirmCompleteTrip()` / `unarchiveTrip()` referenced but not implemented.
11. **Orphan cleanup gaps:** `show_flights`, `show_checklist_items`, `show_timeline_steps` not orphan-deleted on push.
12. **Crew full-push:** `pushToSupabase` upserts owner-only tables — crew writes fail silently for shows/trips/settings.
13. **Itinerary/header files:** Schema supports `show_files.file_role = header|itinerary` but app stores in `org_settings` JSON instead.

---

## Supabase table ↔ store quick reference

| Supabase table | Store mapping |
|----------------|---------------|
| `org_settings` | UI state + settings, packing, contacts, invoices, itineraries, artists, seq |
| `shows` | `events[]` where kind=show |
| `logistics_items` | `events[]` where kind in travel/stay/marker |
| `show_flights` | `events[].flights[]` |
| `show_flight_passes` | `events[].flights[].passes[]` |
| `show_files` | attachments + logistics passes |
| `show_checklist_items` | `events[].checklist[]` |
| `show_timeline_steps` | `events[].timeline[]` |
| `trips` | `trips[]` |
| `ideas` | `ideas[]` |
| `notes` | `notes[]` |
| Storage | Binary bytes for files/passes/headers |
