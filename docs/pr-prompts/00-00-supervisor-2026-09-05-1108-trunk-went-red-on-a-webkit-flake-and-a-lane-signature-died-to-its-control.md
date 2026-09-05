# Station 00 — Supervisor | 2026-09-05T11:08Z–2026-09-05T11:5xZ

## GROUND

```
UTC            2026-09-05T11:09:04Z
origin/main    fe714cc9   (at start; moved to ea6729de -> a7aaf2c6 -> 2bdaa487 through my own three merges)
dev tree       main @ 169cce3f -> fast-forwarded to fe714cc9, and again to 2bdaa487   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE**. **SIGHTED** — `start_process` on `powershell.exe` succeeded on
the first call (`LAPTOP-E6NHU4E4`, 2026-09-05T21:08:18+10:00), persistent shell PID 26640 for the
whole run. This was **not** a blind run.

All three binding documents were read in full, and all three working copies were proved
byte-identical to `origin/main` by the sound forms (`git rev-parse <ref>:<path>` vs
`git hash-object <path>`, plus `git diff --numstat` EMPTY) — never a piped hash:

```
docs/pipeline/DOCTRINE.md               origin=6ecbef0b… wc=6ecbef0b… numstat=[]
docs/pipeline/STATION-CAPABILITIES.md   origin=d60e1264… wc=d60e1264… numstat=[]
docs/pipeline/stations/00-supervisor.md origin=9009210d… wc=9009210d… numstat=[]
```

## WHAT I MEASURED

**[MEASURED] The dev tree opened two commits behind, and the only thing stopping the
fast-forward was a line-ending smudge.** `git rev-list --left-right --count HEAD...origin/main` →
`0 2`; `git diff --numstat` → **EMPTY**; `git status --porcelain` → two ` M` breadcrumbs. That is the
exact pair the station doc's FF section names, and the cure worked as written:
`git add --renormalize <the two paths>` → `git update-index --refresh` → `--numstat`, `--cached
--name-status` and the ` M` lines all EMPTY → `git merge --ff-only origin/main` succeeded. Read back
`0 0`. No `git checkout`, no `reset --hard`, no `clean` (§9.2).

**[MEASURED] The trunk was RED when I arrived, on a docs-only commit.**
`gh run list --commit fe714cc98364d04c74d870fad3ddf9067359c121` (full 40-char SHA — §9.4's short-SHA
trap) → `CI success`, `CodeQL success`, `Deploy in_progress`, **`Tendering Browser Smoke failure`**.
`fe714cc9` is `#1658`, whose diff is entirely `docs/pr-prompts/`.

I read the job log rather than the diff (§3, and YOUR LIMITS 6):
`gh run view 33962259210 --job 101296301129 --log-failed`. **18 of 19 tests passed.** The single
failure names its own cause:

```
1) [webkit] tests/e2e/tendering.spec.ts:103 legacy /tenders/create + /tenders/workspace return 200
   Error: page.goto: WebKit encountered an internal error
   - navigating to "http://127.0.0.1:4173/tenders/workspace", waiting until "load"
```

The identical assertion passed in chromium and firefox **in the same run**, and the same workflow
was `success` on all **15** prior `main` commits this morning (`33961413287` back to `33949483285`).
A browser-engine internal error on a docs-only diff is §5's transient, not a defect.

**[MEASURED] The re-run cleared it.** `gh run rerun 33962259210 --failed` → read back
`attempt=2 status=in_progress`, then `attempt=2 status=completed conclusion=success`. **Trunk green.**

**[MEASURED] `[LIVE]` expired inside my own run, again.** The 11:10:09Z sweep reported `OPEN PRs: 1`
and `no PR touched on GitHub in the last 2 min`. `#1659` was created at **11:10:56Z — 47 seconds
later**. Every sweep verdict in this run was therefore re-taken immediately before each mutation;
three said `SAFE TO ACT` at the moment of merging and one said `CAUTION … a PR was touched in the
last 2 min`, on which I waited 130 s and re-ran rather than acting.

**[MEASURED] One `CAUTION: LIVE STATION WORKTREE` was my own.** Section 2 named it:
`C:/po-worktrees/wt-doctrine93 … age=0 min` on my own branch. Section 2 prints the path — read it
before treating the caution as another actor.

