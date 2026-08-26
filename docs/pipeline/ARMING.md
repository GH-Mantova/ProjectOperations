# Prompt Arming — Doctrine and Why

## The rule

`scripts/pipeline/arm-prompt.ps1` is the only sanctioned way to arm a HOLD prompt.

A bare `git mv <name>-HOLD.md <name>-ready.md` is now **a defect**.

## Why the rule exists

`C:\ProjectOperations2` is a single git working tree with one shared index. Several Cowork chats
and station agents operate in it concurrently. Before the serializer existed, arming was a bare
`git mv` typed by whichever chat happened to be running. That has three failure modes:

1. **Collision**: another chat commits while the rename is staged and silently carries it to main.
2. **Partial state**: the rename succeeds but the index-guard check that would catch extra staged
   paths is missing, so unrelated staged files travel with the commit.
3. **No lock**: two chats can arm concurrently, producing two rename operations against the same
   index with no synchronization.

## The three measured collisions (2026-08-24)

These are not theoretical. All three happened within the same day:

- **Commit `488f138a`** — a docs commit swept up the HOLD->ready renames of
  `pr-nopr-s1-dismissed-means-proceed` and `pr-nopr-s2-hard-failure-bounded-restage`. Had it
  merged, tracked `*-ready.md` files would have landed on `main`, recreating the resurrection trap
  that PR #1300 cleared: a `checkout` / `reset --hard` / `stash pop` would then silently re-arm
  already-executed prompts.
- **Same day** — `pr-lessons-folder-s1-restore` HOLD->ready was staged by another chat and had to
  be committed around by hand using `git commit -- <pathspec>`.
- **Same day, again** — four CRM arming renames sat staged across three unrelated commits, each
  worked around by hand.

Every occurrence was caught by a human reading `git diff --cached --name-status` before committing.
**That is not a control.** The serializer is.

## What arm-prompt.ps1 does

1. **Takes an exclusive lock** on `C:\ProjectOperations2\.git\po-arm.lock` using real OS file
   locking (`[System.IO.File]::Open` with `FileShare::Read` - exclusive to writers, readable
   by waiters). Retries with backoff up to 60 s. On timeout, exits 1 and names the holder's PID,
   which it reads through a `FileShare::ReadWrite` stream. (Before 2026-08-26 the holder used
   `FileShare::None` and the waiter used `File::ReadAllText`, so the read ALWAYS threw and the
   message ALWAYS said `(unknown)`. This document asserted the opposite.)
2. **Index-guard (before)**: refuses with exit 2 if `git diff --cached --name-only` is non-empty.
   Arming must start from a clean index.
3. **Verifies the target**: HOLD file exists and is tracked; ready file does not already exist;
   `lint-prompt.mjs` returns exit 0 (ADMIT); body contains no `<!-- watcher: do-not-arm -->`
   marker and no `DO NOT ARM` line.
4. **Performs the rename** with `git mv`.
5. **Index-guard (after)**: checks that `git diff --cached --name-only` contains exactly the two
   expected paths (HOLD deletion + ready addition) and nothing else. If extra staged paths appear,
   restores them to un-staged state, undoes the rename, and exits 3.
   The rollback is then read back: if the reverse `git mv` failed or anything is still staged,
   it exits **4** and prints the exact `git restore --staged` commands a human must run. Exit 3
   therefore means, and now provably means, "nothing was changed".
6. **Releases the lock** in a `finally` block — always, on every failure path.

The `-WhatIf` flag runs steps 2 and 3 and prints the plan without touching anything.

## Usage

```powershell
scripts\pipeline\arm-prompt.ps1 -Name <prompt-slug>
scripts\pipeline\arm-prompt.ps1 -Name <prompt-slug> -WhatIf
```

The slug is the file stem without the `-HOLD.md` suffix. Example:

```powershell
scripts\pipeline\arm-prompt.ps1 -Name pr-arm-lock-s1-serialize-arming
```
