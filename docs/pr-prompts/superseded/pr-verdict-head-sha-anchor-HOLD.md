---
premise: '! grep -q "VERDICT_HEAD_SHA_ANCHOR_V1" scripts/pr-watcher/index.mjs'
premise_means: >-
  A MERGE verdict is not tied to the commit it reviewed, so a MERGE written for commit A authorises
  the auto-merge of commit B. MEASURED 2026-10-02 at origin/main cf09be41: verdictApproves()
  (index.mjs, "export async function verdictApproves") reads docs/pr-reviews/pr-N-review.md and
  tests only the VERDICT line plus the cited-files guard. No commit SHA is read anywhere on that
  path. The only headRefOid reads in index.mjs are the conflict-notification dedupe in
  handleConflictedPr and one gh field list. The tests-docs wait loop then runs
  `gh pr merge --auto --squash --delete-branch` with no --match-head-commit. The review prompt
  template (review-prompt-template.md) never asks the reviewer which commit it read.
  Worked instances: #1824 on 2026-09-09 (MERGE written at 032bb631, then a push of c7c14844 that
  flipped a prompt to HUMAN_GATE_PRESENT stayed covered by it) and #1823 (verdict evidence table
  described an earlier commit). Full measurement:
  needs-marco/verdict-is-not-anchored-to-a-head-sha-2026-09-09.md (local only, gitignored).
  NOT the same thing as __tests__/verdict-anchor.test.mjs, which is about the regex being anchored
  at column 0 (VERDICT_HEADING_TOLERANT_V1).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pr-watcher/__tests__/*.mjs" &&
  grep -q "VERDICT_HEAD_SHA_ANCHOR_V1" scripts/pr-watcher/index.mjs &&
  grep -q "REVIEWED-SHA" scripts/pr-watcher/review-prompt-template.md &&
  grep -q "match-head-commit" scripts/pr-watcher/index.mjs &&
  test -f scripts/pr-watcher/__tests__/verdict-head-sha.test.mjs
scope:
  - scripts/pr-watcher/index.mjs
  - scripts/pr-watcher/review-prompt-template.md
  - scripts/pr-watcher/__tests__/verdict-head-sha.test.mjs
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Watcher code and one template. Reverting restores number-only verdict matching. No data, no
  schema. Verdict files written in the new format stay readable by the old code (the extra line is
  ignored).
escalates: true
module: watcher
---

# Tie every review verdict to the commit it reviewed

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-02)

- Stamp each verdict with the commit it reviewed, and refuse a verdict that does not match the PR's
  current head.
- **When a verdict is stale, re-review automatically.** The watcher queues a fresh review of the new
  head. Nothing reaches Marco unless that new review fails.

## The rule this builds

> A verdict approves **one commit**. If the PR's head is not that commit, the verdict approves
> nothing.

A verdict with **no** SHA line also approves nothing. Fail closed. An in-flight PR whose verdict was
written before this lands simply gets re-reviewed once.

## What to build

Tag every new branch of logic with `VERDICT_HEAD_SHA_ANCHOR_V1` in a comment.

### 1. The reviewer is told which commit, and records it

`scripts/pr-watcher/review-prompt-template.md`:

- Add a `{{HEAD_SHA}}` placeholder and tell the reviewer: *"You are reviewing commit
  `{{HEAD_SHA}}`. Check out that exact commit and review only it. Write `{{HEAD_SHA}}` as the
  reviewed SHA even if the branch moves on while you work. The watcher re-reviews a newer head
  itself. Never write a SHA you did not review."*
- The verdict file's **second line** must be `REVIEWED-SHA: <full 40-char sha>`, directly under the
  verdict line. Show it in the template's example.

`renderTemplate()` gains a `headSha` argument and replaces `{{HEAD_SHA}}`. Keep the existing
argument order and add `headSha` last, so the current callers and tests still compile.
`pollForNewPrs()` adds `headRefOid` to its `gh pr list --json` fields and passes it through.

### 2. A pure parser, exported for tests

`export function verdictReviewedSha(content)`:

- Returns the lowercase 40-hex SHA from the first `REVIEWED-SHA:` line, or `null`.
- Reads through `blankClosedFences()` first, exactly like `verdictTextApproves`, so a SHA quoted
  inside a code fence is not mistaken for the real one.
- Tolerates the same heading prefix (`## REVIEWED-SHA: ...`) that `VERDICT_MERGE_RE` tolerates.
- Accepts only a full 40-character SHA. A short SHA returns `null`, because a prefix can match two
  commits.

### 3. `verdictApproves` refuses a stale verdict

`verdictApproves(prNumber, prFiles, opts)` takes `opts.headSha`.

- If `opts.headSha` is given and the verdict's SHA is `null` or different, return `false` and log
  `stale-verdict: PR #N verdict reviewed <short> but head is <short>`.
- If `opts.headSha` is not given, keep today's behaviour, so no other caller changes meaning. The
  tests-docs loop **must** pass it.
- Return a reason the caller can act on. Either change the return to `{ ok, reason }` and update the
  one caller, or add a sibling `verdictStatus()` that returns `"approves" | "stale" | "missing" |
  "rejects"`, with `verdictApproves` wrapping it. Pick whichever keeps the diff smaller. Existing
  tests that expect a boolean must still pass.

### 4. The merge uses the commit it checked

In the tests-docs wait loop (the block that logs `tests-docs policy satisfied ... enabling
auto-merge`):

- Add `headRefOid` to the `gh pr view --json` fields that loop already fetches.
- Pass `headSha: data.headRefOid` to the verdict check.
- Add `--match-head-commit <headRefOid>` to the `gh pr merge --auto` call, so a push landing between
  the check and the merge makes GitHub refuse the merge instead of merging an unreviewed commit.

### 5. A stale verdict triggers one re-review

When the loop sees checks all green and the verdict status is `stale` (or `missing`):

- Write a fresh `rev-<N>-ready.md` for the **current** head, through the same code path
  `pollForNewPrs()` uses (`renderTemplate`, now with `headSha`). Do not copy that code; extract a
  small helper both call.
- **At most once per (PR, head SHA).** Persist the heads already re-queued in the reviewed-set state
  file under a new key, for example `{"reviewed":[...], "reviewedHeads":{"1824":"c7c14844..."}}`.
  `loadReviewedSet` must keep reading files that have only `reviewed`. A push to a new head allows
  one more re-review. The same head never queues twice.
- Log `re-review: PR #N head moved <old> -> <new>, queued rev-N-ready.md`.
- Keep waiting. When the new verdict lands with the matching SHA, the existing approval path takes
  over unchanged.

Do **not** re-review on every push to every PR. The trigger is only "this PR is green, in the
tests-docs lane, and its verdict does not match the head." Other PRs' verdicts are advisory and
the single review lane is already a bottleneck (DOCTRINE section 10.3).

## Tests: `scripts/pr-watcher/__tests__/verdict-head-sha.test.mjs`

`node:test`, using the temp-dir `opts` homes that `verdict-home-resolver.test.mjs` already uses:

1. `verdictReviewedSha` reads a bare line, a `## ` heading line, ignores a SHA inside a closed
   fence, and returns `null` for a 7-char SHA and for no line at all.
2. MERGE verdict, SHA matches `opts.headSha`: approves.
3. MERGE verdict, SHA differs: does **not** approve, and the status is `stale`.
4. MERGE verdict, no SHA line, `opts.headSha` given: does **not** approve (`missing`).
5. No `opts.headSha`: behaves exactly as before (backward compatible).
6. `renderTemplate` replaces `{{HEAD_SHA}}`, and leaves the other placeholders working.
7. Re-review de-dupe: the same (PR, SHA) queues once; a new SHA queues again; a state file holding
   only `reviewed` still loads.
8. **Negative control:** a FIX verdict with a matching SHA still does not approve, so the SHA check
   cannot widen approval.

Existing `verdict-*.test.mjs` / `.spec.mjs` suites must stay green unchanged.

## Out of scope

- The rev lane reviewing PRs nothing reads (punch-list 10.4.6, ruling pending).
- Verdicts read by humans or by `Assert-SmokedOrEscalate`. Neither consumes the verdict today.

`escalates: true`: this edits the auto-merge gate. The PR opens labelled `do-not-merge`, and Marco
releases it.
