---
premise: '! grep -q "METADATA_CATALOG_PATH" apps/api/src/modules/metadata/metadata.service.ts'
premise_means: The metadata service does not yet implement the env->bundle->walker resolution order (no METADATA_CATALOG_PATH handling and no bundled-asset lookup); it still finds the catalog only via the repo-root walk, so even with the catalog bundled the deployed API would not read it and the Smart Wizard still 503s.
scope:
  - apps/api/src/modules/metadata/metadata.service.ts
  - apps/api/src/modules/metadata/metadata.controller.ts
  - apps/api/test/**
requires_file_on_main:
  - apps/api/scripts/copy-metadata-catalog.mjs
done_when: pnpm --filter @project-ops/api build && pnpm --filter @project-ops/api lint && pnpm --filter @project-ops/api test && grep -q "METADATA_CATALOG_PATH" apps/api/src/modules/metadata/metadata.service.ts
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# SLICE 2 - resolver order (env -> bundle -> dev walker) + production-shape unit test

## Context (verified on origin/main)
Binding plan: `docs/plans/smart-wizard-catalog-deploy-plan.md` section 3 + section 4 SLICE 2.
SLICE 1 bundles `metadata-catalog.json` into the API artifact at
`dist/src/modules/metadata/assets/metadata-catalog.json`. This prompt is gated
`requires_file_on_main: apps/api/scripts/copy-metadata-catalog.mjs`, so it only runs after SLICE 1 is
on main. Now make the service actually read the bundled copy.

## What to build
1. `apps/api/src/modules/metadata/metadata.service.ts` - add `resolveCatalogPath(): string | null`
   trying, in order:
   (i) `METADATA_CATALOG_PATH` env override, if set and the file exists;
   (ii) the build-bundled copy resolved relative to `__dirname`
   (`<dist>/src/modules/metadata/assets/metadata-catalog.json`);
   (iii) the existing repo-root walk as a dev-only fallback (behaviour unchanged, including the
   `tryGenerate()` regenerate-on-the-fly path).
   `getCatalog()` uses the winner. If all three fail it throws a NEW 503 that enumerates the three
   sources tried and their outcomes (env unset/missing, bundle missing, walker null), replacing the
   current "repo root not found from API process" string. Production MUST work with NO env var set
   (source ii wins). Preserve the runtime-read contract: no in-memory cache; re-read per request.
2. `apps/api/src/modules/metadata/metadata.controller.ts` - no logic change; add a JSDoc line
   documenting the resolution order for future readers.
3. Add the Jest spec at `apps/api/test/modules/metadata/metadata.service.spec.ts` (jest.config.ts uses
   `rootDir: "."` + `testRegex: .*\.spec\.ts$`, so a spec under `test/` runs; only `test/canonical` is
   ignored). Cover at minimum:
   - case 1 (production-shape proof): bundled asset present, no env, no repo root -> `getCatalog()`
     returns the parsed JSON and does NOT throw. This case MUST fail on today's main (walker-only) and
     pass after this slice.
   - case 2: `METADATA_CATALOG_PATH` set to a distinct temp file wins over the bundle.
   - case 3: `METADATA_CATALOG_PATH` set to a non-existent path falls through to the bundle.
   - case 4: no env, no bundle, no walker -> the new enumerating 503 is thrown.
   - case 5: dev walker still fires `tryGenerate()` when only the walker hits a mock repo root.

## Do NOT
- Do NOT change the Smart Wizard UI (`apps/web/src/dashboards/SmartWizardModal.tsx`,
  `apps/web/src/dashboards/smartWizardCatalog.ts`) - the fix is server-side only.
- Do NOT add an in-memory cache; preserve the per-request read.
- Do NOT touch `apps/api/prisma/schema.prisma` or add a migration - this is not a schema change.
- Do NOT edit `.github/workflows/deploy.yml` or any Azure / App Service / Entra / SharePoint config.
- Do NOT edit `/sot/` - the sot/05 lesson is SLICE 4, a separate doc-reconcile PR.

## VERIFY
- `pnpm --filter @project-ops/api build`
- `pnpm --filter @project-ops/api lint`
- `pnpm --filter @project-ops/api test` (the new metadata spec green, including the production-shape case)

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
One attempt. Never exit silently - if the resolver already exists on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any CI failure.
