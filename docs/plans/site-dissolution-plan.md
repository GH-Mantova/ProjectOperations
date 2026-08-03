# Site dissolution — physical layer → Job, commercial layer → Client; Directory → Clients

**Status:** draft 2026-08-03 (Marco ruling 2026-08-02; every fact below re-verified against
origin/main HEAD on 2026-08-03 before this plan was written).
**Owner:** Marco / ProjectOperations desktop-shell + data-model.
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. Schema slices declare `gate_allow: migrations`
and a rollback strategy in their own front-matter.

Marco's ruling (2026-08-02): the **Site** entity dissolves. Each Job is its own worksite (no
meaningful "one place hosts many jobs" case in this business), so Site's physical/operational
layer folds 1:1 into **Job**, and Site's commercial layer folds into **Client**. Directory is
renamed **Clients** (clients-only); Subcontractor/Supplier rehome elsewhere. Site is no longer
a standalone nav destination. A new **client portfolio** view groups a client's tenders /
projects / jobs — the operational Jobs list/board stays as-is (additive, not a move).

This is a schema + IA program. No irreversible action lands in this SLICE-0 PR. Nothing here
changes underlying behaviour of the compliance surfaces (attendance, muster, geofence, diary)
unless a slice explicitly says so — those move, they are not rewritten and no history is
discarded (per the sot/01 §6 append-only movement rule).

---

## 1. Motivation and grounding (evidence pinned to files/lines on origin/main 2026-08-03)

### 1.1 The Site entity today

- `apps/api/prisma/schema.prisma:767-798` — `model Site` (table `sites`, 23 fields). Carries
  `clientId?`, `name @unique`, `code? @unique`, an address block (`addressLine1`, `suburb`,
  `state`, `postcode`), plus the canonical `centreLat`/`centreLng` decimals added by ERP-gap-C
  (line 776 comment: "Populated by admin when a geofence is drawn").
- Site is the fan-out point for both **operational/WHS** surfaces (`geofences`, `attendances`,
  `musterEvents`, `dailyDiaries`, `assetCheckouts`, `formSubmissions`) and **commercial**
  surfaces (`tenders`, `jobs`, `projects`). That mix is the root cause: one entity, two very
  different jobs, and the "which site is this?" question is answered differently on each side.
- `sot/04-data-model.md:1929-1971` — Domain: Sites (Site, SiteAttendance, SiteGeofence). This
  is the canonical inventory the plan must unwind.

### 1.2 Every direct `siteId` reference (positive-control enumeration)

Every FK/scalar `siteId` in `schema.prisma` — no silent misses:

