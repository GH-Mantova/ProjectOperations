---
premise: '! test -f scripts/pipeline/arm-prompt.ps1'
premise_means: Arming is still a bare `git mv` typed by whichever chat happens to be running. Concurrent chats share one index in C:\ProjectOperations2, so one chat's commit can silently carry another chat's staged rename onto main.
scope:
  - scripts/pipeline/arm-prompt.ps1
  - scripts/pipeline/__tests__/arm-prompt.test.mjs
  - docs/pipeline/ARMING.md
done_when: pnpm lint && test -f scripts/pipeline/arm-prompt.ps1 && grep -q "index-guard" scripts/pipeline/arm-prompt.ps1 && grep -q "arm-prompt.ps1" docs/pipeline/ARMING.md
size: 5
gate_allow: none
seed_only: false
escalates: true
---

# Arming is not serialized, and the shared index makes that dangerous

## The defect, measured three times in two days

`C:\ProjectOperations2` is one working tree with one git index, and several Cowork chats operate in
it concurrently. Arming is a `git mv` — which **stages** a rename. Any chat that commits afterwards
picks that staged rename up unless it is careful.

- **2026-08-24, commit `488f138a`** — a docs commit swept up the HOLD→ready renames of
  `pr-nopr-s1-dismissed-means-proceed` and `pr-nopr-s2-hard-failure-bounded-restage`. Merging it
  would have put tracked `*-ready.md` back on `main`, re-creating the resurrection trap #1300
  cleared: a `checkout` / `reset --hard` / `stash pop` then re-arms already-executed work.
- **Same day** — `pr-lessons-folder-s1-restore` HOLD→ready was staged by another chat and had to be
  committed around, using `git commit -- <pathspec>`.
- **Same day, again** — four CRM arming renames sat staged across three unrelated commits, each one
  worked around by hand.

Every occurrence was caught by a human reading `git diff --cached --name-status` before committing.
**That is not a control.** The next one lands.

## What to build

A single arming primitive that every chat and station uses, so the operation is serialized,
verified, and impossible to perform half-way.

### `scripts/pipeline/arm-prompt.ps1`

```
arm-prompt.ps1 -Name <prompt-slug> [-WhatIf]
```

1. **Take an exclusive lock** on `C:\ProjectOperations2\.git\po-arm.lock` — real file locking
   (`[System.IO.File]::Open` with `FileShare::None`), not a marker file. Marker files are how this
   pipeline already got a 0-byte `index.lock` that never expires. Time out after 60 s and exit
   non-zero naming the holder's PID.
2. **index-guard, before:** if `git diff --cached --name-only` is non-empty, **refuse and exit 2**,
   printing what is staged. Arming must start from a clean index — that is the whole point.
3. **Verify the target:** `<name>-HOLD.md` exists at depth 1 and is tracked; `<name>-ready.md` does
   not already exist; `lint-prompt.mjs` returns exit 0 (ADMIT); and the BODY carries no
   `<!-- watcher: do-not-arm -->` or `DO NOT ARM` line — the linter cannot see those. Any failure
   exits non-zero and changes nothing.
4. **Perform the rename** with `git mv`.
5. **index-guard, after:** `git diff --cached --name-only` must contain **exactly** the two paths of
   this rename and nothing else. If it contains anything else, **`git restore --staged` the extra
   paths, undo the rename, and exit 3** — another chat staged something during the window.
6. **Release the lock in a `finally`**, always, including on every failure path.
7. `-WhatIf` runs steps 2, 3 and 5's checks and prints the plan without touching anything.

### `docs/pipeline/ARMING.md`

Short. State that `arm-prompt.ps1` is the only sanctioned way to arm, that a bare `git mv` is now a
defect, and record the three collisions above so the next reader inherits the reason, not just the
rule.

### Tests — `scripts/pipeline/__tests__/arm-prompt.test.mjs`

In a throwaway temp repo:

- clean index + valid HOLD → renames, exits 0
- **dirty index → exits 2 and changes nothing** (the regression that matters)
- HOLD absent → exits non-zero, changes nothing
- lint REJECT → exits non-zero, changes nothing
- body carries `DO NOT ARM` but lints ADMIT → exits non-zero, changes nothing
- lock held by another process → exits non-zero within the timeout
- `-WhatIf` → exits 0, working tree and index byte-identical afterwards

## Explicitly OUT of scope

**Do NOT change what arming commits.** Today arming stages a rename and commits nothing; whether the
HOLD deletion should be committed — and whether a tracked `*-ready.md` should ever exist — is a
separate question that changes the board's semantics and belongs to Marco. This PR serializes and
verifies the operation that already exists. Nothing more.

Do NOT touch `index.mjs`, `queue-sync.ps1`, `lint-prompt.mjs`, or `supervise-watcher.ps1`.

## Do NOT

- Do NOT delete or move any prompt file beyond the single rename you were asked to perform.
- Do NOT `git checkout .`, `reset --hard`, `stash pop` or `git clean` anywhere in the dev tree.
- Do NOT kill a process holding the lock. Report the PID and exit.
- Do NOT commit, push or open a PR from inside `arm-prompt.ps1`. It arms; it does not publish.

## Guardrails

- One attempt. If `arm-prompt.ps1` already exists, say `NO-OP: <reason>`.
- `pnpm lint` must pass. The new tests must pass.
- **`escalates: true`** — this changes how the board is mutated. Open the PR and leave it unmerged.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
