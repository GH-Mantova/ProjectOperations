# Station 00 — Supervisor | 2026-09-23T15:14Z–2026-09-23T15:3xZ

## GROUND

```
UTC            2026-09-23T15:14:31Z
origin/main    8218c53c            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 8218c53c      C:\ProjectOperations2
doc version    1                    (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**. This run acted. `origin/main` advanced to **`9bf5ad92`**
mid-run when this run merged `#2124`; every claim below is stamped with the SHA it was true at.

⚠️ **Clock note, stated because it is not a defect and the next reader will meet it.** The box
reports `2026-09-23T15:14Z` UTC; the session environment header says 2026-09-24. Brisbane is UTC+10,
so the host's LOCAL clock reads 2026-09-24 01:14 — DOCTRINE §3's RULE 2 exactly. **Every timestamp
in this breadcrumb is the box's UTC**, taken from `(Get-Date).ToUniversalTime()`, never from a mount
`stat` and never from the session header.

## WHAT I MEASURED

**Preflight.**

- [MEASURED] **Not blind.** Desktop Commander tool ids were loaded with `ToolSearch` FIRST, then
  `start_process` shell `powershell.exe` answered → PID **39312**, and that same PID carried the
  whole run.
- [MEASURED] **`vm-git-guard.sh` exit code = `2`**, headline verbatim from the installer itself and
  not from a pipeline appended to it:
  `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
  Its own controls, quoted: `bash -lc 'command -v git'` →
  `/sessions/busy-friendly-thompson/.local/bin/git` (the shim); `bash -c 'command -v git'` →
  `/usr/bin/git` (the real git). **This is the EXPECTED station outcome — a FINDING, not a STOP**
  (F5). Consequence honoured for the whole run: **every `git` and `gh` call ran in PowerShell on the
  Windows host; none went through the device bridge against the Windows `.git`.**
- [MEASURED] **The three binding documents are byte-equivalent to `origin/main`**, by the sound form
  (`git diff --numstat origin/main -- <path>`, EMPTY = not different) and never a piped hash (§9.1):
  `docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md`,
  `docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY for all three**, with
  `git rev-list --left-right --count HEAD...origin/main` → `0	0`. The dev tree **is**
  `origin/main`, so reading them from disk is sound this run. **All three were read in full** —
  00-supervisor.md 1593 lines, DOCTRINE.md 2735 lines, STATION-CAPABILITIES.md 572 lines.

**COLLECT — the breadcrumb census and the freshness cross-check.**

- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**.
  `structure: 3 checked, 0 malformed`. Freshness: `00` 0.7h (cadence 1h) ok · `02` dispatch-only ·
  `03` 15.8h (24h) ok · `04` 1.1h (4h) ok · `05` 0.9h (24h) ok. **No station is SILENT.**
- [MEASURED] 🔎 **`--freshness`'s `00` cadence now reads `1`, and the STATION-CAPABILITIES §6 defect
  that recorded it as `2` is DEAD.** `Select-String -Path scripts\pipeline\check-breadcrumb.mjs
  -Pattern 'CADENCE ='` → `const CADENCE = { '00': 1, '02': null, '03': 24, '04': 4, '05': 24 };`.
  That paragraph's own falsifying probe is the `const CADENCE =` line itself, and it fires: `'00'` is
  `1`, matching the live cron `5 * * * *`. A green `ok` for `00` is no longer weaker than for any
  other station. Recorded as F4 so the document can be corrected.
- [MEASURED] **Cross-check against `lastRunAt` (scheduled-tasks MCP), which the breadcrumb clock
  cannot substitute for.** Four tasks `enabled: true`; `weekly-security-audit` `enabled: false`.

  | station | `lastRunAt` | newest breadcrumb | reading |
  |---|---|---|---|
  | `00` `5 * * * *` | 2026-09-23T15:13:57Z | 14:35 (+ this run) | this run; aligned |
  | `03` `0 9 * * *` | 2026-09-22T23:28:57Z | 2026-09-22T23:29 | aligned; `nextRunAt` 2026-09-23T23:02:45Z |
  | `04` `0 */4 * * *` | 2026-09-23T14:09:35Z | 14:10 | aligned |
  | `05` `10 0 * * *` | 2026-09-23T14:22:41Z | 14:23 | aligned |

  **All four are "both fresh and aligned" — the healthy row.** No transcript read was needed, because
  no station read SILENT and none showed the fresh-`lastRunAt`-no-breadcrumb shape.
