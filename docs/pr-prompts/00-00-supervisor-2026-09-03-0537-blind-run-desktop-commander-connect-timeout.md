# Station 00 — Supervisor | 2026-09-03T05:37Z–05:42Z

**BLIND RUN. Nothing was collected, armed, dispatched or merged. This is a defect report, not coverage.**

## GROUND

```
UTC            2026-09-03T05:37:36Z   (scheduled fire; task 00-supervisor, cron 5 * * * *)
origin/main    [CANNOT MEASURE]       — no shell on the box; git is barred against the mount
dev tree       main @ [CANNOT MEASURE] C:\ProjectOperations2  (HEAD reads ref: refs/heads/main)
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (scheduled-task SKILL.md)
```

Doc version and bootstrap **agree** — no read-only downgrade on that account. The run is read-only
anyway, because preflight step 1 failed.

## WHAT I MEASURED

- **[MEASURED] Preflight step 1 FAILED after loading the schemas, both ways the doc names.**
  Step 1's own warning — *"Declaring blindness without loading first is a §7 instrument lie"* — was
  obeyed. Two distinct `ToolSearch` loads were attempted:
  - `select:mcp__desktop-commander__start_process,…` → `No matching deferred tools found`
  - `select:mcp__remote-devices__plugin_desktop-commander_desktop-commander__start_process,mcp__remote-devices__device_bash`
    (the exact selector printed in the station doc) → `No matching deferred tools found`

  The server itself then reported, unprompted:
  `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server ... connection timed out after 30000ms"`.
  A retry after a 45 s wait produced the same. **This is an unreachable machine, not an unloaded
  schema** — the distinction step 1 demands be made, made explicitly.

- **[MEASURED] This is NOT a repeat of the 09-02 all-stations-disabled incident.** All five
  scheduled tasks read `enabled: true`:

  | task | cron | lastRunAt (UTC) | nextRunAt (UTC) |
  |---|---|---|---|
  | `00-supervisor` | `5 * * * *` | 2026-09-03T05:37:36Z (this run) | 06:07:52Z |
  | `04-scanner` | `0 */4 * * *` | 2026-09-03T02:45:35Z | 06:09:31Z |
  | `03-machine-minder` | `0 9 * * *` | 2026-09-01T23:01:43Z | 2026-09-03T23:00:45Z |
  | `05-sot-keeper` | `10 0 * * *` | 2026-09-01T14:11:31Z | 2026-09-03T14:10:37Z |
  | `weekly-security-audit` | `30 7 * * 1` | 2026-09-02T23:58:18Z | 2026-09-06T21:32:17Z |

  Recorded so the next run does not re-diagnose this as the disabled-window defect. The 00 cron is
  confirmed **hourly** again (`5 * * * *`).

- **[MEASURED] `03` and `05` each missed exactly one fire, and both misses fall inside the known
  09-02T07:19Z→23:57Z disabled window.** `03` fires 23:00Z (disabled at 09-02T23:00Z, re-enabled
  23:57Z); `05` fires 14:10Z (disabled at 09-02T14:10Z). No new cause needed. As of now `05` has not
  run for ~39 h and `03` for ~30 h; both self-heal at today's fire.

- **[MEASURED] LEAD CLOSED — the `station-contract v2` / `contract_version: 1` mismatch is NOT drift.**
  All seven station docs carry `station_doc_version: 1`, `contract_version: 1`, and a canonical block
  labelled `station-contract v2`, **uniformly**. The block label and the front-matter key are
  independent counters. Recorded so no future run spends a cycle on it.

- **[MEASURED] `lint-station.mjs` calls `execSync('git ls-files')` (`:54`).** Confirms it cannot be
  run from a blind session, since git is barred against the mount. Same for `check-breadcrumb.mjs`.
  **No `breadcrumb-clean` claim is made in this report, and none may be inferred from it.**

- **[CANNOT MEASURE]** Board state, open PRs, lock files, the prompt queue, arming candidates, the
  watcher process, `status-sweep.ps1`, and every station breadcrumb written since the last run.
  Preflight steps 2–4 were not reached. Per step 1, **GitHub-side reads were deliberately NOT
  substituted** — `origin/main` is not the tree the watcher globs, and presenting them as coverage is
  the failure mode step 1 exists to prevent.

## WHAT CHANGED

**Nothing.** No arm, no dispatch, no merge, no label, no commit, no push, no board mutation of any
kind. The only write this run performed is this file.

## FINDINGS

**F1 — Station 00 was blind again; escalation #17 recurs, and the heartbeat detector is its casualty.**
`desktop-commander` timed out at 30 s, both namespaces, with a retry. This is the ~40%-of-runs
intermittent blindness already open as #17 in `needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`.
The compounding harm is specific and worth stating plainly: **`check-breadcrumb --freshness` has
exactly one consumer — Station 00 — so every blind 00 run is also a run where the staleness detector
does not fire.** The detector and the thing most likely to be broken share a single point of failure.
That is the argument for the out-of-band GitHub-Actions heartbeat already recommended in
`needs-marco/all-stations-disabled-16h-…-2026-09-03.md`; today is a second, independent reason for it.
No new question is put to Marco — #17 and the heartbeat escalation both already carry their options,
and re-asking would be a status update, not a question.
**→ ESCALATED** (amends the open #17 with a dated recurrence, 2026-09-03T05:37Z; does not open a new item)

**F2 — `05-sot-keeper` has not run since 2026-09-01T14:11Z (~39 h) and `03-machine-minder` since
2026-09-01T23:01Z (~30 h).** Cause is established, not open: one missed fire each, both inside the
09-02 disabled window. Both are enabled with valid `nextRunAt` today. What would make this urgent is
either missing *today's* fire too — `05` at 14:10Z, `03` at 23:00Z — which would mean the miss is not
explained by the disabled window after all.
**→ DEFERRED** (re-check after 2026-09-03T23:00Z; escalate only if a second consecutive fire is missed)

## WHAT I DID NOT DO

- **Did not substitute GitHub-side reads for board coverage.** Explicitly barred by preflight step 1.
  A blind run and a healthy quiet run both produce "no news"; this was the blind one.
- **Did not run `git`, `check-breadcrumb.mjs`, `lint-station.mjs`, `lint-prompt.mjs`, `status-sweep.ps1`
  or `triage-holds.ps1`.** Git against the device-bridge mount leaves a 0-byte `index.lock` with no
  process behind it, which never expires and freezes every station (open escalation #16).
- **Did not COLLECT.** The five 00 breadcrumbs already on disk from today's sighted 02:46–04:24Z
  sessions were listed by filename only and **not** read, dispositioned, or acted on. Collection needs
  a sighted run — it remains outstanding and is the next sighted 00's first job.
- **Did not arm anything.** In particular `pr-vmguard-s1` — recorded as ADMIT and armable — was left
  alone. Arming requires `arm-prompt.ps1` on the box, and a stale-dev-tree premise check is exactly the
  trap RULE 4 warns about.
- **Did not commit this breadcrumb.** It is written to the tracked *path*
  `docs/pr-prompts/` but is **untracked on disk** — committing needs git. The next sighted station
  should commit it. Until then it will show as an untracked file and can cause a fast-forward failure;
  that is a known blind-run cost, not a new defect.
