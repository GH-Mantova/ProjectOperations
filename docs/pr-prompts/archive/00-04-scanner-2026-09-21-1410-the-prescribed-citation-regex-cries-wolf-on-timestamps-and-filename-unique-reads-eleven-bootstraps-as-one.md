# Station 04 — Scanner | 2026-09-21T14:10:14Z–2026-09-21T14:28Z

## GROUND

```
UTC            2026-09-21T14:10:14Z
origin/main    524158cd
dev tree       main @ 524158cd  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — full authority run.

Sweep taken: **instrument-honesty** (`next-sweep.mjs`, rotation position 2 of 4; previous run
2026-09-21T10:10:09Z). Advanced with `--advance --utc 2026-09-21T14:10:14Z` →
`last_index=1 last_run_utc=2026-09-21T14:10:14Z`, exit 0.
🔴 **`docs/pipeline/sweep-rotation.json` IS LEFT DIRTY IN THE DEV TREE** (`git diff --numstat
origin/main` → `2 2`). Station 00 commits it; 04 may not.

Host: PS `5.1.26100.9444`, `gh version 2.90.0 (2026-04-16)`, Desktop Commander present.
Device-bridge git guard installed at the top of the run, last line quoted verbatim:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim` (exit 0).

`status-sweep.ps1` §7 verdict: **[LIVE] SAFE TO ACT** — no board mutation in progress, no recent
remote activity, no live station worktrees. Trunk green on `524158cd` (4 success / 0 failed).

🔴 **§9.6's closing rule was obeyed: every §9 probe below was run against the corpus its own bullet
names, never against `DOCTRINE.md`.** Fresh needle minted this run,
`zzQq04HonestyNeedle` + `20260921T1415` — **0** over every corpus probed, **0** over the whole
binding-document corpus. It is spent the moment this file is tracked.

## WHAT I MEASURED

### §9 traps that STILL REPRODUCE (20 of 21 probed)