| # | Model (line) | Field | Nullability | onDelete | Classification |
|---|---|---|---|---|---|
| 1 | `Tender` (1091, 1108) | `siteId` | **NOT NULL** | **Restrict** | Commercial → **Client** (+ inline address for the tender's worksite) |
| 2 | `Job` (1359, 1368) | `siteId` | **NOT NULL** | **Restrict** | Physical — the worksite IS the Job (per Marco). Address moves onto Job. |
| 3 | `Project` (2605, 2606) | `siteId` | **NOT NULL** | **Restrict** | Same as Job — plus Project already carries `siteAddress*` fields (2607-2611), which pre-figures the fold. |
| 4 | `FormSubmission` (1912, 1925) | `siteId` | nullable | SetNull | Physical — re-point to `jobId` (already carries `jobId` at 1908; keep both during transition) |
| 5 | `AssetCheckout` (1027, 1038) | `siteId` | nullable | SetNull | Physical — already has `jobId` (1028); drop `siteId` after backfill |
| 6 | `DailyDiary` (2672-2673) | `siteId` | nullable | SetNull | Physical — re-point to `jobId` (add jobId col; diary is per-day-per-worksite) |
| 7 | `SiteGeofence` (809-810) | `siteId` | **NOT NULL** | **Cascade** | Physical — becomes **JobGeofence** with `jobId` FK; **rename table** `site_geofences` → `job_geofences` |
| 8 | `SiteAttendance` (6364, 6373) | `siteId` | **NOT NULL** | **Cascade** | Physical — becomes **JobAttendance** (already has `jobId?` at 6368, promote to NOT NULL). **Append-only WHS state — history preserved verbatim.** |
| 9 | `MusterEvent` (6409, 6417) | `siteId` | **NOT NULL** | **Cascade** | Physical — becomes **JobMusterEvent** (`jobId` FK). Append-only WHS state — history preserved. |
| 10 | `FormPublicLink` (2067) | `siteId?` | nullable | (no rel) | Physical — swap to `jobId?` (already at 2068); scalar hint, no FK today |
| 11 | Timesheet clock-on/off (2989, 2991) | via `SiteGeofence` FKs | nullable | SetNull | Follows SiteGeofence rename → JobGeofence; FK cols become `clockOnJobGeofenceId` etc. |

**False positives (NOT dissolving with Site — do not touch):**
- `SharePointFolderLink.siteId` (`schema.prisma:409, 424`) and `SharePointFileLink.siteId`
  (`schema.prisma:433, 452`) — these are Microsoft Graph **SharePoint site** identifiers
  (external string keys from `sharepoint.service.ts:158/307` and `documents.service.ts:149`).
  Not our internal Site FK. The uniques `@@unique([siteId, driveId, itemId])` stay as-is.
- `MusterAttendee.siteAttendanceId` (6432) — internal FK to SiteAttendance, follows the
  table rename to JobAttendance mechanically (see slice B-SD-6).

### 1.3 The NOT-NULL siteId guard + the `site-unassigned` placeholder

- `apps/api/prisma/migrations/20260717120000_tender_siteid_not_null/migration.sql` — inserts
  a stable-id `site-unassigned` row (name `"Unassigned"`), backfills every NULL `tender.site_id`
  → that row, swaps FK ON DELETE from `SetNull` → `Restrict`, then enforces NOT NULL. Comment
  at line 12 explicitly names this the same placeholder the "sibling job/project siteId-not-null
  migration will use".
- `20260716140000_site_id_not_null_backfill` — the earlier job/project backfill migration.
- **The dissolution must unwind this guard safely.** Two shapes to reverse:
  1. Every row currently pointing at `site-unassigned` needs a real disposition (delete
     tenders/jobs/projects where a real worksite address never existed, or promote the
     placeholder into a per-Job `siteAddress*` block populated from tender-time address data).
  2. The FK constraint direction must be flipped from Site→(Tender/Job/Project) to
     Client→Tender/Project (already exists) and inline address fields on Job — no dangling
     Restrict FK to a table that is about to disappear.

### 1.4 Directory / Unified Contact model (PR #75) — the other side of the rename

- `sot/04-data-model.md:512-644` — Domain: Directory (9 models: Client, ClientPortalUser,
  ClientQuote, ClientSession, Contact, PrequalificationRequest, SubcontractorDocument,
  **SubcontractorSupplier**, SupplierCreditEntry).
- `apps/web/src/components/ShellLayout.tsx:190-201` — sidebar entry `label: "Directory"`,
  route `/directory`, gate `directory.view`. The comment names the tabs: "Clients |
  Subcontractors & Suppliers | Contacts".
- `sot/01-charter-and-architecture.md:347-348` (§9) — the same three-tab shape is authoritative.
- Per Marco (2026-08-02): the Directory is renamed **"Clients"** and becomes clients-only.
  `SubcontractorSupplier` (which today powers the Subs/Suppliers tab and is referenced by
  Commitment, RateTable, EntityInsurance, EntityLicence, PrequalificationRequest,
  SubcontractorDocument, SupplierCreditEntry — `sot/04-data-model.md:616-635`) **rehomes** to
  its own module. Contacts (currently unified across organisations) stays on Client via the
  contacts service.

### 1.5 The Sites module (what disappears from nav)

- `apps/web/src/App.tsx:437-439` — routes `/sites`, `/sites/:id`,
  `/sites/:siteId/muster/:eventId`.
- `apps/web/src/pages/sites/` — `SitesListPage.tsx`, `SiteDetailPage.tsx`, `SiteFormModal.tsx`,
  `MusterPage.tsx`, `SiteHeadcountWidget.tsx`, `sitesListLogic.ts`, `site-detail-helpers.ts`.
- `apps/web/src/components/ShellLayout.tsx:217-225` — sidebar entry "Sites" under Projects
  group, gate `masterdata.view`.
- `apps/api/src/modules/sites/` — controller/service (attendance endpoints only, per
  ShellLayout comment at line 219); the list surface is served from
  `apps/api/src/modules/master-data/master-data.controller.ts:84` (`listSites`) +
  `.../master-data.service.ts:194`. Both go away with the entity.

### 1.6 The Job↔Project merge — HARD dependency

- `docs/plans/model-merge-plan.md` (open PR on `origin/docs/model-merge-plan`, unmerged as of
  2026-08-03; see MEMORY 19:36 / 19:40-19:43) — Phase A **B-P0a** merges Job into Project (the
  surviving schema entity), with the user-facing label "Jobs" per
  `pr-nav-jobs-projects-merge-HOLD.md`. Every "linked projects" resolution below **only**
  becomes moot once B-P0a-8 (drop the `jobs` table) lands + soaks.
- Standing rule (from model-merge-plan §2): merges run **one at a time, never concurrently**.
  This dissolution plan therefore does not race B-P0a — it sequences behind or interleaves
  explicitly (§4 slice table, `requires_merged`).
- `sot/04-data-model.md:3155-3413` — the survivor-spine slice designs are the canonical
  authority for the underlying merge. This plan **references** them; it does not restate.

### 1.7 sot/01 §9 nav authority

- `sot/01-charter-and-architecture.md:337-390` — §9 "SIDEBAR NAVIGATION (definitive — do not
  deviate)". Today lists `Directory → /directory` (line 347) and `Sites → /sites` (line 355).
  Both change with this program; the change lands via a dedicated **sot/01 §9 doc-reconcile
  slice** (never inline with a code slice — per the sot-purity CP-24 gate).

