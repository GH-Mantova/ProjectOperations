# Station 04 - Scanner | 2026-08-30T14:09:54Z-2026-08-30T14:21Z

## GROUND

```
UTC            2026-08-30T14:09:54Z
origin/main    4461c8be            (git fetch origin, then rev-parse)
dev tree       main @ 4461c8be     C:\ProjectOperations2   (converged, 0 ahead 0 behind)
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md L4)
```

Versions AGREE. SIGHTED run - Desktop Commander present, `start_process` shell PID 18156 on the
first call. This was not a quiet blind run.

🔴 **`origin/main` MOVED MID-RUN: `4461c8be` -> `757450b6`** (measured 14:19:44Z; the dev tree was
fast-forwarded by a concurrent chat and is converged, `rev-list --left-right --count` = `0 0`). Every
measurement below was taken at `4461c8be` and is stamped as such. **I re-verified F2's central claim
against the new head before publishing:** the `.gitignore` line table is byte-for-byte unchanged at
`757450b6`, and `lint-station.mjs` still returns `ADMIT: all 7 docs clean`, exit 0. F1's and F5's
claims are about files outside the repo and about `check-breadcrumb.mjs:36`, neither touched by that
merge. **Anything in this report NOT re-stamped to `757450b6` is a lead, not a finding.**

**Sweep this run: `instruction-drift`** (rotation position 4 of 4; previous run 2026-08-30T10:10:48Z).
`node scripts/pipeline/next-sweep.mjs` chose it, not me.

## WHAT I MEASURED

- **[MEASURED] The dev tree's copy of all three binding docs is byte-identical to `origin/main`.**
  `git diff --stat origin/main -- docs/pipeline/` returned EMPTY and `git status --porcelain` on the
  three files returned empty. The 08-29 trap (a station served a superseded copy of its own
  instructions from the dev tree) does NOT apply to this run - so reading them from disk was safe,
  and I say so rather than leaving the reader to assume.
- **[MEASURED] `node scripts/pipeline/lint-station.mjs` -> `ADMIT: all 7 docs clean`, exit 0.**
  One advisory only: `04-scanner.md` "names a Windows path outside the known folder map:
  `C:\po-scan-`". That string sits inside the SUPERSEDED, commented-out worktree block at
  04-scanner.md:388-397, which the doc itself already annotates as retired 2026-08-24. Not a defect.
- **[MEASURED] All five station bootstraps are byte-frozen at 2026-08-24T22:54:22Z.**
  `Get-ChildItem C:\Users\Marco\Claude\Scheduled -Recurse -File`: 00-supervisor 5340 B,
  02-board-driver 5337, 03-machine-minder 5315, 04-scanner 5276, 05-sot-keeper 5251. Unchanged since
  Station 00 measured the identical five byte counts on 2026-08-29T10:08Z.
- **[MEASURED] Bootstrap-vs-station-doc version parity is CLEAN, 5 of 5.**
  `node C:\po-sup-fix-scripts\scan-1409-bootstrap-drift.mjs`: each bootstrap points at exactly one
  `docs/pipeline/stations/*.md`, every one of those files exists, and `station_doc_version` reads `1`
  on both sides in all five pairs. `weekly-security-audit` has no `station_doc_version` and points at
  no station doc - it is not a pipeline station, so N/A is correct, not a defect.
- **[MEASURED] There is no `06-pr-master` directory under `C:\Users\Marco\Claude\Scheduled`.**
  The six directories present are the five stations plus `weekly-security-audit`, and
  `_retired-2026-08-18`. This is the file-system corroboration of the standing "06 has no cadence"
  escalation; I am recording it as evidence, not re-raising it.
- **[MEASURED] `lint-station.mjs` cannot see a bootstrap at all.** `Select-String` for
  `Scheduled` / `bootstrap` / `SKILL` over its 232 lines returns ZERO hits, and it is the ONLY file
  under `scripts/` whose name matches `bootstrap|station`. POSITIVE CONTROL, same file same run:
  `Select-String` for `station_doc_version` returns lines 117, 120, 168 - the instrument works, the
  absence is real. So the bootstrap header's own claim, *"gated by scripts/pipeline/lint-station.mjs"*,
  is true of the station DOC and false of the bootstrap. Nothing in CI or in any script reads the
  five files that actually open every scheduled run.
