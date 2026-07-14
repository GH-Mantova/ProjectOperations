# Module Ownership & IA Map — DRAFT

Status: decisions locked 2026-07-03 (section 7) — ready for doc PR.

> **Status:** DRAFT / analysis only. Changes no schema, service, migration, or route.
> Intended to become the ruling document for (a) which module owns each entity,
> (b) who may write vs read each shared entity, (c) the sidebar information
> architecture, (d) merge/split candidates, (e) gaps.
>
> **Defers to** `docs/architecture/job-project-consolidation.md` (B-P0a, the plan of
> record for Job/Project) and references B-P0b (Worker -> WorkerProfile) and B-P0c
> (ProjectAllocation derived from ScheduleAllocation) without re-deciding them.
>
> **Verified against:** this checkout of `apps/api/prisma/schema.prisma` (3917 lines),
> the 47 folders under `apps/api/src/modules/`, `apps/web/src/App.tsx`,
> `apps/web/src/components/ShellLayout.tsx`, `project_instructions.md`, and
> `docs/qa/qa-checklist.md` / `docs/qa/qa-findings.md`.
> Write evidence = grep for `prisma.<model>.create|createMany|update|updateMany|delete|deleteMany|upsert`
> (and `tx.<model>.*`) per module, **excluding** `*.spec.ts` and `__tests__/`.
> B-P0a's appendix cites commit `d769b86`; line numbers here are from the current
> local tree and may drift by a few lines.

---

## 0. Method + scope notes

- Only production service code counted as a "writer". Test fixtures were excluded
  (an earlier naive grep counted `scheduler/__tests__/schedule-allocation.multirole.spec.ts`
  creating `user`/`client`/`project` rows — those are fixtures, not writers).
- Modules with **zero production writes** (read-only or adapter-only):
  `ai-providers`, `archive`, `email`, `field` (see 5.2), `pdf-rendering`, `security`.
- `docs/qa/qa-checklist.md:14` refers to "Appendix P0.2 (data-model relationship map)"
  but no `## Appendix P0.2` header exists in the file (headers present: A.1, P0.1, A.2 —
  verified by grep of `^## ` in `docs/qa/qa-checklist.md`). The relationship analysis
  here is rebuilt from `schema.prisma` directly. **GAP — see section 5.6.**

---

## 1. Entity ownership matrix

Only entities written by 2+ modules, plus a few single-writer entities that anchor a
rule. Pure-lookup tables with one writer (rates tables, number sequences, lookup
values, global lists, personas config, etc.) are omitted as OK.

Legend: **OK** = single writer of record. **SBD** = shared-by-design, with the rule
stated. **CONFLICT** = two-writers-no-arbiter, needs a single-writer refactor.

