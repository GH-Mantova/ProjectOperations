---
premise: '! grep -q "model Survey" apps/api/prisma/schema.prisma'
premise_means: There is no post-job client satisfaction survey capability.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/directory/**
  - apps/web/src/pages/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -q "model Survey" apps/api/prisma/schema.prisma
size: 9
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | D365 Customer Voice parity | post-job client satisfaction surveys -->
# HOLD — Customer Voice: client satisfaction surveys

STATUS: DRAFTED, STAGED, arm-eligible. D365 Customer Voice parity (light): capture post-job client
satisfaction and feed the existing client score (`Client.preferenceScore`/win-rate live already).

## What to build
Branch: `feat/customer-voice-surveys`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema — `Survey` (template: name, questions JSON incl. rating + free-text) + `SurveyResponse`
   (`surveyId`, `clientId`, `projectId?`/`jobId?`, answers JSON, overall score, submittedAt). Seed one
   default post-job survey.
2. API in `directory` (or a `surveys` sub-module): create/send a survey for a completed job, capture a
   response (internal entry now; a client-portal/emailed link can come later), aggregate scores, and
   roll the result into the client's score. Guard appropriately.
3. Web: a survey capture form + a small "client satisfaction" summary on the Client and on a dashboard.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT build a full survey-designer or public distribution engine in the MVP (one default survey +
  internal/simple capture). Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
