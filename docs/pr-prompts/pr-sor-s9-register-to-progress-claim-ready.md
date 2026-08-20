---
premise: '! test -f apps/api/src/modules/agreed-records/agreed-record-register.service.ts'
premise_means: The per-job VC+AR register service and its progress-claim feed do not exist yet — approved VCs (S6) and approved ARs (S8) cannot flow into a ProgressClaim, and the Director trigger for a claim-ready event is not seeded. S6 (VariationSorLine) and S8 (AgreedRecordPricingLine) are on main.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - apps/api/src/modules/agreed-records/agreed-record-register.service.ts
  - apps/api/src/modules/agreed-records/agreed-record-register.controller.ts
  - apps/api/src/modules/agreed-records/agreed-records.module.ts
  - apps/api/src/modules/agreed-records/__tests__/agreed-record-register.service.spec.ts
  - apps/web/src/pages/JobSorRegisterPage.tsx
  - apps/web/src/App.tsx
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/agreed-records/agreed-record-register.service.ts && grep -q "agreedRecordId" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Additive migration only — one nullable FK column (agreed_record_id) on the existing claim_line_items table + one seeded row in notification_trigger_configs (idempotent upsert). Nothing existing altered. Safe to leave on main; down migration drops the nullable column. Forward-only otherwise.
backfill: false
---

<!-- ARMED 2026-08-20 (06-pr-master). #1159 put this on HOLD because `requires_file_on_main` was
     unmet pending #1158. #1158 merged 2026-08-18, so BOTH gate files are now on origin/main and the
     gate can never fail again — `lint-prompt.mjs` rejected the prompt with FILE_GATE_DEAD while the
     key was still present. Per the linter's own guidance ("drop the key entirely if the dependency is
     genuinely satisfied") the key is removed rather than re-pointed: the dependency IS satisfied.
     Verified on origin/main 16402f22: variation-sor.service.ts present, agreed-record-review.service.ts
     present, and the premise target agreed-record-register.service.ts still absent. -->


# SoR S9 — per-job register + feed approved items into ProgressClaim + Director trigger

Final workflow slice (`docs/plans/sor-program-plan.md` on main; design in memory
`project_sor_program`). Read-mostly: the per-JOB register (VC + AR, showing SoR version + status) and
the one-way feed of **approved / signed** items into the EXISTING `ProgressClaim` via `ClaimLineItem`.
Director is notified via the existing `NotificationTriggerConfig` seam when a claim is ready. VC
already feeds `ClaimLineItem` via its `variationId` FK today; the AR side needs a symmetric nullable
FK added here.

## Grounded (read first — on main today)
- `apps/api/prisma/schema.prisma` — `ProgressClaim` (line 3957), `ClaimLineItem` (line 4016; already
  has `variationId` FK to `Variation`, feeds SUM into the claim). Add ONE nullable FK column here.
- S6's `VariationSorLine` — approved VCs still surface through the existing
  `Variation.approvedAmount` / `ClaimLineItem.variationId` path (unchanged).
- S8's `AgreedRecord` + `AgreedRecordPricingLine` + `totalPricedAmount` — approved ARs are the new
  source this slice teaches `ClaimLineItem` to link to.
- The existing progress-claim service on main — do NOT rewrite it; add a helper the register calls
  when raising a claim, so the register is the only new surface.

## What to build

1. **`apps/api/prisma/schema.prisma`** — TWO small additive edits (nothing existing altered):
   - Add nullable FK on `ClaimLineItem`:
     ```prisma
     agreedRecordId String?       @map("agreed_record_id")
     agreedRecord   AgreedRecord? @relation(fields: [agreedRecordId], references: [id], onDelete: SetNull)
     ```
     and the back-ref `claimLineItems ClaimLineItem[]` on `AgreedRecord`.
   - No new model, no new enum, no new table. This is a nullable column addition only.
