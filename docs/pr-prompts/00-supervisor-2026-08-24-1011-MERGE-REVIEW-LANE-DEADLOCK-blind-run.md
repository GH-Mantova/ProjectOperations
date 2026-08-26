# 00-SUPERVISOR — 2026-08-24 10:11Z — MERGE/REVIEW LANE DEADLOCK · BLIND RUN · #1305 ESCALATED

**Nothing was armed, merged, moved or removed this run.** This breadcrumb records a diagnosis only.

## 1. BLIND RUN (third) — Desktop Commander absent

`ToolSearch` for `start_process` / `read_process_output` / `interact_with_process` returned nothing
after every MCP server finished connecting (4 queries, 10:09–10:11Z). No PowerShell on the host, so
no `bring-up-to-speed.ps1`, no Windows `git`, no `gh pr merge`, no `gh run view`. Prior occurrences
08-22 ×2. **This is now a recurring failure mode of the scheduled 00-supervisor run.**

Correctly did NOT substitute VM-side `git` (that is what mints the 0-byte `index.lock`). Only
`stat`/`cat`/`tail`/`find` over the mounted trees were used — no lock created, no git touched.

## 2. 🔴🔴 NEW DEFECT — merge-wait holds the lane its own review job needs

From `C:\po-watcher\watcher-launch.log`:

```
08:23:09Z [merge] pr-lessons-folder-s1-restore-ready.md: opened PR #1305, policy=tests-docs, waiting…
08:24:48Z [review] enqueued review for PR #1305 → rev-1305-ready.md
08:24:48Z [queue] rev-1305-ready.md (depth: 1, BUSY, source: watch)     <-- cannot start
09:08:10Z merge-wait-heartbeat elapsed=2700s
10:05:27Z [merge] …: PR #1305 stays for Marco (timeout waiting for green checks + MERGE verdict)
10:05:32Z [start] rev-1305-ready.md                                     <-- 3 s AFTER the waiter quit
```

The merge step waits for a MERGE verdict from a review job that cannot start because the merge step
holds the lane. `lanes: 2`, yet the review still queued `busy`.

**The "green checks" half of that timeout message is FALSE.** All **11** check runs on head
`8f663011` completed by **08:23:47Z** — 7 success, 4 skipped, **0 failed, 0 pending** — i.e. green
**38 seconds** into the wait. Only the MERGE verdict was missing, because of the deadlock.

**Cost: ~102 minutes of a lane, plus a fully-green PR mis-routed to a human.** Recurs on every
`policy=tests-docs` PR the watcher opens itself.

⚠️ Not caused by `MERGE_WAIT_HEARTBEAT` (#1304). That fix made the deadlock *survivable* — which is
precisely why it is now silent and long-lived instead of killing the node.

→ **STATION 06 / PR MASTER HANDOVER, prompt not yet written.** Directions to weigh under RULE 1
(complete AND additive): release the lane during merge-wait · run the enqueued review for the PR
being waited on ahead of the wait · let the merge step consume a verdict produced after it starts.

## 3. 🔴 ESCALATED TO MARCO — PR #1305

Routed to Marco by the watcher, therefore **NOT merged** (RULE 2 / station brief: "not when green,
not when the diff is verified"). But the routing reason is a bug, not a judgement.

**Question for Marco:** merge #1305 yourself, or authorise the supervisor to merge PRs whose ONLY
routing reason is `timeout waiting for … MERGE verdict`? Until answered, every such PR stalls the
board behind it.

## 4. State @ 10:11Z (all MEASURED, read-only)

- Watcher **ALIVE**: `.queue-state.json` ts `2026-08-24T10:10:24.873Z` (54 s old),
  `{lane:null, lanes:2, armed:1, owned:1, deferred:[], runnable:1}`; heartbeat ticking 60 s on
  `rev-1305-ready.md elapsed=352s`.
- `index.lock` **ABSENT** in both `C:\ProjectOperations2\.git` and `C:\po-watcher\ProjectOperations\.git`.
- **1 open PR: #1305** (sole PR on the board).
- **armed = 1, and it is `rev-1305-ready.md` — a REVIEW JOB, excluded from the census. ZERO real
  prompts armed.** `pr-lessons-folder-s1-restore-ready.md` retired to `processed/` 10:05:27Z.
- **59** depth-1 `pr-*-HOLD.md`, unchanged since 08:14Z.
- `pr-lessons-folder-s2-unfold-sot05-HOLD.md` (Station 05, `sot/`) and `…-s3-ref-checker-HOLD.md`
  **correctly still held** — s1 has not landed. **Do not arm s2 until #1305 is on main.**

## 5. 🟠 `ensure-watcher.log` ticks in ~hourly BURSTS, not PT10M — DISPATCHED to Station 03

~7 ticks then a ~63-min gap, twice: 07:05:01 → 08:08:52, and 09:05:01 → nothing through 10:11Z.
No relaunch has been missed (05:35:01Z `RELAUNCHED` + `detached=True` intact), so AMBER not RED — but
a keepalive degrading from 10-min to ~60-min resolution restores most of the exposure window it was
built to close. Suspect a task condition ("only if idle" / battery) or a sleep state. **Measure
before touching the task — do not delete or re-register it.**

## 6. Dispositions

| Finding | Disposition |
|---|---|
| Merge/review lane deadlock | **DISPATCHED** → Station 06 (PR Master), prompt not yet written |
| PR #1305 routed to Marco on a bug | **ESCALATED** → Marco, question above |
| `ensure-watcher` hourly bursts | **DISPATCHED** → Station 03 (machine-minder) |
| DC-absent blind run (3rd) | **ESCALATED** → Marco: the scheduled supervisor run needs DC reliably |
| Arming (any prompt) | **DEFERRED** → next sighted run; a blind run cannot verify a premise against `origin/main`, and the lane was busy |
| `lessons-folder` s2/s3 | **DEFERRED** → condition: PR #1305 on main |
| 3 orphan worktrees, `sot/03` unclaimed | **DEFERRED** → unchanged, carried from 08:14Z |

Durable copy in project memory: `project_supervisor_2026_08_24_1011_merge_review_lane_deadlock.md`.
