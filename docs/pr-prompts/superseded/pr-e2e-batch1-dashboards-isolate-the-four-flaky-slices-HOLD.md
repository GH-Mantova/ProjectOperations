---
premise: '! grep -q "BATCH1_DASHBOARD_SLICES_ISOLATED_V1" tests/e2e/pr-acceptance/batch1-dashboards.spec.ts'
premise_means: >-
  SLICE 4, 5, 6 and 7 of batch1-dashboards.spec.ts share the dashboard list and sidebar with no
  isolation between them, and fail as a cluster. MEASURED 2026-09-25 by Station 00: the four failed
  together, in the same order, on #2184 at 00:51Z and on #2183 at 00:53Z and again at 01:29Z - two
  unrelated diffs, neither touching this file - while the same commits had PASSED the same workflow
  at 00:37Z and two sibling branches passed in the 00:51Z batch. #2184 cleared on one re-run; #2183
  did not clear on two.
scope:
  - tests/e2e/pr-acceptance/batch1-dashboards.spec.ts
  - docs/pr-prompts/superseded/pr-e2e-batch1-dashboards-isolate-the-four-flaky-slices-HOLD.md
done_when: >-
  grep -q "BATCH1_DASHBOARD_SLICES_ISOLATED_V1" tests/e2e/pr-acceptance/batch1-dashboards.spec.ts &&
  ! test -f docs/pr-prompts/pr-e2e-batch1-dashboards-isolate-the-four-flaky-slices-HOLD.md
size: 2
gate_allow: none
seed_only: false
escalates: false
module: e2e
---

# e2e: isolate the four batch1-dashboards SLICEs that fail as a cluster

Staged by Station 00 on 2026-09-25 from its own 01:14Z run and the 01:55Z correction to it. This is
`tests/**` only, so it is inside the `tests-docs` auto-merge policy and needs no human release.

## What is measured, and what is NOT

**Measured.** The four tests are `SLICE 5` (line 262), `SLICE 7` (350), `SLICE 4` (398) and `SLICE 6`
(468). They fail together and in that order. SLICE 5 fails with
`locator.click: Test timeout of 60000ms exceeded`; the other three with
`expect(locator).toBeVisible() failed / element(s) not found`. Every one of the four independently
purges `Remove <prefix>-` residue from the sidebar and then creates a dashboard named
`<prefix>-${Date.now()}`, so the dashboard NAMES cannot collide.

**Measured, and it is a trap to avoid.** The job's Postgres dump carries
`ERROR: duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"`
timed to three of the four failures. **That is not the cause.**
`apps/api/src/modules/platform/user-dashboards.service.ts` provokes and catches that error on purpose
and recovers on P2002 - its own comment says so. Do not "fix" the constraint, the slug derivation, or
the service. If your change touches `apps/api/**` at all you have taken the wrong branch, and this
prompt's `scope` deliberately does not allow it.

**Measured, and also not the cause.** The e2e workflow supplies literal placeholder secrets
(`JWT_ACCESS_SECRET: replace-me-access`). Station 00 hypothesised that #2183's production fail-fast
was rejecting them and refuted it with both controls: no refusal message, no boot failure, 135+ tests
passing in the same job. Do not chase the auth config.

**NOT measured - this is yours to establish first.** Which piece of shared state the four contend
over. The candidates the evidence points at are the dashboard LIST and the sidebar the four share, not
the per-dashboard names.

## What to do

**1. Reproduce the ORDER before you change anything.** Run the four together, repeatedly, and get a
failure locally or in a scratch CI run:

```
pnpm playwright test tests/e2e/pr-acceptance/batch1-dashboards.spec.ts --repeat-each=5 --workers=1
```

A fix to a flaky test you have not seen fail is a mask, not a fix (DOCTRINE section 8.2). **If you
cannot reproduce it after two honest attempts, say so plainly, do not loop, and do not "harden" the
selectors on speculation** - write what you tried into the PR body and stop. That is a correct
outcome for this prompt.

**2. Isolate the shared state you identified.** Prefer, in this order:

- give each of the four its own `test.describe.serial` block or its own fixture so one test's residue
  cannot reach the next;
- make each test's residue purge assert it reached zero BEFORE creating, rather than looping and
  continuing;
- make each test navigate to a known dashboard-list state at its start instead of inheriting whatever
  the previous test left.

**Do NOT** add `test.retry`, raise the global timeout, mark any of the four `test.skip` or
`test.fixme`, or weaken an assertion. Those hide the four SLICEs' coverage, which is the only
coverage of a dashboard filter bar, a template instantiation, a gallery add and an export download.

**3. Tag it.** Put `BATCH1_DASHBOARD_SLICES_ISOLATED_V1` in a comment at the isolation site so the
premise and `done_when` can see it.

**4. Prove it.** Re-run the repeat-each command and report the pass count in the PR body. State the
number of consecutive clean runs you achieved - and if it is small, say so rather than calling it
fixed.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Work in your own disposable worktree off `origin/main`. `pnpm build` and `pnpm lint` must pass before
the PR. Retire this prompt in the same PR by `git mv`-ing it to `docs/pr-prompts/superseded/` - its own
path is in `scope` for exactly that reason, and the `done_when` above checks it is gone.

`escalates: false` and the diff is `tests/**` only, so this is eligible for the `tests-docs`
auto-merge policy. **Keep it that way**: one path outside `tests/` puts the PR in front of Marco and
turns a self-landing fix into another item in a queue that is already four deep behind his label.
