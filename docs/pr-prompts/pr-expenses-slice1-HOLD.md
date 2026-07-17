---
premise: '! grep -q "model Expense" apps/api/prisma/schema.prisma'
premise_means: There is no expense-management capability (no Expense model) yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/expenses/**
  - apps/api/src/common/permissions/**
  - apps/api/prisma/seed-reference.ts
  - apps/web/src/pages/expenses/**
  - apps/web/src/App.tsx
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Expense" apps/api/prisma/schema.prisma
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | independent | D365-parity Tier 1 (expenses) | first parity build -->
# HOLD — Expense management, slice 1 (capture + approval)

STATUS: DRAFTED, STAGED, arm-eligible. Tier 1 of the D365-parity program
(`docs/architecture/drafts/d365-parity-program-DRAFT.md`). Closes the "no expense capture" gap vs
D365 Finance/Project Operations. This slice = model + API + web capture + approval. Field/PWA
capture (slice 2), receipt OCR (slice 3), and Xero push (Xero-deepening) are SEPARATE later slices —
do not build them here.

## What to build

Branch: `feat/expenses-slice1`. Reviewer: `GH-Mantova`. Migration: YES — additive. Bare
`GATE-ALLOW: migrations` at column 0.

1. Schema — `Expense` model: `id`, `number` (`EXP-YYYY-NNN`, reuse the existing number-sequence
   pattern used by claims/contracts), `submittedById` (→ User; a worker/staff member), `projectId?`
   and/or `jobId?` (optional cost allocation), `category` (string, bound to a `GlobalList`),
   `description`, `spentOn` (Date), `amount Decimal(10,2)`, `gst Decimal(10,2)?`, `paymentMethod?`
   (card/cash/personal-reimbursable), `receiptDocumentId?` (→ Documents module record), `status`
   (`ExpenseStatus` enum: DRAFT / SUBMITTED / APPROVED / REJECTED / REIMBURSED), `approvedById?`,
   `approvedAt?`, `rejectionReason?`, `notes?`, timestamps. Add the enum + migration.
2. API — new `expenses` module: CRUD + `submit` / `approve` / `reject` transitions. **Route approval
   through the existing `AuthorityService` / `AuthorityRule` config seam — do NOT hardcode approval
   limits** (authority is Director-configurable data). Guard with new permission codes
   `expenses.view` / `expenses.manage` / `expenses.approve` (register in `permission-registry.ts`,
   seed to Admin + relevant roles). Swagger + class-validator DTOs; Prisma via the service layer.
3. Web — an **Expenses** page under `apps/web/src/pages/expenses/` (route in `App.tsx`, nav entry):
   list + create/edit + submit; an approvals surface for approvers (reuse the existing approvals UI
   pattern from internal comms/approvals). Receipt attach via the existing Documents/SharePoint
   picker (link a `receiptDocumentId`) — do NOT build a new uploader.
4. Seed an `expense-categories` `GlobalList` (Fuel, Materials, Tools/Equipment, Travel, Meals, PPE,
   Subcontractor, Other), idempotent upsert.

## Schema change → REGENERATE the data-model map (MANDATORY)

After editing `apps/api/prisma/schema.prisma`, run `node scripts/data-model/build-relationship-map.mjs`
and COMMIT the regenerated `docs/data-model/relationship-map.json`, `relationship-map.md`, and
`metadata-catalog.json`. The CI **data-model drift check** FAILS otherwise (it sank #593).

## Do NOT
- Do NOT build field/PWA capture (slice 2), receipt OCR (slice 3), or any Xero push (Xero-deepening).
- Do NOT hardcode approval thresholds — use the AuthorityService seam.
- Do NOT build a new file uploader — reuse the Documents/SharePoint attachment. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP: <reason>`. Never stand by for approval.
- If size would exceed 10 files, split (schema+API / web) and say so — do not blow the cap.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — open the PR and leave it for Marco.
