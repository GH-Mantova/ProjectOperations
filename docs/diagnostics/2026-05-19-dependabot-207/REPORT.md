# Dependabot PR #207 — `brace-expansion` bump sanity check

**Date:** 2026-05-19
**PR:** https://github.com/GH-Mantova/ProjectOperations/pull/207
**Branch on origin:** `dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df`
**Branch HEAD inspected:** `c485f1c` — `chore(deps): bump brace-expansion`
**Investigation only.** No commits made, no merge performed, `main`'s `pnpm-lock.yaml` was not modified.

---

## Headline finding (read this first)

The task brief described PR #207 as bumping `brace-expansion` "from 1.1.13 to 5.0.5 (four major versions)". **The actual diff does not match that description.** What PR #207 actually does:

| Version on `main` | Version on PR branch | Change |
| --- | --- | --- |
| `brace-expansion@1.1.13` | `brace-expansion@1.1.14` | patch bump on 1.x line |
| `brace-expansion@5.0.5` (already present) | `brace-expansion@5.0.6` | patch bump on 5.x line |
| `brace-expansion@2.1.0` | `brace-expansion@2.1.0` | unchanged |

So:

- This is **not** a four-major-version jump. It is two coordinated **patch** bumps (1.1.13→1.1.14 and 5.0.5→5.0.6), both presumably the ReDoS CVE fixes for their respective maintenance lines.
- The 5.x major line is **already in `main`'s tree** (introduced previously via `minimatch@10.2.5`). PR #207 does not introduce a new major; it only moves the already-present 5.x reference forward by one patch.
- Only one file changes in the PR: `pnpm-lock.yaml` (+150 / -60 lines). `package.json` is untouched. No new top-level dependencies.

This reframing materially lowers the risk profile relative to the task brief. The three-question verdict (Section 6) is judged against the actual PR contents, not the brief's framing.

---

## Section 1 — Consumers of `brace-expansion` on `main`

### 1a. `pnpm why brace-expansion` (verbatim)

Ran from `C:\ProjectOperations2` on `main` (commit `a2eaf09`):

```
$ pnpm why brace-expansion 2>&1 | head -80
(empty output — 0 lines, exit code 0)
```

**Why empty:** The repo's `node_modules` was hydrated on the Windows side of the mount. From the Linux sandbox, pnpm's internal store symlinks don't round-trip and pnpm's `why` walker can't resolve consumers. `pnpm -r why brace-expansion --json` confirms this — it returns only the bare workspace project metadata with no `dependencies` graph. The lockfile is intact and authoritative, so Section 1b walks the lockfile snapshots directly.

### 1b. Lockfile-derived consumer trace (authoritative)

Three `brace-expansion` snapshots are present in `pnpm-lock.yaml` on `main`, each pulled in by a distinct `minimatch` major version:

```
brace-expansion@5.0.5 ← minimatch@10.2.5  (consumed by 5 packages)
    @eslint/config-array@0.23.5
    @typescript-eslint/typescript-estree@8.58.2
    eslint@10.2.1
    glob@11.1.0
    glob@13.0.6

brace-expansion@1.1.13 ← minimatch@3.1.5  (consumed by 3 packages)
    fork-ts-checker-webpack-plugin@9.1.0
    glob@7.2.3
    test-exclude@6.0.0

brace-expansion@2.1.0 ← minimatch@5.1.9   (consumed by 2 packages)
    filelist@1.0.6
    readdir-glob@1.1.3
```

**Classification:**

- **`@eslint/config-array`, `eslint`, `@typescript-eslint/typescript-estree`** — lint tooling, dev-only.
- **`glob@7/11/13`** — file-glob library; in this tree it is pulled in transitively by build/test tooling (Vite, Vitest, NestJS CLI, Prisma generator, Jest test-exclude path, etc.), not by runtime API code.
- **`fork-ts-checker-webpack-plugin`** — webpack/build time only.
- **`test-exclude`** — Jest/coverage helper, test-only.
- **`filelist`, `readdir-glob`** — used by `archiver`/`globby` family helpers during build/packaging.

Nothing in `apps/api/src/**` directly imports `brace-expansion`. It is a transitive build/lint/test dependency throughout.

---

## Section 2 — Fetch Dependabot branch into a worktree

