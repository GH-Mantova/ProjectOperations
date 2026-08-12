---
premise: '! grep -q "model AgreedRecordPricingLine" apps/api/prisma/schema.prisma'
premise_means: The office pricing/approval lane for Agreed Records does not exist yet — WHS&CC / Ops cannot review, correct, price from the locked SoR, approve, or send back an AR. S7 (AgreedRecord + field capture) is on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/agreed-records/agreed-record-review.service.ts
  - apps/api/src/modules/agreed-records/agreed-record-review.controller.ts
  - apps/api/src/modules/agreed-records/agreed-records.module.ts
  - apps/api/src/modules/agreed-records/__tests__/agreed-record-review.service.spec.ts
  - apps/web/src/pages/AgreedRecordOfficeReviewPage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && grep -q "model AgreedRecordPricingLine" apps/api/prisma/schema.prisma && test -f apps/api/src/modules/agreed-records/agreed-record-review.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — one new table (AgreedRecordPricingLine) attached to the existing AgreedRecord, plus two seeded rows in the existing `notification_trigger_configs` table (id-known seed, idempotent upsert; safe to leave). Nothing existing altered. Down migration drops the new table; the seed rows are harmless if left. Forward-only otherwise.
backfill: false
requires_file_on_main: apps/api/src/modules/agreed-records/agreed-records.service.ts
---

# SoR S8 — AR office review lane: price · approve · reject-and-send-back + notifications

