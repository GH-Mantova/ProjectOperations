# Station 00 — Supervisor | 2026-09-07T07:08Z–2026-09-07T07:5xZ

## GROUND

```
UTC            2026-09-07T07:08:47Z
origin/main    3c4086cb            (fetch --prune first, then rev-parse)
dev tree       main @ 3c4086cb  C:\ProjectOperations2   (0 0 after a clean fast-forward)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was **not** read-only on that account.

SIGHTED run. `start_process` shell `powershell.exe` returned a live prompt on the Windows host;
the persistent shell was pid 35492. PS `5.1.26100.9168`.

Device-bridge git guard, run at the top of the run per PREFLIGHT, last line quoted verbatim:
`vm-git-guard installed at /sessions/eloquent-brave-goldberg/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`. [MEASURED]

All three binding documents read **in full** this run. Freshness was proved, not assumed:
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY** after the fast-forward, so the working
copy IS `origin/main` for all three and was read from disk. No piped hash was taken (PREFLIGHT
step 2). [MEASURED]

`status-sweep.ps1`, captured to a file so its §7 verdict survives the early return:
**`§7 VERDICT — [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no
live station worktrees.`** · watcher node RUNNING pid **31660** · auto-restart wrapper alive (1) ·
heartbeat age 21 min · `index.lock` interactive/clone **False / False** · git processes **0** ·
`armed (*-ready.md): 0` at sweep time · watcher clone `branch=main dirty=4` · one orphaned worktree
`C:/po-vg` (dirty=1, age 4277 min — the one 03 already escalated). [MEASURED]

**Fresh needle minted for this run: `zzQq00Nd20260907T0715`.** It returned **0** on every corpus it
was run against (the processed-log directory, the two edited documents, the copied watcher log).
**It is spent the moment this file is tracked — do not reuse it.** (§9.6.)

## WHAT I MEASURED

### The board — 3 open, and the probe that classifies them

`gh pr list --state open` at 07:1xZ. **#1761 merged at 07:11:03Z while this run was reading it**, so
the sweep's "4 open" line is already history — §7's `[LIVE]` rule, live.

RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never the
clone (§9.5): **619** `marco.:true` verdicts; NEGATIVE control (this run's minted needle) **0**;
POSITIVE control on a PR the watcher DID open, `PR #1742\b` over `processed\pr-*.log` → **2**;
NEGATIVE `PR #999999\b` → **0**. The probe is calibrated in both directions. [MEASURED]

| PR | `PR #<n>` in `processed\pr-*.log` | `opened PR #<n>` in the daily clone log | hand-classification |
|---|---|---|---|
| #1767 | **0** | **absent** ⇒ `[CANNOT MEASURE]` (§9.5) | `apps/api/prisma/migrations/…` ⇒ **MARCO'S**, and labelled `do-not-merge` |
| #1760 | **0** | absent ⇒ `[CANNOT MEASURE]` | `scripts/pr-watcher/index.mjs` is outside `tests\|docs` ⇒ **MARCO'S**; carries `docs/decisions/merge-approvals/1760.md` ⇒ supervised cloud lane's own |
| #1746 | **0** | absent ⇒ `[CANNOT MEASURE]` | `apps/api/prisma/migrations/…` ⇒ **MARCO'S**; carries `merge-approvals/1746.md` |

All three recorded `[NO LANE VERDICT — hand-classified]`. **MERGE NONE.** The daily-log test is
one-directional (§9.5): absent ⇒ `[CANNOT MEASURE]`, never ⇒ second lane, so each row is
corroborated by `classifyPolicyFiles` on the file list and by `.arming-log.txt` (no arm inside any
of the three PRs' windows).

Daily clone log selected the corrected way — **name-shape filter first, newest by mtime second**
(this run's own F3 fix, applied before it landed): `2026-09-07.log`, mtime `07:13:23Z`, 61,394 B,
POSITIVE control `[merge]` → **5**, `opened PR #` → 2 lines (`#1742`, `#1740`), NEGATIVE control
**0**. [MEASURED]

### `$env:OS` is empty — and the environment around it is NOT

The staged prompt's premise says `$env:OS` is empty in a station shell. Re-measured independently in
this run's own shell, and **refined**: it is not a scrubbed environment.

```
Get-ChildItem env: | Measure-Object          -> COUNT=53
$env:PATH.Length                             -> 2112
$env:USERNAME                                -> [Marco]
$env:TEMP                                    -> [C:\Users\Marco\AppData\Local\Temp]
$env:OS                                      -> []          <- EMPTY
$env:COMPUTERNAME                            -> []          <- EMPTY
```

[MEASURED] 53 variables present with PATH and USERNAME intact, and exactly the two variables the
shell's PARENT normally propagates — `OS` and `COMPUTERNAME` — missing. So the prompt's diagnosis is
right and its cure (`[System.Environment]::OSVersion.Platform`, which .NET answers and no parent can
clear) is the right shape. This is a second, independent confirmation from a different session than
the one that authored the prompt.

### #1767's two reds

`gh pr checks 1767`: `Approval receipt (CP-26)` **fail** (10 s) and
`PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` **fail** (8 s); CodeQL `skipping`; five
checks still pending on a branch updated at `07:13:14Z`.

[CANNOT MEASURE] the job logs — `gh run view 34094407563 --job … --log` returns
*"run … is still in progress; logs will be available when it is complete"*. The annotations API
answers, and answers nothing useful: both jobs carry the same two annotations, a Node-20 deprecation
warning and `failure :: Process completed with exit code 1`. **I did not diagnose either red from
the diff (§3).** [MEASURED, and its limit stated]

What IS measured: #1767 carries `do-not-merge`, applied `2026-09-07T06:44:04Z`, **6 seconds after
the PR was created** at `06:43:58Z` — i.e. at creation, by its own opener, not later by the watcher.
The actor field reads `GH-Mantova`, which is how every agent and Marco alike authenticate, so
**[CANNOT MEASURE] which lane applied it.** A labelled PR with no `docs/decisions/merge-approvals/1767.md`
in its diff is exactly the state `approval-receipt.mjs` is built to fail, so the CP-26 red is
[INFERRED] to be **the gate working correctly**, not a defect — and it is Marco's to clear, by
releasing the PR. I did not touch the label and did not author a receipt.

## WHAT CHANGED

Board PR opened from an isolated worktree off `origin/main` (`C:\po-worktrees\bd0715`, branch
`docs/doctrine-s9-four-corrections-0715`), torn down at the end of the run. Every document edit made
in **node**, by **concatenation** — never `String.replace` with a replacement string (§9.3) — with
the byte delta ASSERTED before the file was accepted.

1. **`docs/pipeline/DOCTRINE.md`** — five corrections spliced. Read-back:
   `beforeBytes=117721 afterBytes=125762 actualDelta=8041 expectedDelta=8041`; each block present
   exactly once and each anchor still present exactly once; `U+FFFD` **0**; the `â€` double-encode
   signature **2 before and 2 after** (both are §9.3's own documented examples of it, not damage);
   no BOM. [MEASURED]
2. **`docs/pipeline/STATION-CAPABILITIES.md`** — three edits (§1, §5, §6).
   `beforeBytes=27425 afterBytes=29952 actualDelta=2527 expectedDelta=2527`; `U+FFFD` 0; `â€` 0.
3. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` hash re-recorded
   `cc4a3180aa211456 → 326cb486a3d79452` via `lint-station.mjs --write-canonical`. Before the
   re-record `lint-station.mjs` REJECTed exactly **one** document; after it, `ADMIT: all 8 docs
   clean`, **exit 0** (captured to a file — `| Select-Object -First N` breaks the pipe and makes
   `$LASTEXITCODE` read `-1` on a passing run).
4. **ARMED `pr-triageholds-s2-env-os-is-empty-in-a-station-shell`** via `arm-prompt.ps1` (never a
   bare `git mv`), `-WhatIf` first (exit 0), then live. Read-back: exactly one `*-ready.md` on the
   board; the `-HOLD.md` is gone from disk; `.arming-log.txt` gained one line —
   `2026-09-07T07:20:53Z ARMED pr-triageholds-s2-env-os-is-empty-in-a-station-shell escalates=false
   actor=station-00.0708 … pid=12928`. `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt`
   → **`1 0`**, insertions with zero deletions, i.e. a strict superset of `main` — so the log was
   COPIED into the PR worktree, never restored to HEAD (§the append-only rule in 00-supervisor.md).
5. **`.arming-log.txt` committed in this board PR**, as DOCTRINE §9.5 requires of any run that arms.
6. **Station 04's 0610 breadcrumb committed** at its tracked path — it was untracked and reached
   nobody until now.
7. This breadcrumb, written **inside the PR worktree** (cure 1 of the post-merge FF trap), so no
   loose untracked copy is left in the dev tree for the next fast-forward to trip over.

The `-HOLD.md` deletion left in the dev tree by the arm is **LEFT UNCOMMITTED** — the built PR
deletes it, as with every other consumed HOLD.

**Nothing merged. No label added or removed. No receipt authored. No watcher restart. No `git` run
against the mount. No `checkout .` / `reset --hard` / `stash pop` / `clean` anywhere.**

## FINDINGS

### F1 [S2] — a NEVER-ARM migration prompt's work is open as a PR, and the prompt is still an armable `-HOLD` on the board

`#1767` — *"feat(crm): reminder policy config + polymorphic reminder log (TR-1)"*, created
`2026-09-07T06:43:58Z` on `feat/crm-tr-s1-reminder-policy` — builds the work of
`docs/pr-prompts/pr-tr-s1-reminder-policy-HOLD.md`, a prompt on this station's standing **do-not-arm
without Marco** list because it carries `gate_allow: migrations`.

[MEASURED] the prompt was **never armed**: `.arming-log.txt` has **64 lines before this run's own
entry** and `Select-String -Pattern 'reminder'` over the whole log returns exactly **one** row, from
`2026-09-01`, for a *different* prompt (`pr-crm-s12-rescope-tender-reminders`). The file is still
`pr-tr-s1-reminder-policy-HOLD.md` on disk. The watcher's daily clone log has **no**
`opened PR #1767` line and **no** `[start] pr-tr-s1-…` line; what it does have, 9 mentions, is the
REVIEW lane picking the PR up after the fact (`[review] enqueued review for PR #1767 … rev-1767-ready.md`
at `06:47:12Z`, verdict **MERGE** written to `docs/pr-reviews/pr-1767-review.md`, mirrored to the PR
at `06:51:08Z`) plus two `[update] PR #1767 branch updated (was BEHIND)`. The review lane reviews
PRs the watcher never opened, so those carry **zero** lane information (§9.5).

**This is §10.6 in its live form**, and it is the dangerous half: the prompt's premise is still TRUE
and will read `ADMIT` in every triage until `#1767` **merges**, not until it opens. An arming run
that consults the `ADMIT` bucket alone opens a SECOND PR for a schema migration already under
review. The standing never-arm entry is what stops it, and it stopped it here — but the guard is a
memory line, not an instrument.

🔧 The complete-and-additive cure is the one §10.6 already prescribes and this instance sharpens:
**cross every `ADMIT` prompt's `scope:` against OPEN PRs, matching a `/`-terminated scope entry as a
PREFIX** — `pr-tr-s1-reminder-policy`'s scope names `apps/api/prisma/migrations/` as a directory and
`#1767`'s migration sits one level inside it, which is exactly the under-report 04 measured at
02:1xZ. The alternative — trusting the never-arm list — fails the *future* half of RULE 1: the list
covers the prompts someone thought of.

**DISPOSITION: ACTIONED.** `pr-tr-s1-reminder-policy-HOLD.md` remains a HOLD, unarmed and untouched;
`#1767` classified MARCO'S on two independent grounds (migration path, and a `do-not-merge` label);
neither merged nor relabelled. The §10.6 prefix rule landed on `origin/main` at 03:4xZ and now has a
second worked instance recorded against it.

### F2 [S3] — `$env:OS` is empty, but the environment is not: only `OS` and `COMPUTERNAME` are missing

Recorded in WHAT I MEASURED. 53 environment variables present, `PATH` 2112 chars, `USERNAME` and
`TEMP` intact; `OS` and `COMPUTERNAME` both empty. That is a **parent that dropped two variables**,
not a scrubbed environment — which is why `triage-holds.ps1:244`'s `if ($env:OS -eq "Windows_NT")`
sends a Windows box down the `/bin/bash` branch while `$env:ProgramFiles` in the *same* script's
candidate scan would have found bash immediately.

**DISPOSITION: ACTIONED.** `pr-triageholds-s2-env-os-is-empty-in-a-station-shell` armed this run
(readbacks in WHAT CHANGED). The refinement above is recorded here rather than edited into the
prompt: the prompt's premise, cure and `done_when` are all correct as written, and rewriting an
armed prompt mid-flight is how a build gets a different file from the one that was linted.

### F3 [S2] — Station 04's F1, F2, F3, F6 and F7 landed in DOCTRINE

All five from `00-04-scanner-2026-09-07-0610-…`, in one PR, byte-delta asserted:

- **F1 → §9.1.** The `-Include` bullet is narrowed to the **no-`-Recurse`** form, with 04's fixture
  table as its falsifying probe, and the `[CANNOT MEASURE]` on the exact six-minute query stated
  rather than inferred. Nothing retired — `-Filter`, the wildcard path and the
  control-against-a-known-file clause all stand.
- **F2 → §9.5.** "Take the newest `*.log` by `LastWriteTimeUtc`" now carries the daily-log
  **name-shape** guard, because `supervisor.log` was written today, sat second-newest by 45 minutes,
  and answers `opened PR #` → 0 with its own positive control `[merge]` → 0.
- **F3 → §9.4.** The `merged`-on-a-list bullet now records that through `gh api` the key is
  **ABSENT** rather than `false`, so a reader checking it through `gh` cannot read the trap as dead.
- **F6 → §9.2.** 04 dispositioned this DEFERRED; I have **re-dispositioned it ACTIONED** and landed
  it, because it is one clause in a file already being edited in this PR and its cost is zero, while
  its trigger ("a station re-files the uncommitted-advance finding off a ` M` line") is a bill a
  future run pays in full. On a tree behind `origin/main`, `git status` answers about **HEAD**; the
  uncommitted-work probe is `git diff --numstat origin/main -- <path>`, EMPTY being the real answer.
- **F7 → §9.6.** *Run every §9 probe against the corpus its bullet NAMES, never against §9 itself* —
  this document contains a literal instance of every broken query it records, so a probe pointed
  here measures the documentation and inverts the answer. It generalises the minted-needle rule from
  needles to patterns.

The half of 04's F6 about `security-audit.ps1` being lossless through a PowerShell pipe **only
because it is pure ASCII today** is left DEFERRED as 04 filed it; its falsifying probe (the
non-ASCII byte count of `origin/main:scripts/security-audit.ps1`) is unchanged and is in 04's
breadcrumb, which this PR now makes readable to everyone.

**DISPOSITION: ACTIONED.** `lint-station.mjs` exit **0**, `ADMIT: all 8 docs clean`, after the
`instruments v2` hash re-record.

### F4 [S3] — a fifth live scheduled task existed outside every map; STATION-CAPABILITIES now says so

04's F4. `weekly-security-audit` (`30 7 * * 1`) is **enabled** in the scheduled-tasks MCP and was
absent from §1's layer discussion, §5's authority matrix and §6's cadence table, while
`C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md` files — so every "the five bootstraps"
probe covers 5 of 11 files and 4 of 5 live tasks.

Landed as three additions: §1 now says **express every bootstrap sweep's corpus as "every `SKILL.md`
behind an ENABLED task in the scheduled-tasks MCP", never as "the five"** — a rule, not a name, so
the sixth task inherits it; §5 records the task and its all-❌ authority row; §6 gains its cadence
row. This is the section's own *"when a layer is added, add it here first"* rule applied to itself.

**DISPOSITION: ACTIONED.**

### F5 [S3] — the 00/04 cron collision is structural six times a day; the open escalation describes only the midnight case

04's F5, and it changes the SCOPE of an escalation that is already Marco's rather than opening a
second one. `needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` and
STATION-CAPABILITIES §6 both frame the collision as 00 / 04 / 05 landing within ten minutes of
**midnight local**, and conclude 05 must move. [MEASURED] this cycle from `lastRunAt`: 00
`2026-09-07T06:08:25Z`, 04 `2026-09-07T06:10:04Z` — **99 seconds apart, at 16:08 local**, nowhere
near midnight, with 05 not involved. `5 * * * *` and `0 */4 * * *` collide **six times a day by
construction**, and moving 05 touches none of them.

**DISPOSITION: ESCALATED** → Marco, folded into the existing file, not a new one. The cron lives in
the scheduled-tasks layer, which is his. RULE 1 order:

**(a) [complete + additive — FIRST] Offset 04 as well as 05** — e.g. `35 */4 * * *`. Clears 00's
`:05` slot on every one of the six daily collisions and clears 05's `00:10` as a side effect. Fixes
today's instance and every future one; costs nothing but a cron edit and damages no data entry.
**(b) Offset 05 only**, as the escalation currently proposes. Fixes one of six and leaves five —
fails the *immediate* half on five of them.
**(c) Leave it and rely on the single-actor gate in `status-sweep.ps1` §3.** Fails the *future*
half: that gate is a check a run may skip, and the run that skips it is the one already colliding.

### F6 [S3] — `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2`, and it makes `--freshness` weakest exactly where escalation #23 is

04's F8, re-proved this run by the probe STATION-CAPABILITIES §6 names for it: my own
`--freshness` output above reads **`00 last 2026-09-07T06:37:00Z 0.6h ago (cadence 2h) ok`** against
a live cron of `5 * * * *`. So the probe COLLECT is told to *start* with will not call `00` SILENT
until **4 h** — after **three** consecutive missed hourly runs.

**DISPOSITION: ESCALATED** → Marco, folded into
`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`. It is a `scripts/`
change and therefore outside this station's merge lane. RULE 1 order, as 04 framed it and I endorse:

**(a) [complete + additive — FIRST] Derive `CADENCE` from the scheduled-tasks MCP or from one
checked-in schedule file** instead of hard-coding it. Fixes `00` and every future cron change at
once and cannot drift again. Cost: the schedule must be checked in for CI to read it.
**(b) Change the one character (`'00': 1`).** Completely fixes today and damages nothing, but this
is the **third** document to carry the number and the second to be corrected without the instrument
following — it fails the *future* half.
**(c) Rely on cross-checking `lastRunAt` from the MCP, as §6 instructs.** Fails the *immediate*
half: a discipline in prose is skipped by exactly the run that has already missed something.

### F7 [S3] — #1767 is red on two checks and I could not read either job log

Recorded in WHAT I MEASURED. CP-26 red is [INFERRED] to be the gate working as designed on a
labelled PR with no receipt. The `PR gates — diff checks` red is **not diagnosed**: the run was still
in progress, so `gh run view --log` refused, and the annotations gave only `exit code 1`. The
historically recorded coupling — CP-26 failing takes `PR gates — diff checks` down with it, one
cause and two reds — fits, but fitting is not measuring and I am not recording it as measured.

**DISPOSITION: DEFERRED.** #1767 is Marco's on two independent grounds and cannot merge without him
regardless of these checks. It becomes urgent if the reds survive after the CI run completes AND the
diff-checks failure turns out to have a cause of its own; the probe is
`gh run view 34094407563 --job 101654654217 --log` once that run finishes.

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs hand-classified MARCO'S with the controls quoted above;
  two carry their own supervised-lane receipts and are that lane's to land, one is labelled
  `do-not-merge`. RULE 2 binds on all three.
- **Did not author a `docs/decisions/merge-approvals/<N>.md` receipt** for any PR, and did not
  remove or add a label. Marco's 2026-09-07 ruling releases the **supervised cloud lane** to merge
  with a receipt; this is the **scheduled** lane and that ruling does not reach it.
- **Did not fix #1767's reds.** I did not read either job log, so under §3 and §8.1 I have no cause
  to fix — and diagnosing from the diff is the specific thing that produced three wrong diagnoses in
  one week.
- **Did not commit the ` D` for the armed prompt's `-HOLD.md`.** Its own built PR deletes it, as
  with every other consumed HOLD; committing it here would delete a prompt the watcher is about to
  read.
- **Did not archive any breadcrumb.** 04's 0610 and this one are the CURRENT cycle and stay in the
  queue root; archiving is for what a *later* run has already dispositioned.
- **Did not touch `C:/po-vg`** — the orphaned worktree holding 1 uncommitted file, 4277 minutes old.
  It is 03's, already escalated, and `--force` would discard the file.
- **Did not restart, kill or probe-and-relaunch the watcher.** It is RUNNING pid 31660 with a live
  wrapper; `armed` went 0 → 1 this run, which is work for it, not a fault.
- **Did not run `git` against the mount, did not touch `/sot/`, Azure, Entra, SharePoint or
  production data, and did not run `git` in `C:\po-watcher\ProjectOperations`** — the clone's daily
  log was read by copying the file first, never by `git`.
- **[CANNOT MEASURE]** which actor opened `#1767` or applied its label: `mergedBy`, the label
  timeline actor and every agent's authentication all read `GH-Mantova`. The 6-second gap between
  creation and labelling is recorded as evidence of *self-gating at creation*; it names nobody.
