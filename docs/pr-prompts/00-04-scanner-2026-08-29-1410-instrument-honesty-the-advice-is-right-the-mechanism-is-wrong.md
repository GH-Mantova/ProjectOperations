# Station 04 — Scanner | 2026-08-29T14:10Z–2026-08-29T14:22Z

## GROUND

```
UTC            2026-08-29T14:10:51Z
origin/main    fb3cc64b            (git fetch origin, then rev-parse origin/main)
dev tree       main @ 1501d09c     C:\ProjectOperations2  (6 behind origin/main, 0 ahead)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter, read from origin/main)
bootstrap      1                   (station_doc_version in the scheduled-task SKILL.md)
```

Versions agree — full authority, not read-only.

Sweep this run: **`instrument-honesty`** (`node scripts/pipeline/next-sweep.mjs` →
`SWEEP: instrument-honesty`, `rotation position 2 of 4; previous run: 2026-08-29T10:18:55Z`).

**Headline.** I executed every DOCTRINE §9 trap that can be executed. **The advice held in every
single case. The stated MECHANISM was wrong in five of them** — and a wrong mechanism is not
harmless: in §9.3 it names the SAFE command as the culprit and omits the one that actually does
the damage, so a reader auditing a script will condemn correct code and bless the defect.

`docs/pipeline/DOCTRINE.md` is byte-identical between the dev tree and `origin/main`
(`git hash-object` = `git rev-parse origin/main:…` = `19d59ee0`), so every §9 quotation below is
current on main, not a dev-tree artefact. `[MEASURED]`

## WHAT I MEASURED

**Reachability.** `start_process` shell `powershell.exe` → PID 13040. **Not blind.** `[MEASURED]`
Host: PS **5.1.26100.9168**, git **2.55.0.windows.3**, node 24.14.1, Desktop Commander **0.2.47**.

### The §9 scoreboard — 24 claims, one line each

| § | claim | verdict |
|---|---|---|
| 9.1 | `$` STRIPPED from `-Command` | **MECHANISM WRONG — it is EXPANDED, and can succeed silently** |
| 9.1 | output PAUSES on lines starting with `#` | **DOES NOT REPRODUCE** (DC 0.2.47) |
| 9.1 | blocked: `net sc reg netsh takeown shutdown` | true but **6 of 33** in the live blocklist |
| 9.2 | `ls-tree` without `-r` returns ONE line | **MECHANISM WRONG — depends on the trailing slash** |
| 9.2 | `git status` blind to gitignored | **REPRODUCES** (0 vs 3579) |
| 9.2 | remedy: `check-ignore -v` | **the remedy has the disease** — see F1(e) |
| 9.2 | git 2.55 plain fetch updates `origin/main` | consistent (refspec `+refs/heads/*:…`) `[INFERRED]` |
| 9.2 | stash in the clone is a closed loop | **51**, flat since 2026-08-29T02:1xZ `[MEASURED]` |
| 9.3 | `Get-Content` reports FALSE MOJIBAKE | **REPRODUCES** — and my first probe missed it (F4) |
| 9.3 | `Get-Content -Raw \| Set-Content` double-encodes + BOM | **DOES NOT REPRODUCE — inverted** |
| 9.4 | `--jq` escaped quotes break, spaces survive | **REPRODUCES VERBATIM** |
| 9.4 | piping JSON into `Where-Object` collapses to ONE | **REPRODUCES** (piped 1 vs true 5) |
| 9.4 | `gh run list --branch main` can be DAYS stale | not stale now; claim is a "can" — unfalsified |
| 9.4 | GitHub MCP token cannot merge / open PRs | **`[CANNOT MEASURE]`** — testing it means a write |
| 9.4 | `mergeStateStatus: CLEAN` can still be refused | **`[CANNOT MEASURE]`** — 0 open PRs |
| 9.5 | lint waives every gate when **`gh`** is missing | **WRONG BINARY — it is `git`** (F2) |
| 9.5 | the linter **cannot see** do-not-arm markers | **STALE — it can, since #1374-era** (F3) |
| 9.5 | `STOP-WATCHER-LANE2` present by design | **CONFIRMED** — and it lives OUTSIDE the repo |
| 9.5 | the heartbeat only ticks mid-run | **`[CANNOT MEASURE]`** — my probe found only the script |
| 9.5 | never count or kill by image name | **REPRODUCES HARD** — 17 `node.exe`, exactly 1 watcher |
| 9.6 | an empty result is not an empty world | **demonstrated three times, on myself** (F4) |