```
$ git fetch origin dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df
 * branch            dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df -> FETCH_HEAD
 * [new branch]      dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df ->
                       origin/dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df

$ git log -1 FETCH_HEAD --oneline
c485f1c chore(deps): bump brace-expansion

$ git diff --stat main..FETCH_HEAD
 pnpm-lock.yaml | 210 ++++++++++++++++++++++++++++++++++++++++-----------------
 1 file changed, 150 insertions(+), 60 deletions(-)

$ git worktree add ../ProjectOperations-dependabot-207 FETCH_HEAD
Preparing worktree (detached HEAD c485f1c)
HEAD is now at c485f1c chore(deps): bump brace-expansion

$ git worktree list
/sessions/.../ProjectOperations2                a2eaf09 [main]
/sessions/.../ProjectOperations-dependabot-207  c485f1c (detached HEAD) locked
```

The diff is entirely confined to `pnpm-lock.yaml` (no `package.json`, no source). The brace-expansion lines extracted from the diff:

```
-  brace-expansion@1.1.13:        →   +  brace-expansion@1.1.14:
   brace-expansion@2.1.0:         (unchanged)
-  brace-expansion@5.0.5:         →   +  brace-expansion@5.0.6:
```

(A few collateral resolution-string updates also appear — `terser@5.46.1 → 5.47.1`, a couple of `@babel/*` minor bumps, and `ajv@8.20.0` joining the tree. These are not the subject of the PR but ride along in lockfile recomputation. None are runtime concerns.)

---

## Section 3 — Inspect prepare script and package metadata

### 3a. `pnpm install --frozen-lockfile` in the worktree

```
$ pnpm install --frozen-lockfile 2>&1 | tail -30
Scope: all 5 workspace projects
Lockfile is up to date, resolution step is skipped
Progress: resolved 1, reused 0, downloaded 0, added 0
Packages: +1205
Progress: resolved 1205, reused 1205, downloaded 0, added 1205, done

devDependencies:
+ @playwright/test 1.59.1
+ @types/node 22.19.15
+ cross-env 10.1.0
+ playwright 1.59.1

The following dependencies have build scripts that were ignored:
  @nestjs/core, @prisma/client, @prisma/engines, @scarf/scarf,
  canvas, esbuild, prisma, sharp
To allow the execution of build scripts for these packages, add their names to
"pnpm.onlyBuiltDependencies" in your "package.json", then run "pnpm rebuild"

. postinstall$ git config core.hooksPath .githooks
. postinstall: Done
Done in 2.6s
```

**Key observation:** `brace-expansion` does **not** appear in pnpm's "build scripts ignored" list. That list enumerates every dependency whose `package.json` declares a `preinstall`, `install`, or `postinstall` lifecycle hook (which pnpm 10 disallows by default unless allowlisted in `pnpm.onlyBuiltDependencies`). The fact that `brace-expansion` is absent from the list confirms it requests no install-time hook.

The only script that actually ran during install was the project's own root `postinstall`: `git config core.hooksPath .githooks` — benign.

### 3b. `brace-expansion@5.0.6` package.json (verbatim)

```json
{
  "name": "brace-expansion",
  "description": "Brace expansion as known from sh/bash",
  "version": "5.0.6",
  "files": [
    "dist"
  ],
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/commonjs/index.d.ts",
        "default": "./dist/commonjs/index.js"
      }
    }
  },
  "type": "module",
  "scripts": {
    "preversion": "npm test",
    "postversion": "npm publish",
    "prepublishOnly": "git push origin --follow-tags",
    "prepare": "tshy",
    "pretest": "npm run prepare",
    "presnap": "npm run prepare",
    "test": "tap",
    "snap": "tap",
    "format": "prettier --write .",
    "benchmark": "node benchmark/index.js",
    "typedoc": "typedoc --tsconfig .tshy/esm.json ./src/*.ts"
  },
  "devDependencies": {
    "@types/brace-expansion": "^1.1.2",
    "@types/node": "^25.2.1",
    "mkdirp": "^3.0.1",
    "prettier": "^3.3.2",
    "tap": "^21.6.2",
    "tshy": "^3.0.2",
    "typedoc": "^0.28.5"
  },
  "dependencies": {
    "balanced-match": "^4.0.2"
  },
  "license": "MIT",
  "engines": {
    "node": "18 || 20 || >=22"
  },
  "tshy": {
    "exports": {
      "./package.json": "./package.json",
      ".": "./src/index.ts"
    }
  },
  "main": "./dist/commonjs/index.js",
  "types": "./dist/commonjs/index.d.ts",
  "module": "./dist/esm/index.js",
  "repository": {
    "type": "git",
    "url": "git+ssh://git@github.com/juliangruber/brace-expansion.git"
  }
}
```

**Analysis of the `prepare` script and other hooks:**

