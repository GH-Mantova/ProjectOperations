# Smart Wizard metadata-catalog — deploy-resolution plan (SLICE-0, binding)

**Status:** authored 2026-08-03 (Marco session). Every audit finding below was re-verified
against origin/main HEAD on 2026-08-03 before this plan was written.
**Owner:** Marco / ProjectOperations desktop-shell + api.
**Rule:** every code slice chains behind this document (`requires_merged`). Slices ship
independently, each ≤ ~10 files, each CI-green. This plan is docs-only (`scope: docs/plans/**`);
the code slices are in §4.

---

## 1. Motivation — what is broken, on origin/main today

Opening Dashboard → **Smart Wizard** on the deployed site (Azure App Service) yields:

> **Metadata catalog unavailable: repo root not found from API process.**

Grounded, file/line pinned on origin/main HEAD 2026-08-03:

1. **The service resolves the catalog by walking for a repo root.**
   `apps/api/src/modules/metadata/metadata.service.ts:16-32` sets
   `CATALOG_REL_PATH = docs/data-model/metadata-catalog.json` and walks parents of
   `__dirname` for up to 10 levels looking for a `scripts/data-model/build-relationship-map.mjs`
   sibling to pin the repo root.
2. **When the walk fails, the constructor logs a warning and `getCatalog` throws.**
   `metadata.service.ts:37-53` — if `repoRoot === null`, `getCatalog()` throws the
   `ServiceUnavailableException` with the exact string the user sees at line 50-52.
3. **The deployed API bundle does not contain a repo tree.**
   `.github/workflows/deploy.yml:100` runs
   `pnpm --filter @project-ops/api deploy --prod --legacy --config.node-linker=hoisted deploy-api`
   and then `azure/webapps-deploy@v3` (line 153) ships **only `deploy-api/`** as the package.
   The workflow never copies `docs/` or `scripts/` next to the app — nothing in
   `.github/workflows/deploy.yml` matches `docs/data-model` or `metadata-catalog`.
   So the parent walk in the App Service filesystem cannot possibly hit
   `scripts/data-model/build-relationship-map.mjs` — the walk always terminates at `/` and
   returns `null`. The 503 above is therefore deterministic in production.
4. **The `/meta/catalog` endpoint has no fallback.**
   `apps/api/src/modules/metadata/metadata.controller.ts:12-26` `GET /meta/catalog` is a thin
   pass-through to `MetadataService.getCatalog()` — no cache, no bundled copy, no env
   override. The wizard UI (`apps/web/src/dashboards/smartWizardCatalog.ts`,
   `apps/web/src/dashboards/SmartWizardModal.tsx`) has no offline path either; it renders
   the 503 message verbatim.
5. **The runtime-read design is intentional; the bundling gap is the bug.**
   The comment block at `metadata.service.ts:6-14` documents the "runtime read, no cache,
   surfaces on next request" contract; `.gitignore:116` (per `MEMORY.md`) explicitly keeps
   `metadata-catalog.json` tracked "because the API reads it from disk". The design assumes
   the file is on disk next to the API process at runtime — the deploy pipeline never
   places it there.

**Root cause (one sentence):** the API resolves the catalog only via a repo-root walk that
requires `scripts/data-model/build-relationship-map.mjs` to sit on disk near the running
process; the App Service artifact contains neither `scripts/` nor `docs/`, so the walk
returns `null` and every wizard load 503s.

**Why this is a plan, not a direct fix (End-User Advocate OBJECT, carried forward):**
CI cannot prove the fix on the real App Service — a green PR build here does not confirm
the wizard loads in production. The plan must specify (a) a resolution strategy that
provably works with no repo tree present, (b) a CI-testable unit assertion, and (c) an
explicit post-merge deploy-verification step (mind the deploy-lag window).

---

## 2. Design constraints (non-negotiable)

1. **Production MUST work with no Azure/env change.** Setting an App Service, Entra, or
   SharePoint variable to make the fix work is a hard stop. The env override (§3, order 1)
   may exist as a convenience, but if it is absent the deployed API must still resolve the
   catalog. The **build-bundled copy is the real fix**; the env override is a knob, not the
   mechanism.
2. **No behaviour change to the wizard.** The service still reads a JSON file at request
   time, still returns the same shape, still 503s when a file legitimately cannot be
   parsed. Only the *resolution order* changes.
