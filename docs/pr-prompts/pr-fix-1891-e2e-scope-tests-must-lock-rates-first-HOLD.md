---
premise: "git fetch -q origin worktree-agent-ab8ed118705aa1958 && ! git show origin/worktree-agent-ab8ed118705aa1958:tests/e2e/pr-acceptance/api-helpers.ts | grep -q 'ensureRatesLocked'"
premise_means: >-
  PR #1891 (draftpanel S1) gates the Scope of Works tab on a TenderRateSet existing for the
  tender - by design. The PR-acceptance e2e suite still opens /tenders/<T260520-ACME-Rev1>/scope
  on the seeded template tender, which has no rate set, so the batch3 scope specs (scope-items,
  scope-cutting, scope-waste) hit the "Lock rates before pricing" empty state and time out at
  1.0 min each on EVERY head of the branch since 10:27Z (runs 34751910953, 34760711843,
  34763258081 - each cut off by the next rebase or the 60-min job timeout, so no run ever
  reached its summary). Nothing in the suite locks rates first.
fixes_pr: 1891
scope:
  - tests/e2e/pr-acceptance/api-helpers.ts
  - tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
  - tests/e2e/pr-acceptance/batch3-scope-cutting.spec.ts
  - tests/e2e/pr-acceptance/batch3-scope-waste.spec.ts
  - tests/e2e/pr-acceptance/batch8-misc.spec.ts
  - apps/api/src/modules/tendering/tendering.service.ts
done_when: >-
  git merge-base --is-ancestor origin/main HEAD && pnpm --filter @project-ops/api lint && pnpm
  exec playwright test tests/e2e/pr-acceptance/batch3-scope-items.spec.ts
  tests/e2e/pr-acceptance/batch3-scope-cutting.spec.ts tests/e2e/pr-acceptance/batch3-scope-waste.spec.ts
  tests/e2e/pr-acceptance/batch8-misc.spec.ts tests/e2e/pr-acceptance/batch7-universal-timeline.spec.ts
  --project=chromium --workers=1
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
module: tendering
---

# Repair PR 1891 - the e2e scope specs must lock rates before they open the Scope tab

**Do this ON PR #1891's existing branch `worktree-agent-ab8ed118705aa1958`. Do NOT open a new
PR.** The gate is correct; the acceptance suite predates it.

## FIRST: re-verify against the CURRENT head

Run the API + web locally against a seeded database (`pnpm seed`), then
`pnpm exec playwright test tests/e2e/pr-acceptance/batch3-scope-items.spec.ts --project=chromium --workers=1`.
Read the failure: expected `data-item-description` rows / the WBS table on
`/tenders/${TEMPLATE_TENDER_ID}/scope`, got the `scope-cards-rates-gate` empty state ("Lock rates
before pricing"). If the failure is something else, say so plainly and fix THAT instead.

## The fix

1. In `tests/e2e/pr-acceptance/api-helpers.ts` add and export
   `ensureRatesLocked(request, token, tenderId)`: `GET /tenders/:id/rate-set`; if it is null,
   `POST /tenders/:id/rate-set/lock` (the endpoint #1891 relies on). Idempotent - a second call
   is a no-op. Use the same `apiFetch`/`apiToken` shape the file already uses.
2. Call it once per spec file for `TEMPLATE_TENDER_ID` (a `test.beforeAll` with `request`, or
   at the top of the existing `beforeEach`, whichever the file already uses) in
   `batch3-scope-items`, `batch3-scope-cutting`, `batch3-scope-waste` and `batch8-misc` - the
   four specs that navigate to the Scope tab. Do not weaken any assertion; the specs must see
   the SAME rows they saw before the gate.
3. Then run the five spec files in `done_when`. If `batch7-universal-timeline` (job status
   changes - nothing to do with tenders) or anything else still times out with the scope specs
   green, that is the cascade from the timed-out scope tests and needs no change; if it fails
   on its own with the scope specs green, read the failure and fix it inside `scope`.
4. Only touch `tendering.service.ts` if `POST /tenders/:id/rate-set/lock` or the first
   SUBMITTED transition throws for the seeded tender - and then only the guard around
   `rateSetService.lock` (never the gate, never `ratesSnapshotAt`).

Hex literals: none may be introduced (the ratchet counts the whole file).

## Verify, then push

1. The five spec files in `done_when` are green locally with `--workers=1`.
2. `pnpm --filter @project-ops/api lint` and `pnpm --filter @project-ops/api test -- tendering.service`.
3. The commit message must not put fix/fixes/close/closes/resolve/resolves immediately before
   `#1891` (the squash message is built from every commit message).
4. Push. Do not open a PR - #1891 is the PR.

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
In the fix lane "OPEN THE PR" is already satisfied: **#1891 is the PR** - push to its branch and
do not open another. There is no human in this run. **Finishing the work and then asking for
permission is indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. If the premise is already false on the branch, say `NO-OP: already fixed` and exit.
- Touch only what the fix requires; the six files in `scope` are the ceiling. No seed changes
  (`seed-reference.ts` is CP-23 class and out of bounds).
- Never add or remove a label; never merge the PR.