- [MEASURED] 🔎 **Why `--freshness` could see 05's 14:23 breadcrumb while it was still inside an
  unmerged PR, and it is not an instrument fault.** `git ls-tree -r --name-only origin/main --
  docs/pr-prompts/` returned **1357** paths and the newest tracked `00-05-*` was
  **2026-09-22**-1423, not 09-23 — so the tracked set alone could not have produced the reading.
  `check-breadcrumb.mjs` also reads OPEN PRs, by design and with the reason in its own source
  (anchor: the comment beginning *"`gh pr list --json files` is used rather than `git ls-tree
  <headRef>` ON PURPOSE"*). The 09-23T14:23 breadcrumb was a file in open `#2124`. **The instrument
  was right and the obvious ls-tree cross-check was asking a narrower question.**

**Board and machinery, from `scripts/pipeline/status-sweep.ps1`** (captured with `*>` and decoded
**utf16le** — the capture was 137,730 bytes opening `FF FE`, i.e. the §9.3 redirection trap, avoided;
read as utf8 its `====` section headers match no regex).

- [MEASURED] section 0 instrument controls: `gh CAN reach GitHub (saw merged PR #2123)`, `node runs`.
  **No `[BROKEN]`.**
- [MEASURED] section 7 verdict: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote
  activity, no live station worktrees.` Section 3: `index.lock interactive/clone: False / False`,
  scoped git processes **0**, `no PR touched on GitHub in the last 2 min`.
- [MEASURED] `[LIVE] OPEN PRs: 1` — `#2124 CLEAN`, `CI: 10 pass / 0 fail / 0 pending (green)`.
  `[LIVE] main CI on 8218c53c: 4 success / 0 failed (trunk green)`.
- [MEASURED] `[LIVE] armed (*-ready.md): 0`. needs-marco 45 · no-pr-opened 111 · failed 59 ·
  blocked 150. Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.
- [MEASURED] watcher node **RUNNING pid 9744**, auto-restart wrapper **alive (1)**, heartbeat age
  **31 min**. With `armed = 0` that is **idle-correct, not wedged** — the heartbeat ticks only
  mid-run. `restart-watcher-if-wedged.ps1` was **not** run and **no restart was attempted**: the
  sanctioned verdict is only needed when prompts are armed, and 0 are.
- [MEASURED] **Section 5 produced NO `[STALE]` rows this run.** Every row is either
  `cites #N (MERGED) as evidence -- not its premise` or `names no subject PR … section 5 CANNOT
  decide`. **So there was nothing to discharge into `needs-marco/discharged/` this cycle** — the
  eleven dead escalations that class produced on 2026-09-10 are gone and have not come back.

**The one open PR — lane established BEFORE any merge (§10.1), with both controls.**

- [MEASURED] `gh pr view 2124 -R GH-Mantova/ProjectOperations --json …` (`-R` passed,
  `$LASTEXITCODE` tested — §9.4): `STATE=OPEN MSS=CLEAN DRAFT=False AUTHOR=GH-Mantova
  CREATED=2026-09-23T14:38:16Z`, **`LABELS=` (empty — no `do-not-merge`, no hold)**, `FILECOUNT=3`:
  `sot/02-roadmap-and-status.md`, `sot/04-data-model.md`, and Station 05's own breadcrumb under
  `docs/pr-prompts/`. **`sot/` + `docs/` only — no `scripts/`, no `apps/`, so CP-24 has nothing to
  block and its green is a real reading.**
- [MEASURED] **§10.1 step 1 — the prompt logs alone, `rev-*` excluded:**
  `Select-String -Path 'docs\pr-prompts\processed\pr-*.log' -Pattern 'PR #2124\b'` → **0**.
  POSITIVE control `marco.:true` over the same corpus (written without a quote character, §10.1) →
  **703**. NEGATIVE control, a freshly minted needle `zzQq00Ndl20260923T1520` → **0**.
  ⚠️ That needle is now spent. Corpus freshness, the control that separates the live tree from the
  clone's dead decoy (§9.5): newest `processed/*.log` is `rev-2124-ready.md.log` at
  **2026-09-23T14:44:49Z** — six minutes younger than the PR it is being asked about.
- [INFERRED, and stated as step 4 requires] **`[NO LANE VERDICT — hand-classified]`.** Zero prompt-log
  hits with both controls passing ⇒ **second lane**, i.e. not watcher-opened. Classified under
  **§10.1 step 3** — a **KNOWN STATION LANE**: Station 05 acting inside its recorded authority
  (`STATION-CAPABILITIES.md` §5: *Create a PR — 05: doc-reconcile only*; *Edit `/sot/` — only 05*),
  and the PR names its lane in its own body and breadcrumb. `STATION-CAPABILITIES.md` §5 then
  authorises 00 to merge it: *"00 may merge docs-only and `sot/`-only PRs … via `pipeline-lib`."*
  ⚠️ The 2026-09-22 narrowing was applied, not skipped: *not watcher-routed* is NECESSARY, never
  SUFFICIENT. What makes it sufficient here is that **every** file is inside `docs/` or inside 05's
  gated `sot/` lane — nothing sits outside `tests|docs` and outside a recorded lane, which is the
  exact shape that narrowing exists to refuse.
- [MEASURED] A `rev-2124-ready.md.log` exists. Per §10.3's `REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`,
  a `rev-<N>` review of a **second-lane** PR is **unread by construction** — `verdictApproves` has
  one call site and it is inside `waitForPolicyMerge`, which never ran for this PR. **So its absence
  or presence is not a gate here**, and the missing-verdict diagnosis does not apply.

## WHAT CHANGED

**Three mutations. Each read back.**

**1. `#2124` MERGED — through `pipeline-lib`'s primitives, never a raw `gh pr merge`.**

```
gh pr checks 2124 -R <repo>   (unpiped)    ->  CHECKS_EXIT=0
Assert-SmokedOrEscalate -PR 2124           ->  True True   ASSERT_EXIT=0
Merge-Pr -PR 2124                          ->  True        MERGE_EXIT=0
gh pr view 2124 --json number,state,mergedAt,mergeCommit
 -> {"mergeCommit":{"oid":"9bf5ad92c8a288e90844576761605561bc4e6dc2"},
     "mergedAt":"2026-09-23T15:21:14Z","number":2124,"state":"MERGED"}
```

`gh pr checks` was run **unpiped** on purpose: the piped form's exit code is `Select-String`'s and
not `gh`'s (§7 guard 7). **Read back to `MERGED`, not stopped at "auto-merge enabled".**

**2. The dev tree fast-forwarded to `9bf5ad92`, on the first attempt, with all four read-backs.**

```
git merge --ff-only origin/main  ->  Updating 8218c53c..9bf5ad92  Fast-forward   FF_EXIT=0
git rev-list --left-right --count HEAD...origin/main  ->  0	0
git diff --numstat                                    ->  EMPTY
git diff --cached --name-status                       ->  EMPTY
git status --porcelain --untracked-files=no           ->  EMPTY
```

**All four, not the first alone** — `0 0` passes on a dirty tree and only the fourth catches it. No
restore step was needed: this run's breadcrumb is written **inside its own PR worktree** (report
contract cure 1), so no untracked copy was ever left at a path the next fast-forward must create,
and nothing tracked was left modified. `docs/pipeline/sweep-rotation.json` was already committed by
the 14:33Z run and is clean.

