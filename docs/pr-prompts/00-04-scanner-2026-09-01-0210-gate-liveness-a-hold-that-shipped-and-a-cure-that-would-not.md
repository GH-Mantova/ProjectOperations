# Station 04 — Scanner | 2026-09-01T02:10:33Z–2026-09-01T02:21Z

> ⚠️ **A second actor armed a prompt at 02:13:47Z and merged `#1464` at 02:17:48Z, inside this run.**
> Board counts below are stamped at the minute they were taken. See F6.

## GROUND

```
UTC            2026-09-01T02:10:46Z
origin/main    850a649c   (git fetch origin, then git rev-parse origin/main)
dev tree       main @ 850a649c   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1   (station_doc_version: 1 in the scheduled-task file)
```

Doc version and bootstrap **agree**. Run was SIGHTED — `start_process` shell `powershell.exe`
returned `2026-09-01T12:10:33.8119347+10:00` on the first call. This was not a blind run.

Dev tree HEAD **equals** `origin/main` — the FF that Station 00's 22:11Z breadcrumb dispatched has
happened. Only `docs/pipeline/sweep-rotation.json` differs from main under `docs/pipeline/` and
`scripts/pipeline/`, so reading the working copy of DOCTRINE, STATION-CAPABILITIES and this
station's doc is byte-equivalent to reading `origin/main`. `git diff --cached --name-status` is
**empty** — nothing staged by a concurrent chat.

**Sweep this run: `gate-liveness`** (`node scripts/pipeline/next-sweep.mjs` → rotation position 1
of 4). Advanced to `last_index=0`, `last_run_utc=2026-09-01T02:10:46Z` after the sweep.

## WHAT I MEASURED

**Instrument controls, run before any negative conclusion (DOCTRINE §7):**

- [MEASURED] `triage-holds.ps1` self-controls: `GIT control: PASS` (read
  `origin/main:docs/pipeline/DOCTRINE.md`, 46137 chars) and `SPENT control: PASS` (lint emitted
  exit 3 on the fixture). So the SPENT bucket was measurable, and `spent=0` is a real zero.
- [MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` → 596 paths; positive
  control `-- CLAUDE.md` → `CLAUDE.md`. Not a blind query.
- [MEASURED] file-gate probe controls: `fileOnMain(CLAUDE.md)=true`, `fileOnMain(zz/nope.md)=false`;
  needle controls `needle(CLAUDE.md,'ProjectOperations')=HIT`,
  `needle(CLAUDE.md,'zzzNoSuchTokenZzz')=MISS`.
- [MEASURED] repo-wide grep controls at `850a649c`: `RateResolverService` → 31 files,
  `zzzNoSuchTokenZzz` → 0.
- [MEASURED] **DOCTRINE §9.1 reproduced first-hand.** A `-Command "... foreach ($d in @(...)) ..."`
  call came back `Missing variable name after foreach` with every `$` gone from the echoed line.
  Re-issued from a `.ps1` via `-File` and it ran. §9.1 is still trapped.

**Board state [LIVE], `status-sweep.ps1` 2026-09-01T02:11:05Z:** OPEN PRs **1** (`#1464`, BLOCKED,
12 pass / 0 fail / 1 pending). Armed `*-ready.md` **0**. HOLDs at depth 1 **56** on disk. Watcher
node RUNNING pid 32916, wrapper alive, clone `dirty=1`. Verdict **SAFE TO ACT**. Escapees 9.

**The gate-liveness sweep, in full.** 58 `-HOLD`/`-ready` tracked at depth 1 on `origin/main`;
**35 carry at least one `requires_*` gate**. Every gate evaluated against `850a649c`:

- [MEASURED] **`requires_merged` — 7 distinct PRs, all MERGED.** `#1350` 08-27, `#1361` 08-28,
  `#1317` 08-25, `#1351` 08-27, `#1348` 08-27, `#1257` 08-20, `#1111` 08-14 (`gh pr view N --json
  number,state,mergedAt,title`, full numbers, no `--jq`). **No `requires_merged` gate points at a
  CLOSED-unmerged PR**, so none of them is permanently dead.