3. **Dev ergonomics preserved.** Running `pnpm --filter @project-ops/api dev` from the repo
   with a freshly-generated catalog must keep working with no config; the existing
   repo-root walk stays as a **dev-only fallback** (§3, order 3) and the "generate on the
   fly" `tryGenerate()` path stays intact for dev.
4. **The catalog is not sensitive.** It is a schema-shape JSON already tracked in the repo;
   bundling it into the deployed artifact does not leak secrets.
5. **Size budget.** `docs/data-model/metadata-catalog.json` is well under 1 MB (comment at
   `metadata.service.ts:12` describes ~100–500 KB). Copying it into `dist/` is free.
6. **No `/sot/` edits.** Every doc-reconcile lands via a dedicated sot-purity PR (§4
   slice N).

---

## 3. Target resolution order

`MetadataService` resolves the catalog path by trying, in order:

1. **`METADATA_CATALOG_PATH` env override** — if set and the file exists, use it verbatim.
   Convenience knob only (e.g. dev pointing at a scratch file, or a future ops override).
   **Production MUST NOT require it.**
2. **Build-bundled copy resolved relative to `__dirname`.** In the compiled artifact this
   resolves to `<dist>/src/modules/metadata/assets/metadata-catalog.json` (path exact once
   the build asset is wired — see §4 slice 1). This is the *only* path the App Service
   deploy needs to work: the file is placed there by `nest build` via `nest-cli.json`
   `compilerOptions.assets` (see §4 slice 1 for the exact glob).
3. **Repo-root walk (dev fallback).** The existing `findRepoRoot()` walker, unchanged in
   behaviour, tried last. If it succeeds AND the bundled copy was not present (fresh
   checkout, dev), the walker's `tryGenerate()` path continues to work (regenerate on the
   fly). In deployed containers the walk fails silently and control returns without
   throwing — the bundled copy from step 2 has already answered.

**Terminal 503** — only if all three sources are exhausted AND no file can be read. The
message is rewritten to enumerate the three sources tried (so future ops has a real signal
instead of the current "repo root not found" line, which is now a lie once the bundle
ships).

**Non-goal:** no in-memory cache. The runtime-read contract from `metadata.service.ts:6-14`
is preserved — every request re-reads whichever source won. Cost stays ≤ one small JSON
read per hit.

---

## 4. Slice list (ordered, independently shippable)

Each code slice ≤ ~10 files. Dependency edges expressed as `requires_merged`. Docs-only
sot-reconcile is separated at the end.

### SLICE 0 — this document (docs-only) `size:1`
- **Files:** `docs/plans/smart-wizard-catalog-deploy-plan.md`.
- **Gate/CI:** `pnpm build && pnpm lint`.
- **Requires:** nothing.
- **Notes:** binds every slice below. Do-not-merge is the caller's choice; the plan itself
  is safe to merge as pure prose.

### SLICE 1 — bundle `metadata-catalog.json` into the API build artifact `size:3`
- **Files:**
  - `apps/api/nest-cli.json` — extend `compilerOptions.assets[]` with a copy rule so
    `nest build` copies `docs/data-model/metadata-catalog.json` (or a pre-build-staged
    copy at `apps/api/src/modules/metadata/assets/metadata-catalog.json`) into
    `dist/src/modules/metadata/assets/metadata-catalog.json`.
  - `apps/api/package.json` — if the Nest asset glob cannot reach outside `sourceRoot`
    (`src/`), add a `prebuild` script that copies `../../docs/data-model/metadata-catalog.json`
    into `apps/api/src/modules/metadata/assets/metadata-catalog.json` first, then let the
    existing `nest build` asset rule pick it up. Track the staged copy in `.gitignore` if
    it lives inside `src/`.
  - `apps/api/scripts/copy-metadata-catalog.mjs` (if the prebuild route is chosen) — a
    ~15-line node script that resolves the repo root via `path.resolve(__dirname, "../../..")`
    and copies the JSON. No new dependencies.
- **Verify (must all pass):**
  - `pnpm --filter @project-ops/api build` produces
    `apps/api/dist/src/modules/metadata/assets/metadata-catalog.json` on disk.
  - `pnpm --filter @project-ops/api deploy --prod --legacy --config.node-linker=hoisted deploy-api-test`
    (the same command as `.github/workflows/deploy.yml:100`) produces
    `deploy-api-test/dist/src/modules/metadata/assets/metadata-catalog.json`.
  - Delete `deploy-api-test/` after verifying; do not commit it.
