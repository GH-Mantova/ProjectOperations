---
premise: '! grep -q "RETIRE_TESTS_DOCS_LANE_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  The watcher's tests-docs auto-merge lane holds the single build worker while it waits for each
  docs/tests PR to auto-merge, and almost never merges anything itself. MEASURED 2026-10-03 from the
  watcher clone's logs (C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs, 2026-08-24 onward):
  240 `policy=tests-docs, waiting` events; the lane enabled auto-merge 4 times (3 on 2026-08-24, 1 on
  2026-10-02); 14 more PRs merged during a wait because a person or Station 00 merged them. At
  origin/main 8ed747e0, start-watcher.ps1 sets PR_WATCHER_AUTO_MERGE_POLICY to "tests-docs" when
  unset, and index.mjs routes every non-escalating build to `await waitForPolicyMerge(prNumber)`
  inside the build job. Sources: needs-marco/tests-docs-lane-merge-action-has-not-fired-since-2026-08-24.md
  and needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md (a review started 93.5 min
  after its PR opened, after the merge window had closed).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pr-watcher/__tests__/*.mjs" &&
  grep -q "RETIRE_TESTS_DOCS_LANE_V1" scripts/pr-watcher/index.mjs &&
  grep -q "RETIRE_TESTS_DOCS_LANE_V1" scripts/pr-watcher/start-watcher.ps1 &&
  test -f scripts/pr-watcher/__tests__/retire-tests-docs-lane.test.mjs &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/start-watcher.ps1
  - scripts/pr-watcher/README.md
  - scripts/pr-watcher/__tests__/retire-tests-docs-lane.test.mjs
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/STATION-CAPABILITIES.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  The tests-docs code path is kept, not deleted. Setting PR_WATCHER_AUTO_MERGE_POLICY=tests-docs
  restores the old behaviour exactly; reverting the PR restores the old default.
escalates: true
module: watcher
---

# Retire the docs/tests auto-merge lane: the watcher opens the PR and moves on

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

**Retire the lane.** The watcher opens the PR, routes it, and moves straight on to the next job.
Station 00 merges docs/tests PRs the same way it merges everything else. The point is to free the
single worker that every build and review queues behind.

Tag the changes with `RETIRE_TESTS_DOCS_LANE_V1`.

## Measure before you change (put this in the PR body)

Read `index.mjs` and list, for each value of `AUTO_MERGE_POLICY` (`off`, `tests-docs`, `all`) and
for `escalates: true`, which function runs after "opened PR", **whether it blocks the build job,
and for how long at most** (timeouts by name and value). In particular, answer these:

- Does the `off` path reach `waitForMerge`, and does that run `gh pr merge --auto`?
- Does `holdForMarco` return promptly, or does it wait?

**Do not assume. Quote the lines.** The rest of this prompt depends on the answer.

## The change

1. **A non-blocking default.** `off` must mean: no auto-merge is ever enabled by the watcher, and
   the build job **does not wait**. After the PR opens, apply exactly the routing a non-escalating
   PR gets today when it does not qualify for tests-docs, which is the `result.marco` branch: "stays
   for Marco", file the prompt to `processed/` with the PR number in its log, and run
   `syncMainQuietly`. Then return and `drain()`. If `off` currently reaches `waitForMerge` and its
   `--auto`, that is a latent hazard: make `off` stop before it, and say so in the PR body.
2. **`escalates: true` is unchanged** in what it labels and comments. If `holdForMarco` blocks the
   worker after labelling, make it return once the label and comment are applied (the wait adds
   nothing a later Station 00 run cannot see). Keep its spent/fix-lane logic exactly as it is.
3. **`start-watcher.ps1`:** the default becomes `off`:
   `if (-not $env:PR_WATCHER_AUTO_MERGE_POLICY) { $env:PR_WATCHER_AUTO_MERGE_POLICY = "off" }`,
   with a comment carrying the ruling's date. An explicit environment value still wins, so
   `tests-docs` remains available by setting it.
4. **Keep the tests-docs code**: `waitForPolicyMerge`, `verdictApproves`, the policy file
   classifier and their tests stay, unused by default. Deleting them would make the rollback a
   rebuild.
5. **Startup log:** print `merge-pol:   off (tests-docs lane retired 2026-10-03; set
   PR_WATCHER_AUTO_MERGE_POLICY=tests-docs to restore)`.

## Docs

- `scripts/pr-watcher/README.md`: the policy table and the "live" note say the lane is retired and
  how to restore it.
- `docs/pipeline/DOCTRINE.md`: the sentence "The auto-merge policy is live: `start-watcher.ps1:160`
  sets … `tests-docs`" becomes a dated retirement note. Where section 10.3 discusses lane
  starvation, add one line saying the cause is retired with the lane. Do not delete the historical
  measurements.
- `docs/pipeline/STATION-CAPABILITIES.md`: wherever it says the watcher auto-merges docs/tests PRs,
  correct it.
- Run `node scripts/pipeline/lint-station.mjs` and re-record canonical hashes with
  `--write-canonical` if it asks.

## Tests: `scripts/pr-watcher/__tests__/retire-tests-docs-lane.test.mjs`

Extract the post-PR routing decision into a pure exported function (for example
`postPrRoute({ policy, escalates })` returning `"route-and-return" | "hold-for-marco" |
"wait-tests-docs" | "wait-all"`), so it is testable without spawning anything:

1. `policy: "off"`, `escalates: false`: `route-and-return`.
2. `policy: "off"`, `escalates: true`: `hold-for-marco`.
3. `policy: "tests-docs"`: unchanged from today (`wait-tests-docs` for non-escalating).
4. **Negative control:** no input combination with `policy: "off"` returns a value that leads to
   `gh pr merge --auto`. Assert it for every combination.
5. A unit check that the default applied by `start-watcher.ps1` is `off`: a node test reading the
   file and matching the default assignment is acceptable.

Existing watcher suites stay green unchanged.

## Interplay with staged prompts (say this in the PR body)

`pr-verdict-head-sha-anchor` (#2206) and `pr-watcher-review-priority` (#2209) were written mainly
for this lane. Station 06 is withdrawing review-priority and slimming verdict-SHA in their staging
PRs. If either has already merged, this change still stands, and nothing in them conflicts with
`off`.

`escalates: true`: it changes how the watcher finishes every build. The PR opens labelled
`do-not-merge`, and Marco releases it.