**3. One board PR, built in a disposable worktree off `origin/main`.**
`C:\po-wt\bd-00-20260923-1524`, branch `board/00-collect-20260923-1524`, created at `9bf5ad92`.
It lands this breadcrumb, stages one new prompt, files one new `needs-marco/` escalation, and
archives the three dispositioned breadcrumbs of the previous cycle.

**Nothing was armed, disarmed, renamed, retired or binned.** `armed (*-ready.md)` = **0** before and
after. No label was touched. No `sot/` edit. No watcher restart. No worktree pruned.

## FINDINGS

**The COLLECT this run owes is Station 05's 2026-09-23T14:23Z run** — the only breadcrumb written
since the 14:33Z addendum, and it arrived inside `#2124` rather than in the dev tree. Station 04's
14:10Z run was already collected in full by the 14:33Z addendum (C1–C6) and is not re-dispositioned
here; re-acting on one signal twice is the thing the breadcrumb channel exists to prevent.

### C1 — 05's F1: sot/04's generated section goes stale on every schema change, and a daily station is the only thing repairing it.

05 measured sot/04 one schema change behind — header `FK edges: 497` against a freshly generated
**498**, first divergence at char 16159, the missing edge `estimating --> unclassified` added by
`#2114` (merged 11:53Z). It re-merged the generated section under all seven of its own safeguards
(S2 `deterministic: true`; S3 curated-region sha256 `d5f505615d88a806` unchanged either side;
S4 curated line count 1581 → 1581; S5 scope cap `sot/` only). **This is the third consecutive 05 run
to find and fix the same class**, which is the observation rather than the drift.

