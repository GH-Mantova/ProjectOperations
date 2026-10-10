VERDICT: FIX-FORWARD

## Scope compliance

**In scope:**
- `scripts/pr-watcher/index.mjs` — added module-level `watcherOpenedPrs`/`watcherOpenedOrder` set + order array; added `isPriorityReview` tier to `computeQueueInsertIndex`; updated `enqueue` to detect and promote watcher-opened PRs to priority tier; added jump-ahead logging; added new exports `readReviewedStateFile`, `writeReviewedStateFile`, `loadWatcherOpenedSet`; added `recordWatcherOpenedPr` async helper; startup wiring in `main()` to load persisted state.
- `scripts/pr-watcher/__tests__/review-priority.test.mjs` — new test file with 6 unit tests covering priority tier insertion, arrival ordering, backward compatibility, and negative controls (all passing per PR body).
- Existing `fix-lane.spec.mjs` — stays green (no edits needed, verified via test run in PR body).

**Out of scope:**
- None detected in the diff. The work stays within `scripts/pr-watcher/` and its tests.

## Self-verification claims

- [green] `pnpm build` passes (per PR body)
- [green] `pnpm lint` passes (per PR body; 1 pre-existing warning in tenant-scoping.middleware.ts noted)
- [green] `node --test scripts/pr-watcher/__tests__/fix-lane.spec.mjs` — 13/13 pass
- [green] `node --test scripts/pr-watcher/__tests__/review-priority.test.mjs` — 6/6 pass
- [green] `grep -q "REVIEW_PRIORITY_WATCHER_PRS_V1" scripts/pr-watcher/index.mjs` — marker found in commit message, code comments, and exports
- [green] `test -f scripts/pr-watcher/__tests__/review-priority.test.mjs` — file exists

## Risks Marco should know

1. **Merge conflict with main:** The PR mergeStateStatus is CONFLICTING. Commit 29a26eff (VERDICT_HEAD_SHA_ANCHOR_V1 / PR #2221) also edited `scripts/pr-watcher/index.mjs` and is now on main ahead of this PR's base (5287a7de). The conflict must be resolved before merge. The watcher code appears textually non-overlapping (29a26eff modifies verdict-recording; this PR adds watcher-opened tracking), but the file structure has moved forward.

2. **Atomic state file persistence:** The PR writes both `reviewed` and `watcherOpened` keys atomically to `.reviewed-prs.json`. The backward-compat design is sound (legacy files with only `reviewed` key load fine), and the new `recordWatcherOpenedPr` function persists whenever the reviewed set is saved. Risk is low if the reviewed-set save path is stable — no new failure modes introduced.

3. **Scope honesty honored:** The PR body explicitly notes that this fixes queue **order only** and does NOT address the separate case where the policy wait itself occupies the worker (escalation `tests-docs-lane-starves-its-own-review-job`). That is Marco's call. This is the correct scope boundary.

## Recommendation

Rebase this PR onto the current main (or the tip of the queue once #2221 merges), resolve the merge conflict by keeping both the priority-review tier logic and the verdict-SHA anchor work, and re-run `pnpm build && pnpm lint && node --test` to confirm the merge is clean. The work is otherwise complete and test-verified.

---

**Originating prompt:** `C:\ProjectOperations2\docs\pr-prompts\processed\pr-watcher-review-priority-ready.md`

**Commit SHA:** 60139fb8aeb6c36e9592f1531eeb22e33d245318

**Files checked:** scripts/pr-watcher/index.mjs (149 changes: +132/-17), scripts/pr-watcher/__tests__/review-priority.test.mjs (139 additions)
