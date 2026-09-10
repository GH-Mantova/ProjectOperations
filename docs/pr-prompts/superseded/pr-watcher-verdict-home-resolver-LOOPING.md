---
premise: '! grep -q "VERDICT_HOME_RESOLVER_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  The watcher resolves a review verdict at exactly one path -
  `path.join(REPO_ROOT, "docs", "pr-reviews", "pr-<N>-review.md")` - at three independent call
  sites: the PR-comment mirror step, `verdictApproves` (the function the `tests-docs` auto-merge
  gate consults), and the review-job completion handler. `REPO_ROOT` is the watcher CLONE. On
  2026-09-05 the review job wrote NINE of the day's twelve verdicts into the DEV TREE instead, and
  a tenth (`#1679`) was moved out to `C:\po-watcher\verdicts-archive` by the five-minute archive
  sweep 16 seconds BEFORE the mirror step looked for it. All twelve logged
  `verdict mirror skipped: docs/pr-reviews/pr-N-review.md not found` and were then filed
  `[ok] -> processed/`, so a produced-and-discarded verdict is recorded as a successful review job.
  Because `verdictApproves` reads the same single path, a verdict that lands in another home cannot
  release the `tests-docs` lane, and the PR times out into
  `{"ok":false,"marco":true,"reason":"timeout waiting for green checks + MERGE verdict"}` - which
  RULE 2 then correctly forbids any station from clearing. Measured by Station 03,
  2026-09-05T23:0xZ, finding F1; `verdict mirror skipped` = 68 occurrences in `watcher-launch.log`
  against the positive control `verdict mirrored to PR` = 262.
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs
done_when: >-
  pnpm lint && node --test scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs && grep -q
  "VERDICT_HOME_RESOLVER_V1" scripts/pr-watcher/index.mjs
size: 4
gate_allow: none
seed_only: false
escalates: false
backfill: false
rollback_strategy: >-
  One new pure resolver function plus its call at three existing read sites, and one new test file.
  No schema, no migration, no data, no queue file, no label and no merge-policy change - the
  resolver only ever turns a MISS into a HIT, never a HIT into a MISS, because the clone path stays
  first in the search order. `git revert` restores the current single-path behaviour exactly.
---

# A review verdict that lands in any home but the clone is thrown away, and the log calls it `[ok]`

## What is wrong

`scripts/pr-watcher/index.mjs` builds the verdict path three times, identically, and each one
assumes the file can only ever be in the clone:

- the PR-comment mirror step - `const verdictPath = path.join(REPO_ROOT, "docs", "pr-reviews", ...)`,
  immediately above the `verdict mirror skipped: ${verdictRel} not found` log line;
- **`verdictApproves(prNumber, prFiles)`** - the function the `tests-docs` auto-merge gate calls
  before it will enable native auto-merge (anchor: `async function verdictApproves`);
- the review-job completion handler that reads the verdict back after a `rev-<N>` job finishes.

Two independent, measured causes put the file somewhere else:

**(a) WRONG TREE - nine of twelve on 2026-09-05.** The review job wrote into
`C:\ProjectOperations2\docs\pr-reviews\` while every reader above looks in
`C:\po-watcher\ProjectOperations\docs\pr-reviews\`. `pr-1682-review.md` is 2475 bytes with mtime
`2026-09-05T22:37:16Z` - **16 seconds before** the mirror step declared it missing.

**(b) THE ARCHIVE SWEEP RACES THE MIRROR - one of twelve.** `#1679` did write to the clone.
`21:22:23.331Z verdict-archive: moved pr-1679-review.md (state=MERGED) -> C:\po-watcher\verdicts-archive`,
then `21:22:39.711Z verdict mirror skipped: ... not found`. Positive control: `#1681`, where the two
steps ran in the opposite order (mirrored 22:09:42Z, archived 22:12:21Z), and the verdict reached
the PR.

Two further verdicts (`pr-1652`, `pr-1672`) are in no home at all; which cause they were is
`[CANNOT MEASURE]` - the artifact no longer exists to ask.

## Why this is not cosmetic

This is a **new measured cause for the second conjunct of DOCTRINE §10.3**
(`"timeout waiting for green checks + MERGE verdict"`), and it is not the one already on file.
`needs-marco/tests-docs-lane-starves-its-own-review-job-2026-09-04.md` attributes the starvation to
QUEUE LATENCY - 93.5 minutes on `#1675`. `#1682`'s review job started 33 seconds after enqueue and
finished in 4.5 minutes. There was no starvation. The verdict simply went where `verdictApproves`
does not read. A reader who checks only the queueing table finds `#1682` healthy and concludes the
mechanism did not reproduce; it reproduced twelve times that day, by a different route.

## The change

Add ONE pure function and call it at all three read sites:

```js
// VERDICT_HOME_RESOLVER_V1 - a review verdict has three homes and the writer picks
// unpredictably (measured 2026-09-05: 9 of 12 landed in the dev tree, 1 was archived
// 16s before the mirror ran). Search all three; clone first, so behaviour is unchanged
// whenever the file is where it used to be. Returns the NEWEST hit, or null.
function resolveVerdictPath(prNumber) { ... }
```

Search order and homes:

1. `path.join(REPO_ROOT, "docs", "pr-reviews", `pr-${n}-review.md`)` - the clone, unchanged, first;
2. `C:\po-watcher\verdicts-archive\pr-${n}-review.md` - the archive the sweep moves settled verdicts
   into (derive it from `REPO_ROOT`'s parent + `verdicts-archive`, do not hard-code the drive);
3. the dev tree `C:\ProjectOperations2\docs\pr-reviews\pr-${n}-review.md`, behind an env override
   (`PR_WATCHER_DEV_TREE`, defaulting to the current value) so the path is configurable and testable.

When more than one home has the file, take the one with the newest `mtimeMs` - the archive held the
newest copy of all three on 2026-09-05 at 22:2xZ, so "clone wins if present" would still be wrong.

When NO home has it, keep the existing log line but make it name **all three paths searched**, and
do not let the job be filed `[ok]` on that path - the accurate line was never the defect; filing it
as a success was.

## Acceptance

`scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs`, using a temp directory per case and
never the real trees:

1. file in the clone only -> resolves to the clone path (regression guard: today's behaviour);
2. file in the dev tree only -> resolves (cause (a), currently a MISS);
3. file in the archive only -> resolves (cause (b), currently a MISS);
4. file in two homes with different mtimes -> resolves to the NEWEST, both orderings;
5. file in no home -> returns `null`, and the message names all three searched paths;
6. `verdictApproves` returns true for a MERGE verdict that exists only in the archive.

## What this prompt must NOT do

- **Do not change the merge policy, `MERGE_TIMEOUT_MS`, or `classifyPolicyFiles`.** Raising the
  timeout is explicitly not the fix (DOCTRINE §10.3).
- **Do not reorder or remove the archive sweep.** Making the reader archive-aware fixes cause (b)
  without touching a step that is doing its job.
- **Do not make the mirror step's failure merely louder.** That is the fourth option Station 03
  named and ruled out: the log line is already accurate.
- **Do not delete or move any existing verdict file.**

## Provenance

Station 03 - Machine Minder, 2026-09-05T23:01Z run, finding F1 (S1), DISPATCHED to Station 00.
Staged by Station 00's 2026-09-05T23:08Z collect. RULE 1 option 1 of three: it is the only one of
the three candidate remedies that fixes cause (a) and cause (b) together, keeps every existing
artifact, and never discards a verdict that was already written.

## STANDING AUTHORITY

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
