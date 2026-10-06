---
premise: '! grep -q "UPDATE_AT_MERGE_TIME_V1" scripts/pipeline/pipeline-lib.ps1'
premise_means: >-
  The watcher brings every BEHIND PR up to date with main on a timer (pollForBehindPrs), and each
  update restarts that PR's full CI, mostly on PRs that cannot merge without Marco anyway. MEASURED
  2026-10-03: the watcher clone's 2026-10-02 log has 72 "branch updated (was BEHIND)" events in one
  day. start-watcher.ps1 sets PR_WATCHER_AUTO_UPDATE to "true" when unset (origin/main 8ed747e0). The
  repo ruleset "Main" requires branches to be up to date before merging
  (strict_required_status_checks_policy = true), so exactly one update immediately before a merge is
  always needed and every earlier one is wasted. Sources:
  needs-marco/hourly-board-pr-rebases-every-waiting-pr-2026-09-03.md and
  needs-marco/collect-cycle-rebuilds-the-pr-it-cannot-merge-2026-09-06.md (one PR rebuilt 24 times in
  9.4 hours, ~360 check-runs).
done_when: >-
  pnpm build && pnpm lint &&
  node --test "scripts/pipeline/__tests__/*.mjs" &&
  node --test "scripts/pr-watcher/__tests__/*.mjs" &&
  grep -q "UPDATE_AT_MERGE_TIME_V1" scripts/pipeline/pipeline-lib.ps1 &&
  grep -q "UPDATE_AT_MERGE_TIME_V1" scripts/pr-watcher/start-watcher.ps1 &&
  test -f scripts/pipeline/__tests__/merge-pr-update-first.test.mjs &&
  node scripts/pipeline/lint-station.mjs
scope:
  - scripts/pipeline/pipeline-lib.ps1
  - scripts/pipeline/why-blocked.ps1
  - scripts/pr-watcher/start-watcher.ps1
  - scripts/pr-watcher/README.md
  - scripts/pipeline/__tests__/merge-pr-update-first.test.mjs
  - docs/pipeline/stations/00-supervisor.md
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/stations/_canonical-blocks.json
size: 3
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  The timer code stays. Setting PR_WATCHER_AUTO_UPDATE=true restores timer updates; reverting the PR
  restores Merge-Pr's old behaviour.
escalates: true
module: pipeline
---

# Update a PR's branch only when it is about to merge

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's ruling (2026-10-03)

**Turn off the timer.** Station 00 brings a PR up to date as the first step of merging it (after
Marco releases it or its verdict says MERGE), lets that one CI run finish, then the merge happens.
This also settles the related escalation about the collect cycle rebuilding PRs it cannot merge.

Tag the changes with `UPDATE_AT_MERGE_TIME_V1`.

## 1. `scripts/pr-watcher/start-watcher.ps1`

The default becomes off:
`if (-not $env:PR_WATCHER_AUTO_UPDATE) { $env:PR_WATCHER_AUTO_UPDATE = "false" }`, with a comment
carrying the date and the measurement. The timer code in `index.mjs` (`pollForBehindPrs`) stays; an
explicit `true` restores it. The watcher's **conflict notification** (a DIRTY PR gets one comment)
must keep working. If it currently runs inside the auto-update poll, keep that part running when
auto-update is off, and say in the PR body which you found.

## 2. `scripts/pipeline/pipeline-lib.ps1`: `Merge-Pr` updates first

Route every `gh` call in these functions through one script-scoped helper (for example
`Invoke-PipelineGh`) so the tests can replace it.

- New `Update-PrBranch -PR <n>`: runs `gh pr update-branch <n>`, then reads back the new
  `headRefOid`. Returns it, or throws with the GitHub message (a conflict means a human rebase, as
  today).
- `Merge-Pr` reads `mergeStateStatus` and `headRefOid` first:
  - **CLEAN** (up to date, checks green): merge exactly as today, read back MERGED, return
    `[pscustomobject]@{ State = 'MERGED'; PR = <n> }`.
  - **BEHIND**: call `Update-PrBranch`, then queue the merge with
    `gh pr merge <n> --squash --auto --delete-branch --match-head-commit <new head>`. GitHub merges it
    when the new CI run passes. Return `State = 'QUEUED'`. Station 00's next run confirms MERGED, and
    never reports a QUEUED PR as merged.
  - **DIRTY**: throw ("needs a human rebase"). **BLOCKED / UNSTABLE**: throw with the failing or
    pending checks named, as `Assert-Mergeable` does today.
- `-Auto` keeps working as today on a CLEAN PR, and behaves like the BEHIND path otherwise.
- Callers that test `Merge-Pr`'s old `$true` return must use `.State`. Update
  `scripts/pipeline/why-blocked.ps1` if it calls or documents it, and list every caller in the PR
  body.

`pr-board-lease` also edits `Merge-Pr` (it adds `-Actor` and takes a lease). If it has merged,
rebase onto it and keep the lease around both paths. A QUEUED merge releases the lease when it
returns; the merge itself lands on GitHub's side.

PowerShell rules (DOCTRINE 9.1): no single-letter variable names, and no automatic-variable names as
assignment or loop targets.

## 3. Docs

- `docs/pipeline/stations/00-supervisor.md`, merge step: "Merge-Pr now updates a BEHIND branch
  itself and queues the merge (QUEUED). Confirm QUEUED PRs on your next run. Never call
  `gh pr update-branch` on a PR you are not about to merge."
- `docs/pipeline/DOCTRINE.md`: where it describes `PR_WATCHER_AUTO_UPDATE` or BEHIND, record that
  auto-update is off by default from 2026-10-03, and why.
- `scripts/pr-watcher/README.md`: the `PR_WATCHER_AUTO_UPDATE` row. It already documents the default
  as off; it now matches the launcher. Remove the mismatch note if there is one.
- Run `node scripts/pipeline/lint-station.mjs` and re-record canonical hashes if it asks.

## Tests: `scripts/pipeline/__tests__/merge-pr-update-first.test.mjs`

`node:test` driving `pwsh`, with `Invoke-PipelineGh` replaced by a fake that records calls and
returns scripted JSON. Skip when `pwsh` is absent; `pipeline-tests-windows` runs it.

1. CLEAN: one `pr merge` without `--auto`, read-back MERGED, `State = 'MERGED'`.
2. BEHIND: `update-branch`, then `pr merge --auto --match-head-commit <new sha>`,
   `State = 'QUEUED'`, and **no** read-back claiming MERGED.
3. DIRTY: throws, and no merge call is made.
4. BLOCKED with a failing check: throws naming the check.
5. **Negative control:** on a CLEAN PR, `update-branch` is never called.
6. A static test reading `start-watcher.ps1`: the `PR_WATCHER_AUTO_UPDATE` default is `"false"`.

`escalates: true`: it changes the merge path. The PR opens labelled `do-not-merge`, and Marco
releases it.
