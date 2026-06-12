# PR-prompt watcher

A small daemon that watches `docs/pr-prompts/` for ready-to-run prompts and
feeds each one to a headless Claude Code session, single-threaded.

**Zero dependencies** — uses Node's built-in `fs.watch`, no `pnpm install`
required.

## How it works

1. **Cowork (or you) writes a draft** to `docs/pr-prompts/pr-NN-{slug}.md`.
   The watcher **ignores** this file — drafts are safe until you opt in.
2. **You rename it to `pr-NN-{slug}-ready.md`** when you've reviewed it and
   want it to fire. (On Windows: F2 in Explorer, append `-ready` before
   `.md`, hit Enter.)
3. The watcher detects the `-ready.md` file, reads its body, and runs:
   ```
   claude --print --max-turns 120  <  pr-NN-{slug}-ready.md
   ```
4. **On success** (exit 0): the prompt + a `.log` of the agent's full
   stdout/stderr move to `docs/pr-prompts/processed/`.
5. **On failure** (non-zero exit): both move to `docs/pr-prompts/failed/`,
   plus a `{name}.report.md` with the failure evidence (see "Failure
   quarantine" below). Transient failures get one automatic retry first.

If you drop multiple `-ready.md` files at once, they're queued — only one
agent runs at a time, so branches never trample each other.

The watcher also scans the directory at startup, so any `-ready.md` files
already sitting there when you start it will be picked up immediately.

## Setup

Nothing to install. You only need the `claude` CLI on PATH. Verify with:

```powershell
claude --version
```

## Running it

From any terminal:

```powershell
node C:\ProjectOperations2\scripts\pr-watcher\index.mjs
```

Leave the terminal open. The watcher prints one line per event:

```
[2026-05-29T12:01:33Z] [watcher] watching C:\ProjectOperations2\docs\pr-prompts
[2026-05-29T12:01:33Z] [watcher] pattern: (pr|rev)-*-ready.md
[2026-05-29T12:04:11Z] [queue] pr-15-hide-duplicate-quote-preview-block-ready.md (depth: 1)
[2026-05-29T12:04:11Z] [start] pr-15-hide-duplicate-quote-preview-block-ready.md (max-turns=120)
...
[2026-05-29T12:18:44Z] [ok] pr-15-hide-duplicate-quote-preview-block-ready.md → processed/
```

Ctrl+C to stop.

## Upgrading to v2 — restart required

**A running watcher does not pick up code changes.** After merging a watcher
upgrade, stop the running instance (Ctrl+C in its terminal pane) and start it
again. Until you restart, the old code keeps running from memory — every v2
behaviour below is invisible to an already-running v1 process.

All v2 behaviours are **opt-in via env**; the old invocation with no new env
vars behaves identically to v1 (modulo the deterministic queue order, which
only changes the order of simultaneously-queued prompts).

## Configuration

Env vars override the defaults:

| Env var | Default | Effect |
|---|---|---|
| `PR_WATCHER_MAX_TURNS` | `120` | Agent hard cap per run. Bump for big PRs. |
| `PR_WATCHER_CLAUDE_BIN` | `claude` | Override if `claude` isn't on PATH. |
| `PR_WATCHER_GH_BIN` | `gh` | Override if `gh` isn't on PATH. |
| `PR_WATCHER_AUTO_MERGE` | `false` | **Legacy** blanket flag. `"true"` maps to `PR_WATCHER_AUTO_MERGE_POLICY=all` when no explicit policy is set. Prefer the policy var. |
| `PR_WATCHER_AUTO_MERGE_POLICY` | `off` | `off` \| `all` \| `tests-docs`. See the policy matrix below. |
| `PR_WATCHER_MERGE_TIMEOUT_MIN` | `90` | Max wait for a PR to merge after CI starts. |
| `PR_WATCHER_POLL_INTERVAL_SEC` | `60` | How often to poll PR state during merge wait. |
| `PR_WATCHER_STOP_AT` | _(unset)_ | Nightly cutoff `HH:MM` (24-hour, local). Past this, watcher won't start a new prompt and exits cleanly with code 0. In-flight prompt finishes. |
| `PR_WATCHER_AUTO_REVIEW` | `false` | Set to `"true"` to poll GitHub for new PRs and auto-fire reviews. |
| `PR_WATCHER_REVIEW_POLL_SEC` | `90` | How often (seconds) to poll GitHub for new PRs to review. |
| `PR_WATCHER_REVIEW_MIN_AGE_MIN` | `2` | Grace period (minutes) — skip PRs younger than this. Gives the authoring agent time to finish post-PR steps before the reviewer fires. |
| `PR_WATCHER_AUTO_UPDATE` | `false` | Set to `"true"` to auto-run `gh pr update-branch` on your open PRs that are BEHIND main. Conflicting PRs are skipped. |
| `PR_WATCHER_UPDATE_POLL_SEC` | `120` | How often (seconds) the auto-update poll runs. |
| `PR_WATCHER_TRANSIENT_PATTERNS` | _(built-in list)_ | Comma-separated regex bodies (case-insensitive) that mark a failure as transient → one automatic retry. Defaults: `cache.{0,40}\b400\b`, `ECONNRESET`, `Workspace still starting`, `runner.{0,5}lost`. |
| `PR_WATCHER_DRY_RUN` | `false` | Set to `"true"` to log every decision (queue, deps, policy, update-branch) without spawning `claude`, running any mutating `gh` command, or consuming prompt files. Read-only `gh` calls still run, so decisions reflect live repo state. |

Example:

```powershell
$env:PR_WATCHER_MAX_TURNS = "200"
node C:\ProjectOperations2\scripts\pr-watcher\index.mjs
```

## Dependency gating (prompt front-matter)

A prompt may declare dependencies as HTML comments **at the very top of the
file** (before any other content; blank lines are allowed between them):

```markdown
<!-- watcher: requires-merged: 380, 379 -->
<!-- watcher: requires-file-on-main: tests/e2e/pr-acceptance/helpers.ts -->

# The actual prompt starts here…
```

| Directive | Meaning |
|---|---|
| `requires-merged: N[, N…]` | Every listed PR must have state `MERGED` (`gh pr view N --json state`). |
| `requires-file-on-main: path` | The path must exist on `origin/main` (checked after a `git fetch origin main`). One path per directive; repeat the line for multiple files. |

Before running the prompt, the watcher checks every directive. If **any** is
unmet, the prompt is **deferred**: a `[deps]` log line explains why, the file
is NOT consumed, and it is re-checked on the next periodic rescan (every
5 minutes). A `gh`/`git` error during the check counts as unmet (fail closed).

Parsing stops at the first non-blank line that isn't a `<!-- watcher: … -->`
comment, so directives buried mid-file are ignored. A prompt with no
front-matter behaves exactly as before. Unknown `watcher:` keys are ignored.

## Auto-merge policy matrix

`PR_WATCHER_AUTO_MERGE_POLICY` controls what happens after an authoring agent
opens a PR:

| Policy | Behaviour |
|---|---|
| `off` (default) | No merge handling at all. Marco merges everything. |
| `all` | Legacy blanket mode: enable auto-merge (squash) on every PR the agent opens, wait for merge, sync main. CI red → quarantine; timeout/closed → `blocked/` + queue pause. |
| `tests-docs` | Auto-merge (squash) **only when ALL of**: checks green; diff touches ONLY `tests/**` and/or `docs/**` (via `gh pr view --json files`); no migration files anywhere in the diff; verdict file `docs/pr-reviews/pr-{N}-review.md` exists and starts a line with `VERDICT: MERGE`. Anything else stays open for Marco (prompt still files to `processed/` — the agent's work succeeded). |

Under `tests-docs`, a non-qualifying diff is detected immediately (no
waiting). A qualifying diff polls until checks are green **and** the MERGE
verdict file appears, up to `PR_WATCHER_MERGE_TIMEOUT_MIN`; a timeout hands
the PR to Marco rather than blocking the queue.

Review jobs (`rev-*`) always skip merge handling entirely, under every policy.

## Auto-update-branch

With `PR_WATCHER_AUTO_UPDATE=true`, every `PR_WATCHER_UPDATE_POLL_SEC` seconds
the watcher lists your open PRs (`gh pr list --author @me`) and runs
`gh pr update-branch N` on any with merge state `BEHIND`. PRs with conflicts
(`DIRTY`) are skipped with a log line — update-branch can't resolve conflicts;
those need a human rebase.

## Failure quarantine and transient retry

When a prompt run exits non-zero (and isn't a usage-limit soft-halt), or its
PR's CI lands red under an auto-merge policy:

1. **Transient check**: if the failure output matches a transient signature
   (`PR_WATCHER_TRANSIENT_PATTERNS`), the prompt gets **one** automatic
   retry — it stays in `docs/pr-prompts/` and re-enters the queue.
2. **Quarantine** (no signature match, or second failure): the prompt moves
   to `docs/pr-prompts/failed/` with two siblings:
   - `{name}.log` — full agent output (existing behaviour)
   - `{name}.report.md` — last 50 lines of agent output, the PR number if one
     was opened, and `gh pr checks` output for the failing checks
3. Retry counts are in-memory per prompt name; restarting the watcher resets
   them (the restart itself is the manual intervention).

## Heartbeat

While an agent is running, the watcher appends a line to
`scripts/pr-watcher/heartbeat.log` every 60 seconds:

```
[2026-06-12T08:14:02.113Z] pr-201-foo-ready.md elapsed=420s last: <snippet of the agent's last output line>
```

LL-25: silence ≠ hang — glance at the heartbeat to tell a thinking agent from
a dead one. The log self-truncates to its last 500 lines.

## Queue order

`rev-*` review jobs always jump to the front (verdicts unblock merges).
Everything else runs in **lexicographic filename order** — your numbering IS
the ordering, so `pr-201-…` runs before `pr-210-…` regardless of which file
landed in the directory first. Combined with front-matter dependency gating,
this makes multi-prompt weekend waves deterministic.

## Optional: root npm script

Add to `C:\ProjectOperations2\package.json` under `"scripts"`:

```json
"pr:watch": "node scripts/pr-watcher/index.mjs"
```

Then `pnpm pr:watch` from anywhere in the repo starts it.

## Safety notes

- **One agent at a time.** Two `-ready.md` files dropped together are
  queued, not raced. Branches don't collide.
- **No auto-merge by default.** `PR_WATCHER_AUTO_MERGE_POLICY` defaults to
  `off` — every PR waits for Marco. See the policy matrix above before
  enabling `tests-docs` or `all`.
- **Cost cap.** `--max-turns` is the hard stop. A thrashing agent dies at
  the cap instead of burning the budget.
- **Failure isolation.** A failed run moves the prompt to `failed/` so the
  queue keeps draining. Read the `.log` next to it to diagnose.
- **Drafts are safe.** The watcher ignores anything without the `-ready.md`
  suffix. Cowork can rewrite a draft as many times as it wants without
  triggering execution.
- **Debounce.** A 800ms debounce per filename means saves/atomic-renames
  don't double-fire.

## Usage / rate limit handling

If the underlying Claude session hits a usage or rate limit mid-prompt, the
watcher detects the pattern in the agent's output and **soft-halts** rather
than cascading. Specifically:

1. The current prompt is **left in `docs/pr-prompts/`** (NOT moved to
   `failed/`). A sibling `.usage-limit.log` is written next to it with the
   full agent output for diagnostics.
2. The watcher logs a `[USAGE_LIMIT]` line and **exits with code 2**.
3. All other `-ready.md` files queued at the time stay in place.

To resume after the limit resets: just restart the watcher. The prompt that
was halted gets picked up first.

The detection regex matches common usage/rate-limit message shapes:
`usage limit`, `rate limit`, `429`, `quota exceeded`, `credit balance`,
`monthly usage`, etc. Also `hit your limit` (added per ledger LL-28, which misfiled ~47 prompts as hard failures); relatedly, the "branch: prune" VS Code task now runs on Windows PowerShell 5.1 and uses a gone-upstream sweep so squash-merged local branches are pruned too.

## Periodic rescan

`fs.watch` can silently drop events on Windows (especially over network
shares or after a long idle period). To survive that, the watcher walks
`docs/pr-prompts/` every **5 minutes** and queues any `-ready.md` file it
finds that isn't already queued or in flight. Rescan-sourced enqueues are
tagged in the log as `source: rescan`, so they're distinguishable from
fs.watch events (`source: watch`) and the startup directory walk
(`source: startup-scan`).

## Zombie processes

On startup (Windows only), the watcher enumerates running `claude.exe`
processes and **warns** if any are present from a previous watcher run
(orphans from a kill, a crash, or a Task Scheduler restart). It does
**not** auto-kill them — you may have intentionally-launched `claude`
sessions that aren't the watcher's. To clean them up:

```powershell
Get-Process claude | Stop-Process -Force
```

## Nightly mode (Windows Task Scheduler)

Use `scripts/pr-watcher/start-nightly.ps1` as a wrapper. It:

- **Pre-flights** — refuses to start if working tree is dirty or not on `main`
- **Single-instance guards** — refuses to start a second watcher if one is already running
- **Logs to a daily file** — `scripts/pr-watcher/logs/YYYY-MM-DD.log`
- Defaults to `PR_WATCHER_STOP_AT=06:00` so the watcher exits before business hours
- Defaults to `PR_WATCHER_AUTO_MERGE=false` (review-only — safer for unattended overnight runs)

Default nightly window: **18:00 → 06:00** (12 hours of unattended processing).

### Schedule it (manual setup, once)

Open Task Scheduler → Create Basic Task:

| Field | Value |
|---|---|
| Name | `PR Watcher Nightly` |
| Trigger | Daily at `18:00` (6 PM) — gives a 12-hour window before the 06:00 cutoff |
| Action | Start a program |
| Program | `powershell.exe` |
| Arguments | `-NoProfile -ExecutionPolicy Bypass -File "C:\ProjectOperations2\scripts\pr-watcher\start-nightly.ps1"` |
| Start in | `C:\ProjectOperations2` |

Under the task's properties:

- ✅ **Run whether user is logged on or not**
- ✅ **Run with highest privileges**
- Conditions → ⬜ Start only if on AC power (uncheck so it runs on battery if needed)

### Verify it works

Run manually first:

```powershell
cd C:\ProjectOperations2
.\scripts\pr-watcher\start-nightly.ps1
```

You should see the banner + the watcher's normal startup log, mirrored to today's log file.

## Recovering from a failure

```powershell
# Diagnose
cat C:\ProjectOperations2\docs\pr-prompts\failed\pr-15-foo-ready.md.log

# Either fix the prompt and re-queue
Move-Item C:\ProjectOperations2\docs\pr-prompts\failed\pr-15-foo-ready.md `
          C:\ProjectOperations2\docs\pr-prompts\

# Or abandon
Remove-Item C:\ProjectOperations2\docs\pr-prompts\failed\pr-15-foo-ready.md*
```

## Auto-review mode

When `PR_WATCHER_AUTO_REVIEW=true`, the watcher polls GitHub every
`PR_WATCHER_REVIEW_POLL_SEC` seconds for open, non-draft PRs targeting `main`.
For each new PR it finds, it writes a review prompt file:

```
docs/pr-prompts/rev-{N}-ready.md
```

The `rev-` prefix distinguishes machine-generated review jobs from your
hand-staged `pr-NN-{slug}-ready.md` authoring prompts at a glance.

**Back-compat:** any `pr-{N}-auto-review-ready.md` file already on disk from
a previous watcher run is still detected and treated as a review job. No
manual rename needed.

The normal `fs.watch` + queue machinery picks it up like any other prompt, so
reviews serialize with authoring jobs — a review never runs concurrently with
a coding agent.

### Review-priority queue

Review jobs jump the queue. When a `rev-*-ready.md` file arrives, it is
inserted at the front of the in-memory queue (after any other review jobs
already waiting), rather than pushed to the back. The currently-running job is
never interrupted; the **next free slot** goes to a verdict rather than another
authoring job. Rationale: review verdicts unblock Marco's merges, while
authoring jobs can safely wait one slot.

### Reviewed-set seeding

On startup (first time `AUTO_REVIEW` is enabled), the watcher fetches the 50
most recent PRs (open + merged) via `gh pr list --state all --limit 50` and
adds them all to a local reviewed-set stored in
`scripts/pr-watcher/.reviewed-prs.json`. Only PRs that appear **after** the
watcher starts get auto-reviewed. Re-enabling on an existing repo never reviews
historical work.

The state file is written atomically (temp file + rename) and is `.gitignore`d
— it's machine-local.

### Do-not-merge guarantee

Review jobs skip the `AUTO_MERGE` block entirely. A review job's output
mentions the PR it reviewed, but the watcher never tries to merge it — Marco
merges manually after reading the verdict in `docs/pr-reviews/`.

If a review job fails, the watcher moves the prompt to `failed/` as normal but
**does not pause the authoring pipeline**. A broken review job is isolated.

### Verdict files

The reviewer writes its output to `docs/pr-reviews/pr-{N}-review.md`. If the
verdict is `FIX` or `BLOCK`, a second file lands in
`docs/pr-prompts/needs-marco/pr-{N}-review-{fix|block}.md` so it surfaces in
the normal escalation funnel.

### Verdict mirroring

When a review job exits 0, the watcher mirrors the verdict file
(`docs/pr-reviews/pr-{N}-review.md`) into a PR comment via
`gh pr comment {N} --body-file <temp>`, prefixed with an ASCII
`[watcher verdict]` header line. This makes the verdict readable from the
GitHub mobile app, so the remote workflow (notification → read verdict →
checks green → merge) needs no local file access.

- **What posts**: the full verdict file content, only after the review job
  succeeds and only if the verdict file exists. The review agent itself still
  never comments — the watcher posts after the fact.
- **Failure behaviour**: best-effort. A missing verdict file or a failed
  `gh pr comment` logs a `[review]` warning and continues; the review job is
  never failed over the mirror step. The verdict file stays the source of
  truth.
- **Idempotency**: no mirrored-state tracking. Restarting the watcher
  mid-review can rarely re-run the job and post a duplicate comment —
  accepted as harmless.
- **Gates safety**: PR comments are not scanned by the gates (pr-gates reads
  only the PR body), so verdict text containing checklist or GATE-ALLOW
  wording cannot trip CP-22/CP-09 on gate re-runs.
- **Restart required**: a running watcher must be restarted to pick up this
  behaviour.

### Double-start guard

The watcher writes a lockfile (`scripts/pr-watcher/.watcher.lock`) containing
its PID at startup. If the lockfile already exists and the recorded PID is
alive (`process.kill(pid, 0)`), the new instance logs a warning and exits
cleanly. A stale lockfile (dead PID) is overwritten and the new instance
continues normally.

### VS Code auto-start

The `.vscode/tasks.json` task `PR Watcher (auto-review)` launches the watcher
with `PR_WATCHER_AUTO_REVIEW=true` automatically when the folder opens.
**VS Code only runs folder-open tasks in trusted workspaces** — if you see a
"This workspace is not trusted" banner, click "Trust Workspace" first.

### First-enable runbook

1. Merge this PR.
2. Open `C:\ProjectOperations2` in VS Code (trusted workspace).
3. The `PR Watcher (auto-review)` task starts automatically in a dedicated
   terminal pane. It seeds the reviewed-set and then watches for new PRs.
4. Open any new non-draft PR targeting `main`. After the `REVIEW_MIN_AGE_MIN`
   grace period (default 2 min), a review prompt file appears and the queue
   fires the reviewer.
5. Check `docs/pr-reviews/pr-{N}-review.md` for the verdict. Marco merges.

To stop: Ctrl+C in the watcher terminal pane.

## What it doesn't do

- **Doesn't watch subfolders.** Only the top level of `docs/pr-prompts/`.
- **Doesn't notify externally.** No Slack/email on failure — surface
  failures by glancing at the `failed/` folder or piping the daemon's
  stdout to a log file.
- **Doesn't restart on crash.** If the watcher itself dies, restart it
  manually. Consider `pm2` or a Windows service wrapper for unattended
  uptime.
