# Automation concurrency — why it keeps breaking, and how to fix it

**Status:** proposal for Marco's review. No code written yet.
**Date:** 2026-07-14
**Author:** Cowork, after a 24-hour run of four separate incidents with one root cause.

---

## 1. The root cause — one sentence

**Five autonomous agents, a live daemon, and a human all share ONE mutable git working tree
(`C:\po-watcher\ProjectOperations`), with no locking and no isolation.**

Everything below follows from that. It is a textbook concurrency bug, and no amount of prompt
engineering will fix it — because the failure is structural, not behavioural. You cannot instruct
your way out of a data race.

### The evidence (all within 24 hours, all the same cause)

| # | Incident | What actually happened |
|---|---|---|
| 1 | Supervisor corrupted the repo | Ran `git merge` in the shared tree, hit a conflict, abandoned it. `MERGE_HEAD` left behind → **every** queued prompt would have failed on `git checkout`. |
| 2 | Near-miss: rescue script | A false "repo is broken" signal nearly triggered `git checkout main` **while an agent was live on a feature branch** — would have destroyed in-flight work. |
| 3 | Queue dead 13 hours | The dialogs prompt hit max-turns and exited 1. It left **33 uncommitted files** in the shared tree. The watcher's blanket safety-stop paused the entire queue. Board frozen overnight. |
| 4 | Shepherd vs watcher | Both do local git in the same tree, on overlapping 4h/continuous schedules. Has not bitten yet. It is a matter of time. |

**Note what incident 3 tells us:** a *single agent*, running *alone*, with *no concurrency at all*,
still poisoned the shared tree just by failing. Concurrency makes it worse, but the shared tree is
lethal even without it.

---

## 2. Why the obvious fixes don't work

### ❌ Stagger the schedules
Runs take 10–40 minutes and sometimes 34 (the dialogs run hit max-turns at ~34 min). The watcher is
a **continuous daemon** — it is not on a schedule at all, so there is no window to stagger *around*.
And it does nothing for incident 3, where a single agent failing alone still broke everything.
**Timing-based safety is not safety. It is luck with extra steps.**

### ❌ Just add a lock file
Better, but: agents crash. A crashed agent leaves a stale lock, and now the queue is dead in a new
way. You need lock + owner-PID + TTL + a reaper — and every agent must *remember* to take it. LLM
agents forget instructions; they cannot be trusted as the enforcement layer for a mutex.
Useful as a **backstop**, not as the primary mechanism.

### ⚠️ Fewer, wider agents (Marco's suggestion)
**Directionally right, and I want to do some of it — but it is not sufficient on its own.**
Consolidating 5 agents into 3 reduces the number of actors, but if the remaining actors still share
one mutable tree, incidents 1–3 all still happen. **It shrinks the blast radius without removing the
bomb.** Do it — but do it *after* the structural fix, and for a different reason (clarity and cost).

---

## 3. The fix — three layers, in priority order

### LAYER 1 (the real fix): ONE WRITER. Everyone else is read-only.

Classify every actor by **what it is allowed to mutate**:

| Actor | Shared git tree | Disposable worktree | Queue files | GitHub (via `gh` API) |
|---|---|---|---|---|
| **Watcher** (daemon) | ❌ never | ✅ **yes — its own, per run** | ✅ | ✅ |
| **Shepherd** | ❌ never | ✅ yes, only to resolve conflicts | ✅ stage prompts | ✅ merge via API |
| **Supervisor** | ❌ **never** | ❌ | ✅ move/rename only | 👁 read-only |
| **QA / SoT sweep** | 👁 read-only | ❌ | ✅ stage prompts | 👁 read-only |
| **Marco** | ✅ (his own tree, `C:\ProjectOperations2`) | — | ✅ | ✅ |

**The key insight: merging a PR does not require a working tree at all.**
`gh pr merge <n> --squash` is a GitHub API call. It touches no local files. Today the shepherd merges
locally *for no reason*. Move every merge to the API and the shepherd stops being a git writer
entirely — except for conflict resolution, which is the one case that genuinely needs a tree.

**Nobody writes to `C:\po-watcher\ProjectOperations`. Ever. It becomes a read-only reference clone**
whose only job is to be `git fetch`ed and to be the parent of worktrees.

### LAYER 2: Every run gets a DISPOSABLE WORKTREE

    git worktree add C:\po-worktrees\run-<id> origin/<branch>
    ... agent does all its work here ...
    git worktree remove C:\po-worktrees\run-<id> --force

This is the fix for incident 3 — the one that cost 13 hours.

- An aborted run leaves a dirty **worktree**, not a dirty **shared tree**. Delete it; nothing else
  is affected. **The queue never needs to pause.**
- Two agents cannot collide: different directories, different indexes.
- The 33 uncommitted files would have died with their worktree, harming nobody.
- Recovery becomes trivial and *safe*: "delete any worktree older than N hours with no live process."

The repo **already has this pattern** — the watcher's rule-6b apitest worktrees. It is proven here.
We are extending it from "some runs" to "every run".

*(The 5 stale worktrees in `C:\po-worktrees` from 07-07/08 are the evidence it works: aborted runs
left them behind and **nothing broke**. They are litter, not damage — precisely the outcome we want.)*

### LAYER 3: A lock, as a backstop only

A tiny lease file (`owner PID + timestamp + TTL`) around any git write, with a reaper that clears a
lease whose PID is dead. **Not the primary mechanism** — Layers 1 and 2 mean there is almost nothing
left to contend over. This exists to catch the case we did not think of.

