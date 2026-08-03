---
premise: '! test -f docs/plans/smart-wizard-catalog-deploy-plan.md'
premise_means: No plan exists yet for making the API resolve metadata-catalog.json in the deployed App Service; the Smart Wizard currently dies with "repo root not found from API process" because the service only finds the catalog by walking for a repo root that is absent in production.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/smart-wizard-catalog-deploy-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: Smart Wizard metadata-catalog must resolve in the deployed API

## Context (verified on origin/main)
The Smart Wizard modal (Dashboard → Smart Wizard) fails with
**"Metadata catalog unavailable: repo root not found from API process."**
`apps/api/src/modules/metadata/metadata.service.ts` resolves
`docs/data-model/metadata-catalog.json` (`CATALOG_REL_PATH`) by walking parent directories for a
repo root, then throws that error at line 51 when no repo root is found. In the deployed Azure App
Service the repo tree (and `docs/`) is not present next to the running API, so the walk always
fails and the wizard is unusable in production. `.gitignore:116` notes the file is deliberately
tracked "because the API reads it from disk"; PR #750 shipped the wizard shell assuming a runtime
disk read. This is a deployment/path-resolution problem, not a UI bug.

## Why this is a plan, not a direct fix (End-User Advocate OBJECT, carried forward)
CI cannot prove the fix on the real App Service — a green build here does not confirm the wizard
loads in production. The plan must therefore specify (a) a resolution strategy that provably works
with no repo tree present, (b) a CI-testable unit assertion, and (c) an explicit post-merge
deploy-verification step (mind the deploy-lag window).

## What to build (the plan document only)
Author `docs/plans/smart-wizard-catalog-deploy-plan.md`: a binding SLICE-0 plan, following the
house style of `docs/plans/settings-restructure-plan.md` (grounded audit → ordered, independently
shippable slices ≤ ~10 files each, `requires_merged` edges, rollback notes). The plan must:

1. Nail the root cause with file/line evidence (as above) and confirm what the deployed API
   filesystem actually contains near the running process.
2. Specify the resolution order for the catalog: (i) `METADATA_CATALOG_PATH` env override **if
   set**, (ii) a **build-bundled** copy resolved relative to the compiled module (`__dirname`/dist),
   (iii) the existing repo-root walk as a **dev-only fallback**. The production path MUST work with
   **no env var set** — the bundle is the real fix; the override is only a convenience.
3. Choose and justify the bundling mechanism (e.g. Nest `nest-cli.json` asset copy, or a prebuild
   copy into a bundled `assets/` dir) and confirm it survives `pnpm build` into the deployed artifact.
4. Define the CI-testable assertion: given a bundled catalog and a non-repo cwd, the service
   resolves it and does not throw; and define the manual post-deploy check (open the wizard on the
   deployed site after the deploy completes).
5. Break the work into the smallest shippable code slice(s) and list them with premises.

## Do NOT
- Do NOT write any application/build code in this slice — output is the plan document only
  (`scope` is `docs/plans/**`).
- Do NOT propose any change that REQUIRES setting an Azure / App Service / Entra / SharePoint
  variable to work — that is a hard stop. The env override may exist but production must work
  without it. Where Marco must do something in Azure, the plan writes the exact steps and stops.
- Do NOT edit `/sot/` — this is a `docs/plans/` artifact; SoT changes go via a doc-reconcile PR.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/smart-wizard-catalog-deploy-plan.md`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — if the plan already exists on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
