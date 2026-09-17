---
premise: '! test -f docs/pipeline/QUEUE-LAYOUT.md'
premise_means: The prompt queue has thirteen folders, four of which nobody owns - two hand-timestamped binned-shipped folders, a _cleared folder and an empty awaiting-review. There is no written standard for which folder a prompt belongs in at each stage of its life, so every station invents one, and processed/ is used for prompts whose PR merged, was abandoned, or is still open, with nothing telling them apart.
scope:
  - docs/pipeline/QUEUE-LAYOUT.md
  - docs/pipeline/DOCTRINE.md
  - docs/pipeline/PR-MASTER.md
  - docs/pr-prompts/README.md
done_when: node scripts/pipeline/lint-station.mjs && node scripts/pipeline/check-breadcrumb.mjs && test -f docs/pipeline/QUEUE-LAYOUT.md && grep -q "QUEUE_LAYOUT_V1" docs/pipeline/QUEUE-LAYOUT.md && grep -q "QUEUE-LAYOUT.md" docs/pipeline/DOCTRINE.md && grep -q "QUEUE-LAYOUT.md" docs/pipeline/PR-MASTER.md
size: 4
gate_allow: none
seed_only: false
escalates: false
module: pipeline
---

# Queue layout S1 - write the standard down

**First of four.** Marco asked for one folder standard across every station, agent and the watcher,
and settled the three open questions on 2026-09-17:

> Drafts come into the repo. Exceptions nest under `exceptions/<reason>/`. Every historical prompt
> is re-checked against its PR and filed - no line drawn at today.

This slice writes the standard down and **moves nothing**. No folder is created, no file relocated,
no code changed. S2 builds the shared constant and the guard, S3 flips the paths and migrates, S4
turns the guard on in CI.

## Why the order matters

The standard has to exist as a citable document before any code imports it, or the vocabulary gets
defined twice - which is the exact failure that produced `binned-shipped-2026072037` and
`_cleared-2026-08-140`.

## Build this

### 1. `docs/pipeline/QUEUE-LAYOUT.md` (new) - the canonical document

Carries `QUEUE_LAYOUT_V1` as its marker. It states, in this order:

**The six states.** Five are Marco's; `armed` is the sixth and is called out as the one the watcher
actually keys on.

| state | where | meaning |
|---|---|---|
| brainstorm | `docs/pr-prompts/brainstorm/` | being thought about; not a prompt yet; nothing reads it |
| draft | `docs/pr-prompts/draft/` | written, **not approved**; inert - no gate, no arm, no build |
| hold | `docs/pr-prompts/*-HOLD.md` | approved and staged; on main; waiting on its gate |
| armed | `docs/pr-prompts/*-ready.md` | the rename **is** the dispatch; the only state `READY_PATTERN` matches |
| merged | `docs/pr-prompts/merged/` | its PR is confirmed `MERGED` on main |
| superseded | `docs/pr-prompts/superseded/` | replaced; the replacement is named inside the file |

**Why hold and armed are filenames and not folders.** State this as a mechanical fact, not a
preference: `index.mjs` calls `fsWatch(PROMPT_DIR, { persistent: true }, ...)` with **no**
`recursive: true`. On Windows a change inside a subdirectory fires no event; only the 5-minute
`RESCAN_INTERVAL_MS` sweep would notice. Moving the armed state into a folder would silently turn
arming from immediate into eventual. Anyone proposing to move it must change the watch first.

**`merged` is not `processed`.** Say plainly that the retired `processed/` moved a prompt when its
PR **opened**, and that this is why a prompt could sit there while its PR was still open, or closed
unmerged, with nothing distinguishing the three. A prompt reaches `merged/` only on a confirmed
`MERGED` state. Cite the two arms lost to that blind spot on 2026-09-16 (`ratescol-s4`,
`scopecards-s2b`) as the reason the state exists.

**Exceptions are not lifecycle states.** `exceptions/<reason>/`, and the reason is a **closed
vocabulary**: `needs-marco`, `blocked`, `failed`, `paused`, `no-pr-opened`, `abandoned`. Adding a
seventh reason is a change to this document and the shared constant, never a new folder.

**Reports are not prompts.** Station breadcrumbs and run reports go in `docs/pr-prompts/reports/`.
Record that 31 of them were sitting loose in the queue root when this was written.

**Nothing is ever deleted.** Retiring a prompt means moving it. This is Marco's standing rule and it
binds the migration in S3.

### 2. `docs/pipeline/DOCTRINE.md`

Add one section, **Queue layout**, that states the six states in one table and points at
`QUEUE-LAYOUT.md` for the detail. DOCTRINE binds every station and is the file a run actually reads,
so the summary must be complete enough to act on without opening the other document.

### 3. `docs/pipeline/PR-MASTER.md`

Update the drafts lifecycle section (added 2026-09-16, PR #1973). It currently sends staged drafts
to `C:\PR-Master\drafts\_staged\`, outside the repo. Under the new standard drafts are **in** the
repo. Rewrite that section to the new flow and say in terms that the out-of-repo location is
superseded and why - **do not delete the old paragraph silently**; a reader who remembers the old
rule needs to find out here that it changed.

### 4. `docs/pr-prompts/README.md`

A short orienting file in the queue itself: the six states, one line each, and a pointer to
`QUEUE-LAYOUT.md`. This is what someone lands on when they open the folder.

## Do NOT

- Do NOT create any folder, move any file, or delete anything. This slice is four documents.
- Do NOT touch `scripts/`, `.github/`, the watcher, or `sot/`. `sot/` is **Station 05's alone** -
  its entry is authored separately by 05 and is not in this scope.
- Do NOT change `READY_PATTERN`, `PROMPT_DIR`, or any existing folder name yet. S3 does that.
- Do NOT describe the standard as already in force. It is written here and enforced in S4; say so.

## VERIFY before opening the PR

```
node scripts/pipeline/lint-station.mjs
node scripts/pipeline/check-breadcrumb.mjs
git diff --name-only origin/main   # must list exactly the four files in scope
grep -n "recursive" docs/pipeline/QUEUE-LAYOUT.md          # the fsWatch fact must be stated
grep -n "QUEUE_LAYOUT_V1" docs/pipeline/QUEUE-LAYOUT.md
```

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** - the work is discarded either way.

## Guardrails

- One attempt. Never exit silently - if you cannot do it, say `NO-OP: <reason>` and why.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the job log before diagnosing any CI failure.
- Hard stop, report and exit: Azure / Entra / SharePoint, production auth or secrets, any
  irreversible action. Say `NO-OP: <reason>`.
- **Budget.** Four documents. If you find yourself editing code, stop and say `NO-OP: <reason>`.

## STATUS

Armed by Station 00 under Marco's direction. Once this file carries the `-ready.md` suffix that
rename IS the dispatch - build it and open the PR. First of four; S2 gates on `QUEUE_LAYOUT_V1`.