---

## 4. On "agents that start after the issue happened"

Marco's sharpest question. An agent waking at 03:00 has no memory of the 20:00 failure. Today that
means it reads a stale state file and repeats its claims as fact (this exact bug bit us twice).

**Rule: state on disk is a HYPOTHESIS. Live state is the truth. Every agent's first act is a
precondition check, and it heals what it safely can.**

    scripts/preflight.ps1   # ONE shared script, run first by EVERY agent

Returns a machine-readable verdict:
- shared tree clean & on main?  (if not → **stop**, do not git-write, report)
- any worktree orphaned?        (safe to reap: no live PID)
- queue paused?                 (`paused/PAUSED_SUMMARY.md` present → say so; do not silently resume)
- watcher alive / wedged / down? (heartbeat + process + queue movement)
- board: dirty PRs, failing CI

**Crucially it distinguishes the three states we kept confusing:**

| State | Meaning | Action |
|---|---|---|
| **CLEAN** | nothing in flight | proceed |
| **BUSY** | an agent is legitimately working | **leave it alone** |
| **CORRUPT** | mid-merge / unmerged paths | heal (reversibly) or stop |

Every incident this week was a failure to tell BUSY from CORRUPT.

---

## 5. Prefer the reversible move (the 13-hour lesson)

Last night the supervisor faced: **keep** the 33 files or **discard** them. Both irreversible, both
needing a human. It escalated correctly — and the board sat dead for 13 hours.

**It never looked for the third option:**

    git stash push -u -m "aborted run <id>"

Preserves everything (recoverable via `git stash pop`), cleans the tree, **queue resumes immediately**.
The keep/discard decision still waits for Marco — just without an outage attached.

**Standing principle, worth more than any specific rule:**

> **When facing an irreversible fork, look for a reversible move that buys time.**
> Escalating is correct. Escalating *while the system is down*, when a safe unblock existed, is not.

(With Layer 2 this specific case disappears entirely — the dirty worktree just gets deleted. But the
principle generalises far beyond git, which is why it should be written into every agent.)

---

## 6. Agent consolidation — 5 → 3

Now worth doing, for clarity and cost rather than safety:

| Now | Proposed | Why |
|---|---|---|
| pr-shepherd (4h) | **PR-DRIVER** (4h) | Owns the board end-to-end: verify → conflict-resolve (in a worktree) → merge (via API). |
| watcher-triage (6h) | *merged into SUPERVISOR* | Triage and supervision are the same job: "what broke, what next." Splitting them created duplicate escalations. |
| feature-queue-watch (2h) | **SUPERVISOR** (2h) | Machinery health + triage + recovery. **Zero git writes.** |
| night-qa (4h) | **SCANNER** (4h) | Read-only: QA + SoT sweep + data-model drift. Its only output is staged prompts + findings. |
| sot-sweep (daily) | *merged into SCANNER* | Same shape: read, compare, report, stage. |

**Three agents, three non-overlapping mandates:**
- **PR-DRIVER** — moves PRs. The only agent allowed to write code/git (and only in a worktree).
- **SUPERVISOR** — watches the machinery. Never writes code or git.
- **SCANNER** — finds problems. Read-only; only ever *proposes*.

They cannot cross over, because **their write-permissions are disjoint by construction** — not by
instruction. That is the whole point.

---

## 7. Sequencing (each step independently shippable)

| Phase | Change | Cost | Removes |
|---|---|---|---|
| **1** | `scripts/preflight.ps1` — shared, run first by every agent. Distinguishes CLEAN/BUSY/CORRUPT. | small | the BUSY-vs-CORRUPT confusion (incidents 1, 2) |
| **2** | **Watcher runs every prompt in a disposable worktree.** | **medium — the big one** | dirty shared tree; queue-pause cascade (incident 3) |
| **3** | Shepherd merges via `gh pr merge` (API). No local git except conflict-resolution worktrees. | small | shepherd/watcher contention (incident 4) |
| **4** | Consolidate 5 agents → 3 with disjoint write-permissions. | medium | duplicate escalation; cost |
| **5** | Lease/lock backstop + orphaned-worktree reaper. | small | the unknown unknown |

**Phase 2 is the one that matters.** If only one thing gets built, build that.

---

## 8. Honest risks

- **Worktrees cost disk.** A full checkout per run. Mitigate with the reaper (Phase 5). The repo is
  not huge; this is cheap insurance.
- **`pnpm install` per worktree** may slow each run. Test it. A shared pnpm store largely solves it.
- **Consolidation means bigger prompts**, and the dialogs run just proved a big prompt can hit
  max-turns. **So: consolidate the AGENTS, but keep the PROMPTS small.** Split any prompt that touches
  more than ~10 files. The dialogs task (48 call sites) should always have been 4 prompts.
- **I have been wrong repeatedly this week**, including shipping a check that would have destroyed
  in-flight work. Phase 2 changes how every automated run executes. **Ship it behind a flag, on one
  prompt, and watch it before making it the default.**

---

## 9. What I recommend

**Do Phase 1 + 2 now.** They are the difference between "the automation is fragile and I check on it"
and "the automation is safe to ignore." Everything else is optimisation.

**Do Phase 4 (consolidation) after** — you were right that there are too many agents, but fixing the
agent count without fixing the shared tree would have left the real bomb armed.
