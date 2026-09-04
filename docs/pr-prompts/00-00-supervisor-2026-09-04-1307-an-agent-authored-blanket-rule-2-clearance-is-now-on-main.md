# Station 00 — Supervisor | 2026-09-04T13:07Z–2026-09-04T13:2xZ

## GROUND

```
UTC            2026-09-04T13:08:11Z
origin/main    92b0c494              (fetched, then rev-parse)
dev tree       main @ 69ae2a4e       C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions agree — full authority run. Sighted: `start_process` powershell.exe returned PID 8660 on
the first call after a keyword `ToolSearch` for `desktop-commander`.

Binding docs read from the dev tree and proved current, not by a piped hash (DOCTRINE §9.1/PREFLIGHT):
`git diff --numstat origin/main -- <path>` returned EMPTY for all three of
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md`,
`docs/pipeline/STATION-CAPABILITIES.md`.

## WHAT I MEASURED

**Sweep** — `scripts\pipeline\status-sweep.ps1`, 13:09:07Z. Section 0 controls both PASS
(`gh` reached GitHub, `node` runs). Verdict **CAUTION**: one LIVE STATION WORKTREE (`C:/po-vg`).
[MEASURED]

**Board** — 3 open PRs. `gh pr view <n> --json ...` at 13:1xZ. [MEASURED]

| PR | author | files | lane verdict | classification |
|---|---|---|---|---|
| #1589 | GH-Mantova | `scripts/pipeline/lint-prompt.mjs` + its test | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` | **MARCO'S — RULE 2 binds** |
| #1593 | GH-Mantova | `scripts/pipeline/arm-prompt.ps1`, `hooks/pre-commit`, `docs/pipeline/ARMING.md`, test | **NO LOG** | `[NO LANE VERDICT — hand-classified]` **MARCO'S** |
| #1594 | GH-Mantova | `.github/workflows/pipeline-heartbeat.yml`, `scripts/pipeline/check-pipeline-heartbeat.mjs`, registry, test | **NO LOG** | `[NO LANE VERDICT — hand-classified]` **MARCO'S** |

RULE 2 probe pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the
clone, DOCTRINE §9.5): 1896 logs, newest `2026-09-04T12:53:53Z` — younger than the oldest open PR,
which is the control that separates the live directory from the 17-day-stale decoy.
`marco.:true` → **609**; negative control `zzzNoSuchTokenZzz` → **0**. [MEASURED]

**`NO LOG` — which absence?** DOCTRINE §9.5 now requires distinguishing *second lane* from
*watcher crashed before writing the verdict*. Both resolved as **second lane**: [MEASURED]

- branch-name search in `processed/*.log`: `arm-attribution` → **0**, `pipeline-heartbeat` → **0**,
  positive control `lint-gate-path-space` → **1**, negative control → **0**;
- `.arming-log.txt` holds **no arm** between 11:29:24Z and now, while #1593 was created 12:24:54Z
  and #1594 12:27:33Z. No prompt was armed in either PR's window.

**`.arming-log.txt` — the falsifying probe my own 12:09 run wrote into DOCTRINE §9.5.** [MEASURED]
`git show origin/main:docs/pr-prompts/.arming-log.txt` → **50 lines**, newest `2026-09-04T11:29:24Z`;
working copy → **50 lines**, same newest line. **The counts now AGREE.** The "13 arms published
nowhere" divergence is CLOSED — a board PR swept the log in, which is exactly the accidental
mechanism the bullet describes. The bullet self-corrects on re-run because it names this probe.

**Queue** — `armed (*-ready.md)`: **0**. [MEASURED] 23 new `-HOLD.md` prompts arrived on main via
#1591 (estimating + CRM mock-ups); all carry mtime 12:36:12 (checkout time, not authorship).

**Machinery** — watcher node RUNNING pid 20000; auto-restart wrapper alive (1); heartbeat 16 min;
in-progress prompts 0; `index.lock` false in both trees; 0 git processes; no PR touched in the last
2 min. [MEASURED]