| Entity (schema line) | Owning module (writer of record) | Other writers (evidence) | Readers (principal) | Verdict |
|---|---|---|---|---|
| `Client` (schema.prisma:415) | `master-data` (`client.create/update`, master-data.service.ts) | `directory` (directory.service.ts:568 update — finance/business fields); `tendering` (tendering.service.ts:1454, 1484 — updates `tenderCount`/`winCount`/`winRate`/`lastWonAt`); `xero` (xero.service.ts:264 update — sync writeback) | tendering, projects, jobs, portal, contracts, quotes | **CONFLICT** — 4 writers, no arbiter. Resolution (DECIDED — Q4, section 7): one Clients service is the writer of record; counters stay stored, with every increment/decrement routed through one service method (not derived on read); xero writeback restricted to xero-owned columns via that service. |
| `Contact` (schema.prisma:490) | AMBIGUOUS — three full-CRUD writers | `contacts` (create/update/updateMany), `directory` (create/update/delete/updateMany, directory.service.ts), `master-data` (create/update), `portal` (portal-auth.service.ts:178 update — portal-access fields only) | tendering (tender contacts), portal, quotes | **CONFLICT** — `contacts`, `directory`, `master-data` all CRUD the same polymorphic table. Portal's write is field-scoped (SBD if the field set is documented). Merge the three CRUD paths into one module (section 4.3). |
| `Tender` (schema.prisma:736) | `tendering` (create/update/delete) | `jobs` (jobs.service.ts:1040, 1095, 1284, 1483, 1608 — status flips during convert-to-job / rollback); `projects` (projects.service.ts:894 — sets `status: "CONTRACT_ISSUED"`) | dashboards, quotes, documents, portal | **CONFLICT (known, arbitered by B-P0a).** Two conversion paths mutate tender lifecycle. B-P0a section 3 + slice 4 collapse them onto the Project path. Do not fix separately. |
| `TenderClient` (schema.prisma:802) | `tendering` (createMany/deleteMany) + `tender-clients` module (create/delete) — already two owners | `jobs` (jobs.service.ts:1030, 1035, 1087, 1586 — sets `isAwarded`/`contractIssued`) | tendering UI, jobs conversion gate | **CONFLICT** — three modules write one join table; `contractIssued` is the Job path's contract gate that B-P0a-4 retires (ContractsService becomes the contract truth). After B-P0a-4, rule: only `tendering` writes `TenderClient`. |
| `SafetyIncident` (schema.prisma:3422) / `HazardObservation` (:3453) | `safety` (create/update + number sequences, safety module) | `forms` (forms-engine.service.ts:600, 620 — create via form on_submit trigger); `projects` (projects.service.ts:882-883 — `updateMany` detaching `projectId` on revert-to-tender) | dashboards, sidebar badge (ShellLayout.tsx:665-690) | **SBD** with rule: creation allowed from the forms trigger (recorded in `FormTriggeredRecord`, schema.prisma:1506); all edits/lifecycle in `safety`; `projects` may only null the `projectId` FK during revert. Anything else is a violation. |
| `AssetBreakdown` (schema.prisma:3303) | `maintenance` (create/update) | `forms` (forms-engine.service.ts:650 — create via trigger) | maintenance dashboard | **SBD** — same trigger rule as safety. |
| `Asset` (schema.prisma:672) | `assets` (create/update) | `master-data` (asset.create/update — a second full CRUD path); `maintenance` (asset.update — status field after events) | scheduler, maintenance, forms | **CONFLICT** — `assets` vs `master-data` duplicate CRUD. Rule: `assets` is the writer of record; maintenance status writes go through an assets-service method (or stay field-scoped SBD on `status` only). |
| `User` (schema.prisma:19) | `users` (create/update + userRole) | `admin-users` (user.create/update, userRole.create/deleteMany — a parallel admin CRUD); `auth` (update — login stamps, refresh flow); `ai-settings` (user.update — AI prefs fields); `workers` (user.create — login for a WorkerProfile) | everything | **CONFLICT (users vs admin-users)** — two modules exposing the same CRUD. `auth`/`ai-settings`/`workers` writes are field-scoped SBD. Merge `admin-users` into `users` (section 4.6). |
| `TenderEstimate` / `EstimateItem` / `Estimate*Line` (schema.prisma:1702, 1717, 1743-1825) | `estimates` (full CRUD, estimates module) | `tendering` (scope-of-works.service.ts:572, 588 create; scope/estimate-proposals.service.ts:199, 220 create — AI proposal acceptance writes estimate rows directly) | quotes, exports, tender detail | **CONFLICT risk** — two modules insert estimate lines with no shared invariant (totals, rate snapshots). Rule proposal: `estimates` exposes an `addLines()` service API; tendering's scope/AI flows call it instead of raw prisma. |
| `ClientQuote` + `Quote*` lines (schema.prisma:3047-3158) | `client-quotes` (full CRUD) | `tendering` (scope/quote-proposals.service.ts:234 — creates `quoteCostLine`, plus `quoteAssumption`/`quoteExclusion` create) | portal, PDF, email | **CONFLICT risk** — same shape as estimates: AI proposal path bypasses the owning service. Same rule. |
| `Conversation` / `ConversationMessage` (schema.prisma:3738, 3754) | `personas` (conversation CRUD) | `tendering` (scope/clarification-proposals.service.ts:110, 122; scope/estimate-proposals.service.ts:124, 136 and others — heavy create/update of messages for AI scope drafting) | persona window, tender scope UI | **SBD (DECIDED — Q3, section 7)** — Conversation is a platform primitive behind one gatekeeper service; all modules (incl. tendering's AI scope drafting) append through it, never via raw prisma. |
| `DocumentLink` (schema.prisma:276) / `SharePointFileLink` (:248) / `SharePointFolderLink` (:225) / `SearchEntry` (:359) | `platform` + `documents` (platform services) | `jobs` (documentLink.createMany, sharePointFolderLink.update, searchEntry.create — jobs.service.ts conversion/document carry); `tender-documents` (documentLink.create/deleteMany, sharePointFileLink.create/delete) | everything with a Documents tab | **SBD** with rule: these are platform primitives, but writes should go through the platform/documents service layer, not raw prisma in feature modules. Today jobs and tender-documents write directly — refactor slice OWN-6 (section 6). |
| `TenderDocumentLink` (schema.prisma:920) | `tender-documents` (create/delete) | `projects` (projects.service.ts — `tenderDocumentLink.updateMany` re-parenting docs onto the Project at conversion; 3 call sites) | tender + project document tabs | **SBD** — conversion re-parenting is by design (B-P0a section 3). Rule: projects may only re-parent, never create/delete. |
| `TenderClarificationNote` (schema.prisma:2689) | `tender-clarifications` module | `tendering` (tenderClarificationNote.create + delete inside tendering.service/scope services) | tender detail | **CONFLICT (module split, same domain)** — merge `tender-clarifications` into `tendering` (section 4.5). |
| `EstimateExport` (schema.prisma:2622) | `estimate-export` | `client-quotes` (estimateExport.create — logs an export on quote send) | none in web (see 5.3) | **SBD** (append-only log) — low risk; note it has zero web read surface. |
| `JobActivity` (schema.prisma:1014) | `jobs` | `platform` (jobActivity.update — follow-up/notification triage touches) | job detail | **AMBIGUOUS** — why does platform mutate a jobs child row? Likely the follow-up queue. Needs a one-line rule or a service call. Folded into B-P0a-5 territory anyway (JobActivity moves to Project). |
| `AuditLog` (schema.prisma:209) | `audit` | `allocations`, `projects`, `scheduler` (auditLog.create) | admin audit page | **SBD** — append-only by design. Rule: create-only, never update/delete, prefer the AuditService wrapper. |
| `Worker` / `WorkerCompetency` / `Crew` (schema.prisma:615, 704, 644) | `master-data` (sole writer) | — | resources (legacy page), scheduler legacy | **Deferred to B-P0b** — legacy half of the Worker/WorkerProfile split. Do not add writers. |
| `WorkerProfile` (schema.prisma:2073) | `workers` (create/update) | — | scheduler, allocations, timesheets, field | **OK** — canonical per B-P0b (memory: WorkerProfile canonical). |
| `ProjectAllocation` (schema.prisma:2110) | `allocations` (create/update/delete) | — | timesheets, pre-starts, field | **OK today; becomes derived per B-P0c** (job-project-consolidation.md section 4: "stops being independently authored"). No new writers. |
| `ScheduleAllocation` (schema.prisma:2152) | `scheduler` | — | scheduler grid, availability report | **OK — canonical allocation model** (job-project-consolidation.md section 4). Multi-role unique key `schedule_alloc_worker_uniq` must not be narrowed (section 5 there). |
| `Shift` cluster (schema.prisma:1131-1247) | `scheduler` (shift, assignments, conflicts) + `resources` (availabilityWindow, workerRoleSuitability, shiftRoleRequirement) | — | legacy shift board, ResourcesPage | **Deferred to B-P0a-9** — retirement path. Freeze: no new features on this cluster. |
| `Job` + children (schema.prisma:941-1129) | `jobs` | — | jobs pages, archive | **Deferred to B-P0a** — folded into Project. |
| `Project` + children (schema.prisma:1961-2071) | `projects` | `scheduler` reads only | contracts, gantt, timesheets | **OK — the surviving spine** (job-project-consolidation.md section 1). |
| `Contract` / `Variation` / `ProgressClaim` / `ClaimLineItem` (schema.prisma:2912-3002) | `contracts` (sole writer + number sequences) | — | project detail, dashboards | **OK.** Note `JobVariation` (schema.prisma:1058) duplicates `Variation` — B-P0a-6 merges it; not re-decided here. |
| `SubcontractorSupplier` (schema.prisma:3191) | `directory` (create/update) | `compliance` (subcontractorSupplier.update — auto-block on expired critical licence, compliance module) | directory pages, compliance dashboard | **SBD** with rule: compliance may write only the block/status fields; all other edits in directory. |

---

## 2. Cross-module data-flow map

Arrows are writes; "reads" noted where they gate behaviour.

### 2.1 Commercial spine (tender -> delivery)

```
tendering --(status lifecycle)--> Tender
tendering --(win/loss)--> Client.tenderCount/winCount/winRate   [tendering.service.ts:1454,1484]
jobs      --(convert-to-job)--> Job + JobConversion, flips Tender.status, TenderClient.contractIssued
                                                                 [jobs.service.ts:1030-1095]
projects  --(convert)--> Project, flips Tender.status, re-parents TenderDocumentLink
                                                                 [projects.service.ts:894 + updateMany call sites]
contracts --(create/claims/variations)--> Contract (1:1 Project) [contracts.controller.ts:193-456]
```

**Two-writers-no-arbiter (table-conflict) risks:**

1. **Tender lifecycle** — `tendering`, `jobs`, and `projects` all set `Tender.status`
   with different gates (AWARDED vs CONTRACT_ISSUED). This is exactly the dual
   conversion path B-P0a section 3 resolves. Until B-P0a-4 ships, a tender can be
   converted down both paths, producing a Job and a Project for one tender
   (job-project-consolidation.md risk R2).
2. **`Client` stat counters** — tendering increments `tenderCount`/`winCount` while
   directory/master-data edit the same row and xero writes back on sync. A lost
   update on the counters silently corrupts the client scorecard. No arbiter today.
   Resolution (DECIDED — Q4, section 7): counters stay stored; every
   increment/decrement goes through one service method (single-writer
   arbitration), not derive-on-read.
3. **Estimate/quote lines** — `estimates` and `client-quotes` own the tables, but
   tendering's AI-proposal acceptance writes lines directly
   (scope-of-works.service.ts:572-588, scope/quote-proposals.service.ts:234). Any
   invariant added in the owning service (totals, snapshots) will be bypassed.

### 2.2 Master data flows

```
xero      <--> Client   (import/sync writeback: xero.service.ts:264; XeroSyncLog append)
directory ---> SubcontractorSupplier, EntityLicence, EntityInsurance, CreditApplication
compliance --> SubcontractorSupplier.status (auto-block), WorkerQualification, ComplianceAlert
portal    ---> Contact (portal access fields only: portal-auth.service.ts:178), ClientPortalUser
```

### 2.3 Scheduling and field

```
scheduler --> ScheduleAllocation (day-grain, canonical)
allocations --> ProjectAllocation (range) + CompetencyOverride  [becomes derived, B-P0c]
resources --> AvailabilityWindow / WorkerRoleSuitability (legacy Worker side)
workers   --> WorkerProfile, WorkerLeave, WorkerUnavailability (+ User login create)
field     --> reads allocations/pre-starts/timesheets; WorkerLocationLog (field.service.ts)
calendar  --> CalendarSyncedEvent (upsert from Graph)           [calendar module]
```

Risk: **two allocation write models live simultaneously** (`allocations` writes
ranges, `scheduler` writes days) with no reconciliation job. Timesheets and
pre-starts FK to `ProjectAllocation` (schema.prisma:2232, 2281 area; B-P0a section 4).
Until B-P0c, a day-grain edit does not update the range the timesheet anchors to.
This is a design-accepted interim state — flagging so nobody "fixes" it ad hoc.

### 2.4 Forms as a write fan-out

`forms` is deliberately a multi-table writer via on_submit triggers:
`SafetyIncident` (forms-engine.service.ts:600), `HazardObservation` (:620),
`AssetBreakdown` (:650), each recorded in `FormTriggeredRecord`. Rule: forms may
**create** trigger targets, never update them; owning modules handle lifecycle.

### 2.5 Documents / SharePoint

`documents` + `platform` own the primitives; `jobs` and `tender-documents` write
`DocumentLink`/`SharePointFileLink` directly (section 1 row). Conversion re-parents
`TenderDocumentLink` onto Project (projects module). SharePoint adapter is
mode-switched (mock/live) per CLAUDE.md; no ownership issue, only the raw-prisma
bypass noted in OWN-6.

---

## 3. IA / sidebar regrouping proposal

### 3.1 Current state (code) vs documented ground truth

Current nav is `NAV_GROUPS` in `apps/web/src/components/ShellLayout.tsx:152-262`:
Dashboards (dynamic, :434-496) / **Commercial** (Tendering, Contracts) /
**Operations** (Projects, Jobs, Scheduler, Availability report, Scheduler Grid,
Calendar Sync, Sites, Assets, Maintenance, Forms, Safety — **11 items**) /
**Directory** (Clients, Subcontractors & Suppliers, Contacts) / **Platform**
(Documents, Compliance, Archive) / **Admin** (Admin Settings, Rates & Lists,
Job Roles, AI Settings).

Documented ground truth is `project_instructions.md` SECTION 9 (:307-349). Drift
already present in code vs section 9:

- Section 9 has no Availability report / Scheduler Grid / Calendar Sync items; code has all three (ShellLayout.tsx:187-189).
- Section 9: Clients -> `/clients`; code: `/master-data?tab=clients` (ShellLayout.tsx:215). `/clients` route does not exist in App.tsx.
- Section 9: Tendering -> `/tenders/pipeline`; that path is now a redirect to `/tenders` (App.tsx:187).
- Section 9: Dashboard listed under PLATFORM; code renders Dashboards as its own top group.
- Section 9 Admin = 2 items; code = 4 (adds Job Roles, AI Settings).
- Neither lists **Workers**, yet `/workers` + `/workers/:id` routes exist (App.tsx:202-203) — reachable only by URL. Same for `/timesheets/approval` (App.tsx:201).

### 3.2 Proposed grouping

Constraints honoured: Marco's **locked Commercial seed** (Tendering, Clients,
Subcontractors & Suppliers, Contacts, Rates & Lists — Contracts removed from the
seed per decision Q1, section 7: folded into the project/job detail page), max 7
items per group, S3-001 scheduler fold, B-P0a Jobs/Projects single item.

