# Station 04 — Scanner | 2026-08-30T06:10Z–2026-08-30T06:27Z

Sweep this run: **`instrument-honesty`** (rotation position 2 of 4, chosen by
`node scripts/pipeline/next-sweep.mjs`, not by me).

## GROUND

```
UTC            2026-08-30T06:11:04Z
origin/main    077ea6bc            (git fetch origin, then rev-parse --short origin/main)
dev tree       main @ 077ea6bc     C:\ProjectOperations2   (CONVERGED)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Version check: doc version and bootstrap **AGREE**. Full authority, not read-only-by-mismatch.

**SIGHTED — not blind.** `start_process` shell `powershell.exe` succeeded on the first call
(PID 7184). This is a real run, not a quiet one. `[MEASURED]`

Freshness of the origin/main read: `docs/pipeline/` is clean in the working copy
(`git status --porcelain -- docs/pipeline/` returned empty) and `HEAD == origin/main`, so the
three binding documents read from disk are byte-equal to `origin/main` at `077ea6bc`.
`[MEASURED]` — this is the proof the station contract asks for, in place of `git show`.

`status-sweep.ps1` @06:11:26Z and again @06:12:04Z: **SAFE TO ACT**. Both §0 positive controls
`[LIVE]` (gh saw merged #1400; node runs). OPEN PRs 0 · main CI 3/3 · watcher node RUNNING
pid 26364, wrapper alive (3) · `index.lock` interactive/clone False/False · git processes 0 ·
armed `*-ready.md` **0** · orphaned worktrees none.

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN, exit 0**, 116 checked,
0 malformed; 00 2.1h/2h ok · 03 7.2h/24h ok · 04 4.1h/4h ok · 05 16.1h/24h ok. `[MEASURED]`

## WHAT I MEASURED

Every DOCTRINE §9 claim I could probe, each with a control. Tags are per DOCTRINE 7.1.

**§9.1 — `$` expanded by the `-Command` layer. TRAPPED, reproduced 3×.** `[MEASURED]`
`start_process` with `powershell.exe -NoLogo -NoProfile -Command "Write-Output 'DOLLAR_TEST
literal=[$CTRL] true=[$true] pid=[$PID]'"` printed `literal=[] true=[True] pid=[14356]` — and
`14356` was **the new process's own PID**, a value nobody wrote. Two further calls this run died
as parser errors (`You must provide a value expression following the '+' operator`) when
`$LASTEXITCODE` / `$env:COMPUTERNAME` were eaten. The same expressions survive intact through
`interact_with_process`.

**§9.1 — streamed output returns EARLY with output pending. TRAPPED, reproduced 2×.**
`[MEASURED]` A 5-statement line returned after statement 1; a 41-line script returned after
line 31. Neither was a hang; the rest arrived on the next read.

**§9.2 — `ls-tree` without `-r`. TRAPPED.** `[MEASURED]` Against `origin/main`:
`-- docs/pr-prompts` (no slash) → **1** · `-- docs/pr-prompts/` → **230** ·
`-r -- docs/pr-prompts/` → **554** · `-r -- docs/pr-prompts/superseded/` → **249**.
The "always `-r`" rule is confirmed exactly as written.

**§9.2 — the `superseded/*.md` GLOB example. `[CANNOT MEASURE]`.** DOCTRINE says that pathspec
"returned 0 without `-r` and 247 with it". I get **0 in BOTH cases** — but my positive control
also failed: `-- docs/pr-prompts/*.md`, a pathspec I know matches 59 tracked files, returns
**0 with `-r`**, and `:(glob)` magic is refused outright (`pathspec magic not supported by this
command: 'glob'`). So `ls-tree` is not doing wildcard matching here at all, and I cannot
evaluate the sub-claim. Per §7 I report the broken instrument rather than a verdict. The
directory form (above) is unaffected and is what the rule actually turns on.

**§9.2 — `git status` blind to gitignored files; `check-ignore -v` silent on a directory.
TRAPPED, both halves, with a control.** `[MEASURED]`
`git status --porcelain -- docs/pr-prompts/_cleared-2026-08-14/rev-1002-ready.md.usage-limit.log`
→ **empty**. Positive control, same file: `git check-ignore -v` → `.gitignore:26:*.log`, exit 0.
`git check-ignore -v -- docs/pr-prompts/processed` → empty, **exit 1**, and identically with a
trailing slash.

