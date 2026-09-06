# Station 06 — 2026-09-06 23:45Z — #1740 is red because puppeteer 25 is ESM-only, and the smoke test cannot clear production

## GROUND

PR #1740 head `bd77988b`, branch `deps/puppeteer-25-remove-extract-zip`, labelled `do-not-merge`.
Interactive run, Marco present; he asked for a verdict on #1740 and then for the fix staged.
Station 06 designs and STAGES; it never arms and never merges.

## WHAT I MEASURED

**Three checks red. Only ONE is a defect.**

| check | result |
|---|---|
| `API — lint, test, compliance smoke` | **FAILURE** — `Test Suites: 2 failed, 282 passed` / `Tests: 5 failed, 3977 passed` |
| `PR gates — diff checks` | fails on **`CP-26 do-not-merge`** only. CP-11, CP-12, CP-13, CP-17, CP-23, CP-24, CP-25 all **PASS**; CP-09/10 scope **SKIP** (opt-in) |
| `Approval receipt (CP-26)` | the same gate, by design |

The failure signature: `Jest failed to parse a file … SyntaxError: Unexpected token 'export'`,
`PdfRenderError: PDF rendering failed`, in `pdf-renderer.integration.spec.ts`.

Cause, read from source: `pdf-renderer.service.ts:123` loads puppeteer with
`require("puppeteer")`. puppeteer 23 shipped a cjs/esm split; **25 is ESM-only** — which is why its
CLI moved from `lib/esm/puppeteer/node/cli.js` to `lib/puppeteer/node/cli.js`. It works at runtime
only because **Node ≥22.12 supports `require()` of a synchronous ESM graph**, which is exactly why
`puppeteer@25.9.0` declares `engines: node >=22.12.0`. Jest substitutes its own CommonJS loader,
which does not implement that, and `apps/api/jest.config.ts` declares `moduleNameMapper` but **no
`transformIgnorePatterns`**.

The bump itself is sound: the lockfile deletes `extract-zip`'s package entry and its snapshot, and
takes −457 lines with it — the whole `proxy-agent` / `socks` / `pac-*` / `get-uri` / `basic-ftp` /
`unbzip2-stream` / `tar-fs` / `bare-*` tail.

## WHAT CHANGED

Nothing in the repository. Staged: `fix-1740-jest-cannot-parse-puppeteer-25-esm-HOLD.md`
(**ADMIT, size 3**, `fixes_pr: 1740`) and this breadcrumb.

## FINDINGS

1. **#1740 is red for a real, structural reason.** Not flaky, not infrastructure. **ACTIONED** —
   fix-forward staged, targeting the existing branch, no new PR, label untouched.

2. **The PR's own evidence cannot clear production, and this is the important one.** The smoke test
   rendered a 38,333-byte PDF on Marco's Windows laptop. The mechanism it depends on —
   `require(esm)` — is **Node-version-gated**. CI and the deploy build pin `node-version: '22'`, but
   **the App Service runtime Node version is pinned nowhere in this repo** — no `linuxFxVersion`, no
   `WEBSITE_NODE_DEFAULT_VERSION`. On Node 20, or 22.0–22.11, `require("puppeteer")` throws and PDF
   rendering breaks in production. **ESCALATED** — Azure is Marco's alone; no agent may check it.

3. **My DEPS-S2 prompt under-scoped.** It scoped the manifests and workflows. The implementer had
   to also fix `ensure-puppeteer-chrome.mjs:72` (same stale CLI path) and add `await` at
   `pdf-renderer.service.ts:138` (`executablePath()` became async). Both were necessary and correct;
   the diff is right and the prompt was wrong. **ACTIONED** — the lesson is that a dependency-MAJOR
   prompt must scope for *call sites of the bumped API*, not just `package.json` and the lockfile.

4. **`ci.yml` was in scope and correctly left alone.** `ci.yml:94` invokes the puppeteer *bin*
   (`pnpm … exec puppeteer browsers install chrome`), which pnpm resolves from `package.json`, so no
   hardcoded path needed changing. **ACTIONED** — recorded so its absence from the diff is not later
   read as an omission.

5. **`lint-prompt.mjs` returned `REJECT [FIX_TARGET_UNKNOWN] (spawnSync gh ENOENT)` — the instrument,
   not the prompt.** `gh` is not on PATH inside the Cowork Linux VM. Re-linted from Windows, where
   `gh version 2.90.0` is present: **ADMIT (size 3)**. DOCTRINE already warns that lint-prompt
   reports REJECT when `gh` is merely missing. **ACTIONED** — fix-lane prompts must be linted where
   `gh` lives.

## WHAT I DID NOT DO

- I did not arm the fix, did not merge, did not touch the `do-not-merge` label.
- I did not check the App Service Node version, and the staged prompt forbids the implementer from
  touching Azure, `deploy.yml` or `ci.yml`.
- I did not revert the bump. `extract-zip` has no patched version and never will; the bump is the
  only remedy.
- I did not choose the fix route for the implementer beyond naming the cheapest one — and I required
  that if it moves the service to `await import()`, it must SAY the runtime Node floor changed
  rather than slipping a behaviour change through as a test fix.
- I did not let "make the tests pass" mean skipping them: the prompt forbids skipping, deleting or
  loosening any failing assertion.
