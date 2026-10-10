# Station 00 — Supervisor | 2026-10-10 (UTC time of day NOT MEASURABLE) — run ended at PREFLIGHT step 1

BLIND: `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`

## GROUND

```
UTC            [CANNOT MEASURE] — no shell of any kind; date is 2026-10-10 from the session env only
origin/main    [CANNOT MEASURE] — no shell, therefore no fetch and no rev-parse
dev tree       [CANNOT MEASURE] — C:\ProjectOperations2 is READABLE by file tools; branch/SHA require git
doc version    1   (from the WORKING COPY of docs/pipeline/stations/00-supervisor.md — NOT from origin/main; freshness unverified)
bootstrap      1
```

Doc version and bootstrap AGREE (1 == 1), so no version-mismatch read-only clamp. That agreement is
worth nothing on its own: PREFLIGHT step 2 requires reading the station doc from
`git show origin/main:<path>`, which was impossible this run, and the doc itself records that a
version match is not a freshness proof.

## WHAT I MEASURED

1. **Device tool schemas — loaded first, per BOOTSTRAP_PREFLIGHT_V1.** [MEASURED]
   One keyword `ToolSearch` for `desktop-commander`, then a second for
   `desktop-commander start_process`. Both returned `No matching deferred tools found`, each with
   the same explicit server-level failure:
   `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server
   plugin:desktop-commander:desktop-commander connection timed out after 30000ms"`.
   No `start_process` tool, under any id, was offered. This is **not** an unloaded-schema
   `InputValidationError` — the load itself reported the server down, which the contract counts as
   blindness, not as a validation error.

2. **Retry honoured, per BOOTSTRAP_CONNECT_RETRY_V1.** [MEASURED] A ~60 s gap separated the two
   `ToolSearch` calls (consumed by a shell call that itself timed out). Second attempt identical.

3. **The Linux sandbox shell is ALSO down.** [MEASURED] `mcp__workspace__bash` was called twice —
   once for `sleep 60; ls <mount>`, once for a bare `date -u` — and both returned
   `request timed out after 30s. The workspace did not confirm the command started before the
   timeout`. So there was no second lane to fall back to, and no shell existed in which to run
   `vm-git-guard.sh`.

4. **The git guard could not be installed.** [CANNOT MEASURE] `bash
   "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` requires a shell. There is no
   installer last line and no exit code to quote this run. Per the station doc this is a FINDING,
   not a stop in itself — the stop comes from the unreachable Windows host. Note that a guard that
   could not be installed is **not** a licence to run `git` against the mount, and none was run.

5. **File tools DO reach the dev tree.** [MEASURED] `Read` of
   `C:\ProjectOperations2\docs\pipeline\stations\00-supervisor.md` returned 467 lines, front matter
   `station_doc_version: 1`, `contract_version: 5`. This is read-only coverage of the working copy
   only. It is explicitly **not** offered as coverage of the run: without a shell there is no
   `git fetch`, no `rev-parse`, no `status-sweep.ps1`, no `check-breadcrumb.mjs --freshness`, no
   `Enter-BoardLease`, no `Assert-SmokedOrEscalate`, no `Merge-Pr`, no `arm-prompt.ps1`. Station
   00's entire lane — ARM, DISPATCH, MERGE — is unavailable.

6. **Other servers reported down in the same breath, recorded for pattern only.** [MEASURED]
   `plugin:prisma:Prisma-Local (CONNECT_TIMEOUT)`, `plugin:data:definite (ENDPOINT_NOT_FOUND)`, and
   four servers refused for `does not support dynamic client registration`
   (`small-business:xero`, `small-business:zoom`, `engineering:pagerduty`, `finance:bigquery`).
   Desktop Commander and Prisma-Local both failing with `CONNECT_TIMEOUT` at 30 s, alongside both
   `mcp__workspace__bash` timeouts, is consistent with a session-wide transport problem rather than
   anything specific to Desktop Commander — but that is [INFERRED], from three instruments that
   were all down, and it is not a diagnosis.

## WHAT CHANGED

**Nothing.** No arm, no dispatch, no merge, no label change, no branch update, no lease taken, no
scheduled task touched, no `/sot/` edit, no git command of any kind in any tree. The only write this
run is this breadcrumb file itself, created with the file tool at a tracked path in the dev tree.

## FINDINGS

**F1 — Station 00's 2026-10-10 occurrence was BLIND: no shell on either lane.**
Desktop Commander timed out at 30 s on two loads 60 s apart, and `mcp__workspace__bash` timed out at
30 s on two separate calls. The Windows host was never reached, so the station's whole lane was
unavailable. This run produced "no news" **because it could not look**, not because the board is
quiet — the two are indistinguishable downstream, which is why it is stated this loudly.
**DISPOSITION: ESCALATED** — Marco. Question, with options, in `## FOR MARCO` below.