### The four measurements the findings rest on

**(1) `$` is EXPANDED, not stripped — and the command can SUCCEED.** `[MEASURED]`

```
start_process -Command "$PSVersionTable.PSVersion.ToString(); $x = 7; ..."
  -> parser error, and the text reads: System.Collections.Hashtable.PSVersion.ToString();  = 7
start_process -Command "... 'A=' + $true + ' B=' + $null + ' C=' + $PID ..."
  -> the text reads:      'A=' + True + ' B=' +  + ' C=' + 37276          (37276 = the new PID)
start_process -Command "Write-Output ('THE-COMMAND-SUCCEEDED...: ' + $PID)"
  -> THE-COMMAND-SUCCEEDED-WITH-A-SUBSTITUTED-VALUE: 14712     <- exit 0, NO error at all
```

`$true`→`True`, `$PID`→a real number, `$null`/`$env:…`/undefined→empty. That is substitution, not
deletion. DOCTRINE promises a loud parser error; the third line above is the case it does not
mention — **a command that runs clean and quietly uses a value the author never wrote.**
CONTROL: the identical string through `interact_with_process` resolved correctly
(`CONTROL-interact: 5.1.26100.9168 true=True`), so the defect is the `-Command` layer, not the host.

**(2) `ls-tree -r` — the 2×2 that dismantles the stated mechanism.** `[MEASURED]`

```
pathspec='docs/pr-prompts '  r=''    lines=1     HOLDmatches=0     <- the trap DOCTRINE describes
pathspec='docs/pr-prompts '  r='-r'  lines=540   HOLDmatches=61
pathspec='docs/pr-prompts/'  r=''    lines=218   HOLDmatches=61    <- no -r, and CORRECT
pathspec='docs/pr-prompts/'  r='-r'  lines=540   HOLDmatches=61
```

Three of four forms answer correctly. The variable DOCTRINE names (`-r`) is half the story; the
**trailing slash** — which §9.2 never mentions — is the other half. The honest rule has two faces:
without `-r` you get exactly the level `ls-tree` listed, so (a) *no trailing slash* lists the tree
entry itself (1 line), and (b) *any filter deeper than that level reads zero* — measured,
`superseded/*.md` = **0 without `-r` vs 247 with**, `needs-marco/*.md` = **0 vs 1**.
`git ls-tree --name-only origin/main -- docs/pr-prompts` → the single line `docs/pr-prompts`.

**(3) The encoding pair — the reader lie is REAL, the writer lie is INVERTED.** `[MEASURED]`

Source file written by node: `em dash — end\n` = **16 bytes**, `… 20 e28094 20 656e64 0a`.

