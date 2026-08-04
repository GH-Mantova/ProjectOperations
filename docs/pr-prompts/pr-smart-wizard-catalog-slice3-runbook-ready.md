---
premise: '! test -f docs/runbooks/smart-wizard-catalog-verify.md'
premise_means: There is no post-deploy verification runbook for the Smart Wizard catalog fix, and the metadata service does not log which source resolved the catalog, so an operator cannot confirm the deployed fix works or diagnose which resolution source won.
scope:
  - docs/runbooks/**
  - apps/api/src/modules/metadata/metadata.service.ts
requires_file_on_main:
  - apps/api/test/modules/metadata/metadata.service.spec.ts
done_when: pnpm --filter @project-ops/api build && pnpm --filter @project-ops/api lint && test -f docs/runbooks/smart-wizard-catalog-verify.md
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# SLICE 3 - post-deploy verification runbook + one-shot resolution log line

## Context (verified on origin/main)
Binding plan: `docs/plans/smart-wizard-catalog-deploy-plan.md` section 4 SLICE 3. SLICE 2 has landed the
env->bundle->walker resolver (this prompt is gated
`requires_file_on_main: apps/api/test/modules/metadata/metadata.service.spec.ts`, so it only runs after
SLICE 2 is on main). CI cannot prove the deployed App Service works (End-User Advocate OBJECT carried
from the plan), so this slice adds the human verification path and a diagnosable log line.

## What to build
1. `docs/runbooks/smart-wizard-catalog-verify.md` - a short runbook:
   (a) After the deploy job's health gate passes, open the deployed site, log in as an admin, go to
   Dashboard -> Smart Wizard, and assert the model list populates (no 503 banner).
   (b) If it 503s, curl `/api/v1/meta/catalog` with a current auth cookie; the new enumerating message
   states which of the three sources failed (env unset/missing, bundle missing, walker null).
   (c) Cite the `sot/05-decisions-and-lessons.md` deploy-lag entry: allow the App Service warm-up /
   deploy-lag window before declaring failure.
2. `apps/api/src/modules/metadata/metadata.service.ts` - add ONE log line: on the first successful
   `getCatalog()`, `this.logger.log("Metadata catalog resolved via <source>")` where source is
   `env` / `bundle` / `walker`, fired once via a boolean latch. Zero per-request logging cost. No other
   behaviour change.

## Do NOT
- Do NOT change the resolution order or the 503 behaviour from SLICE 2 - only add the one-shot log line.
- Do NOT add an in-memory cache.
- Do NOT edit `.github/workflows/deploy.yml` or any Azure / App Service / Entra / SharePoint config.
- Do NOT edit `/sot/` - the sot/05 lesson is SLICE 4, a separate doc-reconcile PR.

## VERIFY
- `pnpm --filter @project-ops/api build`
- `pnpm --filter @project-ops/api lint`
- `test -f docs/runbooks/smart-wizard-catalog-verify.md`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
One attempt. Never exit silently - if the runbook already exists on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any CI failure.
