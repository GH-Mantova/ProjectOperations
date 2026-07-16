---
premise: '! grep -rqi "scoreConfig\|passFail\|weightedScore" apps/api/src/modules/forms'
premise_means: The forms engine has no inspection scoring, pass/fail response sets, or score thresholds.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/forms/**
  - apps/web/src/pages/forms/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "scoreConfig\|passFail\|weightedScore" apps/api/src/modules/forms
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | Forms engine gap 2/6 | inspection scoring + pass/fail -->
# Forms engine — inspection scoring + pass/fail response sets

STATUS: DRAFTED, STAGED, arm-eligible. Extends the EXISTING forms engine (PR #97). Turns a form from a
data-collection sheet into a scored **inspection** — the biggest single feature gap vs SafetyCulture /
Procore. Response sets, weights, and a computed pass/fail per submission.

## What to build
Branch: `feat/forms-scoring-passfail`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. Schema/config — a reusable **response set** (e.g. Pass/Fail/N-A with per-option score + colour) that a
   choice `FormField` can reference via its `config`/`optionsJson`; add a `scoreConfig` (weight, whether
   the field counts toward score) to fields; add `score`, `maxScore`, `scorePct`, and `outcome`
   (PASS/FAIL/PARTIAL/NA) to `FormSubmission`. A migration for the submission columns; response sets can
   live in `config` JSON or a small `FormResponseSet` model (your call — keep it <=10 files).
2. API — compute the score/outcome on submit from the answers + weights + threshold (threshold in the
   template `settings` blob, e.g. `passThresholdPct`). Expose score/outcome on submission reads and in the
   existing analytics endpoint.
3. Web — response-set picker in the designer; show per-section and total score + PASS/FAIL (colour-coded)
   on `FormFillPage` and `FormSubmissionDetailPage`.

## Schema change -> REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT the three `docs/data-model/*` files
(#593). Bare `GATE-ALLOW: migrations` at column 0 of the PR body. Update affected `*.spec.ts`
`toHaveBeenCalledWith` expectations if you change a service create/update payload.

## Do NOT
- Do NOT rebuild the rules engine (it exists). Do NOT touch Azure/prod. If >10 files, split and say so.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP`. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