**F2 — The device-bridge git guard was not installed this run, and could not be.**
No shell existed to run `vm-git-guard.sh`, so there is no last line and no exit code to quote. No
`git` ran against the mount, so no `index.lock` risk was taken. Recorded because the station doc
requires the installer's outcome in every report, and an absence that is not stated reads as an
install nobody can see.
**DISPOSITION: DEFERRED** — it resolves itself on the first run that reaches a shell. It becomes
urgent if a later run reports reaching a shell while still showing no guard outcome, which would
mean the step is being skipped rather than blocked.

**F3 — COLLECT did not run, so every station breadcrumb since the last Station 00 run is still
unread and undispositioned.**
`node scripts/pipeline/check-breadcrumb.mjs --freshness` needs a shell, and `list_scheduled_tasks`
cross-checking is pointless without it — a freshness table with no breadcrumb side is not a reading.
COLLECT is the only channel that closes for 03/04/05, so whatever they reported is still waiting.
**DISPOSITION: DEFERRED** — to the next Station 00 occurrence that reaches a shell, which must
COLLECT across the whole gap, not just since its own last run. It becomes urgent if two consecutive
Station 00 occurrences go blind, because then no station's findings are being read at all.

**F4 — This breadcrumb is UNTRACKED in the dev tree and needs sweeping up.**
Written to `docs/pr-prompts/00-00-supervisor-2026-10-10-0000-blind-no-shell.md` with a file tool,
because no shell was available to open a PR or a worktree. Two consequences, both stated so the next
station is not surprised: (a) it is invisible to `main` until `sweep-breadcrumbs.ps1` batches it, and
(b) per the station doc, an untracked file at a path a later fast-forward must create will block
`git merge --ff-only` while `git diff --numstat` and `--cached` both read EMPTY. The HHMM in the
filename is `0000` — a placeholder, not a measurement; UTC time of day was not obtainable without a
shell, and a plausible-looking invented time would be worse than an obvious placeholder.
**DISPOSITION: DISPATCHED** — to the next Station 00 run: sweep this breadcrumb into a board PR,
and if the fast-forward refuses, this file is a candidate blocking path.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for the run.** The GitHub MCP tools were available and were
  deliberately left alone. `origin/main` is not the tree the watcher globs, and a PR list dressed up
  as a board report is the specific failure the stop rule exists to prevent.
- **Did not improvise the station's behaviour from the bootstrap.** The bootstrap does not contain it.
- **Did not read the station doc or DOCTRINE from `origin/main`**, as PREFLIGHT step 2 requires. The
  working copy was read once, only far enough to establish what a blind run owes. Nothing in this
  report rests on the working copy's correctness.
- **Did not run `git` anywhere** — not in the dev tree, not against the mount, not via any bridge.
- **Did not arm, merge, dispatch, update a branch, change a label, take the board lease, or touch
  `/sot/`.** All of these require the shell that was missing, and all of them require a `[LIVE]`
  sweep verdict measured immediately beforehand, which did not exist.
- **Did not disable, enable, re-run or edit any scheduled task.** Forbidden on this reading
  (DOCTRINE §7), and nothing measured this run would justify it anyway.
- **Did not write the report to the Cowork session's `outputs` folder.** Measured 2026-09-22: a blind
  run put a complete report there and it reached nobody.

## FOR MARCO

**Question: Station 00 went fully blind this occurrence — no Windows host shell and no Linux sandbox
shell — and the blind rate is already around 40% of recent runs with an unknown cause. Do you want
blindness made loud outside the breadcrumb, or left as it is?**

**Option A (complete and additive — recommended).** Make a blind run self-reporting without changing
any station's behaviour. Two parts, both additive: (1) the breadcrumb filename carries a `blind`
marker that `check-breadcrumb.mjs --freshness` counts separately, so consecutive blind runs surface
as their own number rather than hiding inside "reported"; (2) N consecutive blind occurrences for any
station escalates on its own. Nothing is removed, no existing reading changes meaning, no data-entry
path is touched, and a blind run stops looking like a quiet one at the only place that currently
cannot tell the difference. Needs your ruling on N before it can be written; 2 matches the existing
"never fired twice ⇒ escalate" rule.

**Option B — investigate the transport first, change nothing.** Three instruments timed out at 30 s
in one session (Desktop Commander, Prisma-Local, the workspace shell), which points at the session
transport rather than at Desktop Commander. Diagnosing a ~40% intermittent failure is open-ended
and, until it is fixed, every blind run still reads downstream as a quiet one. **Fails the "future"
half of RULE 1** while the investigation runs — it leaves the blind-looks-quiet gap open for the
whole of it. Worth doing *alongside* A, not instead of it.

**Option C — accept it.** No work. **Fails both halves of RULE 1:** blindness keeps presenting as
"no news" immediately, and keeps doing so indefinitely. Listed only so the choice is complete.

None of the three touches Azure, Entra, SharePoint, or production data.