Slice S8 (`docs/plans/sor-program-plan.md` on main; design in memory `project_sor_program`). Office
picks up SUBMITTED ARs from S7, opens/edits/**prices from the locked Job SoR snapshot** (S4), and
either approves (Ops signs off) or rejects and sends back to the worker. Uses the EXISTING
`NotificationTriggerConfig` seam to alert WHS&CC then Ops Manager. The chain is built
**configurably-ready** — roles live in data, not code — but the admin editor UI is **DEFERRED** (a
later PR the plan explicitly calls out).

## Grounded (read first — on main today)
- `apps/api/prisma/schema.prisma` — `NotificationTriggerConfig` (line 3787) has `trigger` (unique),
  `label`, `description`, `isEnabled`, `deliveryMethod`, `recipientRoles String[]`,
  `recipientUserIds String[]`. Seed two new trigger rows via idempotent upsert — do NOT alter the
  model.
- S7's `AgreedRecord` / `AgreedRecordLine` / `AgreedRecordStatus` enum (with SUBMITTED / OFFICE_REVIEW
  / PRICED / APPROVED / SENT_BACK / VOID). This slice writes the state machine over that enum.
- S4's snapshot rate-fetch helper (`GET job-sor-snapshot/rate/...`) — pricing here reads the FROZEN
  snapshot rate, never live `SorRate`.
- Any existing role-notification dispatcher on main (e.g. the mailer / in-app dispatch used by other
  `NotificationTriggerConfig` triggers) — reuse it; do NOT invent a new dispatch layer.

## What to build

1. **`apps/api/prisma/schema.prisma`** — add ONE new model (`AgreedRecord` itself is left alone):
   ```prisma
   model AgreedRecordPricingLine {
     id                    String            @id @default(cuid())
     agreedRecordLineId    String            @unique @map("agreed_record_line_id")
     agreedRecordLine      AgreedRecordLine  @relation(fields: [agreedRecordLineId], references: [id], onDelete: Cascade)
     snapshotRateId        String?           @map("snapshot_rate_id")  // null = manual/override
     tier                  String            @default("ORDINARY")
     rate                  Decimal           @db.Decimal(12, 2)         // FROZEN at price time
     lineAmount            Decimal           @map("line_amount") @db.Decimal(12, 2)
     pricedById            String?           @map("priced_by_id")
     pricedAt              DateTime          @default(now()) @map("priced_at")
     @@index([agreedRecordLineId])
     @@map("agreed_record_pricing_lines")
   }
   ```
   Add the back-ref `pricing AgreedRecordPricingLine?` on `AgreedRecordLine`. Also add
   `totalPricedAmount Decimal? @map("total_priced_amount") @db.Decimal(12, 2)` to `AgreedRecord`
   (nullable — populated on PRICED transition). This is the ONLY change to existing tables and it is
   additive (nullable column, no default backfill).
2. **Migration** — additive. Bare `GATE-ALLOW: migrations` at column 0 of the PR body. In the same
   migration or a paired seed step, **upsert** two rows into `notification_trigger_configs` (id-known,
   idempotent — this is the "configurably-ready, no editor UI yet" pattern):
   - `agreed_record.submitted` — label "AR submitted", recipientRoles `["WHS_CC"]`, isEnabled `true`.
   - `agreed_record.priced_awaiting_ops` — label "AR priced — awaiting Ops sign-off",
     recipientRoles `["OPS_MANAGER"]`, isEnabled `true`.
   Use whichever role tokens the existing role directory uses on main; if the two above are not the
   canonical tokens, substitute the exact tokens and note the mapping in the PR body.
3. Regenerate `docs/data-model/**` via `node scripts/data-model/build-relationship-map.mjs`.
4. **`apps/api/src/modules/agreed-records/agreed-record-review.service.ts`** + `.controller.ts`,
   wired into the existing S7 `agreed-records.module.ts`, guarded by an office-review permission
   (reuse `rates.manage` or the closest existing manage permission — do NOT invent a new one):
   - `POST agreed-records/:id/take-review` — SUBMITTED → OFFICE_REVIEW; fires `agreed_record.submitted`
     trigger (WHS&CC). Records `reviewerId`.
   - `PATCH agreed-records/:id/lines/:lineId` — office correction to a captured line (resource / class
     / unit / quantity / tier). Legal while OFFICE_REVIEW. Whoever edits ≠ necessarily approves.
   - `POST agreed-records/:id/lines/:lineId/price` — body `{ snapshotRateId?, tier }`. Reads the FROZEN
     rate from the AR's `jobSorSnapshotId` via S4's helper, creates the `AgreedRecordPricingLine`
     with `rate = snapshot rate at chosen tier`, `lineAmount = rate * line.quantity`. Manual override
     (no `snapshotRateId`) requires an explicit `rate` in the body and stamps `snapshotRateId = null`.
   - `POST agreed-records/:id/finalise-pricing` — recomputes `AgreedRecord.totalPricedAmount = SUM`,
     transitions OFFICE_REVIEW → PRICED, fires `agreed_record.priced_awaiting_ops` trigger (Ops).
   - `POST agreed-records/:id/approve` — Ops sign-off. PRICED → APPROVED. Records `approvedById`.
     **Guard: `approvedById` must differ from every `pricedById` on the AR's pricing lines** — enforces
     the "whoever edits ≠ approver" separation.
   - `POST agreed-records/:id/send-back` — body `{ reason }`. Any office state → SENT_BACK; returns
     to worker view (S7). Sets `sentBackReason` — add that field to `AgreedRecord` (nullable String,
     additive) in this migration too.
   - `GET agreed-records/review-queue` — SUBMITTED + OFFICE_REVIEW + PRICED for the reviewer's team.
5. **`apps/web/src/pages/AgreedRecordOfficeReviewPage.tsx`** — office queue + detail: filter by
   status, open an AR, correct lines, price each line from the snapshot (dropdown of snapshot rows,
   tier picker, computed line amount), finalise pricing, approve or send-back with a reason. Route
   in `App.tsx` under `/agreed-records/review` behind the office permission. Follow the existing
   admin queue design tokens.
6. **Spec** `apps/api/src/modules/agreed-records/__tests__/agreed-record-review.service.spec.ts`:
   (a) take-review fires the WHS&CC trigger, (b) pricing reads the FROZEN snapshot rate not live
   `SorRate`, (c) finalise-pricing fires the Ops trigger, (d) approve rejects when
   `approvedById == pricedById`, (e) send-back stamps reason and transitions to SENT_BACK.

## Do NOT
- Do NOT build the configurable approval-chain / roles editor UI — DEFERRED (plan "LATER" section).
- Do NOT hard-code the WHS&CC → Ops → Director chain in code — it is data on `NotificationTriggerConfig`.
- Do NOT re-price from live `SorRate` — always read the frozen rate from the AR's snapshot.
- Do NOT invent a new notification / dispatch layer — reuse the existing seam.
- Do NOT wire Director notification here — that fires at the progress-claim boundary in S9.
- Do NOT touch tender pricing, or the S3 client-card write paths.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the pricing model already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- Regenerate the data-model map up front.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
