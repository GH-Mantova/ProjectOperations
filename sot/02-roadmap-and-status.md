# 02 — Roadmap & Status

**Last updated:** 2026-07-15 (AEST) · **Owner:** any chat, via doc-reconcile PR (sot/ only, per CP-24).
Single forward-looking roadmap for ProjectOperations. Supersedes the old `roadmap.md`,
`development-plan.md`, `development-backlog.md`, and the sanity-check/QA planning docs.

**State legend:** ✅ Done (merged to `main`) · 🔧 In-PR (open PR now) · 📦 Staged (prompt
written, not yet a PR) · 🧊 Awaiting-staging (agreed/needed, no prompt yet) · 💡 Idea
(raised, not decided). ⚠ = doc-vs-code conflict to confirm against the codebase (see §7).

> **"What's next on the pipeline?"** — answer from this file: §2 (open PRs) + §3 (staged prompts
> ready to arm/PR) + §4 (agreed, not yet staged). This is the CURATED roadmap and must be kept
> current on every doc-reconcile PR. For the LIVE PR/board state, run
> `scripts/pipeline/bring-up-to-speed.ps1` and trust its `[LIVE]` lines over any line here. Detailed
> per-gap rationale lives in `docs/architecture/drafts/` (forms + D365/M365 + competitor gap analyses).

---

## 1. ✅ Done — foundation (merged, stable)

Phases 1–4 complete: Commercial (tendering pipeline, estimate editor, Cutrite schedule
rates, AI scope drafting, quotes + revisions, quote PDF via HTML→PDF, clarifications,
tender dashboard, contracts, rates admin, dashboard builder, client portal) · Operations +
Field (projects, jobs, scheduler baseline, sites, Gantt, worker availability, field mobile
shell, allocations, pre-start, timesheets, GPS clock-on, safety IS-INC/IS-HAZ, PWA offline)
· Directory + Compliance (extended client model, subcontractor/supplier prequal, unified
polymorphic contacts, entity licences/insurance, credit applications, compliance dashboard,
worker qual register, expiry crons, auto-block) · Integrations (SharePoint Graph live, Xero
OAuth2, MYOB CSV, M365 SSO + local JWT + Super User, AI providers + BYOK encryption).