**[MEASURED] RULE 2, fully controlled, on all three PRs I touched.** Live tree pinned to
`C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone): **1947** logs, newest
`2026-09-05T10:49:53Z` — younger than the oldest open PR (`#1656`, created 10:44:58Z), which is the
control that separates the live directory from the 17-day-stale decoy. `marco.:true` → **612**
(written without a quote character, per §10.1). Negative control `zzzNoSuchNeedleZzz` → **0**.
Prompt logs only, `rev-*` excluded:

| PR | `PR #<n>` in `processed\pr-*.log` | verdict |
|---|---|---|
| #1656 | 0 | `[NO LANE VERDICT — hand-classified]` |
| #1659 | 0 | `[NO LANE VERDICT — hand-classified]` |
| #1660 | 0 | `[NO LANE VERDICT — hand-classified]` |
| #600 (POSITIVE control) | **1** | real `{"ok":false,"marco":true,…}` |
| #999999 (NEGATIVE control) | 0 | — |

No arm since `2026-09-04T22:03:13Z` (`.arming-log.txt` tail), so none of the three is a watcher PR.

**[MEASURED] `check-breadcrumb.mjs --freshness` exit 0, CLEAN.** `structure: 9 checked, 0 malformed`.
`00` 0.6h / 2h ok · `03` 12.2h / 24h ok · `04` 1.1h / 4h ok · `05` 21.0h / 24h ok · `02`
dispatch-only. No station SILENT, none malformed.

**[MEASURED] Watcher healthy by the only sanctioned probe.**
`scripts\restart-watcher-if-wedged.ps1` (no `-Fix`) → `VERDICT: OK - nothing armed and the watcher
is alive`, `armed prompts waiting: 0`, `pid 20000`, `restart churn: 0 cycle(s) in 20 min`.
ENSURE-UP's `wrapper=N` question resolved the sound way, by parent chain rather than by command-line
vocabulary: `20000:node.exe <- 36224:powershell.exe <- 35328:powershell.exe` — supervised three
deep. No relaunch.

**[MEASURED] The board, counted by hand and not quoted from a note.** Q1: **0 open PRs** at
11:45Z, therefore **0 DIRTY**, therefore no frozen CI anywhere on the board. Q3: **`armed = 0`**;
the only `*-ready.md` on disk during the run was `rev-1659-ready.md`, an auto-generated REVIEW JOB
(§9.5), which is not an arm. **83** `-HOLD.md` staged. Q5: newest `no-pr-opened/` entry is
**2026-09-02T03:47:22Z** and newest `failed/` is **2026-08-28T21:03:55Z** — **no new silent no-op
and no new hard failure this cycle.**

## WHAT CHANGED

1. **`#1660` opened and merged** — `docs(doctrine): never compare file lengths across a git show /
   working-copy boundary`. Merged 11:37:37Z, merge commit `2bdaa487`. Verified on `origin/main`:
   the new needle returns **1**, negative control **0**, and `_canonical-blocks.json` on `main` now
   carries `instruments … bf19cb8c2a183569`.
2. **`#1656` merged** (Station 06 lane, AR-S2 correction) — 11:25:55Z, merge commit `ea6729de`.
3. **`#1659` merged** (Station 06 lane, settings-home `design_ref` + JR-S1) — 11:31:53Z, merge
   commit `a7aaf2c6`.
4. **The `main` Tendering Browser Smoke re-run** — red → green, no code change.
5. **`needs-marco/two-admin-routes-have-no-permission-guard-2026-09-05.md` discharged** (moved, never
   deleted) — see F3.
6. **Eleven dispositioned breadcrumbs archived** to `docs/pr-prompts/archive/`, and **this
   breadcrumb**, both inside this PR's own worktree (cure 1 — no loose copy in the dev tree).

All three merges went through `Assert-SmokedOrEscalate` → `Merge-Pr`, never `gh pr merge` by hand,
each with a pre-merge label read (`labels=[]` on all three; the script refuses on any label) and a
post-merge read-back asserting `state=MERGED`. A fresh `status-sweep.ps1` printed `SAFE TO ACT`
immediately before each one.

**Not changed:** nothing armed. No label applied or removed. `/sot/` untouched. No branch deleted.
No `git` write in `C:\po-watcher\ProjectOperations`. `C:\po-vg` untouched.

## FINDINGS

### F1 — A plausible lane signature appeared, and its own control killed it

`STATION-CAPABILITIES.md` §5 states that `mergedBy` reads `GH-Mantova` for every merge on this board,
agent and human alike, **"so the receipt is the only durable signature."** Reading `git log
--format=%cI` over `main`, a second signature seemed to appear for free, on every merge, with no
receipt needed:

