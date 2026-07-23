# House pattern: idempotent critical writes (draft, 2026-07-23)

Status: DRAFT reference for the `integration-idempotency-audit` backlog item and its fix prompts.
Derived from an external blueprint, CORRECTED -- the original had three defects noted below.
Stack assumptions: NestJS + Prisma + Postgres (this repo).

## When this applies

Any mutation where a client/agent retry must NOT double-apply: invoice/claim creation, inventory
or asset-quantity deduction, outbound Xero writes, Graph mail sends, Jotform submission ingestion.

## Case A -- effect is DB-only (single transaction)

One Prisma transaction, one `IdempotencyRecord` table with a UNIQUE key. Do NOT check-then-create
(TOCTOU race); create FIRST and let the unique constraint arbitrate:

1. `tx.idempotencyRecord.create({ key })` -- on Prisma P2002 (duplicate), read the existing row:
   COMPLETED -> return its stored `responsePayload`; anything else -> 409, client retries later.
2. Run the business logic in the SAME transaction.
3. Update the record to COMPLETED with the response payload, still in the same transaction.
4. On ANY failure the transaction rolls back atomically -- the key row vanishes WITH the work,
   so a retry is safe. Do NOT hand-delete the key in a catch block.

Original blueprint defect 1: it checked-then-created (race). Defect 2: it deleted the key on
failure inside the same transaction -- a no-op at best (rollback removes it anyway) and a
lost-audit-trail at worst.

## Case B -- effect crosses an EXTERNAL system (Xero, Graph, Jotform)

The external call CANNOT live inside a DB transaction, and this is exactly where idempotency
matters most. Two phases with a committed intent row:

1. PHASE 1 (own short tx, COMMITTED before the call): create `IdempotencyRecord`
   status=PROCESSING with the request fingerprint. Unique-key conflict handled as in Case A.
2. Make the external call OUTSIDE any tx. Pass the provider's own idempotency mechanism where one
   exists (e.g. Xero repeating-invoice / reference fields; Graph internetMessageId) and store the
   provider's returned id on the record.
3. PHASE 2 (own tx): mark COMPLETED + store provider id/response.
4. Failure between 1 and 3 leaves a PROCESSING row -- that is the FEATURE: a retry sees it and
   does not re-fire the call blindly. A reaper (cron or on-demand) resolves stale PROCESSING rows
   by QUERYING the provider ("did invoice with reference X land?") before either completing or
   failing them. Never resolve by assumption ([[LL-39]] -- prove the instrument).

Original blueprint defect 3: it offered no phase separation at all, so the external-call window
had zero protection -- the one case an ERP actually needs.

## Degrade, never crash

Outbound integration failures write an audit row (delivery-log pattern, Forms v2 sec 3.7/4.4:
the submission SURVIVES) and degrade the UI feature; they never fail the user's primary action.
Circuit-breaking = stop calling a provider after N consecutive failures until a probe succeeds,
surfaced as a visible integration-health state, not a silent retry storm.

## Non-goals

This repo does NOT reimplement accounting -- Xero remains the ledger (locked decision). Internal
quantity/state movements should prefer append-only history rows over in-place counters where the
domain already has that shape (AssetStatusHistory pattern); elevating that to a binding sot/01
rule is an open Marco decision, deliberately NOT made by this draft.
