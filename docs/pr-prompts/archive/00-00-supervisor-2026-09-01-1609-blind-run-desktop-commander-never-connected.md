# Station 00 — Supervisor | 2026-09-01T16:07Z–2026-09-01T16:15Z

**THIS RUN WAS BLIND. It is not a quiet board — it is an unmeasured one.** No shell on the Windows
host, therefore no `git`, no watcher probe, no arming, no merge, no collect. Read this as a defect
report, not as coverage.

## GROUND

```
UTC            2026-09-01T16:07Z
origin/main    [CANNOT MEASURE] — no shell, and git must never be run against the mount
dev tree       [CANNOT MEASURE] — same reason
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, read from the WORKING COPY)
bootstrap      1   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE. **Caveat, stated because the station doc requires it:** PREFLIGHT
step 2 says read the binding docs from `git show origin/main:<path>`, never from
`C:\ProjectOperations2`. Blind, I could only read the working copy, which may be several commits
behind `main`, and a version match is explicitly NOT a freshness proof. Every quotation below is
from the working copy and carries that risk.

## WHAT I MEASURED

- **[MEASURED] Desktop Commander never connected.** Session startup reported it as still connecting;
  after ~60 s and three tool-discovery attempts it resolved to
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out
  after 30000ms"`. `plugin:prisma:Prisma-Local` timed out in the same window. No `start_process`, no
  `powershell.exe`, no shell of any kind on the box.
- **[MEASURED] The mount is readable.** `/sessions/<id>/mnt/ProjectOperations2/` lists the real dev
  tree (`CLAUDE.md`, `docs/pipeline/stations/` with all six station docs). It is read-write, and it
  is how this breadcrumb was written. `git` was NOT run against it — doing so leaves a 0-byte
  `index.lock` with no process behind it and freezes every station.
- **[MEASURED] Two station breadcrumbs are sitting uncollected in `docs/pr-prompts/`:**
  `00-04-scanner-2026-09-01-1410-gate-liveness-two-shipped-holds-and-a-seven-deep-chain-behind-one-red-pr.md`
  and `00-05-sot-keeper-2026-09-01-1411-sot04-remerged-and-the-encoding-gate-sees-3-of-7.md`.
  The 05 one is the eight-finding breadcrumb that arrived via #1496 after the 14:12Z collect and was
  already carried as UNDISPOSITIONED out of the 14:09–14:38Z run.
- **[CANNOT MEASURE] Everything else.** Watcher liveness, wrapper count, node PID, `index.lock` state
  in either tree, armed-prompt count, the open-PR census, station cadences. RULE 1 of this station
  doc forbids inferring liveness from the Linux sandbox, and I will not launder GitHub-side reads
  into a board report — `origin/main` is not the tree the watcher globs.

## WHAT CHANGED

Two files written, both outside git's index, neither a board mutation:

1. `docs/pr-prompts/00-00-supervisor-2026-09-01-1609-blind-run-desktop-commander-never-connected.md`
   — this breadcrumb. Untracked; a later board PR must sweep it up.
2. `docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`
   — the blindness escalation, which until now existed only in chat memory and had no file.

Nothing else. No PR merged, no label touched, no prompt armed, no worktree created, no `git`
invoked. `breadcrumb-clean` is NOT claimed: `check-breadcrumb.mjs` needs `git` and could not be run.

## FINDINGS

**1. Station 00 was blind again — Desktop Commander connect timeout, the recurring ~40% failure.**
This is the same fault narrowed earlier today: Station 00 was blind 10:05–10:12Z while Station 04
got a shell on the same host at 10:10:55Z, inside that window, so the failure belongs to the SESSION,
not the machine. Nothing in this repo configures that connection, so no prompt, PR or station fix can
reach it. Options are now written down where Marco can act on them, with (A) raise the connect
timeout and pre-warm the server as the complete-and-additive one, (B) retry once after 60 s as a
symptom-only belt, (C) leave it and keep losing ~40% of cadences silently.
**DISPOSITION: ESCALATED** — `docs/pr-prompts/needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.

**2. The COLLECT queue has now been missed for two consecutive cadences.** Station 05's 14:11Z
breadcrumb carries eight findings that no run has dispositioned, and Station 04's 14:10Z breadcrumb
sits beside it. Collecting is the only channel that closes; stations do not read each other's
reports, so an uncollected finding is a finding that has not been made. A blind run cannot
disposition them — reading them is possible, but ACTIONED/DISPATCHED both require the box.
**DISPOSITION: DEFERRED** — first action of the next sighted run, before any board work, ahead of
merging anything. What makes it urgent: a third consecutive miss, or any of the eight findings
turning out to gate a PR already on the board.

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for a board sweep.** PREFLIGHT step 1 forbids exactly that,
  and the reason is sound: a GitHub census would have looked like a normal run's output while
  measuring a different tree.
- **Did not touch the board.** #1483 and #1477 were both Marco's and neither was mergeable by this
  station at last sighting; blind, I could not even confirm they are still the open set.
- **Did not run `git` against the mount, and did not attempt `check-breadcrumb.mjs`, `lint-*.mjs` or
  `arm-prompt.ps1`** — all need `git` in the dev tree, which is the one thing a blind run must not do.
- **Did not collect the two waiting breadcrumbs** — see finding 2.
- **Did not touch escalation #20** (the receipt for #1483's 08:51:48Z label removal). It is Marco's
  in both halves, and no agent may ever author a `merge-approvals/<N>.md`.