2. **Migration** — additive (`ADD COLUMN agreed_record_id` + FK index). Bare
   `GATE-ALLOW: migrations` at column 0 of the PR body. In the paired seed step, **upsert** ONE row
   into `notification_trigger_configs`:
   - `progress_claim.ready_for_director` — label "Progress claim ready — Director review",
     recipientRoles `["DIRECTOR"]`, isEnabled `true`. Use the canonical role token on main if
     different; note the mapping in the PR body.
3. Regenerate `docs/data-model/**` via `node scripts/data-model/build-relationship-map.mjs`.
4. **`apps/api/src/modules/agreed-records/agreed-record-register.service.ts`** + `.controller.ts`,
   wired into the existing `agreed-records.module.ts`, guarded by the existing project-manager /
   claims-manage permission (reuse — do NOT invent a new one):
   - `GET register/for-job/:jobId` — combined per-job list of:
     - VCs on the job's contract (via `Contract` → `Variation`), showing `variationNumber`,
       description, status (`VariationStatus`), `sorVersion` (join through the earliest
       `VariationSorLine` — first line stamps the version), and `pricedAmount`.
     - ARs on the job (`AgreedRecord` where jobId matches), showing `recordNumber`, description,
       status, `sorVersion`, `totalPricedAmount`, worker + client-rep signature presence.
     Sorted by createdAt desc. This is the register view the plan calls out.
   - `POST register/for-job/:jobId/raise-claim` — body `{ claimMonth, variationIds[], agreedRecordIds[] }`.
     Filters inputs to APPROVED-only (VC where `Variation.approvedAmount != null`; AR where
     `AgreedRecord.status == APPROVED` and both signatures present). Calls the existing progress-claim
     service to create/append a `ProgressClaim` for the contract + month, then writes one
     `ClaimLineItem` per included item (`variationId` for VC lines, `agreedRecordId` for AR lines;
     `contractValue` = approvedAmount / totalPricedAmount; `thisClaimPct = 100`; `thisClaimAmount` =
     that value). Fires the `progress_claim.ready_for_director` trigger AFTER the claim is written.
   - `GET register/for-job/:jobId/eligible-for-claim` — the filtered APPROVED-only view the UI uses
     to build the raise-claim payload.
5. **`apps/web/src/pages/JobSorRegisterPage.tsx`** — per-job register table with VC + AR rows, status
   pills, SoR version stamp, and a "Raise claim" action that opens a picker of eligible (approved)
   items and posts to the register raise-claim endpoint. Route in `App.tsx` at
   `/jobs/:jobId/sor-register` behind the claims-manage guard. Follow the existing per-job page
   design tokens.
6. **Spec** `apps/api/src/modules/agreed-records/__tests__/agreed-record-register.service.spec.ts`:
   (a) register merges VC + AR rows for a job, (b) eligible-for-claim filters unapproved / unsigned
   items out, (c) raise-claim creates `ClaimLineItem` rows with `agreedRecordId` set for AR entries
   and `variationId` for VC entries, (d) the Director trigger fires after the claim write, not before.

## Do NOT
- Do NOT introduce a parallel claim model — feed the EXISTING `ProgressClaim` via `ClaimLineItem`.
- Do NOT include DRAFT / SUBMITTED / SENT_BACK ARs in the claim feed — APPROVED + both-signatures-present only.
- Do NOT re-run any pricing here — VC & AR are both already priced at their frozen snapshot rates.
- Do NOT wire notifications for state changes other than the claim-ready trigger (S8 owns AR-lane).
- Do NOT build the configurable approval-chain / roles editor UI (DEFERRED, plan "LATER" section).
- Do NOT touch tender pricing.
- Do NOT touch Azure/Entra/SharePoint or `/sot/`.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. If the register service already exists on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval.
- Read the CI job log before diagnosing a failure.
- Regenerate the data-model map up front.
- `pnpm build` and `pnpm lint` must both pass before you open the PR.