**§9.2 — `git branch -r` over-reports vs the remote. TRAPPED (direction), magnitude has moved.**
`[MEASURED]` `git branch -r` = **26** · `git ls-remote --heads origin` = **22**.
`git branch -r --merged origin/main` = **2** against 22 live heads, confirming blindness to
squash merges. DOCTRINE cites "54 against 21 real" from 2026-08-29; the ratio is now 26/22.
The rule holds; the numbers in it are state, and state decays.

**§9.3 — `Set-Content` encoding. TRAPPED, byte-exact.** `[MEASURED]` Probe string
`alpha — omega` written as BOM-less UTF-8 = `616c70686120e28094206f6d656761`.
After plain `Set-Content`: `...e28094...0d0a` — em dash **intact**, CRLF added, nothing else.
After `Set-Content -Encoding UTF8`: `efbbbf 616c70686120 c3a2e282ace2809d 206f6d656761 0d0a` —
**BOM plus U+00E2 U+20AC U+201D**, the exact `â€"` double-encode signature DOCTRINE names.

**§9.4 — `gh run list --branch main` staleness. NOT reproduced this run.** `[MEASURED]`
`gh run list --branch main --limit 1` returned `createdAt=2026-08-30T04:17:22Z
sha=077ea6bc conclusion=success` — the current head. Per-commit read of the same SHA returned
13 check runs. The claim is hedged ("**can** be DAYS stale"), so one fresh reading does not
refute it; recording the negative so the next run has a second sample.

**§9.5 — `lint-prompt.mjs` fails OPEN on a broken git. TRAPPED, and it is silent about it.**
`[MEASURED]` First attempt was an invalid probe: `pr-524-rates-b-slice2-canonical-HOLD.md`
REJECTs at `HUMAN_GATE_PRESENT` (line 3) **before** any git-dependent gate runs, so it proves
nothing. Retried against `pr-bp-s2-worth-chasing-view-HOLD.md`, chosen because it ADMITs
normally:

```
node scripts/pipeline/lint-prompt.mjs <target>                       -> ADMIT (size 5)  exit 0
LINT_GIT_BIN=definitely-not-a-git-binary  node ... <target>          -> ADMIT (size 5)  exit 0
```

**Byte-identical output.** No warning, no stderr, no hint that five gate probes were skipped.

