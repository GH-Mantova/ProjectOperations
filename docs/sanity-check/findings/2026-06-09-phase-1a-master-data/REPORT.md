# Phase 1A — Master data foundations

**Status:** PASS with minor findings
**Tester:** Cowork-driven via Chrome MCP
**Login:** Alex Admin (ADMIN role)
**Viewport:** 1568x711 (desktop)

## Summary

Master data layer is solid and broadly consistent with the roadmap intent. Eight client records, four directory entries, eight sites, seventeen workers, 9 rate categories (203 rate entries total), all rendering with realistic SEQ-Australian construction context. Compliance lifecycle wiring (expiring badges → list alert chips) is internally consistent.

## What works ✓

### Operations Dashboard
- Renders without console errors
- KPI strip: Active Jobs 3, Tender Pipeline $13,196,000, Open Issues 3, Upcoming Maintenance 6
- Charts: Jobs by status (donut), Tender pipeline by stage (6-segment donut), Monthly revenue (empty state correct), Form submissions by week
- "Last 30 days · dashboard" period selector at desktop width does not collide with KPI titles
- Notification badge (2 unread), search icon, user avatar all present in topbar

### Clients (8 seeded)
- Cards layout shows code / status / name / email / ABN / classification / industry
- Realistic SEQ context: BCC, BGS, GCWA, QTI, SPG (Queensland gov/edu/industry)
- Mix of Government + Private classifications
- Detail opens as side-drawer with Details + Contacts tabs (consistent with PR-63 pattern)
- Edit form pre-populated; Progress Claim Reminder cadence field present

### Subcontractors & Suppliers (4 seeded)
- Polymorphic Subcontractor + Supplier display
- Prequalification badge chain: APPROVED (green) / PENDING (amber)
- Alerts column "1 expiring" chips reconcile internally with detail's "EXPIRING SOON" insurance badges
- Detail panel shows: ABN + classification banner, Categories chip (Concrete Cutting), Licences with QBCC number + expiry + ACTIVE badge, Insurances with provider + expiry + status
- Action set: Approve prequal / Suspend / Deactivate

### Sites (8 seeded)
- Realistic Queensland addresses + postcodes (Capalaba 4157, Coomera 4209, Eagle Farm 4009, Ipswich/Darra 4076, Maroochydore 4558, Sandgate 4017, Toowoomba 4350)
- Codes IS-S001 through IS-S007 (Gateway Depot uses GATEWAY code as a deliberate exception)
- Sites correctly linked to client owners (BCC → Sandgate, QTI → Ipswich + Toowoomba, GCWA → Coomera, etc.)

### Workers / Resources Directory
- Page lives at `/resources` and is labelled "Workers (legacy)" in the breadcrumb (acknowledges the PHASE 6 dual-model deferral)
- KPI strip: 17 in scope, 2 unavailable, 1 coverage risk, 17 with competencies
- Resource directory grouped by role (e.g. "Civil Labour — 4 workers")
- Worker detail panel with competency chips (Hassan Al-Farsi: Construction Induction White Card + Pipe Laying & Bedding)
- Availability Windows + Role Suitability widgets render empty state correctly

### Estimate Rate Library — the §5A.1 keystone
The tab strip itself is the headline finding:

| Tab | Count | Verified |
|-----|-------|----------|
| Labour | 7 | Per-day Day/Night/Weekend columns ✓; matches §5A.1 PR F unit correction |
| Plant | 10 | Tab present (not deep-dived this pass) |
| Disposal | 23 | Tab present (not deep-dived this pass) |
| **Saw Cutting** | **61** | **Cutrite matrix intact** — Equipment × Elevation × Material × Depth dimensions |
| Core holes | 20 | Per-10mm rates, formula banner matches PR #148 |
| Fuel | 1 | Tab present |
| Enclosures | 4 | Tab present |
| Other rates | 28 | Tab present |
| Densities | 42 | Material density library + category grouping (PR-A from §5A.3) |

