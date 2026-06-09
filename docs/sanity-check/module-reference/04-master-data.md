# 4. Master Data

## Purpose

The reference data the rest of the app pivots on — Clients, Sites,
Subcontractors / Suppliers, Contacts (polymorphic), Lookups (global lists,
disciplines, status enums), Rate cards (cutting, core hole, labour, plant,
waste, fuel, enclosure, other).

PM-facing for setup; estimator-facing every day (rate cards drive every
estimate); Marco's compliance domain (licences, insurance, credit apps).

## Surface area

**Routes (frontend):**
- `/master-data` — `MasterDataWorkspacePage` (Clients + Sites tabs)
- `/master-data/...` — sub-routes under `pages/master-data/`
- `/sites` — standalone site register (PR #76)
- `/sites/:id` — site detail (PR #53 / #288)
- `/directory` — directory workspace (unified Contact view)
- `/directory/clients`, `/directory/subcontractors`,
  `/directory/suppliers` — entity tabs
- `/tenders/clients` — TenderClientsPage (client list filtered to tender
  context)
- `/tenders/contacts` — TenderContactsPage
- `/admin/rates` — `EstimateRatesAdminPage` (cutting, core hole, labour,
  plant, waste, fuel, enclosure, other matrix)
- `/admin/global-lists` — global lookups

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/clients`
- `GET/POST/PATCH/DELETE /api/v1/sites`
- `GET/POST/PATCH/DELETE /api/v1/subcontractors`
- `GET/POST/PATCH/DELETE /api/v1/contacts` (polymorphic)
- `GET/POST/PATCH/DELETE /api/v1/global-lists`
- `GET/POST/PATCH/DELETE /api/v1/estimate-rates/{cutting,coreHole,labour,plant,waste,fuel,enclosure,other}`
- `POST /api/v1/xero/contacts/import` — Xero contacts CSV importer
  (PR #280, dry-run by default)

**DB entities:**
- `Client` (+ ABN, business types incl. Private Person, payment terms)
- `Site`, `Project` (Sites link to tenders/projects)
- `SubcontractorSupplier` (with prequalification fields)
- `Contact` (polymorphic CLIENT/SUBCONTRACTOR/SUPPLIER)
- `EntityLicence`, `EntityInsurance` (polymorphic, expiry tracking)
- `CreditApplication` (outgoing + incoming)
- `GlobalList`, `GlobalListItem`
- `EstimateCuttingRate`, `EstimateCoreHoleRate`, `EstimateLabourRate`,
  `EstimatePlantRate`, `EstimateWasteRate`, `EstimateFuelRate`,
  `EstimateEnclosureRate`, `CuttingOtherRate`

## What should work (functional checklist)

### Clients
- [ ] Client list paginates and filters by business type
- [ ] Search by name / ABN works
- [ ] Create client modal — required fields validated, ABN format check,
      business type dropdown shows Private Person option
- [ ] Edit client — payment terms (Day, Type), invoice email list,
      claim reminder contact (PR #74, internal user)
- [ ] Delete client — blocked if tenders / projects reference it
- [ ] Client card UI — recent activity, linked tenders, linked sites
- [ ] Legal name / country / paymentTermsDay / paymentTermsType /
      includeInInvoiceEmails (Xero alignment, PR #277)

### Sites
- [ ] Site list with filters
- [ ] Site detail page exists (PR #53 + #288) — not a stub
- [ ] Site → linked tenders, projects, contacts
- [ ] Create site modal with optional client link
- [ ] siteId FK on Tender + Project is wired (PR #107)

### Subcontractors / Suppliers
- [ ] Subcontractor list with prequalification status badges
- [ ] Subcontractor detail — Documents tab with upload (PR #106)
- [ ] Prequalification validation warning when documents missing
- [ ] Contact reassignment (PR #106)
- [ ] Performance rating field exists in schema (PHASE 6 — no UI yet,
      OK if missing)
- [ ] Categories assignment works (multi-select)
- [ ] Licences + Insurance tabs show expiry + status (active / expiring /
      expired)
- [ ] Auto-block on critical item expiry (Phase 3 complete — verify)

### Unified Contact
- [ ] Single Contact model serves all three entity types (PR #75)
- [ ] Contact list with entity-type filter
- [ ] Contact create — pick entity type and select parent entity
- [ ] subcontractor_contacts table is deprecated (PR #75); should not be
      written to. PHASE 5B tracks the eventual drop.

### Rates admin
- [ ] All 8 rate types each have their own admin table (cutting, core hole,
      labour, plant, waste, fuel, enclosure, other) — PR #34, #37, etc.
- [ ] Cutting matrix: Floor / Wall × Equipment × Material × Depth
- [ ] Wall vs Inverted vs Floor elevation pricing applies correctly
  (Floor=1.0×, Wall=1.1×, Inverted=2.0× for core holes)
- [ ] Labour: dayRate / nightRate / weekendRate columns (PR H / #214)
- [ ] Plant: rate + unit + fuelRate
- [ ] Waste: tonRate + loadRate + unit + wasteGroup, (wasteType, facility) unique
- [ ] Activate/deactivate rate row via isActive flag — Tendering Assistant
      `lookup_rate` tool filters `isActive: true` (PR #214)
- [ ] Material density: dual-unit sheet variants (PR #244) seeded

### Global lists
- [ ] CRUD on global lookups (status enums, dropdown values)
- [ ] Discipline codes — canonical 4-code system DEM/CIV/ASB/Other
      (PR A1 / #162). Legacy 5-code SO/Str/Asb/Civ/Prv migrated.
- [ ] Lists used by Tendering, Jobs, Projects, Forms all read the same
      source

### Xero import
- [ ] `POST /api/v1/xero/contacts/import` — dry-run preview by default
      (PR #280)
- [ ] Confirm action commits the import

## Recent PRs that shaped it (last ~100 merged)

- #4 — S8 seed data (foundation)
- #38 — Seed staff fix
- #73 — Business directory — extended Client model, sub/supplier, contacts,
  licences, insurance, credit applications — **functional / big**
- #74 — Permissions for directory.view, reminder contact wiring, nav IA
- #75 — Unified Contact polymorphic model — **functional / big migration**
- #76 — Contacts UI + Sites module + staff seed
- #53 / #288 — Sites detail page complete — **functional**
- #107 — Site detail + siteId FK on Tender, bulk status verified
- #106 — Subcontractor doc upload tab + prequal warning + contact
  reassignment — **functional**
- #79 — Compliance tracking expiry alerts + auto-block — **functional**
- #277 — Xero schema alignment (legalName, country, paymentTerms{Day,Type},
  includeInInvoiceEmails) — **functional / schema-touching**
- #280 — Xero contacts CSV importer (dry-run) — **functional**
- #34 / #37 / #45 / #46 etc — Estimate editor + rate seeds
- #214 (PR H) — `lookup_rate` extended to all 8 rate types (admin schema
  unchanged; tool reads more)
- #236, #237, #244 — material density: as lookup, unit-aware conversion,
  29-row seed extension
- #270 — Mark legacy comms endpoints @deprecated
- #282 — JSDoc on master-data module public exports (doc-only)
- #295 — Roadmap + progress catchup

Doc-only / test-only:
- #45 — JSDoc master-data exports
- #282 — JSDoc on public exports

## What to watch for during sanity check

- **Xero alignment (PR #277)** — schema gained `legalName`, `country`,
  `paymentTermsDay`, `paymentTermsType`, `includeInInvoiceEmails`.
  Confirm the create / edit forms surface these. Old data should still
  load (nullable backfill).
- **Xero CSV importer (PR #280)** — dry-run mode is the default. Verify
  the preview shows what *would* be imported. Then run a real import and
  check the audit log.
- **Site detail page (PR #288)** — was a stub before this PR. Now should
  show linked tenders / projects / contacts. Verify on a real site.
- **Subcontractor prequalification** — warning should appear inline when
  insurance / licence is missing or expired. Compliance auto-block
  should kick in for critical items.
- **Discipline codes (PR A1 / #162)** — 5-code → 4-code migration touched
  5 tables. Spot-check any list that still uses SO/Str/Asb/Civ/Prv — that's
  legacy and should be gone from UI. Projects-side dropdown was migrated
  in PR A1.5 / #163.
- **Material density** — 29 new rows + dual-unit variants seeded (#244).
  Verify the rates admin shows them in the Density list, and that the
  scope-of-works dimension derive uses them.
- **Rate isActive flag** — `lookup_rate` only sees active. Deactivate a
  cutting rate and confirm the persona can't surface it.
- **CenteredModal sweep (PR #300)** — many master-data modals were swept
  to CenteredModal. Check Add Client / Add Site / Add Subcontractor for
  consistent positioning, backdrop click, Esc-to-close.

## Edge cases worth probing

- **Empty Client list** — empty state with "Add client" CTA
- **Client with 100+ tenders** — detail page tab listing should paginate
- **Delete client with active tender** — should be blocked with a clear
  list of blockers
- **Subcontractor with expired insurance** — auto-block prevents
  allocation; UI flags blocker clearly
- **Rate card deactivate while estimate uses it** — existing estimate
  retains the snapshot price (verify pricing is line-item-owned, not
  rate-table-owned, per PR #148 CHECK 0.5)
- **Mobile width** — directory pages are admin-y; degrade is acceptable
  but no horizontal scroll
- **Concurrent edits** — last write wins is acceptable; audit trail must
  show both writes
- **Polymorphic Contact orphan** — Contact whose parent SubcontractorSupplier
  is deleted; should cascade or block; verify behaviour
