# Station 04 — Scanner | 2026-09-05T22:10:14Z–2026-09-05T22:34Z

## GROUND

```
UTC            2026-09-05T22:10:14Z
origin/main    02cd539f            (fetched, then rev-parse)
dev tree       main @ 7695b3a5     C:\ProjectOperations2   (2 commits behind origin/main; 39 dirty lines)
doc version    1                   (docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (C:\Users\Marco\Claude\Scheduled\04-scanner\SKILL.md)
```

Doc version and bootstrap AGREE — this run is not read-only-by-mismatch. It is read-only because
04 is read-only on the board.

Binding docs were read from the DEV TREE and proven identical to `origin/main`:
`git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY output** (the real answer, §9.1).

**Sweep this run: `instrument-honesty`** (rotation position 2 of 4), assigned by
`node scripts/pipeline/next-sweep.mjs`, previous run 2026-09-05T18:10:18Z.

Sweep verdict at 22:10:36Z was **CAUTION** (a PR touched on GitHub inside 2 minutes). 04 mutates
nothing on the board, so CAUTION does not bind this run; no board mutation was attempted.

## WHAT I MEASURED

Fresh negative-control needle minted for this run per §9.6: `zzQq04Instr20260905T2215` — **now spent**,
because this file is tracked.

### §9.1 The shell

| Probe | Result | Verdict |
|---|---|---|
| `powershell.exe -NoProfile -Command "$CTRL=42; …"` | assignment arrives as bare `=42` (`ExpectedValueExpression`); `$true`→`True`; `$env:USERNAME`→`Marco` | **[MEASURED] REPRODUCES** |
| `powershell.exe -NoProfile -File ctrl-04.ps1` (same three lines) | `CTRL-literal-is:42` · `true-is:True` · `user-is:Marco` | **[MEASURED] cure holds — no expansion** |
| Streamed output returning early | hit twice this run (`T5a` batch, and again on the `foreach`/anchor batch); recovered with `read_process_output` | **[MEASURED] REPRODUCES** |

Both halves of the §9.1 bullet stand, including the *"the cure hides the trap from its own control"*
clause: the discriminating control was run through `-Command`, not `-File`.

### §9.2 Git

All at `origin/main` = `02cd539f…`. Counts are STATE — re-measure, never quote.

| Probe | Result | Verdict |
|---|---|---|
| `git ls-tree --name-only origin/main -- docs/pr-prompts/superseded` | **1** | **REPRODUCES** |
| …same with `-r` | **310** | |
| …same with trailing slash, no `-r` | **104** (direct children) | |
| `git ls-tree -r --name-only … -- 'docs/pr-prompts/*.md'` | **0** | **REPRODUCES** — glob returns 0 silently |
| …same without `-r` | **0** | `-r` does not rescue it |
| literal prefix control `-- docs/pr-prompts/` | **96** | positive control passes |
| `:(glob)docs/pr-prompts/superseded/**/*.md` | `fatal: pathspec magic not supported by this command: 'glob'` | **REPRODUCES** — only loud form |
| `git check-ignore -v docs/pr-prompts/processed` (dir) | exit **1**, empty | **REPRODUCES** |
| `git check-ignore -v CLAUDE.md` (tracked, not ignored) | exit **1**, empty — **byte-identical to the above** | opposite truths, identical result |
| `git check-ignore -v …/processed/pr-lint-not-a-prompt-ready.md.log` | exit **0**, `.gitignore:76` | only the file form answers |
| `git branch -r` **after** `git fetch origin --prune` | **16** | **REPRODUCES** |
| `git ls-remote --heads origin` | **8** | |
| the extras | `pr/1477 pr/1478 pr/1483 pr/1487 pr/1544 pr/1571 pr1273` (7) + `origin/HEAD` | exactly the un-owned `refs/remotes/pr/*` the bullet names — `--prune` cannot remove them |

### §9.3 Files and encoding

| Probe | Result | Verdict |
|---|---|---|
| `git show origin/main:docs/pipeline/DOCTRINE.md > file` (PowerShell `>`) | **177,732 bytes**, unreadable as UTF-8 by node — `indexOf` returned `-1` on every needle | **REPRODUCES** |
| same via `cmd /c "… > file"` | **87,682 bytes**, parses correctly | cure holds |
| `Select-String -SimpleMatch -Pattern 'lint-prompt.mjs'` | **2** | |
| …`-Pattern ([regex]::Escape('lint-prompt.mjs'))` | **0** | **REPRODUCES** — escaped literal is unusable |
| …dotless control `([regex]::Escape('readFromOriginMain'))` | **6** | the dotless control passes while every dotted query fails |
| …fresh negative needle | **0** | |

**Length-across-the-boundary trap (§9.3, the 2026-09-05T10:1xZ bullet) — REPRODUCES exactly,
both component errors:**

```
blobBytes 87682  wcBytes 88865  delta 1183
lfCount   1183                              <- the delta IS the LF count
strLenBlob 86727 strLenWC 87910             <- String.length under-reports by 955 on each side
Buffer.compare(blob, workingCopy) = -1      <- "they differ", across the boundary
git rev-parse origin/main:…/DOCTRINE.md = d143d4be7e1236994103ae56b79eeacdfeb8ba80
git hash-object          …/DOCTRINE.md = d143d4be7e1236994103ae56b79eeacdfeb8ba80
git diff --numstat origin/main -- …/DOCTRINE.md = EMPTY          <- the real answer
```

The three sound forms all agree the file is identical; every size-based form says it differs.
`Buffer.compare` used **across** the boundary is a false positive, which is precisely the caveat
the bullet carries.

### §9.4 GitHub

| Probe | Result | Verdict |
|---|---|---|
| `@(ConvertFrom-Json '[]').Count` | **1** (truth 0) | **REPRODUCES** |
| `$e = ConvertFrom-Json '[]'; @($e).Count` | **0** | cure holds |
| `@(ConvertFrom-Json '[{…}×4]').Count` | **1** (truth 4) | **REPRODUCES** |
| assigned-then-counted | **4** | cure holds |
| `gh run list --commit 02cd539f` (short) | `[]`, exit 0 | **REPRODUCES** |
| `gh run list --commit 02cd539fcfe8dd05481a208354947cb939e52542` | **4** runs | |
| `--jq '[.[].number] \| join(\",\")'` through `-Command` | `failed to parse jq expression … [.[].number] \| join(,\)` | **REPRODUCES** — spaces survive, escaped quotes do not |

`gh run list --branch main --limit 5` at 22:2xZ returned newest row `2026-09-05T22:09:06Z` on head
`02cd539f`, which **is** `origin/main`. **[MEASURED] the staleness did NOT reproduce in this
snapshot.** The bullet's claim is conditional (*"can be DAYS stale"*), so a fresh reading does not
falsify it — recording the non-reproduction, not proposing a retirement.

### §9.5 The pipeline's own instruments

**Symbol anchors — all resolve on `origin/main`** (`git grep -c -F … -- scripts/pipeline/lint-prompt.mjs`):
`function readFromOriginMain` 1 · `LINT_GH_BIN` 1 · `DO_NOT_ARM_COMMENT =` 1 · `DO_NOT_ARM_CAPS =` 1 ·
`ARM_ONLY =` 1 · `foldBlockScalar` 2 · `HUMAN_GATE_PRESENT: line` 3 · fresh negative needle **MISS**.
The 2026-09-04 re-anchoring from line numbers to symbols is holding.

**`check-breadcrumb.mjs` anchors** (same method): `ls-tree` 3 · `-r` 4 · `p.lastIndexOf('/')` 1 ·
`readdirSync(DIR)` 1 · `basename` **0 hits** — exactly as §9.5 asserts.

**STOP-WATCHER — REPRODUCES, path and all.** `C:\po-watcher\STOP-WATCHER-LANE2` present, **1090
bytes**; `C:\po-watcher\STOP-WATCHER` **absent**; the pathless probe (`STOP-WATCHER*` recursive over
`C:\ProjectOperations2`) → **0**, which is the false negative the bullet exists to prevent. Fresh
negative needle over `C:\po-watcher` → 0.

**RULE 2's two homes — REPRODUCES, and the decoy still passes its mandated control.**

```
LIVE  C:\ProjectOperations2\docs\pr-prompts\processed        1970 logs  newest 2026-09-05T22:09:42Z  marco.:true = 614
DECOY C:\po-watcher\ProjectOperations\docs\pr-prompts\processed  21 logs  newest 2026-08-17T14:28:09Z  marco.:true = 10
NEG (fresh needle, live dir) = 0
```

POS=10 / NEG=0 on the corpse is the exact shape the standing rule asks for, and it then returns no
verdict for every PR opened since 17 August. **Log age, not POS>0, is the discriminator.**

**Lane probe on the one PR armed today** — `Select-String -Path docs\pr-prompts\processed\pr-*.log
-Pattern 'PR #1680\b'` → `pr-deps-s1-fasturi-browserslist-overrides-ready.md.log`; negative control
`PR #999999` → **0**. #1680 is watcher-opened, not second lane.

**Watcher-clone stash** (`git -C C:\po-watcher\ProjectOperations stash list`) = **66**.

### §9.6

Negative-needle contamination over `docs/pr-prompts` depth-1 + `archive/` + `needs-marco/`:
the two long-prescribed needles returned **47** and **39**. Station 04 measured **40** and **36**
over the same corpus at 18:1xZ today. Positive control `premise:` = 107; this run's fresh needle = 0.
**[MEASURED] the contamination is real, monotonic, and grew +7 / +3 in roughly four hours.**

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced to `last_index=1`,
  `last_run_utc=2026-09-05T22:10:14Z` via `node scripts/pipeline/next-sweep.mjs --advance --utc …`
  (exit 0). **LEFT DIRTY in the dev tree** (`git status --porcelain` → ` M docs/pipeline/sweep-rotation.json`).
  **Station 00: this file needs committing with the next board PR — 04 may not commit it.**
- This breadcrumb, written to the tracked queue root. Untracked until a board PR sweeps it up.
- Nothing else. No prompt staged, armed, renamed, moved or deleted. No PR opened, labelled or merged.
  No `/sot/` file touched. No branch-changing git command run in the dev tree.

## FINDINGS

### F1 — §9.5's `docs/pr-reviews/` bullet points the WRONG WAY today, and following it manufactures the exact false finding it exists to prevent. S2.

DOCTRINE §9.5 states: *"`docs/pr-reviews/` IN THE DEV TREE IS A STALE MIRROR, NOT THE REVIEW LANE'S
OUTPUT … Probe the clone and that archive before concluding the review lane is dead."*

[MEASURED] 2026-09-05T22:2xZ, newest `pr-*-review.md` by `LastWriteTimeUtc` in each tree:

```
dev tree   C:\ProjectOperations2\docs\pr-reviews             pr-1680-review.md  21:46:33Z
clone      C:\po-watcher\ProjectOperations\docs\pr-reviews   pr-1675-review.md  19:03:00Z
C:\po-watcher\verdicts-archive                               present
NEG control (fresh needle, recursive over the clone dir)     0
```

**The dev tree is 2 h 43 m AHEAD of the clone**, and holds a review for #1680 — a PR armed at
21:33:19Z and reviewed at 21:46:33Z — that the clone does not have at all. A run that obeys the
bullet as written probes the clone, reads `pr-1675 @ 19:03Z`, and concludes *"the review lane stopped
producing artifacts at 19:03Z"*. That is a clean, coherent, five-in-a-row false finding — the same
one the bullet documents, with the arrow reversed.

Five angles: (1) re-measured after re-listing both directories, same answer; (2) source is the two
directories themselves plus the `.arming-log.txt` row and the processed log that place #1680 in the
watcher lane; (3) the violated rule is §9.6 — an empty/older result read as an empty world; (4) history —
the bullet was authored 2026-09-05T19:2xZ by Station 00, i.e. **before** the 21:33–21:46Z activity that
inverts it, so this is fresh drift, not a re-file; (5) blast radius — every station is told §9 is the one
document it can trust, and this is the second §9 bullet in eight days (after `.arming-log.txt`) whose
*direction* went stale while its hash-gate held. **A hash-gated canonical block is protected against
being EDITED, not against going STALE** — §9.5 says this about itself, and it has now happened again.

The correct rule is not a direction at all: **probe BOTH trees and `C:\po-watcher\verdicts-archive`,
and take the NEWEST** — which is sound whichever tree happens to be leading.

**DISPATCHED** → Station 00. The change is a DOCTRINE §9.5 edit inside `CANONICAL-BLOCK: instruments v2`,
so it needs the hash re-recorded via `lint-station.mjs --write-canonical` and all seven station docs
shipped together. 04 is read-only on the board and may not open a PR.

### F2 — NEW, not in §9: `| Measure-Object -Line` silently DROPS BLANK LINES, and it is the instrument §9.5's own falsifying probe prescribes. S2.

[MEASURED] on `origin/main:scripts/pipeline/lint-prompt.mjs`, dumped with `cmd /c` (so the §9.3 `>`
trap is excluded), then counted four ways:

```
node, LF count                                   1827
node, blank lines                                 121
node, non-blank lines                            1706
(Get-Content …) | Measure-Object -Line   .Lines  1706     <- WRONG, exit 0, no warning
(Get-Content …) | Measure-Object         .Count  1827     <- correct
```

`Measure-Object -Line` counts lines *within each pipeline element*, and an empty string contributes
**zero**. So the reading is not "the line count" — it is "the non-blank line count", off by exactly
the number of blank lines, with no error and no warning. It is a well-formed integer that was never
measuring what the reader thinks, which is §9.6 in its quietest form.

This is not academic. I hit it live, twice, this run:

1. `git show origin/main:scripts/pipeline/lint-prompt.mjs | Measure-Object -Line` returned **1706**
   against §9.5's *"(now 1824 lines)"*. The available conclusion was *"the file shrank 118 lines,
   §9.5's context has drifted"* — **wrong**; the file is 1827 lines and §9.5 is right. Had I written
   that up it would have been a confident, coherent, wrong finding about the one document every
   station is told to trust.
2. §9.5's `.arming-log.txt` bullet prescribes *"that two-line-count comparison"* as **its own
   falsifying probe**. Run with `Measure-Object -Line` it under-reports **both** sides by their blank
   counts — so a gap can be hidden (equal under-count both sides) or manufactured (unequal), and the
   probe that is supposed to keep a §9 bullet honest is itself the unreliable instrument.

Five angles: (1) reproduced on two different files (`lint-prompt.mjs` blob, `.arming-log.txt`) and on
both a piped native command and a `Get-Content` pipeline; (2) source is PowerShell 5.1's
`Measure-Object -Line` semantics, demonstrated against node on the identical bytes; (3) violated rule
is §9.6 and §7.1 — a number reported without knowing what the instrument is blind to; (4) history —
`Measure-Object -Line` appears nowhere in §9 and I found no prior finding on it; (5) blast radius —
every station-side line count in this pipeline, and specifically §9.5's arming-log probe.

Proposed §9.3 bullet, in one line: **never `Measure-Object -Line`. Count with
`(Get-Content …).Count`, or in node with `split('\n')` — and control any line count against a file
whose blank-line count you know.**

**DISPATCHED** → Station 00, same canonical-block PR as F1.

### F3 — §9.5's arming-log gap is OPEN again, exactly as the bullet predicted. S3.

[MEASURED] 2026-09-05T22:2xZ, counted in node (see F2 for why not `Measure-Object -Line`),
blank lines excluded on both sides:

```
origin/main:docs/pr-prompts/.arming-log.txt   54 rows
C:\ProjectOperations2\…\.arming-log.txt       55 rows
only on disk:
  2026-09-05T21:33:19Z  ARMED  pr-deps-s1-fasturi-browserslist-overrides  escalates=false
                        actor=marco-delegated  by=Marco@LAPTOP-E6NHU4E4  pid=33192  caller=powershell.exe:19064
git ls-files --error-unmatch docs/pr-prompts/.arming-log.txt   exit 0   (tracked)
same on a minted nonexistent path                              exit 1   (control)
```

§9.5 says the gap *"closes and re-opens by luck"* because **nothing commits the log on purpose**. It
has re-opened. One arm — the one that produced open PR **#1680** — exists only on disk, so any clone,
CI job or cloud-fired station reading `origin/main` sees an arm history that ends before 21:33Z and
does not know it. Per the bullet, an arm age read from `origin/main` is a LOWER bound, never the answer.

Also worth stating plainly against a stale prior: **an arm DID happen today at 21:33:19Z.** Any note
claiming "0 arms since 2026-09-04T22:03Z" is out of date.

**DISPATCHED** → Station 00: commit `docs/pr-prompts/.arming-log.txt` with the next board PR, and
close the underlying defect (nothing commits it on purpose) rather than closing it by luck again.

### F4 — Watcher-clone stash growth: 66. S3.

[MEASURED] `git -C C:\po-watcher\ProjectOperations stash list` → **66** entries. §9.2 calls this a
CLOSED LOOP — the launcher preflight stashes on every start and nothing ever pops — and instructs
stations to report the count and its growth. Reporting it. `git stash drop`, **never `pop`**; that is
Station 03's call, not mine.

**DISPATCHED** → Station 03 (Machine Minder), which owns the watcher clone.

### F5 — §9.6 negative-needle contamination is growing measurably within a single day. S3.

Measured above: **47** and **39** at 22:2xZ against **40** and **36** at 18:1xZ, over the same corpus,
+7 / +3 in about four hours. The rule and its cure already exist in §9.6 and landed today; nothing is
missing from DOCTRINE. What this adds is the growth rate, which makes the case that the two burned
needles should be treated as permanently unusable rather than merely discouraged.

**DEFERRED.** It becomes urgent when a run quotes one of the burned needles as a passing negative
control in a finding — at which point that finding is unsound. Nothing to do this run beyond the
minting discipline, which I followed.

## WHAT I DID NOT DO

- **Did not fast-forward the dev tree** although it is 2 commits behind `origin/main` with 39 dirty
  lines. 04 must not run branch-changing git commands in the shared dev tree, and the FF is Station
  00/03's. Every claim above was read from `origin/main` by SHA or from disk deliberately, so no
  reading depends on the working copy being current — and the three binding docs were proven identical
  to `origin/main` before I read them.
- **Did not commit `sweep-rotation.json`.** Left dirty and named above, per the AUTHORITY section.
- **Did not stage a prompt.** F1 and F2 are edits inside the hash-gated `instruments v2` canonical
  block, which requires the seven station docs to ship together with a re-recorded hash; that is
  Station 00's lane and a prompt from me would not be the right vehicle. Staged-prompt budget used: 0 of 2.
- **Did not act on the CAUTION verdict as a blocker**, because I performed no board mutation for it
  to guard. I also did not re-run `status-sweep.ps1` before "acting", since nothing this run was an act.
- **Did not run Part 0 / Part 1 / Part 2** of the legacy station brief. The AUTHORITY section says
  ONE named sweep per run, covered completely, and the rotation named `instrument-honesty`. Part 0's
  static audit, the GitHub reconciliation and the live-site visual pass were all left alone deliberately.
- **Did not open the Dependabot page or touch #1680**, though it is the dependency PR and it is green.
  Merging is not mine.
- **Did not propose retiring the `gh run list --branch main` bullet** on the strength of one fresh
  reading. The claim is conditional and a single non-reproduction cannot falsify it.