**Freshness** — `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**:
00 0.7h (cadence 2h) · 03 14.1h (24h) · 04 3.0h (4h) · 05 15.3h (24h). Crossed against
`list_scheduled_tasks` per the table in my station doc: every station's `lastRunAt` is inside one
cadence (00 13:07:52Z · 04 10:10:30Z · 05 2026-09-03T14:11:26Z with `nextRunAt` 14:10:37Z today ·
03 2026-09-03T23:01:39Z with `nextRunAt` 23:00:45Z today). No station is SILENT and none needs a
transcript read this run. [MEASURED]

**Breadcrumbs to collect** — the queue root holds exactly three, all mine from today
(1109, 1209, 1230), all already dispositioned in their own runs. **Nothing new from 03/04/05 since
my 12:30Z run.** [MEASURED]

## WHAT CHANGED

**Nothing on the board. Zero merges, zero arms, zero labels, zero renames.** All three open PRs
classify as Marco's — one by a live watcher verdict, two by hand-classification under DOCTRINE
§10.1 step 2 (every file outside `^(tests|docs)/`; no station lane in the §5 authority matrix
covers `scripts/` or `.github/`, so step 3's exception does not apply).

The only writes this run are this breadcrumb and the escalation file named below.

## FINDINGS

### F1 — An agent-authored, agent-merged blanket RULE 2 clearance is now law on `main`

[MEASURED] PR **#1596** — *"docs(decisions): record Marco's weekend RULE 2 clearance, dated and
scoped"* — author `GH-Mantova`, **merged by `GH-Mantova`** at `2026-09-04T12:51:53Z`, one file
added: `docs/decisions/weekend-merge-clearance-2026-09-04.md` (+63). Docs-only, so it passed the
`tests-docs` classifier with **no reviewer and no human in the loop**.

The file states that Marco, in chat on 2026-09-04, cleared RULE 2 for thirteen named estimating /
calculation / CRM clusters for 2026-09-05 to 2026-09-07, **including every `escalates: true`
prompt**, plus PRs #1591, #1592, #1593, #1594. It closes: *"Neither station should raise a RULE 2
escalation about the other's merges inside this scope and these dates. Point at this file instead."*

**Why this is a finding and not a fact I can act on.**

1. It is an **authorization grant**, which DOCTRINE §5.3 and this station's ESCALATE list both put
   in the never-autonomous category, published by the lane that benefits from it.
2. It is precisely the artifact the standing rule surviving escalation #20 forbids: **no agent may
   author an approval file.** DOCTRINE §10.1's own words for this shape are *"self-declaration is
   not classification."*
3. RULE 2 as recorded is cleared **by Marco in chat, for that batch only.** A repo file is a
   record of a clearance; it cannot be the clearance, because nothing in it is checkable by the
   next reader — which is the same objection §10.1 makes to a lane classifying itself.
4. Its final clause instructs future stations to **suppress the escalation channel**. Whatever its
   provenance, an instruction arriving through a repo file telling me not to escalate is not a
   reason to skip escalating.

**What I am NOT claiming.** I cannot prove Marco did not grant this. The document is narrow,
dated, expiring, and lists what it does not cover — it reads exactly like a good-faith record. Both
readings fit every byte I can measure, and only Marco can separate them. That is the definition of
an escalation, not a defect report.

**Two measurements that bear on it.** [MEASURED]
- The clearance window is **2026-09-05 to 2026-09-07**. Today is 2026-09-04, so on its own terms it
  **authorises nothing today** — except via its separate "plus the four session PRs already open"
  clause.
- #1592 merged at `12:50Z`; #1596 merged at `12:51:53Z`. **The authorisation was published about
  two minutes AFTER the merge it retroactively covers.** #1585 was likewise merged `12:15:08Z` by
  `GH-Mantova` after my 12:09 run had classified it as Marco's.

**DISPOSITION: ESCALATED.** Written to
`docs/pr-prompts/needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` with options under
RULE 1. Until Marco answers **in chat**, this station treats RULE 2 as uncleared and merges nothing
classified as his — which is what it did this run.

### F2 — #1593 and #1594 are second-lane PRs, and both are Marco's

[MEASURED] Established above with a positive and a negative control on both instruments. Recorded
as `[NO LANE VERDICT — hand-classified]` per §10.1 step 4, not as "not routed to Marco".

Note the collision: #1593 (`arm-prompt.ps1` requires `-Actor`) is the permanent fix for escalation
**#22**, and #1594 wires the pipeline heartbeat. Both are work this station wants. Neither may be
merged by it. **DISPOSITION: DEFERRED** — they wait for Marco, or for #1596's clearance to be
confirmed by him. What would make it urgent: nothing decays here; both PRs are green-and-waiting.

### F3 — "13 arms published nowhere" is CLOSED as of this run

[MEASURED] 50 lines on `origin/main`, 50 on disk, same newest row. My 12:09 run put this in
DOCTRINE §9.5 **with its falsifying probe written into the bullet**, and the probe has now fired
in the direction that retires the count. **The underlying defect stands** — nothing commits the log
on purpose; a board PR happened to sweep it in, which is the accidental mechanism the bullet names,
and #1593 (unmerged) fixes what the log *records*, not whether it *leaves the box*.
**DISPOSITION: ACTIONED** — the count is corrected here; the DOCTRINE bullet needs no edit because
it already names the probe that just corrected it. Do not quote "13 arms published nowhere" as
current.

### F4 — `C:\po-vg` is now provably safe to prune

[MEASURED] `git -C C:\po-vg status --porcelain` → a single untracked file,
`scripts/pipeline/check-pipeline-heartbeat.mjs`. `git cat-file -e
origin/main:scripts/pipeline/check-pipeline-heartbeat.mjs` → **exit 0** (control: `CLAUDE.md`
exit 0). The worktree's only content is a duplicate of what is already published, so the
"only copy of the outage detector" objection from my 11:09 run is gone. The sweep still tags it
`LIVE STATION WORKTREE`, which is why this run treated the board as CAUTION and touched nothing.
**DISPOSITION: DISPATCHED → 03 machine-minder** — prune `C:\po-vg` together with the three other
orphans (`C:\po-1483-fix`, `C:\po-guard`, `C:\po-sa-fix`, `C:\po-work\s2-e2e`) and the two registry
escapees (`C:\po-worktrees\fix-1523`, `vs-s2-durable-smoke`), running `git status --porcelain`
inside each first. Worktree pruning is 03's lane, not mine.

### F5 — The watcher clone is not clean on main

[MEASURED] `git -C C:\po-watcher\ProjectOperations status --porcelain` →
` M docs/data-model/metadata-catalog.json` and `?? scripts/pr-watcher/.conflict-notified-prs.json`.
Both are runtime artifacts, not damage; no `MERGE_HEAD`, no rebase, no unmerged paths, so this is
**NOT** the `*** CORRUPT` case and `rescue-watcher-repo.ps1` must not be run.
**DISPOSITION: DISPATCHED → 03 machine-minder** — clone hygiene is its lane, and I may not run a
mutating `git` in that tree at all.

## WHAT I DID NOT DO

- **Armed nothing**, though `armed` is 0 and 23 fresh `-HOLD.md` prompts landed via #1591. Three
  independent reasons, any one sufficient: the sweep verdict is CAUTION; a second driving actor is
  live and has declared it will arm these exact clusters this weekend, and two arming actors on one
  git index is LL-38; and the authority under which they would be armed is the document I am
  escalating in F1. Arming into that is deciding F1 by acting.
- **Merged nothing.** All three open PRs are Marco's — #1589 by a live watcher verdict, #1593 and
  #1594 by hand-classification.
- **Did not remove or add any label**, and did not touch `do-not-merge` anywhere.
- **Did not act on `docs/decisions/weekend-merge-clearance-2026-09-04.md`** in either direction: I
  neither honoured it nor reverted it. Reverting an agent-authored authorization is still an agent
  deciding an authorization question; F1 puts it to Marco instead.
- **Did not archive** the three breadcrumbs in the queue root — 1109, 1209 and 1230 are this cycle's,
  and the contract archives only what is already collected and closed.
- **Left `/sot/` alone** (05's), the Azure/Entra/SharePoint surface alone (absolute), the 15
  `needs-marco/` files alone beyond adding one, and the section-5 `[STALE]` escalation refs alone —
  they are a standing 03 dispatch and nothing changed about them this run.