```
DASHBOARDS (dynamic, unchanged)

COMMERCIAL  [locked seed - 5 items; Contracts entry removed — folded into
             job detail as a tab, decision Q1 section 7]
  Tendering                    -> /tenders
  Clients                      -> /master-data?tab=clients (later /clients)
  Subcontractors & Suppliers   -> /directory/subcontractors
  Contacts                     -> /directory/contacts
  Rates & Lists                -> /admin/estimate-rates

OPERATIONS  [6 items]
  Jobs                         -> /projects (B-P0a: Project spine, "Job" label)
  Scheduler                    -> /scheduler (single workspace, tabs: Grid / By-job / Availability)
  Timesheets                   -> /timesheets/approval (currently orphan route)
  Sites                        -> /sites
  Documents                    -> /documents
  Archive                      -> /archive

WORKFORCE & PLANT  [4 items]
  Workers                      -> /workers (currently unreachable from nav)
  Job Roles                    -> /admin/job-roles (move out of Admin; scheduling domain data)
  Assets                       -> /assets
  Maintenance                  -> /maintenance

HSEQ  [3 items]
  Safety                       -> /safety   (badge kept, ShellLayout.tsx:665)
  Compliance                   -> /compliance (badge kept, :692)
  Forms                        -> /forms

ADMIN (admin-only)  [3 items]
  Admin Settings               -> /admin/settings
  Users & Roles                -> /admin/users (roles/permissions/audit as tabs)
  AI Settings                  -> /admin/ai-settings

(not in sidebar) Calendar Sync -> /account/calendar-sync, linked from My Account
```

