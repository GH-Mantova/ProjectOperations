# Station 00 — Supervisor | ADDENDUM to the 2026-09-17T17:07:55Z run

## GROUND

```
UTC            2026-09-17T17:45Z
origin/main    ebd5426f               (#2011 merged 17:25:23Z, merge commit ebd5426f)
dev tree       main @ ebd5426f        C:\ProjectOperations2   (0 0, EMPTY, EMPTY — all three read-backs)
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1                      scheduled-task SKILL.md `station_doc_version: 1`
```

Same station, same run, later measurement. Three things settled **after** `#2011` merged. They are
recorded here rather than billed to the next occurrence, which is the precedent `#2010` set.

## WHAT I MEASURED

**[MEASURED] `armed: *-ready.md` reads 1, and it is NOT an arm. Do not read it as one.**
After `#2011` merged, `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File` → **1**, against the
breadcrumb's *"armed 0 at open and at close"*. The file is **`rev-2011-ready.md`** (3058 B, mtime
`2026-09-17T17:25:07Z`) — the auto-generated **REVIEW JOB** for my own board PR, which DOCTRINE §9.5
records is *"not a prompt … exclude them from prompt audits"*. Excluding `rev-*` the count is **0**:

| probe | result |
|---|---|
| `*-ready.md`, unfiltered | **1** (`rev-2011-ready.md`) |
| `*-ready.md`, `rev-*` excluded — the prompt count | **0** |
| `.arming-log.txt` newest row — the only clock that dates an arm | `2026-09-17T12:19:06Z ARMED pr-scopecards-s3-line-markup-all-types` |
| `.arming-log.txt` size, before and after this whole run | **21750 B**, unchanged |

**No ARMED row was written by this run, and none was lost.** The breadcrumb's claim is correct about
prompts; this addendum exists so the next reader meeting the unfiltered `1` does not have to re-derive
that. ⚠️ A `*-ready.md` count taken without the `rev-*` exclusion answers a different question from the
one the queue census asks — and it will read `1` on **every** run that opens a board PR.

**[MEASURED] The watcher is HEALTHY, from the sanctioned instrument and not from my own reasoning.**
The breadcrumb carries no liveness verdict, which is a gap in it: the station brief requires one, and
*"nobody else checks whether the machinery is healthy."* `restart-watcher-if-wedged.ps1`, report-only,
**no `-Fix`**:

```
armed prompts waiting: 1
watcher process:       ALIVE (pid 24032)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
queue last moved:      53 min ago  (rev-2010-ready.md)
heartbeat last write:  52 min ago

VERDICT: HEALTHY - no action.
```

⚠️ **The node PID changed during this run and that is NOT churn.** The 17:09:37Z sweep read
`pid 30248`; at 17:41Z the live process is `pid 24032`. The restarter's own counter reads
**starts=0 exits=0 in 20 min**, so whatever happened was a single event outside that window and below
the churn threshold — and the verdict above is what decides, not my arithmetic on two PIDs (RULE 1 of
the station doc's watcher section: *trust its verdict over your own reasoning*). **Nothing was
restarted and nothing was killed.** A stale heartbeat against an empty prompt queue is idle, not
wedged, and the script already accounts for that.

**[MEASURED] The archiving landed and did not cost any station its freshness.** All five archived
breadcrumbs resolve under `archive/` on `origin/main` (`git rev-parse` exit **0** on 5 of 5) and are
absent from the root path (exit **128** on 5 of 5). **Falsifying probe, the one the station doc
prescribes for exactly this:** `check-breadcrumb.mjs --freshness` re-run *after* the move →
**`CLEAN`, exit 0**, every station `ok`, none SILENT. De-duplicating and archiving is safe for
freshness because that pass matches by trailing path segment — proved here rather than assumed.

**[MEASURED] The fast-forward needed no blocker work at all, first attempt.** `git merge --ff-only
origin/main` → `00dd0f65..ebd5426f`, applying the five renames and creating the breadcrumb path.
Read-backs, all three and not just the first: `git rev-list --left-right --count HEAD...origin/main`
→ `0	0`; `git diff --numstat` → **EMPTY**; `git diff --cached --name-status` → **EMPTY**.
**The reason there was nothing to clear is cure 1** — the breadcrumb was written inside the PR
worktree, so no loose copy ever existed in the dev tree. The 16:07Z run paid three blockers for taking
the fallback; this run paid none for taking the cure.

## WHAT CHANGED

Nothing beyond this file. No arm, no label, no merge on the product board, no `/sot/` edit, no commit
on `main`, no `git` in the watcher clone, no worktree pruned, nothing Azure / Entra / SharePoint.

## FINDINGS

### F-4 — The unfiltered `*-ready.md` count reads 1 on every run that opens a board PR, and the queue census does not say so

Not a defect and not new — §9.5 already records that `rev-*` are review jobs — but the two numbers sit
in different documents, and the census line a run naturally writes (`armed: N`) is the unfiltered one.
`status-sweep.ps1` §4 printed `armed (*-ready.md): 0` at 17:09Z **before** `#2011` existed, so this run
never saw the two disagree until after the merge. `triage-holds.ps1` gets it right and says so in its
own output (*"rev-* excluded; TRIAGE_CORPUS_UNION_V1"*).

**DISPOSITION: DEFERRED** — real, small, and not mine to land cheaply. The fix is a `rev-*` exclusion
in `status-sweep.ps1`'s armed count, which is a `scripts/` change and outside this station's merge
lane; the same lane constraint already parks the `check-breadcrumb.mjs` `CADENCE` one-character fix.
**It becomes urgent the moment a run reads the unfiltered count as evidence that something was armed**
— e.g. a run reconciling arms against `.arming-log.txt` and finding one more `-ready.md` than log rows,
which is precisely the shape §9.5 warns produces *"a prompt has been armed and unseen since…"*.
**Falsifying probe:** open any board PR and read `status-sweep.ps1` §4's `armed` line against
`Get-ChildItem *-ready.md | Where-Object { $_.Name -notlike 'rev-*' }`. If they agree, this is fixed.

## WHAT I DID NOT DO

- **Did not restart, kill, or touch the watcher.** The verdict was HEALTHY; §3a is explicit that a
  restart is only for WEDGED or DOWN, and that killing a healthy watcher mid-run is worse than the
  stall it was meant to fix.
- **Did not clear, rename or disarm `rev-2011-ready.md`.** It is the review lane's own job on my own
  PR, running normally.
- **Did not re-open the three parked PRs' question.** They still carry `do-not-merge` and a genuine
  watcher `marco:true` verdict; only Marco removes the label.