- **Non-goal:** do not change `metadata.service.ts` in this slice. This slice only
  guarantees the file exists in the bundle; the service still uses the old walker (which
  keeps working in dev). No user-visible change on `main` or in prod yet — this is a
  no-op-shape slice that unlocks slice 2.
- **Requires:** SLICE 0.

### SLICE 2 — resolver: env → bundle → repo-walk, with unit test `size:4`
- **Files:**
  - `apps/api/src/modules/metadata/metadata.service.ts` — implement the resolution order
    from §3. New private `resolveCatalogPath(): string | null` returning the winning path,
    or `null` if all three sources failed. `getCatalog()` throws a new, honest 503
    message enumerating the three sources tried and their outcomes (env unset / bundled
    missing / walker null). `tryGenerate()` continues to fire only in the walker branch.
  - `apps/api/test/modules/metadata/metadata.service.spec.ts` — new Jest spec (or
    extension of an existing one). Cases (all must be CI-runnable in the existing
    `pnpm --filter @project-ops/api test` job):
    1. **Bundled catalog wins with no env, no repo root** — construct the service with
       `process.cwd()` and `__dirname` mocked to a temp dir that contains an
       `assets/metadata-catalog.json` sibling and NO `scripts/data-model/…`. Assert
       `getCatalog()` returns the parsed JSON and does NOT throw. This is the
       production-shape assertion. **This test MUST fail on `main` today (walker
       returns `null`) and MUST pass after slice 1 + slice 2 land.**
    2. **Env override wins over bundle** — set `METADATA_CATALOG_PATH` to a temp file
       with distinct content; assert its content comes back.
    3. **Missing env file falls through** — set `METADATA_CATALOG_PATH` to a
       non-existent path; assert the bundled copy wins.
    4. **All three sources missing → 503** — no env, no bundle, no walker; assert the
       new enumerating 503 message is thrown.
    5. **Dev walker still generates** — existing walker behaviour: no bundle, walker
       hits a mock repo root, `tryGenerate()` fires. Assert the mock spawnSync was
       invoked with the generator path. (Reuses whatever test double the file already
       has, if any.)
  - `apps/api/src/modules/metadata/metadata.controller.ts` — no code change; add a JSDoc
    line documenting the resolution order for future readers.
  - `docs/pr-prompts/…` — none in this slice.
- **Verify:**
  - `pnpm --filter @project-ops/api build && pnpm --filter @project-ops/api lint`.
  - `pnpm --filter @project-ops/api test -- metadata.service.spec.ts` all-green.
  - Manual: start the API from a non-repo cwd (e.g. `cd /tmp && node
    /path/to/apps/api/dist/src/main.js`) with the bundled asset present; hit
    `GET /meta/catalog`; assert 200 + JSON.
- **Requires:** SLICE 1.
- **CI-testable assertion (nailed):** case 1 above is the CI proof-point. It exercises
  the exact production shape (bundled asset present, no repo tree) inside Jest so a
  future refactor that reintroduces the walker-only path fails red on the PR, not on
  the deployed site.

### SLICE 3 — post-deploy verification runbook + observability `size:2`
- **Files:**
  - `docs/runbooks/smart-wizard-catalog-verify.md` — a short runbook: (a) after the
    deploy job's health gate passes (`deploy.yml:173`), open the site, log in as
    `admin@projectops.local`, click Dashboard → Smart Wizard, assert the model list
    populates (no 503 banner). (b) If it 503s, curl `/api/v1/meta/catalog` from a
    developer machine with the current auth cookie; the new enumerating message will
    say which of the three sources failed and why (env unset, bundle missing, walker
    null). (c) Cite `sot/05-decisions-and-lessons.md` deploy-lag entry — allow the
    App Service warm-up window before declaring failure.
  - `apps/api/src/modules/metadata/metadata.service.ts` — one log line: on first
    successful `getCatalog()`, `this.logger.log("Metadata catalog resolved via
    <source>")` (source is `env` / `bundle` / `walker`), fired once via a boolean
    latch. Zero log-per-request cost.
- **Verify:** `pnpm build && pnpm lint`; runbook renders in GitHub.
- **Requires:** SLICE 2.

### SLICE 4 — sot/05 lesson + sot/01 §5 build-artifact note `size:1`
- **Files:** `sot/05-decisions-and-lessons.md` (append lesson: "runtime disk reads MUST
  resolve via `__dirname`-relative bundled assets, never via a repo-root walk; the deploy
  pipeline ships only `apps/api`"); `sot/01-charter-and-architecture.md` §5 (build /
  deploy) — one-line reference to the resolution order in §3 of this plan.
