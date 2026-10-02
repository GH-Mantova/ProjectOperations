---
premise: '! grep -q "REVIEW_PRIORITY_WATCHER_PRS_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  The watcher reviews every open PR through ONE review lane, in arrival order. Only reviews of PRs
  the watcher itself opened are ever read by a machine: verdictApproves has one call site, inside
  waitForPolicyMerge, which runs only for watcher-opened PRs. So a review that decides an auto-merge
  can queue behind reviews that cannot affect one. MEASURED 2026-10-02 at origin/main c145476c:
  computeQueueInsertIndex orders fix jobs, then all review jobs together, then ordinary jobs. The
  watcher keeps no record of which PRs it opened beyond a log line ("opened PR #N, policy=...").
  Sources: needs-marco/rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md, marker
  REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1 in DOCTRINE section 10.3; and
  needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md (a review started 93.5 min
  after its PR opened, after the merge window had closed).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pr-watcher/__tests__/*.mjs" &&
  grep -q "REVIEW_PRIORITY_WATCHER_PRS_V1" scripts/pr-watcher/index.mjs &&
  test -f scripts/pr-watcher/__tests__/review-priority.test.mjs
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/review-priority.test.mjs
  - scripts/pr-watcher/__tests__/fix-lane.spec.mjs
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Queue ordering and one persisted set. Reverting restores arrival-order reviews; the extra state
  key is ignored by the old code.
escalates: true
module: watcher
---

# Watcher: reviews that decide an auto-merge go to the front of the review queue

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-02)

**Keep reviewing every PR**, because Marco reads those verdicts. **Put watcher-opened PRs' reviews
first.** Nothing stops being reviewed.

**Scope honesty.** This fixes queue ORDER. It does not fix the separate case where the policy wait
itself occupies the worker (escalation `tests-docs-lane-starves-its-own-review-job`, item 16 of the
2026-09-24 handover to Station 06). That is still Marco's call: retire the lane, or fix the starvation. Say so in
the PR body, and do not attempt it here.

Tag the new code with `REVIEW_PRIORITY_WATCHER_PRS_V1`.

## What to build in `scripts/pr-watcher/index.mjs`

1. **Remember which PRs the watcher opened.** Where the build path logs
   `opened PR #${prNumber}, policy=...`, add `prNumber` to a persisted set
   `watcherOpenedPrs`. Persist it in the same reviewed-set state file under a new key
   (`{"reviewed":[...], "watcherOpened":[...]}`). `loadReviewedSet` must still read a file that has
   only `reviewed`. Keep the set bounded: drop numbers older than the 200 most recent.
2. **A new tier in `computeQueueInsertIndex`.** The incoming item gains `isPriorityReview`. The
   order becomes: fix jobs → **priority reviews** → other reviews → ordinary jobs, each tier in
   arrival order as today. Keep the function pure and exported. Callers that do not pass the new
   field must behave exactly as before.
3. **`enqueue`** sets `isPriorityReview` for a review job whose PR number (parsed from
   `rev-<N>-ready.md`, using the same parser `reviewJobPrNumber` already uses) is in
   `watcherOpenedPrs`. The `queueMeta` built for existing items must carry the same flag, so an
   already-queued priority review keeps its place.
4. Log `queue: rev-N-ready.md jumped ahead of K review(s) (watcher-opened PR)` when it moves.

`pr-verdict-head-sha-anchor` also edits this file (verdict SHA plus re-review). If it has merged,
rebase onto it. Its re-review prompts are for watcher-opened PRs, so they get priority through this
same path with no extra code.

## Tests

- New `__tests__/review-priority.test.mjs`:
  1. `computeQueueInsertIndex` with a fix job, two ordinary reviews and an incoming priority review
     inserts it after the fix job and before both reviews.
  2. Two priority reviews keep arrival order.
  3. An incoming ordinary review still lands after the priority reviews.
  4. A state file with only `reviewed` loads, and `watcherOpened` round-trips.
  5. **Negative control:** with no `isPriorityReview` field anywhere, every insertion index equals
     today's.
- `fix-lane.spec.mjs` stays green. Touch it only if a fixture needs the new field, and say so in the
  PR body.

`escalates: true`: it changes the watcher's queue. The PR opens labelled `do-not-merge`, and Marco
releases it.