### 1.8 Assets-equipment-tabs plan cross-reference

- `docs/plans/assets-equipment-tabs-plan.md:61-64` already names this dissolution plan as one
  of three concurrent restructures and marks itself independent. That plan folds Procurement
  into `/assets`. The rehoming of `SubcontractorSupplier` in **B-SD-10** below MUST reconcile
  with it — Procurement is where Subs/Suppliers most naturally live (POs, commitments, credit,
  prequalification, insurance/licence records). Slice B-SD-10 sequences after the assets-tabs
  merge to inherit its Procurement tab as the natural home.

---

## 2. Target information architecture (final state)

**Sidebar** — the Projects-group "Sites" entry disappears; "Directory" is renamed "Clients".
No new top-level group.

```
2. ESTIMATING
   Tenders              → /tenders
   Contracts            → /contracts
   Tender Settings      → /tenders/settings
   Clients              → /clients        (renamed from /directory; clients-ONLY)
   Rates & Lists        → /admin/rates-lists
   Reports              → /tenders/reports

3. PROJECTS
   Jobs                 → /jobs           (merged Jobs+Projects per model-merge-plan; label "Jobs")
   [Sites entry removed — worksite is the Job]

4. OPERATIONS
   Scheduler            → /scheduler
   Assets               → /assets         (tabs: Assets | Inventory | Maintenance | Procurement)
                                          (Subs/Suppliers home for `SubcontractorSupplier`
                                           per §4 B-SD-10 — reconciled with assets-tabs plan)
```

**Client detail — the new portfolio view (additive, per Marco):**
`/clients/:id` gains tabs `Overview | Tenders | Projects | Jobs | Contacts | Contracts |
Compliance`. The operational Jobs list (`/jobs`) stays. Jobs-by-client is a lens, not a move.

**Job detail — absorbs the worksite:**
`/jobs/:id` gains a `Worksite` tab (address + `centreLat`/`centreLng` + geofence editor +
attendance/muster history + daily-diary index). This is the physical fold's UI landing point.

**Muster:** the current `/sites/:siteId/muster/:eventId` route becomes
`/jobs/:jobId/muster/:eventId`. Muster history is preserved (append-only WHS state).

**Guard model:**
- `/clients` gates on `directory.view` (unchanged code, gate renamed to `clients.view` as a
  **later** cleanup slice — do NOT bundle a permission-code rename with this restructure).
- The Sites-list gate `masterdata.view` (ShellLayout:224) retires with the entry.
- Sites API endpoints (`sites.controller` attendance surface) move to `jobs.controller` under
  the same permission grants they already use.

---

## 3. Reference-redistribution table (siteId → new home)

For every FK from §1.2, the target column and the migration shape. This is the master map
each schema slice consumes.