| offset | commits |
|---|---|
| `+10:00` | `ea6729de` (**my own merge, ten minutes old**), `#1655` `#1654` `#1653` `#1652` `#1650` `#1647` — all 00-scheduled board PRs |
| `Z` | `#1658` `#1657` (cloud lane, *"at Marco's instruction"*), and every feature/fix PR of the last twelve hours |

The hypothesis wrote itself: `+10:00` = merged from the Brisbane box; `Z` = merged server-side.
It had a strong positive control — **my own merge**, made from this shell minutes earlier, on the
correct side.

🔴 **It is FALSE, and the control that killed it took one command.** DOCTRINE §10.3 names six
watcher native auto-merges after `#1400` — all six the *same* kind of merge. Measured:

```
#1476 +10:00   #1531 +10:00   #1534 +10:00   #1537 +10:00   #1514 Z   #1563 Z
```

**Six identical events, split 4 / 2 across the two offsets.** The offset carries no lane
information. Had I stopped at the first table I would have written a new discriminator into a
binding document, and the next run would have used it to decide whether a PR was Marco's.

**DISPOSITION: ACTIONED — recorded here so the next run does not re-derive it.** The correlation is
real, striking, and available to anyone who runs `git log --format=%cI`; what is *not* available
unless someone writes it down is the control that refutes it. §5's "the receipt is the only durable
signature" **stands, re-tested.** I have deliberately not put this in DOCTRINE: it is a refuted
hypothesis, and §9 is for traps that cost work, not for every idea that failed.

### F2 — The arming trigger the previous run handed me PASSES, and the thing it proxies for is FALSE

The 10:35Z run's handover set the condition for arming again: *"open `pr-cardui-s*` at zero **and**
no new `merge-approvals/<N>.md` for a full cadence."* Both halves measured:

- open `pr-cardui-s*` PRs: **0** ✅
- newest receipt `merge-approvals/1651.md`, committed `2026-09-05T09:23:40Z` (by `git log -- <dir>`,
  never the file mtime — §9.5). At 11:45Z that is **2h22m**, past a 2 h cadence ✅

**So the trigger says arm. It is wrong, and I have the counter-example in the same window.** The
cloud lane merged **`#1657` at 10:58:59Z and `#1658` at 11:02:40Z** — 45 minutes ago — *"stage the
five prompts from Marco's 2026-09-05 decisions"* and *"the two plantdays slices become one, at
Marco's instruction."* Neither carries a receipt, and neither needed one: `CP-26` fails
`RELEASED_NO_RECEIPT` only for a **released** PR, and nothing about those two required a label to be
removed. **A quiet receipt directory is therefore evidence about label removals, not about whether
the lane is active** — and the four new `-HOLD` prompts that arrived in my own fast-forward are that
lane's output, landing in the queue I would have been arming from.

Station 06 was equally live: it opened `#1656` at 10:44:58Z and `#1659` at 11:10:56Z, the second
47 seconds after my sweep declared the board quiet.

**DISPOSITION: DEFERRED — I did not arm, and the trigger is replaced rather than merely failed.**
Arming into two live lanes is how `#1634`/`#1639` and `#1611`/`#1637` became duplicate PRs. The
sound trigger, for the next run, is a direct measurement of the lanes rather than a proxy for one of
them: **no commit on `origin/main` from a lane other than your own within the last cadence** —
`git log --since` on `origin/main`, excluding your own board PRs by subject — **and** open
`pr-cardui-s*` at zero. That reads the activity itself instead of a receipt that a lane is not
obliged to leave.

### F3 — `needs-marco/two-admin-routes-have-no-permission-guard` is REFUTED, and I verified the refutation myself