| # | trap | failing form | sound form / control |
|---|---|---|---|
| 9.1 | nested `-Command` expansion | `powershell.exe -NoProfile -Command "$CTRL=42; …"` → bare `=42` `CommandNotFoundException`, `$env:USERNAME` arrives pre-substituted as `Marco` | ROW A, statements sent **direct** to the DC shell → `ROW_A_direct_shell:42`. The 2026-09-14 transport correction is exactly right: only the NESTED form has a layer. |
| 9.1 | automatic variable as loop target | single-quoted `foreach ($home in @(1,2,3))` → `Cannot overwrite variable HOME because it is read-only or constant`, **0 rows** | `$loopVar` → `1 2 3` |
| 9.1 | `\*` + `-Recurse` + type filter | fixture C (**0 files of any kind** at depth 1): star+`-Filter` **0**, star+`-File` **0** | bare dir: **2** and **3**. Fixtures A (a `.log` at depth 1) and B (`top.txt` at depth 1) both return `2`/`3` on every form — i.e. **both are structurally unable to fail**, exactly as the 2026-09-11 correction says. |
| 9.1 | single-quoted `\\` needle | `'C:\\ProjectOperations2\\docs\\pipeline'` → **0** across all four enabled bootstraps | single backslash → **3 in each of the four**, 12 total (node, `split().length-1`) |
| 9.2 | `ls-tree` without `-r` | `-- docs/pr-prompts/superseded` → **1** | with `-r` → **439** |
| 9.2 | `ls-tree` glob pathspec | `-- 'docs/pr-prompts/*.md'` → **0** with `-r` AND **0** without | literal prefix `-- 'docs/pr-prompts/'` → **36** |
| 9.2 | `git status` blind to gitignored | `git status --porcelain -- docs/pr-prompts/rev-2051-ready.md` → **0 rows** while the file is armed on disk and in the sweep's `armed: 2` | `git ls-files --others --ignored --exclude-standard -- docs/pr-prompts` → **5405** |
| 9.2 | `check-ignore -v` on a DIRECTORY | `docs/pr-prompts/processed` → **exit 1, empty** | `CLAUDE.md`, a tracked file that genuinely is not ignored → **exit 1, empty**. Opposite truths, byte-identical results. Only the file form answers. |
| 9.2 | `git branch -r` reads the local cache | **105** | `git ls-remote --heads origin` → **20**. Worse than the 54-vs-21 on record. |
| 9.3 | `Measure-Object -Line` drops blanks | `DOCTRINE.md` → **2279** | `(Get-Content).Count` → **2616**; blank lines **337**; `2616 − 2279 == 337` → **True** |
| 9.3 | `SimpleMatch` + `[regex]::Escape()` | `permission-registry\.ts` over `stations/*.md` → **0** | raw `permission-registry.ts` → **1** |
| 9.3 | `*>` writes UTF-16LE | `status-sweep.ps1 *> sweep.txt` → **157,170 B** opening `FF FE`, 464 lines | decoded `utf16le` in node; all ten sections present |
| 9.4 | `@(ConvertFrom-Json …).Count` | `'[]'` → **1**, 4-element → **1**, `""` → **1** | assign-then-count → **0** / **4**; null guard on `""` → **0** |
| 9.4 | `--commit <short sha>` | `--commit 524158cd` → exit 0, **2 chars** (`[]`) | full 40-char SHA → **6 runs**: `CI`·`Deploy`·`CodeQL`·`Tendering Browser Smoke` all `success`, 2 × `Claude Code` `skipped/issue_comment` |
| 9.4 | `gh pr view <n> --json number` | `999999` → **exit 0**, `{"number":999999}` | `--json number,state` → **exit 1**, 0 chars; POSITIVE `2042` → `{"number":2042,"state":"OPEN"}` |
| 9.4 | `merged` on a LIST response | `gh api …/pulls?state=closed&per_page=10` → key **defined on 0 of 10**, `merged === true` on **0** | `merged_at` populated **10 of 10**; single GET `/pulls/2050` → `merged=True merged_at=2026-09-21T13:32:36Z`. The 2026-09-07 transport correction holds: through `gh` the key is ABSENT, not `false`. |
| 9.4 | `gh` infers repo from CWD | non-repo CWD, no `-R` → **exit 1, 0 chars** | non-repo + `-R` → exit 0, 81 chars; dev-tree CWD, no `-R` → exit 0, 81 chars |
| 9.5 | sweep clone-dirty flag | `git -C <clone> status --short` → **4** | `--porcelain --untracked-files=no` → **1**. They disagree, so the bullet stands. ⚠️ The **1** is real: ` M docs/data-model/metadata-catalog.json`. The other three are `?? docs/pr-reviews/pr-2042-review.md`, `?? pr-2047-review.md`, `?? scripts/pr-watcher/.conflict-notified-prs.json` — review-lane artefacts written there by design. |
| 9.5 | `STOP-WATCHER` sentinels live in the PARENT | naive `STOP-WATCHER*` search in dev tree **0**, in clone **0** | `C:\po-watcher\STOP-WATCHER-LANE2` → **True**; `C:\po-watcher\STOP-WATCHER` → **False** |
| 9.6 | needles you write down become positives | `zzz`+`NoSuchNeedleZzz` → **58**, `zzz`+`NoSuchTokenZzz` → **43** over `docs/pr-prompts` depth 1 + `archive/` + `needs-marco/` (29 + 629 + 63 files) | fresh needle **0**; POSITIVE `premise` → **915**. Contamination is up from the 40/36 on record — **monotonic, as predicted**. |

⚠️ **These counts are STATE. Re-measure them; never quote them.**

### The one §9 claim I could NOT reproduce this run

- ⚠️ **§9.4 `gh run list --branch main` "can be DAYS stale" did NOT reproduce.** [MEASURED]
  `--branch main --limit 5` → exit 0, 5 rows, newest `headSha` =
  `524158cd780551f590b8cbe3c092cabd57c96937`, **identical to `git rev-parse origin/main`**.
  🔴 **This is NOT drift and the bullet must NOT be retired on it.** The claim is *"can be"* — an
  intermittent staleness, not a deterministic transform — so one agreeing sample refutes nothing,
  and the prescribed cure (read CI per-commit with the FULL sha) costs nothing and is independently
  required by the short-SHA bullet directly beneath it. Recorded here only so the next
  `instrument-honesty` run does not read a single agreeing sample as a fix.

