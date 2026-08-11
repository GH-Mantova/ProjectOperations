---
premise: '! test -f apps/api/src/modules/win-likelihood/win-likelihood.service.ts'
premise_means: No win-likelihood service exists on main yet. WL-1 (outcome capture) and WL-2 (win/loss reports) are merged; there is no bid-time feature-extraction or baseline win-likelihood API anywhere.
scope:
  - apps/api/src/modules/win-likelihood/**
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/app.module.ts
  - docs/plans/tender-winloss-ml-plan.md
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/win-likelihood/win-likelihood.service.ts && test -f apps/api/src/modules/win-likelihood/win-likelihood-features.service.ts && grep -rq "win-likelihood" apps/api/src/modules/tendering/tendering.controller.ts
size: 8
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: 'Purely additive and read-only: one new API module (win-likelihood) plus one GET route wired onto the existing tendering controller. NO schema change, NO migration, NO write path — the services only READ existing Tender / TenderOutcome / Client rows and compute in memory. To revert: delete apps/api/src/modules/win-likelihood/, remove its module registration from app.module.ts, and remove the single GET win-likelihood handler from tendering.controller.ts. Zero data blast radius.'
requires_merged: []
---

# WL3-S1: bid-time feature view + baseline win-likelihood API + capture-gap audit

**Binding plan:** `docs/plans/tender-winloss-ml-plan.md` (read it in full before starting).
This is **WL3-S1**, the first slice of the win/loss ML program. It builds on **WL-1**
(`TenderOutcome` capture, merged) and **WL-2** (win/loss reports, merged). It is **API-only, read-only,
no schema change**. It produces a **win-likelihood** number that is honest about its own accuracy, and
it emits a **capture-gap report** so we add data capture deliberately later (WL3-S1b), never blindly.

**Advisory only.** This number NEVER auto-prices a tender and is not wired into any pricing path.

## Grounded state on main (verified 2026-08-11)
- `model Tender` has: `title`, `description`, `status` (String, default "DRAFT"), `dueDate DateTime?`,
  `estimatedValue Decimal?`, `createdAt`, `tenderClients TenderClient[]`, `outcomes TenderOutcome[]`.
  There is **no discipline / work-type column on Tender** — treat that as a likely capture gap (below).
- `model TenderOutcome` (WL-1): `resultType TenderOutcomeResult?` (enum `WON` / `LOST` / `NO_BID`),
  `reason TenderOutcomeReason?`, `tenderValue`, `ourPrice`, `clientId`, `competitorOrWinner String?`,
  `recordedAt`, plus the append-only `supersedesId` / `supersededBy` chain. The **current** outcome of a
  tender is the head of that chain (the row with no `supersededBy`) — reuse whatever helper
  `tender-outcome-capture.service.ts` already uses to resolve the current outcome; do not re-derive it.
- Tendering module lives at `apps/api/src/modules/tendering/` (controller `tendering.controller.ts`,
  module `tendering.module.ts`). Read `tender-outcome-capture.service.ts` before starting.

## What to build

### 1. New module — `apps/api/src/modules/win-likelihood/`
Create a standalone Nest module (module + two services, no controller of its own — the route hangs off
the tendering controller, step 3). Register it in `apps/api/src/app.module.ts` alongside the other
feature modules, and import it into `tendering.module.ts` so the controller can inject the service.

### 2a. Feature-extraction service — `win-likelihood-features.service.ts`
A read-only service that, given a tender id, derives the **bid-time features** (features knowable
*before* the outcome) from EXISTING data only:
- **client** — the tender's primary client (from `tenderClients`; if multiple, use the same
  primary-client rule the tendering read path already uses — do not invent a new one).
- **valueBand** — bucket `estimatedValue` into bands (e.g. `<50k`, `50-250k`, `250k-1M`, `>1M`;
  define the band edges as a small exported const so WL3-S2/S3 reuse them). Null estimatedValue -> an
  explicit `UNKNOWN` band, and this counts as a capture gap for that tender.
- **leadTimeDays** — `dueDate - createdAt` in days when both present (else null + gap).
- **season / month** — month/quarter derived from `dueDate` (else from `createdAt`).
- **clientHistoryWinRate** — over the client's OTHER closed tenders (current outcome resolved), wins /
  (wins + losses), NO_BID excluded from the denominator. Return the raw counts too, not just the ratio.
Return a typed `TenderFeatures` object. This service is the single source of the feature vector so the
future trained model (LATER) can swap in behind the same shape.

### 2b. Baseline service — `win-likelihood.service.ts`
Computes the baseline win-likelihood for a tender from its features:
- Build the **cohort** of similar CLOSED tenders (matching on client and/or value-band and/or
  work-type where present — degrade gracefully: if a dimension is missing/UNKNOWN, widen the cohort
  rather than erroring).
- `pointEstimate = wins / (wins + losses)` over the cohort (NO_BID excluded).
- **Wilson score confidence interval** for that proportion at 95% given the cohort sample size — small
  cohort -> wide interval -> the caller can show "low confidence". Implement Wilson directly (small,
  well-defined formula) with a unit test asserting known values; do NOT add a stats dependency.
- **Top "why" factors** — a short ordered list of the features that most moved the estimate vs the
  overall base rate (e.g. "this client: 8/10 won", "large value band: below-average win-rate"),
  each as `{ factor, direction, detail }`. Keep it explainable, not a black box.
- A `confidence` label (`LOW` / `MEDIUM` / `HIGH`) derived from cohort size + interval width, with the
  thresholds as exported consts.
- Return `{ pointEstimate, interval: {low, high}, confidence, cohortSize, whyFactors, captureGaps }`.

### 2c. Capture-gap audit (part of 2b's output)
While computing, collect a **capture-gap report**: the list of desired bid-time features that are NOT
reliably present today (e.g. `discipline/work-type` — no column exists; `estimatedValue` missing on N%
of tenders; etc.). Expose it two ways: (a) per-tender `captureGaps` in the response above, and (b) an
aggregate `GET /tenders/win-likelihood/capture-gaps` (see step 3) that scans recent tenders and returns
each gap with a coverage % and a one-line "why it matters". This report is what WL3-S1b will act on —
**do not add any Tender/TenderOutcome columns in this slice.**

### 3. Routes on the tendering controller — `tendering.controller.ts`
Add two GET endpoints (guarded with the same `JwtAuthGuard` + `PermissionsGuard` +
`@RequirePermissions(...)` pattern every other tendering read endpoint uses — reuse the existing
tender-read permission code, do NOT invent a new permission):
- `GET /tenders/:id/win-likelihood` -> the baseline service result for one tender.
- `GET /tenders/win-likelihood/capture-gaps` -> the aggregate capture-gap report.
Place the more specific `/win-likelihood/capture-gaps` route so it is not shadowed by `/:id/...`.

### 4. Tests
Unit tests for both services (mirror the tendering module's existing `*.spec.ts` style, using the same
Prisma-mock approach `tendering.service.spec.ts` / `tender-outcome-capture.service.ts` tests use):
- feature extraction: value-band bucketing incl. UNKNOWN, lead-time null-handling, client win-rate
  counts with a superseded outcome in the chain (assert only the CURRENT outcome counts).
- baseline: Wilson interval known-value assertions; thin cohort -> LOW confidence + wide interval;
  cohort widening when a dimension is missing; why-factors ordering; capture-gaps populated when a
  feature is absent.

## Do NOT
- Do NOT change `schema.prisma` or add a migration — this slice is read-only. If you find a feature you
  wish existed, record it in the capture-gap report; WL3-S1b adds capture, targeted, later.
- Do NOT touch any pricing / estimate path, `RateResolverService`, or tender rate sets. Win-likelihood
  is advisory and MUST NOT feed pricing.
- Do NOT build UI — that is WL3-S2.
- Do NOT add a stats/ML library dependency — Wilson is a few lines of arithmetic.
- Do NOT invent a new permission — reuse the existing tender-read permission.
- Do NOT touch Azure/Entra/SharePoint or /sot/.

## STANDING AUTHORITY
> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if the win-likelihood module already exists on main, say
  `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- `pnpm build` and `pnpm lint` must pass.