- `"prepare": "tshy"` — the brief's red flag. `tshy` is a [TypeScript hybrid package builder](https://github.com/isaacs/tshy) that compiles `src/*.ts` into the `dist/esm` and `dist/commonjs` outputs. **`prepare` in npm has narrow trigger scope**: it runs (a) when the package is being prepared for `npm publish` by the maintainer, and (b) when the package is installed as a **git dependency** (so the consumer can build it from source). It does **not** run when the package is installed from the npm registry, which is what `pnpm install --frozen-lockfile` does here. The shipped tarball already contains the pre-built `dist/` (note `"files": ["dist"]`), so consumers never invoke `tshy`.
- `preversion`, `postversion`, `prepublishOnly`, `pretest`, `presnap` — all maintainer-side release/test scripts. Not triggered by a consumer install.
- No `preinstall`, `install`, or `postinstall` hook anywhere in the `scripts` block.
- `dependencies` is a single entry: `balanced-match@^4.0.2`. `balanced-match` is a 28-line pure-JS function with no install hooks. Confirmed in `node_modules/.pnpm/balanced-match@4.0.4/`.
- The package is a dual-format ESM/CJS module (`"type": "module"` with CJS shims via `exports.require`). This is the modern packaging style and is fine for all of the actual consumers in this tree (ESLint, Vite, Jest tooling, etc.).
- License unchanged (MIT). Engines requirement (`node: 18 || 20 || >=22`) is satisfied by the repo's Node 22 target.

**Verdict on `prepare`:** Standard, publish-time build hook (`tshy`). Does not execute on `pnpm install`, was not observed to execute during the install I ran, and would not execute even in the worst case because pnpm 10 sandboxes lifecycle scripts behind `pnpm.onlyBuiltDependencies`.

### 3c. For completeness — `brace-expansion@1.1.14` and `@2.1.0`

`1.1.14` is the classic CommonJS-only 1.x package with no install scripts (`scripts` block is only `test`, `gentest`, `bench`). Depends on `balanced-match@^1.0.0` and `concat-map@0.0.1`. `2.1.0` is unchanged by this PR and is structurally identical to `1.1.14` minus `concat-map`. Both are benign.

---

## Section 4 — Lint, test, build on the new lockfile

