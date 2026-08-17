---
premise: '! test -f apps/api/src/modules/tendering/withdrawal-review.service.ts'
premise_means: There is no tender withdrawn-review workflow (reviewer reopen/confirm) and no reviewer permission; WITHDRAWN exists only as an outcome status.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/tendering/**
  - apps/api/src/common/auth/**
  - apps/web/src/pages/tendering/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/tendering/withdrawal-review.service.ts
size: 9
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: 'Additive - new `tenders.review` permission + optional review-decision record + WITHDRAWN-pending state/transitions; nullable, insert-only. Safe to leave on main; re-run drops nothing; no existing tender row destructively mutated.'
---

# Tender withdrawn-review + exit-to-register (tender-lifecycle slice)

Ground against `docs/architecture/drafts/tender-pipeline-register-plan.md` (one tender status; Pipeline / CRM /
Register are views). Companion to the CRM+Tendering nav re-model, but this is the **lifecycle** half.

## What to build
- **Withdraw** action available from **DRAFT and ESTIMATING** → sets tender status **WITHDRAWN (pending
  review)**.
- **`tenders.review` permission** (a reviewer/estimating-manager gate) — **reuse the existing approval-lane
  pattern** (Leave Approvals / the SoR "AR office-review lane"); do NOT hardcode a person.
- **Reviewer actions** on a pending-Withdrawn tender: **Reopen → ESTIMATING** (rejoins the Pipeline) OR
  **Confirm → exits the Pipeline** and lands on the CRM **Tenders register**.
- **Exit-to-Register semantics:** both **SUBMITTED** and **confirmed-WITHDRAWN** leave the Pipeline board and
  appear on the Register (read-only). Pipeline holds only in-flight tenders (Draft, Estimating,
  Withdrawn-pending-review).
- Regenerate the data-model map (`node scripts/data-model/build-relationship-map.mjs`) and commit it.
- Declare `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body.

## Do NOT
- Do NOT wire to the legacy Lead/Opportunity entities (being retired). Do NOT change per-client outcome model.
- Do NOT touch /sot/ or Azure/Entra/SharePoint.

## Guardrails
- `pnpm build` + `pnpm lint` pass. **`escalates: true`** (workflow + permission + migration): open the PR and
  **LEAVE IT UNMERGED for Marco** — this one gets a human merge gate.