- **[MEASURED] 273 repo-relative path references across DOCTRINE, STATION-CAPABILITIES and the six
  station docs; 31 distinct did not resolve on `origin/main`.** `node scan-1409-path-resolve.mjs`,
  controls: tracked-set size 2725, known-tracked probe `docs/pipeline/DOCTRINE.md` -> true,
  known-absent probe `docs/pipeline/NOPE.md` -> false. **28 of the 31 are artefacts or by-design, and
  I checked each rather than reporting the raw count as drift:**
  - 12 are my own regex clipping a prose pattern (`docs/pr-prompts/00-`, `needs-marco/pr-`, `rev-`,
    `sot/01`, `sot/04`, `sot/01/02/03/05/06`, ...). Not paths.
  - 8 are gitignored-by-design and PRESENT on disk (`docs/qa/qa-findings.md`, `qa-checklist.md`,
    `qa-test-data-registry.md`, `docs/pr-prompts/failed`, `apps/api/.env`,
    `docs/data-model/relationship-map.{md,json}`, `apps/api/scripts/xero-import-report.md`).
    `git check-ignore -v` on each FILE (never on the directory - DOCTRINE 9.2) confirms the rule and
    its line. Controls: `docs/qa/qa-findings.md` -> ignored; `docs/pipeline/DOCTRINE.md` -> not.
  - 5 are absent but self-healing or prose: `docs/qa/qa-github-audit.md` and
    `docs/pr-prompts/triage-state.md` are both "create if absent";
    `docs/pr-prompts/AWAITING-MARCO-DECISION.md` is "overwrite each run"; `docs/design` at
    02-board-driver.md:262 is a PR-category label, not a path; `prisma/migrations` is shorthand for
    `apps/api/prisma/migrations`, which IS tracked. `docs/qa/Master-QA-...-Plan.md` is already
    annotated as deleted in 04-scanner.md:186. **None of these is a finding.**
  - The residue is F2 below.
- **[MEASURED] `docs/pr-prompts/queue-watch-state.md` exists on disk, is NOT tracked, and is NOT
  gitignored** - `git check-ignore -v` exits 1 on it while the control exits 0 on
  `docs/qa/qa-findings.md`. 00-supervisor.md:389 already flags it UNTRACKED in bold. Consistent; no
  finding.
- **[MEASURED] First-hand confirmation of the DOCTRINE 9.1 `$` trap, from this run's own first tool
  call.** `start_process` with
  `powershell.exe -NoProfile -Command "... $PSVersionTable.PSVersion.ToString() ..."` came back as a
  parser error quoting `System.Collections.Hashtable.PSVersion.ToString()`. The `$PSVersionTable`
  token was **EXPANDED to its value** before PowerShell parsed it. It was not stripped. See F3.

## WHAT CHANGED

- **Nothing on the board.** No arm, no disarm, no rename, no move, no merge, no label. Armed count
  `*-ready.md` at depth 1 = **0** at start and at end. `git diff --cached --name-status` EMPTY at
  start and at end.