### 3.3 Rationale per non-obvious move

- **Contracts leaves the sidebar** — decision Q1 (section 7): contract data
  (value, variations, claims) becomes a tab on the project/job detail page;
  `/contracts` no longer gets a nav item. See 4.2.
- **Directory group dissolves into Commercial** — the locked seed pulls Clients,
  Subs, Contacts into Commercial; keeping a 0-item Directory group is pointless.
  *Changes ground truth:* section 9 DIRECTORY block (project_instructions.md:328-334).
- **Rates & Lists Admin -> Commercial** — it is estimating reference data used
  daily by estimators, not platform admin (locked seed). *Changes section 9:347-349.*
- **Jobs/Projects become one item** — B-P0a section 1: Project survives, UX label
  stays "Job". Nav shows one item; `/jobs` remains a redirect during transition.
  *Changes section 9:314-315.*
- **Scheduler collapses 4 -> 1** — per finding S3-001 (docs/qa/qa-findings.md:17-24):
  one workspace with view tabs; Calendar Sync relocated to account settings.
  *Changes section 9 (no scheduler sub-items existed there, but code changes ShellLayout.tsx:186-189).*
- **Timesheets gets a nav item** — approval page exists (App.tsx:201) with no entry
  point; supervisors need it. *Adds to section 9 OPERATIONS.*
