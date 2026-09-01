# Cleared 2026-09-01 — work already shipped, under a different name

## `pr-statussweep-orphan-worktree-dirs-HOLD.md`

Retired because **its work is already on `main`** and its premise could never say so.

### The premise

```yaml
premise: '! grep -q "orphanWorktreeDirs" scripts/pipeline/status-sweep.ps1'
```

It asserts the work is still needed while the identifier `orphanWorktreeDirs` is absent from
`scripts/pipeline/status-sweep.ps1`.

### What actually happened

The capability shipped in **#1460** (`6d19e841`, *"fix(status-sweep): worktree liveness classifier,
trunk-conclusion fix, registry-escapee scan"*) — but under different identifiers. Measured on
`origin/main` at `1efd079c`, 2026-09-01T03:0xZ:

| token | occurrences |
|---|---|
| `orphanWorktreeDirs` (the premise's needle) | **0** |
| `abandoned worktree DIRS` (the `done_when` needle) | **0** |
| `REGISTRY-ESCAPEE` | **5** |
| `worktree-registry-escapees` | **3** |
| `registeredPaths` | **2** |

Controls: `Section` → **19** (present, so the query works); `qqzzxxnotreal` → **0** (absent, so it
can return a true zero).

The shipped scan at `status-sweep.ps1:195-212` does exactly what the prompt asks for: it enumerates
the child directories of the known worktree roots, classifies each against the registered-worktree
list, and prints one `[LIVE]` line per unregistered directory with size, age and lock state. Live
output from a run at 02:55:09Z shows nine of them found.

### Why this mattered enough to write down

Both needles return **0 forever**, so the premise reads **true forever**. `lint-prompt.mjs` would
have returned ADMIT and the watcher would have built a **second, parallel** escapee scan beside the
one already there — and it would have collided with
`pr-sweep-dead-queue-dir-reads-HOLD.md`, which edits the same file.

This is LL-54 inverted. The rule says a premise must DIE when the fix lands. This one keyed on **a
name someone hoped the implementer would adopt**, not on the behaviour, so the fix landing changed
nothing about it.

**The lesson, for the next prompt author: a premise must assert that the DEFECT is present, not that
your chosen identifier is absent.** `pr-sweep-dead-queue-dir-reads-HOLD.md` (staged in #1474) keys on
`grep -q "in-progress"` — the defective read itself — precisely because of this file.

### Provenance

Found by Station 06 (PR Master) on 2026-09-01 during Phase 2 grounding for the dead-queue-dir
cluster, while running the schema's mandatory ALREADY-QUEUED check. Recorded as finding F3 in
`docs/pr-prompts/00-06-pr-master-2026-09-01-0330-the-sweep-and-the-watchdog-both-count-a-directory-nothing-writes.md`.
Escalated to Marco, who instructed the retirement at 2026-09-01T03:50Z.

Moved, not deleted. Nothing here is lost — if the shipped scan is ever judged insufficient, this
prompt's "What to build" section is still a good specification and can be re-staged with a premise
that keys on behaviour.
