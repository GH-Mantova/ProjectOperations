# Station 00 — Supervisor | 2026-08-30T08:09Z–2026-08-30T08:50Z

## GROUND

```
UTC            2026-08-30T08:09:07Z
origin/main    077ea6bc            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 077ea6bc     C:\ProjectOperations2   (CONVERGED)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Version check: doc version and bootstrap **AGREE**. Full authority, not read-only-by-mismatch.

**SIGHTED — not blind.** `start_process` shell `powershell.exe` succeeded on the first call
(PID 11776, `hostname` = LAPTOP-E6NHU4E4). This is a real run, not a quiet one. `[MEASURED]`
The previous run (06:09Z) was BLIND; the alternation continues with no discernible pattern.

Freshness of the origin/main read: `git status --short` over the three binding documents
returned **empty** and `HEAD == origin/main`, so DOCTRINE, STATION-CAPABILITIES and
`00-supervisor.md` as read from disk are byte-equal to `origin/main` at `077ea6bc`.
`[MEASURED]` — this is the proof the contract asks for, in place of `git show`.

## WHAT I MEASURED

`status-sweep.ps1` @08:10:28Z: **SAFE TO ACT**. Both §0 positive controls `[LIVE]` (gh saw
merged #1400; node runs). OPEN PRs **0** · main CI **3/3 green** · watcher node RUNNING
pid **26364**, wrapper alive (3) · `index.lock` interactive/clone False/False · git processes 0
· armed `*-ready.md` **0** · orphaned worktrees none · watcher clone `dirty=35` (the standing
`verdict-archive` amber, 03's F2 — not news). `[MEASURED]`

Dev-tree wedge state, by direct file probe: no `index.lock`, no `MERGE_HEAD`, no `REBASE_HEAD`,
no `CHERRY_PICK_HEAD`, 0 `rebase-*` dirs. Staged index **empty** (`git diff --cached
--name-status` returned nothing) — measurable this run, unlike the blind runs which must report
`[CANNOT MEASURE]` here. `[MEASURED]`

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0.** 118 checked,
0 malformed, 9 skipped as pre-contract. 00 2.0h/2h ok · 02 dispatch-only · 03 9.1h/24h ok ·
04 2.0h/4h ok · 05 18.0h/24h ok. **06 does not appear in any form** — second independent
sighting, consistent with `CADENCE` having no `'06'` key. `[MEASURED]`

**OAuth — FOURTEENTH reading, and the first taken directly since 04:09Z.** `[MEASURED]`
The file is at `C:\Users\Marco\.claude\.credentials.json` (NOT `C:\po-watcher\`, which is why
blind runs cannot see it — no mounted path reaches it).

```
mtimeUTC      2026-08-28T16:13:26.9090035Z    <- UNCHANGED across all 14 readings
expiresAtUTC  2026-08-28T16:13:35.9840000Z
expired       39.96 hours ago
lead          9.075 s between last write and expiry
```

The 9.075 s lead is now confirmed to the millisecond from the live file: the last successful
refresh **stored a credential that was already 9 seconds from death**. That is a failure in the
refresh *response*, not a refresher that stopped running. The stillness is a correctly-held
brake. **THE BLOCK STANDS — I armed nothing.**

## WHAT CHANGED

One PR, opened and merged by me: **#1401** (recorded in the FINDINGS below with its read-back).
It carries the DOCTRINE correction, the canonical-hash re-record, 04's uncommitted rotation
file, three breadcrumbs and one prompt retirement.

Board mutations: **none other**. Nothing armed, disarmed or renamed in the queue. Armed count
was **0** at start and **0** at end, re-measured. No `sot/` write. No `git checkout` / `reset
--hard` / `stash pop` / `clean`. Nothing touched in the watcher clone. Disposable worktree
`C:\po-worktrees\sup-0809` created off `origin/main --detach` and torn down.

## FINDINGS

### F1 — 04's F1 + F2 were mine to land, and I landed them

Station 04's `instrument-honesty` sweep (breadcrumb `...-0611-...`) dispatched two DOCTRINE §9
defects to me and staged `pr-doctrine-s9-two-refuted-claims-HOLD.md` carrying the exact
replacement text. Both premises **re-verified live on `077ea6bc` before editing**, with a
positive control (a string I know is in DOCTRINE returned 1):

```
"reports PHANTOM differences between two BYTE-IDENTICAL files"   -> 1 match   (9.3, live)
"carries **neither** marker"                                      -> 1 match   (9.5, live)
"51 of 61" / "the 61 depth-1"                                     -> 1 each    (stale census)
control: "AN EMPTY RESULT IS NOT AN EMPTY WORLD"                  -> 1 match   (instrument works)
dns-s5 on origin/main matches /watcher: do-not-arm/               -> 1         (#1400's cure is real)
```

I chose to **land it by hand rather than arm it**, for two independent reasons, and the first
alone is sufficient: **the OAuth block forbids arming**, and an armed prompt today would be
*burned* by the 401 exactly as `pr-crm-s3-account-on-client-create` and `rev-1386` were on
08-29 (both sitting in `failed/` with `401 OAuth access token has expired`). Arming would not
have produced the fix; it would have destroyed the prompt. Landing it myself is the RULE 1
complete-and-additive path — the correction is on `main` now, and nothing is consumed if OAuth
returns. Precedent: #1394, #1400, and my own 16:09Z run on 08-29.

Edits made with **node** (`readFileSync`/`writeFileSync`, utf8), never `Set-Content` or `>`,
each replacement asserted to match **exactly once** before applying. Read-back, all PASS:
premise literal gone · `done_when` literal gone · new redirection bullet present · new dns-s5
text present · census now 59 / 51-of-59 · zero `U+FFFD` · both CANONICAL-BLOCK markers intact ·
31552 → 32241 bytes.

**Encoding check, with the control that mattered.** My first read-back FAILED on "no
double-encode signature". It was my *detector* that was wrong, not the file: DOCTRINE
*documents* the `â€"` sequence at line 390 as the signature to look for. Re-run as a
**count comparison against the pristine blob from `git show` (piped through node, never `>`)**:
BEFORE=1, AFTER=1, and the detector's own positive control on a deliberately damaged string
returned 1. I introduced none. Reporting this because believing my first reading would have
been a §7 false verdict on clean work.

Canonical hash re-recorded via the sanctioned `--write-canonical`, and the gate proved itself:

```
lint-station.mjs  BEFORE re-record -> REJECT: instruments EDITED (sha bf70de05304552d2,
                                      expected 2edc6347fb6ab1b2)   exit 1
lint-station.mjs  AFTER  re-record -> ADMIT: all 7 docs clean       exit 0
station-contract sha 192677cc8d5680a6 UNCHANGED  (I did not disturb the other block)
```

**DISPOSITION: ACTIONED.** Landed in #1401. The staged prompt is retired to
`docs/pr-prompts/superseded/` in the same commit (#1400's convention, `git mv`, R100) rather
than left as a 60th dead `-HOLD` whose premise is now false.

### F2 — 04's rotation advance was uncommitted, and would have silently stalled its own rotation

`docs/pipeline/sweep-rotation.json` is **tracked**, and 04 left it ` M` in the dev tree with
`last_index: 0 -> 1`. 04 flagged this itself: *"if it is not [committed], the next 04 run
repeats `instrument-honesty` and the rotation silently stops."* 04 cannot commit — it is
read-only on the board — so this could only ever be closed by me, and 04's next run is due
~10:11Z.

This is the quiet class of defect the pipeline is worst at: nothing red, nothing missing, just
a station re-running the same sweep forever while `gate-liveness`, `repo-hygiene` and
`instruction-drift` go unswept — and no instrument reports it, because the rotation file
looks fine on disk.

**DISPOSITION: ACTIONED.** Committed in #1401 with the diff read back
(`last_index: 0→1`, `last_run_utc: 2026-08-30T02:11:11Z→2026-08-30T06:11:04Z`), with ~85
minutes to spare before 04's next run.

### F3 — I ran 04's deferred trigger. It has NOT fired — and `smoke-pr.ps1` is a near-miss, not a defect

04's F3 (`Select-Object -First N` kills a native process and `$LASTEXITCODE` reports the kill)
was DEFERRED with an explicit trigger it did not run: *"it becomes urgent the moment any
committed script under `scripts/pipeline/` pipes a native command through `Select-Object` and
then branches on `$LASTEXITCODE` — that grep is the trigger."* Cheap, and mine to run.

I swept **all** of committed `scripts/**/*.ps1`, not just `scripts/pipeline/`. Regex controlled
both ways (positive fixture `git log --oneline | Select-Object -First 6` → 1 match; negative
fixture `Get-Content foo.txt | Select-Object -First 6` → 0). **7 hits.** Six are
`smoke-pr.ps1:129,133,136,140,156,160` piping `pnpm` through `Select-Object -Last N`.

**That looked like the worst possible finding** — `smoke-pr.ps1` is the instrument DOCTRINE
says *"the exit code decides"*, and a lost exit code there is a false green on every merge. So I
measured it instead of reasoning about it:

```
fixture: node prints a,b,c then exits with the named code
                                  exit0      exit7
  no pipe (POSITIVE CONTROL)        0          7      <- instrument works
  | Select-Object -Last  3          0          7      <- PRESERVED  (smoke-pr.ps1's shape)
  | Select-Object -First 1          0         -1      <- DESTROYED  (04's report, reproduced)
  | Select-Object -First 99         -          7      <- PRESERVED  (no truncation, no kill)
```

**`-Last` preserves the exit code; only `-First` destroys it, and only when it actually
truncates.** `smoke-pr.ps1` is safe on all six lines. Had I reported the conjunction
(3 files contain both constructs) without measuring the mechanism, I would have filed a false
emergency against the one script the whole merge policy rests on.

The single genuine `-First` instance is `scripts/pr-watcher/start-watcher.ps1:93`
(`$stashTop = (git stash list --max-count=1 | Select-Object -First 1)`). `$stashTop` is
interpolated into a log line and **no branch reads `$LASTEXITCODE` after it** (lines 92-96 read).
Cosmetic.

Two things worth keeping, because they sharpen 04's finding rather than repeat it: the
corruption requires **actual truncation**, and its direction is **a real failure (7) becoming
`-1`** — it cannot manufacture a false pass in a script testing `-eq 0`, but `-1` is precisely
the value DOCTRINE §7 trap #3 records as the *spawn-failure* signature, so it can make a real
failure impersonate a broken instrument.

**DISPOSITION: DEFERRED**, unchanged in status but no longer unswept — 04's trigger condition is
now a measured negative across all committed scripts, not an unknown. It becomes urgent if a
future script pipes a native command through `-First N` **and** branches on the exit code; that
is now a two-line grep anyone can re-run.

### F4 — OAuth: fourteenth reading, and the execution lane is 40 hours dark

Measured above. Unchanged mtime, expired 39.96 h, 9.075 s lead confirmed live. The watcher
process is alive and correctly idle (armed 0), so nothing is being burned *right now* — but
nothing can execute either, and two real prompts were already destroyed by this on 08-29.

**DISPOSITION: ESCALATED — folded into the standing item, no second escalation raised.** This
is Marco's box: the re-authentication cannot be done by any station, and the standing question
(re-auth now, and whether to build a guard that refuses to arm on an expired token) is already
with him. I add one measurement rather than a new question: the failure is in the refresh
**response**, not a dead refresher, which is why waiting has not fixed it and will not.

### F5 — 06 is still absent from the freshness instrument

`--freshness` printed 00, 02, 03, 04, 05 and no 06 — 02 shows as "dispatch-only — no cadence to
miss", 06 appears nowhere at all. Second independent sighting this run (04 recorded the same).

**DISPOSITION: DEFERRED** — an open, unanswered escalation with Marco. Re-raising it is noise,
and the standing measurement holds: the cadence key and a real scheduled task are inseparable
halves, and creating the task is Marco's.

### F6 — the backlog's one READY-TO-STAGE item is not stageable while OAuth is dead

`status-sweep.ps1` §6 reports `ready=1`: `rates-11c-blocked-consumers` (P2), gate passed.

**DISPOSITION: DEFERRED.** Staging it would put work in a queue that cannot execute, and the
first thing to touch it would be burned by the 401. It is correctly reported as ready and
correctly left alone; it re-becomes actionable the moment the token is refreshed. Naming it
here so the next run does not rediscover it as new.

## WHAT I DID NOT DO

- **Armed nothing.** Armed count 0 at start, 0 at end, re-measured after the PR merged. The
  OAuth block stands and I did not read past it.
- **Did not merge any watcher-routed PR** — there were none; the board was empty (OPEN = 0) at
  start and #1401 was opened by me, not by the watcher.
- **Did not touch the watcher clone**, its `dirty=35`, or its git in any way. That amber is
  03's standing finding and 03's lane.
- **Did not restart the watcher.** It is RUNNING (pid 26364) with three wrappers and an empty
  queue — idle-with-nothing-armed is CORRECT, not wedged. `restart-watcher-if-wedged.ps1` was
  not run with `-Fix` and had no verdict that would justify it.
- **Did not clear the 13 dead `[STALE]` escalations** in `needs-marco/`. The folder is
  gitignored, so no PR can clear them and no reader outside this box can see them; clearing
  them by hand would be an unreviewable mutation. Standing item, unchanged.
- **Did not touch** `pr-doctrine-s9-four-false-traps-LOOPING.md` (premise dead, untracked,
  matches no glob, correctly defused) or `metadata-catalog.json` (CRLF stat artefact).
- **Did not fix** 04's cosmetic `lint-station` advisory (`C:\po-scan-` inside an
  already-commented-out SUPERSEDED block) — noise, and it is 04's own doc.
- **Did not go near** Azure / Entra / SharePoint, `/sot/`, or production data.
