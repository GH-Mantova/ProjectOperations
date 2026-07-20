# Script registry — who may call what, and when

**This file is the single source of truth for script ownership.** The station briefs
(`docs/pipeline/stations/*.md` and the scheduled `SKILL.md` files) point HERE rather than keeping
their own lists, so there is exactly one place to change when a script is added or retired.

Three rules govern every entry:

1. **A script with an owner is called BY THAT OWNER ONLY.** If you are not the owner, you are
   reading its output, not running it.
2. **READ-ONLY scripts are always safe to run.** MUTATING scripts change the board, the queue, git,
   or a process — they carry the owner's authority and nobody else's.
3. **MARCO-ONLY scripts are never run by an agent**, for one of three reasons: they touch a hard
   stop (SharePoint), they operate on Marco's own working tree, or they need a human decision.
   Agents may *write* them and *hand him the steps*. Marco runs them from
   `scripts\marco.ps1` (the launcher).

---

## Chat-triggered

These run in response to something Marco types, not on a schedule.

| Script | Trigger phrase | Mode | What it does |
|---|---|---|---|
| `pipeline\bring-up-to-speed.ps1` | **"status"**, "bring me up to speed", "catch up" | READ-ONLY | The ONE status entry point. Emits `[LIVE]` / `[STALE]` / `[FILE]` lines and a SAFE / CAUTION / DO-NOT-ACT verdict. **Report ONLY `[LIVE]` lines; never repeat a `[STALE]` one; obey the verdict.** Never hand-gather a status instead of running this. |
| `pipeline\status-sweep.ps1` | "sweep", "what changed" | READ-ONLY | Deterministic board+queue sweep. Feeds `bring-up-to-speed`. |
| `board-status.ps1` | "board", "what's open" | READ-ONLY | Bare live board: open PRs, mergeStateStatus, checks. |

---

## STATION 00 — SUPERVISOR (every 2h)

Owns **board mutation** and **watcher health**. Nothing else may merge or restart the watcher.

### Read-only — build the picture first (DOCTRINE §1)

| Script | What it does | When |
|---|---|---|
| `pipeline\bring-up-to-speed.ps1` | Full situational report + act/do-not-act verdict. | **First, every cycle.** |
| `pipeline\board-status.ps1` (root) | Open PRs and their real merge state. | Every cycle. |
| `pipeline\why-blocked.ps1` | Why a specific PR is BLOCKED when its checks look green. | A PR is BLOCKED with no visible red. |
| `pipeline\check-gate-markers.ps1` | Does every PR needing a `GATE-ALLOW` marker have one, bare at column 0? | CP-11/12/13 red. |
| `pipeline\read-gate-failure.ps1` | Pull the real failure out of a gate job log. | Before diagnosing ANY red (never diagnose from the PR page). |
| `pipeline\assess-conflicts.ps1` | Assess — **not resolve** — conflicts on every DIRTY PR, in an isolated worktree. | A PR is DIRTY. |
| `watcher-loop-check.ps1` (root) | Read-only stall check across watcher + queue. Touches nothing. | Watcher looks idle. |
| `pipeline\find-watcher.ps1` | Identify the watcher by COMMAND LINE, never "it's a node process". | Before any watcher judgement. |
| `pipeline\preflight.ps1` | Pre-flight before touching a staged prompt, branch or PR. | Before mutating anything. |

### Mutating — the supervisor's own hands

| Script | What it does | Guard rail |
|---|---|---|
| `pipeline\pipeline-lib.ps1` | **Dot-source it.** The ONLY sanctioned primitives: `Get-Board`, `Assert-SmokedOrEscalate`, `Merge-Pr`. | **Never hand-roll a board operation.** Merging is `Assert-SmokedOrEscalate` → `Merge-Pr`, never raw `gh pr merge`. |
| `pipeline\smoke-pr.ps1` | UI smoke in an isolated worktree against a dedicated DB. **The exit code decides, not your opinion of it.** | Required before merging a UI PR with an unticked test plan. A FAIL whose only failure is `auth.setup.ts` verified NOTHING. |
| `pipeline\merge-queue.ps1` | Serialized rebase-then-verify merge queue. "BEHIND is not a failure, it is a rebase." | Several green PRs queued behind each other. |
| `pipeline\monitor-board.ps1` | One monitor pass: rebases what fell BEHIND, re-checks. | Board drifting BEHIND during a merge run. |
| `pipeline\enable-automerge.ps1` | Arms GitHub auto-merge on safe, non-conflicted PRs. | Only after the content gate has passed. |
| `pipeline\queue-sync.ps1` | Reconciles prompts **armed by commit** into the **filesystem** queue the watcher reads. Additive; never pulls, deletes or overwrites. | Run when armed-on-main and on-disk disagree. Arms escalating prompts too — they are merge-gated, not run-gated. |
| `pipeline\fix-datamodel-drift.ps1` / `resolve-and-regen.ps1` / `resolve-generated-conflicts.ps1` | Regenerate the generated data-model map on a branch whose drift check is red. | **Regenerate, never hand-merge a generated file.** Regenerate AFTER the final rebase — ordering matters. |
| `pipeline\fix-gate-markers.ps1` | Adds missing `GATE-ALLOW` markers and pushes. | A PR-body edit alone does NOT retrigger the workflow. |
| `restart-watcher-if-wedged.ps1` (root) | The sanctioned WEDGED check. `-WhatIf` to look, `-Fix` to act. | The one watcher case `supervise-watcher.ps1` cannot handle. An idle watcher with 0 armed prompts is CORRECT, not wedged. |
| `clear-stale-index-lock.ps1` (root) | Clears a STALE `.git/index.lock` — only if no git process is running. | Prove it is stale first. A 3-day-old lock once froze the repo. |

