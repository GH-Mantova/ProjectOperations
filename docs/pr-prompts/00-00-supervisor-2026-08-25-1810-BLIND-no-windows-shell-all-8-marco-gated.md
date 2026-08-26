# Station 00 — Supervisor | 2026-08-25T18:05Z–18:12Z

## GROUND

```
UTC            2026-08-25T18:10Z
origin/main    019c7579  (LIVE, GitHub API list_commits main, 2026-08-25T16:13:45Z)
dev tree       main @ b968e4f1   C:\ProjectOperations2   (1 behind origin/main)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md station_doc_version)
```

Versions AGREE. **But this run was BLIND on the action side.** Desktop Commander — the only Windows-host
shell — never connected. It appeared in the "still connecting" list at session start, then dropped out
of both the connecting list and the available-tools list without ever becoming callable. Two honest
searches (`+desktop_commander`, `+desktop-commander process shell`) returned nothing.

**Read the BLIND boundary precisely — this is not the usual blind run:**

| Capability | This run | Why |
|---|---|---|
| Read the dev tree (the tree the watcher globs) | ✅ **YES** | `C:\ProjectOperations2` is a mounted folder; plain `ls`/`cat`/`stat` create no lock |
| Read the watcher clone + `.queue-state.json` + logs | ✅ **YES** | same, `C:\po-watcher` is mounted |
| Read the live PR board | ✅ **YES** | GitHub MCP, read-only, **labelled as GitHub-side** |
| Run **any** `git` | ❌ **NO** | hard stop — VM git against the Windows `.git` leaves a 0-byte `index.lock` with no process behind it and freezes every station |
| **ARM** (a `git mv` of a tracked `-HOLD.md`) | ❌ **NO** | needs git on the host |
| **MERGE** (`Assert-SmokedOrEscalate` → `Merge-Pr`) | ❌ **NO** | needs `gh` on the host; the GitHub MCP token cannot merge (403) |
| **COMMIT** this breadcrumb | ❌ **NO** | needs git on the host |

So: **full read coverage, zero write capability.** I did not substitute GitHub-side reads for tree
coverage — I read the tree directly, and every GitHub-sourced claim below is tagged as such.

## WHAT I MEASURED

