---
premise: '! grep -q "enum TenderOutcomeReason" apps/api/prisma/schema.prisma'
premise_means: TenderOutcome still has no structured result/reason enums or ML-feature columns (only free-text outcomeType/notes), and there is no append-only outcome-recording path — so closing a tender captures nothing analysable.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/tendering/tender-outcome-capture.service.ts
  - apps/api/src/modules/tendering/tendering.module.ts
  - apps/api/src/modules/tendering/tendering.controller.ts
  - apps/api/src/modules/tendering/tendering.service.ts
  - apps/api/src/modules/tendering/tendering.service.spec.ts
  - apps/api/src/modules/tendering/__tests__/tendering.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "enum TenderOutcomeReason" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/tendering/tender-outcome-capture.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — new nullable columns, two new enums, new nullable FKs/indexes on TenderOutcome; no existing column is altered or dropped. Safe to leave on main; a down migration drops the added columns and the TenderOutcomeResult/TenderOutcomeReason enums. Forward-only otherwise.
backfill: false
---

# WL-1a — Tender outcome capture (API + schema): structured, OPTIONAL-at-close, append-only

This is slice WL-1a of the tender win/loss program (`docs/plans/tender-winloss-datacapture-plan.md`).
Marco's decision (2026-08-10): capture is **prompted but SKIPPABLE**, NOT mandatory — this slice must
NOT block closing a tender. It builds the data layer + an append-only recording path; the web modal
(WL-1b) and the report (WL-2) are separate slices.