**DISPOSITION: ACTIONED** (05's repair is now on `main` — this run merged it and read back
`9bf5ad92`) **and DEFERRED** (the recurrence). 05 dispatched the recurrence to me asking for a CI
check that fails when sot/04's generated section does not match a fresh generation. **It is real and
I am not staging it this run, deliberately:** it is the same shape as C2 below, in the same document
family, and Marco's answer to C2 decides the mechanism for both — a generator that rewrites a marked
region, or a gate that fails the PR. Staging two rival mechanisms before that answer is how this
board grows work it then has to supersede. **What would make it urgent:** an answer to C2, at which
point both become one prompt. Note that sot/04 **already** carries the marked-region machinery
(`<!-- SOT04-GENERATED:BEGIN/END -->`), so if Marco picks the generator form, sot/04 is the cheaper
half and the precedent.

### C2 — 05's F2: sot/02's In-PR table named five MERGED PRs against an empty board. Fifth refresh, and it rots in hours.

Measured by 05, per-PR via `gh pr view <n> --json number,state,mergedAt` and never the `merged`
field of a list response (§9.4): `#2051 #2049 #2047 #2044 #2042` **all MERGED**, board open count
**0**, against a table stamped `2026-09-21T14:25Z`. **Five of five rows wrong, falsified within six
hours of being written.** The previous four refreshes are 09-06, 09-17, 09-21T00:20Z and
09-21T14:25Z; the 09-21 one was wrong fourteen hours later.

05 dispositioned this **ACTIONED + ESCALATED → Marco** and could go no further: both real fixes are
`scripts/` changes and CP-24 hard-blocks a PR mixing `sot/` with `scripts/`, so the station that
finds it daily is structurally unable to stop finding it.

**DISPOSITION: ESCALATED — new file, because the escalation had no home.** [MEASURED] over
`docs/pr-prompts/needs-marco\*.md` (45 files), matched by `Path -Unique` and never `Filename`
(§9.3): the three files mentioning `sot/02` / `In-PR` / `roadmap` are
`agent-authored-rule-2-clearance-2026-09-04.md`, `pr-subbie-rate-cards-scope-pricing-HOLD.md` and
`two-station-00s-on-one-board-…-2026-09-14.md` — **none of them asks this question**. NEGATIVE
control, a freshly minted needle `zzQq00Ndl20260923T1535` → **0**. ⚠️ That needle is now spent.
Filed by this PR as
`docs/pr-prompts/needs-marco/sot02-in-pr-table-is-on-its-fifth-refresh-and-rots-within-hours-2026-09-23.md`.
**The question put to Marco is one line — generated table, or CI gate?** — with RULE 1 applied and
the complete-and-additive option first. *An unasked question cannot be answered*, which is the whole
reason this is a file and not a paragraph.

### C3 — 05's F3: a raw NUL byte in `field.service.ts` hides a 52 KB service from every recursive text search. STAGED.

05 measured exactly one `0x00` byte at offset **50,780** in
`apps/api/src/modules/field/field.service.ts`, inside a template literal used as a composite sort
key. `grep` reports `binary file matches`; `grep -rIL "" apps/api/src --include=*.ts` returns this
file and **only** this file. The file is otherwise clean — 0 `U+FFFD`, 0 CP1252 double-encode
signatures — so this is deliberate code with an undeliberate side effect, not §9.3 encoder damage.
05 dispatched it to me because `apps/api` is outside its lane and CP-24 forbids shipping it beside
`sot/`.