- [MEASURED] **`requires_file_on_main` — 11 gates, all HELD, none dead.** 5 are
  `docs/approvals/*-approved-by-marco.md` markers (by design, waiting on Marco). The other 6 name
  files their own predecessor slice creates; each predecessor is on the board and lints ADMIT
  (`pr-tr-s1-reminder-policy`, `pr-fv2-ai-import`, `pr-ew-s2d`…). **No gate names a path that was
  renamed underneath it** — checked by searching all 2806 tracked files for each basename:
  `allocation.controller.ts`, `ai-form-import.service.ts`, `form-digests.service.ts`,
  `reminder-policy.service.ts`, `tender-reminder.service.ts`,
  `tender-reminder-escalation.service.ts`, `agreed-record-register.controller.ts` → **exact
  basename elsewhere: NONE** for all seven. (`apps/api/src/modules/allocations/allocations.controller.ts`
  exists, but it is the pre-existing *resource* allocations module, not the EW tendering controller
  `pr-ew-s2d` builds — different module, different route base.)
- [MEASURED] **`requires_on_main` symbol gates — 17, of which 8 RELEASED and 9 HELD, none dead.**
  For each HELD symbol I searched the whole tree: `pushBack`, `detectUnallocated`,
  `getAllEstimatorsSummary`, `VALUE_COLUMNS_HAVE_UNITS`, `SUB_LINE_PRICES_LINKED_ITEM`,
  `handleUpdateColumn`, `company.manage` appear **only in plans, prompts and archived breadcrumbs —
  never in `apps/`**. They have not been built and not been renamed. My verdicts agree with
  `lint-prompt.mjs` on all 24 REJECTs and all 32 ADMITs.
- [MEASURED] **The one gate worth double-checking was a false alarm.** `pr-ew-s4` gates on
  `allocation.controller.ts` (absent) while its own output file `capacity.service.ts` **already
  exists** on main — the shape of a masked-dead premise. Read the file: 260 lines,
  `getWeightConfig / urgencyKey / sizeBand / computeTenderLoad / getEstimatorLoad / getCapacity /
  isOverloaded / getLeastLoaded` — i.e. EW-2a, exactly what the prompt's own Context section says is
  already there. `getAllEstimatorsSummary` and `capacity-board` are genuinely absent. **Premise
  alive, gate alive.**

**Board trap, checked with its own control:** tracked `-ready.md` at depth 1 = **0** (the same query
returns 58 `-HOLD.md`, so it is not blind). No re-armable ready-file on main.

**[CANNOT MEASURE]** the *body* of all 56 HOLDs for prose human gates. §9.5 says a prose gate is
invisible to both `lint-prompt.mjs` and any grep built on it; reading 56 bodies did not fit this
run's budget. The 32 ADMITs remain **candidates**, not instructions.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced `last_index` 3 → **0**, `last_run_utc` →
  `2026-09-01T02:10:46Z`. Working-tree edit in the dev tree, **uncommitted** (see F3).
- This breadcrumb, written to the dev tree at `docs/pr-prompts/`. **Untracked** until a board PR
  commits it — Station 00 sweeps it up.
- Three scratch probes under `C:\po-sup-fix-scripts\` (outside the repo, tracked nothing).
- **Nothing else.** No prompt armed, disarmed, renamed, moved, staged or deleted. No PR touched. No
  git write against any `.git`.

## FINDINGS

### F1 — `pr-statussweep-orphan-worktree-dirs-HOLD.md` has already SHIPPED, but it lints ADMIT and sits in the arm-candidate bucket. **S2.**

[MEASURED] `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-statussweep-orphan-worktree-dirs-HOLD.md`
→ **`ADMIT` (size 1), exit 0.** `triage-holds.ps1` therefore lists it under *GATES SATISFIED —
CANDIDATES*, i.e. it is offered to Station 00 as arm-ready.

[MEASURED] Its premise is `! grep -q "orphanWorktreeDirs" scripts/pipeline/status-sweep.ps1` and its
`done_when` is `grep -q "orphanWorktreeDirs" … && grep -q "abandoned worktree DIRS" …`. Against
`origin/main:scripts/pipeline/status-sweep.ps1` (368 lines):

| needle | hits |
|---|---|
| `orphanWorktreeDirs` | **0** |
| `abandoned worktree DIRS` | **0** |
| `REGISTRY-ESCAPEE` | **5** |
| `escapeeCount` | **4** |
| `worktree-registry-escapees` | **3** |
| `zzzNoSuchTokenZzz` (negative control) | 0 |

[MEASURED] The feature the prompt asks for **landed on 2026-08-31 in `#1460`** — the sweep now scans
`C:\po-worktrees`, `C:\po-wt` and `C:\po-watcher-worktrees` for directories absent from
`git worktree list` and printed **9 REGISTRY-ESCAPEE lines** in this run's sweep, with size, age and
`.lock` state. That is precisely what the prompt's body specifies.

