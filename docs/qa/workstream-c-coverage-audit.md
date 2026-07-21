# QA Workstream C — coverage audit (compliance)

**Date:** 2026-07-20
**Decision source:** `docs/pr-prompts/BACKLOG-DECISIONS.md` §5 — full-depth QA-C,
but re-review the 2026-07-02 plan against today's suite **before writing tests**.
Fill only the genuine gaps.
**Prompt:** `docs/pr-prompts/pr-qa-workstream-c-audit-ready.md`.

## 1. What was the 2026-07-02 plan?

**No `docs/qa/workstream-c-*.md` plan document survives on disk.** `git log
--all -- 'docs/qa/**'` returns nothing (`docs/qa/` was created for this
audit); searches for "Workstream C", "QA-C", "compliance workstream" and
"compliance QA plan" across `sot/`, `docs/`, and deleted paths turn up only
downstream references (`docs/pr-prompts/BACKLOG.yaml:130`,
`BACKLOG-DECISIONS.md:47`, and the arming commit `caf0c4c6` from 2026-07-16).
The plan itself lived only in chat memory, exactly the pattern
`BACKLOG.yaml`'s preamble was written to end.

Scope has therefore been reconstructed from the compliance surfaces that
exist in code today, cross-checked against the architecture charter
(`sot/01-charter-and-architecture.md` §13). The reconstructed workstream C
intents are:

- **C-1** Expiry status maths — 30/7-day window classification per row
  (`entityLicence`, `entityInsurance`, `workerQualification`).
- **C-2** Daily alert dispatch — dedup per (item, tier) so a row does not
  re-alert every night at the same tier.
- **C-3** Auto-block subcontractors on critical licence/insurance expiry;
  asymmetric unblock (only clears blocks whose reason starts with "Critical").
- **C-4** Worker qualification CRUD and competency-gate primitive.
- **C-5** Prequalification workflow — draft → submitted → under\_review →
  approved / rejected → expired, with a point-in-time snapshot on approval
  and a nightly expiry cron.
- **C-6** Compliance dashboard rollup — counts of expiring items, blocked
  subs, expiring prequals, and subs never prequalified.
- **C-7** End-to-end acceptance smoke of the compliance UI surface.

## 2. What today's suite already covers

| Intent | Where the code lives | Where the tests live | Verdict |
| --- | --- | --- | --- |
| **C-1** window maths | `compliance.service.ts` `computeStatus` / `daysUntilExpiry` | `__tests__/compliance.service.spec.ts:78-107` — 8 boundary rows including 7/30-day tier edges | **Covered.** |
| **C-2** alert dedup | `compliance.service.ts` `checkAndSendExpiryAlerts` | `compliance.service.spec.ts` — dedup by `(itemId, tier)`, alert row + notification + email side effects | **Covered.** |
| **C-3** auto-block | `compliance.service.ts:465` `autoBlockExpiredSubcontractors` (critical types list at lines 65-66) | `compliance.service.spec.ts` — expired critical licence blocks, expired critical insurance blocks, non-critical does not, asymmetric unblock only removes reasons starting with "Critical" | **Covered.** |
| **C-4a** worker-qual CRUD | `compliance.service.ts` create/update/delete | `compliance.service.spec.ts` — create, update, delete flows | **Covered.** |
| **C-4b** competency-gate primitive | `competency-gate.ts` | `__tests__/competency-gate.spec.ts` (all 4 quadrants — allowed / missing / expired / expiring-soon) + `compliance-competency.service.spec.ts` (service wrapper: NotFoundException, column selection, wired-up gating) | **Covered.** |
| **C-5** prequal workflow | `prequal.service.ts` (state machine + expiry cron, +399 LOC) | **None — this is the gap.** | **Filled in this PR** — `__tests__/prequal.service.spec.ts` (below). |
| **C-6** dashboard rollup | `compliance.controller.ts` dashboard endpoint + `prequal.service.ts:dashboard()` | The compliance endpoint side is exercised via `compliance.service.spec.ts` fixtures; the prequal `dashboard()` had no coverage. | **Prequal side filled in this PR.** |
| **C-7** e2e compliance smoke | `tests/e2e/pr-acceptance/batch7-compliance-forms.spec.ts` | Dashboard summary cards render + sidebar/header badge parity | **Covered at smoke level.** |

## 3. Gap analysis — what was genuinely missing

`prequal.service.ts` shipped as PR #728 on 2026-07-19 with zero unit tests.
It is the newest and least-covered compliance surface, and it carries the
richest state machine in the module: six statuses, three transition guards,
a point-in-time snapshot on approval, a daily cron, and a paired write to
`SubcontractorSupplier.prequalStatus`. Grep confirms no other test file
references `PrequalService` or `PrequalificationRequest`:

