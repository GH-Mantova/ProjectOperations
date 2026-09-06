---
premise: '! grep -q ESM_PUPPETEER apps/api/jest.config.ts'
premise_means: >-
  Jest cannot load puppeteer 25 and nothing in the API's jest config accommodates it. MEASURED
  2026-09-06 against PR #1740 head bd77988b - the job "API - lint, test, compliance smoke" FAILS
  with "Jest failed to parse a file ... SyntaxError: Unexpected token 'export'" and
  "PdfRenderError: PDF rendering failed"; Test Suites 2 failed / 282 passed, Tests 5 failed / 3977
  passed. Cause - pdf-renderer.service.ts:123 loads puppeteer with require("puppeteer"), puppeteer
  23.x shipped a cjs/esm split but 25.x is ESM-ONLY (which is why its CLI moved from
  lib/esm/puppeteer/node/cli.js to lib/puppeteer/node/cli.js - there is no longer a split), it works
  at runtime only because Node >=22.12 supports require() of a synchronous ESM graph (exactly why
  puppeteer@25.9.0 declares engines node >=22.12.0), and Jest substitutes its own CommonJS loader
  which does not implement that. apps/api/jest.config.ts declares moduleNameMapper but NO
  transformIgnorePatterns, so node_modules is never transformed.
fixes_pr: 1740
scope:
  - apps/api/jest.config.ts
  - apps/api/src/modules/pdf-rendering/__tests__/pdf-renderer.integration.spec.ts
  - apps/api/src/modules/pdf-rendering/__tests__/pdf-renderer.launch.spec.ts
  - apps/api/src/modules/pdf-rendering/pdf-renderer.service.ts
done_when: >-
  grep -q ESM_PUPPETEER apps/api/jest.config.ts && pnpm --filter @project-ops/api test && pnpm build && pnpm lint
size: 3
gate_allow: none
seed_only: false
escalates: true
---

# FIX-1740: Jest cannot parse puppeteer 25, because 25 is ESM-only

**Grounded against PR #1740 head `bd77988b`, measured 2026-09-06 by station 06.**

`escalates: true` — this lands on a branch whose PR is labelled `do-not-merge`. **The label stays.**
Only Marco removes it (D34). Drive the branch green and stop.

## 🔴 FIRST: re-verify the failure on the CURRENT head

**Read the job log before you touch anything.** Errors drift. Open the latest run of
`API — lint, test, compliance smoke` on PR #1740, confirm the signature is still
`SyntaxError: Unexpected token 'export'` in the pdf-rendering suites, and **name the failing suites
from the log** — do not take the two spec paths in `scope` as fact. The log named
`pdf-renderer.integration.spec.ts` explicitly; the second failing suite was inferred, not read.
**If the signature has changed, fix what the log shows and say so in the PR body.**

## Fix ON the existing branch. Do NOT open a new PR.

The defect is in #1740's own diff, so it is corrected on `deps/puppeteer-25-remove-extract-zip`.
Commit and push to that branch. The existing PR picks it up.

## The diagnosis

| fact | evidence |
|---|---|
| the service uses a CommonJS require | `pdf-renderer.service.ts:123` — `const puppeteer = require("puppeteer")` |
| puppeteer 25 is ESM-only | its CLI moved from `lib/esm/puppeteer/node/cli.js` to `lib/puppeteer/node/cli.js`; the `esm` subtree is gone because the split is gone |
| it works at runtime anyway | Node ≥22.12 supports `require()` of a synchronous ESM graph — and `puppeteer@25.9.0` declares `engines: node >=22.12.0` |
| Jest does not | Jest substitutes its own CommonJS loader, which does not implement `require(esm)` |
| nothing transforms it | `apps/api/jest.config.ts` sets `moduleNameMapper` but **no `transformIgnorePatterns`**, so `node_modules` is never transformed |

## Do

1. **Make Jest able to load puppeteer.** Cheapest contained route is `transformIgnorePatterns` in
   `apps/api/jest.config.ts` that stops excluding puppeteer (and, if the error cascades, its ESM
   dependencies — `chromium-bidi`, `modern-tar`, `yargs@18` are the likely ones; add only what the
   log actually demands, one at a time).
2. **Leave the literal token `ESM_PUPPETEER` in a comment in `apps/api/jest.config.ts`**, next to
   whatever you added, explaining in one or two lines why the exclusion exists. It is this prompt's
   `done_when` anchor and the note the next person needs when they wonder why puppeteer is
   transformed. **Leave it whichever route you take.**
3. **If transforming proves slow or cascades badly, mocking the puppeteer module in the failing
   specs is an acceptable alternative** — but only where the spec's subject is *our* code
   (launch-option construction, error mapping). **Do not mock away the thing a test exists to
   exercise.** If a spec genuinely renders a PDF end to end, it must keep doing so; CI installs
   Chrome at `ci.yml:94`.
4. **State in the PR body which route you took and why**, with the timing cost if you transformed.

## 🔴 If you touch the service's loader, say what it costs

`await import("puppeteer")` instead of `require()` would also fix this, and would **remove the
runtime dependency on Node ≥22.12** — which is a real improvement, because the App Service runtime
Node version is pinned nowhere in this repo. But it changes when and how the module loads inside a
request path.

**You may take that route. You may not take it silently.** If you do, the PR body must say so
explicitly and state that the runtime Node floor changed, so Marco reviews it as a behaviour change
rather than a test fix.

## Do NOT

- Do NOT skip, `.skip`, delete or loosen an assertion in any failing test to reach green. A test
  removed to make a bump pass is the bump shipping unverified.
- Do NOT revert the puppeteer bump. It removes `extract-zip` (GHSA-jmr9-qjv8-65gv, alert #88), which
  has no patched version and never will. **The bump is the fix; this is the fix to the fix.**
- Do NOT open a new PR, and do NOT remove the `do-not-merge` label.
- Do NOT touch `deploy.yml`, `ci.yml`, App Service configuration, or anything Azure. The runtime
  Node version is Marco's to check and nobody else's.
- Do NOT change `package.json` versions or `pnpm-lock.yaml`.
- Do NOT touch `sot/`, `apps/web/`, or `prisma/`.
- Do NOT run `git checkout .`, `reset --hard`, `stash pop` or `git clean`.

## Verify

```
pnpm --filter @project-ops/api test        # 0 failed suites, 0 failed tests
pnpm build
pnpm lint
grep -q ESM_PUPPETEER apps/api/jest.config.ts
git diff --name-only                       # only paths from scope
```

Paste into the PR body: the failing suite names **as read from the job log**, the passing
`Test Suites:` / `Tests:` summary line after the fix, and the route you took.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Here the PR already exists: push to `deps/puppeteer-25-remove-extract-zip` and leave #1740 unmerged
with its label intact.
