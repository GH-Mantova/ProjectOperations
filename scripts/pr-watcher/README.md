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
5. **On failure** (non-zero exit): both move to `docs/pr-prompts/failed/`.

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
[2026-05-29T12:01:33Z] [watcher] pattern: pr-*-ready.md
[2026-05-29T12:04:11Z] [queue] pr-15-hide-duplicate-quote-preview-block-ready.md (depth: 1)
[2026-05-29T12:04:11Z] [start] pr-15-hide-duplicate-quote-preview-block-ready.md (max-turns=120)
...
[2026-05-29T12:18:44Z] [ok] pr-15-hide-duplicate-quote-preview-block-ready.md → processed/
```

Ctrl+C to stop.

## Configuration

Env vars override the defaults:

| Env var | Default | Effect |
|---|---|---|
| `PR_WATCHER_MAX_TURNS` | `120` | Agent hard cap per run. Bump for big PRs. |
| `PR_WATCHER_CLAUDE_BIN` | `claude` | Override if `claude` isn't on PATH. |
| `PR_WATCHER_AUTO_MERGE` | `false` | Auto-merge is **opt-in**. Set to `"true"` only for unattended chain runs. The review-gated workflow leaves this off so every PR waits for Marco's manual merge. |
| `PR_WATCHER_MERGE_TIMEOUT_MIN` | `90` | Max wait for a PR to merge after CI starts. |
| `PR_WATCHER_POLL_INTERVAL_SEC` | `60` | How often to poll PR state during merge wait. |
| `PR_WATCHER_STOP_AT` | _(unset)_ | Nightly cutoff `HH:MM` (24-hour, local). Past this, watcher won't start a new prompt and exits cleanly with code 0. In-flight prompt finishes. |
| `PR_WATCHER_AUTO_REVIEW` | `false` | Set to `"true"` to poll GitHub for new PRs and auto-fire reviews. |
| `PR_WATCHER_REVIEW_POLL_SEC` | `90` | How often (seconds) to poll GitHub for new PRs to review. |
| `PR_WATCHER_REVIEW_MIN_AGE_MIN` | `2` | Grace period (minutes) — skip PRs younger than this. Gives the authoring agent time to finish post-PR steps before the reviewer fires. |

Example:

```powershell
$env:PR_WATCHER_MAX_TURNS = "200"
node C:\ProjectOperations2\scripts\pr-watcher\index.mjs
```

## Optional: root npm script

Add to `C:\ProjectOperations2\package.json` under `"scripts"`:

```json
"pr:watch": "node scripts/pr-watcher/index.mjs"
```

Then `pnpm pr:watch` from anywhere in the repo starts it.

## Safety notes

- **One agent at a time.** Two `-ready.md` files dropped together are
  queued, not raced. Branches don't collide.
- **No auto-merge.** Current prompts already instruct the agent to open the
  PR but NOT auto-merge. Owner verifies live and merges manually.
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
`monthly usage`, etc.

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
docs/pr-prompts/pr-{N}-auto-review-ready.md
```

The normal `fs.watch` + queue machinery picks it up like any other prompt, so
reviews serialize with authoring jobs — a review never runs concurrently with
a coding agent.

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