| From (model.field) | To | Migration shape | Slice |
|---|---|---|---|
| `Tender.siteId` (NOT NULL Restrict) | `Tender.clientId` already exists via `TenderClient`; the tender's worksite address collapses into inline `siteAddress*` cols on Tender (mirror the Project shape at 2607-2611) | Add nullable `siteAddress*` cols → backfill from `Site` row → drop `siteId` FK, index at 1146 | B-SD-3 |
| `Job.siteId` (NOT NULL Restrict) | inline `siteAddress*` + `centreLat`/`centreLng` on Job | Add nullable cols → backfill → drop `siteId` FK, index (add if any) | B-SD-4 |
| `Project.siteId` (NOT NULL Restrict) | already has `siteAddress*` (2607-2611); backfill any nulls and drop FK | Copy `Site.centreLat/Lng` onto Project (add cols) → drop `siteId` FK | B-SD-4 |
| `FormSubmission.siteId?` (SetNull) | already has `jobId?` (1908); when a submission is site-only (no job), backfill by matching Site → the surviving Job (post B-P0a rules the Job is the survivor) | Data-move to `jobId`, then drop `siteId` col + FK | B-SD-5 |
| `AssetCheckout.siteId?` (SetNull) | already has `jobId?` (1028); the "at this site" holder collapses to "at this job" | Backfill `jobId` from `siteId`→jobs mapping (pick the active job at the site at checkout time; fallback: single job at site; escalate ambiguity) → drop `siteId` col | B-SD-5 |
| `DailyDiary.siteId?` (SetNull) | new `jobId?` col; every diary entry belongs to a Job (per Marco: "each job is its own worksite") | Add `jobId?` → backfill from `siteId`+date to active job → drop `siteId` | B-SD-5 |
| `SiteGeofence` (table) | rename to `JobGeofence` with `jobId` FK; `centreLat/Lng/radiusMetres` unchanged | `ALTER TABLE site_geofences RENAME TO job_geofences`; drop `site_id`, add `job_id` NOT NULL Cascade with backfill from the physical fold map | B-SD-6 |
| `SiteAttendance` (table) | rename to `JobAttendance` with `jobId` NOT NULL (already nullable at 6368) | Backfill `job_id` where NULL (rules: use the active job at the site at `signed_in_at`, escalate ambiguity); promote to NOT NULL; drop `site_id` col | B-SD-6 |
| `MusterEvent` (table) | rename to `JobMusterEvent` with `jobId` FK (drop `site_id`) | Backfill from site→job mapping at `startedAt`; escalate ambiguity to a dedicated data-fix slice | B-SD-6 |
| `MusterAttendee.siteAttendanceId` | rename mechanically to `jobAttendanceId` (table rename cascades the relation name) | No data change; column rename | B-SD-6 |
| `FormPublicLink.siteId?` | swap to `jobId?` (already scalar at 2068) | Column drop; the `jobId?` hint stays | B-SD-5 |
| `Timesheet.clockOn/OffGeofenceId` | relation name follows JobGeofence rename; column value unchanged | Schema-only rename via Prisma `@relation` swap | B-SD-6 |
| `SharePointFolderLink.siteId` (409) | **NOT TOUCHED** — external Graph site ID; different concept | — | — |
| `SharePointFileLink.siteId` (433) | **NOT TOUCHED** — same as above | — | — |

**Rule for every backfill:** every UPDATE writes an equivalent `ProjectActivityLog` /
`JobActivity` entry so the audit trail carries the fold. WHS state (attendance, muster,
geofence events) is **preserved verbatim** — the table rename and FK swap are structural
only; no row is deleted, no timestamp is rewritten (per sot/01 §6 append-only rule).

---

## 4. Slice list (ordered, independently shippable)

Prefix **B-SD-** ("Site Dissolution"). Every slice ≤ ~10 files. Schema slices declare
`gate_allow: migrations` + `rollback_strategy`. All slices are docs-and-code (never mixed with
`/sot/` edits). One dedicated sot/01 §9 doc-reconcile slice sits at the end. One dedicated
sot/04 doc-reconcile slice covers the Domain: Sites removal.

Merge-order legend: **A** = concurrent with B-P0a is FORBIDDEN (schema conflict on Job); ⇒
these slices sequence STRICTLY behind the corresponding B-P0a slice. **b** = interleave OK.

### B-SD-0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/site-dissolution-plan.md`.
- **Gate/CI:** `pnpm lint`, `pnpm build`.
- **Requires:** nothing.
- **Marco gate:** **escalates: true** — Marco reviews the plan before it lands; carries
  `do-not-merge`.
- **Notes:** binds every slice below.

### B-SD-1 — permission-code + data-fix inventory `size:2` (docs-only) [b]
- **Files:** `docs/plans/site-dissolution-permission-and-data-map.md`.
- **Purpose:** (a) list every Site FK ambiguity encountered when the dissolution runs on real
  data (e.g. `AssetCheckout.siteId` with a site that today hosts >1 active Job); (b) list every
  permission code the new IA touches (`clients.view` proposed rename of `directory.view`,
  none of the geofence/attendance/muster codes change). Any new code = `PENDING-MARCO` block.
- **Requires:** B-SD-0.

