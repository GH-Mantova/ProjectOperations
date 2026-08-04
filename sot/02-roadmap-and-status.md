# 02 — Roadmap & Status

**Last updated:** 2026-08-04 (AEST) · **Owner:** any chat, via doc-reconcile PR (sot/ only, per CP-24).
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

**Shipped since the last reconcile (2026-07-21 → 2026-08-04, ~#742–#893; full program audit filed 2026-08-04):**

- **Nav / IA redesign:** 7-group sidebar (#746), Tenders consolidation + delete dead Tender Settings (#841), `/directory` canonical + drop master-data/clients-grid (#847), mobile tab bar (#851), Dockets/Expenses into HR nav (#848/#854), every nav item gated on its API view-permission (#834), orphan-route cleanup + redirects (#836/#845), H1 titles aligned to sidebar (#777).
- **Dialogs → useConfirm:** COMPLETE across all surfaces (#807–#812, stragglers #870); `usePrompt` text-input primitive armed (in-flight).
- **Field / GPS:** A1 mandatory hard-block on clock-on/off (#817), A2 foreground breadcrumb trail (#820), A3 mandatory GPS across attendance/muster/forms (#821); mobile-native notifications (#849).
- **Safety / WHS:** muster/evacuation roll-call + headcount widget (#776); SWMS SLICE A1 template-catalog tables (#797).
- **Tendering / estimating:** waste transport cost engine R3-T1 (#745), material-derived waste group/item (#795), Assumptions & Exclusions tab (#879), transport sub-row expand-by-default (#880), DB-backed org-wide label overrides (#799), auto-create Contract on CONTRACT_ISSUED (#798), CRM board as 2nd tab on Tenders (#789), one-click generate-draft-tender from a lead (#788).
- **Rates / Xero:** rates xlsx import with preview/confirm (#748), fallback-audit + miss-warn (#747); Xero push ACCPAY bills + pull payment status (#754).
- **Dashboards / wizard:** Smart Wizard reads metadata catalog at runtime (#750), Home rename + server-owned system default (#824/#828).
- **Map / ops:** LocationsMap panel — Settings › Map locations, m1b (#779), OPS-M2 tip finder + `TipRecommendationLog` (#819).
- **Security:** permission guards on admin-users/access-requests/global-lists/timeline (#837/#838/#839), single write path for AI keys (#829), super-user parity (#780/#782), seed hardening → SSO-only (#796).
- **Last-mile UI (previously listed as pending in §4):** timesheet→payroll export page `PayrollExportPage.tsx`, plant-utilisation report page `PlantUtilisationReportPage.tsx`.
- **Pipeline / infra:** PR Master station (#791), FIX LANE (#801/#806), front-matter dependency gating (#760), watcher verdict archival (#800), synthetic Xero fixtures slice-1 (#883), smoke throttle parity fix (#882).

---

## 2. 🔧 In-PR — open right now (2)

> Live snapshot read from GitHub at reconcile time (2026-08-04). For richer status/blocker
> detail run `scripts/pipeline/bring-up-to-speed.ps1` — its `[LIVE]` lines beat this table
> the moment it drifts.

| PR | Title | Notes |
|---|---|---|
| #895 | feat(api): SLICE-3 backfill ApiCredential vault + flip resolve() to vault-first | do-not-merge; escalates (prod-data backfill) — Marco reviews |
| #894 | docs(queue): stage Smart Wizard metadata-catalog fix prompts (SLICE 1-3) | docs-only staging |

The entire 2026-07-27 In-PR set (#779/#787/#789/#796/#797/#808) has since MERGED. Also in-flight but
not yet a PR: `pr-dialogs-prompt-primitive` (the `usePrompt` text-input primitive) — re-armed
2026-08-04 once its stragglers dependency (#870) landed. Per-PR history lives in `03-progress-log.md`;
run `bring-up-to-speed.ps1` for the authoritative live list.

---

## 3. 📦 Staged — prompt written, not yet a PR

> **Reconcile 2026-08-04:** the older per-prompt entries here (rev-503/506/508 and the 3a/3b/3c
> batches below) are largely **consumed or shipped** — the queue is currently drained (0 armed). The
> live "planned next" set is now the **SLICE-0 plan docs on `docs/plans/`** plus the in-progress
> programs. Verify any individual prompt against `main` before re-arming (5 of 7 re-queued prompts
> historically turned out already shipped). Full inventory: `03-progress-log.md` + the 2026-08-04 audit.

**Planned build programs — SLICE-0 design on `main`, code partly/not built (`docs/plans/`):**
- `settings-restructure-plan` (+ `-permission-map`) — **building** (SLICE 1/2 merged #877/#878; reconciler #884).
- `model-merge-plan` — B-P0a Job/Project then B-P0b Worker/WorkerProfile (**destructive, Marco-present only**).
- `smart-wizard-catalog-deploy-plan` — **building** (fix prompts staged #894).
- `issue-register-consolidation-plan` — one Issue engine for Case/CorrectiveAction/Safety+Hazard.
- `assets-equipment-tabs-plan` — consolidate Assets/Inventory/Maintenance/Procurement into one tabbed page.
- `job-stage-durations-plan` — editable Job/Stage durations driving scheduler resource allocation.
- `reporting-dashboard-layout-plan` — user-composed reports as a dashboard.
- `site-dissolution-plan` — dissolve Site → physical to Job, commercial to Client, Directory to Clients.
- `merge-liberty-and-speed-plan` — pipeline self-improvement (do-not-merge).
- SWMS `swms-build-slice-plan` — A1 shipped (#797); A2..A11 / B1..B5 remaining.

**Newly planned 2026-08-04 (moved here from §4/§5 in the disposition pass; SLICE-0 plans on `docs/plans/`, do-not-merge #903/#905 — nothing armed):**
- `forms-v2-program-plan` — the WHOLE Forms Engine v2 build **F-2 → F-13** as one sequential launch chain (was §4 "5C Forms v2"; maintenance-scheduling automation folds into F-8, was §5).
- `subcontractor-rate-cards-slice-plan` — additive `SubcontractorRate` (was §5). Locked: explicit "price from subbie" action, canonical 4-scope-code, append-only supersede; RC-3 gated behind PR-213.
- `realtime-websockets-plan` — scheduler + safety live updates (was §5). Needs the WebSocket-vs-SSE / App-Service call (§6).
- `multi-tenant-plan` — sister-company multi-tenancy (was §5). Needs the tenancy-model A/B/C call (§6); recommend A.
- `progress-claim-autogen-plan` — reuses the existing pro-forma DRAFT engine; generate + manual edit (was §5).
- `tender-winloss-datacapture-plan` — capture-first on the existing `TenderOutcome` model; ML deferred (was §5).

**Active build programs (not on `docs/plans/`):** unified API-key vault + geocoding failover (SLICE-1/2
merged #889/#892; SLICE-3 open #895); synthetic integration fixtures (Xero slice-1 #883; slices 2+3 staged #891).

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

> **Cleared 2026-08-04 (disposition pass).** Every prior §4 item was dispositioned — planned → §3, shipped → §1, parked/retired → §5, or a Marco decision → §6. Summary below.

**Dashboards** — **Done/removed:** widgets batch 2 (form-approvals-waiting, pre-starts-today, recent-site-photos, "My day") and site-weather are already on `main` (widgetRegistry). Role-based default dashboards was **cancelled** (per-user `defaultDashboardId` chosen instead).

**Data-model consolidation** — **planned → §3** via `model-merge-plan` (#871): B-P0a Job/Project then B-P0b Worker/WorkerProfile (destructive, Marco-present).

**5A Tendering sign-off gate** — Floating AI window / AI Settings tab **parked** (a persona assistant + `AiSettingsPage` already exist). Clarification types and Quote-PDF enhancements **Done**. What remains is a **Marco/human gate → §6:** Raj + Sean end-to-end sign-off, and the Variation / Schedule-of-Rates PDF templates from Sean.

**Forms Engine v2 (F-2 → F-13)** — **planned → §3** as `forms-v2-program-plan` (one sequential launch chain; design spec in `06-active-specs.md`).

**Partial last-mile** — error-envelope humane render **Done** (`lib/api-errors.ts`, 16 files); AI-provider abstraction **resolved** (#829). Payroll-export + plant-utilisation pages **Done → §1**. Still open: `siteId` NOT-NULL backfill (HOLD `pr-siteid-notnull-backfill`, prod-data → §6) and auto SharePoint Lost/Archived re-org (Entra-blocked → §6). Blocked on **Entra grants** (§6): calendar adapter, correspondence Graph ingestion, Azure Mail.Send.

**Phase 6 tech debt** — OfflineProvider error-boundary **armed** (#902). SW auto-update race, dead-letter UX, and orphaned cardless-waste rows are **already resolved/closed** (prompt-based SW updates; `DeadLetterBanner`; `ScopeWasteItem.cardId` now required + cascade). `directory.finance`/`subcontractor_contacts`/`wasteTonnes→qty` items were already verified closed 2026-07-08.

---

## 5. 💡 Ideas / future (Phase 7–8 — not yet decided)

**Moved to Planned (§3) 2026-08-04:** websockets (real-time scheduler/safety), subcontractor rate cards,
automated progress-claim generation, tender win/loss (data-capture first), multi-company/multi-tenant, and
maintenance scheduling automation (folded into Forms v2 F-8). SWMS builder, web push, and form-builder
conditional logic are covered by the Forms v2 program (SWMS slice plan; F-9 push; F-2 rules).

**Retired 2026-08-04:** asset GPS tracking — needs per-unit hardware + a service subscription (Marco).
**Parked 2026-08-04:** subcontractor portal `/portal/sub` (future; gated on PR-213); MYOB live (OAuth2) —
stay on CSV. Custom dashboard widget builder is **already shipped** (`CustomBuilderWidget.tsx`).

**Still genuinely open / undecided:** calendar sync (Google + Microsoft) and two-way email reply parsing
(both Entra-blocked — see §6); document OCR (a `pr-vendor-invoice-ocr-HOLD` exists; needs a doc-AI key).

---

## 6. ⛔ Needs Marco (decisions blocking progress)

1. **#503 workers-controller route bug** — (A) accept misleading zeros, (B) stage a follow-up to fix `@Get(":id")` route ordering, or (C) other. *Recommend B.*
2. **#507 deploy.yml** — approve the merge (deploy-workflow change goes live on next push to `main`) and add the `GATE-ALLOW: dependencies` marker for the `workbox-*` deps.
3. **Entra grants** (Mail.Read / Calendars.ReadWrite / Mail.Send) — biggest single unlock: flips calendar sync, correspondence ingestion, and production email from mock to live.
4. **PR-213 subcontractor assignment model** — unblocks the subcontractor portal.
5. **Raj + Sean tendering sign-off** + their Variation / Schedule-of-Rates PDF templates.
6. **#895 API-key vault SLICE-3** — production-data backfill + `resolve()` vault-flip; open, do-not-merge, awaiting your review of the rendered diff.
7. **#876 field-worker `expenses.view` / `expenses.manage`** — permission grant; needs your call.
> **Resolved 2026-08-04 (were #8/#9):** **Websockets transport → SSE** (server-sent events; no Azure change needed). **Multi-tenant model → A, row-level `tenantId`** (nullable; null = shared master data, set = company-owned transactions). Both baked into their §3 plan docs — those two programs are unblocked (RT-1 / MT-0 armable).

> Items 1–2 (#503 route bug, #507 deploy.yml) are ~2 weeks old — **re-verify against the current board** before acting; they may already be resolved.
> **Top strategic unblock:** item 3 (Entra grants) gates the largest cluster of stalled work — calendar sync, correspondence ingestion, and production email.

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