---

## STATION 04 — SCANNER (every 4h)

**Read-only on the board.** Never merges, never pushes to a feature branch. Finds defects and
stages prompts — that is the whole job.

| Script | What it does | When |
|---|---|---|
| `pipeline\check-backlog.mjs` | **The backlog gate check.** Runs every `BACKLOG.yaml` item's executable gate. Exit **10** = a blocker has cleared, work is ready to stage. | **STEP 1, every cycle, inside the clean worktree.** |
| `pipeline\check-escalations.mjs` | Runs each escalation's `resolved_when` gate against main — has it actually been FIXED, or only talked about? | Every cycle. A merged PR is not a shipped fix. |
| `pipeline\check-lessons.mjs` | Runs each lesson's `regressed_when` gate. **Inverted polarity: exit 0 means the bad state is BACK.** | Every cycle. |
| `pipeline\gate-eval.mjs` | The one shared executable-gate evaluator behind the three above. | Don't call directly; fix gates here. |
| `pipeline\lint-prompt.mjs` | Intake lint. Exit 0 = ADMIT · **exit 3 = already done, BIN IT** · exit 1 = the prompt is wrong. | Before arming ANY prompt. |
| `pipeline\triage-holds.ps1` | Read-only HOLD triage — proves which HOLDs are already satisfied. | Periodically; pairs with the backlog check. |
| `pipeline\check-all-drift.ps1` | Is the data-model map stale on any open PR? Report only. | Audit sweep. |
| `pipeline\check-sot-bytes.mjs` | Reads the **bytes**, not PowerShell's decoding of them. | Suspected encoding damage in `sot/`. |
| `pipeline\check-sot-encoding.ps1` | Is Marco's working copy of `sot/` byte-damaged (em-dashes, arrows mangled)? | Same. PS 5.1 decodes BOM-less UTF-8 as Windows-1252. |
| `data-model\build-relationship-map.mjs` | Regenerates the data-model map. `--check` validates without writing. | Verifying drift; the `--check` form is the safe one. |
| `pipeline\visual-smoke.mjs` | Playwright capture for the vision review. | Station 02's rule-6 review. |

---

## Watcher-internal — nobody calls these by hand

`pr-watcher\index.mjs` · `merge-queue.mjs` · `start-watcher.ps1` · `start-nightly.ps1` ·
`supervise-watcher.ps1`

The watcher owns its own lifecycle. **`watcher-launcher.ps1` must be started detached via
`Win32_Process.Create`** — launched as a child of Claude Desktop it dies when Claude does (twice:
2026-07-14, 2026-07-20). The supervisor's only touch-points are `restart-watcher-if-wedged.ps1`
and the ensure-up block in its own brief.

---

## Self-tests — run after changing the thing they test

`pipeline\test-pipeline-lib.ps1` · `pipeline\test-lint-prompt.mjs` · `pipeline\test-evidence-gate.ps1`

A guard that has never been observed refusing anything is not a guard.

---

## MARCO ONLY — never run by an agent

Launcher: **`scripts\marco.ps1`**

| Script | Why it is Marco's | What it does |
|---|---|---|
| `sync-to-sharepoint.ps1`, `sync-from-sharepoint.ps1` | **ABSOLUTE HARD STOP.** SharePoint is a shared company system. | Sync docs to/from SharePoint. |
| `pipeline\commit-sot-reconcile.ps1` | Operates on **Marco's own working tree**, where his uncommitted `sot/` edits exist and nowhere else. | Commits those edits as a doc-reconcile PR. |
| `pipeline\make-sot-patch.ps1` | Same tree, same reason. Captures a PATCH, not a copy — his tree is behind main. | Captures uncommitted `sot/` edits. |
| `pipeline\rebase-and-open-sot-pr.ps1` | Follows the two above. | Rebases the sot branch and opens the PR. |
| `pipeline\install-agents.ps1` | Changes what every future agent IS. | Installs the stations into `.claude/agents`. |
| `pr-watcher\watcher-launcher.ps1` | Must be detached via `Win32_Process.Create`, which is a desktop-session action. | Starts the watcher so it outlives Claude. |
| `rescue-watcher-repo.ps1` | Repo surgery on an abandoned mid-merge. Irreversible if wrong. | Rescues `C:\po-watcher` from a half-finished merge. |

---

## Archaeology — DO NOT CALL

Named for a single historical PR or incident. They are kept as evidence of what was done and why;
running them now would re-apply a fix to a world that has moved on.

`fix-544-*` (5) · `merge-544.ps1` · `resolve-544.ps1` · `resolve-538*.ps1` (2) ·
`restore-538-body.ps1` · `restore-552-body.ps1` · `dbg-538-validate.ps1` · `gate-fail-538.ps1` ·
`commit-pipeline-v2.ps1` · `final-rebase.ps1`

If you find yourself reaching for one of these, you want the **playbook** in
`sot/05-decisions-and-lessons.md`, not the script.
