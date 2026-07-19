---
premise: '! grep -rqi "corrective" apps/api/src/modules/forms'
premise_means: A failed or flagged form response does not raise a tracked corrective action with assignee, due date and close-out.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/forms/**
  - apps/web/src/pages/forms/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "corrective" apps/api/src/modules/forms
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | Forms engine gap 3/6 | corrective-action / CAPA close-out loop -->
# Forms engine — corrective-action (CAPA) close-out loop

STATUS: DRAFTED, STAGED, arm-eligible. Extends the EXISTING forms engine (PR #97 — `FormTriggeredRecord`
and `HazardObservation` already exist). Closes the loop Procore/SiteDocs win on: a Fail/flag doesn't just
sit in a PDF — it becomes a tracked action to verified closure.

## What to build
Branch: `feat/forms-corrective-actions`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `CorrectiveAction` (id, submissionId?, sourceFieldKey?, title, description, assignedToId?,
   assignedToRole?, dueAt?, priority, status open/in_progress/closed, closedAt?, closedById?, evidence
   pointer). If a suitable action/observation model already fits (`HazardObservation`), extend it instead
   of duplicating — verify first and keep it <=10 files.
2. API — a field `action` of type `create_corrective_action` (the engine already supports submit-time
   `actions`/`FormTriggeredRecord`); on a triggering answer (e.g. a Fail response, or a rule effect),
   create the action, link it via `FormTriggeredRecord`, notify the assignee. Endpoints to list/update/
   close actions; guard via the module's existing authority pattern.
3. Web — a "possible/required actions" panel on `FormSubmissionDetailPage`; an actions register list with
   status + overdue; close-out with a note/evidence.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs`; COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts` expectations.

## Do NOT
- Do NOT build a full incident-management module here (MVP: action raised -> assigned -> closed). Do NOT
  duplicate `HazardObservation` if it already fits. Do NOT touch Azure/prod. If >10 files, split.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
