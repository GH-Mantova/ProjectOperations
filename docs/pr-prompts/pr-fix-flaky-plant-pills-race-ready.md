---
premise: grep -q 'test.skip("plant pills' tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
premise_means: The batch3 "plant pills" e2e spec is still quarantined via test.skip; the underlying save/remove race is unfixed and the spec does not run, so tenders scope-item plant add/remove is unverified on every PR.
scope:
  - tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
  - apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx
done_when: pnpm build && ! grep -q 'test.skip("plant pills' tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Fix the plant-pills e2e race, then un-quarantine the spec

## Context (verified on origin/main)
`tests/e2e/pr-acceptance/batch3-scope-items.spec.ts:252` is `test.skip("plant pills: add a
plant cluster, set qty/days, remove it …")`. Quarantined 2026-07-20 (flaky, not broken).
`tendering-e2e` is a required check on serialised, strict `main`, so one flake blocks every
queued PR. Tracked as `flaky-batch3-plant-pills` in `docs/pr-prompts/BACKLOG.yaml`.

**Root cause (verified).** The scope-item UI (`apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx`)
autosaves every edit via `patchItem` → PATCH `/tenders/*/scope/items/*`, tracked by `pendingIds` /
`isPending`. In the test, the qty/days `blur()` fires `persistDims` → an in-flight PATCH; the test
then immediately clicks "Remove Plant 1", firing a second PATCH (`updatePlant(index, null)` →
`onPatch({ plantItems: next })`) whose `next` is computed from the possibly-stale `item.plantItems`.
The two racing PATCHes are the flake.

## What to build

1. **Wait on the PATCH explicitly (required mechanism).** In the spec, between the qty/days `blur()`
   and the "Remove Plant 1" click, `await page.waitForResponse(...)` for the scope-item PATCH the
   qty/days edit triggers — match `method === "PATCH"` and a URL matching `/tenders/*/scope/items/*`,
   and assert `response.ok()`. Use `page.waitForResponse` specifically — **not** the `···`/`isPending`
   locator, **not** `waitForTimeout`, **not** retries. The removal click must not fire until that PATCH
   resolves. Then remove the `test.skip` (make it a normal `test(...)`).

2. **Product-side fix if the race is genuinely in the app.** If, with evidence, you find the race is
   not merely test timing but a real product defect (e.g. the remove PATCH clobbers the qty/days save
   because `updatePlant` computes from stale `item.plantItems`, or two in-flight PATCHes are not
   serialised), you MAY fix it in `ScopeQuantitiesTable.tsx` (e.g. serialise/queue the patches, or
   compute `next` from the latest state) — `scope` allows it. Keep it minimal and behaviour-preserving;
   state clearly in the PR body what you changed and why.

## VERIFY (local proof of stability — do NOT bake this into CI)
Before removing the skip, prove it green locally across all three Playwright projects, repeated:
`pnpm exec playwright test tests/e2e/pr-acceptance/batch3-scope-items.spec.ts -g "plant pills" --project=chromium --project=firefox --project=webkit --repeat-each=5 --workers=1`
Then:
- `pnpm build`
- `! grep -q 'test.skip("plant pills' tests/e2e/pr-acceptance/batch3-scope-items.spec.ts`

The permanent CI check stays as-is (`tendering-e2e`, chromium). Do NOT add a permanent cross-browser
or `--repeat-each` step to `.github/workflows/playwright.yml` — that would slow every CI cycle, against
the goal of faster merges. The cross-project/repeat run above is your one-time confidence proof only.

## Do NOT
- Do NOT use `page.waitForTimeout(...)`/sleeps or Playwright `retries` — wait on the PATCH response.
- Do NOT weaken or change branch protection, or make `tendering-e2e` non-required.
- Do NOT edit `.github/workflows/**` or `playwright.config.ts` — scope is the spec (+ the component
  only if a real product race is proven).
- Do NOT touch any other test in the file.

## Merge
`escalates: false` — this is not a hard-stop; once `tendering-e2e` is green the pipeline auto-merges
normally.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — if the skip is already gone on `main`, say `NO-OP: <reason>`.
Never ask a question or "stand by" for approval; there is no human in a headless run.
Read the CI job log before diagnosing any failure.