### Board and machine state (leads, not findings)

- [LIVE] 5 open PRs: `#2051` BEHIND/red · `#2049` green · `#2047` red · `#2044` red · `#2042` green.
  Trunk green on `524158cd`. Watcher node RUNNING pid 9744, heartbeat 2 min, build in flight
  (`pr-ops-m2b-tipping-tab-reminder-ready.md`).
- [LIVE] Scheduled-tasks MCP: **four** enabled tasks — `00-supervisor` `5 * * * *`,
  `03-machine-minder` `0 9 * * *`, `04-scanner` `0 */4 * * *`, `05-sot-keeper` `10 0 * * *`;
  `weekly-security-audit` **`enabled: false`**. STATION-CAPABILITIES §1's 2026-09-15 correction is
  current. `lastRunAt`: 00 `14:07:55Z`, 04 `14:09:34Z`, 05 `14:10:40Z` — **three stations inside 165
  seconds, 00×04 99 seconds apart**, which is §6's 2026-09-07 falsifying probe returning the same
  answer it was written with. That correction stands; the cron offsets remain Marco's.
- [LIVE] `check-breadcrumb.mjs` still reads `const CADENCE = { '00': 2, … }` at `524158cd` while the
  MCP reads `5 * * * *`. Already filed; re-confirmed, not re-filed. NEGATIVE control over that file → 0.
- [LIVE] Orphaned worktree `C:/PR-Master/worktrees/po-vg` `23c91ba9`
  [`fix/no-rebase-while-checks-run`], **dirty=1, age 24858 min** — holds uncommitted work; a
  `--force` prune would discard it. One registry-escapee, `C:\po-worktrees\po-fix-2005`, 0 KB,
  age 5672 min. Both are Station 03's.

## WHAT CHANGED

**Nothing on the board.** No PR opened, no prompt armed, disarmed, renamed, moved or deleted, no
label touched, no merge, no `/sot/` edit, no tracked-file write other than this breadcrumb.

Two writes, both declared:

1. `docs/pipeline/sweep-rotation.json` — advanced by `next-sweep.mjs --advance`, **left dirty in the
   dev tree**. Read back: `git diff --numstat origin/main` → `2 2`. **Station 00 commits it.**
2. This breadcrumb, at the tracked path `docs/pr-prompts/`. Untracked until a board PR carries it.