### B-SD-2 — `site-unassigned` unwind audit `size:2` (docs-only) [b]
- **Files:** `docs/audits/site-unassigned-unwind.md`.
- **Purpose:** count every tender/job/project/geofence/attendance/muster row currently
  pointing at `site-unassigned`; produce a per-row disposition plan (delete? backfill with a
  real address? escalate?). This is the safety net before any schema slice runs.
- **Requires:** B-SD-0. **Blocks:** B-SD-3, -4, -5, -6.

### B-SD-3 — Tender: dissolve siteId (inline address) `size:6` [A — behind B-P0a-1]
- **Schema:** add nullable `Tender.siteAddressLine1/Suburb/State/Postcode/CentreLat/Lng`
  (mirror Project shape); Prisma migration `expand_tender_site_inline_address`. Keep
  `Tender.siteId` alive.
- **API:** update `tenders.controller` + wizard write paths to write both `siteId` and inline
  cols (dual-write window).
- **Data-fix (separate migration):** backfill inline cols from the referenced `Site` row.
- **Verify slice:** counts.
- **`gate_allow: migrations`.** **Rollback:** drop the six new nullable cols (reversible).
- **Requires:** B-SD-2. **Blocks:** B-SD-7 (Tender FK drop).

### B-SD-4 — Job + Project: worksite inline `size:8` [A — sequences with B-P0a survivor spine]
- **Schema:** add nullable `Job.siteAddress*` + `Job.centreLat/Lng` (Project already has the
  address block; add `Project.centreLat/Lng`). Migration `expand_job_project_inline_worksite`.
- **API:** write both paths.
- **Data-fix:** backfill inline cols from the Site row on each job/project.
- **Marco cue:** at this point `Job` is being folded into `Project` (B-P0a). The worksite
  cols land on the SURVIVOR (`Project`). Job's copy is a transitional convenience only.
- **`gate_allow: migrations`.** **Rollback:** drop the new cols.
- **Requires:** B-SD-2, **B-P0a-1** (survivor-spine cols exist).
- **Blocks:** B-SD-7 (FK drop).

### B-SD-5 — Nullable siteId sweep (FormSubmission, AssetCheckout, DailyDiary, FormPublicLink) `size:8` [b]
- **Schema:** add `DailyDiary.jobId?` (only new col; the other three already have `jobId?`).
- **Data-fix:** backfill each row's `jobId` from `siteId` via the site→active-job map. Ambiguity
  → the disposition file from B-SD-2.
- **API:** drop the `siteId` param from Documents/Forms/Diary/AssetCheckout endpoints where
  the value is now derivable.
- **`gate_allow: migrations`.** **Rollback:** keep `siteId` columns alive; drop the new
  `DailyDiary.jobId`.
- **Requires:** B-SD-2.

### B-SD-6 — WHS surfaces (SiteGeofence, SiteAttendance, MusterEvent + Attendee) `size:9` [A — behind B-P0a-5]
- **Schema:** rename tables `site_geofences → job_geofences`, `site_attendances → job_attendances`,
  `muster_events → job_muster_events`. Promote `SiteAttendance.jobId?` → NOT NULL after backfill.
  Add `jobId` FK to renamed geofence + muster tables (drop `siteId` col only after backfill).
- **Data-fix:** ambiguity from B-SD-2 must be zero before this slice runs (assertion in the
  migration; migration aborts if any row remains ambiguous).
- **API:** `sites.controller` attendance endpoints (`apps/api/src/modules/sites/`) move to a
  new `jobs-attendance.controller` (same permissions). The `SitesService` class dies.
- **Web:** `MusterPage.tsx` rehomes to `/jobs/:jobId/muster/:eventId`.
- **Append-only guarantee:** every existing `SiteAttendance` / `MusterEvent` / `MusterAttendee`
  row survives with its timestamps intact. No `createdAt`/`signedInAt` is rewritten.
- **`gate_allow: migrations`, escalates: true.** **Rollback:** the rename is reversible via a
  reverse migration ONLY BEFORE the next slice ships (irreversible after B-SD-8's FK drop
  cascades).
- **Requires:** B-SD-2, **B-P0a-5** (WBS moved off Job — no confusion about which Job wins).

### B-SD-7 — Drop Tender/Job/Project `siteId` FK columns `size:6` [A — behind B-P0a-7]
- **Schema:** drop `Tender.siteId` (col + FK + index at 1146), `Job.siteId` (1359 + FK 1368,
  index if any), `Project.siteId` (2605 + FK 2606). Migration `drop_site_id_from_deliverables`.
