# Station 00 — Supervisor | 2026-09-17T15:08:14Z–2026-09-17T15:33:57Z

## GROUND

```
UTC            2026-09-17T15:08:14Z
origin/main    a2f5e8a6   (at preflight; 10a4a0c1 after this run merged #2007)
dev tree       main @ a2f5e8a6   C:\ProjectOperations2
doc version    1          docs/pipeline/stations/00-supervisor.md front matter
bootstrap      1          scheduled-task SKILL.md
```

Doc version and bootstrap **agree**. This run was NOT read-only for that reason.

**SIGHTED run.** The previous occurrence (14:09Z) was blind; this one reached the box on the first
keyword load. Both facts are in this report because a blind run and a healthy quiet run produce the
same silence.

## WHAT I MEASURED

**Reachability — sighted.** [MEASURED] `ToolSearch` keyword load for `desktop-commander` first, never
a literal `select:` of assumed ids — the ids in this session are the plugin-prefixed
`mcp__plugin_desktop-commander_desktop-commander__*` form. Then `start_process` shell `powershell.exe`
→ PID 21672, which returned `2026-09-18T01:08:14.9175693+10:00`, `main`, and
`a2f5e8a6 2026-09-17 23:22:44 +1000`.

**Device-bridge git guard — PASS, last line quoted as the contract requires.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
vm-git-guard installed at /sessions/charming-vibrant-edison/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
EXIT=0
```

No `git` was run through the device bridge this run, and this run created no `index.lock`.

**Binding documents read IN FULL from a working copy proved equal to `origin/main`.** [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, run in the dev tree after `git fetch origin`
(PREFLIGHT's per-tree rule). EMPTY `--numstat` is the real answer; **no piped hash was taken and none
is quoted** (§9.1's `powershell.exe` pipe is unsound). Line counts read: `DOCTRINE.md` **2588**,
`00-supervisor.md` **1349**, `STATION-CAPABILITIES.md` **544**. `git rev-list --left-right --count
HEAD...origin/main` → `0 0`.

**Sweep — captured to a file and decoded, not read from the stream.** [MEASURED]
`status-sweep.ps1 *> <file>` wrote **149,460** bytes opening `FF FE`; decoded `utf16le` in node to
**74,739** bytes / 889 lines (§9.3 — `*>` is the same UTF-16LE trap as `>`, and the preflight's own
cure walks into it). Section 0 controls: `gh CAN reach GitHub (saw merged PR #2006)` and `node runs`.
Section 7 verdict at `15:09:40Z`: **SAFE TO ACT**.

🔴 **Re-run immediately before the only mutation of this run**, because `[LIVE]` means "true when
measured": second sweep at **`15:16:09Z`**, again **SAFE TO ACT**, `index.lock interactive/clone:
False / False`, `git processes touching our trees (scoped): 0`, `no PR touched on GitHub in the last
2 min`. The merge followed at `15:20:12Z`.

**Section 5 `[STALE]` escalation rows: ZERO, on both sweeps.** [MEASURED] a `[STALE]` scan over the
decoded report returned **4** lines and **all four are non-rows** — the header legend (line 0), the
HOW-TO-READ legend (line 3), a `[FILE]` quotation of a station note about clearing them (line 119),
and the closing footer (line 888). The eleven PR-scoped dead rows my station doc tells me to clear
during COLLECT are **already cleared**; there was nothing to discharge this run. NEGATIVE control:
`[BROKEN]` matched **1** line, and that line is the legend sentence *"If ANY [BROKEN] appears in
section 0, STOP"* — i.e. the same non-row shape, which is why the scan was read by hand rather than
by count.

**Freshness — CLEAN, exit 0.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness`:
`structure: 3 checked, 0 malformed`; `00` 1.1h ago (cadence 2h) ok · `03` 16.2h ok · `04` 1.1h ok ·
`05` 1.1h ok; `CLEAN`; `FRESHNESS_EXIT=0`. ⚠️ **That `ok` on `00` is the weak row** — the `CADENCE`
map in `check-breadcrumb.mjs` still carries `'00': 2` against a live cron of `5 * * * *`, so `00` is
not called SILENT until 4 h, i.e. after three missed hourly runs. Recorded because
`STATION-CAPABILITIES.md` §6 asks for it, and crossed below rather than trusted.

**Cross against `lastRunAt` — all four ENABLED stations aligned, no station SILENT.** [MEASURED] from
the scheduled-tasks MCP, against each station's newest breadcrumb:

| station | cron | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|---|
| `00-supervisor` | `5 * * * *` | `2026-09-17T15:07:54Z` | `14:09Z` | `15:07` **is this run**; the 14:09 occurrence reported (blind). aligned |
| `04-scanner` | `0 */4 * * *` | `2026-09-17T14:09:32Z` | `14:10Z` | aligned |
| `05-sot-keeper` | `10 0 * * *` | `2026-09-17T14:10:38Z` | `14:11Z` | aligned |
| `03-machine-minder` | `0 9 * * *` | `2026-09-16T23:01:15Z` | `2026-09-16T23:02Z` | aligned; next `23:00:45Z` |

`weekly-security-audit` is **`enabled: false`** (`lastRunAt 2026-09-06T21:32:44Z`), so the live
enabled count is **FOUR** — confirming `STATION-CAPABILITIES.md` §1's 2026-09-15 correction and 04's
F3 this morning. No `lastRunAt`-fresh-but-no-breadcrumb row, so no transcript read was required.

**Armed prompts, counted myself, not quoted from a note.** [MEASURED]
`Get-ChildItem docs\pr-prompts -Filter '*-ready.md' -File` → **ARMED_COUNT=0**, zero names. The sweep
agrees (`armed (*-ready.md): 0`). **Q3 answered: 0.**

**The board, per-PR and live.** [MEASURED] `gh pr view <n> -R <owner>/<repo> --json ...` on all four
open PRs (`-R` on every call and `$LASTEXITCODE` tested before parsing — §9.4's CWD bullet):

| PR | mergeState | labels | files | lane probe hits | classification |
|---|---|---|---|---|---|
| **#2007** | CLEAN | *(none)* | 3 (`sot/` + `docs/`) | **0** | second lane → hand-classified **05 doc-reconcile**, §10.1 step 3 |
| **#2005** | BLOCKED | `do-not-merge` | 21 | **2** | watcher-opened, genuine `marco:true` |
| **#2002** | BLOCKED | `do-not-merge` | 2 | **2** | watcher-opened, genuine `marco:true` |
| **#1998** | BLOCKED | `do-not-merge` | 3 | **2** | watcher-opened, genuine `marco:true` |

Lane probe is §10.1 step 1 run correctly — `processed\pr-*.log` only, `rev-*` **excluded**.
**POSITIVE control** `PR #1850` → **2** hits carrying a real verdict; **NEGATIVE control** `PR #999412`
→ **0**; newest `processed/` log `rev-2007-ready.md.log` at `14:31:33Z`, younger than the oldest open
PR, which is the control that separates the live tree from the clone's dead decoy (§9.5).

**The three parked PRs carry the real thing, quoted verbatim, not inferred from the label:**

```
[watcher] merge result for PR #2005: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}
[watcher] merge result for PR #2002: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}
[watcher] merge result for PR #1998: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}
```

RULE 2 binds on all three. **Only Marco removes the label.** I did not merge them and did not touch
a label.

**Q1 — DIRTY count: ZERO.** [MEASURED] no open PR reads `DIRTY`; the three BLOCKED are blocked by the
label gate, not by a conflict. So the board's CI is not frozen and no conflict work exists this run.
**Q2:** no conflict, so nothing to arm or escalate on that axis.

**#2005's third red is real, and it is the one thing the parked-PR shortcut hides.** [MEASURED]
`statusCheckRollup` on all four, counting only non-SUCCESS/NEUTRAL/SKIPPED rows:

| PR | not-green checks |
|---|---|
| #2007 | **0 of 15** |
| #2002 | 2 — `PR gates — diff checks`, `Approval receipt (CP-26)` |
| #1998 | 2 — same pair |
| **#2005** | **3** — that pair **plus `API — lint, test, compliance smoke` FAILURE** |

§9.4 records the CP-26 pair as *"TWO REDS WITH ONE CAUSE … PARKED BY DESIGN, not a defect and not
work."* That is correct and it is exactly why a **third** red is easy to miss: the shortcut matches on
the label, and the count is the only thing that distinguishes 2 from 3. Station 05 caught it at
14:11Z from the other side and dispatched it to me; this run root-caused and fixed it (F1).


**Root cause of that third red, read from the job log — never from the diff or the PR page.**
[MEASURED] the failing run `35228050251` job `105224635701` has `headSha =
de3787d18922ccd9caa71d97ac33f26a2b45d4b2`, **equal to #2005's head at the time** (`HEAD_MATCH=True`),
so the red was current and not a stale run. The log is **4108** lines of three tab-separated columns;
**column 3 only** was searched (§9.1 — column 1 is the job name, so a whole-line grep for anything in
the job's own title matches every line):

```
FAIL src/modules/tendering/__tests__/cutting-create-cardid.spec.ts
  ● ScopeRedesignService.createCuttingItem — cardId contract (PR B4b.1) › real cardId still validates against scope_cards (B4b regression)
    TypeError: Cannot read properties of undefined (reading 'findUnique')
    > 634 |       this.prisma.tenderEstimate.findUnique({ where: { tenderId }, select: { markup: true } })
      at ScopeRedesignService.createCuttingItem (src/modules/tendering/scope-redesign.service.ts:634:34)
Test Suites: 1 failed, 1 skipped, 303 passed, 304 of 305 total
Tests:       1 failed, 6 skipped, 4378 passed, 4385 total
##[error]Process completed with exit code 1.
```

POSITIVE control on that parse: `Test Suites:` → 1, `PASS ` lines → **303**. NEGATIVE control, a
needle minted this run → **0**.

**Both halves of the cause confirmed against the actual files, not inferred.** [MEASURED]
`buildPrismaMock` in `cutting-create-cardid.spec.ts` (153 lines, **not** in #2005's diff, so
unchanged from `main`) stubs `tender`, `scopeCard`, `cuttingSheetItem`, `cuttingOtherRate`,
`estimateCuttingRate`, `estimateCoreHoleRate` — and **no `tenderEstimate`**. At #2005's head,
`scope-redesign.service.ts:634` is a **new** `this.prisma.tenderEstimate.findUnique` inside
`createCuttingItem`'s `Promise.all`, added by `SCOPE_LINE_MARKUP_ALL_TYPES_V1`. Only the fourth test
reaches it; the other three throw at the cardId guard first — which is why exactly **one** test failed
and not four. `augmentCuttingMoney`, the helper downstream, was checked for a second prisma
dependency and has none (`PRISMA in 469..520 = false`), so the mock gap is the whole cause.

**Positive control before claiming any fix worked: I reproduced the failure locally first.**
[MEASURED] in a disposable worktree off the PR head `de3787d1` (never the dev tree, never the watcher
clone): `npx jest --testPathPattern cutting-create-cardid` → `Tests: 1 failed, 5 passed`,
`BEFORE_FIX_EXIT=1`, with the identical stack at `scope-redesign.service.ts:634:34`.

**After the one-line fix.** [MEASURED] same command, same worktree: `PASS`, `Tests: 6 passed, 6
total`, `SPEC_EXIT=0`. Byte-delta assertion on the edit (§9.3 — catches a `String.replace` `$`-spill):
`BEFORE_BYTES=7190 → AFTER_BYTES=7641`, `EXPECTED_DELTA=451 ACTUAL_DELTA=451`, `DELTA_OK=true`,
`U+FFFD` **0 before and 0 after**. The replacement was passed as a **function**, not a string.
`npx eslint` on the changed file → `LINT_EXIT=0`.

**Blast radius, and the one local red that is NOT mine.** [MEASURED] the whole tendering module in the
worktree: `Test Suites: 1 failed, 44 passed`. The single failure is
`quote-destination-backfill.spec.ts`, a **DB-backed** spec failing on `prisma.scopeOfWorksItem.deleteMany`
because my worktree has no Postgres container. **That is environmental, and it was proved rather than
assumed:** that same spec reads `PASS src/modules/tendering/__tests__/quote-destination-backfill.spec.ts`
in CI run `35228050251` at the identical head (`QD_MENTIONS=1`, among the 303 PASS lines).

## WHAT CHANGED

**1. `#2007` MERGED — the only merge this run, and it was not watcher-routed.** [MEASURED]
`Assert-SmokedOrEscalate -PR 2007 -MustContain @('docs/data-model/sweeps/2026-09-17.md',
'sot/02-roadmap-and-status.md')` → `True True True`, then `Merge-Pr -PR 2007` → `True`. Independent
read-back, not the primitive's own return: `state=MERGED`, `mergedAt=2026-09-17T15:20:12Z`,
`mergeCommit=10a4a0c1156152a50aee3f209abc464c3d337757`. Never a raw `gh pr merge`, never a hand
`git merge`.

Why it was mine: **0** lane-probe hits with both controls passing ⇒ not watcher-opened ⇒ §10.1 step 2,
then **step 3** — it is a known station lane (`05 → sot/`), classified by `STATION-CAPABILITIES.md` §5,
and **the PR body names its lane** so the claim is checkable: *"Station 05 (scheduled, sighted)
doc-reconcile. Lane: 05 → `sot/` … `sot/` + `docs/` only — CP-24 clean."* §5's merging paragraph gives
00 docs-only and `sot/`-only PRs. It carried **no label** and **0 of 15** not-green checks.

**2. `#2005` driven toward green — pushed, NOT merged.** Commit `f2608367` → rebased to `6824f3fd`,
pushed `e27e49d2..6824f3fd` onto `feat/scopecards-s3-line-markup-all-types`. One file, **6 insertions**,
a test mock only. Read-back: `gh pr view 2005` → `head=6824f3fd`, `HEAD_IS_MY_PUSH=True`,
`state=OPEN`, `labels=do-not-merge`. **The label and the `marco:true` verdict both still stand and I
did not touch either.**

🔴 **The first push was REJECTED, and that is worth recording because it is the single-actor rule
firing rather than a mistake.** Another actor ran an update-branch on #2005 at `15:23:35Z` —
**three minutes after my #2007 merge landed on `main`** — producing `e27e49d2 Merge branch 'main' into
feat/scopecards-s3-line-markup-all-types`, authored `GH-Mantova <…users.noreply.github.com>`, which per
§10.2.1's identity table names **the GitHub web UI / API**, not a tree. My own merge is what made that
branch BEHIND. [MEASURED] before doing anything: `git diff --numstat de3787d1 origin/<branch> --
cutting-create-cardid.spec.ts` → **EMPTY** — the other actor did not touch my file — and the three new
commits are exactly #2007's own three paths. So a rebase of one commit was safe and could not conflict.
`rebaseExit=0`, `UNMERGED=` empty, `STATUS=` clean, fix still present (`FIX_PRESENT_HITS=1`), then a
**re-fetch immediately before the push**. A non-force push was used throughout: it is the primitive
that refuses rather than clobbers, and it did exactly that the first time.

**3. This run's board PR** carries the two unreported breadcrumbs, `sweep-rotation.json`, this
breadcrumb, and the archive move. Details under FINDINGS F2–F4.

**Nothing else.** No prompt armed, disarmed, renamed or moved (**0 armed before, 0 after**). No label
added or removed. No `/sot/` edit. No watcher restart. No Azure / Entra / SharePoint. No commit on
`main` in the dev tree. No `git` in `C:\po-watcher\ProjectOperations`.


## FINDINGS

### F1 — #2005 carried a third red with a real cause, and the "do-not-merge ⇒ two CP-26 reds ⇒ parked" shortcut is what hides it

Dispatched to me by Station 05 at 14:11Z; root-caused from the job log and fixed this run.
`SCOPE_LINE_MARKUP_ALL_TYPES_V1` added `this.prisma.tenderEstimate.findUnique` to
`createCuttingItem`; `buildPrismaMock` in the pre-existing `cutting-create-cardid.spec.ts` carries no
`tenderEstimate`, so the one test that reaches the insert threw before any of its assertions ran.

The fix adds the missing stub and nothing else. It returns `null`, which exercises the service's own
documented default markup of 30. **No assertion was weakened, no test skipped, no marker faked** —
§8.2's line on what a quick fix may never be. The spec's real assertions (`scopeCard.findFirst` called
once with the right where-clause; `cardId` persisted) were failing to run at all and now run.

⚠️ **The generalisable half is the counting, not this bug.** §9.4 is right that a `do-not-merge` PR
shows two reds from one cause and is parked by design. What it does not say is that the *number* is
load-bearing: **2 reds ⇒ parked, 3 reds ⇒ parked AND broken**, and the second is agent-side work. Two
consecutive collect runs (mine at 13:16Z, which read "no agent-side work behind either red", and the
board generally) had the shortcut available and the third red was only found because 05 looked at a
different instrument. 🔧 **Read the not-green COUNT, then the CP-26 verdict token — never the token
alone.** Falsifying probe: `statusCheckRollup` on any labelled PR; if a labelled PR ever shows more
than two not-green rows, the extra rows are work.

**DISPOSITION: ACTIONED — and CONFIRMED GREEN IN CI, not merely pushed.** [MEASURED] at
`15:4xZ` on the new head `6824f3fd`, from `statusCheckRollup`:
**`API — lint, test, compliance smoke` = SUCCESS** (run `35240510178`, job `105267498705`).
The third red is gone and #2005 is back to exactly the documented parked shape — `NOT_GREEN_COUNT=3`,
being the two CP-26 rows (one cause, the label) plus `tendering-e2e` still `in_progress` at the
moment of reading, which is a pending check and not a failure.

This is stated as the earlier draft of this finding would not let it be: that draft recorded the CI
outcome as `[CANNOT MEASURE]` because the run was still in flight, and it was corrected here rather
than left to the next occurrence once the measurement became available inside this run.

**NOT merged, and that is unchanged by the fix working.** RULE 2 and the `do-not-merge` label both
bind, only Marco removes the label, and #2005 remains his to release. Driving it green is the whole of
what my lane permits. ⚠️ `tendering-e2e` had not concluded when this was written — if it lands red it
is a NEW finding, not this one.

### F2 — COLLECT: Station 00's own 14:09Z blind run (3 findings, all dispositioned here)

[MEASURED] **not tracked anywhere** — a `git ls-files docs/pr-prompts` basename match over the
**tracked set** (1254 files), not a dev-tree `git status`, returned empty for it. So it genuinely
reached nobody and this PR commits it.

- **F-1, Station 00 ran blind (CONNECT_TIMEOUT).** Confirmed independently: 04's 14:10Z run reached
  the same server **57 seconds later** on its first keyword load, so the intermittency is real and
  00's STOP was correct rather than a mis-read schema. **DISPOSITION: ESCALATED** — carried to Marco
  unchanged and folded into F6 below; it is an availability question and the option set that run put
  to him is sound. No agent-side fix exists.
- **F-2, two local stdio MCP servers timing out together as a lead.** [MEASURED] this run
  `desktop-commander` connected on the first try while `prisma:Prisma-Local` is **still** `CONNECTION_CLOSED`
  in this session's failed set — so the two do **not** move together, which is evidence against the
  shared-local-launcher hypothesis rather than for it. **DISPOSITION: DEFERRED**, trigger narrowed:
  it becomes worth a host-side test only if `desktop-commander` and `Prisma-Local` are ever observed
  failing *in the same run* a second time. This run is a counter-example, not a confirmation.
- **F-3, "clock disagreement between the session environment and the VM."** **Refuted — see F5.**
  **DISPOSITION: ACTIONED** (corrected, with the measurement, below).

### F3 — COLLECT: Station 04's 14:10Z scanner run, `instruction-drift` sweep (5 findings)

[MEASURED] likewise **not tracked anywhere**; this PR commits it. Its `sweep-rotation.json` advance
(`last_index=3`) is committed here too — 04 may not commit to the dev tree, and without this the
rotation silently repeats `instruction-drift` and never reaches `gate-liveness`. [MEASURED]
`git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → `2 2` before this PR.

- **F1, all four enabled bootstraps still omit all four PREFLIGHT preconditions.** Re-verified by 04
  at `a2f5e8a6`, every row 0 of 4, controls both directions. **DISPOSITION: ESCALATED** → F6.
- **F2, `.gitignore:107-111` still wrong in 4 of 4 bootstraps**, plus a second instance
  (`pr-gates.mjs:327` in `05-sot-keeper`'s bootstrap). **DISPOSITION: ESCALATED** → F6.
- **F3, that escalation's denominators are one task out of date (5 → 4).** Independently confirmed by
  my own MCP read this run: four enabled, `weekly-security-audit` `enabled: false`.
  **DISPOSITION: ESCALATED** → F6, where the corrected denominator is stated once.
- **F4, three open escalations all asking Marco for the same physical act.** **DISPOSITION:
  ESCALATED** → F6. This is the one I am re-surfacing rather than re-filing.
- **F5, 04's own path-resolution probe manufactured 7 phantom missing files** (an extension
  alternation matching `js` inside `.json`), caught in-run and corrected to longest-first.
  **DISPOSITION: ACTIONED by 04** — the defect was in its instrument, it never reached the repo, and
  the corrected form plus its falsifying probe are recorded for the next `instruction-drift` sweep.
  Nothing for me to do; recorded so it is not re-derived.

### F4 — COLLECT: Station 00's 13:16Z run (6 findings, already dispositioned) — archived

[MEASURED] tracked at `docs/pr-prompts/00-00-supervisor-2026-09-17-1316-…md`, so it is already
reported; all six findings (F1–F6) carry an explicit disposition line. Its **F1 is the one that has to
be re-taken rather than inherited**, because a lane verdict is non-monotonic (§10.1): I re-measured
all four PRs live this run rather than carrying its classification forward, and its F1 conclusion was
correct at 13:16Z but incomplete by 14:11Z — #2005's third red had not appeared yet (the PR was 4
minutes old). That is F1 above, not a fault in that run.

**DISPOSITION: ACTIONED** — `git mv` to `docs/pr-prompts/archive/` in this PR. Archiving is safe for
freshness: `check-breadcrumb.mjs` builds `trackedSet` from `git ls-tree -r` and matches by trailing
path segment, so an archived breadcrumb still counts and cannot make a station read SILENT.

### F5 — The blind run's "clock disagreement" is a TIMEZONE, and both clocks were right

The 14:09Z run filed F-3 on the session header saying `Friday, September 18, 2026` while the VM said
`2026-09-17T14:09:13Z`, and 04's run recorded the same thing as *"the environment header is the
outlier."* **Neither is an outlier.** [MEASURED] this run, one command, both clocks at once: the
Windows host returned **`2026-09-18T01:08:14.9175693+10:00`** — i.e. the session header is the
**host-local (Brisbane, UTC+10)** date, the VM is **UTC**, and `2026-09-18 01:08 +10:00` **is**
`2026-09-17 15:08Z`. They agree exactly; only the frame differs.

This is DOCTRINE §3 RULE 2 — *"Logs are UTC; the machine is Brisbane (UTC+10). Never compare them
raw"* — meeting a new surface, the session header, which that rule does not name. The cost is real
and one-directional: two runs in one hour each filed a defect against a system that was correct, and
the available next step from *"the environment header is the outlier"* is to distrust the harness.

🔧 **Stamp every station report in host UTC, as both runs already did, and read the session header as
host-LOCAL — it is a third clock frame, not a third clock.** ⚠️ **Falsifying probe:**
`Get-Date -Format o` on the host next to `date -u` in the VM; if the offset is ever anything but the
host's own UTC offset, this correction is wrong and must be re-measured.

**DISPOSITION: ACTIONED** — the 14:09Z F-3 and 04's clock note are both answered here, and neither
needs to reach Marco.

### F6 — Three bootstrap escalations, 7–11 days old, one physical act, and the layer has no linter

This is 04's F4 re-surfaced with the denominator corrected, which is the whole of what it dispatched
to me. I am **not** re-filing it as a new escalation — the files exist and are open:

| escalation | filed | severity |
|---|---|---|
| `needs-marco/bootstraps-tell-every-run-to-read-the-working-copy-2026-09-06.md` | 09-06 | S2 |
| `needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` | 09-06 | S3 |
| `needs-marco/bootstrap-preflight-omits-four-preconditions-2026-09-10.md` | 09-10 | S2 |

All three are one act: **edit `C:\Users\Marco\Claude\Scheduled\*\SKILL.md`** — the one layer of five
that `STATION-CAPABILITIES.md` §1 says no agent may touch. [MEASURED] by 04 this morning: every
bootstrap's mtime is `2026-09-01T00:07:44Z`, a single batch, so none of the three has been actioned in
16 days while the station docs they point at moved repeatedly. The cause is structural rather than
neglect — `lint-station.mjs` reads `docs/pipeline/stations`, `DOCTRINE.md` and `.claude/agents` and
**nothing reads the bootstrap layer**, so nothing ever fails and each sweep can only re-file.

**The corrected denominator, stated once so the next re-measure does not read a mismatch as movement:
the live ENABLED count is FOUR, not five.** `weekly-security-audit` went `enabled: false` on or about
2026-09-06. Every row in those escalations reads **0 of 4**, positive control **4 of 4**.

**And this run is itself evidence of the cost.** The 14:09Z occurrence stopped on PREFLIGHT step 1.
It stopped *correctly* — the server genuinely timed out — but the rule that would have stopped it
stopping on a mere validation error lives only in the station doc, which its bootstrap does not reach
until after the stop. I met the adjacent trap live: a `select:` of the bare `mcp__desktop-commander__*`
ids would have returned "no such tool", and only the keyword load found them under the
plugin-prefixed names.

**DISPOSITION: ESCALATED.** Marco — this is three small pastes that have each been open over a week,
and RULE 1 on the options:

1. **One consolidated paste + a generator that makes the next one unnecessary (recommended — passes
   both halves).** Paste all three corrections into the four enabled bootstraps in one sitting, and
   let a station ship `scripts/pipeline/build-bootstrap.mjs` that emits the canonical bootstrap text
   from the station docs, so the next correction is a diff you paste rather than a defect a sweep
   re-discovers. **Complete:** fixes today's three *and* removes the re-rot path. **Additive:** it
   changes no run's data, and you remain the only actor who writes that layer.
2. **The consolidated paste alone.** Solves it immediately; **fails the future half** — the
   bootstraps drift again the next time a station doc is corrected, and all three of these arose
   exactly that way.
3. **Leave them.** Fails both halves, and has a measured cost: a bootstrap that tells a run to stop
   on a validation error manufactures blind runs, and the run that stops never reaches the document
   carrying the cure.

The script half of option 1 is repo-side and inside a station's lane — say the word and it can be
staged as a prompt. The paste itself is yours; no agent may edit that layer.

### F7 — §9.1's nested-`-Command` expansion trap fired twice, live, in this run

Recorded because §9.1's 2026-09-14 correction asks for exactly this control and it is cheap to add a
data point. Both instances were `start_process` shell `powershell.exe` with the command being a
**nested** `powershell.exe -NoProfile -Command "…"` — the form that correction identifies as the one
carrying the expansion layer:

- `Write-Output ('FRESHNESS_EXIT=' + $LASTEXITCODE)` arrived as `... + )` →
  `You must provide a value expression following the '+' operator`.
- A `node -e` one-liner containing `b[0]===0xFF&&b[1]===0xFE` and a regex literal died on
  `The token '&&' is not a valid statement separator` and `Unexpected token 'this\.prisma/.test'`.

Both failed **loudly** as parser errors, which is the benign half of that bullet; neither produced the
dangerous silent-wrong-value shape. The cure held in every case: the same work through
`-File <script.ps1>` ran clean. **This is a measurement of the trap, not of the cure** — the
distinction §9.1's own 2026-09-04 note says stations keep getting backwards.

**DISPOSITION: ACTIONED** — no document change needed; §9.1 already states this correctly and
unconditionally, and this run is a confirming instance rather than a correction. Every `$`-bearing
command in this run went into a `.ps1` run with `-File`.

### F8 — A one-line instrument bug of my own, caught by its own loudness

[MEASURED] a read-back I wrote as
`git rev-list --count ("origin/" + $branch) + "..HEAD"` passed `+` and `"..HEAD"` to git as separate
arguments and died `fatal: ambiguous argument '+'`, printing `COMMITS_AHEAD=` empty. Had it failed
**quietly** it would have read as "zero commits ahead", i.e. "my commit is not there" — §9.6's shape,
on a read-back guarding a push. It did not, because git refused loudly, and the push's own output
(`e27e49d2..6824f3fd`) is the read-back that actually decided.

**DISPOSITION: ACTIONED** — no repo artifact carries it; the working read-back is the push ref-update
line plus `gh pr view --json headRefOid`, both quoted above. Recorded so the next run writing a
PowerShell string-concatenated git argument expects this.

### F9 — COLLECT: Station 05's 14:11Z run (2 findings), which reached main inside this run's own window

[MEASURED] tracked at `docs/pr-prompts/00-05-sot-keeper-2026-09-17-1411-…md` — it rode in **#2007**,
the PR this run merged, which is the contract's preferred home and why it needed no sweeping up.
It is in my window and both its findings are dispositioned here.

- **#2005 carries a third red the label does not explain.** Dispatched to me by name, on the correct
  grounds that diagnosing `apps/api` is outside 05's lane. **DISPOSITION: ACTIONED** — see F1: root
  caused from the job log, fixed, pushed, verified locally with the failure reproduced first.
- **`docs/qa/sot-refs-baseline.json` is at `entries.length = 0`** — deferred by 05 because its own
  safeguard capped that run at `sot/` + `docs/data-model/`. **Independently re-measured here rather
  than inherited:** `entries.length` → **0**, and `node scripts/pipeline/check-sot-refs.mjs` →
  `total=275  dangling=0  exempt=20  baselined=0  excluded=2`, **exit 0**, *"All sot/ references
  resolve. This is the boring, correct outcome."* So the claim is true and the burn-down is genuinely
  complete. **DISPOSITION: DEFERRED**, with the trigger stated: the baseline may only SHRINK and it
  has reached its floor, so nothing is wrong today. It becomes urgent the moment `entries.length`
  goes **above 0**, because that is CI reporting a *new* dangling `sot/` reference against a file
  whose own `_readme` says additions are rejected — at which point the question of what the terminal
  state means stops being cosmetic. Writing that terminal state into `05-sot-keeper.md` is 05's doc
  and 05's lane, not mine.

### F10 — Two LIVE wrong `.gitignore` citations, and they are in `sot/` — 05's lane, not mine

Found while measuring F9's baseline claim, because `check-sot-refs.mjs` prints every exemption reason
and two of them cite line numbers that have rotted by the same **+8** a 09-06 run already recorded for
the bootstraps.

[MEASURED] this run against `.gitignore` (151 lines) in the PR worktree — the five sinks sit at
**115–119**, under the `# Overnight-QA scheduled task` comment at **113**, while **107–111** are the
`Claude Design` allowlist (`!Claude Design/docs/`, `!Claude Design/assets/`, …):

| citation | says | truth |
|---|---|---|
| `sot/04-data-model.md:4530` — `<!-- sot-ref-allow: … .gitignore:107-108 -->` | `qa-checklist.md` / `qa-findings.md` | **115–116** |
| `sot/04-data-model.md:4545` — `<!-- sot-ref-allow: … .gitignore:107 -->` | `qa-checklist.md` | **115** |

**These are the only two live ones in the repo.** The search was scoped away from
`docs/pr-prompts/`, `docs/pr-reviews/` and `docs/housekeeping/` on purpose — §9.6's closing rule, that
a probe pointed at the corpus of *reports about* a trap measures the documentation rather than the
trap. Unscoped, the same query returns **122** hits and essentially all of them are archived
breadcrumbs quoting the citation while correctly calling it wrong. **POSITIVE control**
(`gitignore:28`, a citation known good): `DOCTRINE.md` 2 · `STATION-CAPABILITIES.md` 2 ·
`01-code-writer.md` 1. **NEGATIVE control**, a needle minted this run: **0**.

⚠️ **Two near-misses deliberately NOT counted**, because both would be false positives:
`scripts/pipeline/__tests__/check-breadcrumb.gitignored-sink.test.mjs:60` contains `.gitignore:106`
inside a **test fixture string** — sample prose the test feeds its own detector, not a citation; and
`docs/plans/smart-wizard-catalog-deploy-plan.md:45` cites `.gitignore:116` about a catalog path, which
I did not resolve and am recording as a **lead**, not a finding.

⚠️ **These resolve to real lines and are not currently breaking anything** — which is exactly why they
are worth a line rather than a silent fix. They are live raw line-number citations of the class
DOCTRINE §9.5 says to replace with anchors, sitting in a source-of-truth document, and the surrounding
prose (*"never on main by design"*) is still true, so nothing fails and nothing reminds.

**DISPOSITION: DISPATCHED → Station 05.** `sot/` is 05's lane and **only** 05's; CP-24 hard-blocks any
PR mixing `sot/` with code, and my own limits forbid editing it at all. 05 should replace both with
the anchor form — the `# Overnight-QA scheduled task` comment is the stable landmark — in its next
doc-reconcile PR. I did not edit `sot/` and did not stage a prompt for it, because the fix is one
doc-reconcile edit inside the lane of a station that runs daily and has already been handed this
finding by name.

## WHAT I DID NOT DO

- **Did not merge #2005, #2002 or #1998**, and did not touch a label on any of them. All three carry
  a genuine watcher `marco:true` verdict **and** `do-not-merge`; §10.1 step 1 runs first and wins, and
  only Marco removes the label. Driving #2005 green is the whole of what my lane permits there.
- **Did not arm anything.** 0 armed before, 0 after. There was no gate-cleared `-HOLD` this run whose
  arming would have helped: the board's constraint is a human decision on three PRs, not throughput,
  and arming into that makes the queue longer rather than shorter.
- **Did not clear any `needs-marco/` file.** [MEASURED] zero genuine `[STALE]` rows on either sweep —
  the eleven dead PR-scoped rows my station doc describes are already discharged. Nothing to move, and
  I did not move anything on the strength of a tag alone.
- **Did not restart or touch the watcher.** It read `RUNNING pid 30248`, wrapper alive (2), queue 0
  armed. A stale heartbeat with an empty queue is idle, not wedged, and `restart-watcher-if-wedged.ps1`
  was not run in `-Fix` because no WEDGED/DOWN verdict exists.
- **Did not prune the orphaned worktree** the sweep flagged at `C:/PR-Master/worktrees/po-vg` —
  it **holds 1 uncommitted file** and the sweep says so explicitly. Never deleted unsupervised; this
  is 03's lane and it is already named in the standing clone-hygiene dispatch.
- **Did not diagnose the `watcher clone: branch=main dirty=5` line as a defect.** §9.5 records that
  flag as untracked-inclusive while `start-watcher.ps1` counts tracked only, and that a tracked-dirty
  clone auto-stashes rather than refusing. Not re-dispatched to 03 — that is the measured mis-route.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`**, and did not run `git` through the device
  bridge against the Windows `.git`. All git work happened in two **disposable worktrees**.
- **Did not touch `/sot/`.** Station 05's lane. I merged its PR; I did not edit its files.
- **Did not commit on `main` in the dev tree.** Everything went through a branch and a PR.
- **Nothing Azure / Entra / SharePoint.** Absolute, and nothing this run came near it.
- **Did not wait out CI on #2005.** It was `in_progress` when this report was written; F1 states that
  as `[CANNOT MEASURE]` with the re-read the next occurrence owes rather than predicting green.