**1. Watcher is LIVE.** [MEASURED]
`.queue-state.json` `ts` **FIELD** (never the mtime) at `C:\po-watcher\ProjectOperations\scripts\pr-watcher\`:
```
ts = 2026-08-25T18:08:10.221Z     read at 2026-08-25T18:09:47Z   → 97 s old
```
And the **GAP probe** — the only probe that catches a freeze — over the last hour of
`logs/2026-08-24.log` (still the live log):
```
17:13:09 · 17:18:09 · 17:23:09 · 17:28:09 · 17:33:09 · 17:38:09
17:43:09 · 17:48:09 · 17:53:09 · 17:58:09 · 18:03:09 · 18:08:10
```
Twelve consecutive `[review] verdict-archive sweep` ticks, every gap 5 min 00 s ± 1 s, **no outlier**.
Live *when measured*; it decays. Note the board is idle and the sweeps read `archived=0 kept=8` — an
idle board makes this channel quiet, not mute, so silence here would still not have proved a freeze.

**2. Board is idle. ARMED = 0.** [MEASURED]
```
ls docs/pr-prompts/*-ready.md   (depth 1 only)     → 0
.queue-state.json:  lane=null  armed=0  owned=0  runnable=0  deferred=[]
```
Both instruments agree, and they are independent (filesystem vs the watcher's own state file).

**3. Last run's arming ran end-to-end and produced PR #1325.** [MEASURED]
The `pr-sot-04-bp0a-job-canonical-reconcile-ready.md` I armed at 16:10Z is now in `processed/` with its log:
```
Started: 2026-08-25T16:16:09Z    Ended: 2026-08-25T16:29:14Z    Exit: 0
**PR #1325** — https://github.com/GH-Mantova/ProjectOperations/pull/1325
[watcher] merge result for PR #1325: {"ok":false,"marco":true,"reason":"escalates:true — held for Marco, labelled do-not-merge"}
```
Pickup 6 min after arming — inside the normal 0–5 min fs-watch/poll window, not a stall.

**4. Eight open PRs. All eight Marco-gated.** [MEASURED, GitHub-side]
`list_pull_requests state=open` → **#1316 #1317 #1319 #1320 #1321 #1322 #1323 #1325**.

| PR | `do-not-merge` label | Routing evidence |
|---|---|---|
| 1325 | ✅ | its own processed log, `"marco":true` (above) — [MEASURED] this run |
| 1323, 1321, 1319 | ✅ | label |
| 1316, 1317, 1320, 1322 | ❌ **none** | routed on `tests-docs` over one file each — [MEASURED] the 16:08Z run, [INFERRED] still true now |

**Four of eight carry no label.** A label-only merge check would call those four mergeable and would be
wrong on every one. That trap is now confirmed on two consecutive runs.

**5. Breadcrumb channel — nothing new to COLLECT, and the backlog grew.** [MEASURED]
Newest breadcrumbs on disk are my own 16:08Z and Station 04's 14:10Z — both already dispositioned by the
16:08Z run. **No station has reported since 16:08Z**, which at a 2-hour cadence is not yet silence for
anyone. `docs/pr-prompts/00-*.md` on disk: **54** (was 51 at 14:10Z, 53 at 16:08Z).
[CANNOT MEASURE] how many of the 54 are tracked — that needs `git ls-files`.

I could not run `check-breadcrumb.mjs --freshness`, the mandated COLLECT instrument. The manual read
above substitutes for it on *recency* only, not on *shape*.

## WHAT CHANGED

**Nothing.** No merge, no arm, no label, no commit, no push, no file in the repo except this breadcrumb,
which is **untracked** — I cannot commit it. Station 00's next run with a host shell must sweep it up.

## FINDINGS

### F1 — Station 00 ran with no Windows-host shell; the arm lane is stalled, the merge lane is not
The board is idle (`armed=0 runnable=0`) with HOLDs waiting. The single useful action this run was to
arm the next slice, and arming is a `git mv` on the host. So the blindness cost exactly one arm.
It cost **zero** merges — see F2, there was nothing I was permitted to merge anyway.

This is worth Marco's attention because a scheduled station that cannot reach the box does not fail
loudly: it produces "no news", which is indistinguishable from a healthy quiet run. That is why this
breadcrumb leads with the capability table rather than a status line.

**Question for Marco — RULE 1 applied (complete-and-additive first):**

- **(a) Make the bootstrap's STEP 1 self-reporting: on DC-unreachable, write a `00-*-BLIND-*` breadcrumb
  and emit a distinct signal, then stop.** Complete: every blind run becomes visible instead of silent,
  now and in future. Additive: adds a failure path, changes no working one, touches no data. **Passes
  both halves of RULE 1.** Cost: the breadcrumb is still uncommittable, so the signal has to be
  out-of-band (chat report), which is what this run did by hand.
- **(b) Give the station a host-shell fallback (a scheduled `.ps1` the run can trigger).** Fails the
  *"without damaging future data entry"* half — a second, less-audited path that can mutate git and the
  queue is precisely the LL-38 collision, and it would be exercised only when something is already wrong.
- **(c) Do nothing; blind runs self-heal on the next 2-hourly fire.** Fails the *"solves it completely"*
  half — the healing is real but invisible, and a run of consecutive blind fires reads identically to a
  quiet board.

**ESCALATED**

### F2 — All 8 open PRs are Marco-gated. RULE 2 blocks every one of them.
Nothing on the board is mergeable by me, blind or not. #1325 is the newest and is gated by its own
watcher verdict (`"marco":true`), not merely by a label. **This is the second consecutive run where the
merge lane is 100% Marco-gated** — the board cannot drain without Marco, and each PR that sits pushes
the others BEHIND, so each eventual merge costs a full ~13-min CI re-run across the rest.

Suggested drain order if Marco wants one, cheapest-risk first: **#1322** (one-line `×100` display fix)
→ **#1320** (route permission gate) → **#1325** (docs/sot only) → the rest.

**ESCALATED** (4th consecutive run — the ask has not changed, only the count)

### F3 — Arming #1325's prompt worked exactly as designed; the bp0a chain is unblocked
Exit 0, PR opened, gate file in place. Per the prompt's own closing note, downstream Job-canonical slice
prompts can be authored one at a time (Phase A before B) **once #1325 merges** — so F2 is now also
blocking the bp0a chain, not just the board.

**DEFERRED** — becomes urgent the moment #1325 merges; that is when the next slice should be authored
and armed.

### F4 — Uncommitted breadcrumbs: 54 on disk and climbing, because no scheduled station may open a PR
Was 51 at 14:10Z, 53 at 16:08Z, 54 now (this file). The Station 04 doc says commit; STATION-CAPABILITIES
§5 forbids it. Neither side is wrong on its own terms, which is why this keeps recurring instead of
resolving. Already escalated by Station 04 (14:10Z) and by me (16:08Z).

**ESCALATED** (3rd time, deliberately not re-argued here — see the 14:10Z scanner breadcrumb for the
full case)

## WHAT I DID NOT DO

- **No git, of any kind.** Not `status`, not `ls-files`, not `fetch`. The mount is a Linux VM and station
  git through it leaves a lock with no Windows process, which never expires and freezes every station.
  Every count above that would have needed git is tagged `[CANNOT MEASURE]` rather than approximated.
- **Did not arm anything.** Cannot `git mv` — and creating a `-ready.md` is not arming, it is the trap
  (`.gitignore:75` swallows it, and a clone-side `-ready.md` is inert regardless).
- **Did not merge, and did not touch a label.** All 8 are Marco-gated (RULE 2), and the GitHub MCP token
  cannot merge anyway (403) — so there was no path here even by accident.
- **Did not dispatch 02/03/04/05.** Dispatch needs the host; and there was nothing new to COLLECT, so
  there was nothing to hand over.
- **Did not read all of DOCTRINE and STATION-CAPABILITIES in full** — I read the station doc front matter,
  its contract block and authority section, and grepped DOCTRINE. Saying so rather than implying full
  coverage: on a blind run the honest gap matters more than the appearance of the checklist.
- **Did not take a second `.queue-state.json` sample 5+ min apart.** The 12-tick GAP series covers the
  same ground more strongly, and I was ending the run.
