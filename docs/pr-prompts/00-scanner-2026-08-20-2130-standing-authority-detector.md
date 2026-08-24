# 00-scanner — 2026-08-20 ~21:30 local — STANDING AUTHORITY detector staged but NOT COMMITTED

Station 04 (Scanner) staged ONE new prompt this run:

    docs/pr-prompts/pr-lintgate-standing-authority-detector-HOLD.md

It lints **ADMIT (exit 0)**, size 2, escalates:false. Premise verified in BOTH directions against
origin/main a561b703.

## ⚠️ IT IS UNTRACKED. IT NEEDS `git add` + A DOCS-ONLY PR.

This scheduled run had **no push path**: `gh` is absent from the sandbox, the GitHub MCP token is
read-only (403 on create_branch), Desktop Commander was not connected, and the sandbox has no git
credentials. Per PROMPT-SCHEMA.md a prompt is NOT REAL until it is committed to origin/main — so
treat this file as a draft awaiting commit, not as queue state.

`-HOLD.md` is NOT gitignored (only `*-ready.md` is, .gitignore:75), so a plain `git add` works.

## What it fixes

Three watcher runs on 2026-08-20 exited 0 without opening a PR (filed to `no-pr-opened/`):
`pr-rates-drop-prompt-corrections`, `pr-e2e-container-s1-trial-workflow`, `pr-comms-hub-inbox`.
**None of the three granted push authority.** Nothing in the pipeline enforces the standing-authority
rule that `docs/pipeline/stations/04-scanner.md` calls binding.

Population of the 75 top-level prompts, classified by BODY TEXT not by heading:
  A GRANT 37 · B IMPOSTER 17 (heading present, body says "Stop and report") · C NEITHER 21.

The slice adds a WARN-ONLY `MISSING_STANDING_AUTHORITY` line to lint-prompt.mjs. Warn-only on
purpose: a REJECT would make 38 of 75 prompts MALFORMED at once and jam arming.

## Also true right now

**The queue is EMPTY — 0 armed prompts on this tree.** All 7 previously-armed prompts were consumed.

## ⚠️ TEARDOWN FAILED — a worktree needs removing by hand (Windows-side)

    git -C C:\ProjectOperations2 worktree remove C:\po-worktrees\scan-1787220682 --force --force
    git -C C:\ProjectOperations2 worktree prune

The sandbox mount returns `Operation not permitted` on every unlink under `.git/`, so this station
could not remove its own worktree. It is registered **locked** at a561b703 (detached), which keeps it
from being pruned accidentally but leaves it on disk.

While there: **three older worktrees are already `prunable`** and were not created by this run —
`C:/po-wt-h` (hygiene), `C:/po-worktrees/sot-d-register` (docs/sot-05-d-register), `C:/po-wt/wt-reaudit`.
A single `git worktree prune` clears all three.