*Read half* (§9.3 bullet 1, §7 lie #2) — **CONFIRMED LIVE**:

```
Get-Content -Raw  .Length = 16      (14 would mean UTF-8; 16 = one char per byte = CP1252)
contains U+2014 (em dash) = False
contains U+00E2 (a-hat)   = True    <- the mojibake is in the READER
```

*Write half* (§9.3 bullet 3) — **the named command is the SAFE one**:

```
          bytes  first 20 bytes (hex)                        BOM    doubleEncSig  emdash
src       16     656d206461736820e2809420656e640a            false  0             true
default   18     656d206461736820e2809420656e640a0d0a        false  0             true   <- Set-Content
utf8      26     efbbbf656d206461736820c3a2e282ace2809d20    TRUE   1             FALSE  <- -Encoding UTF8
outfile   26     efbbbf656d206461736820c3a2e282ace2809d20    TRUE   1             FALSE  <- Out-File -Encoding utf8
```

`Get-Content -Raw | Set-Content` (exactly the command DOCTRINE blames) is **byte-lossless for
content** — the em dash survives as `e28094`; the only change is `0d0a` (CRLF) and a trailing
newline, +2 bytes. It is lossless *because* a CP1252 read followed by a CP1252 write round-trips.
The damage needs an explicit UTF-8 **write**: `Set-Content -Encoding UTF8` and `Out-File -Encoding
utf8` both produced a BOM and `c3a2 e282ac e2809d` — the `U+00E2 U+20AC U+201D` signature §9.3
itself names — and destroyed the em dash. **So the doctrine currently tells a reviewer to flag the
harmless form and says nothing about the two forms that cause the 133-sequence damage it cites.**

**(4) The linter can see human gates now; the wrong binary is still named.** `[MEASURED]`
`git show origin/main:scripts/pipeline/lint-prompt.mjs`:

```
439: function readFromOriginMain(path, repoRoot) {
440:   const gitBin = process.env.LINT_GIT_BIN || "git";
442:     return execFileSync(gitBin, ["show", "origin/main:" + path], {
457:     return null; // git broken - skip check, fail SAFE
728: const DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i;
730: const DO_NOT_ARM_CAPS = /DO NOT ARM/;
743: "HUMAN_GATE_PRESENT: line " + lineNum + " contains <!-- watcher: do-not-arm --> marker.\n"
```

`readFromOriginMain` feeds all five gate probes (492, 563, 826, 865, 903) and spawns **`git`**.
`gh` is nowhere in it. Human-gate census over the **61** depth-1 `-HOLD`/`-ready` on `origin/main`:
`<!-- watcher: do-not-arm -->` = **5** (`pr-doctrine-s9-gh-vs-git-waiver`, `pr-nav-jobs-projects-merge`,
`pr-ops-m2b-tipping-tab-reminder`, `pr-siteid-notnull-backfill`, `pr-vendor-invoice-ocr`) ·
literal `DO NOT ARM` = **4** (`pr-524-rates-b-slice2-canonical`, `pr-ops-m2b-tipping-tab-reminder`,
`pr-retire-tenderclientnote-s2`, `pr-vendor-invoice-ocr`) · **union = 7 distinct.**
`## STANDING AUTHORITY` = **51 of 61** — boilerplate on 84% of the board, confirming for the ninth
time that it is not a gate.

### Supporting readings

**`git status` vs gitignored (§9.2).** `git status --porcelain -uall` over
`docs/pr-prompts/processed/` → **0** lines; `git ls-files --others --ignored --exclude-standard`
over the same path → **3579**. POSITIVE CONTROL on the same command: porcelain *does* list
non-ignored untracked files (`?? docs/pr-prompts/.arming-log.txt`, `?? …-2209-oauth-still-dead…`).
The instrument answers both ways, so the zero is a real blindness. **TRAP STILL TRAPPED.** `[MEASURED]`

**A `??` in the dev tree is NOT an uncommitted file.** `[MEASURED]` The porcelain control above
listed `00-00-supervisor-2026-08-28-2209-…md` as `??`. It is **tracked on `origin/main` (True)** and
absent from **dev HEAD (False)** — because the dev tree is 6 commits behind, not because anyone
failed to commit it. Earlier runs have counted "uncommitted breadcrumbs" from exactly this shape.
Age a breadcrumb against `origin/main`, never against the dev tree's working state.

**`--jq` through the shell (§9.4), verbatim reproduction.** `[MEASURED]`

```
--jq '.[] | .number'          -> 1392 / 1391          (spaces survive, as documented)
--jq '[.[].number] | join(\",\")'
   -> failed to parse jq expression (line 1, column 21)
          [.[].number] | join(,\)
                              ^  unexpected token ","
```

**`Where-Object` collapse (§9.4).** `gh pr list … --limit 5 --json number,state`: true count **5**;
`$raw | ConvertFrom-Json | Where-Object {…}` → **1**; assign-then-`Where-Object` → **5**.
The collapse is live on this box. `[MEASURED]` *(This refutes a "did not reproduce on PS 5.1" note
carried from an earlier run — the guidance was kept anyway, so nothing was acted on wrongly.)*

**Image-name trap (§9.5).** `Get-CimInstance Win32_Process -Filter "Name='node.exe'"` → **17**
processes. Exactly **one** is the watcher: pid **26364**,
`node.exe --no-deprecation C:\po-watcher\ProjectOperations\scripts\pr-watcher\index.mjs`. The other
16 are MCP servers under `npm-cache\_npx`. A count-by-name would be wrong by 16. `[MEASURED]`

**Sentinels (§9.5).** `STOP-WATCHER-LANE2` exists at **`C:\po-watcher\STOP-WATCHER-LANE2`**
(mtime 2026-08-18T04:44:50Z) — **present by design, confirmed.** `STOP-WATCHER` itself: absent
(the normal state — no stop is asserted). 25 references across four launchers, all in
`C:\po-watcher\*.ps1`, incl. `ensure-watcher.ps1:20` carrying the discriminating warning in source:
*"test ONLY 'STOP-WATCHER'. 'STOP-WATCHER-LANE2' is a DIFFERENT file…"*. `[MEASURED]`

**Blocked commands (§9.1).** Live Desktop Commander blocklist has **33** entries. All six DOCTRINE
names are in it; it also blocks `sfc bcdedit runas cipher diskpart format dd sudo su passwd reboot
halt poweroff init iptables firewall` and the user-management set. The doctrine list is a sample,
not the list. `[MEASURED]` (read from `get_config`, not by running them)

**Stash growth (§9.2).** `git -C C:\po-watcher\ProjectOperations stash list` → **51**. Identical to
the 2026-08-29T02:1xZ reading — **not growing** over ~12 h. `[MEASURED]` (read-only; no `pop`, no `drop`)

## WHAT CHANGED

**Nothing on the board.** No prompt staged, armed, renamed, moved or deleted; no prompt edited; no
`git` write of any kind; no merge. `git diff --cached --name-status` → **0 lines at 14:10Z and 0
lines at 14:18Z** — the dev-tree index is shared and it was clean when I arrived and clean when I
left. `origin/main` fb3cc64b at both stamps; dev HEAD 1501d09c untouched. `[MEASURED]`

Written outside the queue: this breadcrumb, four scratch `.ps1` probes and four throwaway encoding
fixtures under `C:\po-sup-fix-scripts\` (untracked, outside the repo), and two `origin/main` blob
extracts under `C:\tmp\`. `docs/pipeline/sweep-rotation.json` advanced 2→3 per the station doc; it
is **modified, not staged**, and must be committed together with this breadcrumb by the next board PR.

## FINDINGS

### F1 — DOCTRINE §9's advice is right and its MECHANISM is wrong in five places; one of the five names the safe command as the culprit `[MEASURED]`

Folded into one finding because the five share a single pattern and a single fix (one edit to
`docs/pipeline/DOCTRINE.md`). Blast radius: §9 is a CANONICAL-BLOCK — every station points at it and
none copies it, so one PR corrects all six stations at once.

**(a) §9.1 `$`** — says *stripped*, dies with a parser error. Measured: **expanded**, and
`Write-Output ('…' + $PID)` **exited 0 and printed a substituted value**. The silent-wrong-value
case is the dangerous one and is currently undocumented.
→ *"`$` is EXPANDED by the `-Command` layer before PowerShell parses it — `$true`→`True`,
`$PID`→the new process's PID, undefined and `$env:` forms→empty. Usually this dies as a parser
error; sometimes it produces a VALID command carrying a value you never wrote, and exits 0.
`interact_with_process` does not do this. Anything containing `$` goes in a `.ps1` run with `-File`."*

**(b) §9.2 `ls-tree`** — says "without `-r` returns exactly ONE line". Measured: 1 line only when the
pathspec has **no trailing slash**; with a slash it returns 218 and a depth-1 filter is **correct**.
→ *"`ls-tree` without `-r` returns exactly the level you asked for. `-- <dir>` (no slash) returns the
tree entry itself, ONE line. `-- <dir>/` returns that directory's direct children — correct for a
depth-1 filter, and ZERO for anything deeper (measured: `superseded/*.md` 0 vs 247). Always `-r`, and
always control the query against a file you know is tracked."*

**(c) §9.3 write half — the inversion, and the one to fix first.** DOCTRINE blames
`Get-Content -Raw` piped to `Set-Content`. Measured: that pipeline is **byte-lossless for content**
(+2 bytes of CRLF only, em dash intact). The BOM and the `c3a2 e282ac e2809d` double-encode came
from **`Set-Content -Encoding UTF8`** and **`Out-File -Encoding utf8`**, which DOCTRINE does not
name. As written, the doctrine sends a reviewer to flag the harmless form and leaves the two
damaging forms unmentioned — and invites "fixing" a plain `Set-Content` by adding `-Encoding UTF8`,
which is the actual cause of the 133 damaged sequences it cites.
→ *"`Set-Content -Encoding UTF8` and `Out-File -Encoding utf8` double-encode (BOM + `â€"`) because
PS 5.1 has already decoded the file as CP1252. Plain `Set-Content` round-trips the bytes but
rewrites line endings. Neither is a safe way to edit a doc: use node `readFileSync`/`writeFileSync`."*

**(d) §9.1 `#` pause** — did not reproduce on DC 0.2.47: `BEFORE-HASH / # heading / ## another /
AFTER-HASH-SENTINEL` all returned in the first read. Early returns with output still pending **are**
real (one happened to me this run, on a line with no `#`), so keep the remedy and drop the cause.

**(e) §9.2 remedy carries the disease** — §9.2 offers `git check-ignore -v` *or* `git ls-files
--others --ignored`. Measured on the obvious target, the folder:
`git check-ignore -v docs/pr-prompts/processed` → **no output, exit 1** ("not ignored"), same with a
trailing slash; on a **file inside** it → `.gitignore:76:docs/pr-prompts/processed/` exit 0. A
reader who reaches for the first remedy and tests the directory gets a confident, wrong "not
ignored" — §9.6's own failure, sitting inside §9.2's cure.

**DISPOSITION: DISPATCHED → Station 00.** Replacement text for (a)–(e) is above, ready to paste;
nothing needs re-deriving. Land it in the same PR as F2 so §9 is corrected once.

### F2 — §9.5 still names `gh` as the binary whose absence waives every gate. It is `git`. Third run, fix staged, nothing has moved. `[MEASURED]`

`origin/main:docs/pipeline/DOCTRINE.md` still reads *"`lint-prompt.mjs` does NOT reject when `gh`
is missing"*. `origin/main:scripts/pipeline/lint-prompt.mjs:439-459` reads
`const gitBin = process.env.LINT_GIT_BIN || "git"` → `execFileSync(gitBin, ["show", "origin/main:"+path])`
→ on failure `return null; // git broken - skip check, fail SAFE`. **`gh` appears nowhere in the
function**, and it feeds all five gate probes (492, 563, 826, 865, 903).

Two consequences the current text hides: the pre-flight *"confirm `gh` resolves before believing any
ADMIT"* **proves nothing**, and "fail SAFE" is safe only against wrongly binning a prompt — with
respect to **arming** it fails OPEN, because a skipped gate is an ADMIT.

First reported 2026-08-28T22:10Z; the fix has been staged since as
`docs/pr-prompts/pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` (tracked on `origin/main`, verified this
run). It has not moved in ~16 h, and it will not move on its own: it is one of the **5** prompts
carrying `<!-- watcher: do-not-arm -->`, so the linter now stops it by design, and the standing OAuth
block says arm nothing regardless.

**This is Marco's call and it is one question.** RULE 1 — *complete immediately and in future,
without damaging existing or future data entry:*

- **(C) — passes both halves. Fold F1(a)–(e) into `pr-doctrine-s9-gh-vs-git-waiver-HOLD.md` and
  clear its do-not-arm marker in the same breath**, so one PR corrects every wrong mechanism in §9
  at once. Complete (all six stations, one canonical block), additive (documentation only — no
  prompt is consumed, no queue file is deleted, no data path is touched). Needs Marco because
  clearing a human gate marker is his alone, and because 04 may not edit another actor's prompt.
- **(A) Marco pastes the corrections into DOCTRINE.md by hand.** Fixes now; fails the *future* half
  — the same drift recurs, and the staged prompt stays parked carrying a stale premise.
- **(B) Stage a second `-HOLD` for F1 and leave both parked.** Fails both halves: nothing lands, and
  it adds a second unarmable prompt to a board where 61 already sit.

**DISPOSITION: ESCALATED.**

### F3 — §9.5's "the linter cannot see human gates" is STALE. It can. Station 00's arming detector should read the linter, not re-grep it. `[MEASURED]`

§9.5 says *"read the BODY for `<!-- watcher: do-not-arm -->` or a `DO NOT ARM` line — **the linter
cannot see them.** Measured: 8 prompts carrying one still linted ADMIT."* That is no longer true of
the code: `lint-prompt.mjs` on `origin/main` defines `DO_NOT_ARM_COMMENT` (line 728,
case-insensitive) and `DO_NOT_ARM_CAPS` (line 730, case-**sensitive**) and emits
`HUMAN_GATE_PRESENT: line N contains …` at 743 and 755.

The **advice** survives intact and must not be relaxed — a *prose* human gate matches neither
regex, which is exactly how an arm was burned on 2026-08-28T14:09Z. But the stated **reason** is
dead, and a trap that has been fixed upstream while still reading as live is drift by this sweep's
own definition.

What this buys Station 00: the two literal markers no longer need a hand-rolled grep — `lint-prompt`
reports them by name. Measured union today, over 61 depth-1 `-HOLD`/`-ready` on `origin/main`:
**7 distinct prompts** (5 comment-marker, 4 caps, 2 carrying both). Two cautions that go with it:
`## STANDING AUTHORITY` appears on **51 of 61** and is boilerplate, not a gate; and
`pr-dns-s5-checker-flip-to-fail-HOLD` — which standing guidance says must never be armed — carries
**neither** marker, so it is invisible to the linter and to any grep built on these two tokens.

**DISPOSITION: DISPATCHED → Station 00**, as a correction to its RULE-4 arming detector and to
§9.5's second bullet. Same PR as F1/F2.

### F4 — My own first control was not discriminating and certified a LIVE trap as dead. Caught and corrected inside the run. `[MEASURED]`

My first encoding probe compared node's **byte** count (11116) against `Get-Content -Raw`'s
**character** count (11116) and counted `U+00A7` in both (2 and 2), and I read that as "clean". Both
comparisons are blind by construction: a CP1252 decode yields exactly one char per byte, so the
counts coincide **because** the reader is broken, and the regex for `U+00A7` matches the second byte
of the mangled pair. The re-run on a purpose-built 16-byte fixture — string length, `U+2014` present,
`U+00E2` present — separated the two hypotheses in one line and showed the reader mangling.

The same shape bit me twice more and both were caught the same way: a `check-ignore` on a folder
reading "not ignored", and `Select-String` over `scripts\*` returning **0** references to
`STOP-WATCHER` when the true answer is **25** — in `C:\po-watcher\*.ps1`, outside the glob I chose.
Widening before asserting turned a false "nothing reads the sentinel" into a confirmation.

**DISPOSITION: ACTIONED** — no reading in this breadcrumb rests on the three defective probes; each
was replaced by a discriminating one and both results are quoted above. Recorded because §7 asks for
the failures, and all three were mine, in a sweep whose entire subject is instruments that lie.

## WHAT I DID NOT DO

**I staged no prompt, and that is deliberate.** 04 may stage a lint-clean `-HOLD`, and F1 is exactly
the kind of finding that usually earns one. I did not, for two reasons that both point the same way:
a §9 fix prompt **already exists** (`pr-doctrine-s9-gh-vs-git-waiver-HOLD.md`), so a second one
would split one doc edit across two PRs; and it carries `<!-- watcher: do-not-arm -->`, which I may
not clear and may not edit around — the station doc is explicit that the scanner never edits the
prompt under critique. Staging a second unarmable prompt onto a board already holding 61 would be
motion, not progress. The replacement text is in F1 instead, so whoever lands it types nothing new.

**I did not test the two §9.4 GitHub claims that require a write.** "The GitHub MCP token cannot
merge, and cannot open PRs (403)" and "`mergeStateStatus: CLEAN` can still be refused" are both
`[CANNOT MEASURE]` here — the first because proving it means attempting a merge or a PR, which is
outside my lane and irreversible if it were to succeed; the second because the board has **0 open
PRs**. Neither is reported as confirmed or as refuted.

**I did not measure the watchdog heartbeat age.** §9.5's "the heartbeat only ticks MID-RUN" needs a
mid-run observation, and my probe found only `C:\po-watcher\watcher-heartbeat-window.ps1` (a script,
mtime 2026-07-24T06:43Z) rather than the heartbeat datum. Rather than quote a script's mtime as a
heartbeat age — which is precisely the §7 mistake this sweep exists to catch — I am recording
`[CANNOT MEASURE]` and leaving it to Station 03, which owns watcher liveness.

**I did not touch the destructive §9.2 entries.** `git checkout .`, `reset --hard`, `stash pop` and
`git clean` are documented by their consequences and cannot be "tested" without resurrecting dead
prompts. Same for the device-bridge `index.lock` trap: reproducing it would freeze every station.
Both remain accepted on the record of the incidents that produced them.

**I did not run `status-sweep.ps1` §3b, and I ran no mutating script.** Nothing in this run merged,
rebased, armed, restarted the watcher, or wrote to `/sot/`. I read the watcher clone (`stash list`
only) and never wrote to it. `check-all-drift`, `check-sot-*` and the gate checkers belong to other
sweeps in the rotation and were left for them — this run covered `instrument-honesty` completely,
which is the contract, rather than covering everything shallowly.

**I did not re-raise anything already discharged.** The 23 spent HOLDs from the 10:10Z run were
retired to `superseded/` by Station 00 at 12:08Z (depth-1 count measured at **61** this run,
consistent with 83→61); the board trap, the dead-gate hunt and the spent-HOLD census belong to
`gate-liveness` and `repo-hygiene` and were not re-run.

**Rotation.** `docs/pipeline/sweep-rotation.json` advanced to position 3 — the next Station 04 run
takes **`repo-hygiene`**. The file is modified and unstaged in the shared dev tree; it must ride the
same commit as this breadcrumb or the rotation silently stops.

**Validator, with a negative control.** `node <origin/main copy of check-breadcrumb.mjs>` →
`structure: 96 checked, 0 malformed, 7 skipped as pre-contract` · **CLEAN, exit 0**. NEGATIVE
CONTROL first, because a validator never seen to fail is not a validator: a deliberately malformed
`…-9999-zz-negative-control.md` made the same run print `REJECT` naming all five missing sections and
**exit 1**; the control file was deleted and the re-run returned CLEAN, exit 0. `[MEASURED]`
🔴 The **dev tree's** `check-breadcrumb.mjs` is still the stale 9299-byte copy (`e9ff8f4e`) against
main's 10715 (`a97311ca`) — I ran main's copy, extracted with node as raw bytes.

**Note for the next encoding sweep:** this file contains exactly **one** `U+00E2 U+20AC` sequence and
it is **deliberate** — the literal `â€"` quoted inside F1(c) as the double-encode signature. Byte
read-back of this breadcrumb: 24800 bytes, **no BOM, 0 × U+FFFD**, 5 sections, 4 dispositions. It is
not damaged. `[MEASURED]`

**Concurrent actor seen, not disturbed.** The validator listed
`00-00-supervisor-2026-08-29-1409-blind-but-the-mount-cannot-see-the-oauth-token.md` as UNTRACKED —
Station 00 ran at 14:09Z, one minute before me, and ran **BLIND**. Our writes did not collide:
`git diff --cached --name-status` was 0 lines at both my stamps. Its findings are 00's to carry;
I did not read into its lane.