[INFERRED] The implementation used `escapeeCount` / `REGISTRY-ESCAPEE`; the prompt's premise tests
for `orphanWorktreeDirs`. **The premise names an identifier the fix never used, so it cannot die on
landing** — LL-54, the exact defect this station's own ADVERSARIAL PROMPT CRITIQUE checklist
enumerates, caught after the fact. It will read as ready forever. Arming it burns a full agent run
and its most likely output is a **second, duplicate escapee scan** in the same 368-line script.

[MEASURED] Blast radius checked: no other depth-1 prompt greps `orphanWorktreeDirs`, and no other
prompt names `Measure-Object`.

**DISPATCHED → Station 00.** Retire `docs/pr-prompts/pr-statussweep-orphan-worktree-dirs-HOLD.md`
to `docs/pr-prompts/superseded/` in the next board PR, citing `#1460`, and **do not arm it.** I am
read-only on the board and did not move it. RULE 1: retiring it is the complete-and-additive move —
it removes a permanently-false candidate from every future triage; merely noting "do not arm" in a
report fails the future half, because the next fresh run reads `ADMIT` and has no memory of this.

### F2 — Station 03's 23:02Z dispatch names the wrong cause, and its cheaper cure would leave a wrong number behind. **S3, correction to a live dispatch.**

[MEASURED] `docs/pr-prompts/00-03-machine-minder-2026-08-31-2302-…md:121-151` (finding F2) reports
the same `Measure-Object : The property "Length" cannot be found` error I saw this run, and
dispatches to Station 00 with two cures offered as alternatives: *"add `-ErrorAction
SilentlyContinue` to `Measure-Object`, or filter `| Where-Object { -not $_.PSIsContainer }` first."*
It states the cause as *"`C:\po-worktrees\fix-followup-notes` contains 3 entries and no files, so
`Get-ChildItem -Recurse` **yields nothing** and PS 5.1 `Measure-Object` errors on empty input"*, and
judges the damage to be *"not the value — it is the noise"*.

[MEASURED] Re-probed at 2026-09-01T02:2xZ, per escapee, counting items and files separately and
watching `$Error.Count` across the call:

```
C:\po-worktrees\fix-followup-notes    items=6215   files=0      MeasureObjectThrew=True
C:\po-worktrees\ph                    items=87358  files=72030  MeasureObjectThrew=False
C:\po-worktrees\po-scan-1787002207    items=2946   files=2295   MeasureObjectThrew=False
C:\po-wt\agentB-out                   items=4      files=4      MeasureObjectThrew=False
C:\po-wt\s9files                      items=2      files=2      MeasureObjectThrew=False
  (control: scripts\pipeline, has files)              MeasureObjectThrew=False
