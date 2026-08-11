# SLICE-0 plan — Schedule of Rates (SoR) for live jobs

**Status:** PLAN. Design LOCKED by Marco 2026-08-11 (brainstorm + mockups `sor-live-job-workflow`,
`sor-erp-mockup`; memory `project_sor_program`). Build sliced; each slice lands green on its own.

## What this is (and is NOT)
A **Schedule of Rates system for LIVE JOBS** that prices **Variations (VC)** and **Agreed Records /
dayworks (AR)**. **SEPARATE from tender pricing** — tenders keep the existing estimate engine; the SoR is
at most *issued* at tender as a reference for how variations are calculated. Do NOT wire the SoR into the
tender/estimate rate path.

## Locked rules
- **Master catalog**: 4 categories — Labour (Position·Class·Ordinary/1.5x/2x), Plant/Equipment/Consumables
  (unit+rate), Waste (unit+rate), Subcontractors (cost+). Source = the .xlsm/.pdf Marco supplied.
- **Two fixed 6-month periods/yr**: H1 Jan-Jun (expires 30 Jun), H2 Jul-Dec (expires 31 Dec). Append-only change log.
- **Per-client rate card**: add/remove/edit off master + **reset to default** (reuse the shipped
  `TenderRateSet`/`TenderRateEntry` snapshot-override-reset pattern).
- **Attach to a job via a New-Tender-style WIZARD**: cascade Client -> Tender or Live job -> pick the specific one.
  First VC/AR on a job attaches & LOCKS a Job SoR snapshot. **Per-record rate lock + SoR-version stamp**:
  each VC/AR freezes its rate + records the SoR version; a job past expiry gets a re-issued SoR for NEW
  records while OLD records keep their historical rate/version.
- **VC** = desktop-priced upfront; build on the EXISTING `Variation` model, priced from the locked SoR.
- **AR** = dayworks; NET-NEW; captured on the EXISTING field/mobile app; site crew see **NO rates/$**;
  requires **photos + worker & client-rep signatures** to submit.
- **Approval / notification chain** (sequential, not value-tiered; via `NotificationTrigger` + roles):
  Worker submits -> **WHS & Commercial Compliance** notified -> reviews/corrects/prices/approves ->
  **Operations Manager** notified throughout -> signs off -> **Director** notified when the **progress
  claim** is ready -> final review & approval (claim level). Office MUST be able to edit/correct + reject-
  and-send-back (crews make many mistakes). Whoever edits != necessarily who approves.
- **Register** per JOB (VC + AR, with SoR version + status); approved items feed the existing progress claim.
- **Client PDF**: pick applicable lines + job header + terms + prepared-by/signature; strip internal BMI
  column. Reuse the quote-PDF (HTML->PDF) path.

## Slices (each <=10 files, chained; verify against origin/main first)
- **S1 - master SoR schema + API + seed** (`feat/sor-master-schema`). New models: `SorPeriod` (year, half
  H1/H2, start/expiry, status), `SorRate` (period, category enum, position/name, class, unit, ordinary +
  oneAndHalf + double Decimals, comments, isReference for cost+), `SorChangeLogEntry` (append-only).
  Additive migration (escalates); data-model map regen; sor module service/controller/module; seed the
  H1-2026 period + a representative rate set from the supplied schedule; tests. **Foundation — arm first.**
- **S2 - master admin UI + change log** (`feat/sor-master-ui`). The rate-book screen under Estimating:
  period selector, 4 category tables (Labour OT tiers), add/edit/remove rate, change-log view. Depends S1.
- **S3 - per-client rate card** (`feat/sor-client-card`). Override/add/remove per client + reset-to-default,
  mirroring `TenderRateSet`. Depends S1.
- **S4 - attach-to-job wizard + snapshot/lock** (`feat/sor-attach-job`). Cascade wizard (client -> tender/
  job -> pick); create Job SoR snapshot; per-record version stamp; re-issue on expiry. Depends S1/S3.
- **S5 - client SoR PDF** (`feat/sor-client-pdf`). Pick applicable lines -> PDF (header/terms/signature,
  strip BMI) via the quote-PDF path. Depends S1.
- **S6 - VC priced from SoR** (`feat/sor-variation`). Extend the existing `Variation` to price its lines
  from the locked Job SoR (desktop). Depends S4.
- **S7 - AR field capture** (`feat/sor-ar-field`). Field/mobile wizard: works, resources (no $), hours/qty,
  photos, worker + client signatures -> submit. Depends S4.
- **S8 - AR office review + approval chain** (`feat/sor-ar-review`). Review queue; edit/correct; price from
  locked SoR; approve/reject-and-send-back; NotificationTrigger alerts to WHS&CC + Ops Manager; Ops sign-off.
  Build the chain **configurably-ready** (roles as data), but NO admin editor yet. Depends S7.
- **S9 - register -> progress claim** (`feat/sor-register-claim`). Per-job VC/AR register; approved items
  feed the existing progress claim; Director notified when claim ready. Depends S6/S8.

## LATER (separate PR, do not miss — Marco 2026-08-11)
- **Configurable approval-chain / roles editor** — admin UI to edit the WHS&CC -> Ops -> Director chain and
  its roles (Director-configurable, on the Authorization config layer / AuthorityRule). Not hardcoded.

## Start
Arm **S1** now. S2-S5 chain off S1; S6-S9 off the job/attach layer. Client PDF reuses quote-PDF. Nothing
touches tender pricing, Azure/Entra directly (SharePoint only if a slice needs doc storage — hand tenant
steps to Marco), or `/sot/`.
