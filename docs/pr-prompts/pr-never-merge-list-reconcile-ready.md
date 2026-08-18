---
premise: 'grep -q "552, 538" scripts/pipeline/merge-queue.ps1'
premise_means: Three pipeline scripts still refuse PRs #552 and #538, both of which MERGED on 2026-07-14. The library the board driver actually calls refuses nothing. So the NEVER-MERGE guard is simultaneously over-blocking in three places and, in the one place that counts, blocking nothing - and nobody can tell which is authoritative by reading the code.
scope:
  - scripts/pipeline/merge-queue.ps1
  - scripts/pipeline/enable-automerge.ps1
  - scripts/pipeline/monitor-board.ps1
  - scripts/pipeline/pipeline-lib.ps1
done_when: ! grep -rq "552, 538" scripts/pipeline && pwsh -File scripts/pipeline/test-evidence-gate.ps1
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# Reconcile the NEVER-MERGE list - four copies, three of them stale

## Measured

[MEASURED] against `origin/main` @ `5a97d247`, 2026-08-18, via `gh pr view`:

- **#552 is MERGED** - 2026-07-14T03:51:08Z. "fix(prod): seed baseline RateTable rows via idempotent
  data migration". Marco reviewed the rates himself and merged it.
- **#538 is MERGED** - 2026-07-14T03:13:05Z. "fix(auth): shared-computer switch-user + gated Entra
  request-access - DO NOT AUTO-MERGE". Also discharged.

[MEASURED] `git grep -nE '\$(script:)?NEVER(_MERGE)?\s*=' -- scripts`:

    scripts/pipeline/enable-automerge.ps1:22   $NEVER = @(552, 538)
    scripts/pipeline/merge-queue.ps1:42        $NEVER = @(552, 538)
    scripts/pipeline/monitor-board.ps1:13      $NEVER = @(552, 538)
    scripts/pipeline/pipeline-lib.ps1:223      $script:NEVER_MERGE = @()      <- CORRECT
    scripts/pipeline/test-evidence-gate.ps1:66 $script:NEVER_MERGE = @(999999) <- test fixture, leave

**`pipeline-lib.ps1` is the one that is right**, and its comment block at ~196-206 already records
why (#552 discharged on merge). The other three are stale.

## What to do

**Set all three stale lists to `@()`.** Do not delete the variable, the guard, or any call site -
the mechanism must survive so a future PR can be added to it in one line.

Above each, put a short comment matching the honest one already in `pipeline-lib.ps1`:

    # NEVER-MERGE list. Empty is CORRECT as of 2026-08-18: #552 and #538 were the only
    # two entries and both merged on 2026-07-14. Add a PR number here to hard-block it.
    # A stale entry is worse than an empty list - see test-evidence-gate.ps1.

`test-evidence-gate.ps1:58` already makes this point in the codebase's own words: *"'refuses #552'
rots into a lie the moment #552 merges - and then quietly passes."* That is exactly what happened.
Do not weaken or delete that test.

## The thing to be honest about in the PR body

An empty NEVER-MERGE list is a guard that **never fires**. That is the correct state right now, but
a reviewer skimming `Assert-Mergeable` could reasonably assume some protection exists when none
does. Say so plainly in the PR body: the guard is armed and empty, it protects nothing today, and
that is deliberate because both historical entries are discharged.

**Do not** invent new entries to make the list look useful. An entry that is not a real hard block
is the same rot in a new costume.

## Do not

- Do not touch `sot/`. CP-24 hard-fails a PR mixing code and `sot/`.
- Do not change `test-evidence-gate.ps1` or `test-pipeline-lib.ps1` fixtures - `@(999999)` is a
  deliberate synthetic and `test-pipeline-lib.ps1:40` asserts a refusal path. If a test now fails
  because it asserts `Assert-Mergeable` REFUSES #552, that is a REAL finding: report it in the PR
  body and fix the assertion to match reality (552 is merged and allowed), do not delete the test.
- Do not merge anything, and do not change any auto-merge behaviour beyond the list contents.
- Do not consolidate the four lists into one shared source in this PR. Tempting, and out of scope -
  it spans PowerShell module boundaries. Note it as a follow-up.

## Verification

    git grep -n "552, 538" scripts/pipeline        # must return NOTHING
    pwsh -File scripts/pipeline/test-evidence-gate.ps1
    pwsh -File scripts/pipeline/test-pipeline-lib.ps1

Paste all three outputs in the PR body. If either test suite is red before your change, say so -
a pre-existing red is a finding, not your fault, and hiding it is worse than leaving it.

You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.
