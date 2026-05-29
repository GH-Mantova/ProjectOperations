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

## What it doesn't do

- **Doesn't watch subfolders.** Only the top level of `docs/pr-prompts/`.
- **Doesn't notify externally.** No Slack/email on failure — surface
  failures by glancing at the `failed/` folder or piping the daemon's
  stdout to a log file.
- **Doesn't restart on crash.** If the watcher itself dies, restart it
  manually. Consider `pm2` or a Windows service wrapper for unattended
  uptime.