```

**The input is not empty. It is 6215 `DirectoryInfo` objects, none of which carry a `Length`
property.** Exactly one of the nine escapees throws, and it is the only one with `files=0`.

[INFERRED] That changes which cure is correct. `-ErrorAction SilentlyContinue` on `Measure-Object`
silences the message and leaves `$escapeeSize` null → the sweep keeps printing
**`size=0KB` for a directory tree holding 6215 entries**. Station 03 reads that line to decide what
to prune; `0KB` at 15 days old reads as *empty and harmless*. That is DOCTRINE §7 in miniature — a
broken instrument returning a confident, coherent, wrong number — and §9.6, an empty result standing
in for an empty world. The `-File` / `PSIsContainer` filter fixes the message **and** the number.

[MEASURED, secondary] The defect's line number moved from **168** (03, 2026-08-31T23:02Z) to
**204** (this run, `850a649c`) — `#1466` landed in between. The construct is unchanged. A live
argument for `pr-doctrine-s95-cite-symbol-not-line-HOLD.md`, which is ADMIT on the board.

**DISPATCHED → Station 00.** When you action 03's F2, take **only** the filtering cure, and reject
the `-ErrorAction SilentlyContinue` alternative. RULE 1: the filter is the complete-and-additive
half — it corrects the reported size for every shape of directory and the error can never fire
again; `-ErrorAction SilentlyContinue` fixes today's noise and preserves a wrong reading
indefinitely, failing the future half. **I did not stage a prompt for this** — 03's dispatch is
already in flight and a second prompt against the same line is the duplication the staging rules
forbid.

### F3 — The rotation advance of 2026-08-31T22:11:20Z was never committed, so `origin/main` is one sweep behind the dev tree. **S3.**

[MEASURED] `git diff -- docs/pipeline/sweep-rotation.json` at run start:
`-"last_index": 2, -"last_run_utc": "2026-08-31T18:10:27Z"` → `+"last_index": 3,
+"last_run_utc": "2026-08-31T22:11:20Z"`. `origin/main` still carries `last_index: 2`.

[INFERRED] `next-sweep.mjs` reads the working copy, so the dev tree rotates correctly — this run
was handed `gate-liveness` and it was genuinely next. But any actor reading `origin/main` — the
watcher clone, CI, or a §10 cloud lane — computes the *previous* position and would repeat the
22:11Z run's sweep. The 18:10Z advance did land on main, so this is one dropped commit, not a
systemic stall; my own advance to `last_index: 0` compounds it until it is committed.

**DISPATCHED → Station 00.** Commit `docs/pipeline/sweep-rotation.json` together with this
breadcrumb in the next board PR. One commit discharges both the 22:11Z advance and mine.

### F4 — Two consumed `-HOLD.md` are still tracked on `main` with no file on disk. **S3, board-trap family.**

[MEASURED] Tracked at depth 1 on `850a649c`: 58 `-HOLD.md`, 0 `-ready.md`. On disk: 56 `-HOLD.md`,
0 `-ready.md`. The two tracked-but-absent:

| prompt | its PR | PR state |
|---|---|---|
| `pr-crm-s11-archive-reason-delete-empty-HOLD.md` | `#1464` | **OPEN** (12 pass / 1 pending) |
| `pr-crm-wincount-s3-recompute-HOLD.md` | `#1468` | **MERGED** 2026-09-01T02:03Z |

[MEASURED] Both were armed, consumed and had their files retired into a gitignored folder; the
`git rm` was never committed. `git status` is structurally blind to this (§9.2) — it is only
visible by differencing the tracked set against the disk set.

[INFERRED] This is the near-miss half of THE BOARD TRAP. Any `git checkout .` / `reset --hard` /
`stash pop` in the dev tree restores both files. `pr-crm-wincount-s3` would then re-lint against
`requires_merged: 1350` (MERGED) and `pr-crm-s11` against `CommsHubPage.tsx :: CommsInboxTriage`
which I measured **RELEASED** on main — so a resurrected `pr-crm-s11` lints ADMIT and is armable
**against work that is currently an open PR**.

[MEASURED, re-read at 02:19:5xZ] `#1464` **MERGED** 2026-09-01T02:17:48Z, merge commit `1efd079c`.
Both prompts are therefore unambiguously consumed.

**DISPATCHED → Station 00.** `git rm docs/pr-prompts/pr-crm-wincount-s3-recompute-HOLD.md` and
`git rm docs/pr-prompts/pr-crm-s11-archive-reason-delete-empty-HOLD.md` in the next board PR. Both
their PRs are merged. **Do not sweep up the third ` D` you will see next to them** — see F6.

