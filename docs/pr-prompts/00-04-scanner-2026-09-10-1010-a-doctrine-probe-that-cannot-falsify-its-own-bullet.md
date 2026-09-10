# Station 04 - Scanner | 2026-09-10T10:10Z-2026-09-10T10:25Z

## GROUND

```
UTC            2026-09-10T10:10:16Z
origin/main    a2fa8e4e            (fetched, then rev-parse; re-fetched 10:21:21Z, unchanged)
dev tree       main @ a2fa8e4e     C:\ProjectOperations2   (0 ahead / 0 behind)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only on that account.

Sweep assigned by `node scripts/pipeline/next-sweep.mjs`: **instrument-honesty**
(rotation position 2 of 4; previous advance 2026-09-10T06:10:05Z).

Binding documents read in full from the working copy, after proving the working copy is
byte-identical to `origin/main` by the sanctioned probe (no pipe, no length comparison):
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned EMPTY. [MEASURED]

`status-sweep.ps1` exit 10, captured to a file (it returns early and hides its own section 7
otherwise). Section 7 verdict: **SAFE TO ACT**. Board at 10:11:22Z: 3 open PRs
(#1845, #1832, #1823), armed 0, watcher node RUNNING pid 18228. This station mutated nothing
on the board regardless.

**vm-git-guard: INSTALL FAILED - reported, not stopped on.** The contract requires the
installer's last line be quoted pass or fail. Last line, verbatim:
`bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
... is under Plan9 share "c" which is not mounted`. The VM transport was unreachable for the
whole run, so no VM-side `git` could have been run against the mount and no `index.lock`
exposure arises. Desktop Commander was present throughout; this run was SIGHTED.

## WHAT I MEASURED

Every probe below was run against **the corpus its own bullet names**, never against DOCTRINE
section 9 itself (section 9.6's closing rule). Fresh needle minted for this run:
`zzQq04Needle20260910T1012` - 0 hits everywhere it was used, and **spent the moment this file
lands**.

Scripts: `C:\po-sup-fix-scripts\04-instr-{git,ps,gh,e,e2,f}-20260910.{mjs,ps1}` (scratch tree,
outside the repo).

### Section 9.1 - the shell. All five REPRODUCE.

| bullet | probe | result | control |
|---|---|---|---|
| `-Command` expands `$` | `start_process -Command` with `$CTRL=42` undefined + `$home` loop | `=42` (CTRL gone), `foreach (C:\Users\Marco in ...)` -> ParserError | same logic via `-File`: `$` intact |
| `\*` + `-Recurse` + type filter | fixture pair A/B, truth known by construction | A: 2/2 and 3/3 (BLIND). **B: 2/0 and 3/0** | bare-dir form correct on both |
| automatic variable as loop target | `foreach ($home in @(1,2,3))` inside a `.ps1` | **0 rows**, `SessionStateUnauthorizedAccessException: Cannot overwrite variable HOME` | POS `$loopVar` -> 3 rows |
| single-quoted `\\` needle | 11 `SKILL.md` bootstraps under `Scheduled\` | double-`\\` form **0 of 11**; single-`\` form **7 of 11** | corpus size 11, not 5 |
| `gh run view --job --log` 3 tab columns | run 34463518340, job 102826634114 `E2E restoration markers` | needle `E2E` matches **192 of 192** whole-line vs **4 of 192** last-column; 192 of 192 lines contain a TAB | POS body needle 23; NEG 0 |

The fixture pair is the important one: **fixture A alone is structurally blind** (every form
agrees on it), exactly as the 2026-09-10T03:3xZ correction warns. Only fixture B - no matching
file at depth 1 - separates the forms.

### Section 9.2 - git. All five REPRODUCE.

- `ls-tree --name-only origin/main -- docs/pr-prompts` = **1** line; with a trailing slash = **56**;
  with `-r` = **962**. [MEASURED]
- glob pathspec: `-- "docs/pr-prompts/superseded/*.md"` with `-r` = **0**, and the POSITIVE control
  `-- "docs/pr-prompts/*.md"` = **0** as well, against a truth of at least 56. Explicit
  `:(glob)` magic fails LOUDLY (`pathspec magic not supported`). `-r` does not rescue a glob.
- `git check-ignore -v docs/pr-prompts/processed` (directory) -> exit 1, empty. The NEGATIVE
  control, tracked `CLAUDE.md` -> **exit 1, empty**. Byte-identical results for opposite truths.
  The file form inside that directory -> exit 0, `.gitignore:76`. Only the file form answers.
- `git status --porcelain` is blind to ignored files: **4309** files under
  `docs/pr-prompts/processed` are returned by `git ls-files --others --ignored --exclude-standard`
  (POS control), and `git status --porcelain <one of them>` returns **0 rows**.
- `git branch -r` = **36** against `git ls-remote --heads origin` = **12**, immediately after
  `git fetch origin --prune`. See finding F4.

### Section 9.3 - files and encoding. All four REPRODUCE.

- `>` redirection: first two bytes `0xFF 0xFE`, 34 bytes for a 14-character string. This run met
  it live - `status-sweep.ps1 *> $sw` produced 132,058 bytes that node had to decode `utf16le`
  to see the ten section headers at all.
- `Measure-Object -Line` on `lint-prompt.mjs`: **2282** against `(Get-Content ...).Count` =
  **2444**. 162 blank lines silently dropped, exit 0.
- `Select-String -SimpleMatch` with `[regex]::Escape()`: escaped needle **0**, raw needle **2**,
  dotless POSITIVE control **35**, NEGATIVE control 0.
- The CRLF front-matter parser landed at 08:5xZ today: over the **41** depth-1 `-HOLD.md` files,
  the `\s*\n` list-form matcher returns **0 of 41** and the CRLF-explicit form returns **41 of
  41**. A uniform zero across a heterogeneous corpus, exactly as the bullet says. Reproduced.

### Section 9.4 - GitHub. Four REPRODUCE, one not reproduced today, one CANNOT MEASURE.

- **CWD trap** (landed 05:3xZ today), the four-row table rebuilt:

  | form | exit | stdout chars |
  |---|---|---|
  | non-repo CWD, no `-R` - the failing form | **1** | **0** |
  | non-repo CWD, with `-R` - POS | 0 | 49 |
  | dev-tree CWD, no `-R` - POS | 0 | 49 |
  | dev-tree CWD, with `-R` - POS | 0 | 49 |
  | `-R` naming a repo that does not exist - NEG | 1 | 0 |

  Reproduces exactly. Row 1 never returned stdout.
- `gh run list --commit <8-char sha>` = **0** rows; the same query with the full 40-char SHA =
  **4** rows. Both exit 0.
- `merged` on a LIST response, read through `gh api .../pulls?state=closed&per_page=10`:
  10 entries returned, the `merged` key **defined on 0 of 10**, `merged_at` populated on
  **10 of 10**. POSITIVE control, single GET on `/pulls/1844`: `merged=True`,
  `merged_at=2026-09-10T09:57:52Z`. This is the 2026-09-07 correction's shape (through `gh` the
  key is ABSENT, not `false`) and it holds.
- `@(ConvertFrom-Json '[]').Count` = **1**; `@(ConvertFrom-Json '[4 elements]').Count` = **1**;
  assign-then-count = **0** and **4**. Cure works for this case. See F6 for the case it does not.
- **NOT REPRODUCED today:** `gh run list --branch main` was not stale. Its newest row read
  `createdAt 2026-09-10T09:57:55Z`, `headSha a2fa8e4e...` - identical to the per-commit query at
  `origin/main`. 🔴 **This must not be written up as the trap being dead.** The bullet says
  "*can* be DAYS stale" - an intermittent claim that a single fresh sample cannot falsify, and
  whose cure (read per-commit) costs nothing. Recorded so a later run does not manufacture a
  refutation from one good reading.
- **[CANNOT MEASURE]** the escaped-double-quote `--jq` sub-case through the `-Command` layer: my
  probe string failed to parse as a whole (`Array index expression is missing or not valid`), so
  the sub-probe never ran and I cannot attribute the failure. What IS measured is the
  load-bearing half: **every malformed `--jq` form I ran failed LOUDLY at exit 1**, never
  silently, and a well-formed `--jq` with spaces in it survived intact.

### The refuted STATION-CAPABILITIES label bullet stays refuted.

`gh pr view 1369 --json labels --jq '.labels[].name'` printed **`do-not-merge`** at exit 0
(POSITIVE control - #1369 genuinely carries it, confirmed via
`gh pr list --state all --label do-not-merge`). The same query on #1845 printed nothing at exit 0,
and #1845 genuinely has no labels. Label reading is sound in **both** directions. The
2026-09-05 refutation of the old "quotes are stripped, labels read `[]`" claim holds.

### Section 9.5 and 10.1 - the pipeline's own instruments.

- `NESTED_TEST_PATHS` on `origin/main` holds **3** regex forms (POS `classifyPolicyFiles` -> 2,
  NEG -> 0). Section 10.1's paragraph is still correct.
- `lint-prompt.mjs` arming markers, read by anchor: `DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i`
  (case-INsensitive), `DO_NOT_ARM_CAPS = /DO NOT ARM/` (case-SENSITIVE), `ARM_ONLY = /Arm ONLY/i`
  (case-INsensitive). Three markers, mixed sensitivity, exactly as the 2026-09-06 correction says.
- `foldBlockScalar` occurrences = **2**. The LL-29 rollback gate is still real.
- Section 9.5's parenthetical "(now 1824 lines)" for `lint-prompt.mjs` now measures **2445** LF
  lines. Not a defect - it is precisely why that bullet says to anchor by SYMBOL. Every symbol
  anchor above resolved on the first try.
- Clone log directory `...\pr-watcher\logs`: **45** `*.log`, of which **40** match the daily
  name shape and **5** do not (`supervisor.log`, two `supervisor.rot-*`, two
  `supervisor.crashed-*`). Today newest-by-mtime and newest-daily-shaped are the same file
  (`2026-09-10.log`, 10:14:47Z), so the collision is not firing right now. The name-shape filter
  remains necessary; see F5.
- Needle contamination (section 9.6): the two long-prescribed negative-control needles now appear
  in **38** and **33** depth-1 files under `docs/pr-prompts` respectively. Counts are STATE.

### Dev-tree state, measured with the sanctioned probe rather than read off `git status`

The tree is 0 ahead / 0 behind `origin/main`, so section 9.2's behind-tree caveat does NOT apply
and a ` M` / ` D` here is real uncommitted work. `git diff --numstat origin/main` on the two
tracked entries:

```
1	0	docs/pr-prompts/.arming-log.txt
0	133	docs/pr-prompts/pr-statussweep-gitproc-scope-to-the-two-repos-HOLD.md
```

The `-HOLD.md` deletion is benign and needs no action: it is the prompt #1845 consumed
(`GITPROC_SCOPED_V1`, branch `fix/status-sweep-gitproc-scoped`, state OPEN), and the deletion
lands when that PR merges. Named here only so a later run does not re-file it.

## WHAT CHANGED

**Nothing on the board, and nothing tracked in the repo beyond this breadcrumb.** Station 04 is
read-only on the board: no arm, no disarm, no merge, no label, no PR, no prompt staged, no
`/sot/` edit.

Two writes, both required by the station contract:

1. This breadcrumb, at the tracked path `docs/pr-prompts/00-04-scanner-2026-09-10-1010-...md`.
   It is UNTRACKED until a board PR commits it - **Station 00 must sweep it up.**
2. `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-10T10:10:16Z`, which dirties
   `docs/pipeline/sweep-rotation.json`. **Left dirty in the dev tree deliberately - 04 may not
   commit, so Station 00 commits it.** If it is not committed the next run repeats
   instrument-honesty and the rotation stops turning.

Scratch scripts were written to `C:\po-sup-fix-scripts\` and fixtures to `%TEMP%`, both outside
the repo. No worktree was minted (the AUTHORITY block forbids it); `origin/main` was read with
`git show` / `git rev-parse` throughout.

## FINDINGS

### F1 - A section 9.1 falsifying probe cannot falsify its own bullet, because it is routed through the trap documented three bullets above it. S2.

`AUTOMATIC_VARIABLE_ASSIGNMENT_V1` ends with:

> Falsifying probe: `powershell -NoProfile -Command "foreach ($home in @(1,2,3)) { $home }"` -
> if it prints `1 2 3`, this bullet is wrong and must be re-measured.

That probe is written through the `-Command` layer, which the FIRST bullet of the same
subsection records as EXPANDING `$`. So `$home` is destroyed before the child parses it.
[MEASURED] 2026-09-10T10:1xZ at `a2fa8e4e`, three transports, PS 5.1:

| transport | what the child actually received | output | what the reader concludes |
|---|---|---|---|
| `start_process -Command "..."` (the transport 9.1 measured its own expansion on) | `foreach (C:\Users\Marco in @(1,2,3))` | ParserError, `Missing variable name after foreach` | "not `1 2 3`, so still trapped" - having measured nothing |
| interactive shell, DOUBLE-quoted argument (the probe as literally written) | `foreach (C:\Users\Marco in @(1,2,3))` | ParserError | same |
| interactive shell, SINGLE-quoted argument | `foreach ($home in @(1,2,3))` | **`Cannot overwrite variable HOME because it is read-only or constant`** - the documented symptom | correct |
| a `.ps1` run with `-File` (POSITIVE control) | `foreach ($home in @(1,2,3))` | **0 rows** + `SessionStateUnauthorizedAccessException`; POS `$loopVar` -> 3 rows | correct |

**Why this is S2 and not a typo.** The probe passes VACUOUSLY in two of four transports,
including the one a station reaches for first. Worse, it is unfalsifiable in the direction it
exists to protect: if the automatic-variable behaviour were ever changed upstream, the probe
would STILL not print `1 2 3`, because it still would not reach the mechanism. That is section
7's own definition of a check nobody has seen fail, sitting inside section 9.

**And the two cures point in OPPOSITE directions, which is why nobody caught it.** The expansion
bullet says, correctly and in bold, to run *its* discriminating control through `-Command` and
never through `-File` - because a `-File` run hides the expansion from its own control. The
automatic-variable bullet needs the exact opposite: a transport that PRESERVES `$`. Neither
bullet says which of the two it belongs to, so a reader applying "run the control through
`-Command`" to the wrong bullet arms the failure. This is the compositional shape section 9
keeps recording - two individually correct cures composing into a silent one.

🔧 **Proposed correction** (a section 9.1 edit; `instruments v2` is DOCTRINE-only, so this costs
ONE document and a canonical-block re-record, not seven). Replace the probe line with:

> **Falsifying probe - the argument must reach the child with `$` intact, so SINGLE-quote it or
> put it in a `.ps1` and run with `-File`:**
> `powershell -NoProfile -Command 'foreach ($home in @(1,2,3)) { $home }'`
> Expect `Cannot overwrite variable HOME because it is read-only or constant` and ZERO rows,
> against a POSITIVE control with a non-automatic name that emits three. **A ParserError naming
> a filesystem path instead of `$home` means your argument was expanded before the child saw it -
> that is the bullet above firing, not this one, and you have measured nothing.** If the
> single-quoted form ever prints `1 2 3`, this bullet is wrong and must be re-measured.

RULE 1 check: complete-and-additive. It fixes the probe permanently (the single-quoted form is
correct on every transport), adds the discriminator that tells a reader which bullet fired, and
removes nothing - the expansion bullet's own `-Command` instruction is untouched and is now
explicitly scoped to itself. No alternative was considered that fails either half.

**DISPATCHED -> Station 00.** A DOCTRINE section 9 edit is a `docs/` change inside 00's recorded
lane. 04 is read-only and may not open the PR.

### F2 - The arming-log publication gap is OPEN by one line, right now. S3.

Section 9.5's own falsifying probe is a two-line-count comparison. [MEASURED] at `a2fa8e4e`:
`git show origin/main:docs/pr-prompts/.arming-log.txt` = **74** non-blank lines; the working copy
= **75**; and `git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` = `1 0`.
POSITIVE control `git ls-files --error-unmatch` on the log -> exit 0.

So the bullet's conditional applies as written: **one arm is currently published nowhere**, an
arm age read from `origin/main` is a LOWER bound, and any run that arms must carry the log in its
board PR. The underlying defect - nothing commits the log on purpose, so the gap closes and
re-opens by luck - is untouched. Nothing here contradicts the bullet; it is the bullet doing its
job, and the gap being open is worth a line because a clone reading `origin/main` today gets a
stale arm history rather than an obviously absent one.

**DISPATCHED -> Station 00**, which sweeps the dev tree: fold `.arming-log.txt` into the same
board PR that picks up this breadcrumb.

### F3 - `check-breadcrumb.mjs` still carries `'00': 2`, four days after the table was corrected. S3.

[MEASURED] at `a2fa8e4e`, anchor `const CADENCE =`:
`const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`; NEGATIVE control, a fresh
needle over the same file -> 0. `00`'s live cron is `5 * * * *` (hourly).

Consequence, unchanged since 2026-09-05: `--freshness` will not call `00` SILENT until 4 h, i.e.
only after **three** consecutive missed hourly runs - escalation #23's exact direction, toward
not noticing a missed run. `03` (24) and `04` (4) match their live crons; `00` is the only wrong
row.

**DEFERRED.** This is already filed for Marco (it is a one-character `scripts/` change and
therefore outside 00's recorded merge lane). Re-measured today so the filing is not read as
stale; **not re-raised**. What would make it urgent: a missed `00` run that `--freshness`
reported as `ok`.

### F4 - Stale remote-tracking refs have tripled: 36 cached against 12 real. S3.

[MEASURED] immediately after `git fetch origin --prune`: `git branch -r` = **36**,
`git ls-remote --heads origin` = **12**. Section 9.2 records this mechanism at 12-vs-7 on
2026-09-03 and explains why `--prune` cannot cure it - `refs/remotes/pr/*` refs are hand-made by
`git fetch origin pull/N/head:refs/remotes/pr/N` and no refspec owns them.

The mechanism is documented and needs no new bullet. What is worth naming is the ratio: **24 of
36 entries are now dead**, twice the live set, so any run that cross-references the cached list
against the GitHub API inherits an error larger than the signal. Counts are STATE - re-measure,
never quote these.

**DISPATCHED -> Station 03.** Tree and clone hygiene is 03's lane; 04 is read-only and does not
delete refs. Suggested, for 03 to verify before acting: the dead `refs/remotes/pr/*` entries are
safe to drop, but the list must be built from `git ls-remote --heads origin` and not from the
cache being cleaned.

### F5 - The five non-daily `*.log` files are still in the clone log directory. S4.

[MEASURED]: 45 `*.log`, 40 daily-shaped, 5 not - `supervisor.log`,
`supervisor.rot-20260814-221005.log`, `supervisor.rot-20260814-235900.log`,
`supervisor.crashed-20260814-160809.log`, `supervisor.crashed-20260814-182052.log`. Today the
newest file by mtime and the newest daily-shaped file are the same (`2026-09-10.log`,
2026-09-10T10:14:47Z), so a run following the naive "newest by mtime" rule would get the right
file this hour.

That is luck, not safety: the hazard is a gap wider than the margin (a relaunch, a kill-loop
pause, the daily name rolling at the next launch), and `supervisor.log` answers `opened PR #` = 0
with its own positive control also 0. The cure - filter to the daily name SHAPE first, then take
the newest by mtime - is already in section 9.5 and is correct.

**DEFERRED.** Nothing to change; recorded so the next instrument-honesty sweep does not read a
clean sample as evidence the hazard is gone. What would make it urgent: the newest `*.log` in
that directory ceasing to be daily-shaped.

### F6 - The `ConvertFrom-Json` count cure works for an empty ARRAY and fails for an empty STRING, which is what a failed `gh` call returns. S2.

Section 9.4 records `@(ConvertFrom-Json '[]').Count` = 1 and prescribes **assign first, then
count**. That cure is correct for the case it names and I reproduced it. It does **not** cover
the case the freshly-landed CWD bullet creates, and I walked into that live while writing this
run's own probes.

[MEASURED] at `a2fa8e4e`, PS 5.1, a `gh` call made to fail by a cause unrelated to CWD (a
`--json` field list written with spaces after the commas, which PowerShell splits into separate
arguments):

| form | exit | stdout chars | rows after assign-then-count | first field |
|---|---|---|---|---|
| spaces + `2>$null` - the failing form | **1** | **0** | **1** | `[]` (empty) |
| spaces + `2>&1` | 1 | - | - | `gh : unknown command "createdAt" for "gh run list"` |
| no spaces - POSITIVE control | 0 | - | **4** | `2026-09-10T09:57:55Z` |

Mechanism, measured separately so it is not inferred: `ConvertFrom-Json ""` returns **`$null`**
(`$null -eq $r` -> `True`), and **`@($null).Count` is `1`**. Assign-then-count cannot help,
because the problem is not array collapse - it is a null wearing a one-row answer's clothes.
Controls, same session: assign-then-count on `'[]'` -> **0** (the documented cure, working);
a null-guarded count `@($r | Where-Object { $_ }).Count` -> **0**.

**Why this matters beyond my own scripting slip.** The 05:3xZ CWD bullet's cure is "test
`$LASTEXITCODE` before parsing", and it is exactly right - but it is written as though the
failure mode belonged to CWD. It does not: **every** failed `gh` call has empty stdout, and every
one of them yields `rows = 1` with empty fields, which reads worse than an empty list because it
looks like a real answer. A run that counts `1` and moves on has a phantom row.

🔧 **Proposed correction:** one clause on the existing `ConvertFrom-Json` bullet - *"and it
answers `1` for an empty STRING too, because `ConvertFrom-Json ""` returns `$null` and
`@($null).Count` is 1. Assign-then-count does NOT rescue that case; test `$LASTEXITCODE` before
parsing, or count with a null guard."* Complete-and-additive: it extends a bullet that is already
right about its own case, contradicts nothing, and generalises the CWD bullet's cure to every
cause of a failed `gh` call rather than the one that was measured. RULE 1 satisfied on both
halves.

**DISPATCHED -> Station 00**, together with F1 - both are section 9 edits to one document.

### F7 - `gh run list --branch main` did not reproduce today, and that is not evidence. S4.

Recorded as a finding rather than buried in the measurements because the wrong conclusion here is
cheap to reach and expensive to undo. The bullet claims the query **can** be days stale. Today it
was not: newest row `createdAt 2026-09-10T09:57:55Z`, `headSha a2fa8e4e...`, identical to the
per-commit query at `origin/main`.

An intermittent "can be" claim is not falsified by one healthy sample, and the cure it prescribes
- read CI per-commit with the full 40-char SHA - costs nothing and is independently required by
the short-SHA bullet, which DID reproduce (0 rows against 4). **A later run must not write this
up as the trap being dead.**

**DEFERRED.** What would make it actionable: a stated mechanism showing the staleness cannot
occur, not another clean sample.

### Nothing else in section 9 failed to reproduce.

Twenty-two claims were probed against their own named corpora. Twenty reproduced with both
controls, one (F7) did not reproduce today and is unfalsifiable by that sample, one (the
escaped-quote `--jq` sub-case) is `[CANNOT MEASURE]` and is reported as such rather than filled
in with reasoning. **No section 9 bullet was found to be dead.**

## WHAT I DID NOT DO

- **Did not arm, disarm, merge, label, rebase, or open a PR.** 04's authority row is
  *Mutate the board: NO, read-only* and *Create a PR: NO*. The three open PRs (#1845, #1832,
  #1823) were read for their lane and their labels and otherwise left entirely alone; no RULE 2
  determination was needed because nothing was going to be merged by this run either way.
- **Did not commit the rotation advance or this breadcrumb.** The dev tree is on `main` and
  nobody commits to `main` directly; 04 may not open the PR that would carry them. Both are left
  dirty and named above for Station 00.
- **Did not touch `/sot/`** (Station 05's, CP-24) and did not touch Azure, Entra or SharePoint
  (absolute).
- **Did not mint a worktree.** The AUTHORITY block forbids it - an orphaned worktree's lock has
  no holding process by construction, forever. `origin/main` was read with `git show` and
  `git rev-parse`.
- **Did not run `git` from the VM against the mount.** The VM transport was down for the whole
  run, so the question did not arise; the guard install failure is reported in the ground block
  rather than treated as a stop, per the contract.
- **Did not clear, prune or investigate the three orphaned worktrees** the sweep reported
  (`C:/po-vg` at 8778 min holding 1 uncommitted file, `C:/po-worktrees/pr1823`, `C:/po-wt/st00-0808`).
  That is Station 03's lane and `C:/po-vg` is already escalated. Reported here only so the
  uncommitted file in `C:/po-vg` is not lost to a `--force` prune.
- **Did not run Part 0, Part 1 or the live-site pass.** The station doc's AUTHORITY block is
  explicit that the sweep is chosen by `next-sweep.mjs` and covered completely, not chosen by the
  run - a shallow pass over everything is why findings rot. This run's sweep was
  instrument-honesty and the budget went to covering it end to end.
- **Did not stage a fix prompt.** F1 and F6 are corrections to a hash-gated canonical block in
  DOCTRINE; staging them as prompts would put the wording of binding law through a build rather
  than through the station that owns the document. They are dispatched with the exact proposed
  text instead.
- **Did not delete the two burned negative-control needles** from the 38 and 33 files that carry
  them. Editing prompt files is not 04's, and the contamination is cured by minting fresh needles,
  which this run did.
