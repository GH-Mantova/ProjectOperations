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

## Lint codes that block arming

The intake linter (`scripts/pipeline/lint-prompt.mjs`) runs as part of step 3 above. The
following codes are relevant to the arming workflow.

### `HUMAN_GATE_PRESENT` (exit 1 — hard REJECT)

Triggered when the prompt body contains any of:

| Marker | Match rule |
|---|---|
| `<!-- watcher: do-not-arm -->` | HTML comment, whitespace-tolerant, case-insensitive |
| A line containing `DO NOT ARM` | CASE-SENSITIVE — genuine gates are in capitals |
| A line containing `Arm ONLY` | Conditional arming — a person named the condition |

The match is intentionally **case-sensitive** for `DO NOT ARM` and `Arm ONLY`. Genuine human
gates are written in capitals. The prose instruction "Do NOT arm ..." (mixed case) that appears
in prompt bodies explaining these rules is NOT a gate.

Matches inside fenced code blocks (`` ``` ``) and inline code spans (`` ` ``) are **ignored**. A
prompt that documents this feature, including the originating prompt
`pr-lint-human-gate-blindness-HOLD.md`, quotes these markers as examples and must not self-reject.

A `docs/approvals/` reference in the body **warns only** (does not reject). The approval document
is a legitimate gate artefact.

**The only thing that clears `HUMAN_GATE_PRESENT` is a human removing the marker from the
prompt body.** No flag, no env var, no bypass exists. This is intentional.

### `GATE_RELEASED` (exit 0 — ADMIT + promotion signal)

When a HOLD declares `requires_on_main: path :: needle` and the needle IS on origin/main, the
linter emits `GATE_RELEASED` and returns ADMIT. The CLI shows `PROMOTE` to distinguish it from a
plain ADMIT. This means the HOLD is ready to arm.

### `GATE_NOT_RELEASED` (exit 1 — REJECT)

When a HOLD declares `requires_on_main: path :: needle` and the needle is **absent** from
origin/main, the linter emits `GATE_NOT_RELEASED` and returns REJECT (exit 1). This is not an
error — it means the HOLD is correctly waiting for its predecessor slice.

**Design choice: REJECT, not admit-with-signal.** The post-condition for this change is: a bare
ADMIT means all declared gates are satisfied. Returning ADMIT for an unmet needle would make a
waiting HOLD indistinguishable from a ready one. REJECT is the clearest signal.

**Fail-safe:** if the `git` probe cannot reach origin/main (shallow clone, no remote, broken git
binary), the linter warns to stderr and skips the check. A broken instrument must never report a
gate as absent — that would bin real work. `[CANNOT MEASURE]` becomes WARN + skip, not REJECT.

Existence-only gates (`requires_on_main: path` with no `::`) are not affected by this code. They
are handled by `FILE_GATE_DEAD` / `GATE_RELEASED` (the pre-existing path).