**§9.5 — the marker census, re-measured at `077ea6bc`.** `[MEASURED]` Depth-1
`-HOLD`/`-ready` on `origin/main` = **59** (DOCTRINE says 61; #1400 retired two to
`superseded/`). `<!-- watcher: do-not-arm -->` = 5 · literal caps `DO NOT ARM` = 4 ·
either = **7 distinct prompts** (DOCTRINE's 7 still correct) ·
`## STANDING AUTHORITY` = **51**, i.e. 51 of 59, not 51 of 61.

**Lead, not a finding: `## STANDING AUTHORITY` has THREE states, not two.** `[MEASURED]`
`lint-prompt.mjs:1109-1127` distinguishes (A) real grant, (B) heading present / grant absent —
**17 imposters** — and (C) no text at all — 21. The literal it requires is
`STANDING AUTHORITY to finish the work, commit, push`. A heading-only block is a WARN and the
run "may exit 0 without opening a PR". This sharpens the standing note that the heading is
boilerplate: a third of the prompts carrying it would not actually authorise the push.

**Lead, not a finding: the do-not-arm marker check appears position-scoped.** `[MEASURED]`
The prompt I staged this run quotes `<!-- watcher: do-not-arm -->` twice in its body and lints
**ADMIT exit 0**, while dns-s5 carrying it on line 2 REJECTs. I did not read the implementation
closely enough to name the mechanism, so this is a lead. It matters only if someone tries to
gate a prompt by putting the marker deep in a body.

**`lint-station.mjs`: ADMIT, all 7 docs clean, exit 0.** `[MEASURED]` One advisory on my own
station doc: *"names a Windows path outside the known folder map: `C:\po-scan-`"* — that string
is inside the block already commented out as SUPERSEDED 2026-08-24. Cosmetic.

**Angle 4 (history), before staging anything.** `[MEASURED]` `gh pr list --state open` = 0.
No prompt on disk mentions Compare-Object. `pr-doctrine-s9-four-false-traps-LOOPING.md` exists,
is **untracked**, and its premise `grep -q "no inline .if. expression" docs/pipeline/DOCTRINE.md`
returns **0 matches** against current DOCTRINE — it is dead and correctly defused by the rename.
Its scope was the earlier four claims corrected in #1394. Neither finding below is covered by
it, by an open PR, or by any staged prompt.

## WHAT CHANGED

Three writes, all in the dev tree, all **untracked or uncommitted** — Station 04 does not commit
or push, so Station 00 must sweep these up.

1. **STAGED (not armed):** `docs/pr-prompts/pr-doctrine-s9-two-refuted-claims-HOLD.md`.
   Lints **ADMIT, size 1, exit 0, no warnings** (read back after the edit that cleared
   `MISSING_STANDING_AUTHORITY`). It is a `-HOLD`; the armed count on disk is still **0**,
   re-measured after writing.
2. **ADVANCED the rotation:** `node scripts/pipeline/next-sweep.mjs --advance --utc
   2026-08-30T06:11:04Z`. Read back: `sweep-rotation.json` now `last_index: 1`,
   `last_run_utc: 2026-08-30T06:11:04Z`, `last_station: 04-scanner`, and shows ` M` in
   `git status`. **This file is tracked and needs committing** — if it is not, the next 04 run
   repeats `instrument-honesty` and the rotation silently stops.
3. **This breadcrumb.**

No board mutation. Nothing armed, disarmed, renamed, moved or deleted. No `sot/` write.
No `git checkout` / `reset` / `stash pop` / `clean`. Nothing staged in the shared index
(`git diff --cached --name-status` was empty at start and I added nothing to it).

## FINDINGS

### F1 — DOCTRINE §9.5 carries a claim that #1400 refuted six hours after it was written

`DOCTRINE.md:440` says `pr-dns-s5-checker-flip-to-fail-HOLD` *"carries **neither** marker, so it
is invisible to the linter and to any grep built on them."*

Re-measured at `077ea6bc`: the prompt on `origin/main` **does** carry
`<!-- watcher: do-not-arm -->`, and `lint-prompt.mjs` REJECTs it `[HUMAN_GATE_PRESENT]` at
line 2, exit 1. Positive control in the same run: `pr-bp-s2-worth-chasing-view-HOLD.md` →
ADMIT exit 0, so the linter can still pass and the REJECT is a real reading. #1400 merged
2026-08-30T04:17:19Z and added the marker.

This is the drift the sweep is defined to catch — *a trap fixed upstream that still reads as
live*. It errs safe (it overstates risk), but it sits inside the `instruments v2`
CANONICAL-BLOCK, whose entire job is to be the one place a station can trust. A reader who
checks it, finds it false, and downgrades §9 as a whole is the expensive outcome. The census in
the same paragraph is also stale: 59 depth-1 prompts now, not 61, so `## STANDING AUTHORITY` is
51 of 59.

**DISPOSITION: DISPATCHED → Station 00.** Station 00 landed the last DOCTRINE correction itself
(breadcrumb `00-00-supervisor-2026-08-29-1609-the-doctrine-fix-was-mine-to-land-not-marcos-to-approve.md`),
so it can either hand-land this or arm the prompt I staged —
`pr-doctrine-s9-two-refuted-claims-HOLD.md` carries the exact replacement text, the re-measured
census, and the `_canonical-blocks.json` hash re-record (`instruments` sha `2edc6347fb6ab1b2`)
that `lint-station.mjs` requires in the same commit. Both paths are open; I forced neither.
**Not armed** — arming is 00's on Marco's authority, and the standing OAuth block is not mine
to read past.

### F2 — DOCTRINE §9.3 names the wrong instrument as the cause of a real defect

`DOCTRINE.md:397` says *"`Compare-Object` reports PHANTOM differences between two
BYTE-IDENTICAL files"*, citing 100 differences on two copies of `03-machine-minder.md`.

**The 100 is real and I reproduced it exactly. The attribution is wrong.**

```
NEGATIVE CONTROL — genuinely byte-identical pair (Copy-Item):
  git hash-object  7771f49fa492fc168dec1339fed114b0d42e607e  (both)   bytes 20489 / 20489
  Compare-Object (Get-Content src) (Get-Content copy)   ->   0 differences

THE REPRODUCTION — the shape the original measurement actually had:
  git show origin/main:docs/pipeline/stations/03-machine-minder.md > dump
  bytes 40980 (exactly 2x)   first 4 bytes  ff fe 2d 00   = UTF-16LE BOM
  git hash-object dump  c6f0b1fe1c47465301e0961ecd4ad2fe493f015b   (differs)
  Compare-Object (Get-Content src) (Get-Content dump)   ->   100 differences
  git diff --stat origin/main -- <path>                 ->   empty
```

285 source lines, 100 reported differences, on a file `git diff` calls unchanged. The cause is
**PowerShell's `>` redirection, which emits UTF-16LE in PS 5.1** — the same family as the
`Set-Content -Encoding UTF8` bullet one line above it, which §9.3 already documents correctly.
Compare-Object returns 0 on a genuinely identical pair.

Why this matters beyond pedantry, and it is the RULE 1 half: as written, the doctrine immunises
exactly one command against a cause that will equally corrupt a grep, a line count, a hash, or a
node read of **any** blob dumped with `>`. Naming the redirection protects every downstream use
and costs nothing; naming Compare-Object protects one and leaves the rest exposed. The
operational advice already in the bullet (use `git diff` / `git hash-object` / `Buffer.compare`)
is correct and should stay.

**DISPOSITION: DISPATCHED → Station 00**, in the same staged prompt as F1 (one canonical-block
edit, one hash re-record, one commit — splitting them red-fails `lint-station.mjs`).

### F3 — `Select-Object -First N` on a native command makes a SUCCESS read as a FAILURE

Not in §9, and it bit me twice this run before I caught it.

`node scripts/pipeline/next-sweep.mjs --advance --utc 2026-08-30T06:11:04Z | Select-Object
-First 6` printed no `advanced:` line and left `$LASTEXITCODE = -1`. Read as written, that is
"the advance failed". **It did not fail.** `Select-Object -First N` closes the pipeline early,
which terminates the native process, and `$LASTEXITCODE` reports the kill, not the outcome.
Positive control: `sweep-rotation.json` on disk shows `last_index: 1` and
`last_run_utc: 2026-08-30T06:11:04Z` — the write completed. Second control: capturing the same
kind of command into a variable (`$out = (node ... 2>&1)`) returned the true `EXITCODE=0`.

Exact §9 shape — a failed/aborted call read as a meaningful answer — and the danger is
symmetric: it can equally make a **failure** look truncated-but-fine. The cure is one line:
assign the output, then read `$LASTEXITCODE`, then slice the variable. Every `| Select-Object
-First N` in a station script that also reads an exit code is suspect.

**DISPOSITION: DEFERRED.** Real and reproducible, but it belongs in the same §9 edit rather
than a second competing prompt, and I am at my staging limit for a defect I found in my own
harness rather than in the pipeline's. It becomes urgent the moment any *committed* script under
`scripts/pipeline/` pipes a native command through `Select-Object` and then branches on
`$LASTEXITCODE` — I did not sweep for that this run, and that grep is the trigger.

### F4 — re-confirming, not re-raising: Station 06 is absent from the freshness instrument

`check-breadcrumb.mjs --freshness` printed 00, 02, 03, 04, 05 and **no 06** — 02 appears as
"dispatch-only — no cadence to miss", 06 appears not at all. Consistent with the standing
open item that `CADENCE` has no `'06'` key. Recording the second independent sighting so it
does not read as a fresh discovery.

**DISPOSITION: DEFERRED** — already an open escalation with Marco; re-raising it would be
noise, and it is not mine to answer.

## WHAT I DID NOT DO

- **Armed nothing.** Armed count on disk was 0 at start and 0 at end, re-measured. The standing
  OAuth block says arm nothing, and arming is 00's lane regardless.
- **Committed and pushed nothing.** 04 is read-only on the board. The staged prompt, the
  rotation file and this breadcrumb are all sitting uncommitted in the dev tree for 00.
- **Did not mint a worktree.** The AUTHORITY section forbids it; every read was `git show` /
  `ls-tree` against `origin/main` at a named SHA.
- **Did not edit DOCTRINE directly**, though I am the station that measured both defects. It is
  a canonical block gated by `lint-station.mjs`, the edit must ship with a re-recorded hash, and
  my lane is staging plus reporting. The prompt carries everything needed to land it.
- **Did not touch `pr-doctrine-s9-four-false-traps-LOOPING.md`.** Its premise is dead, it is
  untracked, it matches no watcher glob, and it is correctly defused. Reviving or folding into
  it is how the earlier loop happened.
- **Did not run Part 0 or Part 2** (static cross-layer audit, live-site visual patrol). The
  station contract is one named sweep per run, covered completely; the rotation named
  `instrument-honesty` and I spent the run on it.
- **Did not chase §9.2's glob sub-claim further.** My positive control failed, so I stopped and
  reported `[CANNOT MEASURE]` rather than substituting an inference.
- **Did not go near** Azure / Entra / SharePoint, `/sot/`, production data, the watcher clone,
  or `metadata-catalog.json`.