`apps/api/prisma/schema.prisma` (`model TenderOutcome`, ~line 1318) currently has only
`id, tenderId, outcomeType (String, free text), notes (String?), recordedAt`. Nothing captures result,
reason, value, client, our price, or competitor/winner, and there is **no bounded reason enum**.
Separately, `TenderingService.updateStatus()` (backing `PATCH /tenders/:id/status`, the Kanban
drag-to-close surface) writes status straight through and creates no outcome. The full-upsert path
`TenderingService.update()` `deleteMany`+`createMany`s the `dto.outcomes` block on every save — the
opposite of append-only. `Client.winCount` (from #486, via `ClientStatsService.recordTenderOutcome`)
tracks tallies only, none of the ML-relevant detail.

## What to build

1. **`apps/api/prisma/schema.prisma`** — extend `model TenderOutcome` additively (every new column
   nullable — existing rows must stay valid) and add two enums:
   ```prisma
   enum TenderOutcomeResult {
     WON
     LOST
     NO_BID
   }

   enum TenderOutcomeReason {
     PRICE_TOO_HIGH
     LOST_ON_RELATIONSHIP
     SCOPE_MISMATCH
     TIMING_PROGRAM_CLASH
     CAPACITY_CONSTRAINT
     CLIENT_WENT_ANOTHER_DIRECTION
     PROJECT_CANCELLED
     NO_RESPONSE_FROM_CLIENT
     DECLINED_TO_BID
     OTHER
   }
   ```
   Add to `TenderOutcome`: `resultType TenderOutcomeResult?`, `reason TenderOutcomeReason?`,
   `tenderValue Decimal? @db.Decimal(14, 2)`, `ourPrice Decimal? @db.Decimal(14, 2)`,
   `clientId String?` + relation to `Client` (`onDelete: SetNull`), `scopeSummary String?`,
   `competitorOrWinner String?`, `recordedById String?` + relation to `User`
   (`onDelete: SetNull`, named relation e.g. `"TenderOutcomeRecordedBy"`), and an append-only
   supersede chain: `supersedesId String? @unique` + a self-relation (`"TenderOutcomeSupersedes"`,
   `onDelete: SetNull`) so a corrected outcome links to the row it replaces. Add
   `@@index([clientId])` alongside the existing `@@index([tenderId])`. **Keep the existing
   `outcomeType`/`notes` columns untouched.** Add the back-relation fields on `Client` and `User`
   (e.g. `tenderOutcomes TenderOutcome[]`) next to their other relation lists.

2. **Migration** under `apps/api/prisma/migrations/` — additive only (new nullable columns, new
   enums, new FKs/indexes). Follow the idempotent additive style of
   `apps/api/prisma/migrations/20260717120000_billing_milestones/migration.sql`. Put a bare
   `GATE-ALLOW: migrations` line at column 0 of the PR body.

3. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `.md`, and `metadata-catalog.json`.

4. **`apps/api/src/modules/tendering/tender-outcome-capture.service.ts` (new)** — a small
   `@Injectable()` owning append-only recording (inject `PrismaService`):
   - `recordOutcome(tx, tenderId, outcome, recordedById): Promise<TenderOutcome>` — finds the
     tender's most recent existing `TenderOutcome` (by `recordedAt desc`) if any, creates a **brand-new**
     row with `supersedesId` pointing at it, and **never updates or deletes** the prior row. Accepts a
     Prisma transaction client so callers can compose it.
   - `normalizeOutcome(outcome)` (or inline validation) — accept only the bounded enum values; ignore
     unknown keys.
   There is **NO** `assertOutcomeCaptured` / mandatory-capture method — capture is optional by design.

5. **`apps/api/src/modules/tendering/tendering.controller.ts`** — TWO changes:
   - Extend the local `UpdateTenderStatusDto` with an OPTIONAL nested `outcome` payload (`resultType`,
     `reason`, `tenderValue`, `ourPrice`, `clientId`, `scopeSummary`, `competitorOrWinner` — all
     `@IsOptional()`, `@IsIn(Object.values(TenderOutcomeResult))` / `...Reason)` where applicable) and
     pass it to `service.updateStatus(id, dto.status, actor.sub, dto.outcome)`.
   - Add a standalone endpoint `POST /tenders/:id/outcome` (guarded by the same `tenders.manage`
     permission the other write endpoints use) taking the same outcome payload and calling a new
     `service.recordTenderOutcome(id, outcome, actor.sub)` — this is the **backfill / post-close**
     path so an outcome can be recorded after a tender is already closed, WITHOUT another status change.

6. **`apps/api/src/modules/tendering/tendering.service.ts`** — inject `TenderOutcomeCaptureService`.
   - In `updateStatus()`: after the status write succeeds, **if and only if** `outcome` was supplied,
     call `captureService.recordOutcome(tx, id, outcome, recordedById)`. If `outcome` is absent, do
     nothing and return normally — **never throw for a missing outcome** (skippable).
   - Add `recordTenderOutcome(id, outcome, recordedById)` wrapping `recordOutcome` in a transaction for
     the new endpoint.
   - Fix the `update()` method's `dto.outcomes` block: change `tx.tenderOutcome.deleteMany` +
     `createMany` to **append-only** (`createMany` only; drop the `deleteMany`) so saving a tender's
     nested outcomes never destroys prior recorded outcomes.

7. **`apps/api/src/modules/tendering/tendering.module.ts`** — register
   `TenderOutcomeCaptureService` in `providers`.

8. Update `apps/api/src/modules/tendering/tendering.service.spec.ts` and
   `apps/api/src/modules/tendering/__tests__/tendering.service.spec.ts`: inject the new service (mock),
   update any `toHaveBeenCalledWith(...)` assertions touching `tenderOutcome.deleteMany`/`createMany`
   for the append-only change, and ADD tests proving:
   - closing a tender to `LOST` with **no** outcome payload returns normally and creates **no** outcome
     row and does **not** throw (skippable — this is the headline behaviour);
   - closing with a valid outcome appends exactly one row with the sent fields;
   - `recordTenderOutcome` on an already-closed tender appends a row whose `supersedesId` points at the
     prior outcome (append-only, prior row untouched).
   Write the tests so they FAIL before the change and PASS after.

## Do NOT

- Do **not** make capture mandatory or throw when an outcome is missing — Marco chose skippable.
- Do **not** add `NO_BID` to `Tender.status` or `TENDER_STATUS_ORDER` — `NO_BID` is an outcome
  `resultType`, not a lifecycle status (a no-bid tender is closed via the existing `WITHDRAWN` status
  with `resultType: NO_BID` on the outcome).
- Do **not** touch `bulkUpdateStatus` or `quickEdit`'s status branch — this slice scopes optional
  capture to the single-tender `PATCH /tenders/:id/status` path; flag bulk/quick-edit as a known
  follow-up in the PR description.
- Do **not** alter or drop the existing `outcomeType`/`notes` columns.
- Do **not** touch `ClientStatsService.recordTenderOutcome` or its counters.
- Do **not** touch Azure/Entra/SharePoint, `sot/`, or any module outside `tendering` / the schema /
  migrations / data-model docs listed in scope.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way. This PR escalates (schema +
> migration): open it, then note in the PR body that it must be labelled **do-not-merge** for Marco
> to review the rendered migration diff.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log (`gh run view <run> --job <job> --log`) before diagnosing.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
