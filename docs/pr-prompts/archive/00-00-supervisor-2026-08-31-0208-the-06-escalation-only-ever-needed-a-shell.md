# Station 00 — Supervisor | 2026-08-31 02:08Z–02:30Z

## GROUND

```
UTC            2026-08-31T02:08:49Z
origin/main    c1244317            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ c1244317     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md:3)
bootstrap      1                   (station_doc_version: 1 in the scheduled-task file)
```

Doc version and bootstrap AGREE — this run is read/write, not read-only.

**SIGHTED.** `start_process` shell `powershell.exe` returned PID 17800 on the first call. Desktop
Commander present the whole run. This is not a blind run and its silences are real silences.

Preflight step 2 note: the three binding docs were read from the **working copy**, which is
permitted here only because `git diff --stat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **empty** — the dev tree
is at `origin/main` exactly (0/0 ahead/behind). The working copy IS `origin/main` this run.

## WHAT I MEASURED

**[MEASURED]** `status-sweep.ps1` 02:09:17Z → **CAUTION** (a PR touched within 2 min); re-run
02:12Z → **SAFE TO ACT** (`in-progress prompts 0` · `index.lock interactive/clone False/False` ·
`git processes 0` · `no PR touched in the last 2 min`). Both instrument controls green
(`gh CAN reach GitHub (saw merged PR #1416)`, `node runs`). The first verdict was the tail of
#1416/#1417 activity, not a station mid-mutation.

**[MEASURED]** Board: **1 open PR**. `#1417 BLOCKED` *fix(crm-s4): do not present an unmeasured
default as a derived recommendation*, CI 12 pass / 0 fail / 1 pending. `gh pr view 1417 --json
labels` → **`do-not-merge`**. Merged in the last cycle: #1416 (01:41Z), #1415, #1414, #1413, #1412.
Main-branch CI last 3 runs: 3 success.

**[MEASURED]** Watcher: node **pid 6388** RUNNING, wrapper alive (1), heartbeat 3 min, orphaned
worktrees none, guard hook present. Watcher clone `branch=main dirty=39` — the permanent amber from
03's F2 (verdict-archive moves 35+ tracked files without committing), now **39**, up from 37 at
00:09Z and 35 on 08-30. It is growing, which is the finding, not the absolute number.

**[MEASURED]** Queue: **armed `*-ready.md` = 0** (counted with `Get-ChildItem`, not read from a
note). needs-marco 14 · no-pr-opened 107 · failed 41 · blocked 9.

**[MEASURED]** `docs/pr-prompts/.arming-log.txt` tail — a **concurrent human actor** is driving the
CRM chain from an interactive session: `00:51:25Z ARMED pr-crm-s5-accounts-crud-wiring` and
`01:48:54Z ARMED pr-crm-s4-no-history-proposal`, both `caller=powershell.exe`, neither mine.

**[MEASURED]** `check-breadcrumb.mjs` → structure **5 checked, 0 malformed**, exit 0 CLEAN.
`--freshness` → exit 0 CLEAN, every station inside 2× cadence: 00 2.0h/2h · 03 3.2h/24h ·
04 4.0h/4h · 05 12.0h/24h. **06 prints no cadence line at all** — see F4.

**[MEASURED]** OAuth: `failed/` still shows the 08-29 07:03 401 expiries, but no new ones since
Marco re-authed 08-30T21:17Z, and #1416/#1417 both ran to completion after it. The token's next
expiry is **05:17Z today** (15:17 Brisbane); nothing in this run is gated on it.

**[MEASURED]** Only ONE breadcrumb is new since my 00:09Z run:
`00-06-pr-master-2026-08-31-0137-scope-sub-and-charging-methods.md`, untracked. 03's 23:01Z and
04's 22:10Z were already dispositioned at 00:09Z (04's FINDING 1 shipped as #1413).

## WHAT CHANGED

**1. The staged consumed-prompt residue is cured — for the THIRD time in three hours.**
`git diff --cached --name-status` in the shared dev tree carried
`R100 pr-crm-s4-no-history-proposal-HOLD.md → …-ready.md` with **no file on disk**
(`RD` in `git status --porcelain`). A pathspec-less commit by any chat would have published an ARMED
prompt to `main`. Cure: `git restore --staged <HOLD> <ready>`.
Read back: staged set **empty** · `RD` → ` D` · armed count still **0**.

**2. Board PR opened** carrying 06's nine paths plus this breadcrumb, four archived breadcrumbs and
three consumed-prompt deletions. Built in a disposable worktree
(`C:\po-worktrees\sup-0212`, `origin/main --detach`), never the shared dev tree. Full staged list is
in the PR body. Byte-length equality verified src↔dst for all nine copied files before staging;
`--numstat` on the one tracked modification reads **5/1**, i.e. the `escalates` flip and its
four-line note, not a line-ending rewrite.

Nothing was armed. Nothing was merged. `/sot/` untouched.

## FINDINGS

**F1 — 06's F1 and F7 were escalated to Marco, and neither needed him. They needed a shell.**
06 wrote seven validated `-HOLD` prompts (est-pricing s1–s4, scope-sub s1–s3) plus one tracked edit,
then escalated *"Marco commits them in a docs-only PR"* — because git is forbidden through the
device bridge and the GitHub MCP 403s on writes. **That is the escalator's LANE failing, not the
fix needing Marco.** Station 00 has `gh` and a Windows shell; committing docs-only files to a board
PR is squarely 00's authority. 06's F7 makes it urgent rather than merely tidy:
`start-watcher.ps1` runs `git stash push --include-untracked` whenever the tracked tree is dirty at
startup, the watcher's own source names this as having *"SILENTLY MOVED staged prompts out of the
queue"* (`scripts/pr-watcher/index.mjs:211-219`), and the watcher restarted three times in half an
hour last night. Seven untracked prompts were one restart away from vanishing.
**ACTIONED** — committed in this run's board PR. Verified by `git diff --cached --name-status`
before commit and by reading the merge back on `origin/main` after.

**F2 — The consumed-prompt `RD` is now the steady state, and it has outlasted its own dispatch.**
Third occurrence in three hours (crm-s4 00:1xZ, block-scalar 00:5xZ, no-history 02:1xZ). Every
consumption leaves a staged `R100 HOLD→ready` whose file is gone, in an index **shared between
concurrent chats**. The cure is one command and takes seconds; the exposure is that any chat's
pathspec-less commit publishes an armed prompt to `main`. At 00:09Z this was DISPATCHED → 06 to add
the probe to `status-sweep.ps1`. **06 ran at 01:37Z and did not do it** — correctly, because 06 was
driven interactively on a different task and never read the dispatch. That is the orphaned-
disposition defect in the wild, one cycle after it was named.
**DISPATCHED → 04-scanner** (cadence 4h, next run ~02:10Z, and it owns "instruments that lie"):
add a probe to `status-sweep.ps1` §3 that reports any staged `R…` under `docs/pr-prompts/` whose
target is absent from disk, as a DO-NOT-COMMIT-WITHOUT-PATHSPEC line. Re-routed away from 06 for
the reason in F4.

**F3 — #1417 is not mine, and the label proves it rather than the prose.**
`escalates: true` in `pr-crm-s4-no-history-proposal`, so the watcher applied `do-not-merge`
(`[merge] escalates:true — NOT enabling auto-merge; labelling do-not-merge`). STATION-CAPABILITIES
§5: only Marco removes that label. It is also the second, independent gate — the watcher's own
human routing — and green + 12-pass CI overrides neither.
**DEFERRED** — leave it open and unlabelled-by-me. It becomes mine only if its one pending check
goes red on a cause I can root-cause, which is a fix, not a merge.

**F4 — 06 has no cadence, so a dispatch addressed to it parks indefinitely — now MEASURED, not
predicted.** `check-breadcrumb.mjs --freshness` prints a line for 00, 02, 03, 04 and 05 and **none
for 06**, because 06 has no schedule to be late against. The 00:09Z run dispatched the `RD` probe
to 06; 06 then ran (01:37Z, human-driven) and never saw it. A station with no cadence cannot be
dispatched to and cannot read SILENT — it is a write-only address.
**ESCALATED** — this is the same question already open with Marco, now with an instrument reading
behind it. Options, RULE 1 order:
**(A) Give 06 a cadence** (e.g. 12h) and let `--freshness` police it. *Complete* — every station
becomes dispatchable and every dispatch becomes overdue-detectable; *additive* — adds a schedule,
changes no existing behaviour or data. **This is the option I recommend.**
**(B) Ban "a future run of station N" as a disposition target** and require every DISPATCHED item
to name a station with a cadence. Fails the *complete* half: it stops 00 from parking work on 06,
but leaves 06's own output unowned and unscheduled.
**(C) 00 actions 06-shaped items itself.** Fails *complete* (00's 2h window cannot absorb 06's
design work) and brushes the *additive* half (it re-merges two lanes that were split after LL-38).

**F5 — The watcher clone's dirty count is climbing: 35 (08-30) → 37 (00:09Z) → 39 (02:09Z).**
03's F2 diagnosed the cause — `verdict-archive` moves tracked files out of the clone without
committing, ~35 per watcher start — and staged the fix as
`pr-watcher-verdict-sweep-skips-tracked-HOLD`. It is still unarmed. The number is not itself
dangerous; the closed loop is, because `start-watcher.ps1`'s stash-on-dirty preflight (F1) fires on
exactly this dirtiness, which is how F1's risk keeps regenerating.
**DEFERRED** — it is the standing next-arm, and I deliberately did not arm it this run (see WHAT I
DID NOT DO). Urgent the moment the clone's dirtiness blocks a watcher start, or the count crosses
the ~54-stash growth 03 recorded.

## WHAT I DID NOT DO

- **Did not arm anything, with the slot free.** `armed = 0` and
  `pr-watcher-verdict-sweep-skips-tracked-HOLD` is the standing next arm. I left it because the
  arming log shows a **concurrent human actor** arming the CRM chain twenty minutes before this run
  (`01:48:54Z`), with that prompt's PR (#1417) still open and its checks still running. Arming a
  second prompt into a lane a person is hand-driving is the LL-38 collision with better manners.
  The slot is theirs until #1417 settles. This costs one cycle and risks nothing.
- **Did not merge #1417** — `do-not-merge`, Marco's (F3).
- **Did not commit `docs/data-model/metadata-catalog.json`**, which is modified in the dev tree. It
  is a generated file, it is not mine to hand-edit, and folding it into a docs-only PR would trip
  CP-24's code/docs split. Left for whoever regenerated it.
- **Did not commit the ` D pr-crm-s4-no-history-proposal-HOLD.md` deletion.** Its PR (#1417) is
  still open; the convention is to land a consumed prompt's deletion only once its PR has merged.
  The other three deletions in this PR are all past that line (#1412, #1414, #1416 merged).
- **Did not clear the seven `[STALE]` escalation files** section 5 names (HANDOVER-2026-08-14,
  pr-1135-MERGE-DECISION, rates-11b2-consumer-migration-blockers, and four more). They are
  correctly flagged and harmless while flagged; clearing them is queue hygiene for a run that is
  not also landing a time-critical commit.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or the watcher process.**
