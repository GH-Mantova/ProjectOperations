# Station 04 — Scanner | 2026-09-15T22:22:18Z–2026-09-15T22:33:15Z

Sweep this run: **instrument-honesty** (rotation position 2 of 4, per `node scripts/pipeline/next-sweep.mjs`).

## GROUND

```
UTC            2026-09-15T22:22:18Z
origin/main    64053600            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ 09ce4ffc     C:\ProjectOperations2
doc version    1                   (station_doc_version, docs/pipeline/stations/04-scanner.md)
bootstrap      1                   (station_doc_version declared by the scheduled-task SKILL.md)
```

Doc version and bootstrap **agree** (1 == 1), so this run was not forced read-only by mismatch — it is
read-only because 04 always is.

Tree read in: the **dev tree**, `C:\ProjectOperations2`, per PREFLIGHT step 2's red rule.
The dev tree HEAD (`09ce4ffc`) is behind `origin/main` (`64053600`), so the three binding documents
were checked for difference rather than assumed current, with the sound form (§9.1 — no piped hash):

- `[MEASURED]` `git diff --numstat origin/main -- docs/pipeline/stations/04-scanner.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY output**, i.e. all three working copies are byte-identical to `origin/main`. Read from the working copy on that basis.

Device-bridge git guard (PREFLIGHT step 1, quoted pass or fail):

- `[MEASURED]` `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` last line:
  `persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`
  (preceding line: `vm-git-guard installed at /sessions/<id>/.local/bin/git - refuses mounted paths and mounted cwd, allows everything else (three controls passed)`). **PASS.**

Shell reached on the first attempt: `start_process`, shell `powershell.exe`, PID 16136 →
`main` / `09ce4ffc`. **This was a SIGHTED run.**

Fresh negative-control needle minted for this run, per §9.6: `zzQq04Needle20260915T2230`.
⚠️ **It is spent the moment this file is tracked — do not reuse it.**

## WHAT I MEASURED

### The sweep verdict (PREFLIGHT step 4)

`[MEASURED]` `powershell -NoProfile -File scripts\pipeline\status-sweep.ps1`, captured to file and
decoded `utf16le` per §9.3's `*>` bullet (63,864 B / 243 lines), generated `2026-09-15 22:23:04Z`:

- §0 instrument positive controls: `gh CAN reach GitHub (saw merged PR #1970)`, `node runs`. Both pass.
- §3 safe-to-act signals: `git index.lock interactive/clone: False / False`; `git processes touching our trees (scoped): 0`; `no PR touched on GitHub in the last 2 min`. **No lock to age; nothing to classify as stale.**
- §1: 4 open PRs (`#1972 #1971 #1967` BLOCKED, `#1960` DIRTY), `main CI on 64053600: 4 success / 0 failed (trunk green)`.
- §4: `armed (*-ready.md): 0`.
- ⚠️ `[MEASURED]` The captured report ends after §5; **no §6 or §7 section header is present in the 243 lines**. That is recorded as an observation only — it is outside this run's sweep and I did not chase it.

⚠️ Per §9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`, one `[LIVE]` line was re-derived from its own
source before being believed — see F2.

### The instrument-honesty sweep — 13 probes, each against the corpus **its own bullet names**

🔴 §9.6's closing rule was obeyed: **no probe was pointed at `DOCTRINE.md`**, because that document
contains a literal instance of every broken query it records.

Script: `C:\po-sup-fix-scripts\s04-instrument-honesty-20260915.ps1`, run with `-File`, output captured
and decoded. **A literal `MARKER_Pn` was echoed after every probe and all thirteen markers are present
in the drained buffer** (§9.1 guard 1 — a statement that never ran and a statement that found nothing
are otherwise byte-identical). `DONE exit=0`.

| # | §  | trap | measured | verdict |
|---|----|------|----------|---------|
| P1 | 9.2 | `ls-tree` depth, corpus `docs/pr-prompts/superseded` | no slash, no `-r` → **1** · trailing slash → **219** · `-r` → **425** | **still trapped** |
| P2 | 9.2 | `ls-tree` has no glob pathspec | `-- 'docs/pr-prompts/superseded/*.md'` → **0** · the bullet's own failing control `-- 'docs/pr-prompts/*.md'` → **0** · literal prefix `-- docs/pr-prompts/` → **59** | **still trapped** |
| P3 | 9.2 | `check-ignore -v` on a DIRECTORY is silent | `docs/pr-prompts/processed` → exit **1**, empty · `CLAUDE.md` (tracked, genuinely not ignored) → exit **1**, empty · `docs/qa/qa-findings.md` → exit **0**, `.gitignore:116` | **still trapped** — opposite truths, identical results |
| P4 | 9.4 | `gh run list --commit <SHORT sha>` | short `64053600` → exit 0, **0 rows** · full 40-char → exit 0, **9 rows** | **still trapped** |
| P5 | 9.4 | `gh pr view <n> --json number` fabricates a row | `999999 --json number` → exit **0**, `{"number":999999}` · `--json number,state` → exit **1** · POSITIVE control `#1972 --json number,state` → exit **0** | **still trapped** |
| P6 | 9.4 | `@(ConvertFrom-Json …).Count` | inline on `'[]'` → **1** · assign-then-count → **0** · assign-then-count on 4 rows → **4** · `ConvertFrom-Json ""` → `$null`, `@($null).Count` → **1**, null-guarded → **0** | **still trapped**, both clauses |
| P7 | 9.3 | `Measure-Object -Line` drops blanks | `scripts/pipeline/lint-prompt.mjs`: `(Get-Content).Count` **2444** · `Measure-Object -Line` **2282** · blank lines **162** (2444−162 = 2282 exactly) | **still trapped** |
| P8 | 9.1 | automatic variable as loop target | `foreach ($home in @(1,2,3))` → `SessionStateUnauthorizedAccessException: Cannot overwrite variable HOME because it is read-only or constant`, **0 rows** · POSITIVE control `$loopVar` → **3 rows** | **still trapped** |
| P9 | 9.2 | `git branch -r` is a local cache | `git branch -r` → **50** · `git ls-remote --heads origin` → **15** | **still trapped** |
| P10 | 9.5 | sweep clone-dirty flag counts untracked | clone `git status --short` → **1** · `git status --porcelain --untracked-files=no` → **0** | **still trapped** — see F2 |
| P11 | 9.6 | a written-down negative control is a positive | spent needle `zzz`+`NoSuchNeedleZzz` over `docs/pr-prompts/**` → **60** hits (was 40 on 2026-09-05 — monotonic, as the bullet predicts) · fresh minted needle → **0** · POSITIVE control `premise` → **3417** | **still trapped** |
| P12 | 9.1 | trailing `\*` + `-Recurse` + type filter | fixtures rebuilt to the **2026-09-11 corrected spec**: A (a `.log` at depth 1) `bareFilter=3 starFilter=3 bareFile=3 starFile=3` · B (`top.txt` at depth 1) `2 / 2 / 3 / 3` · **C (ZERO files at depth 1) `2 / 0 / 2 / 0`** | **still trapped**, and the corrected fixture spec is confirmed: only C discriminates |
| P13 | 9.1 | single-quoted `\\` needle can never match a Windows path | corpus = the **11** `SKILL.md` under `C:\Users\Marco\Claude\Scheduled`: broken form `'C:\\ProjectOperations2\\docs\\pipeline'` → **0** · working form (single backslash, double-quoted) → **17** | **still trapped** |

🔴 **Zero of the thirteen failed to reproduce. Nothing in §9 is retired by this run.**

### Citation resolution (the §9.5 `CITATION_PROBE_BLIND_TO_DOTFILES_V1` probe, re-run)

`[MEASURED]` `node C:\po-sup-fix-scripts\s04-citation-resolve-20260915.mjs`, using the
**dotfile-tolerant** regex the bullet prescribes verbatim, over 16 files (CLAUDE.md + DOCTRINE.md +
STATION-CAPABILITIES.md + all 7 station docs + all 11 scheduled `SKILL.md`). `.gitignore` is
**151 lines**. Every `.gitignore:<N>` citation was resolved against the actual line:

| home | citation | resolves to | verdict |
|---|---|---|---|
| `DOCTRINE.md` | `.gitignore:28` ×2 | `28  .claude/` | ✅ correct |
| `DOCTRINE.md` | `.gitignore:75` ×3 | `75  docs/pr-prompts/*-ready.md` | ✅ correct |
| `DOCTRINE.md` | `.gitignore:76` ×2, `:76-83` ×4 | `76  docs/pr-prompts/processed/` … `83  …/no-pr-opened/` | ✅ correct |
| `STATION-CAPABILITIES.md` | `.gitignore:28` ×2 | `28  .claude/` | ✅ correct |
| stations `00`–`06` | `.gitignore:75`, `:76-83`, `:28` (9 citations) | as above | ✅ all correct |
| **BOOTSTRAP `00`, `02`, `03`, `04`, `05`** | **`.gitignore:107-111`** ×1 each | `107 !Claude Design/docs/` · `108 !Claude Design/assets/` · `109 Claude Design/assets/*` · `110 !Claude Design/assets/routes.js` · `111 !Claude Design/proposed/` | 🔴 **WRONG** |

`[MEASURED]` where the five QA sinks actually are today: `qa-checklist.md` **115** · `qa-findings.md`
**116** · `qa-test-data-registry.md` **117** · `.qa-run.lock` **118** · `qa-run-*.md` **119**.
NEGATIVE control (fresh needle in `.gitignore`) → **0**.

⚠️ `[INFERRED]` The dotfile-tolerant regex reports 132 raw hits across those 16 files against 16
extension-keyed. **Do not read those two numbers as the bullet's 17-vs-6:** my corpus is 16 files
rather than the bullet's 9, and the raw form also matches ISO timestamps (`07:08`). Only the
`.gitignore` subset above was resolved by hand, and only it is claimed.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — advanced via
  `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-15T22:22:18Z` (exit 0). Read back:
  `last_index=1 last_run_utc=2026-09-15T22:22:18Z last_station=04-scanner`. **LEFT DIRTY in the dev
  tree — Station 00 commits it, because 04 may not.**
  ⚠️ It was **already** ` M` when this run started, so the previous run's advance is also still
  uncommitted (§9.2's behind-HEAD caveat was applied: `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` was **NOT** empty, so this is real uncommitted work, not a behind-HEAD artefact).
- This breadcrumb, written to the tracked path `docs/pr-prompts/`. It is **untracked** until a board
  PR commits it — Station 00, please sweep it up.
- Scratch only, outside the repo: `C:\po-sup-fix-scripts\s04-instrument-honesty-20260915.ps1`,
  `s04-citation-resolve-20260915.mjs`, `s04-probe-out.txt`, `sweep-04-20260915.txt`,
  `gcifix-20260915\` (the P12 fixtures).
- **Nothing on the board.** No prompt armed, disarmed, renamed, moved or staged. No PR opened,
  labelled or merged. No `sot/` file touched.

## FINDINGS

### F1 — The five scheduled bootstraps still cite `.gitignore:107-111`, which still points at the Claude Design allowlist. Day 10. (S3)

**What.** Every one of `C:\Users\Marco\Claude\Scheduled\{00-supervisor, 02-board-driver,
03-machine-minder, 04-scanner, 05-sot-keeper}\SKILL.md` carries *"Never one of the five gitignored
sinks named at `.gitignore:107-111`"*. `[MEASURED]` at `64053600`, those five lines are the
**`!Claude Design/…` negation block**; the five QA sinks are at **115-119**. Both wrongly-cited lines
are negations, so a station that checks its own citation reads `!Claude Design/assets/` under a
sentence claiming `docs/qa/qa-findings.md` is gitignored — and the available conclusion is that the
file is a safe tracked place to write a finding. It swallowed a released gate for nine days once.

**Five-angle.** (1) Re-run twice, from the resolver script and by hand against the bootstrap text —
including **this run's own bootstrap**, which quoted the stale phrase in its opening turn. (2) Source:
the citations are in the scheduled-task layer, outside the repo and outside CI. (3) Ground truth:
§9.5's anchor-by-symbol rule and its 2026-09-15 `CITATION_PROBE_BLIND_TO_DOTFILES_V1` correction.
(4) History: **already filed** —
`docs/pr-prompts/needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, ITEM 1, filed
by Station 00 at `d5d6ad69` on 2026-09-06, from 04's own source finding. **The repo half was fixed
then (22 citations replaced with rule text, not renumbered) and is confirmed clean by the table
above; the five-paste half is the part that is still open.** (5) Blast radius: five of the eleven
`SKILL.md`, four of them behind enabled tasks.

**What this run adds** is only the re-stamp, which the escalation itself asks for: the drift is
**unchanged at day 10**, the repo side has **not** re-rotted in that window, and no agent has quietly
edited the bootstraps in the meantime. The recommended replacement text is already written out in the
escalation file, ready to paste.

**DISPOSITION: ESCALATED** — with Marco since 2026-09-06 as
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`. Nothing new is asked of him
here beyond ITEM 1's existing five one-line pastes; this entry exists so the escalation is not read as
stale evidence (§7.1's re-read rule) and is not cleared on age.

### F2 — `status-sweep.ps1`'s clone-dirty warning now has a PERMANENT producer, not a transient one (S3)

**What.** `[MEASURED]` the sweep printed
`[LIVE] watcher clone: branch=main dirty=1  <-- NOT clean-on-main; the watcher may refuse to start`.
Re-derived from its own source, per §9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`, both forms against
`C:\po-watcher\ProjectOperations` in the same run: `git status --short` → **1**, and the form
`start-watcher.ps1` actually uses, `git status --porcelain --untracked-files=no` → **0**. So the
warning is false, exactly as DOCTRINE §9.5's 2026-09-10 bullet records.

**What is new is the producer.** That bullet names the files as *"review verdicts the `rev-<N>` job
writes into the clone by design"*, i.e. a transient class that clears when the verdict is mirrored.
The single file today is **`?? scripts/pr-watcher/.conflict-notified-prs.json`** — a state file the
watcher itself writes. `[MEASURED]`: `git check-ignore -v` on it → exit **1** (not ignored), and
`git ls-tree -r --name-only origin/main -- scripts/pr-watcher` contains
`scripts/pr-watcher/__tests__/conflict-notified.spec.mjs` but **no `.conflict-notified-prs.json`**
(not tracked). Not ignored and not tracked means it sits `??` forever, so the clone's `dirty=` count
can never return to 0 and the false *"the watcher may refuse to start"* warning is now **permanent**
rather than self-clearing.

**Five-angle.** (1) Both `git status` forms run twice in the same minute, same tree. (2) Source: the
sweep's own `$cdirty = @(git status --short` anchor versus `start-watcher.ps1`'s
`# --- Pre-flight: branch + clean tree ---` anchor. (3) Ground truth: DOCTRINE §9.5, 2026-09-10 bullet
— whose measured cost is *"a MIS-ROUTED DISPATCH, repeatedly"*, 13 verbatim quotations of that line in
`archive/`. (4) History: `conflict-notified-prs` appears **17** times across `docs/pr-prompts/**`, but
in the context of the conflict-notify feature; I found **no** prior report of it as a producer of the
false dirty flag. NEGATIVE control, fresh needle over the same corpus → **0**. (5) Blast radius: every
future sweep, and any run that reads `dirty=` as a reason to dispatch 03 for clone hygiene.

**The two candidate fixes, RULE 1 order.** (a) **Complete and additive:** scope the sweep's `dirty=`
to `--untracked-files=no` so the flag measures the quantity its own sentence names — permanent, and it
cannot damage data entry because it only changes a report. (b) Gitignore the state file — passes
"without damaging" but **fails "completely"**: it silences this one producer and leaves the flag
still measuring the wrong quantity for the next untracked file. Both are `scripts/` changes and
therefore outside 04's lane entirely.

**DISPOSITION: DISPATCHED** — to Station 00, as a one-bullet addition to the existing §9.5 clone-dirty
bullet (its producer list is incomplete) plus the `status-sweep.ps1` scoping fix already named there.
04 staged no prompt for it: the 2026-09-10 bullet already carries the fix, and a second prompt for the
same repair is duplication, not coverage.

### F3 — `lint-prompt.mjs` is 2444 lines; §9.5 still says "(now 1824 lines)" (S4, opportunity)

`[MEASURED]` `(Get-Content scripts/pipeline/lint-prompt.mjs).Count` → **2444**. §9.5's anchor bullet
carries the parenthetical *"(now 1824 lines)"*. The bullet's **rule** — anchor by symbol, never by
line number — is untouched and correct, and the parenthetical is not a citation anyone resolves; it is
exactly the *state pasted into an instruction document* that §9.5's own closing line warns against.
Recorded because 04 hit the adjacent trap live once before (the 2026-09-05 `Measure-Object -Line` run
that nearly filed *"the file shrank 118 lines"*): this run's P7 read 2282 by that instrument and 2444
by the sound one, and a reader comparing either against 1824 gets a confident wrong answer about the
one document every station is told to trust.

**DISPOSITION: DEFERRED** — it becomes urgent the moment a run quotes the parenthetical as a
measurement instead of re-measuring. Editing `DOCTRINE.md` §9 means re-recording the canonical-block
hash, which is not 04's to do; 00 can fold it into any §9 PR it is already opening.

## WHAT I DID NOT DO

- **Only one sweep, completely.** `next-sweep.mjs` named `instrument-honesty` and that is all I ran.
  `gate-liveness`, `repo-hygiene` and `instruction-drift` were left alone on purpose — a shallow pass
  over everything is why findings rot. In particular I did **not** check for tracked `*-ready.md` at
  depth 1 (the board trap) or enumerate orphaned worktrees; the sweep's §2 reports two
  (`C:/PR-Master/worktrees/po-vg`, dirty=1, and `.../pr1823`), which belongs to `repo-hygiene` and to
  Station 03, not to me.
- **Did not commit `sweep-rotation.json`** or anything else. 04 is read-only on the board and the dev
  tree is on `main`, which nobody commits to directly.
- **Did not mint a worktree.** `origin/main` was read at a named SHA with `git show` / `git diff`, per
  the AUTHORITY block — an orphaned worktree's lock has no holding process by construction, forever.
- **Did not stage any prompt.** Neither finding needs one: F1's remedy is already written out in an
  open `needs-marco/` file, and F2's is a one-bullet correction to a DOCTRINE bullet that already
  exists.
- **Did not run the live-site (Part 2) or Dependabot (Part 1c) passes**, and did not run Part 0's
  static cross-layer audit. The station doc's AUTHORITY block makes the rotation sweep the run's named
  scope and `next-sweep.mjs` chose it; spending the budget elsewhere would have left it shallow.
  Recording the omission rather than letting a quiet run read as a clean one.
- **Did not probe any §9 bullet against `DOCTRINE.md` itself** (§9.6's closing rule), and did not
  re-use either spent negative-control needle as a control.
- **Did not touch `sot/`**, Azure, Entra, SharePoint, or any production data.
- **`[CANNOT MEASURE]`** why the captured `status-sweep.ps1` output ends after §5 with no §6/§7 header
  in 243 lines. Noted above; out of this sweep's scope and not chased, so no verdict is offered on it.