- **API:** remove any lingering dual-write.
- **Verify:** `pnpm compliance:smoke` must pass (WHS surfaces already re-pointed in B-SD-6).
- **`gate_allow: migrations`, escalates: true.** **Rollback:** snapshot-restore only (this is
  a column drop on NOT-NULL Restrict FKs). Named in the migration header.
- **Requires:** B-SD-3, B-SD-4, B-SD-5, B-SD-6, **B-P0a-7** (FormSubmission / Correspondence
  re-pointed off Job — no lingering `jobId` writes that would conflict with the survivor).

### B-SD-8 — Drop Site table + retire modules `size:8` [A — behind B-P0a-8]
- **Schema:** drop `sites` table. Delete `site-unassigned` row cleanly (must be zero
  referrers post-B-SD-7).
- **API:** delete `apps/api/src/modules/sites/*` (entire folder), `listSites`/`upsertSite`/
  `getSite` from `master-data.service.ts` (`:194` and neighbours), `MasterDataService` Sites
  test group in `master-data.service.spec.ts:438-1201`.
- **Web:** delete `apps/web/src/pages/sites/*` (SitesListPage, SiteDetailPage, SiteFormModal,
  SiteHeadcountWidget, `sitesListLogic.ts`, `site-detail-helpers.ts`, `__tests__/`). Remove
  route imports at `App.tsx:48-50` and routes at `:437-439`. Remove sidebar entry at
  `ShellLayout.tsx:217-225`. Remove `PAGE_TITLES` at `ShellLayout.tsx:436`.
- **Redirect map (see §5):** every `/sites*` URL redirects to a helpful landing.
- **`gate_allow: migrations`, escalates: true.** **Rollback:** irreversible without snapshot
  (the row-level backfill is not idempotent-reverse). Named at PR top.
- **Requires:** B-SD-7, **B-P0a-8** (Job table dropped — no dangling `jobs.site_id`).

### B-SD-9 — Client portfolio view + Client detail tabs `size:7` [b — post B-P0a-8 soak]
- **Files:** new tabs in `apps/web/src/pages/directory/ClientDetailPage.tsx` (or wherever the
  Directory client detail lives today — audit at slice arm time) adding **Tenders**,
  **Projects**, **Jobs** lenses. API: extend `directory.controller` reads to fan out to
  tender/project/job list queries scoped to `clientId`.
- **Non-goal:** no changes to the operational `/jobs` list. This is additive.
- **Requires:** B-SD-8.

### B-SD-10 — Rehome `SubcontractorSupplier` under Procurement `size:8` [b — behind assets-tabs merge]
- **Files:** move Directory's "Subs & Suppliers" tab out; add a "Subs & Suppliers" surface
  under `/assets` (Procurement tab) — coordinate with `docs/plans/assets-equipment-tabs-plan.md`.
- **Schema:** none (Client/SubcontractorSupplier/Supplier tables unchanged; only IA moves).
- **Web:** remove the sub tab from `ContactsPage.tsx` / `DirectoryPage.tsx` (audit at slice
  arm time — the Directory tab shape lives in a shared component).
- **API:** no change to `directory.controller` reads for subs/suppliers (the endpoints stay;
  the UI stops calling them from the Directory surface).
- **Reconcile with:** `docs/plans/assets-equipment-tabs-plan.md` — the assets-tabs plan's
  Procurement tab is the natural home; this slice hangs off it.
- **Requires:** assets-tabs plan MERGED to the Procurement-tab-lives stage (B-AT-X in that
  plan; look up the slice number when arming).

### B-SD-11 — Rename Directory → Clients `size:6` [b — after B-SD-10]
- **Files:** `ShellLayout.tsx:190-201` (label "Directory" → "Clients"; route `/directory` →
  `/clients`; add a `/directory` → `/clients` `Navigate replace` redirect). `App.tsx` route
  rename; `directory.controller.ts` stays (endpoint URL is `/directory`, a later API-rename
  slice is out of scope here — the API URL change is a separate housekeeping slice, not
  planned here). Update every internal link (`QuickCreate`, `CommandPalette`, `search.service`,
  breadcrumbs) — grep sweep.
- **e2e:** `batch1-auth-shell.spec.ts` (sidebar label), plus any breadcrumb specs.
- **Non-goal:** do NOT rename the `directory.view` permission code (grep at slice arm time;
  if the ratio is unfavourable, the code rename is a separate slice).
- **Requires:** B-SD-10 (Subs/Suppliers already out of Directory; renaming to "Clients" is
  now factually accurate).

