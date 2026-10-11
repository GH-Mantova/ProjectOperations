# Station 00 — Supervisor — BLIND RUN | 2026-10-11T20:09Z–2026-10-11T20:2xZ

BLIND: plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
plugin:desktop-commander:desktop-commander connection timed out after 30000ms"

> RESTRUCTURED, NOT REWRITTEN. The 21:14Z Station 00 run found this breadcrumb REJECTed by
> `check-breadcrumb.mjs` (missing WHAT I MEASURED / WHAT CHANGED / FINDINGS / WHAT I DID NOT DO) and
> renamed its headings to the contract's fixed five. No claim, measurement or disposition below was
> added, removed or altered by that edit; the 20:09Z run's own words are kept. The file was untracked
> at the time of the edit, so no other actor's commit was disturbed.

## GROUND

- UTC (sandbox clock): 2026-10-11T20:09:18Z — NOTE: session env declares host date 2026-10-12. Clock
  skew between the Linux sandbox and the Windows host is unresolved and was not investigable without
  the bridge. Do not use either stamp as a freshness proof.
- origin/main: NOT READ. `git` was not run. See "Why no git" below.
- dev tree: directory listing of `C:\ProjectOperations2` reachable via the Cowork folder mount; no
  git state, no PR state, no board state read.
- station doc version: NOT READ. Version check against bootstrap `station_doc_version: 1` NOT
  PERFORMED.
- bootstrap: `00-supervisor` SKILL.md, `station_doc_version: 1`, BOOTSTRAP_PREFLIGHT_V1 +
  BOOTSTRAP_CONNECT_RETRY_V1 honoured (see below).

## WHAT I MEASURED

### What was attempted, in order

1. BOOTSTRAP_PREFLIGHT_V1 — one keyword `ToolSearch` for `desktop-commander`. Result: no matching
   deferred tools; server reported "still connecting". No tool id was assumed and no device tool was
   called before its schema loaded, so no `InputValidationError` was mistaken for blindness.
   [MEASURED]
2. Second `ToolSearch` (`desktop-commander start_process shell`) — still "connecting". [MEASURED]
3. `mcp__workspace__bash` probe — first attempt timed out at 30s; the same call's result carried the
   first explicit server error: `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT)`.
   [MEASURED]
4. BOOTSTRAP_CONNECT_RETRY_V1 — waited 45s, re-probed the sandbox successfully
   (`2026-10-11T20:09:18Z`, mount lists `PR-Master`, `ProjectOperations2`, `outputs`, `uploads`),
   then re-ran the `desktop-commander` `ToolSearch`. Result: same `CONNECT_TIMEOUT`. [MEASURED]

A failure after a completed load/retry cycle is blindness. `start_process` with `powershell.exe` was
never reachable: the tool does not exist in this session. [INFERRED from 1–4]

### Blindness is bridge-specific, not machine-wide — and that is NOT coverage

Stated plainly so this run is not miscounted in either direction: the Cowork folder mount and the
file tools CAN see `C:\ProjectOperations2`. That is a read path for file contents only. It is NOT the
tree the watcher globs with the tooling the station requires, and nothing in this run was read
through it beyond a top-level directory listing.

Per the bootstrap's explicit instruction, GitHub-side reads were NOT substituted and are NOT
presented as coverage. The GitHub MCP is live in this session and could have returned `main` blobs
and the open-PR list; it was deliberately not used for that, because a GitHub read of `main` is not a
read of the dev tree, and dressing one up as the other is the exact failure the instruction forbids.

### Why no git, and why vm-git-guard.sh was not installed

- The guard install (`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`) is a
  VM-side call that presupposes the bridge. No bridge, no install. Its last line and exit code are
  therefore UNKNOWN — not exit 0, not exit 2. [CANNOT MEASURE]
- Reading the three cores from `git -C C:\ProjectOperations2 show origin/main:<path>` requires `git`
  on the Windows host, which only the bridge provides. [CANNOT MEASURE]
- `git` was NOT run from the Linux sandbox against the Windows `.git`. That is a named hard stop: it
  leaves a 0-byte `index.lock` with no owning process, which never expires and freezes every station.
  A fetch would also have written refs. Freezing the pipeline to produce a status line would have
  cost more than the status line is worth.

## WHAT CHANGED

Nothing. No board mutation, no git mutation, no label change, no arm, no merge, no `/sot/` edit. The
only write of this run was this breadcrumb file itself, written untracked into the dev tree with a
file tool.

## FINDINGS

**F1 — Device bridge (`desktop-commander`) CONNECT_TIMEOUT twice, 45s apart, after preflight and the
sanctioned retry.** Station 00 could not run its lane.
ESCALATED — Marco. Bridge availability is host/config, outside agent reach.

**F2 — Breadcrumbs since the last Station 00 run are uncollected; this slot's COLLECT did not
happen.**
DEFERRED — to the next Station 00 run that reaches the box.

**F3 — `vm-git-guard.sh` state unknown for this run** (not installed, not probed).
DEFERRED — next sighted run must install and quote it.

**F4 — Clock skew: sandbox UTC 2026-10-11T20:09Z vs session-declared host date 2026-10-12.**
Unresolved here. A wrong clock corrupts every missed-occurrence verdict, which is the same class of
bug as the cadence error #2090 fixed.
DEFERRED — worth a deliberate check on a sighted run.

**F5 — Bootstrap/station-doc version agreement UNVERIFIED** (station doc unread). Any later claim
that version 1 is current must not cite this run.
DEFERRED.

## WHAT I DID NOT DO

Station 00's lane is ARM, DISPATCH, MERGE. All three are unreachable without the bridge:

- COLLECT: no station breadcrumbs were read. Any breadcrumb written since the last Station 00 run is
  still uncollected and still carries no disposition. **This is the finding most likely to rot.**
- ARM: nothing armed.
- DISPATCH: nothing dispatched. 02/03/04/05 work was neither done nor delegated — and per LL-38 it
  was correctly not done here.
- MERGE: nothing merged. No `Assert-SmokedOrEscalate`, no `Merge-Pr`, no `smoke-pr.ps1`. No PR was
  touched, no label was added or removed, no `do-not-merge` label was disturbed.
- `/sot/` untouched. No production data written. No Azure / Entra / SharePoint action of any kind.

### Note for whoever reads this next

This file was UNTRACKED and UNCOMMITTED when written. It was written with a file tool directly into
the working tree; the git index was not touched, nothing was staged, and no PR was opened. Committing
it needs a run that can reach git safely. It is named to the breadcrumb convention
(`00-00-<station>-<date>-<time>-<slug>.md`) so Station 06's prompt globs read it as a breadcrumb and
not as an armed prompt. It is not in any of the five gitignored QA sinks anchored by the
`# Overnight-QA scheduled task` comment in `.gitignore`.

Cadence note, per the bootstrap's own warning: no missed-occurrence verdict is computed here. The
hourly figure in the bootstrap prose is not a source of truth and `list_scheduled_tasks` was not
consulted, because a cadence number without a trustworthy clock is worse than none.