- **Docs-only PR, never mixed with code (CP-24 sot-purity gate blocks the mix).**
- **Requires:** SLICES 1, 2, 3.

---

## 5. Redirect / behaviour map

None. This plan changes no URLs and no user-visible behaviour except turning the current
deterministic 503 into a working 200. The 503 message text changes (see slice 2), which is
intentional and required for future diagnosability. No caller in `apps/web` parses the 503
message body — `SmartWizardModal.tsx` renders the raw `.message` string in the error
banner, so the new text is safe.

---

## 6. Risks

### 6.1 Nest asset glob cannot reach outside `sourceRoot`
`nest-cli.json` `compilerOptions.assets` globs are resolved relative to `sourceRoot`
(`src`). If Nest refuses to copy `../../docs/data-model/metadata-catalog.json`, slice 1
falls back to the `prebuild` copy-into-src route (documented in the slice). Either route
produces the same final on-disk location; the tests in slice 2 are agnostic.

### 6.2 Committing a staged catalog copy inside `apps/api/src`
If the prebuild route is used, the staged file at
`apps/api/src/modules/metadata/assets/metadata-catalog.json` must be **gitignored** to
prevent drift from the canonical `docs/data-model/metadata-catalog.json`. Slice 1 adds
`.gitignore` entry AND a prebuild step that always overwrites — never let two copies of
this file diverge. If the file is accidentally committed, `pnpm lint` will not catch it;
add a repo-root sanity check in slice 3's runbook.

### 6.3 The bundled JSON is a build-time snapshot, not runtime
Between deploys, `docs/data-model/metadata-catalog.json` can change on `main` without a
redeploy — the deployed API will lag until the next deploy. This is acceptable (schema
additions ship with a deploy anyway) and is called out in the sot/05 lesson (slice 4). The
walker's `tryGenerate()` path is preserved for dev so contributors adding a model see it
in the wizard on the next request without a rebuild.

### 6.4 Env override footgun
`METADATA_CATALOG_PATH` pointing at a stale or malformed file will silently override the
bundle. Slice 2's service logs the resolved source once at first success (see slice 3), so
"why is the wizard showing yesterday's schema" is diagnosable. Do NOT set the env in
production unless there is a specific ops reason.

### 6.5 CI cannot prove the App Service filesystem shape
No CI job runs against the real App Service — the deploy workflow ships and health-gates,
but does not open the wizard. This is why slice 3 ships a manual runbook. Once a
post-deploy smoke that hits `/api/v1/meta/catalog` from CI exists (out of scope of this
plan), the runbook can be retired.

### 6.6 Nothing in this plan requires an Azure/env change
Confirmed against §2 constraint 1. If a future slice proposes one, that slice fails the
plan and MUST be re-planned as a separate `platform:` ticket outside this document.

---

## 7. Out of scope

- Any change to the Smart Wizard UI (`SmartWizardModal.tsx`, `smartWizardCatalog.ts`) — the
  fix is entirely server-side.
- Any change to the generator script (`scripts/data-model/build-relationship-map.mjs`).
- In-memory caching of the catalog on the API side. The runtime-read contract stays.
- A post-deploy `/meta/catalog` smoke in `deploy.yml`. Nice-to-have, not required for this
  fix. Track as a follow-up if slice 3's runbook proves too manual.
- Changes to `.github/workflows/deploy.yml`. The bundle-via-`nest build` route is chosen
  specifically to keep the deploy workflow untouched.
- Any `/sot/` edit outside slice 4.
- Any Azure App Service configuration change. See §2 constraint 1.

---

## 8. Verification of this document

- [x] `test -f docs/plans/smart-wizard-catalog-deploy-plan.md`
- [x] Root cause pinned to file:line on origin/main HEAD 2026-08-03 (§1 items 1-4).
- [x] Every slice has an explicit `requires_merged` edge and a `size:` estimate ≤ ~10 files.
- [x] Resolution order (§3) has three sources with production working when only source 2
      is present.
- [x] CI-testable assertion nailed in slice 2 (case 1) — will fail red on `main` today,
      pass green after slices 1+2 land.
- [x] Post-deploy manual verification defined in slice 3, calling out the App Service
      warm-up / deploy-lag window.
- [x] No slice requires an Azure / App Service / Entra / SharePoint variable change.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
