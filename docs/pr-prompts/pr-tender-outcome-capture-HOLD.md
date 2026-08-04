---
premise: '! grep -q "enum TenderOutcomeReason" apps/api/prisma/schema.prisma'
premise_means: TenderOutcome has no bounded, structured loss/decline-reason enum — outcomeType and notes are both free strings, and a tender can be moved to a closing status via PATCH /tenders/:id/status without recording any outcome at all.
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
rollback_strategy: Drop the added TenderOutcome columns and the TenderOutcomeResult/TenderOutcomeReason enums via a down migration; no existing column is altered or dropped, so this is purely additive and safely reversible.
---

# Tender outcome capture — structured, mandatory, append-only

`apps/api/prisma/schema.prisma` (`model TenderOutcome`, ~line 1318) currently has only
`id, tenderId, outcomeType (String, free text), notes (String?), recordedAt`. Nothing else captures
value, client, scope, our price, or a competitor/winner, and there is **no bounded reason enum at
all** — only the free-text `outcomeType`/`notes`. Separately, `TenderingService.updateStatus()`
(`apps/api/src/modules/tendering/tendering.service.ts`, backing `PATCH /tenders/:id/status`, the
endpoint the Kanban drag-drop flow uses to close a tender) writes `status` straight through with zero
outcome requirement — a tender can go to `AWARDED`, `CONTRACT_ISSUED`, `CONVERTED`, `LOST`, or
`WITHDRAWN` with no `TenderOutcome` row ever created. The full-upsert path
(`TenderingService.update()`, the `dto.outcomes` block) additionally `deleteMany` + `createMany`s
outcomes on every save — the opposite of append-only. `Client.winCount`/related counters (from #486,
via `ClientStatsService.recordTenderOutcome`) already track win/loss tallies but carry none of the
ML-relevant detail this slice adds.

## What to build

1. **`apps/api/prisma/schema.prisma`** — extend `model TenderOutcome` additively (every new column
   nullable — existing rows must remain valid) and add two new enums:
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
   `competitorOrWinner String?`, `recordedById String?` + relation to `User` (`onDelete: SetNull`,
   named relation e.g. `"TenderOutcomeRecordedBy"`), and an append-only supersede chain:
   `supersedesId String? @unique` + self-relation (`"TenderOutcomeSupersedes"`, `onDelete: SetNull`)
   so a corrected outcome links to the row it replaces instead of overwriting it. Add matching
   `@@index([clientId])` alongside the existing `@@index([tenderId])`. Keep the existing
   `outcomeType`/`notes` columns untouched for backward compatibility.
   Add the corresponding back-relation fields on `Client` and `User` (e.g. `tenderOutcomes
   TenderOutcome[]`) next to their other relation lists.

2. **Migration** under `apps/api/prisma/migrations/` — additive only (new nullable columns, new
   enums, new FKs/indexes). Follow the idempotent, additive style used by
   `apps/api/prisma/migrations/20260717120000_billing_milestones/migration.sql`. Put a bare
   `GATE-ALLOW: migrations` line at column 0 of the PR body.

3. Run `node scripts/data-model/build-relationship-map.mjs` and commit the regenerated
   `docs/data-model/relationship-map.json`, `.md`, and `metadata-catalog.json`.

4. **`apps/api/src/modules/tendering/tender-outcome-capture.service.ts` (new)** — a small
   `@Injectable()` service owning:
   - `assertOutcomeCaptured(existingStatus: string, nextStatus: string, outcome: <payload> | undefined): void` —
     throws `BadRequestException` when `nextStatus` differs from `existingStatus` AND `nextStatus` is
     one of the terminal statuses (`AWARDED`, `CONTRACT_ISSUED`, `CONVERTED`, `LOST`, `WITHDRAWN`)
     AND `outcome` is missing a `resultType`, or is missing `reason` while `resultType !== "WON"`
     (reason is mandatory for `LOST`/`NO_BID`, optional for `WON`).
   - `recordOutcome(prisma, tenderId, outcome, recordedById): Promise<TenderOutcome>` — **append-only**:
     finds the tender's most recent existing `TenderOutcome` (by `recordedAt desc`) if any, creates a
     brand-new row with `supersedesId` pointing at it, and never updates or deletes the prior row.
   Inject `PrismaService`.

5. **`apps/api/src/modules/tendering/tendering.controller.ts`** — extend the local
   `UpdateTenderStatusDto` class with an optional nested outcome payload (`resultType`, `reason`,
   `tenderValue`, `ourPrice`, `clientId`, `scopeSummary`, `competitorOrWinner` — all `@IsOptional()`,
   validated with `@IsIn(Object.values(TenderOutcomeResult))` / `@IsIn(Object.values(TenderOutcomeReason))`
   where applicable) and pass it through to `service.updateStatus(id, dto.status, actor.sub, dto.outcome)`.

6. **`apps/api/src/modules/tendering/tendering.service.ts`** — inject
   `TenderOutcomeCaptureService`. In `updateStatus()`, before writing the status change, call
   `assertOutcomeCaptured(existing.status, status, outcome)`; after the status write succeeds, if
   `outcome` was supplied, call `recordOutcome(...)`. Also fix the `update()` method's existing
   `dto.outcomes` block (currently `tx.tenderOutcome.deleteMany` + `createMany`) to be append-only:
   `createMany` only (drop the `deleteMany`), so saving a tender's nested `outcomes` array never
   destroys prior recorded outcomes.

7. **`apps/api/src/modules/tendering/tender-outcome-capture.service.ts`'s companion module wiring**:
   register `TenderOutcomeCaptureService` in `apps/api/src/modules/tendering/tendering.module.ts`
   (`providers`).

8. Update `apps/api/src/modules/tendering/tendering.service.spec.ts` and
   `apps/api/src/modules/tendering/__tests__/tendering.service.spec.ts`: fix `TenderingService`
   construction to inject the new service (mock), update any `toHaveBeenCalledWith(...)` assertions
   touching `tenderOutcome.deleteMany`/`createMany` for the append-only change, and add a test proving
   `updateStatus` throws when closing a tender to `LOST` with no outcome, and succeeds when a valid
   outcome is supplied.

## Do NOT

- Do not touch `bulkUpdateStatus` or `quickEdit`'s status branch — this slice scopes mandatory
  capture to the single-tender `PATCH /tenders/:id/status` path (the Kanban close surface). Leave
  the bulk and quick-edit paths as-is; flag them as a known follow-up in the PR description.
- Do not add a `NO_BID` value to the `Tender.status` string or `TENDER_STATUS_ORDER` — `NO_BID` is an
  outcome `resultType`, not a tender lifecycle status; a tender that never bids is closed via the
  existing `WITHDRAWN` status with `resultType: NO_BID` recorded on the outcome.
- Do not alter or drop the existing `outcomeType`/`notes` columns on `TenderOutcome`.
- Do not touch `ClientStatsService.recordTenderOutcome` or its win/tender counters.
- Do not touch Azure/Entra/SharePoint or any module outside `tendering` / the schema / migrations /
  data-model docs listed above.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If something is genuinely impossible given the stated scope, do not exit silently —
  say `NO-OP: <reason>` and explain what blocked it.
- Never stand by for approval; there is no human to approve mid-run.
- If CI fails, read the actual job log before diagnosing — do not guess.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
