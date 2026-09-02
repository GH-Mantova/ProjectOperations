# Station 00 — 2026-09-01T22:05–22:12Z — BLIND RUN (third of the day)

**Version check:** bootstrap `station_doc_version: 1`, `docs/pipeline/stations/00-supervisor.md`
declares `station_doc_version: 1`. **They agree.** No read-only downgrade on that account — the run
is read-only because it is blind, not because of a version mismatch.

## GROUND

```
UTC            2026-09-01T22:05Z–22:12Z
origin/main    [CANNOT MEASURE] — blind run, no git
dev tree       [CANNOT MEASURE] — blind run, no git
doc version    1
bootstrap      1
```

**Version check:** bootstrap and station doc both declare `station_doc_version: 1`. They agree.
This run was read-only because it was **blind**, not because of a version mismatch.

## WHAT I MEASURED

**STEP 1 FAILED. THIS WAS A BLIND RUN, NOT A QUIET ONE.** No shell was ever obtained on the Windows
host. `plugin:desktop-commander:desktop-commander` never connected:

```
plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"
```

Two `ToolSearch` attempts plus a 45 s wait returned no Desktop Commander tools; the third attempt
returned the timeout above. Per PREFLIGHT step 1 the run stopped there.

**What I could NOT reach:** any `start_process` / PowerShell on `C:\ProjectOperations2`; therefore no
`git`, no `triage-holds.ps1`, no `status-sweep.ps1`, no `check-breadcrumb.mjs`, no `lint-*.mjs`, no
`arm-prompt.ps1`, no `smoke-pr.ps1`, no merge primitive, and no process-tree read of the watcher.

**What I COULD reach:** the read-write mount of the real tree at
`/sessions/<id>/mnt/ProjectOperations2/`, for file reads and writes only. Per standing protocol I ran
**no `git` against it** — which is also why this run cannot produce a `breadcrumb-clean` marker.

**No GitHub-side substitution was performed.** `origin/main` is not the tree the watcher globs, and
presenting API reads as coverage is exactly the failure the bootstrap warns about. No board state is
asserted anywhere in this breadcrumb.

## WHAT CHANGED

- Appended the occurrence log and the local-stdio narrowing to
  `docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.
- Wrote this breadcrumb.

## FINDINGS

### F1 — Escalation #17 recurred; third measured occurrence in one day. **ESCALATED**

10:05–10:12Z, 16:07Z, and now 22:05–22:11Z. `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`
now carries an **occurrence log** and a new narrowing (below). A/B/C options are unchanged and still
Marco's; nothing in this repo can reach the MCP connection config.

### F2 — NEW EVIDENCE: the fault is the local stdio launch path, not the network. **ESCALATED**

The session's connection report splits cleanly. The only two servers that failed on **transport**
were the two **local stdio** ones — `desktop-commander` (`CONNECT_TIMEOUT`) and `Prisma-Local`
(`CONNECTION_CLOSED`). Every other failure was a **remote HTTP** server failing on **auth**
(bad Authorization header, or no dynamic client registration) — none of them failed to *connect*.

Both local servers went down together, and this is the **second consecutive occurrence** where
`Prisma-Local` fell in the same window as Desktop Commander (16:07Z and 22:05Z). Combined with the
10:10:55Z measurement — Station 04 held a shell on the *same host* while 00 had none — the fault sits
in **this session's local-server spawn/handshake**, not in the machine and not in Desktop Commander
specifically.

Cheap diagnostic for Marco, needing no change to anything: **when a station reports blindness, check
whether `Prisma-Local` failed in the same run.** If they always fall together, it is one fix.

### F3 — The 20:09Z cadence's dispatches are now uncollected for one full cycle. **DEFERRED**

The previous breadcrumb (`00-00-supervisor-2026-09-01-2009-…`) left live items — the `#1500`
two-part check (did the tests/docs lane auto-merge it; was the `-ready.md` consumed and not looped),
`#1483`'s nine `tendering-e2e` failures, and the still-unowned Station 06 pair. **None were touched
this run** and none should be assumed done. Deferred to the next sighted 00, not dropped.

**This is the cost being escalated in F1, stated plainly:** three of today's Station 00 cadences —
10:0x, 16:0x, 22:0x — collected nothing, dispositioned nothing, armed nothing and merged nothing.
Station 00 is the only station that collects breadcrumbs and the only one that merges.

### Dispositions

| # | Finding | Disposition |
|---|---|---|
| F1 | #17 recurred, third time today | **ESCALATED** — Marco; file updated with occurrence log |
| F2 | Local stdio launch path is the fault; `Prisma-Local` co-fails | **ESCALATED** — Marco; new narrowing + co-failure diagnostic |
| F3 | 20:09Z dispatches uncollected one cycle | **DEFERRED** — next sighted 00 |

## WHAT I DID NOT DO

**Nothing was armed, merged, labelled, dispatched or staged.** No prompt file was moved, no PR was
touched. Both files above are written through the mount and are therefore **UNCOMMITTED** — the next
sighted station must commit them; a blind run cannot.

*Section structure repaired 2026-09-02T00:1xZ by the next sighted Station 00 — the blind run wrote
`## 1. Preflight` / `## 2. Findings` / `## 3. Dispositions` / `## 4. Actions taken`, which
`check-breadcrumb.mjs` REJECTs. All prose above is the blind run's own, verbatim; only the section
headings were remapped onto the five contract sections.*
