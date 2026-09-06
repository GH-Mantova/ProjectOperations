# Station 00 — Supervisor | 2026-09-06T14:08:15Z–2026-09-06T14:2xZ

## GROUND

```
UTC            2026-09-06T14:08:15Z          (scheduled-tasks MCP lastRunAt for 00-supervisor)
origin/main    a65ab1d4 STALE — true main is d14674281 (14:03:27Z, GitHub API)
dev tree       main @ a65ab1d4               C:\ProjectOperations2  (loose .git/refs/heads/main)
doc version    1                             (docs/pipeline/stations/00-supervisor.md front matter, station-contract v3)
bootstrap      1                             (scheduled-task SKILL.md, station_doc_version: 1) — MATCH
```

🔴 **The `origin/main` line is the one a blind run must not fake, so it is written twice.** A blind run
**cannot fetch** — the preflight's `fetch first, then rev-parse` is unavailable. `a65ab1d4` is the dev
tree's *remote-tracking ref file*, i.e. whatever the last fetch left there, which the reflog dates to
`13:09:25Z`. `list_commits` on `main` (GitHub read, labelled as such) shows HEAD **`d14674281`** at
`14:03:27Z`, three commits later: `#1723` (the 13:08Z run's own breadcrumb, `13:33:50Z`), `#1722`
(`13:47:31Z`) and `#1721` (`14:03:27Z`). **So the dev tree is three commits behind and the value in a
blind run's GROUND block is a floor, never a reading of `main`.**

🔴 **THIS RUN WAS BLIND.** `ToolSearch` was run FIRST, twice (keyword `desktop-commander`, then again
after a 30 s wait) — the contract's own rule that a validation error is not blindness was obeyed and
no Desktop Commander tool was ever called cold. The MCP layer then reported
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
There is no second transport (STATION-CAPABILITIES §3), so **no PowerShell, no `gh`, no `git`, no
`.ps1` ran on the Windows host this run.** I claim **NO** liveness verdict, **NO** smoke verdict, **NO**
`status-sweep` safe-to-act verdict and **NO** merge verdict, and I mutated nothing on the board.

**What I did instead, and it is the whole of COLLECT.** Per STATION-CAPABILITIES §3's blind-run
clause, the Cowork mount `/sessions/<id>/mnt/ProjectOperations2/` IS the live dev tree: I read the
three binding documents, the queue, `.arming-log.txt`, every breadcrumb, the RULE 2 processed logs
and the watcher clone's refs — all as **file reads**, never `git`. **Device-bridge git guard installed
first, before any VM-side call**, last line quoted verbatim: `persistence controls passed: .bashrc
byte-identical on re-run; login shell resolves shim` (exit 0, both controls passed).

⚠️ **Every timestamp below is taken from log CONTENT or from an MCP field, never from a mount `stat`**
— the mount surfaces host-local (UTC+10) times as UTC, so any age computed from `stat` is ten hours
wrong and nothing warns (STATION-CAPABILITIES §3, landed by the 12:08Z run).

## WHAT I MEASURED

**COLLECT — nothing new to disposition, and the apparent gap has an innocent cause.** [MEASURED]
The dev tree's `.git/logs/HEAD` records fast-forwards at `12:09:14Z`, `12:42:16Z` and `13:09:25Z`
(epochs 1788696554 / 1788698536 / 1788700165), so a Station 00 occurrence ran at 13:08Z — **but no
`00-00-supervisor-2026-09-06-13xx` breadcrumb exists anywhere in `docs/pr-prompts/`, `archive/` or
`superseded/`.** That is the "fresh `lastRunAt`, no breadcrumb" row of the station doc's table, which
reads as a defect. It is not one: `read_transcript` on session `local_4eb5a36a` (title `00 supervisor`,
idle) shows a **SIGHTED** 13:08Z run that opened **PR #1723** with auto-merge armed and wrote its
breadcrumb **inside its own PR worktree** — REPORT CONTRACT cure 1, the preferred home. #1723 is no
longer open, so it merged. 🔧 **Recorded because the next run to notice this will re-derive it:
cure 1 makes a breadcrumb invisible to a dev-tree listing until its PR lands, so absence from the
queue root is not absence of a report — read the session transcript before calling a run silent.**

**Freshness.** [CANNOT MEASURE] `check-breadcrumb.mjs --freshness` builds its tracked set with
`git ls-tree`, and `git` against the mount is refused by the guard installed above (correctly —
DOCTRINE §9.2). Cross-checked instead against `list_scheduled_tasks`: 00 `lastRunAt 14:08:15Z` ·
04 `14:09:54Z` · 05 `14:11:01Z` · 03 `2026-09-05T23:01:01Z` (`nextRunAt 2026-09-06T23:00:45Z`) ·
weekly-security-audit `2026-09-02T23:58:18Z` (`nextRunAt 21:32:17Z`). No station is silent.

**Board — GitHub-side read, and it is labelled as such, not offered as coverage of the tree.**
[MEASURED] `list_pull_requests` (read-only MCP; the token is write-403): **4 open**, all authored
`GH-Mantova`, **none carrying any label** — #1719 (12:47:32Z), #1713 (11:46:21Z), #1709 (10:44:19Z),
#1699 (08:44:40Z). The 13:08Z run reported seven; three merged since.

**RULE 2 — the probe is WORKING, FRESH and silent on all four.** [MEASURED] in the LIVE tree
`C:\ProjectOperations2\docs\pr-prompts\processed` (the `C:\po-watcher` copy was not read): **4096**
logs; newest by log CONTENT `2026-09-06T13:36:52Z` (`rev-1723-ready.md.log`), younger than every open
PR — the freshness control that separates the live directory from the 17-day-stale clone decoy.
POSITIVE `marco.:true` (regex form, no quote character) → **617**. NEGATIVE `zzzNoSuchNeedleZzz` → **0**.
Per-PR over `pr-*.log` only: **#1719 → 0 · #1713 → 0 · #1709 → 0 · #1699 → 0**; negative control
`PR #999999` → 0.

**Which absence — the launch-log discriminator, with its positive control.** [MEASURED] over the seven
top-level `*.log` files in `C:\po-watcher`: `opened PR #1719|#1713|#1709|#1699` → **0, 0, 0, 0**;
POSITIVE control `opened PR #` → **167**, newest line `[2026-09-06T02:01:30.367Z] … opened PR #1685,
policy=tests-docs, waiting…`; fresh NEGATIVE needle → 0. The watcher opened none of the four: they are
**SECOND LANE**, not watcher PRs inside a waiting window.

**Hand classification, `[NO LANE VERDICT — hand-classified]` (§10.1 step 2, `classifyPolicyFiles`).**
#1713, #1709 and #1699 carry `prisma/migrations/` paths (established by the 12:08Z run and unchanged).
#1719 re-classified this run from its own file list: `apps/api/src/modules/tendering/__tests__/allocation.service.spec.ts`
matches `(^|/)__tests__/`, but `apps/api/src/modules/tendering/allocation.service.ts` matches none of the
three forms → refused on that path. **All four are MARCO'S. None may be merged by this station.**

**The 13:08Z run's own open exposure — measured, and it did NOT fire this hour.** That run found six
of seven open PRs duplicated by a live, armable queue prompt and said plainly that this left "the next
hour unprotected by anything but this report". This is that hour. [MEASURED] all four survivors still
have their prompt on disk as an **unarmed `-HOLD.md`** — `pr-linefields-s1-model-and-validation-HOLD.md`
(#1713), `pr-tender-lifecycle-s2a-tenderclient-bidstatus-HOLD.md` (#1709),
`pr-ew-s2c-alloc-rejection-path-HOLD.md` (#1719), `pr-rates-value-column-units-HOLD.md` (#1699).
`*-ready.md` glob → **0**. `.arming-log.txt` newest entry `2026-09-06T09:20:50Z`, file **8295 B**, and
byte-identical on a second read at the end of this run — so no second actor armed anything while I read.

**Machinery — from log CONTENT only; this is NOT a liveness verdict.** [MEASURED]
`C:\po-watcher\ensure-watcher.log` last five lines all read `watcher alive, pid(s) 27236`, latest
`2026-09-06T14:15:03Z` — the same pid the 12:08Z and 13:08Z sighted runs saw, and no `RELAUNCHED`
line since `09:49Z`. `watcher-launch.log`'s tail is older (`05:27:31+10:00 Watcher exited with code 1`),
consistent with the standing note that `ensure-watcher.log` is the live one. Dev-tree
`.git/index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply` and
`sequencer` are all **absent** (file-existence reads).

**Watcher clone, by file read.** [MEASURED] `C:\po-watcher\ProjectOperations\.git\refs\heads\main` =
**`16ddb58b`** against `origin/main` **`a65ab1d4`**. Unchanged since the 12:08Z run. Loose ref read,
not `packed-refs` (whose `f86f689e` is stale, as ever).

## WHAT CHANGED

**Nothing on the board, nothing in the queue, nothing on the machine.** No prompt armed, disarmed,
renamed or moved. No PR merged, labelled, closed or commented. No `/sot/` edit. No process started or
killed. No `git` command of any kind, in any tree (the guard would have refused one against the mount
anyway). No `git checkout .` / `reset --hard` / `stash pop` / `clean`. No Azure / Entra / SharePoint
contact. No production data.

The only write this run made is **this breadcrumb**, in the dev tree at `docs/pr-prompts/`. 🔴 **It is
UNTRACKED and a blind run cannot open a PR** (the GitHub MCP token is write-403 and there is no `gh`),
**so it reaches nobody until a sighted Station 00 sweeps it into a board PR** — and until that
happens it is also an untracked file at a path a future fast-forward must create, i.e. the documented
FF blocker. **Sweep it up and the blocker goes with it.**

## FINDINGS

### F1 — S2 — Three scheduled stations fired inside 166 seconds again, and the obvious explanation for this run's blindness is REFUTED

[MEASURED] `list_scheduled_tasks`: 00 at `14:08:15.998Z`, 04 at `14:09:54.943Z`, 05 at `14:11:01.057Z`
— **166 seconds end to end** — and `list_sessions` shows both `04 scanner` and `05 sot keeper` in state
**running** while this run was reading. That is the second measurement of the already-ESCALATED
"three stations live at once, and nothing guards it" item (first: 165 s). **Cited, not re-raised.**

🔧 **What is new is the hypothesis it invites, and it should be killed here rather than chased later.**
The tempting reading is that three Cowork sessions racing to start the same stdio MCP server is what
times Desktop Commander out — it would explain a blindness whose cause the record says is unknown.
**It is refuted by this station's own history:** the **11:08Z** run was blind with `CONNECT_TIMEOUT`
(recorded in the 12:08Z breadcrumb's GROUND) and **no other station fired anywhere near it** — 04's
occurrences are `02:09 / 06:10 / 10:10 / 14:09`, 05 is daily at `14:11`, 03 daily at `23:00`. And the
converse also fails: the **10:08Z** run was SIGHTED with 04 firing at `10:10`. Concurrency is neither
necessary nor sufficient.

**Falsifying probe for anyone who wants to reopen it:** tabulate every 00 run's SIGHTED/BLIND state
against whether another station's `lastRunAt` falls within ±3 min. Two counter-examples already exist;
a third would only confirm.

**DISPOSITION: ACTIONED as a refutation** — recorded so the correlation is not re-derived and acted on.
The underlying cron-collision item stays with Marco, unchanged.

### F2 — S2 — The 13:08Z run's duplicate-prompt exposure did not fire in the hour it named

Measured above: all four surviving duplicate prompts are still unarmed `-HOLD.md`, the real armed count
is **0**, and `.arming-log.txt` has not moved since `09:20:50Z`. The exposure the 13:08Z run declared
("the next hour unprotected by anything but this report") was real and is still open — its cure is a
`triage-holds.ps1` DUPLICATES bucket, staged by that run and correctly gated behind an existing prompt
for the same file — but **no duplicate PR was created in this window**, by either lane.

**Falsifying probe:** `.arming-log.txt`'s newest entry, and the `*-ready.md` glob. If either moves while
one of the four PRs is still open, the exposure has fired and the next run will see a duplicate.

**DISPOSITION: ACTIONED as a measurement.** The staged cure is not mine to advance from a blind run.
**What would make it urgent:** any arm of one of the four named prompts, or a fifth open PR acquiring a
live prompt of its own.

### F3 — S2 — The watcher clone is still at `16ddb58b`, now three commits' worth further behind

[MEASURED] by file read: clone `refs/heads/main` = `16ddb58b`, `origin/main` = `a65ab1d4`. The 12:08Z
run's F1 — *both merged watcher fixes are undeployed because nothing in the launch path fast-forwards
the clone* — was DISPATCHED to Station 03 and re-affirmed by the 13:08Z run. It is unchanged, and the
live node (pid 27236, per `ensure-watcher.log` content) is still served from that clone.

**03 does not run until `2026-09-06T23:00:45Z`** (`nextRunAt`, measured), so this now sits ~9 h more.
That is the **fifth** measured cost of the open 03-cadence question (bootstrap 4 h vs live cron daily)
and of the open "who may FF the watcher clone" question. **Both are already with Marco; cited, not
re-raised.** 00 may not do it — `git` write in `C:\po-watcher\ProjectOperations` is an absolute hard
stop, and this run could not run `git` at all.

**DISPOSITION: DISPATCHED → Station 03**, unchanged and re-affirmed, as the same single piece of work
the 12:08Z run specified (FF the clone dealing with the untracked `docs/pr-reviews/` files first,
`stash drop` never `pop`; then restart in an idle window; then leave exactly one supervisor family).

### F4 — S2 — All four open PRs are Marco's, and #1699's red is still a receipt no agent may write

Established above with both controls. **None of the four carries a label**, which is the already-filed
"CP-26 is armed by LABELLING, not by the DIFF" gap; #1699's failing CP-26 wants
`docs/decisions/merge-approvals/1699.md`, and **no agent may author a `merge-approvals/<N>.md` or any
approval file** — it clears only when Marco commits the receipt or re-applies the label. Both are on
file from the 09:08Z, 10:08Z, 11:16Z and 12:08Z runs.

🔧 **New this hour, and it matters to #1699: `#1721` merged at `14:03:27Z`** — *"removing a label must
re-run CI, because CP-26 reads the LIVE label"*, adding `labeled, unlabeled` to `ci.yml`'s
`pull_request` types. That is the fix for the exact mechanism holding #1699 red: CP-26's verdict was
keyed on a label state that had already changed, and nothing re-ran it. [INFERRED, and deliberately not
acted on] it should let a future label event clear #1699's stale verdict — but **#1699 is still
second-lane and still Marco's by hand classification, so it is not mine to merge whatever colour it
turns.** Named here so the next run does not read a colour change as a clearance.

**DISPOSITION: ACTIONED as a measurement** — lane re-established for four PRs with controls, nothing
merged, nothing labelled. The two underlying gaps are cited, not re-filed.

### F5 — S3 — `packed-refs` is still stale, in both trees

[MEASURED] dev tree `packed-refs`: `refs/heads/main 4ea28d6d`, `refs/remotes/origin/main 66194af6`
against loose `a65ab1d4`. Clone `packed-refs`: `f86f689e` against loose `16ddb58b`. Every ref value in
this report was taken from the **loose** file, which is what git itself prefers.

**DISPOSITION: DEFERRED**, unchanged. What would make it urgent: any tool that resolves `main` through
`packed-refs` — including a blind run that reads the wrong file and reports an August tree as current.

## WHAT I DID NOT DO

- **Did not claim any verdict a blind run may not claim** — no `status-sweep` SAFE-TO-ACT, no smoke, no
  liveness, no merge verdict. The `ensure-watcher.log` lines above are log content, not a sweep.
- **Did not merge, label, unlabel, close or comment on anything.** All four open PRs hand-classify as
  Marco's; RULE 2 and §10.1 both bind, and an absent watcher verdict is never a clearance.
- **Did not write a `merge-approvals/<N>.md`** for #1699 or any PR, and did not remove `do-not-merge`
  from anything.
- **Did not arm, disarm, rename or move any prompt** — including the four duplicate `-HOLD.md`s, which
  must stay re-armable in case their second-lane PR closes unmerged (RULE 1's second half).
- **Did not run `git` anywhere**, and did not run any `.ps1`. The guard was installed first precisely so
  a cut-short call could not leave a 0-byte `index.lock` behind (DOCTRINE §9.2).
- **Did not substitute the GitHub-side board read for tree coverage.** It is labelled as a GitHub read
  everywhere it appears.
- **Did not archive any breadcrumb** — archiving is a `git mv`, and I have no git. Five 00 breadcrumbs
  plus 04's 1010 sit in the queue root; the 13:08Z run archived four others inside its own PR.
- **Did not touch `/sot/`**, `C:\po-vg`, the `-LOOPING.md` residue, or the untracked `docs/pr-reviews/`
  files. All are other stations' lanes or already dispatched.
- No Azure / Entra / SharePoint contact of any kind. No production data written.