### B-SD-12 — sot/04-data-model.md doc-reconcile `size:1` [b, docs-only]
- **Files:** `sot/04-data-model.md` — remove Domain: Sites (§1929-1971); update every model
  spec that today lists a Site FK; add JobGeofence / JobAttendance / JobMusterEvent domain
  under Domain: Jobs.
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate).**
- **Requires:** B-SD-8 (schema truly dropped).

### B-SD-13 — sot/01-charter-and-architecture.md §9 doc-reconcile `size:1` [b, docs-only]
- **Files:** `sot/01-charter-and-architecture.md` §9 only (line 355 Sites entry removed; line
  347 Directory → Clients label + `/directory` → `/clients` route; line 348 tab list
  shortened to "Clients | Contacts" now that Subs/Suppliers rehomed).
- **Docs-only PR, never mixed with code.**
- **Requires:** B-SD-11.

---

## 5. Redirect map (old URL → new home)

Every legacy URL gets an explicit disposition. `Navigate replace` preserves bookmarks.

| Old URL | Disposition | New URL / notes | Slice |
|---|---|---|---|
| `/sites` | redirect | `/jobs` (with a one-time banner "Sites has moved — worksite lives on each Job") | B-SD-8 |
| `/sites/:id` | redirect | `/jobs?siteFilter=<siteName>` interim; ultimately dead once the migration completes | B-SD-8 |
| `/sites/:siteId/muster/:eventId` | redirect | `/jobs/:jobId/muster/:eventId` (jobId resolved from site→job map) | B-SD-6 |
| `/master-data?tab=sites` | redirect | `/jobs` (the tabbed workspace loses the Sites tab in B-SD-8) | B-SD-8 |
| `/directory` | redirect | `/clients` | B-SD-11 |
| `/directory/*` | redirect | `/clients/*` | B-SD-11 |
| `/directory?tab=subcontractors` | redirect | `/assets?tab=procurement&subtab=suppliers` (per B-SD-10 rehome) | B-SD-10 |
| `/master-data` | keep | already redirects to `/directory` (ShellLayout:193-199); becomes `/directory` → `/clients` chain | B-SD-11 |

Rule: every legacy redirect stays for at least one release cycle after the last slice lands.
Removing them is a separate housekeeping slice (not planned here).

---

## 6. Risks

### 6.1 WHS audit-trail continuity is the top risk
`SiteAttendance`, `MusterEvent`, `MusterAttendee`, `SiteGeofence` are compliance-significant
per sot/01 §6 (append-only movement rule). B-SD-6 renames the tables and re-points FKs; it
MUST preserve every row and every timestamp verbatim. The migration includes a `SELECT
count(*)` pre/post assertion; a mismatch aborts the transaction. If ambiguity remains from
B-SD-2 (a site row that maps to >1 active job at attendance time), the migration ABORTS —
Marco resolves each ambiguous row manually before the slice re-runs.

### 6.2 NOT-NULL siteId unwind is one-shot
The `20260717120000_tender_siteid_not_null` guard flipped Tender to NOT NULL Restrict. The
sibling migration did the same for Job and Project. Unwinding requires:
(a) inline address cols populated (B-SD-3, -4);
(b) all `site-unassigned` referrers rehomed to real addresses (B-SD-2 disposition);
(c) FK drop in the right order (Tender/Job/Project → Site FK dropped in B-SD-7 BEFORE the
    `sites` table drop in B-SD-8).
Any slice that lands out of order fails on FK constraint. The `requires_merged` chain in §4
enforces the order; do not shortcut it.

### 6.3 Site→Job disambiguation on shared sites
Historical assumption: one Site can host many Jobs. When B-SD-5/-6 backfills `jobId` from
`siteId+timestamp`, rows where >1 Job was active at the site at the timestamp are AMBIGUOUS.
The B-SD-2 disposition file MUST enumerate every such row and Marco MUST resolve each before
the schema slice runs. **Marco 2026-08-02** explicitly said "no meaningful one-place-many-jobs
case", so the count is expected small — but the assertion is not optional. If the count comes
back high, escalate before touching schema.

### 6.4 Sequencing collision with B-P0a (Job↔Project merge)
B-SD-4 needs Job survivor-spine cols (B-P0a-1). B-SD-6 must not race B-P0a-5 (which moves
WBS off Job). B-SD-7/-8 must sequence behind B-P0a-7/-8. Each slice's `requires_merged` in
§4 pins the coupling. The standing rule ("merges run one at a time") means B-SD-3..-8 cannot
run concurrently with B-P0a — they interleave.

