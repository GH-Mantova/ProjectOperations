# Station 00 — Supervisor | 2026-09-17T07:08:26Z–2026-09-17T07:4xZ

## GROUND

```
UTC            2026-09-17T07:08:26Z   (lastRunAt, scheduled-tasks MCP)
origin/main    d1b9e631               (git fetch origin +refs/heads/main:... then rev-parse, dev tree)
dev tree       main @ 1d080a55        C:\ProjectOperations2
doc version    1                      (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                      (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap **AGREE**. This run was **SIGHTED** — Desktop Commander answered on the
first `start_process` after a single `ToolSearch` load, and the shell carried the whole run.

**Binding-document freshness was PROVED, not assumed.** The three documents were read from the
working copy, and the working copy was then shown identical to `origin/main` with the sound form
(`git diff --numstat origin/main -- <path>`, EMPTY = not different; never a piped hash — §9.1):

```
SAME  docs/pipeline/stations/00-supervisor.md
SAME  docs/pipeline/DOCTRINE.md
SAME  docs/pipeline/STATION-CAPABILITIES.md
```

---

## WHAT I MEASURED

**Device-bridge git guard** — installed first, before any VM-side call. Last line quoted verbatim,
as the contract requires: [MEASURED]

```
$ bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"
ensure_on_path: appended PATH export to: ~/.bashrc ~/.profile
vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd,
  allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS (exit 0). ⚠️ **That PASS is known to be misleading** — Station 05 (2026-09-16T14:11Z F1) and
Station 04 (2026-09-17T06:11Z F2) both measured that the shim is not on `PATH` in the
non-interactive sandbox shell. This run did not rely on it: every `git` command below ran through
**PowerShell on the Windows host**, never through the bridge.

**`status-sweep.ps1`** — run to a file and decoded `utf16le` (§9.3: `*>` writes UTF-16LE).
146,638 bytes, 427 lines, `MARKER_SWEEP_DONE exit=0`. [MEASURED]

```
[LIVE] OPEN PRs: 0
[LIVE] main CI on d1b9e631: 3 success / 0 failed / 1 running  (not yet green)
[LIVE] watcher node: RUNNING pid 30248 ; wrapper alive (2) ; heartbeat age 0 min
[LIVE] BUILD IN FLIGHT: pr-scopecards-s2b-c-destination-money-ready.md  (tick 0.1 min old)
[LIVE] armed (*-ready.md): 1        needs-marco/: 60   no-pr-opened/: 109   failed/: 52
[LIVE] 7. VERDICT — SAFE TO ACT: no board mutation in progress, no recent remote activity
```

**The sweep's `watcher clone: branch=main dirty=1` warning is the known false one, re-measured.**
[MEASURED] `git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` →
**EMPTY**. That is the DOCTRINE §9.5 bullet doing its job; no dispatch, no clone hygiene work.

**`[STALE]` rows in the sweep — the §9.6 discipline applied to the sweep's own text.** A bare
`[STALE]` search over the capture returns **7**, of which **4 are the sweep's own HOW-TO-READ
legend and a quoted `[FILE]` line** — the probe measuring the documentation. Only **3** are section-5
escalation rows: `pr-1967-review-block.md`, `pr-1979-review-fix.md`, `pr-1982-review-block.md`.
[MEASURED]

**Each of those three re-asked INDIVIDUALLY** (never from a list response — §9.4's `merged`-field
bullet), with a negative control: [MEASURED]

```
gh pr view 1967 -R GH-Mantova/ProjectOperations --json state,mergedAt,title
  #1967  MERGED  2026-09-16T03:03:40Z   scopecards S1 - operational costs become money
  #1979  MERGED  2026-09-16T04:24:15Z   rates S3 - add columns and rows in the grid
  #1982  MERGED  2026-09-16T06:17:26Z   escalate to 06 - a HOLD was resolved to another station's PR
NEGATIVE CONTROL  gh pr view 999997 -> exit 1, "Could not resolve to a PullRequest"
```