Run from the worktree (`../ProjectOperations-dependabot-207`) after `pnpm install --frozen-lockfile` plus a `pnpm prisma:generate` (pnpm 10 blocks Prisma's postinstall by default, so the typed client must be generated explicitly before any test that imports `@prisma/client` — this is not specific to the PR and would also be needed on `main` in this sandbox).

```
$ pnpm --filter @project-ops/api lint 2>&1 | tail -5

> @project-ops/api@0.1.3 lint /sessions/.../apps/api
> eslint "src/**/*.ts"

EXIT=0
```

```
$ pnpm --filter @project-ops/web lint 2>&1 | tail -5

> @project-ops/web@0.1.3 lint /sessions/.../apps/web
> eslint "src/**/*.{ts,tsx}"

EXIT=0
```

```
$ pnpm --filter @project-ops/api test 2>&1 | tail -5
PASS src/modules/assets/assets.service.spec.ts

Test Suites: 1 skipped, 60 passed, 60 of 61 total
Tests:       6 skipped, 607 passed, 613 total
Snapshots:   0 total
Time:        18.451 s
```

```
$ pnpm --filter @project-ops/web test 2>&1 | tail -5
 Test Files  12 passed (12)
      Tests  156 passed (156)
   Start at  23:54:25
   Duration  2.18s
```

```
$ pnpm --filter @project-ops/web build 2>&1 | tail -10
dist/manifest.webmanifest                            0.48 kB
dist/index.html                                      0.76 kB │ gzip:   0.41 kB
dist/assets/index-B-CWV0Sp.css                     153.75 kB │ gzip:  23.37 kB
dist/assets/workbox-window.prod.es5-BIl4cyR9.js      5.76 kB │ gzip:   2.37 kB
dist/assets/index-Begm-wWN.js                    1,933.87 kB │ gzip: 502.49 kB
✓ built in 3.92s

PWA v1.2.0
mode      generateSW
precache  11 entries (2047.76 KiB)
files generated
  dist/sw.js
  dist/workbox-eb69e46a.js
```

| Check | Result | Matches baseline? |
| --- | --- | --- |
| API lint | clean (exit 0) | yes |
| Web lint | clean (exit 0) | yes |
| API tests | 607 passed / 6 skipped / 613 total | **yes (exact match)** |
| Web tests | 156 passed | **yes (exact match)** |
| Web build | succeeded; PWA generated; identical bundle structure | yes |

The single pre-existing chunk-size warning (`index-*.js` > 500 kB) is unchanged from `main`; it predates this PR.

---

## Section 5 — Cleanup

```
$ git worktree remove ../ProjectOperations-dependabot-207
fatal: cannot remove a locked working tree, lock reason: initializing

$ git worktree remove ../ProjectOperations-dependabot-207 -f -f
error: failed to delete '.git/worktrees/ProjectOperations-dependabot-207':
       Operation not permitted

$ ls ../ProjectOperations-dependabot-207
ls: cannot access '../ProjectOperations-dependabot-207': No such file or directory

$ git worktree list
/sessions/.../ProjectOperations2                a2eaf09 [main]
/sessions/.../ProjectOperations-dependabot-207  c485f1c (detached HEAD) locked
```

**State after cleanup attempt:**

- ✅ The worktree's working directory (`../ProjectOperations-dependabot-207`) is gone — confirmed via `ls`.
- ✅ Main repo is on `main`, HEAD is `a2eaf09`, `git status` is clean, and `pnpm-lock.yaml` / `package.json` on `main` are unmodified.
- ✅ The `dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df` branch still exists on origin (GitHub) and as a local tracking ref. Untouched.
- ⚠️ The bookkeeping directory `.git/worktrees/ProjectOperations-dependabot-207/` is still present in `.git`. The Linux sandbox cannot unlink files inside it because the `.git` tree is on the Windows mount and the underlying ACL only permits write from the Windows side. `git worktree list` therefore still lists the entry as `(detached HEAD) locked` even though the working directory is gone.

**Manual finish (Marco — run from PowerShell on Windows):**

```powershell
cd C:\ProjectOperations2
Remove-Item -Recurse -Force .git\worktrees\ProjectOperations-dependabot-207
git worktree prune
git worktree list   # should show only the main checkout
```

This is one PowerShell command's worth of mop-up; it does not affect the merge decision.

---

## Section 6 — Verdict

### (a) Is `brace-expansion` exclusively a build-time / dev dep?

**Yes.** Every consumer chain ends in lint tooling (ESLint, typescript-estree), build tooling (Vite, Vitest, NestJS CLI, fork-ts-checker, Prisma generator), or test infrastructure (`test-exclude`, `filelist`, `readdir-glob`). No file under `apps/api/src/**` imports `brace-expansion` directly or transitively at runtime — it is purely a build-graph dependency.

### (b) Does the prepare script do anything beyond standard package setup?

**No.** The `prepare: tshy` script in `brace-expansion@5.0.6` is a standard TypeScript-hybrid build that produces the `dist/esm/` and `dist/commonjs/` outputs the package ships. It runs only at maintainer publish time or for git-tarball installs; it does **not** execute during `pnpm install --frozen-lockfile` of a registry release. The Section 3 install output confirms `brace-expansion` did not appear in pnpm's list of packages with ignored install hooks — i.e. pnpm did not even see a hook to ignore. Additionally, pnpm 10's default `onlyBuiltDependencies` policy would block any install-time hook from running even if one were present, providing defense in depth.

### (c) Do all tests + lint + build pass with the new version?

**Yes.** API lint clean, web lint clean, API tests 607 passed / 6 skipped (exact match to baseline), web tests 156 passed (exact match), web build succeeds with the expected PWA artifacts. No regression.

### Final recommendation

**MAIN can safely merge PR #207.** All three gates pass. Two additional points worth flagging on the PR before approval:

1. **Correct the PR description language** if it claims a 1.1.13 → 5.0.5 four-major-version bump. The actual change is two patch bumps (1.1.13 → 1.1.14 and 5.0.5 → 5.0.6) on already-present lines. The risk story is much simpler than the description suggested.
2. **The "Option A — pin to 2.0.2" fallback in the brief is not needed.** Pinning would force-downgrade the 5.x line that is already in `main` via `minimatch@10.2.5` (which itself ships under ESLint 10 and Vite/Vitest's dep graph). Don't pin.

---

## Investigation artifact map

| Artifact | Where |
| --- | --- |
| This report | `docs/diagnostics/2026-05-19-dependabot-207/REPORT.md` |
| Dependabot branch on origin | `dependabot/npm_and_yarn/npm_and_yarn-f3ab4791df` (kept) |
| Local worktree directory | removed |
| Local worktree bookkeeping | `.git/worktrees/ProjectOperations-dependabot-207/` (PowerShell mop-up required — see Section 5) |
| `main` `pnpm-lock.yaml` / `package.json` | unmodified |