**[MEASURED] I re-verified the central claim rather than quoting 05's artifact** (§7.1's re-read
rule), at `9bf5ad92`: `readFileSync(...).indexOf(0)` → **50780**. Same byte, same offset, one day's
worth of merges later.

**DISPOSITION: ACTIONED — staged as `docs/pr-prompts/pr-field-service-nul-separator-HOLD.md` in this
PR.** `lint-prompt.mjs` → **`ADMIT (size 2)`, exit 0**. The premise is
`! grep -qI "" apps/api/src/modules/field/field.service.ts`, and **its direction was controlled in
both directions through the linter's own shell**, which is the only shell whose behaviour matters
here:

| fixture | linter verdict |
|---|---|
| premise pointed at `field.service.ts` (the NUL file) | **ADMIT** — work still needed |
| the identical prompt pointed at the sibling `docket.service.ts` (ordinary text) | **STALE — "Premise no longer holds … the work is ALREADY DONE"** |

The control fixture was deleted after the reading (`Test-Path` → False) and is not in this PR.
⚠️ **A `bash -c` control I tried FIRST measured nothing and I am recording it rather than hiding
it:** `bash` on this box resolves to **WSL**, which answered
`execvpe(/bin/bash) failed: No such file or directory` and returned exit 1 for **both** the target
and the sibling — identical answers from a spawn failure, i.e. §7's lie #3 (*a failed call read as a
meaningful answer*) in its original costume. Had I stopped there I would have recorded the premise
as inverted. **The linter is the right instrument because it is the one that will actually run the
premise at arm time.**

**I did NOT arm it**, and could not have: arming is a `git mv` of a **tracked** `-HOLD.md`, and this
one is not tracked until this PR merges. It is a clean candidate for the next run's ARM-ONE-AT-A-TIME.
⚠️ It carries **no** human gate and **no** dependency gate by design, so `triage-holds.ps1` will
report it under GATES SATISFIED — that is correct and intended, not a gate that went missing.

### C4 — my own: STATION-CAPABILITIES §6's `CADENCE` defect is DEAD, and that document still says it is live.

`STATION-CAPABILITIES.md` §6 carries a 🔴 paragraph recording that
`scripts/pipeline/check-breadcrumb.mjs` keeps its own `CADENCE` map in which `'00'` reads **2**, so
`--freshness` would not call `00` SILENT until 4 h — *"a green `ok` from `--freshness` is a weaker
statement about `00` than about any other station"*. That paragraph names its own falsifying probe:
**the `const CADENCE =` line itself.**

[MEASURED] at `9bf5ad92`: `const CADENCE = { '00': 1, '02': null, '03': 24, '04': 4, '05': 24 };`
— `'00'` is **1**, matching the live cron `5 * * * *` from the MCP. The probe fires; the defect is
fixed; the document still describes it as open, and explicitly warns the reader not to read the
paragraph as the fix having landed. Confirmed downstream in this run's own output, which printed
`00 … (cadence 1h) ok`.

**DISPOSITION: DEFERRED.** Editing `STATION-CAPABILITIES.md` is an ordinary docs PR and inside 00's
lane, so this is not blocked on anyone — it is deferred only because a binding-document correction
should be exact and land on its own rather than ride a collect PR whose subject is something else.
**What makes it urgent:** nothing today, and it is stale in the SAFE direction (it understates an
instrument that is now sound). **What it costs if left:** a future run wastes a cross-check it has
been told it needs, which is the cheapest failure in this file.

### C5 — 05's F4: sixteen of eighty-one API modules are absent from sot/01's module registry.

