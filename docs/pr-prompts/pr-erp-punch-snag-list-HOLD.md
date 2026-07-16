---
premise: '! grep -q "model PunchItem" apps/api/prisma/schema.prisma'
premise_means: There is no punch / snag / defect list for job close-out.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/projects/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model PunchItem" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | ERP gap A/commercial | punch / snag list -->
# ERP gap — punch / snag / defect list

STATUS: DRAFTED, STAGED, arm-eligible. Handover / make-good close-out (`snag`=1, no model). Procore parity.
Rides naturally on the forms corrective-action loop but is its own job-scoped list.

## What to build
Branch: `feat/erp-punch-snag-list`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `PunchItem` (jobId/projectId, title, description, location, status open|in_progress|closed,
   assignedToId?, dueAt?, raisedById, closedAt?, photo pointer). Optional link to a `FormSubmission` /
   corrective action if raised from an inspection.
2. API in `projects` — CRUD, list-by-job, close-out with photo/note; guard via authority seam.
3. Web — a Punch/Snag tab on the job: add item (with photo + location), assign, track open/overdue, close.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT duplicate the forms corrective-action model if that PR has merged — reuse it. Do NOT touch
  Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** There is no human in this run.
> Finishing the work and then asking permission is indistinguishable from failing.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
