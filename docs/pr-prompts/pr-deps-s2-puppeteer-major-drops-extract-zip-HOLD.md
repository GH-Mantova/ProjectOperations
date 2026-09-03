---
premise: 'grep -q "extract-zip@2.0.1" pnpm-lock.yaml'
premise_means: >-
  extract-zip 2.0.1 is in the dependency tree and carries an unfixable high-severity advisory.
  MEASURED 2026-09-03 against the npm registry - extract-zip's published versions END at 2.0.1, so
  GHSA-jmr9-qjv8-65gv (unvalidated symlink path traversal, Dependabot alert 88) has no patched
  version and never will; Dependabot's first_patched_version field is empty. It reaches the tree by
  exactly one route, apps/api puppeteer 23.11.1 -> @puppeteer/browsers 2.6.1 -> extract-zip ^2.0.1.
  Every 2.x of @puppeteer/browsers still depends on it (checked 2.6.1, 2.7.0, 2.8.0, 2.10.0, 2.11.0,
  2.12.0) while 3.2.1 dropped it entirely - its dependencies are yargs and modern-tar. puppeteer
  25.9.0 resolves @puppeteer/browsers 3.2.1. So a major bump removes the package from the tree
  rather than patching around it.
scope:
  - apps/api/package.json
  - pnpm-lock.yaml
  - .github/workflows/deploy.yml
  - .github/workflows/ci.yml
done_when: >-
  ! grep -q "extract-zip" pnpm-lock.yaml && pnpm build && pnpm lint
size: 4
gate_allow: dependencies
seed_only: false
escalates: true
---

# DEPS-S2: bump puppeteer so the unfixable dependency leaves the tree

**Grounded against `origin/main` = `de811907`, measured 2026-09-03T06:0xZ.**

`escalates: true` — `puppeteer` is a **runtime** dependency of `apps/api` and renders the client-facing
quote PDFs. Open the PR and leave it unmerged.

## Why a bump and not a patch

`extract-zip@2.0.1` is the **final** published version of that package. There is nothing to upgrade to
and no patch is coming, so a version floor cannot fix this and a `pnpm patch` would mean owning a
patch to a dead package indefinitely. The dependency has to leave.

| | |
|---|---|
| Route in | `apps/api` → `puppeteer 23.11.1` → `@puppeteer/browsers 2.6.1` → `extract-zip ^2.0.1` |
| Every `@puppeteer/browsers` 2.x | still depends on it |
| `@puppeteer/browsers` 3.2.1 | **does not** — deps are `yargs` and `modern-tar` |
| `puppeteer` 25.9.0 | resolves `@puppeteer/browsers` 3.2.1 |

Dependabot closes alert **#88** on its own once the package is gone. No dismissal, no justification to
re-argue later.

## The two things that can break, and both are testable

1. 🔴 **`deploy.yml` calls a path *inside* puppeteer.** Line 116 runs
   `node node_modules/puppeteer/lib/esm/puppeteer/node/cli.js` to install Chrome into the deploy
   bundle. **A major bump can move that file.** If it does, the install step fails at deploy time and
   the symptom is PDF rendering breaking in production — not a red build. Verify the path exists in
   the new version and repoint it if it moved. `ci.yml:85` uses the supported
   `pnpm --filter @project-ops/api exec puppeteer browsers install chrome` form; **prefer that form in
   `deploy.yml` too** if it can be made to write into the bundle cache dir, because it is a public
   interface and the `lib/esm/...` path is not.
2. **The pinned Chrome revision moves with the major.** The deploy already installs Chrome into
   `PUPPETEER_CACHE_DIR=/home/site/wwwroot/.cache/puppeteer`, so a fresh download is expected and
   fine — but confirm the install step still lands a browser at the path
   `pdf-renderer.service.ts` resolves via `puppeteer.executablePath()`.

## Do

1. **`apps/api/package.json`** — move `puppeteer` from `23.11.1` to the current 25.x, pinned exactly
   as it is today (no caret; the existing entry is an exact pin and that is deliberate for a package
   that downloads a browser).
2. **Refresh the lock** with `pnpm install --lockfile-only` and confirm `extract-zip` is gone from
   `pnpm-lock.yaml` entirely — not merely deduped.
3. **Check both workflow call sites** as described above, and repoint `deploy.yml:116` if the internal
   path moved. If it did not move, say so explicitly in the PR body with the version you checked —
   "unchanged" is a measurement, not an assumption.
4. **Read `pdf-renderer.service.ts`** for anything the major broke. It uses `puppeteer.launch`,
   `puppeteer.executablePath()` and `PUPPETEER_EXECUTABLE_PATH`; all three are public API and expected
   to survive, but the `LAUNCH_ARGS` object and the `browser.on("disconnected")` handler are worth a
   glance. Change nothing that does not need changing.
5. **Declare the gate.** `GATE-ALLOW: dependencies` bare, at column 0 of the PR body.
6. **In the PR body, state that this closes Dependabot #88 and how** — the package is absent, not
   suppressed. Paste the `grep -c extract-zip pnpm-lock.yaml` result showing 0.

## Do NOT

- Do NOT add a `pnpm.overrides` entry for `extract-zip`, and do NOT fork or vendor it. There is no
  safe version to point at; an override here would either fail the install or pin a third-party build.
- Do NOT dismiss or suppress the Dependabot alert. The fix is that the dependency stops existing.
- Do NOT bump any other dependency in the same PR. `pr-deps-s1` handles `fast-uri` and `browserslist`
  separately and deliberately, so that a PDF-rendering regression can never ride along with a routine
  security bump.
- Do NOT move `puppeteer` to `devDependencies`. It is required at runtime to render quote PDFs.
- Do NOT touch `sot/`.

## Verify

- `grep -c "extract-zip" pnpm-lock.yaml` returns **0**.
- `grep -n "puppeteer" apps/api/package.json` shows the 25.x pin in `dependencies`.
- `pnpm build` and `pnpm lint` exit 0.
- The Chrome install command named in `deploy.yml` runs locally and lands a browser that
  `puppeteer.executablePath()` then resolves to an existing file.
- **Render one PDF.** A green build does not prove PDF rendering survived a major bump; a rendered
  document does. Say in the PR body which document you rendered.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop before
pushing.