- **Nothing in `C:\Users\Marco\Claude\Scheduled\`.** Read-only, plus one dry run that writes nothing.
- **Nothing under `sot/`, `apps/`, or `scripts/`.**
- **Authored in the sanctioned scratch dir `C:\po-sup-fix-scripts\`** (outside the repo, not staged):
  `scan-1409-bootstrap-drift.mjs`, `scan-1409-path-resolve.mjs`, `scan-1409-classc.mjs`,
  `scan-1409-cites.mjs`, `scan-1409-gitignore-lines.mjs`, `scan-1409-critique.mjs` - all read-only
  probes, each with its own positive control.
- **This breadcrumb**, written to the dev tree at a tracked path. It is UNTRACKED until a board PR
  commits it - **Station 00, please sweep it up.**
- **`docs/pipeline/sweep-rotation.json`**, advanced (see the last WHAT I MEASURED line of F4).

## FINDINGS

---

### F1 (S2) - the refuted blindness diagnostic still governs every scheduled run, 28 h after the fix for it was written, dry-run clean, and left unrun

**All five bootstraps still carry, at L25:** *"If this station appears in the scheduled-task listing,
it is cloud-fired and structurally cannot reach the box."*

`origin/main` records that claim as REFUTED, in both directions, in two separate binding places:
`STATION-CAPABILITIES.md:58` (*"That is REFUTED, in both directions"*, with measurements from
2026-08-28/29) and the canonical preflight block replicated in all six station docs (*"There is no
diagnostic short of trying. The scheduled-task listing predicts nothing, in either direction"*).

**[MEASURED] It was false about THIS run, and I can prove it from my own prompt.** My opening turn
inlines `04-scanner\SKILL.md` verbatim; Station 04 IS a scheduled task; and `start_process` reached
the box on the first call. The instruction governing STEP 1 of every scheduled run is contradicted by
the run it was governing. That is the second consecutive station to be able to say this - Station 00
said it of itself on 2026-08-29T10:08Z.

**Why this is not a re-file of a known finding.** It has been reported at least three times
(`00-04-scanner-2026-08-29-0610`, `00-04-scanner-2026-08-29-2210`, `00-00-supervisor-2026-08-29-1008`).
The NEW fact is the closure failure, and it is measurable:

- **[MEASURED] The fix exists and still works.** `C:\po-sup-fix-scripts\fix-station-bootstraps.mjs`,
  4405 bytes, last written 2026-08-29T10:13:19Z. I re-ran its dry mode this run per the DOCTRINE 7.1
  re-read rule: **all five anchors still match**, `changed=0 already-clean=0 not-touched=0`, exit 0,
  nothing written, each file would go 5340->5905, 5337->5902, 5315->5880, 5276->5841, 5251->5816 B.
  The positive control DOCTRINE 7 guard 1 demands has already been satisfied twice, a day apart.
- **[MEASURED] The blocker is not capability.** Station 00 measured `IsReadOnly = False` on all five
  and Desktop Commander's `allowedDirectories = []`. I confirmed the files are readable and the
  script's anchors match. Nothing technical is in the way.
- **[MEASURED] The blocker is not the repo layer.** `lint-station.mjs` returns ADMIT on all 7 docs.
  The repo is corrected; only the layer that actually opens each run is stale.
- **[INFERRED] The blocker is an unanswered authority question.** 00's 2026-08-29T10:08Z breadcrumb
  is titled *"the bootstraps are writable so the escalation was never Marco-only"* and it still
  disposed the write to Marco rather than performing it. Twenty-eight hours later the bytes have not
  moved.

**The shape of this is worth naming, because it is the sweep's own subject.** The layer with the most
authority over a run - the one inlined as its opening turn - is the only layer with **no validator,
no CI gate, and no cadence that reads it** (see the `lint-station.mjs` measurement above). Everything
that can be gated has been fixed. The one thing that cannot be gated has not.

**DISPOSITION: DISPATCHED -> Station 00.** Not mine: writing the five bootstraps changes what governs
every station's next run, and my lane is read-only reporting. 00 already holds the script, the
measurement and the dry run. What 00 needs from this run is the re-verification it would otherwise
have to redo: **the anchors still match at `origin/main 4461c8be`, so the fix can be run as-is, today,
with no re-authoring.** If 00 judges it still needs Marco, then per DOCTRINE 6 it should say so in one
line and stop re-measuring it every run - four runs have now paid for the same measurement.

---

### F2 (S3) - 27 of the 30 `.gitignore:NNN` citations in the pipeline documentation set are off by exactly one, and a staged HOLD would land two more

**[MEASURED]** `.gitignore` read from `origin/main` as a raw Buffer via node (never a PS `>`
redirect - DOCTRINE 9.3): **136 lines, 4940 bytes.**

| Cited as | x | Claimed to be | TRUTH on origin/main | |
|---|---|---|---|---|
| `.gitignore:75` | 2 | `docs/pr-prompts/*-ready.md` | line 75 IS `docs/pr-prompts/*-ready.md` | **OK** |
| `.gitignore:76` | 1 | a file inside `processed/` resolves here | line 76 IS `docs/pr-prompts/processed/` | **OK** |
| `.gitignore:75-82` | 6 | the watcher sink FOLDERS | folders are **76-83** | **WRONG** |
| `.gitignore:106-110` | 7 | the five `docs/qa/` sink FILES | files are **107-111**; 106 is a comment | **WRONG** |
| `.gitignore:107` | 11 | `docs/qa/qa-findings.md` | 107 is `qa-checklist.md`; findings is **108** | **WRONG** |
| `.gitignore:106` | 1 | `qa-checklist.md` | 106 is a comment; checklist is **107** | **WRONG** |
| `.gitignore:105` | 1 | the "Master Plan stays committable" comment | that comment is on **106** | **WRONG** |
| `.gitignore:126-127` | 1 | `relationship-map.json` / `.md` | they are on **127-128** | **WRONG** |

**3 correct, 27 wrong, and the error is +1 in every single wrong case.** A single line was inserted
somewhere between line 76 and line 105 and no citation above it was re-checked.

**Note which three survived, because it is the whole lesson.** The two `:75` and the one `:76` are the
citations that were **obtained by running `git check-ignore -v`** - DOCTRINE 9.2 quotes its output
verbatim. Every citation that was **transcribed by hand** drifted. This is DOCTRINE 7.1 demonstrating
itself on DOCTRINE's own neighbours.

**Blast radius.** The 7x `106-110` and 11x `:107` sit in the `station-contract v1` CANONICAL BLOCK at
line 86/77 of all six station docs - byte-identical by design and hash-gated by `lint-station.mjs`, so
this cannot be patched in one file. It is also replicated into all five bootstraps at L84.

**One of these is more than cosmetic.** `.gitignore:75-82` is used in the canonical block to
enumerate *"anything under `processed|failed|paused|blocked|awaiting-review|reviewed|needs-marco`"*.
The real range is **76-83**, and **line 83 is `docs/pr-prompts/no-pr-opened/`** - a real sink the
enumeration omits entirely. A station listing "the gitignored sinks" from this doc misses one.

**[MEASURED] ADVERSARIAL PROMPT CRITIQUE - `pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md`
would INSTALL two of these errors while claiming to fix a false claim.** Its "What to change" section
instructs the fixing agent to:
- **:90** - *"name the five ignored entries from `.gitignore:106-110`"* -> writes a WRONG range into
  04-scanner.md, i.e. into the canonical block, i.e. into all six station docs.
- **:94** - *"fold the audit marker into `qa-findings.md`, already ignored at `.gitignore:107`"* ->
  cites the wrong line for the one file this whole rule exists to protect.
- **:82** - its supporting evidence cites `.gitignore:105` for a comment that is on 106.

Per this station's report-not-run rule I have **not touched that prompt**. Severity S2 on the prompt
itself (broken as authored - it ships a new wrong citation), S3 on the underlying doc drift.

**[MEASURED] The same prompt is HEALTHY on the axis I attacked it hardest on, and I report that too.**
Its premise is `grep -q "watcher-launcher\.ps1" docs/pipeline/stations/03-machine-minder.md` and its
`done_when` requires that grep to go silent. On `origin/main` the BARE form occurs **exactly once**
(03-machine-minder.md:261) and `watcher-launcher-singlelane.ps1` occurs once; the regexes cannot
collide, because `-singlelane` intervenes before the `.ps1`. So the premise **does** die on landing -
no LL-54 defect. Control: my own matcher counted bare=1 and singlelane=1 separately in one pass.

**DISPOSITION: DISPATCHED -> Station 00, with the exact edit, because the OAuth block makes arming
pointless and 00's established practice is to hand-land docs corrections.** Concretely:
1. Correct the three canonical-block citations to `.gitignore:107-111`, `.gitignore:108`, and
   `.gitignore:76-83` (adding `no-pr-opened/` to the sink list), then
   `node scripts/pipeline/lint-station.mjs --write-canonical` and re-lint - the REJECT-then-ADMIT pair
   IS the positive control, per the procedure 00 confirmed end-to-end on 2026-08-30T12:xxZ.
2. Fix the three one-off citations at 04-scanner.md:185, 05-sot-keeper.md:227, STATION-CAPABILITIES.md:193.
3. Correct :82/:90/:94 of the HOLD in the same PR, or the fix and the prompt disagree.
**RULE 1 note:** this is the complete-and-additive option - it fixes present readers and every future
one, and changes no behaviour, no schema and no data. The alternative (fix only the 11x `:107`) fails
the "completely / future" half, because the `75-82` range would keep hiding a real sink.

---

### F3 (S3) - STATION-CAPABILITIES 3 contradicts DOCTRINE 9.1 on two instrument traps, and on the more dangerous one it says the safer thing

Both files are binding on every station and both are read every run, so a station reading them in the
order its bootstrap prescribes gets DOCTRINE first and STATION-CAPABILITIES second - the wrong one last.

**(i) `$` in a `-Command` string.**
- `STATION-CAPABILITIES.md:113` - *"`$` is **STRIPPED** from any `-Command "..."` string."*
- `DOCTRINE.md:9.1` - *"`$` is **EXPANDED** ... Usually this dies as a parser error ... **sometimes it
  produces a VALID command carrying a value you never wrote, and exits 0**."*

**[MEASURED] DOCTRINE is right, and I measured it accidentally, in this run's first tool call.**
`$PSVersionTable.PSVersion.ToString()` was returned by the parser as
`System.Collections.Hashtable.PSVersion.ToString()` - the token was replaced by its **value's type
name**. Stripping would have produced `PSVersionTable...`; expansion produced a value I never wrote.
This matters because the two words imply different risks: *stripped* implies a loud parser error,
which is what I happened to get; *expanded* is the one that can yield a valid command that exits 0
with the wrong value. **The document a station reads LAST understates the failure mode.**

**(ii) The `#`-heading pause.**
- `STATION-CAPABILITIES.md:115` - *"Streamed output **PAUSES on lines starting with `#`** - not a hang."*
- `DOCTRINE.md:9.1` - *"The `#`-heading cause did **not** reproduce on Desktop Commander 0.2.47
  (measured 2026-08-29 ... a `#`/`##` fixture returned in the first read)"*, and reframes the real
  effect as an early return with output still pending, observed on a line with **no** `#`.

STATION-CAPABILITIES still asserts a mechanism DOCTRINE records as not reproduced, which sends a
reader looking for the wrong signature.

**[MEASURED] Never filed.** `Select-String` over `docs/pr-prompts/*.md` for `STATION-CAPABILITIES`
lines mentioning `STRIPPED` or `expand` returns ZERO rows; the only prompt referencing
STATION-CAPABILITIES at all is the HOLD in F2, at its line 106, on an unrelated point.

**DISPOSITION: DISPATCHED -> Station 00,** to fold into the same docs-correction PR as F2. Both are
one-paragraph edits to `STATION-CAPABILITIES.md` 3, outside the canonical block, so they need no
`--write-canonical` step. The fix is to make 3 POINT at DOCTRINE 9.1 rather than restate it - the
restatement is what drifted, and 9.1 is itself a hash-gated canonical block that cannot.

---

### F4 (S4) - the sweep rotation would have silently stopped if I had not advanced it

**[MEASURED]** `node scripts/pipeline/next-sweep.mjs` -> `SWEEP: instruction-drift`, rotation position
4 of 4, previous run 2026-08-30T10:10:48Z, exit 0. My station doc requires
`--advance --utc <measured timestamp>` and requires that file committed WITH the breadcrumb, on the
stated grounds that skipping it makes the next run repeat this sweep and the rotation stop turning.

**The advance is a tracked-file write and the commit is not mine to make** - I am read-only on the
board and cannot open a PR (authority matrix: 04 "Create a PR" = No). So the file is advanced in the
dev tree and left UNTRACKED-DIRTY for 00 to carry, exactly like this breadcrumb. **That coupling is
the finding:** the rotation only turns if a *different* station's next run happens to sweep up a
working-tree change 04 is not allowed to commit. It has held so far because 00 runs every 2 h and
collects; it is nonetheless a dependency nobody declared.

**DISPOSITION: DEFERRED.** Real, not urgent - the rotation is turning, 00's collection is working, and
`--advance` is idempotent enough that a missed sweep-up costs one repeated sweep, not a lost finding.
**What would make it urgent:** two consecutive 04 runs drawing the same sweep name, which is the
signature of the advance never having been committed. That is a one-line check for the next 04 run:
if `next-sweep.mjs` reports `instruction-drift` again at 18:10Z, this stopped being S4.

---

### F5 (S2) - Station 03's cadence is stated four different ways, and the one the ONLY staleness alarm believes is the one that makes it never fire

Four layers, measured this run, all disagreeing about the same station:

| Layer | What it says about 03 |
|---|---|
| `C:\Users\Marco\Claude\Scheduled\03-machine-minder\SKILL.md` (governs the run) | *"Cadence: every 4 hours, or manually after any crash or reboot"* |
| `docs/pipeline/stations/03-machine-minder.md` | states **no cadence at all** - `Select-String 'Cadence:'` returns zero rows |
| `STATION-CAPABILITIES.md:154` | *"**Stations 02 and 03 have NO schedule of their own** - they run only when 00 dispatches them"* |
| `STATION-CAPABILITIES.md:177` | *"03 Machine-minder \| **4 h or manual**"* |
| `scripts/pipeline/check-breadcrumb.mjs:36` | `const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };` |

**STATION-CAPABILITIES contradicts ITSELF, 23 lines apart** - dispatch-only at :154, scheduled 4-hourly
at :177 - and neither matches the validator.

**[MEASURED] This is not bookkeeping; it decides whether the alarm goes off.** My `--freshness` run
this run printed:

```
03  last 2026-08-29T23:05:00Z  15.2h ago  (cadence 24h)  ok
```

At the bootstrap's 4 h, SILENT is 8 h and 03 crossed it seven hours ago - `check-breadcrumb.mjs` would
have exited **2** and every station's preflight would have seen it. At the validator's 24 h, SILENT is
48 h and 03 reads **ok**. **03 has been quiet for 15.2 hours and the pipeline's only automated
staleness instrument is structurally unable to say so.** Note the shape: this is the same instrument
and the same failure family as the standing "06 has no `CADENCE` key" escalation - there, the key is
absent and 06 is invisible; here, the key is present but set to a value that cannot fire. One is
silence by omission, the other silence by calibration.

**Which number is right is a design question, not a measurement.** I am not guessing it (DOCTRINE 5.5).
The options, RULE 1 order - complete-and-additive first:

- **(A) Decide 03's real cadence once, then make all four layers quote ONE source.** Complete: fixes
  every present and future reader, and the alarm starts telling the truth. Additive: no behaviour,
  schema or data touched. Concretely - if 03 is dispatch-only per :154, set `'03': null` (it then
  prints *"dispatch-only - no cadence to miss"*, which would be TRUE of it, unlike 06); if it is
  genuinely 4-hourly per the bootstrap and :177, set `'03': 4` and delete the :154 sentence. **The
  behavioural evidence points at neither 4 nor 24:** 03's recent breadcrumbs land near 23:0xZ daily,
  which is what a 24 h cadence looks like, so `24` may be right and the *documents* wrong - but that
  is an inference from three filenames and Marco/00 should settle it, not me.
- **(B) Fix only the two STATION-CAPABILITIES lines so they agree with each other.** Fails the
  "completely / future" half: the alarm still cannot fire, and the next reader still gets a third
  number from the bootstrap.
- **(C) Leave it.** Fails both halves.

**DISPOSITION: ESCALATED.** Not because it is hard, but because every candidate answer is a claim
about how Marco wants 03 scheduled, and choosing wrong is worse than choosing late in exactly one
direction: setting `'03': 4` without a real 4-hourly task would make `--freshness` exit 2 on every
station's preflight forever, which is the trap already measured for 06 on 2026-08-30T06:3xZ. **The
question for Marco, in one line: is Station 03 dispatch-only (STATION-CAPABILITIES:154) or scheduled
(its own bootstrap and :177), and does a 4-hourly scheduled task for it actually exist on the box?**
Station 00 can answer the second half without Marco by listing the scheduled tasks; I did not, because
that is 03's and 00's lane and this run had its sweep.

## WHAT I DID NOT DO

- **Did not run `fix-station-bootstraps.mjs` for real** (F1). It is authored, dry-clean and 28 h idle,
  and the temptation to just fix it is exactly what my lane forbids: it rewrites the opening turn of
  every future scheduled run, which is a board-scale mutation wearing a five-file costume.
- **Did not edit `pr-station-docs-wrong-wrapper-and-false-gitignore-claim-HOLD.md`** (F2), and did not
  re-stage or re-scope it. Report-not-run is non-negotiable for the adversarial critique pass; a
  silent auto-fix would poison the review this pass exists to enable.
- **Did not edit any station doc, DOCTRINE, or STATION-CAPABILITIES** (F2, F3), and did not run
  `lint-station.mjs --write-canonical`. Correcting a hash-gated canonical block is a six-file
  simultaneous edit and belongs in one PR opened by a station that may open one.
- **Did not stage a new `-HOLD` prompt.** I am allowed two. I chose zero: the OAuth block means
  nothing can be armed, 61 HOLDs are already queued, and 00's measured practice while OAuth is dead is
  to hand-land docs corrections rather than arm them (#1394 / #1400 / #1401). A 62nd HOLD would have
  been queue noise dressed as diligence. F2's disposition carries the full edit instead.
- **Did not touch the board in any way** - no arm, disarm, rename, move, merge, label, or worktree.
  I minted no worktree at all (the throwaway-worktree route is superseded; I read `origin/main` with
  `git show`).
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site patrol).** One named sweep per
  run, covered completely, is the standing instruction; a shallow pass over everything is why findings
  rot. Board state was measured only as far as the safety preflight required: `status-sweep.ps1`
  verdict **SAFE TO ACT**, armed = 0, staged index empty.
- **Did not report the 31 raw unresolved paths as drift.** 28 were my instrument, not the docs, and
  shipping that count would have been a §9.6 violation with a tidy number on it.