```
$ grep -rl "PrequalService\|PrequalificationRequest" apps/api/src --include="*.spec.ts"
apps/api/src/modules/compliance/__tests__/compliance.service.spec.ts   (only via subcontractor fixtures)
apps/api/src/modules/directory/**                                       (directory list, not workflow)
```

Everything else the 2026-07-02 plan would have called out is already
guarded. The auto-block state machine is unit-tested. The 30/7-day tier
maths is table-tested at the exact boundary days. The competency gate has a
dedicated spec covering all four quadrants. The e2e dashboard smoke exists.

## 4. What this PR adds

**`apps/api/src/modules/compliance/__tests__/prequal.service.spec.ts`** — one
new spec file, 300+ lines, that covers:

- **`create`** — happy path opens a draft; 404 when the sub is missing;
  rejects a second open request while any of `draft`/`submitted`/`under_review`
  is in flight; **permits** a fresh cycle after a terminal state.
- **`submit`** — stamps `submittedAt=now`, moves draft → submitted; 400 when
  the current state is not draft; 404 on unknown id.
- **`updateDraft`** — patches notes on a draft; 400 once the request has
  left draft.
- **`verify`** — riskRating validation (rejects "extreme"); captures the
  insurances/licences/documents snapshot with `capturedAt` ISO stamp;
  defaults `expiresAt` to now + 365 days when absent; honours a supplied
  `expiresAt`; 400s on an unparseable `expiresAt`; syncs
  `SubcontractorSupplier.prequalStatus = "approved"` with
  `prequalReviewedBy` / `prequalReviewedAt`; refuses to re-verify an
  approved or rejected request.
- **`reject`** — requires a non-empty reason (whitespace-only is a 400);
  trims the reason; flips summary column to `"rejected"`; refuses to reject
  an already-approved request.
- **`expireStalePrequals`** (the 20:30 UTC cron) — no-op when nothing is
  stale (does not touch the sub table); flips approved+past-expiry rows to
  `"expired"`; asymmetric side-effect on the sub summary — `updateMany`'s
  where-clause is asserted exactly (`prequalStatus: "approved"`) so a
  manually-rejected sub does **not** get flipped back to pending.
- **`dashboard`** — assembles counts, risk mix, expiringSoon, and the
  subs-without-prequal list from the four underlying queries.
- **`validateStatus`** — accepts the six documented statuses, 400s on
  anything else.

No other files change. No schema, no migrations, no controllers, no e2e.

## 5. What is intentionally NOT in this PR

- **No controller-level tests for `prequal.controller.ts`.** The controller
  is a thin adapter over the service — the guards and side-effects are in
  the service, and the service is what's tested. Adding a controller spec
  would duplicate the state-machine assertions without exercising anything
  new.
- **No e2e for the prequal workflow.** The `batch7-compliance-forms.spec.ts`
  smoke exercises the compliance dashboard chrome; a full
  draft→submit→approve→expire e2e would want seeded fixtures across three
  seeded users and a fake clock. That is a larger slice than "audit-first
  fill the gaps" was scoped for. Registered as a follow-up below.
- **No test for the compliance dashboard's `blocked` badge count end-to-end.**
  The current e2e smoke already asserts sidebar/header badge parity for the
  dashboard summary card; the auto-block state machine that feeds the badge
  is unit-tested. A dedicated e2e that seeds an expired critical licence,
  runs the cron, and asserts the badge count would be strictly additive
  coverage of already-tested behaviour — deferred.

## 6. Follow-up worth registering (later slice)

- Full compliance e2e: seed an approved prequal with `expiresAt` yesterday,
  run `PrequalService.expireStalePrequals`, assert the sub falls out of the
  approved filter and lands on the "review overdue" list. (Requires a fake-clock
  seam in the API — separate refactor.)
- End-to-end alert dispatch: seed a licence expiring in 6 days, run
  `runDailyComplianceTasks`, assert exactly one `ComplianceAlert` row and
  one `Notification` land. Currently unit-tested only.
- Wire `competency-gate.ts` into the allocation flow. The gate helper exists
  but is not called from allocation code yet (`competency-gate.ts:9`
  disclaims this). Once wired, an integration test that asserts allocation
  blocks a worker missing a required qual should be added alongside.

None of the follow-ups block the audit deliverable; recording them here so
they cannot fall on the floor (`BACKLOG.yaml` preamble rule).