⚠️ **Method correction to my own probe.** Differencing the tracked set against the disk set finds
tracked-HOLD-with-no-file, but that reading is **ambiguous**: it is produced equally by *"consumed,
removal never committed"* and by *"being armed right now"*, because arming is a `git mv` rename of
a tracked `-HOLD.md`. Cross it against `.arming-log.txt` and the `-ready.md` set on disk before
calling any of them dead. F6 is the case that proved it.

### F5 — The gate-liveness sweep itself is CLEAN, and here is the control that says so. **No defect.**

[MEASURED] `spent=0 / gates-satisfied=32 / still-gated=24 / unreadable=0 of 56`, with
`triage-holds.ps1`'s own SPENT-bucket fixture control passing. Zero dead `requires_merged`, zero
renamed gate paths, zero renamed gate symbols across 35 gated prompts. **DEFERRED** — nothing to
act on; recorded so the next run knows this sweep was covered completely at `850a649c` rather than
skipped. It becomes urgent again if `triage-holds` ever reports `spent>0` without a matching
retirement in the same board PR, or if any `requires_merged` PR is closed unmerged. **Note F1: a
prompt can be spent in substance while `spent=0` — that bucket only catches premises the linter can
falsify.**

### F6 — A prompt was armed THREE MINUTES INTO THIS RUN. Every count above with `armed: 0` in it is spent. **No defect — a `[LIVE]` calibration, and the reason F4 needed correcting.**

[MEASURED] `status-sweep.ps1` at **02:11:05Z** printed `armed (*-ready.md): 0`. Re-measured at
**02:20:04Z**: `armed = 1`, `pr-estpricing-s4-charge-steps-editor-ready.md`. The arming log's last
line is `2026-09-01T02:13:47Z ARMED pr-estpricing-s4-charge-steps-editor escalates=true by=Marco@
pid=7332`. A second actor was working the board throughout this run.

[MEASURED] That `-ready.md`'s mtime is **2026-08-31T03:31:39Z** — 23 hours before the arm that
produced it. **DOCTRINE §9.5 reproduced exactly**: `git mv` preserves mtime, so the file's clock
dates its authorship and only the untracked `.arming-log.txt` dates the arm. Read the mtime alone
and this is *"a prompt armed and unseen since yesterday morning"*; it was armed seven minutes ago.

[MEASURED] `gh pr list --state open` → **`[]`**. `#1464` merged 02:17:48Z (`1efd079c`). The open
board went from 1 to 0 during this run. Every board count in this breadcrumb is stamped at the
minute it was taken and none of them is current.

**DEFERRED.** Nothing to fix — this is the system working, recorded because it is the cleanest
`[LIVE]`-decay instance since the 2026-08-31T18:14Z one, and because it is what caught the
ambiguity in F4's probe. It becomes urgent only if a station ever quotes an `armed:` count it did
not take immediately before acting.

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or deleted nothing.** Station 04 is read-only on the board; F1
  and F4 are removals and they are Station 00's to commit.
- **Staged no prompt.** The one defect that warranted one (F2) is already under a Station 03
  dispatch; staging a second prompt against the same line would duplicate it.
- **Committed nothing.** `sweep-rotation.json` and this breadcrumb are left as working-tree changes
  for the next board PR. Committing locally on `main` would put the dev tree ahead of `origin` and
  break the next fast-forward — a worse failure than one deferred commit.
- **Did not read all 56 HOLD bodies** for prose human gates. Declared `[CANNOT MEASURE]` above
  rather than letting `gates-satisfied=32` read as 32 armable prompts.
- **Did not touch** `/sot/`, Azure/Entra/SharePoint, the watcher clone, the 9 worktree escapees, the
  15 `needs-marco/` files, or any `git` write. Escapee pruning and clone hygiene are Station 03's
  and are already dispatched.
- **Ran no live-site (Part 2) or Dependabot pass.** The rotation named `gate-liveness` and the
  station doc says cover ONE sweep completely rather than several shallowly.