**Full per-PR history lives in `03-progress-log.md`.** Recent merged batch (2026-07, #455–#539):

- **Data-model spine:** Job/Project 1:1 (#472, #474), Worker/WorkerProfile survivor design (#475), Job–Project merge Phase A additive links (#500)
- **Authority/config seam:** `User.managerId` hierarchy (#478), AuthorityService + AuthorityRule (#479), frontend permission guards honor super-user (#537, merged 2026-07-12)
- **Tendering/estimating:** tender packages + pricing basis (#480), New Tender wizard (#492), per-section markup waste+cutting (#483)
- **Rates & Lists:** R0 RateTable + `resolveRate` seam (#485), R0b admin UI (#501)
- **Forms:** Authoring v1 (#481), Engine v2 plan (#482), F-1 Builder shell (#499)
- **Inventory:** native stock layer slice 1 (#484, replaces AssetTiger)
- **Comms/approvals:** Phase 2 slice 1 — decision seam + internal messages (#497)
- **Dashboards:** add-widget gallery (#473), rename/copy + popover fix (#476), Program snapshot + Availability heatmap (#494), widgets batch 3 — weather + gallery module view (#527, merged 2026-07-09; **known residual:** site-picker dropdown is empty because a `pageSize=200` request hits the backend `@Max(100)` cap — follow-up, not yet fixed)
- **Scheduler lane (late June):** Job Roles (#450), public holidays (#451), day-grain ScheduleAllocation (#452), scheduler grid UI (#453), availability heatmap (#454)
- **Master data / QA:** client win/loss counters (#486), analytics status casing (#487), jobs progress from stage activities (#488), scheduler month grid (#489), sites job count (#490), findings batch 1 (#491)
- **Infra/docs:** data-model map + SoT TOC infra (#493), watcher hardening (#495), GATE-ALLOW migrations (#496), SoT reconcile (#498), pr-watcher no-PR routing fix (#528, merged 2026-07-09), watcher prompt-dir hardening (#533, merged 2026-07-10), classify all 48 Unclassified models across 6 new/refined domains (#539, merged 2026-07-13 — Unclassified is now empty; Procurement, Inventory, Communications, Authorization added)

---

## 2. 🔧 In-PR — open right now (5)

| PR | Title | Status / blocker |
|---|---|---|
| #503 | Dashboards widget batch 1 (8–9 quick wins) | UI-only; shepherd smoke-verify in progress (`rev-503-smoke-verify`). Residual: "Who's away"/"Leave pending" show misleading zeros — `workers.controller` `@Get(":id")` shadows `/leaves` + `/unavailability` (pre-existing 404, not in #503's diff). **Needs Marco decision A/B/C — see §6.** |
| #504 | Seed tender-package-disciplines GlobalList into prod | Fixes New Tender wizard 404 in prod (`prisma migrate deploy` never runs the TS seed). Insert-if-absent migration. |
| #506 | Grant Marco super-user (seed parity with Sean) | `rev-506-apitest-verify` ready to run then merge. |
| #507 | Never-stale PWA + build SHA stamped end-to-end | Reviewer verdict **FIX**: code is correct; only blocker is a missing `GATE-ALLOW: dependencies` marker for 5 new `workbox-*` deps. Edits `deploy.yml` → will **not** auto-merge (goes live on next push to `main`). **Marco's call — see §6.** |
| #508 | Client-version telemetry (admin build visibility + reload nudge) | Companion to #507. `rev-508` ready. |

---

## 3. 📦 Staged — prompt written, not yet a PR

- **`rev-503-smoke-verify`, `rev-506-apitest-verify`, `rev-508`** — verification re-runs for the open PRs above.
- **`pr-cors-multi-origin`** — parse `CORS_ORIGIN` as comma-separated list for custom-domain cutover (e.g. operations.initialservices.net) without breaking the azurestaticapps host. Backend config only.
- **`pr-fv2-fields-basic`** (currently `-HOLD`) — Forms FV2 basic/survey/layout field wire-ups (email, phone, address, time, radio, rating, scale/nps, heading, paragraph, divider, image). Gate was "after F-1 merges" — **F-1 (#499) has merged, so this can be activated now** by renaming to `-ready`.

### 3a. 📦 Forms & inspection engine — gap prompts (staged 2026-07-15; PR #609 for durability)

Forensic code check found the forms engine ~75% built (PR #97). These target only verified residual gaps.
Armed (`-ready`, buildable now): `pr-forms-content-library` (reusable snippets + template clone — kills the
pasted-T&C duplication), `pr-forms-scoring-passfail`, `pr-forms-corrective-actions`, `pr-forms-public-kiosk-qr`,
`pr-forms-submission-pdf`. HOLD (gated): `pr-forms-ai-build-from-pdf` (needs a doc-AI key via integration-keys).
Detail: `docs/architecture/drafts/form-inspection-engine-spec.md` (Part 6 = implementation status).

### 3b. 📦 ERP-wide gap prompts vs Assignar/TSheets/AssetTiger/HammerTech/Procore (staged 2026-07-15)

Grep-grounded (progress-claims, variations, RFI, GPS timesheets, competency-gated scheduling already exist —
excluded). Armed (`-ready`): `pr-erp-daily-site-diary`, `pr-erp-commitments-budget`, `pr-erp-asset-barcode-checkout`
(barcode/QR + custody + reservations), `pr-erp-timesheet-geofencing` (GPS exists → geofence only),
`pr-erp-haulage-dockets`, `pr-erp-competency-expiry-alerts`, `pr-erp-punch-snag-list`, `pr-erp-sopa-payment-schedule`,
`pr-erp-whs-template-packs` (seed). HOLD (gated/verify): `pr-erp-cost-to-complete` (after commitments), `pr-erp-live-crew-map` (after geofencing),
`pr-erp-muster-headcount` (after public/kiosk sign-in), `pr-erp-subbie-prequal` (VERIFY existing prequal first).
**DECIDED 2026-07-15 — asset depreciation is Xero-only; the ERP does NOT track it (prompt dropped).**
Detail: `docs/architecture/drafts/erp-vs-competitors-gap-analysis.md`.

### 3c. 📦 D365/M365 parity — staged earlier (see `docs/architecture/drafts/d365-*`)

~23 items staged in prior batches (Expenses, procurement three-way-match, RSO, BI layer, billing rigor,
Xero-deepening, CRM lead/opportunity; UX pack; cases, KB, HR-leave, customer-voice) + v2 net-new (BC
Sustainability/waste-emissions ledger, Field Service asset service-history/agreements, financial dimensions,
Power Pages external portal). See `project_d365_parity_program` + `project_jotform_and_d365_v2_gap`.

---

## 4. 🧊 Awaiting-staging — agreed/needed, no live prompt yet

**Dashboards (Marco approved full catalogue 2026-07-03; gated in sequence):**
- Widgets batch 2 (composed) — form-approvals-waiting, quotes-drafted-not-sent, pre-starts-today, recent-site-photos, "My day". Gate: after #503 merges.
- Widgets batch 3 — site weather (Open-Meteo, platform's first external data dep) + role-based default dashboards. Gate: after batch 2 merges.

**Data-model consolidation (design locked; destructive, phased, human-reviewed):**
- Job + Project full merge — survivor Project (Phase A links already merged #500; remaining phases).
- Worker/WorkerProfile consolidation — WorkerProfile canonical (design #475; migrate scheduler + competency code, then drop Worker).

**5A Tendering sign-off gate (still the pilot-facing release blocker):**
- Floating AI window shell; AI Settings tab (Sean + user views); remaining persona sub-mode tooling.
- 5A.3 end-to-end workflow review with Raj → fix PRs → **Raj + Sean sign-off**.
- Clarification Call/Email/Meeting/Note first-class types — **Done (types wired)** (verified 2026-07-08): typed end-to-end via `TenderClarificationNote.noteType` (call/email/meeting/note/response, PR #72; `@IsIn` API validation + UI filter) and `TenderEntry.type` (PR #18 unified comms panel). *(The earlier "email-only" read looked at the Correspondence Hub and missed the clarification-note subsystem; if #260 intended richer per-type workflows beyond the discriminator, re-scope that separately.)*
- Quote PDF enhancements — **all Done** (verified 2026-07-08; drop from this gate at next reconcile): PR A density-as-lookup shipped incl. seed (`EstimateMaterialDensity` + admin UI + 44 seeded rows); PR B card-header summaries / override / proportional cost-line allocation (`client-quotes.service.ts`); PR C floating Assumptions/Exclusions editor, Alt+A (`AssumptionsExclusionsFloatingEditor.tsx`).
- Variation PDF + Schedule-of-Rates PDF HTML→PDF migration (deferred pending Sean's templates).

**5C Forms Engine v2 remaining slices (spec: `06-active-specs.md`):**
- F-2 rules engine, F-3 repeating sections, F-4 advanced fields (Lookup/Calculation/Table/UniqueID/Terms), F-5/F-6 Worker/Asset/Location/Weather/Photo/Signature, full PDF export, analytics page, F-9 web push, F-11 output channels, F-12/F-13 AI.

**Partial last-mile (from codebase-verified `development-plan.md` — finish the last 20%):**
- Timesheet→payroll export UI (backend + CSV endpoint done); plant-utilisation report page (endpoint done); error-envelope humane FE render; `Project`/`Job` `siteId` hard NOT-NULL FK (**still Open** — verified 2026-07-08: `siteId` remains nullable/SetNull, backfill pending); AI provider abstraction collapse; auto SharePoint Lost/Archived re-org. *(Gantt drag-to-reschedule — **Done**, #446, in the projects Gantt `GanttChart.tsx`, not the scheduler grid.)*
- Blocked on **Entra grants**: calendar live adapter, correspondence live Graph ingestion, Azure Mail.Send production email.

**Phase 6 tech debt:** PWA OfflineProvider boundary, SW autoUpdate race, dead-letter UX; orphaned cardless waste rows. *(Verified 2026-07-08 and closed: `directory.finance` is **N/A** — intentional field-masking `maskBank`/`stripBankFromInput`, not a missing guard; `subcontractor_contacts` **already dropped** — migration `20260426_feat_drop_deprecated_tables`; `ScopeWasteItem.wasteTonnes → qty` rename **Done** — migration `20260701_..._waste_rename_qty` (the remaining `ScopeOfWorksItem.wasteTonnes` is a separate deprecated legacy column).)*

---

## 5. 💡 Ideas / future (Phase 7–8 — not yet decided)

Subcontractor portal `/portal/sub` (needs PR-213 assignment-model decision) · custom
dashboard widget builder (**already SHIPPED** — verified 2026-07-08, `CustomBuilderWidget.tsx`, bounded to 5 data sources × 3 metrics × 3 chart types; historical, not a future idea) · calendar sync
(Google + Microsoft) · two-way email reply parsing · MYOB live (OAuth2) · web push · websockets
(real-time scheduler/safety) · subcontractor rate cards · asset GPS tracking · document OCR ·
automated progress-claim generation · tender win/loss ML · multi-company · SWMS builder ·
form-builder conditional logic · maintenance scheduling automation.

---

## 6. ⛔ Needs Marco (decisions blocking progress)

1. **#503 workers-controller route bug** — (A) accept misleading zeros, (B) stage a follow-up to fix `@Get(":id")` route ordering, or (C) other. *Recommend B.*
2. **#507 deploy.yml** — approve the merge (deploy-workflow change goes live on next push to `main`) and add the `GATE-ALLOW: dependencies` marker for the `workbox-*` deps.
3. **Entra grants** (Mail.Read / Calendars.ReadWrite / Mail.Send) — biggest single unlock: flips calendar sync, correspondence ingestion, and production email from mock to live.
4. **PR-213 subcontractor assignment model** — unblocks the subcontractor portal.
5. **Raj + Sean tendering sign-off** + their Variation / Schedule-of-Rates PDF templates.

---

## 7. ✅ Reconciliation — resolved against the codebase (2026-07-08)

The old `roadmap.md` and the codebase-verified `development-plan.md` (2026-06-19) disagreed on
several "is it built?" items. All were verified against `apps/` + `prisma/schema.prisma` +
`prisma/migrations/` during the sot-consolidation build:

| Item | State | Evidence |
|---|---|---|
| Custom dashboard widget builder | ✅ Done (bounded) | `apps/web/src/dashboards/CustomBuilderWidget.tsx` + `customWidget.ts` — 5 data sources × 3 metrics × 3 chart types |
| Forms Engine v2 UI depth | 🔧 Partial | F-1 builder shell + fill + rules shipped (#499); v2 palette (F-4/F-5) + push (F-9) not built yet (`formDesignerState.ts`) |
| Gantt drag-to-reschedule (#446) | ✅ Done | `apps/web/src/pages/projects/GanttChart.tsx` (@dnd-kit, PATCHes dates) — projects Gantt, not the scheduler grid |
| Quote-PDF PR B / PR C | ✅ Done | PR B `client-quotes.service.ts` proportional allocation; PR C Alt+A `AssumptionsExclusionsFloatingEditor.tsx` |
| Clarification Call/Email/Meeting/Note types | ✅ Done (types wired) | Typed end-to-end: `TenderClarificationNote.noteType` = call/email/meeting/note/response (PR #72, `@IsIn` in `tender-clarifications.controller.ts`, filtered in `TenderClarificationLog.tsx`) + `TenderEntry.type` (PR #18 unified comms panel). *(Earlier "email-only Correspondence Hub" read missed this subsystem; if #260 scoped richer per-type workflows, re-scope separately.)* |
| `subcontractor_contacts` drop | ✅ Done | migration `20260426_feat_drop_deprecated_tables` (data first unified into polymorphic `Contact`) |
| `directory.finance` guard | ✅ N/A | intentional field-masking (`maskBank` / `stripBankFromInput`), not a missing guard decorator |
| Material density lookup | ✅ Done incl. seed | `EstimateMaterialDensity` + admin UI + seed upserts 44 rows |
| `Project`/`Job` `siteId` NOT-NULL FK | ⛔ Open | `siteId` still nullable/SetNull on Tender/Job/Project/FormSubmission — backfill/enforcement pending |
| `ScopeWasteItem.wasteTonnes → qty` rename | ✅ Done | migration `20260701_..._waste_rename_qty`; `ScopeOfWorksItem.wasteTonnes` is a separate deprecated legacy column |