Critical UX banner present on every tab: *"Rate snapshots: Every submitted quote freezes the rates in force on the submit date. Editing a rate here never changes an old quote."* — the rate-snapshot policy is communicated.

Cutrite-specific banner: *"Rates shown are base rates. High-Freq / Low-emission method adds 25%. Wall elevation adds 10%. Inverted elevation doubles the rate. These multipliers are applied at cutting-sheet save time."* — confirms PR #148 multiplier semantics in the UI.

Core-holes formula banner: *"Rate is per 10mm depth. Final cost = rate × (depth ÷ 10) × quantity × elevation multiplier × method multiplier."* — formula transparency in the UI.

Densities banner: *"Material densities used by the scope item form. Density auto-populates when a material is selected."* — PR-A integration documented.

## Findings (CONCERN level)

### F1A-01: Sites detail page may not match PR #288 changelog
**Severity:** CONCERN
**Page:** `/sites/:id` (e.g. Ipswich Motorway Corridor — Stage 4 → `/sites/site-001`)
**Expected per roadmap §5A.3 PR #288:** KPI strip + tabs (Overview / Tenders / Projects / Documents) + inline Edit + Delete
**Observed:** Title card with client chip + code chip + address + created date; Access notes / hazards panel; Linked tenders 0 + empty state; Linked projects 0 + empty state; Edit site button only — **no KPI strip, no tabs, no Documents section, no Delete button visible**
**Possible cause:** Conditional rendering when no linked data exists; OR PR description was aspirational; OR regression in a subsequent merge
**Action:** Verify on a site with linked tenders + projects + documents (e.g. seed IS-T100 into a site context, or create test data). Re-examine.

### F1A-02: `?tab=workers` URL param silently sanitised to `?tab=clients`
**Severity:** MINOR (UX)
**Page:** `/master-data?tab=workers`
**Observed:** URL silently rewrites to `?tab=clients`; the "Workers →" tab in the master-data tab strip is a link to `/resources` (a different route), not a same-page tab
**Action:** Either accept (workers genuinely live on a different route — the arrow suffix communicates this) or reject the `?tab=workers` query value with a 404 or visible warning. Currently the silent redirect could confuse a deep-link recipient. Low priority.

### F1A-03: Worker / WorkerProfile dual model still present
**Severity:** ACKNOWLEDGED (PHASE 6 deferred)
**Page:** `/resources` titled "Workers (legacy)"
**Observation:** The breadcrumb explicitly self-labels as "(legacy)", confirming the PHASE 6 deferred item is still alive
**Action:** No new finding — already on the deferred list. Worth surfacing in the master fix-queue.

### F1A-04: Email column truncates in client contacts tab
**Severity:** MINOR (UX)
**Page:** Client detail → Contacts tab
**Observation:** Email field shows `daniel.reilly@brisba...` instead of the full address; no apparent tooltip or scroll-to-view
**Action:** Either add a tooltip on hover, or widen the column / wrap. Cheap fix.

## Items not yet verified (carried to later phases)

- Global Lists / lookup values (will be verified through Tendering dropdown usage in Phase 1B)
- Crews master data
- Worker competency CRUD (only viewed read-only on a single worker)
- Asset categories (Maintenance / Assets touch — Phase 1E or 3)
- Plant / Disposal / Fuel / Enclosures / Other-rates tabs only counted, not row-sampled

## Inter-phase observations

The seed is comprehensively populated (17 workers, 8 clients, 61 saw cutting rates, etc.) — contradicts the seed-only-IS-T100-tender impression we got from the terse `pnpm seed` output earlier. The earlier seed run was likely idempotent and silent about already-present rows. Worth noting in the Phase 0 schema-drift finding as related context.

The **IS-T100 template tender** mentioned in seed output should appear in Phase 1B as the heart of the tendering smoke. That fixture is the workhorse for the rest of Phase 1.