### 6.5 Directory rename ripple
B-SD-11 renames `/directory` → `/clients`. Grep sweep required at slice-arm time (found:
QuickCreate, CommandPalette, ContactsPage, `search.service`, MasterDataWorkspacePage — same
files touched in the earlier canonical-nav slice, MEMORY 07:41-07:48). Do NOT rename the
`directory.view` permission code in the same slice; that is a separate follow-up. Both e2e
specs `batch1-auth-shell.spec.ts` and any batch that hits `/directory` need updates.

### 6.6 Subcontractor/Supplier rehome is IA-only, but has many callers
`SubcontractorSupplier` is referenced by 7 domains (Commitment, RateTable, EntityInsurance,
EntityLicence, PrequalificationRequest, SubcontractorDocument, SupplierCreditEntry). B-SD-10
touches the UI location, NOT the schema. Any accidental schema change here corrupts
Procurement's commitment ledger — the slice's PR body must call out "schema untouched" and
the PR-fix reviewer must verify.

### 6.7 SharePoint false-positive collision
`SharePointFolderLink.siteId` and `SharePointFileLink.siteId` share a column name with our
internal Site FK but are Microsoft Graph external IDs. Any migration that does a blanket
"rename `site_id` → `job_id`" or drops the `sites` table WITHOUT scoping to the specific
tables will corrupt SharePoint file/folder links. Every migration in §4 lists tables by name.
Do NOT script by column name.

### 6.8 e2e specs that assert current nav shape
Grepped 2026-08-03 — the impacted specs are: `batch1-auth-shell.spec.ts` (sidebar labels),
`batch5-sites.spec.ts` (the entire spec dies with B-SD-8 — delete or repurpose; do NOT
silently mark skip), `batch8-documents-archive.spec.ts`, `batch7-universal-timeline.spec.ts`.
Each slice's PR body lists the specs it touches.

### 6.9 "Reports grouped by Client, not Site"
Tender register, tender scoreboard, and any dashboard widget grouped by Site today re-group
by Client in the client portfolio view (B-SD-9). Widget seeds (`sot/01 §12`) may reference
"by-site" — audit at B-SD-9 arm time.

### 6.10 Docs-only slices at the end MUST not race code slices
B-SD-12 (sot/04 reconcile) and B-SD-13 (sot/01 §9 reconcile) are the LAST slices. If either
lands before the corresponding code, the SoT lies. The `requires_merged` chain enforces the
order; CP-24 sot-purity gate blocks mixing.

---

## 7. Out of scope

- Any change to Client, Contact, SubcontractorSupplier, or SupplierCreditEntry SCHEMA. This
  plan touches IA (nav, tab placement), never those tables.
- Renaming the `directory.view` permission code (separate slice, not planned here).
- Renaming the API URL `/api/directory/*` → `/api/clients/*` (separate slice — the UI
  rename in B-SD-11 is enough for user-facing consistency).
- Any Azure/Entra/SharePoint config change. B-SD-8 keeps SharePoint folder mappings intact.
- Cleanup of legacy `/sites*` and `/directory*` redirect routes (post-release housekeeping,
  not in this plan).
- Field/mobile-side navigation (Marco: "FIELD nav is untouched"); the `FieldLayout.tsx`
  bottom nav has no Sites or Directory entry today — nothing to touch.
- Any change to the `Shift` cluster (owned by B-P0a-9 / model-merge-plan).
- Any change to the `ScheduleAllocation` model (LOCKED on Project per
  `sot/04-data-model.md:4201-4206`).
- Rewriting DailyDiary editor/UI (only the FK moves; the UX slice for
  DailyDiary-lands-on-Job is optional and separately planned if needed).

---

## 8. Verification of this document

- [x] `test -f docs/plans/site-dissolution-plan.md`
- [x] Every direct `siteId` FK in `schema.prisma` is enumerated in §1.2 (11 rows) with a
      classification and a target slice.
- [x] SharePoint false positives are explicitly excluded in §1.2 and §6.7.
- [x] The NOT-NULL siteId placeholder (`site-unassigned`) unwind is a dedicated audit slice
      (B-SD-2) that BLOCKS the schema slices.
- [x] The Job↔Project merge dependency (`model-merge-plan.md`) is pinned per-slice in §4
      via `requires_merged`.
- [x] The sot/01 §9 nav change and sot/04 Domain-Sites change land via DEDICATED
      doc-reconcile slices (B-SD-12, B-SD-13), never inline with code.
- [x] Every compliance surface (attendance, muster, geofence) preserves history — §6.1 is
      the top-of-list risk and B-SD-6 carries a row-count assertion.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
