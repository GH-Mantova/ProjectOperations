# docs/pipeline/dispatched/

<!-- DISPATCH_REGISTER_V1 -->

One file per OPEN dispatched finding, written by `scripts/pipeline/dispatch.mjs`.

## What this folder is

When a station hands a finding to another station with disposition DISPATCHED, it calls
`node scripts/pipeline/dispatch.mjs open ... --record-into <PR worktree>` in the same PR that
carries the breadcrumb for the dispatch. The receiving station calls
`node scripts/pipeline/dispatch.mjs close --id <id> ...` in the PR that lands the work.

Each open dispatch file records what was handed over, to whom, and what must be true when it
resolves. This folder is the instrument the sweep reads in Section 5 to report open dispatches
and flag stale ones.

## Front-matter contract

Every open dispatch file uses YAML front matter with these seven fields:

```
---
id: <YYYY-MM-DD>-<to-station>-<slug>
from: <station id>
to: <station number, zero-padded, e.g. 05>
opened_at: <ISO-8601 UTC, seconds precision, no millis>
finding: <one line>
done_when: <one line: what will be true when it lands>
source: <breadcrumb path or PR number that raised it>
---
```

## File naming

`docs/pipeline/dispatched/<YYYY-MM-DD>-<to-station>-<slug>.md`

The id (used by `close --id`) is the basename without `.md`.

## Closing a dispatch

`dispatch.mjs close` rewrites the file atomically (adding `closed_at`, `closed_by`, and
`evidence` fields) and then moves it to `docs/pipeline/dispatched/closed/<same-basename>.md`.

**Never delete a dispatch file.** Closing moves it; it is permanently readable in `closed/`.

## This folder is tracked (not gitignored)

`git check-ignore` exits 1 (not ignored) for files in this folder. Open dispatch files are
tracked on `origin/main` so the sweep can read them with `git show origin/main:<path>`.
Closed files under `closed/` are likewise tracked.

## Before reporting a dispatch as missing

Check `docs/pipeline/dispatched/closed/` on `origin/main` for the dispatch id. A file there
means it was deliberately closed by the receiving station. This avoids false "dispatch
disappeared" findings.
