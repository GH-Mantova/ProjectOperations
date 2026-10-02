---
premise: '! grep -q "NEW_WORKTREE_PATH_ONLY_V1" scripts/pipeline/new-worktree.ps1'
premise_means: >-
  new-worktree.ps1 promises "The ONLY success-stream output: the path" (its last lines), but every
  native git call in it writes to the success stream too. So `$wt = & new-worktree.ps1 ...` captures
  git's "HEAD is now at ..." / "Preparing worktree" text plus the path, and the next
  `git -C $wt ...` fails on a multi-line value. MEASURED 2026-10-02 by Station 06 while staging
  #2201-#2205: the captured value held "HEAD is now at <sha> <subject>" and the path on separate lines.
  The leaking calls (origin/main cf09be41) are the bare `& git -C $Repo worktree prune / remove /
  add` and `fetch` lines in both the teardown and create sections. Only `branch -D` is already piped
  to Out-Null.
done_when: >-
  pnpm build && pnpm lint &&
  grep -q "NEW_WORKTREE_PATH_ONLY_V1" scripts/pipeline/new-worktree.ps1 &&
  test -f scripts/pipeline/__tests__/new-worktree-path-only.test.mjs
scope:
  - scripts/pipeline/new-worktree.ps1
  - scripts/pipeline/__tests__/new-worktree-path-only.test.mjs
size: 1
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Output plumbing only. Reverting restores the leak; no worktree behaviour changes.
escalates: false
module: pipeline
---

# new-worktree.ps1: the path is the only thing on the success stream

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## The change

In `scripts/pipeline/new-worktree.ps1`, route every native `git` call's stdout away from the
success stream. Tag the change `NEW_WORKTREE_PATH_ONLY_V1` in a comment beside the
`# The ONLY success-stream output: the path.` line.

- `worktree add`, `worktree remove`, `fetch`: pipe to `Out-Host`. The human still sees git's
  messages; a caller's `$x = & new-worktree.ps1` does not capture them.
- `worktree prune`: pipe to `Out-Null`. It prints nothing useful.
- Leave `branch -D ... 2>&1 | Out-Null` as it is.
- `$head = (& git -C $wt rev-parse HEAD).Trim()` is captured into a variable, so it does not leak.
  Leave it.
- **`$LASTEXITCODE` must still be read correctly** after each piped call. A native command piped to
  `Out-Host` or `Out-Null` still sets it, but the existing `if ($LASTEXITCODE -ne 0)` checks must
  stay directly after the call they test. Do not insert anything between.

Keep every exit code (0, 2, 3, 4, 5) and every `Write-Host` message as it is.

## Test: `scripts/pipeline/__tests__/new-worktree-path-only.test.mjs`

`node:test`. CI's `pipeline-tests` job runs on Linux, so:

- If `pwsh` is not on PATH, `t.skip("pwsh not available")`. Do not fail.
- If it is: create a temp bare origin plus a clone with one commit, run
  `pwsh -NoProfile -File scripts/pipeline/new-worktree.ps1 -Slug t1 -Branch t1 -Repo <clone> -Root <tmp> -NoFetch`
  (use the script's real parameter names; read its `param()` block), and assert that **stdout is
  exactly one non-empty line** and that it equals the worktree path. Then run it with `-Remove` and
  assert the exit code is 0.
- **Negative control:** run with an invalid slug and assert exit code 2 and **empty** stdout, so the
  test can tell "printed only the path" from "printed nothing".

Run it locally on Windows with `pwsh` present and paste the passing output into the PR body, since CI
may skip it.