The escalation (raised by 00 at 06:08Z from Station 06's 05:15Z breadcrumb) asserts that
`/admin/schedule-of-rates` and `/workers/job-roles` are **bare `<Route>`s**, so *"any signed-in user
can open both today"*, and blocks `pr-settings-home-s1`. Station 06's own 06:20Z breadcrumb retracts
it — the guards exist a layer down. Per §7.1's re-read rule I did not take that on trust:

```
apps/web/src/pages/ScheduleOfRatesAdminPage.tsx
  :319  const canManage = useMemo(() => can(user, "rates.manage"), [user]);
  :514  return <NoAccess required="rates.manage" />;          NEG control in the same file -> 0
apps/api/src/modules/job-roles/job-roles.controller.ts
  :21   @UseGuards(JwtAuthGuard, PermissionsGuard)
  :26 :34  @RequirePermissions("resources.view")
  :43 :53 :63  @RequirePermissions("resources.manage")
```

**No data is exposed.** The escalation was a route-table measurement presented as a system claim —
`App.tsx` is one of three places a guard can live, and it was the only one read.

What survives is a **different and real** defect, which 06 found and staged rather than escalated:
`apps/web/src/pages/admin/JobRolesPage.tsx:33` reads
`rolesRes.ok ? await rolesRes.json() : []`, so a **403 renders as an empty table** — not *"you may
not see this"* but *"there are none."* Present on `origin/main` today, and it is precisely the
failure `NoAccess.tsx` exists to end.

**DISPOSITION: ACTIONED.** Discharged to `needs-marco/discharged/` with a note (moved, never
deleted). Marco should not be asked to rule on an authorization question whose premise is false, and
he has in any case already ruled at ~06:0xZ; `pr-jobroles-s1-noaccess-instead-of-a-dead-shell-HOLD.md`
carries the surviving defect and is on `main` as of `#1659`. `pr-settings-home-s1` is no longer
blocked by this escalation — it is blocked only by the ordinary arming decision in **F2**.

### F4 — Station 06's two new breadcrumbs, collected

Both arrived inside PRs I merged this run, so they post-date every earlier COLLECT.

- **`00-06-pr-master-2026-09-05-0530-addendum`** — four findings, three self-ACTIONED (the three
  mock-ups are browser downloads on Marco's laptop, not lost; the originals confirm the rebuilds;
  the real risk is *where an approved design lives*). Its finding 4 — *"`theme-system-mockup.html`
  is still unpublished, **DEFERRED**, publishing it is Marco's call"* — **is already superseded by
  06's own later breadcrumb**, which records it published as `7c395739`. **DISPOSITION: ACTIONED,
  nothing outstanding**; the DEFERRED item is closed by a fact 90 minutes younger than it.
- **`00-06-pr-master-2026-09-05-0620`** — five findings, all self-ACTIONED, including the retraction
  in F3 above and the observation that a design existing only as a PDF cannot satisfy `design_ref`,
  so it **silently freezes its own slice** (`lint-prompt.mjs` REJECTs an `apps/web/` scope with no
  `design_ref`). **DISPOSITION: ACTIONED** — the retraction is acted on in F3; the rest needs
  nothing from 00.

### F5 — My own COLLECT probe produced a false orphan, and the control found it

Searching `00-00-*.md` for the filename of Station 04's 06:10Z breadcrumb returned **zero**, which
reads as *"no 00 run ever collected it"* — an unreported station report, the exact failure COLLECT
exists to prevent. Re-run against the archive with content needles instead of the filename, it is in
`00-00-supervisor-2026-09-05-0708-…` as **F3 and F4**, and its fix is on `main` in `#1647`.
**A breadcrumb is not cited by filename; it is cited by its finding.** §9.6, in my own instrument,
in the step this station exists to perform.

**DISPOSITION: ACTIONED** — recorded, and the archive is now included in the search path.
⚠️ Note for anyone reusing my controls: **`zzzNoSuchNeedleZzz` is a broken negative control against
`docs/pr-prompts/` and against `DOCTRINE.md`** — it returned **19** and **true** respectively,
because both quote it as documentation. Pick a needle that does not appear in the corpus you are
searching, and check that it does not.

### F6 — `status-sweep.ps1` §5 calls a live escalation DEAD for citing merged PRs

The sweep tags an escalation `[STALE] … escalation is DEAD, clear it` when any PR it references is
merged. `label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` drew **30** such
lines this run — and those 30 merged PRs are its *evidence corpus*, not its subject. The same
over-fire hits `agent-authored-rule-2-clearance-2026-09-04.md` (13 lines) and
`station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`.

**DISPOSITION: DEFERRED**, and only because it is already known and guarded: the standing rule is
never to clear an escalation on a `[STALE]` line without reading the file, which is what I did in
F3. Recorded because the ratio is getting worse — 30 `[STALE]` lines against one genuinely dead
escalation — and a warning that fires 30 times for nothing is a warning nobody will read. **Trigger:
if a run ever discharges an escalation *on the strength of a `[STALE]` line alone*, this becomes
urgent and the fix is a §5 that requires the referenced PR to be the escalation's subject.**

### F7 — ARCHIVING A BREADCRUMB BREAKS ANY BINDING DOCUMENT THAT CITES IT BY PATH

Found by my own PR going red, which is the only reason it was found at all.

`#1661` failed `Pipeline — watcher + linter tests`. I read the job log rather than the diff:

```
REJECT  docs/pipeline/DOCTRINE.md
  x names a repo path that git does not track:
    docs/pr-prompts/00-00-supervisor-2026-09-05-0608-doctrine-forbids-the-cloud-lane-from-merging-and-it-merged-1615-mid-run.md
REJECT: 1 of 8 docs failed
```

**I caused it.** DOCTRINE §10.2.1 ends `**Filed against:** <that breadcrumb>`, and the archive pass
in this very PR renamed the file to `docs/pr-prompts/archive/…`. `lint-station.mjs` checks that every
repo path a station document names is **tracked at that path** — so archiving a cited breadcrumb
invalidates the citation and reds the document that carries it.

🔴 **The station doc's ARCHIVE instruction says archiving is safe, and its evidence is about a
different instrument.** It proves the case for `check-breadcrumb.mjs` — freshness matches by trailing
path segment, so an archived breadcrumb still counts and no station can be made to read SILENT. That
is true, and it is not the coupling that bites. **`lint-station.mjs` is a second reader of the same
filenames and it is not mentioned.** DOCTRINE §9.5's own bullet on `check-breadcrumb.mjs` closes with
*"do not quote the one result as covering both"* — about two passes inside one script. This is the
same shape one level up: two scripts, one filename, and only one of them surveyed.

**DISPOSITION: ACTIONED.** The complete-and-additive fix, in this same PR (§8.2 — one fix in place):
§10.2.1's citation now points at `docs/pr-prompts/archive/…` and says in one line why the path moved,
so the reference survives and archiving stays available to every future run. `lint-station.mjs` →
`ADMIT: all 8 docs clean`, exit 0. Edited with node and slice-and-concatenate, byte delta asserted:
`BEFORE=80294 AFTER=80519 DELTA=225 EXPECTED=225 OK=true`, `OLD_GONE=true`, `NEW_ONCE=true`. The
citation sits at byte 70845, past `END-CANONICAL-BLOCK: instruments v2` at 57987, so no canonical
re-record was needed — asserted, not assumed.

The alternative — leave that one breadcrumb unarchived — fails RULE 1's future half: it silently
creates a class of un-archivable breadcrumbs with nothing recording which ones or why, and the next
run pays the same red to rediscover it.

🔧 **For the next run: before archiving, grep the binding documents for each filename you are about
to move** — `Select-String -Path docs\pipeline\*.md,docs\pipeline\stations\*.md -Pattern <name>` —
and repoint any hit in the same PR. One citation existed today; the check is two seconds and the
alternative is a red board PR.

## WHAT I DID NOT DO

- **I did not arm anything** — F2, with the measurement that refutes the trigger I was handed.
- **I did not remove or apply a label**, and the merge script refuses outright on any label.
- **I did not delete `feat/crm-account360-v2-s1`**, `fix1483`, or any remote branch. The 10:35Z
  run's standing instruction holds: `#1612`'s branch is measurably the only copy of that code and
  the question is Marco's.
- **I did not touch `C:\po-vg`** (1 uncommitted file, `check-pipeline-heartbeat.mjs`, which exists
  nowhere else — `--force` would destroy it) or the watcher clone's 5 dirty files. Both are 03's,
  both already dispatched.
- **I did not put F1 in DOCTRINE.** A refuted hypothesis is not an instrument trap; §9 is already
  long enough without every idea that failed.
- **I did not edit `.gitignore`** for the two runtime-state files in the queue root. Unchanged from
  the 10:35Z run's reasoning: it would take the PR outside `^(tests|docs)/`.
- **I did not `git add docs/pr-prompts` wholesale.** Every stage in this PR was by explicit path.
- **I did not touch `/sot/`, Azure / Entra / SharePoint, or production data.**

## HANDOVER

- **Marco — nothing new needs you this run.** One escalation was *removed* from your queue (F3,
  refuted by measurement). The open ones are unchanged: `#1612`'s closed-unmerged branch, `fix1483`,
  and the receipt/gate question in `#1635`.
- **03 — Machine Minder:** unchanged and still open — clone 40+ behind and dirty (5 files),
  `C:\po-vg`, the clone stash count. Nothing new from me.
- **The next 00 run:** the board is **empty** — 0 open PRs, 0 armed, 83 staged HOLDs, watcher alive
  and idle. That is starvation, not blockage, and it is the single most important thing about the
  board right now. Use **F2's replacement trigger**, not the receipt proxy: measure the other lanes'
  commits on `origin/main` directly.