Scratch only, outside both repos: `C:\po-sup-fix-scripts\04-instrument-honesty-20260921.ps1`,
`04-honesty-part2-20260921.ps1`, `04-citation-probe-20260921.mjs`, two capture files, and the
throwaway fixture tree `C:\po-sup-fix-scripts\gci-fixtures-20260921\`.

## FINDINGS

### F1 — The prescribed dotfile-tolerant citation regex matches CLOCK TIMES, so the `lint-station` check the open escalation asks Marco for is born crying wolf (S3)

`CITATION_REGEX_MATCHES_TIMESTAMPS_V1`

§9.5's 2026-09-15 correction states the citation regex explicitly and instructs that *"any check
built from it must use this form and not an extension-keyed one"*:

```
(^|[\s(`"'])(\.?[A-Za-z0-9_.\-/]+):(\d+(?:-\d+)?)\b
```

`2026-09-06T23` and `14` both satisfy `[A-Za-z0-9_.\-/]+`, so `2026-09-06T23:04` and `14:10` are
matched as citations. [MEASURED] 2026-09-21T14:2xZ at `524158cd`, both forms over the corpus
**as the 2026-09-21 correction now states it** (every `SKILL.md` behind an enabled task + all seven
station docs + `DOCTRINE.md` + `STATION-CAPABILITIES.md` + `CLAUDE.md`):

| | extension-keyed | dotfile-tolerant | delta |
|---|---|---|---|
| whole corpus | **17** | **136** | **119** |

Of those 119, **13 files carry a real `.gitignore:<N>` citation** (POSITIVE control) and the
remaining bulk are clock times. Measured precisely on the worst offender, `DOCTRINE.md` alone:

| `DOCTRINE.md`, dotfile-tolerant regex | count |
|---|---|
| total matches | **88** |
| file part is a clock time (`\d+`, `…T\d\d`) | **56** |
| non-clock, i.e. candidate real citations | **32** |

Clock sample: `2026-09-06T03:47` · `2026-09-07T05:49` · `2026-08-31T01:21` · `05:27`. Three of the
32 non-clock "citations" are **this very run's own controls**, now quoted in §9.1 —
`CTRL-literal-is:42`, `ROW_A_direct_shell:42`, `ROW_B_nested_Command:42` — so the noise floor rises
every time a station lands a measurement. NEGATIVE control, fresh needle → **0 files**.

🔴 **Why this is worth a finding rather than a tidy-up.**
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` **ITEM 2** asks Marco for a
`lint-station.mjs` check that validates every `<file>:<N>` citation, and §9.5's correction tells its
author which regex to use. Built exactly as prescribed, that check reports **136** citations across
the corpus, of which **56 in `DOCTRINE.md` alone cannot resolve, because they are times of day**
([MEASURED], table above; the corpus-wide clock total is higher and was not enumerated per file).
A gate that fails scores of times on its first run is disabled by its first reader — and the class it exists to catch
(`.gitignore:107-111`, F2 below) is then no better protected than it is today. The 2026-09-15
correction removed a blindness and introduced a noise, and only the blindness was measured.

🔧 **Cure: require the file part to contain a `/` or a `.` AND reject an all-digit or `T\d\d`-terminated
file part** — e.g. anchor on `(\.?[A-Za-z0-9_.\-]*[/.][A-Za-z0-9_.\-/]*)` with a
`(?<!\d{2})(?<!T\d)` guard before the colon. Both real classes survive it: `.gitignore:28` (leading
dot, no extension) and `start-watcher.ps1:160`.
⚠️ **Falsifying probe: run the documented regex over `DOCTRINE.md` and count how many matches have an
all-numeric file part.** If that count is ever 0, this finding is wrong and must be re-measured.

**DISPATCHED** — Station 00, to fold the regex correction into §9.5 and to amend ITEM 2 of the open
escalation before Marco builds the check from the current text.

### F2 — `.gitignore:107-111` is still live in all four ENABLED bootstraps, 15 days after it was filed (S3, re-confirmation — NOT a new finding)

[MEASURED] `.gitignore` lines 107-111 at `524158cd` are `!Claude Design/docs/` ·
`!Claude Design/assets/` · `Claude Design/assets/*` · `!Claude Design/assets/routes.js` ·
`!Claude Design/proposed/`. The five Overnight-QA sinks are under the
`# Overnight-QA scheduled task` comment at **115-119**. Net **+8**, cause #1573/#1576.

The citation is present in **all four enabled bootstraps** (`00-supervisor`, `03-machine-minder`,
`04-scanner`, `05-sot-keeper`) — **including the one that opened this run**, which told me
*"Never one of the five gitignored sinks named at `.gitignore:107-111`"*. It is absent from the
repo-side layer: every station doc's `.gitignore:76-83` and `.gitignore:75` and
`STATION-CAPABILITIES.md`'s `.gitignore:28` **resolve correctly** (verified line by line).

🔴 **Angle 4 (history) says this is already on file and I am not re-filing it.**
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` ITEM 1 carries the identical
measurement, the identical cause and the exact replacement text for Marco to paste. What this run
adds is only a **fresh SHA on a claim that had none since 2026-09-06** (§7.1's re-read rule): it is
still true, still unpasted, and now sits in the only layer that governs a scheduled run and that an
agent cannot edit.

**DEFERRED** — real, already escalated, not urgent: the bootstrap sentence names the five files
inline, so a reader still has the names. It becomes urgent the moment anyone edits that sentence
down to the citation alone. Station 00 may wish to re-surface ITEM 1 to Marco alongside F1, since
the two are one paste.

### F3 — `Select-Object -ExpandProperty Filename -Unique` collapses a corpus of identically-named files to ONE, and that corpus is the bootstrap sweep (S3, NEW — not in §9)

`FILENAME_UNIQUE_COLLAPSES_SAME_NAMED_CORPUS_V1`

[MEASURED] 2026-09-21T14:3xZ at `524158cd`, over
`C:\Users\Marco\Claude\Scheduled\**\SKILL.md` (11 files), needle
`C:\ProjectOperations2\docs\pipeline`:

| form | result | truth |
|---|---|---|
| total hits | 17 | 17 |
| `… \| Select-Object -ExpandProperty Filename -Unique` — **the failing form** | **1** | 7 |
| `… \| Select-Object -ExpandProperty Path -Unique` — the cure | **7** | 7 |
| corpus size | 11 | 11 |

`Select-String`'s `Filename` is the **basename**. Every file in this corpus is named `SKILL.md`, so
the failing form answers **1** for any truth between 1 and 11, at exit 0, with nothing empty and
nothing warning — **§9.6 cannot fire, because the cmdlet answered exactly the question it was asked,
about a different quantity from the one the variable name implies.**

🔴 **It fired live in this run, on the probe it most endangers.** §9.1's double-backslash bullet is
about *"do the scheduled-task bootstraps name the working copy?"* — a per-FILE question over a
directory of identically-named files. My first pass reported *"1 file hit"*, and the available
write-up was *"only one bootstrap still names the working copy"*, which would have manufactured a
false drift finding against four healthy files. It was caught only because node, counting per path,
answered **3 in each of the four**. This is the same shape §9.5 records for
`check-breadcrumb.mjs`'s *"matched by trailing path segment"* — the pipeline has met basename
collapse before, in a different instrument, and never generalised it.

🔧 **Cure: `-ExpandProperty Path -Unique`, never `Filename`, whenever the corpus can hold repeated
basenames** — and `SKILL.md`, `README.md` and `index.mjs` corpora all can.
⚠️ **Falsifying probe: the four-row table above.** Re-run both forms over that directory; if
`Filename -Unique` ever returns 7, this finding is wrong and must be re-measured.

**DISPATCHED** — Station 00, for a §9.3 bullet. 04 is read-only on the board and does not edit
`DOCTRINE.md`.

### F4 — The per-document citation prediction was widened at the corpus and not at the prediction, so its own "NEW citation" sentence fires on six pre-existing ones (S3)

`CITATION_PREDICTION_OMITS_FOUR_STATION_DOCS_V1`

The 2026-09-21 correction restates the corpus as a RULE — *"all SEVEN station docs"* plus *"every
`SKILL.md` behind an ENABLED task"* — and then lists per-document predictions for only
`00`, `03`, `04`, `05`, `CLAUDE.md`, `STATION-CAPABILITIES.md` and `DOCTRINE.md`.
[MEASURED] `.gitignore:<N>` citations per document at `524158cd`:

| document | predicted | measured | citation(s) |
|---|---|---|---|
| `00-supervisor.md` | 2 | **2** ✅ | `.gitignore:76-83`, `.gitignore:75` |
| `03-machine-minder.md` | **0** | **1** ❌ | `.gitignore:76-83` |
| `04-scanner.md` | 1 | **1** ✅ | `.gitignore:76-83` |
| `05-sot-keeper.md` | 2 | **2** ✅ | `.gitignore:76-83`, `.gitignore:75` |
| `STATION-CAPABILITIES.md` | 1 | **1** ✅ | `.gitignore:28` |
| `CLAUDE.md` | 0 | **0** ✅ | — |
| `01-code-writer.md` | **not listed** | **2** | `.gitignore:28`, `.gitignore:76-83` |
| `02-board-driver.md` | **not listed** | **1** | `.gitignore:76-83` |
| `06-pr-master.md` | **not listed** | **1** | `.gitignore:76-83` |
| each of the 4 enabled `SKILL.md` | **not listed** | **1 each** | `.gitignore:107-111` (F2) |

🔴 **And one more the prediction does not cover, in `DOCTRINE.md` itself: `index.mjs:3545`** — a
first-class raw line-number citation in §8.5, not a quotation of a retired one. [MEASURED] against
`origin/main:scripts/pr-watcher/index.mjs`: line **3545** of **3610** is
`const watcher = fsWatch(PROMPT_DIR, { persistent: true }, (event, name) => {`, and
`fsWatch(PROMPT_DIR` occurs at exactly that one line (NEGATIVE control, fresh needle → 0). **It
resolves today** — and it is 98.5% of the way down a file this pipeline edits constantly, so any
insertion above it rots it silently. §9.5's opening rule is *"anchor by symbol, never by line
number"*; the symbol is right there in the cited line and should replace the number.

**Every one of the nine repo-side `.gitignore` citations resolves correctly**, as does
`index.mjs:3545`; only the four bootstrap ones do not. So none of this is a new violation — and
that is the point. The bullet's own sentence, *"if a
NEW raw line citation ever appears in a station doc, this clause is being ignored rather than being
wrong"*, is exactly what a run rebuilding the probe has to hand when it meets `01`, `02` and `06`.
The 2026-09-21 correction exists to stop a reader re-opening closed work off a count mismatch, and
it reproduces that failure one revision later, in itself.

🔧 **Add the four missing station-doc rows, the four bootstrap rows and `index.mjs:3545`, and fix
the `03` row to 1.** Better: state the prediction as *"every `<file>:<N>` citation in the corpus
resolves, and the only ones that do not are the bootstraps' `107-111`"* — a claim about TRUTH
rather than about COUNTS, which cannot rot when a document is added to the corpus. Converting
`index.mjs:3545` to its symbol anchor discharges it permanently.
⚠️ **Falsifying probe: the table above.** If `03-machine-minder.md` ever returns 0, this finding is
wrong.

**DISPATCHED** — Station 00, same §9.5 edit as F1.

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or deleted nothing.** 04 is READ-ONLY on the board
  (authority matrix: *Arm a prompt* ❌, *Create a PR* ❌, *Mutate the board* ❌ read-only).
  The sweep reported `ready=1` in the backlog (`rates-11c-blocked-consumers`) — **not mine to
  stage**, and it carries a live never-arm denylist entry besides. **Staged 0 prompts** this run:
  the sweep I was dealt is a measurement pass, and every finding above is a change to `DOCTRINE.md`
  or to a scheduled-task file, neither of which 04 may author.
- **Did not commit `sweep-rotation.json`, or anything else.** The dev tree is on `main`; nobody
  commits to `main` directly. Named in WHAT CHANGED for Station 00.
- **Did not edit `DOCTRINE.md`.** F1, F3 and F4 are all §9 edits. 04 reports §9 defects; it does not
  patch the document it is measured against — and §9 sits in a hash-gated canonical block.
- **Did not run Part 2 (live-site patrol) or a VISUAL pass.** The sweep rotation dealt
  `instrument-honesty`, and the station contract is *one named sweep per run, covered completely*.
  A shallow pass over everything is the failure that rule exists to prevent.
- **Did not prune the orphaned worktree or the registry-escapee**, and did not clear anything in the
  watcher clone. `C:/PR-Master/worktrees/po-vg` **holds 1 uncommitted file**; a `--force` would
  discard it. Station 03's, with the clone's genuine ` M docs/data-model/metadata-catalog.json`.
- **Did not touch Azure / Entra / SharePoint.** Absolute, and nothing this run came near it.
- **Did not run `git` through the device bridge.** The guard was installed first and its last line is
  quoted in GROUND; every `git` and `gh` call above ran in `powershell.exe` on the Windows host
  through Desktop Commander, with `-R GH-Mantova/ProjectOperations` on every `gh` call and
  `$LASTEXITCODE` tested before every parse.
- **Did not write to any of the five gitignored sinks.** This breadcrumb is the only report, at the
  tracked path, and it is **untracked until a board PR carries it** — Station 00 sweeps it up.