**`check-breadcrumb.mjs --freshness`** — exit 1. [MEASURED]

```
structure: 25 checked, 1 malformed, 0 skipped as pre-contract
  00  last 2026-09-15T06:40:00Z  48.6h ago  (cadence 2h)  SILENT
  03  last 2026-09-16T23:02:00Z   8.2h ago  (cadence 24h) ok
  04  last 2026-09-17T06:11:00Z   1.0h ago  (cadence 4h)  ok
  05  last 2026-09-16T14:11:00Z  17.0h ago  (cadence 24h) ok
```

⚠️ The `00` row's cadence reads `2h`; the live cron is `5 * * * *` — **hourly**. That is the known
`const CADENCE =` defect in `check-breadcrumb.mjs` (STATION-CAPABILITIES §6), unfixed. It makes the
`00` SILENT threshold 4 h instead of 2 h, i.e. weak in exactly the direction that hides a missed run.

**`list_scheduled_tasks` (the MCP, per the red rule — never this file's table).** [MEASURED]

```
00-supervisor         5 * * * *     enabled TRUE   lastRunAt 2026-09-17T07:08:26Z   <- this run
03-machine-minder     0 9 * * *     enabled TRUE   lastRunAt 2026-09-16T23:01:15Z
04-scanner            0 */4 * * *   enabled TRUE   lastRunAt 2026-09-17T06:10:05Z
05-sot-keeper         10 0 * * *    enabled TRUE   lastRunAt 2026-09-16T14:11:02Z
weekly-security-audit 30 7 * * 1    enabled FALSE  lastRunAt 2026-09-06T21:32:44Z
```

**Crossed against the breadcrumb table: `00` is `lastRunAt` fresh with no breadcrumb for 48.6 h.**
Per the station doc's three-row table that is *"it started and died, or ran and did not report"* —
but the third instrument settles it differently here, and it was already measured by another
station: Station 04's 2026-09-16T06:10Z run recorded `00-supervisor` as **`enabled: false`**. The
task was OFF, and is ON now. **The occurrences never fired; nothing died mid-run.** [MEASURED for
the enabled flag now; [INFERRED] from 04's breadcrumb for the window, and consistent with 03's
2026-09-16T23:02Z F2 independently measuring "disabled for 42 hours".]

**Dev-tree working state, measured against `origin/main` rather than against HEAD** (§9.2: on a tree
that is behind, `git status` answers about HEAD, not about `main`): [MEASURED]

```
SAME_AS_MAIN  docs/data-model/metadata-catalog.json        <- a smudge, not work. Left alone.
DIFFERS       docs/pipeline/sweep-rotation.json      2  2  <- 04's rotation advance, handed to 00
DIFFERS       docs/pr-prompts/.arming-log.txt        5  0  <- INSERTIONS ONLY = strict superset
DIFFERS       pr-crmvis-register-residual-HOLD.md    0 129 <- consumed prompt
DIFFERS       pr-scopecards-s2b-a-...-HOLD.md        0 189 <- consumed prompt
DIFFERS       pr-scopecards-s2b-b-...-HOLD.md        0 169 <- consumed prompt
DIFFERS       pr-scopecards-s2b-c-...-HOLD.md        0 188 <- consumed prompt
```

The `5 0` shape on the arming log is the discriminator §9.5 names: the working copy is a strict
superset of `main`, so it carries five arms that exist nowhere else. All five name
`actor=station-00.interactive-0003  by=Marco@LAPTOP-E6NHU4E4` — Marco hand-driving.

**15 untracked `00-*` breadcrumbs in the queue root.** [MEASURED] via
`git ls-files --others --exclude-standard -- docs/pr-prompts`, not `git status` (§9.2: status is
structurally blind to gitignored files and this directory carries ignore rules).

**Safe-to-act re-measured immediately before mutating** (§7: `[LIVE]` expires when it prints):
`index.lock` dev **False**, clone **False**, `git.exe` processes **0**. [MEASURED]

---

## WHAT CHANGED

**1. Three dead escalations discharged.** `pr-1967-review-block.md`, `pr-1979-review-fix.md` and
`pr-1982-review-block.md` were each **read in full** before moving; all three are strictly scoped to
their own PR (a re-fire instruction, a hex-ratchet fix instruction, a breadcrumb-contract rewrite
instruction) and nothing general survives the merge. `Move-Item` to
`docs/pr-prompts/needs-marco/discharged/`, **never deleted**, with
`_DISCHARGE-NOTE-2026-09-17-0730.md` beside them recording the three PR states and the negative
control. Read back: `needs-marco/` **60 → 57**, and a `pr-19*-review*.md` search there returns
nothing. ⚠️ That folder is gitignored, which is why the discharge is stated here.

**2. One board PR opened**, from an isolated worktree off `origin/main` (`C:\po-wt\sup-0917`,
branch `sup-0917-collect-48h`), carrying:

- **14 stranded breadcrumbs** — every untracked `00-*` in the queue root except one (see F2).
- **`docs/pipeline/sweep-rotation.json`** — Station 04's advance, which 04 may not commit itself.
- **`docs/pr-prompts/.arming-log.txt`** — the five unpublished arms. Landed as a whole-file copy of
  the dev tree's strict superset, so no line is lost; the save→restore→reapply dance §9.5 prescribes
  is unnecessary when the delta is insertions-only and nothing is being restored to HEAD.
- **4 consumed `-HOLD.md` deletions** — the twins the arms renamed away, still tracked on `main`.

**3. This breadcrumb was written INSIDE the PR worktree**, not the dev tree — cure 1 of the
post-merge fast-forward rule. No loose copy exists in `C:\ProjectOperations2`, so this run cannot
create the untracked-file FF blocker that has cost four previous runs.

**Nothing else.** No arm. No merge of anything the watcher routed. No label touched. No `/sot/`
edit. No `git` against the watcher clone. No prompt file renamed, binned or staged.

---

## FINDINGS

### F1 — Station 00 was switched OFF for 48.6 hours, so the only channel that closes a finding was closed; 15 breadcrumbs from four stations went nowhere

[MEASURED] `--freshness`: `00 last 2026-09-15T06:40:00Z 48.6h ago SILENT`. [MEASURED] the task is
`enabled: true` now, `lastRunAt` = this run. [INFERRED, from 04's 09-16T06:10Z F1 and 03's
09-16T23:02Z F2] it was `enabled: false` across that window — so the occurrences never fired.

The cost is not the silence, it is the **backlog of undispositioned findings**: 15 breadcrumbs,
roughly fifty findings, four stations, none of them closed by anybody. Four separate breadcrumbs
(04 at 09-16T06:10Z, 10:11Z, 18:10Z; 03 at 09-16T23:02Z) each independently re-derived *"the collect
channel is open-loop"* from first principles, because none of them could read the others.

**Two things are true at once and only one is fixed.** The task is back on — that half is done,
by Marco, not by me. The other half is that **nothing detected the outage from inside the
pipeline**: `--freshness` alone would not have called `00` SILENT until 4 h (the `CADENCE` map still
reads `'00': 2` against a live hourly cron), and the `needs-marco/` file whose title names this
outage opens with a banner declaring it REFUTED (04, 09-16T18:10Z F1).

**DISPOSITION: ACTIONED, in the only part that is mine.** The backlog is collected and every
finding below or in section COLLECT-LEDGER carries a disposition; the 14 stranded breadcrumbs are in
the PR this run opened, so they are readable by every later station instead of by nobody. The
detector defect itself is **DEFERRED to F3** — it is a `scripts/` change I may open but not merge.

### F2 — `check-breadcrumb.mjs` locates its sections with `indexOf`, so a report that QUOTES its own headings as evidence collapses its own FINDINGS body to eighteen characters and is REJECTed

This is a new §9-class instrument defect, measured this run, and it is live on `main`.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs <file>` on
`00-04-scanner-2026-09-17-0611-the-host-fetched-a-merge-34-seconds-before-desktop-commander-timed-out-on-me.md`
→ **REJECT**, *"FINDINGS section carries no disposition"*, exit 1. The file carries **two** literal
`DISPOSITION: ESCALATED` lines inside its findings section. Both readings are true at once.

**Mechanism, read from the source** (anchors `const SECTIONS =` and the `text.indexOf(s)` /
`text.indexOf('## FINDINGS')` call sites): the validator finds each section by `indexOf` of its
heading string anywhere in the file, and bounds the findings body by the *first* occurrence of the
next section heading. That scanner report contains, inside its measurement section, a quoted shell
transcript listing all five heading strings **on one line**, in contract order, as the evidence that
its own structure was sound. `indexOf` therefore resolves the findings heading and the following
heading to two offsets **eighteen characters apart, on that quoted line** — so the body the
validator inspects is the fragment between them, which contains no disposition and is too long for
the `nothing` escape hatch.

[MEASURED] The same file passed when 04 ran the validator on it mid-run: 04's own transcript records
`structure: 25 checked, 0 malformed … CLEAN, exit=0`. The quoted-headings line was added
**afterwards**, in the same section, as proof the final text was well-formed. **The evidence of
structural soundness is what broke the structure check.**

🔴 **Why this is worse than one rejected file.** `check-breadcrumb.mjs` runs in CI under the
`pipeline-tests` job over the tracked set, so committing that breadcrumb reddens `main`'s gate for
every PR after it. And the class is not rare going forward: every station doc now tells its author
to prove the five sections are present and in order, and the cheapest proof is to quote them. This
is DOCTRINE §9.6's closing rule — *a probe pointed at a document that describes the broken query
measures the documentation* — reaching the one validator the report contract calls its own.

🔧 **The complete-and-additive fix is one regex per lookup**: anchor the section search to the start
of a line (`/^## FINDINGS$/m` and friends, `text.match(...).index`) instead of `indexOf` on a bare
string. It cannot mis-bound a body, it changes no verdict on any well-formed report, and it costs
nothing. The alternative — telling stations not to quote their own headings — fails the "future"
half of RULE 1: it is a convention with no gate behind it, and the next author will not know.

**DISPOSITION: DEFERRED, with the cure named and the corpus protected in the meantime.** The fix is
`scripts/pipeline/check-breadcrumb.mjs`, which `classifyPolicyFiles` routes outside `tests|docs`, so
it is not mine to merge and folding it into this docs-only board PR would make the whole PR Marco's
and strand the 48-hour backlog behind a human. **The one affected file was therefore held back from
this PR** — it is the current cycle, it stays untracked in the queue root, it reaches the next run,
and it cannot redden CI while it is untracked. What would make this urgent: a second breadcrumb
hitting the same shape, or any attempt to commit that one as-is.

### F3 — `check-breadcrumb.mjs`'s `CADENCE` map still says `'00': 2` against a live hourly cron, and this run is the missed-run case it is too weak to catch

[MEASURED] `--freshness` printed `00 … (cadence 2h)` while the MCP returned `5 * * * *`. So `00` is
not called SILENT until **4 h**, i.e. after three consecutive missed hourly runs. STATION-CAPABILITIES
§6 already records this defect and names the fix as one character; it has not landed, and this run
is the first time the gap was load-bearing — a 48-hour outage that the detector would have reported
at a quarter of its true severity had `lastRunAt` not been crossed against it.

**DISPOSITION: DEFERRED.** Same lane problem as F2 — a `scripts/` change, filed for Marco in
`needs-marco/` already, and correctly handled today by the cross-check the COLLECT step mandates.
What would make it urgent: any run that reports `00 … ok` while `lastRunAt` shows a missed occurrence.

### F4 — Five arms and four consumed prompts existed only on this machine's disk; that is now landed

[MEASURED] `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → `5 0`. The five
rows are `pr-scopecards-s2b-quote-destination-ui`, `pr-crmvis-register-residual`,
`pr-scopecards-s2b-a-destination-control-items`, `pr-scopecards-s2b-b-destination-sections` and
`pr-scopecards-s2b-c-destination-money`, all `actor=station-00.interactive-0003`,
`by=Marco@LAPTOP-E6NHU4E4`. Four `-HOLD.md` twins are still tracked on `main` with the local copies
gone — the `0 N` deletions-only shape.

This is **exactly** the hand-over Station 03 addressed to 00 in its 2026-09-15T23:03Z F4
(*"Committing the arming log and the consumed-prompt deletions"*), and the same condition Station 00
itself recorded on 09-15 at 02:09Z and 03:08Z without being able to close it.

**DISPOSITION: ACTIONED.** Both are in this run's board PR. Read-back is the PR's own staged list:
`M docs/pr-prompts/.arming-log.txt` plus four `D` rows. Verified insertions-only before copying, so
no arm row is overwritten — the failure mode §9.5 records for `git show HEAD:` on an append-only log.

### F5 — Three `needs-marco/` escalations were dead and had been re-printed as `[STALE]` on every sweep

[MEASURED] above: all three PRs MERGED on 2026-09-16, negative control exits 1, all three files read
in full and scoped to their own PR alone. **DISPOSITION: ACTIONED** — moved to
`needs-marco/discharged/` with a note; `needs-marco/` 60 → 57; falsifying probe is the next sweep's
section 5, which must no longer name them.

### F6 — The board is EMPTY and the machine is healthy; that is a real quiet, not a blind one

[MEASURED] 0 open PRs, watcher RUNNING pid 30248 with a 0-minute heartbeat and a live wrapper, one
armed prompt with a build in flight on it, `main` CI 3 success / 0 failed / 1 running. There is no
DIRTY PR because there is no PR; Q1's *"N PRs are dirty therefore the board cannot move"* has no
subject today. The throughput constraint the archive records — *"every PR outside tests/ or docs/
stops for Marco"* — is not binding right now either, because Marco has been hand-driving and the
board drained.

**DISPOSITION: ACTIONED** (stated, nothing to fix). The one thing worth saying plainly: **the board
being empty is why nothing broke while 00 was off.** Had the queue been full, 48 hours of no
supervisor would have shown as a stalled board rather than as stranded paperwork.

---

## COLLECT-LEDGER — the 48-hour backlog, dispositioned

Every finding in the 15 breadcrumbs written since 2026-09-15T06:40Z. Findings already owned and
carried by an open `needs-marco/` file are dispositioned **DEFERRED — tracked in needs-marco/**
rather than re-filed; re-filing them is how this pipeline manufactures duplicate escalations.

| Source breadcrumb | Findings | Disposition |
|---|---|---|
| 03 · 09-15 23:03 | F1 logoff killed the watcher 8h50m; F2 orphan worktree holds uncommitted file; F3 sweep clone-dirty false; F4 arms exist only on disk | F4 **ACTIONED** (F4 above). F1 **DEFERRED — tracked in needs-marco/** (`watcher-keepalive-is-gated-on-an-interactive-logon`). F2 **DEFERRED** — the `po-vg` file is an earlier draft of work already on main, per 03's own 09-16 F4; not urgent until someone prunes. F3 **ACTIONED** — re-measured EMPTY this run, no dispatch |
| 03 · 09-16 23:02 | F1 two watchdogs hold kill authority over one node; F2 00 disabled 42 h; F3 the escalation naming the outage is banner-REFUTED; F4 `po-vg` holds an earlier draft | F2 **ACTIONED** (F1 above). F1 **DISPATCHED → Station 03** — it owns the watcher lifecycle and the duplicate-watchdog measurement is its own; 00 does not repair machines. F3 **DEFERRED** — the banner is wrong, correcting it is an edit to a gitignored file, so it buys nothing until the escalation itself moves. F4 **ACTIONED** — retires 03's own 09-15 F2 |
| 04 · 09-15 10:10 | F1 file gate outlived a retired prompt; F2/F3 spent HOLDs still tracked; F4 duplicate flags all false; F5 marker test unexecutable; F6 mount down | F2/F3 **ACTIONED** — four consumed HOLDs deleted in this run's PR. F4, F5 **DEFERRED** — §10.6's premise-at-head fallback already covers the unexecutable case. F1, F6 **DEFERRED** |
| 04 · 09-15 22:22 | F1 bootstraps cite the wrong `.gitignore` lines (day 10); F2 clone-dirty has a permanent producer; F3 §9.5 says 1824 lines, file is 2444 | F1 **DEFERRED — tracked in needs-marco/** (`gitignore-citations-in-the-five-bootstraps`), and it is Marco's layer: an agent cannot edit a bootstrap. F2 **ACTIONED** as F3 of 03 above. F3 **DEFERRED** |
| 04 · 09-16 02:19 | F1 sweep PRESERVE warning is content-blind; F2 `pr1823` is a pure orphan; F3 stash loop at 77; F4 remote-branch hygiene; F5 stranded logs; F6 false duplicate | F2 **DISPATCHED → Station 03** — worktree pruning is machine work; the sweep still lists `pr1823` clean, merged, head branch gone. F1 **DEFERRED** — a `scripts/` change, same lane bar as F2 above. F3, F4, F5 **DEFERRED** (04's own reading). F6 **ACTIONED** by 04 |
| 04 · 09-16 06:10 | F1 00 disabled, 8 breadcrumbs stranded; F2 bootstraps cite `.gitignore:107-111`, truth is `115-119`; F3 `lint-station.mjs` never opens a bootstrap; F4 §9.5 anchor prediction false on `03`; F5 06's breadcrumb malformed | F1 **ACTIONED** (F1 above). F2 **DEFERRED — tracked in needs-marco/**, Marco's layer. F3 **DEFERRED** — the same `scripts/` bar, and it is the cause of F2 rather than a separate defect. F4 **DEFERRED**. F5 **ACTIONED** — 06's breadcrumb now ADMITs |
| 04 · 09-16 10:11 | F1 watcher reset destroys 04's uncommitted rotation advance; F2 00 disabled ~29 h; F3 blind run | **F1 ACTIONED in part** — the pending advance is committed in this run's PR, so this cycle's is no longer at risk; the mechanism (a reset that overwrites it) is **DEFERRED** and is a `scripts/` fix. F2 **ACTIONED** (F1 above). F3 **DEFERRED — tracked in needs-marco/** (the Desktop Commander outage) |
| 04 · 09-16 14:10 | F1 two consecutive blind runs; F2 dev tree unfetched 4h23m; F3 `sweep-rotation.json` mtime newer than its own content | F1 **DEFERRED — tracked in needs-marco/**. F2 **ACTIONED** — refuted by 04's own 09-16 22:11 F3 and by this run: the dev tree fetched within 34 s of #1990 merging. F3 **ACTIONED** — the artifact is committed this run |
| 04 · 09-16 18:10 | F1 the outage escalation is annotated REFUTED; F2 seven SPENT HOLDs never reported; F3 duplicate flag settled; F4 clone-dirty class wider than documented; F5 worktree escapees uncovered | F2 **ACTIONED in part** — four consumed HOLDs deleted this run; any remainder is re-measured next cycle rather than trusted from this list. F1 **DEFERRED** (as 03's F3). F3 **ACTIONED** by 04. F4 **ACTIONED** as F3 of 03. F5 **DISPATCHED → Station 03** with the `pr1823` prune |
| 04 · 09-16 22:11 | F1 third blind slot in four; F2 the step-1 STOP treats two surfaces as one; F3 the 14:10 findings cleared; F4 `ls --time-style` renders local time; F5 REFUTED: the validator does run blind | F1 **DEFERRED — tracked in needs-marco/**. F2 **ESCALATED** — 04 dispatched it to me and I agree it is Marco's: it asks for a change to the station contract's STOP clause, which is a canonical block shipped across seven docs. F3 **ACTIONED** — closed above. F4 **DEFERRED** — a genuine §9 candidate; a DOCTRINE edit is a canonical-block re-record, more than a collect run should carry. F5 **ACTIONED** — recorded here as the annotation 04 asked for |
| 04 · 09-17 02:21 | F1 §7 guard 8 names the wrong trigger for the `gh -q` trap; F2 inline `node -e` loses `\uXXXX` escapes; F3 nine traps still live | F1, F2 **DEFERRED** — both are DOCTRINE §9 edits inside hash-gated canonical blocks; correct, worth landing, and a canonical-block re-record is its own PR. F3 **ACTIONED** (no action asked) |
| 04 · 09-17 06:11 | F1 host alive 34 s before Desktop Commander timed out; F2 the contract mandates a script that drives `git` through the bridge | F1 **DEFERRED — tracked in needs-marco/**, with 04's host-is-alive discriminator attached; it retires option 2 of that escalation. F2 **ESCALATED** — two binding documents conflict and the fix touches the guard's design; Marco's. ⚠️ This breadcrumb is **not in this PR** — see F2 above |
| 05 · 09-15 22:22 | F1 sot/02 snapshot rotted inside 30 min; F2 heartbeat alarmed on a station that had reported; F3 `schema.prisma` has 86 double-encoded sequences since 08-12; F4 05 missed its 09-15 14:10 occurrence | F3 **ESCALATED** — `schema.prisma` is on 05's never-auto-fix list and a re-encode of the Prisma schema is not something an agent lands unattended. F2, F4 **ACTIONED** — both are evidence for the cadence defect, closed as F3 above. F1 **DEFERRED** — 05 owns `sot/` |
| 05 · 09-16 14:11 | F1 the VM git guard passes and does not intercept, and left the lock it exists to prevent; F2 sot/04 drifted at both levels; F3 sot/02 snapshot rotted again; F4 half the breadcrumb corpus untracked; F5 sot-refs burn-down empty | F1 **ESCALATED** — same subject as 04's 09-17 F2, and the two together are the whole case; do not count them twice. F4 **ACTIONED** — 14 of the 15 are in this run's PR. F2, F3, F5 **DEFERRED** — 05's own lane |
| 06 · 09-16 04:56 | F1 `requires_on_main` resolves against a stale local `main`; F2 a HOLD-ending run was binned as spent against another station's PR; F3 the queue invariant was violated silently | All three **DISPATCHED → Station 06** — 06 escalated them to itself and it owns prompt staging. 00 notes only that the consequence is bounded: the board is empty and no duplicate PR resulted |

---

## WHAT I DID NOT DO

- **Did not arm anything.** One prompt is armed and the watcher is mid-build on it; a second arm
  while a build is in flight is the collision the ARM-ONE-AT-A-TIME rule exists to stop.
- **Did not merge anything the watcher routed**, and did not remove a `do-not-merge` label. There
  was nothing to merge: the board is empty.
- **Did not fix `check-breadcrumb.mjs`** (F2) or the `CADENCE` map (F3). Both are `scripts/`
  changes; opening them here would route this docs-only PR to Marco and strand the backlog behind a
  human decision. Named with their cures instead.
- **Did not commit `docs/data-model/metadata-catalog.json`.** `git diff --numstat origin/main`
  returns EMPTY for it — the ` M` is a line-ending smudge against a behind-HEAD, not work (§9.2).
- **Did not prune the three orphaned worktrees**, including the two Station 04 dispatched. That is
  Station 03's lane, and one of them holds an uncommitted file.
- **Did not touch `/sot/`, the watcher clone's git, Azure, Entra or SharePoint.**
- **Did not run `restart-watcher-if-wedged.ps1 -Fix`.** The verdict was not WEDGED or DOWN: node
  running, wrapper alive, heartbeat 0 minutes, build in flight. Restarting that is the 2026-07-13
  incident.
- **Did not archive any breadcrumb into `archive/`.** Everything dispositioned above is being
  committed for the first time in the same PR; archiving on the same commit would hide the collect
  evidence at the moment it becomes readable. The next cycle archives them.