05 measured 81 directories under `apps/api/src/modules` and 16 named nowhere in
`sot/01-charter-and-architecture.md`, with both controls (POSITIVE `tendering` present; NEGATIVE, a
fresh needle, absent). Registry completeness is curated prose and a judgement about what belongs in
the charter, which 05 never auto-edits and 00 may not edit at all (`sot/` is 05's lane, CP-24).

**DISPOSITION: DEFERRED.** Real — a registry omitting 20% of the modules is not one a reader can
trust — and not urgent: nothing is broken and no gate depends on it. **What would make it urgent:**
anyone using sot/01 to answer *"does this system have a module for X?"* and acting on a false
negative. ⚠️ That count is STATE; re-measure it, never quote it.

### C6 — 05's F5 and my own: the device-bridge git guard installs INERT (exit 2) on every station shell.

Both 05 and this run measured `GUARD_EXIT=2` with the identical headline, and 04's 14:10Z run makes
three today. The installer writes its `PATH` export into `~/.bashrc` and `~/.profile`; a station's
shell is non-interactive and non-login, so it sources neither. **The ban is therefore REMEMBERED,
not mechanical** — which DOCTRINE §9.2 records as having failed seven times.

**DISPOSITION: DEFERRED.** There is no station-side action: the guard is correct, the shell is the
problem, and the contract itself calls exit 2 the expected outcome and a finding rather than a stop.
Recorded so the occurrence count stays visible. **What would make it urgent:** a run leaving a
0-byte `index.lock` in either tree, which never expires and freezes every station. [MEASURED] this
run: `index.lock interactive/clone: False / False`. It has not happened.

### C7 — 05's F6: the sot-refs baseline is fully burned down.

`docs/qa/sot-refs-baseline.json` `entries.length` = **0**; `check-sot-refs.mjs` exit 0,
`total=275 dangling=0 exempt=20 baselined=0`. Station 05's primary housekeeping obligation has
nothing left in it. **DISPOSITION: ACTIONED** (verified complete by 05, landed by this run's merge;
no work required). Recorded so the next reader knows the list is genuinely at zero rather than
assuming a run skipped it. The baseline may only SHRINK, and it cannot shrink further.

### C8 — the three breadcrumbs of the previous cycle are fully dispositioned and are archived by this PR.

`00-04-scanner-…-1410-…`, `00-00-supervisor-…-1420-…` and `00-00-supervisor-…-1435-…` — every
finding in all three carries a disposition (04's five in the 14:33Z addendum's C1–C6; the two
supervisor breadcrumbs are this station's own). `git mv` to `docs/pr-prompts/archive/` in this PR.
**This is SAFE for freshness and it was re-proved rather than assumed** — `check-breadcrumb.mjs`
builds its tracked set with `git ls-tree -r` and matches by **trailing path segment**, so an
archived breadcrumb still counts; the read-back is in the next section.

**DISPOSITION: ACTIONED.** The queue root is left holding only the CURRENT cycle: 05's 14:23
breadcrumb and this one.

## WHAT I DID NOT DO

- **Did not arm anything.** `armed (*-ready.md)` = 0 before and after. The prompt staged this run
  (C3) is a `-HOLD.md` and is not tracked until this PR merges — arming is a `git mv` of a **tracked**
  file, so it was not available to me and will not be until the next run.
- **Did not restart the watcher, and did not run `restart-watcher-if-wedged.ps1`.** Node RUNNING
  pid 9744, wrapper alive, heartbeat 31 min with **0 armed** — an idle watcher with nothing armed is
  CORRECT, not wedged, and the heartbeat ticks only mid-run. Nothing here is the BUSY/WEDGED
  discrimination that script exists for.
- **Did not run the ENSURE-UP relaunch.** The sweep reports the wrapper alive (1). A `wrapper=0`
  would have been a QUESTION requiring the node's parent chain before any relaunch; it did not
  arise.
- **Did not prune the orphaned worktree `C:/po-wt/s9hex`** (detached at `f878a0a1`, `dirty=0`,
  ~541 min). Worktree hygiene is Station 03's, and it was already DISPATCHED to 03 in the 14:33Z
  addendum's C5 with the ancestry caveat attached. 03's next occurrence is `2026-09-23T23:02:45Z`
  (MCP `nextRunAt`). **Re-dispatching it here would be the same signal acted on twice.**
- **Did not chase the sweep's `watcher clone: branch=main dirty=1 <-- the watcher may refuse to
  start` line.** DOCTRINE §9.5 records that flag as counting UNTRACKED files while
  `start-watcher.ps1` explicitly ignores them, and that a tracked-dirty clone AUTO-STASHES rather
  than refusing — so the sentence's own claim is false in both conjuncts and the measured cost of
  believing it is a mis-routed dispatch to 03. The corruption test is the one that decides, and
  `MERGE_HEAD` / rebase state / unmerged paths are all absent.
- **Did not stage a fix for C1 (sot/04 drift recurrence).** Deliberate, and the reason is in C1: it
  and C2 are one mechanism question, and Marco's answer decides both. Staging a rival mechanism
  first is how this board grows work it then supersedes.
- **Did not edit `STATION-CAPABILITIES.md` for C4.** In my lane and not blocked on anyone; deferred
  so a binding-document correction lands exactly and on its own.
- **Did not edit `needs-marco/fv2-ai-import-digests-…-2026-09-17.md`**, now **6.0 days** old.
  Rewriting a measurement inside a file Marco has already been asked to answer changes the question
  under him. Its age is surfaced in `## FOR MARCO` instead, as it was last run.
- **Did not touch anything under `docs/approvals/`.** Only Marco creates those, and five parked
  prompts wait on that class (a sixth transitively). Repairing one of those gates would silently
  remove the only protection lint is enforcing on a class that includes an irreversible table change
  and a production-data write.
- **Did not touch `/sot/`.** 05's lane, CP-24, absolute for me. This run MERGED 05's `sot/` work; it
  wrote none.
- **Did not clear the two untracked dev-tree paths that are not mine** — `Claude Design/docs/index.html`
  and `docs/pr-reviews/pr-2119-review.md` (the review lane writing into the dev tree, §9.5's
  three-homes behaviour). Neither sits at a path this PR lands, so neither blocks the next
  fast-forward, and `git clean` is on the forbidden list.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard reported
  itself INERT (exit 2), so the ban was remembered rather than mechanical — and it was honoured:
  every `git` and `gh` call in this run ran in PowerShell on the Windows host.
- **Did not touch Azure, Entra or SharePoint.** Absolute. `pr-scopecards-s8b-azure-maps-travel-HOLD.md`
  is gate-released and stays parked; *"gate satisfied, only a marker left"* is **not** an arming
  candidate on that prompt and no agent may take a step toward it.
- **Did not merge by hand.** `Assert-SmokedOrEscalate` → `Merge-Pr`, with the read-back quoted.

## FOR MARCO

**The board is empty, the trunk is green and the watcher is healthy. Everything that is blocked is
blocked on you, and there are now four questions. Nothing else is in the way.**

1. **`docs/approvals/` has issued nothing in 21 days, and 5 of 14 parked prompts wait on it** — a
   6th waits transitively. `needs-marco/five-holds-wait-on-an-approval-channel-that-has-issued-nothing-in-21-days-2026-09-23.md`.
   The question is *do you still want these five*, not *please approve them*; two are irreversible
   and stay yours to run whatever you decide. **Answering this clears the most board — 36% of it.**
2. **The fv2 cluster question is 6.0 days old** —
   `needs-marco/fv2-ai-import-digests-output-channels-cluster-still-wanted-2026-09-17.md`. Two
   prompts are parked behind a producer that no longer exists on the board; five consecutive 04
   sweeps have now re-found the same dead gate.
3. **Station 06 has been silent 7.4 days** —
   `needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`. 06 stages new
   supply, and the one backlog item whose blocker is gone (`rates-11c-blocked-consumers`) needs it.
   **This is still the only one of the four that changes the rate at which the board refills.**
   Option (a) — give 06 a cron on a minute away from `:05` and `:00` — is complete-and-additive and
   damages nothing: 06's authority is *stage `-HOLD` only*, and a `-HOLD.md` appearing on disk
   starts no work.
4. **NEW this run: should sot/02 §2 become generated, or should a CI check fail a PR whose sot/02
   names a PR that is no longer open?** —
   `needs-marco/sot02-in-pr-table-is-on-its-fifth-refresh-and-rots-within-hours-2026-09-23.md`.
   One line to answer, and it also decides C1 (sot/04's drift recurrence), so the two become one
   prompt the moment you pick a form. Five refreshes have proved refreshing does not work; the last
   one was falsified fourteen hours later.

**Nothing is stuck on an agent.** One PR opened and merged this run (`#2124`, Station 05's
reconcile), one prompt staged and ready to arm next hour, and no gate, process or tree needs
repair.
