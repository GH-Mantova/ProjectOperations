---
premise: '! grep -rq "metadata-catalog" apps/api/nest-cli.json apps/api/package.json'
premise_means: The API build does not yet bundle docs/data-model/metadata-catalog.json into its deployable artifact - neither nest-cli.json nor package.json references the catalog - so the deployed Azure App Service has no on-disk copy beside the running API process and the Smart Wizard dies with "repo root not found from API process".
scope:
  - apps/api/nest-cli.json
  - apps/api/package.json
  - apps/api/scripts/**
  - apps/api/src/modules/metadata/assets/**
  - .gitignore
done_when: pnpm --filter @project-ops/api build && test -f apps/api/dist/src/modules/metadata/assets/metadata-catalog.json && pnpm lint
size: 5
gate_allow: none
seed_only: false
escalates: false
---

# SLICE 1 - bundle metadata-catalog.json into the API build artifact

## Context (verified on origin/main)
Binding plan: `docs/plans/smart-wizard-catalog-deploy-plan.md` section 4 SLICE 1 (merged as PR #874).
The Smart Wizard 503s in production because `apps/api/src/modules/metadata/metadata.service.ts`
resolves `docs/data-model/metadata-catalog.json` only by walking parent directories for a repo root,
and the deployed App Service artifact ships ONLY `apps/api/` - no `docs/`, no `scripts/` - so the walk
always returns null. This slice makes `nest build` place the catalog INSIDE the compiled artifact,
next to the compiled metadata module, so a later slice can resolve it `__dirname`-relative.

Nest asset globs resolve relative to `sourceRoot` (`src`) and cannot reach
`../../docs/data-model/metadata-catalog.json` directly (plan section 6.1). Use the prebuild copy route.

## What to build
1. `apps/api/scripts/copy-metadata-catalog.mjs` - a small (~15-line) Node script, no new dependencies,
   that resolves the repo root via `path.resolve(__dirname, "../../..")`, reads
   `docs/data-model/metadata-catalog.json`, and writes it to
   `apps/api/src/modules/metadata/assets/metadata-catalog.json` (creating the dir if needed). Exit
   non-zero and loudly if the source file is missing.
2. `apps/api/package.json` - add `"prebuild": "node scripts/copy-metadata-catalog.mjs"` so it runs
   automatically before `nest build`.
3. `apps/api/nest-cli.json` - add a `compilerOptions.assets` entry copying
   `modules/metadata/assets/**/*` into `dist/src`, so the file lands at
   `dist/src/modules/metadata/assets/metadata-catalog.json`.
4. `.gitignore` - ignore `apps/api/src/modules/metadata/assets/metadata-catalog.json`; it is a
   build-time staged copy of the canonical `docs/data-model/metadata-catalog.json` and the two tracked
   copies must never diverge (plan section 6.2).

## Do NOT
- Do NOT change `apps/api/src/modules/metadata/metadata.service.ts` or `metadata.controller.ts` - the
  resolver change is SLICE 2. This slice only guarantees the file is in the bundle; behaviour is
  unchanged on main and in prod until SLICE 2 lands.
- Do NOT edit `.github/workflows/deploy.yml` - the point is that `nest build` bundles the file, so the
  deploy workflow stays untouched.
- Do NOT commit the staged `assets/metadata-catalog.json` (it must be gitignored).
- Do NOT require any Azure / App Service / Entra / SharePoint variable. Hard stop.
- Do NOT edit `/sot/`.

## VERIFY
- `pnpm --filter @project-ops/api build`
- `test -f apps/api/dist/src/modules/metadata/assets/metadata-catalog.json`
- `pnpm lint`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails
One attempt. Never exit silently - if the bundling already exists on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