- **Documents + Archive Platform -> Operations** — both are project-delivery
  surfaces (archive is closed jobs, documents is job/tender files). With Compliance
  moving to HSEQ and Dashboards its own group, Platform as a group disappears.
  *Changes section 9:336-341.*
- **Workforce & Plant (new group)** — Workers (currently orphaned), Job Roles
  (scheduling reference data owned by ops, not IT admin), Assets, Maintenance. Keeps
  Operations under 7. *New section in section 9.*
- **HSEQ (new group)** — Safety (currently Operations), Compliance (currently
  Platform), Forms (currently Operations). Matches Marco's WHS role and the
  forms->safety/compliance trigger adjacency (section 2.4). Both sidebar badges
  travel with their items. *Changes section 9:315-317, 338.*
- **Users & Roles consolidated** — `/admin/users`, `/admin/roles`,
  `/admin/permissions`, `/admin/audit`, `/admin/platform` (App.tsx:214-218) are five
  routes with no nav items today; fold as tabs under one Admin entry.

**Every item above whose move changes documented ground truth requires the same PR
to update `project_instructions.md` SECTION 9 (and the SECTION 13 registry lines it
touches), per the doc's "definitive - do not deviate" banner (:307).**

---

## 4. Merge / split candidates

Locked and not re-decided: **B-P0a** (Job -> Project), **B-P0b** (Worker ->
WorkerProfile, WorkerProfile canonical), **B-P0c** (ProjectAllocation becomes
derived from ScheduleAllocation) — see job-project-consolidation.md sections 1 and 4.

### 4.1 Four scheduler surfaces -> one workspace (plan adopted from S3-001)

Finding S3-001 (docs/qa/qa-findings.md:17-24): Scheduler `/scheduler`, Availability
report `/scheduler/availability-report`, Scheduler Grid `/scheduler/grid`, and
Calendar Sync `/account/calendar-sync` sit as four sidebar peers (ShellLayout.tsx:186-189)
over the still-duplicated data models. **Plan:** one scheduling workspace at
`/scheduler` with tabs (Grid / By-job / Availability); old URLs kept as redirects;
Calendar Sync becomes a My Account section, out of the sidebar. Backend module
boundaries (`scheduler`, `allocations`, `resources`, `calendar`) are untouched by
the nav fold; `resources` module retires with the Shift cluster (B-P0a-9).

### 4.2 Contracts page: fold into project/job detail tab (DECIDED — Q1, section 7)

Argued from data:

- `Contract` is 1:1 with Project — `projectId @unique` (schema.prisma:2912 area;
  job-project-consolidation.md section 1 cites L2909-2910), which superficially
  argues for folding into the project detail page.
- But the module has a deep unique action set no project tab should swallow:
  14 endpoints including variations CRUD, claims CRUD, and a claim lifecycle
  `submit / approve / pay` (contracts.controller.ts:193-456), plus retention and
  cut-off reminders (project_instructions.md:635 "Contracts module — variations,
  progress claims, retention, cut-off reminders").
- Seed creates **zero** Contract rows (no `contract.create` in
  `apps/api/prisma/seed*.ts` — grep verified), so local data volume says nothing.
  Marco confirmed (Q1, 2026-07-03): production also has **zero** Contract rows
  and no standalone claims workflow in use.
- **Decision (Q1, section 7):** fold Contracts into the project/job detail page.
  The standalone Contracts page is removed from the sidebar; contract data
  (value, variations, claims) becomes a tab on project/job detail, reusing the
  same components. Rationale: the contract is a lifecycle stage of the
  tender/job in practice. The `contracts` backend module stays the sole writer
  (section 1) — this is a UI/IA fold, not a module merge.

### 4.3 tender-clients / clients / contacts / directory overlap (DECIDED — Q2, section 7)

- `TenderClient` (schema.prisma:802-825) is a pure join (tender <-> client <->
  contact + award flags). Fine as a model, owned by tendering.
- But there are **two parallel UI surfaces over the same people data**:
  `/tenders/clients` + `/tenders/contacts` (App.tsx:190-191, TenderClientsPage /
  TenderContactsPage) vs `/master-data?tab=clients` + `/directory/contacts`
  (ShellLayout.tsx:215, 227). And **three backend modules CRUD `Contact`** and
  **two-plus CRUD `Client`** (section 1).
- **Decision (Q2, section 7):** one Clients/Contacts domain module (`directory`,
  absorbing `contacts` and the client/contact halves of `master-data`) becomes the
  single writer; `tender-clients` module shrinks to the join management inside
  `tendering`; the `/tenders/clients` and `/tenders/contacts` pages become
  tender-scoped filtered views of the directory data.
- `master-data` then retains sites, lookups, resource types, competencies, crews
  (legacy) — and sheds clients/contacts/assets.

### 4.4 forms / compliance / safety adjacency

Keep as three modules — write patterns are already clean (trigger-create SBD rule,
section 2.4) — but group them in nav as HSEQ (section 3.2). Do **not** merge
modules: safety has its own numbering sequences (schema.prisma:3482, 3489), and
compliance's cron + auto-block is directory-adjacent, not forms-adjacent.

### 4.5 Micro-module merges (same domain, split modules)

- `tender-clarifications` -> into `tendering` (both write `TenderClarificationNote`, section 1).
- `quote` (tender T&C/assumptions/exclusions) + `client-quotes` + `estimate-export`
  -> a single quoting boundary or at least a shared service API; today
  `estimateExport.create` happens in two modules and quote lines in two.
- `admin-users` -> into `users` (duplicate User CRUD, section 1).
- `ai-settings` + `ai-providers` + `personas` -> one AI settings boundary
  (ai-settings writes `User` prefs; personas owns Global AI settings — split is
  historical, not domain-driven). Low priority.

### 4.6 Legacy dashboard pair

`Dashboard`/`DashboardWidget` (schema.prisma:377, 397, written by `platform`) vs
`UserDashboard` (schema.prisma:1836, the live system per SECTION 12).
**DECIDED (Q5, section 7): retire the legacy pair**, gated on a verified-unread
check (grep + runtime confirmation) before the drop slice.

---

## 5. Gaps & missing pieces

### 5.1 Nav/route gaps

- `/workers`, `/workers/:id` (App.tsx:202-203) — no sidebar item anywhere; section 9
  doesn't list it either. Fixed by section 3.2.
- `/timesheets/approval` (App.tsx:201) — orphan route, breadcrumb exists
  (ShellLayout.tsx:290) but no nav entry.
- `/resources` (App.tsx:204) — breadcrumb literally says "Workers (legacy)"
  (ShellLayout.tsx:300); duplicates `/workers` over the legacy `Worker` model.
  DECIDED (Q6, section 7): freeze with a legacy banner until B-P0b lands; do not
  remove the route yet. Retire with B-P0b.
- `/admin/users|roles|permissions|audit|platform` (App.tsx:214-218) — five live
  admin routes with no nav items (reachable only if you know the URL).
- Section 9 points Tendering at `/tenders/pipeline`, which is now a redirect
  (App.tsx:187) — ground-truth staleness even before any regroup.

### 5.2 Entities with no UI surface (web grep = 0 references)

- `WorkerLocationLog` (schema.prisma:3546) — written/read only in
  `field/field.service.ts` (GPS clock events). By design mobile-only, but there is
  no admin/report surface at all.
- `FormSchedule` (schema.prisma:1519) — referenced in field/forms API code, zero web references.
- `TenderScopeRevision` (schema.prisma:1853) — zero web references.
- `EstimateExport` (schema.prisma:2622) — written by two modules, read nowhere in web.
- `Crew`/`CrewWorker` (schema.prisma:644, 658) — written by master-data, minimal
  web usage (2 files); tied to legacy Worker, so B-P0b decides its fate.

### 5.3 Modules with no tests

Zero `*.spec.ts` under: `admin-settings`, `global-lists`, and — most notably —
`portal` (an auth boundary: separate JWT, invite flow, session handling;
project_instructions.md SECTION 13 PORTALS block). Appendix A.2
(docs/qa/qa-checklist.md:78+) scores UI coverage complete but is UI-only; it does
not cover API test gaps, so these three are net-new findings.

### 5.4 Read-only/empty modules to justify or fold

`ai-providers`, `email`, `pdf-rendering`, `security`, `archive`, `field` have no
production prisma writes (adapters/read layers). Fine architecturally — just
recording that they are service boundaries, not entity owners.

### 5.5 Known-stale caveat

qa-checklist.md:13 warns the local App.tsx route table has lagged production
before. Route claims here are from the current checkout; re-verify against live
nav before shipping the IA PR.

### 5.6 Documentation gap

"Appendix P0.2" (data-model relationship map) is cited at qa-checklist.md:14 but
absent from the file. Section 1 + 2 of this document should be adopted as its
replacement once ratified.

---

## 6. Recommended slice plan

Small, reversible, dependency-ordered. **No slice below touches `Tender.status`,
`TenderClient.contractIssued`, conversion routes, Job/Project columns, or the
allocation models — that is B-P0a slices 2-9 territory and stays exclusively theirs.**

| # | Slice | Scope (one line) | Depends on |
|---|---|---|---|
| IA-1 | `improvement/ia1-sidebar-regroup` | Reorder `NAV_GROUPS` (ShellLayout.tsx:152-262) to section 3.2 groups (Commercial without a Contracts entry, per Q1) + update project_instructions.md SECTION 9/13 in the same PR; routes unchanged. | Section 7 decisions (locked 2026-07-03) |
| IA-2 | `improvement/ia2-scheduler-workspace` | Fold Availability report + Grid into `/scheduler` tabs, redirect old URLs, move Calendar Sync link to My Account (S3-001). Nav/frontend only. | IA-1 |
| IA-3 | `improvement/ia3-contracts-fold-in` | Contracts fold-in (Q1): add a Contract tab (value, variations, claims) to project/job detail reusing the existing components; `/contracts` redirects there; `contracts` module boundary unchanged. | IA-1 |
| OWN-1 | `fix/own1-merge-admin-users` | Merge `admin-users` module into `users`; one User CRUD path. | — |
| OWN-2 | `fix/own2-contact-single-writer` | Fold `contacts` module into `directory`; `master-data` contact endpoints delegate to directory service. | — |
| OWN-3 | `fix/own3-client-single-writer` | Client writes behind one service: tendering win/loss counters via `ClientsService.recordTenderOutcome()`; xero writeback via a field-scoped method. | OWN-2 |
| OWN-4 | `fix/own4-asset-single-writer` | Remove asset CRUD from `master-data`; maintenance status writes via assets service method. | — |
| OWN-5 | `fix/own5-merge-tender-clarifications` | Fold `tender-clarifications` into `tendering`. | — |
| OWN-6 | `fix/own6-document-primitives-service` | `jobs` + `tender-documents` stop raw-prisma writes to DocumentLink/SharePointFileLink/SearchEntry; go through documents/platform services. Behaviour-neutral. | — |
| OWN-7 | `fix/own7-estimate-quote-line-api` | tendering scope/AI proposal services write estimate + quote lines via `estimates`/`client-quotes` service APIs, not raw prisma. | — |
| OWN-8 | `fix/own8-conversation-gatekeeper` | Conversation as platform primitive (Q3): one gatekeeper append service; tendering's AI scope drafting and all other modules append through it, not raw prisma. | — |
| GAP-1 | `fix/gap1-nav-orphans` | Add Workers + Timesheets nav items (part of IA-1 grouping); leave `/resources` frozen with a "legacy" banner until B-P0b. | IA-1 |
| GAP-2 | `fix/gap2-portal-tests` | Add API tests for `portal` auth/invite/session (highest-risk untested module). | — |
| DOC-1 | `docs/doc1-ownership-map-ratify` | Ratify this document out of drafts/, backfill the missing P0.2 appendix pointer in qa-checklist (QA-state file, gitignored — coordinate with the QA program owner). | all above scoped |

Collision check: B-P0a-1 (guard/expand) is merged as draft PR #462 flow per memory;
slices 2-9 own conversion, WBS re-parenting, variations merge, and Shift/allocation
retirement. Nothing above writes to those tables or routes. OWN-3 touches
`tendering.service.ts` but only the client-counter block (:1450-1490), not the
lifecycle/status code paths B-P0a-4 rewires — still, sequence OWN-3 after B-P0a-4
lands if both are in flight simultaneously.

---

## 7. Decisions locked (Marco, 2026-07-03)

1. **Contracts (4.2): FOLD INTO JOB DETAIL.** The standalone Contracts page is
   removed from the sidebar; contract data (value, variations, claims) becomes a
   tab on the project/job detail page. Rationale: the contract is a lifecycle
   stage of the tender/job in practice; production has zero Contract rows and no
   standalone claims workflow.
2. **Clients module home (4.3): YES** — `directory` absorbs `contacts` + the
   client/contact halves of `master-data` as the single writer;
   `/tenders/clients` + `/tenders/contacts` become filtered views.
3. **Conversation ownership (section 1): PLATFORM PRIMITIVE** — one gatekeeper
   service; all modules (including tendering's AI scope drafting) append
   through it.
4. **Client stat counters (2.1): KEEP STORED COUNTERS**, but route every
   increment/decrement through ONE service method (single-writer arbitration).
   Do not derive-on-read. (Marco's explicit choice over the derive option.)
5. **Legacy `Dashboard`/`DashboardWidget` (4.6): retire**, GATED on a
   verified-unread check (grep + runtime confirmation) before the drop slice.
6. **`/resources` page: FREEZE WITH BANNER** until B-P0b lands; do not remove
   the route yet.
7. **Sites: stays in Operations.** Confirmed.
