# Station 04 — Scanner | 2026-09-07T06:10:04Z–2026-09-07T06:42Z

## GROUND

```
UTC            2026-09-07T06:10:04Z
origin/main    9a905ec6
dev tree       main @ 5e0e26b2  C:\ProjectOperations2   (7 behind origin/main, 0 ahead)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`) — this run was not read-only on that account.
SIGHTED run: `start_process` shell `powershell.exe` returned a live prompt on the Windows host.
PS `5.1.26100.9168`. TZ `E. Australia Standard Time` (UTC+10).

Device-bridge git guard, run at the top of the run per the PREFLIGHT block, last line quoted:
`vm-git-guard installed at /sessions/lucid-pensive-babbage/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)` — exit 0. [MEASURED]

`status-sweep.ps1` (captured to a file, so its §7 verdict is not lost to an early return):
`§7 VERDICT — [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
station worktrees.` · watcher node RUNNING pid 31660 · `index.lock` interactive/clone `False/False` ·
`armed (*-ready.md): 0` · watcher clone `branch=main dirty=5`. [MEASURED]

**SWEEP THIS RUN: `instrument-honesty`** (rotation position 2 of 4), from
`node scripts/pipeline/next-sweep.mjs`. Advanced afterwards and **LEFT DIRTY** — see WHAT CHANGED.

**Fresh needle minted for this run: `zzQq04Nd20260907T0620`.** It returned **0** on every corpus it
was run against (the processed-log directories, the watcher log copies, `lint-prompt.mjs`,
`index.mjs`, `check-breadcrumb.mjs`, `C:\po-watcher\*`). **It is spent the moment this file is
tracked — do not reuse it.** (§9.6.)

## WHAT I MEASURED

All three binding documents read in full this run. `DOCTRINE.md` was read from
`git show origin/main:docs/pipeline/DOCTRINE.md` — **necessarily**, because
`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md` returned `0 43`: the working copy is
missing 43 lines `origin/main` has. `STATION-CAPABILITIES.md` and `stations/04-scanner.md` returned
EMPTY numstat against `origin/main` and were read from disk.

### §9 traps RE-PROVED — reproduce exactly as written

| § | probe | result | verdict |
|---|---|---|---|
| 9.1 `\\` needle | `-SimpleMatch 'C:\\ProjectOperations2\\docs\\pipeline'` vs single-backslash, over the 5 station bootstraps | **0** vs **3** on all five; NEG 0 on all five | REPRODUCES |
| 9.2 ls-tree depth | `-- docs/pr-prompts` · `-- docs/pr-prompts/` · `+ -r` | **1** · **70** · **875** | REPRODUCES |
| 9.2 ls-tree glob | `-- 'docs/pr-prompts/*.md'` with and without `-r` | **0** and **0**; filtered truth **62** | REPRODUCES |
| 9.2 check-ignore | dir · `CLAUDE.md` (tracked, not ignored) · a file inside `processed/` | exit **1** empty · exit **1** empty · exit **0** `.gitignore:76` | REPRODUCES — the two silences are byte-identical |
| 9.2 branch -r | `git branch -r` vs `git ls-remote --heads origin`, after `fetch --prune` | **26** vs **13** | REPRODUCES |
| 9.3 `>` redirection | `git show origin/main:CLAUDE.md > f` vs the same via `cmd /c` | **3974 B** `FF FE` vs **1960 B** `23 20` | REPRODUCES |
| 9.3 `Measure-Object -Line` | on `lint-prompt.mjs` | `-Line` **2207** · `.Count` **2368** · blanks **161** (2368−161 = 2207) | REPRODUCES |
| 9.3 SimpleMatch + `[regex]::Escape()` | needle `lint-prompt.mjs` | escaped **0** · plain **12** | REPRODUCES |
| 9.4 `ConvertFrom-Json` collapse | inline vs assign-then-count, `[]` and a 4-element array | inline **1** / **1**; assigned **0** / **4** | REPRODUCES |
| 9.4 `gh run list --commit` | short (8) vs full (40) SHA of `origin/main` | **0** vs **4** | REPRODUCES |
| PREFLIGHT piped hash | `git show … \| git hash-object --stdin` in PS vs `git rev-parse` vs the same pipe under `cmd /c` | PS `7351d088…` · truth `9d465381…` · cmd `9d465381…` | REPRODUCES |
| 9.5 arming markers | anchors in `origin/main:scripts/pipeline/lint-prompt.mjs` | `DO_NOT_ARM_COMMENT = /<!--\s*watcher:\s*do-not-arm\s*-->/i` · `DO_NOT_ARM_CAPS = /DO NOT ARM/` · `ARM_ONLY = /Arm ONLY/i`; `HUMAN_GATE_PRESENT: line` ×3 | CONFIRMED — only `DO_NOT_ARM_CAPS` is case-sensitive, as §9.5's 2026-09-06 correction says |
| 9.5 STOP-WATCHER | `Test-Path` both, plus NEG | `C:\po-watcher\STOP-WATCHER-LANE2` present **1090 B**; `STOP-WATCHER` **absent**; NEG **0** | CONFIRMED |
| 9.5 RULE 2 two homes | log count · newest · `marco.:true` · NEG, per tree | dev **2039** logs, newest `rev-1763-ready.md.log` **05:56:25Z**, POS **619**, NEG 0 · clone **21** logs, newest **2026-08-17T14:28:09Z**, POS **10**, NEG 0 | CONFIRMED — the decoy still passes its own positive control while 21 days stale |
| 9.5 arming log | working copy vs `origin/main` line counts, node-side both | **64** and **64**; tracked exit **0**; NEG exit **1** | CONFIRMED — the publish gap is CLOSED right now |
| 9.5 log name never rolls | `$LogFile = Join-Path $LogDir ("{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))` — no `-AsUTC` | anchor found verbatim; **5** daily logs are named before the day they were last written (`2026-09-04.log` last write `2026-09-06T05:27:31Z`) | CONFIRMED, and the name-drift is directly observable |
| 10.1 `NESTED_TEST_PATHS` | the array itself | `[/^(tests\|docs)\//, /(^\|\/)__tests__\//, /\.(test\|spec)\.[cm]?[jt]sx?$/]` — **three** forms; POS `classifyPolicyFiles` **2**; NEG **0** | CONFIRMED |
| 10.2.1 CP-26 vacuous | `origin/main:scripts/pr-gates/approval-receipt.mjs`, its own verdict table | `!labelPresent && !everLabeled -> PASS NEVER_ESCALATED`, ahead of the receipt clause; `everLabeled` ×5 | CONFIRMED — CP-26 is armed by LABELLING, not by the diff |
| 10.3 anchors | `MERGE_TIMEOUT_MS` · `allGreen` · `waitForPolicyMerge` · `runVerdictArchiveSweep` · `VERDICT_HOME_RESOLVER` | 1 · 1 · 1 · 3 · **6** | all resolve; `VERDICT_HOME_RESOLVER` = 6 matches the recorded discharge |
| STATION-CAPABILITIES §6 | `const CADENCE =` in `check-breadcrumb.mjs` | `{ '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`; NEG **0** | **`'00'` is STILL `2`** — the one-character fix has NOT landed. `--freshness` will not call 00 SILENT until three consecutive missed hourly runs |

### Live schedule, from the scheduled-tasks MCP (never from a table in a doc)

**5 enabled tasks.** `00-supervisor` `5 * * * *` lastRun `2026-09-07T06:08:25Z` · `04-scanner`
`0 */4 * * *` lastRun `2026-09-07T06:10:04Z` · `05-sot-keeper` `10 0 * * *` lastRun
`2026-09-06T14:11:01Z` · `03-machine-minder` `0 9 * * *` lastRun `2026-09-06T23:01:13Z` ·
**`weekly-security-audit`** `30 7 * * 1` lastRun `2026-09-06T21:32:44Z`. [MEASURED]

`C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md` files. The five station bootstraps all
carry mtime `2026-09-01T00:07:44Z` — one batch, but **not** the `2026-08-24T22:54:22Z` recorded in
STATION-CAPABILITIES §1 (that paragraph says to measure it, so this is state, not drift).
`02-board-driver` has a folder and **no task** — §5's "a folder is not a task" rule, re-confirmed.

### Leads (measured, not dispositioned)

- `lint-prompt.mjs` is now **2369** lines (node `split('\n')`) / **107,152 B**. §9.5's parenthetical
  still reads *"(now 1824 lines)"*. That is state inside an instruction, which §9.5 itself flags —
  recorded here rather than filed, because the sentence around it anchors by SYMBOL and is sound.
- `origin/main:scripts/security-audit.ps1` — the script `weekly-security-audit` runs — is **2321 B,
  41 lines, ZERO non-ASCII bytes**, and is present in the dev tree. Its bootstrap's fallback path
  pipes it through `git show … | powershell.exe -Command -`, which re-encodes native stdout (§9.3).
  Safe **today** only because the file is pure ASCII. See F6.
- The dev tree is **7 behind** `origin/main`, **0 ahead**, with 61 `git status` lines. The two ` D`
  entries (`pr-armguard-s1-…-HOLD.md`, `pr-deps-s2-puppeteer-…-HOLD.md`) are consumed HOLDs whose
  own PRs delete them — LEFT ALONE.

## WHAT CHANGED

1. `docs/pipeline/sweep-rotation.json` — advanced via
   `node scripts/pipeline/next-sweep.mjs --advance --utc 2026-09-07T06:10:04Z`, exit 0.
   Read back: `last_index` **0 → 1**, `last_run_utc` **2026-09-07T02:21:48Z → 2026-09-07T06:10:04Z**,
   `git diff --numstat origin/main` **empty → `2 2`**. **LEFT DIRTY IN THE DEV TREE.**
   🔧 **Station 00 must commit this file with the next board PR — 04 may not commit to `main`.**
2. This breadcrumb, written to the tracked path `docs/pr-prompts/`. **Untracked until a board PR
   sweeps it up** — 00 collects it.
3. Scratch only, outside the repo: `C:\po-sup-fix-scripts\s04-instrument-honesty*-2026-09-07.*`
   and `C:\po-sup-fix-scripts\_tmp04\`.

**No board mutation. Nothing armed, disarmed, renamed, moved, labelled, merged or pushed.**

## FINDINGS

### F1 [S2] — §9.1's `-Include` bullet is wrong about `-Recurse`, and it is wrong in the direction of teaching a reader to distrust a WORKING query

The bullet's headline is *"`Get-ChildItem <dir> -Recurse -Include '*.log'` RETURNS NOTHING, EXIT 0,
UNLESS THE PATH ITSELF ENDS IN A WILDCARD"*, and its worked example includes `-Recurse`.

[MEASURED] 2026-09-07T06:22Z, PS `5.1.26100.9168`, three ways:

| form | dir form | `<dir>\*` form | `-Filter` | truth |
|---|---|---|---|---|
| real dir, **WITH** `-Recurse` (`…\scripts\pr-watcher`) | **45** | **45** | 45 | 45 |
| purpose-built fixture (`top.log` + `sub\nested.log` + `sub\other.txt`), **WITH** `-Recurse` | **2** | **2** | — | **2** |
| purpose-built fixture, **WITHOUT** `-Recurse` | **0** | **1** | — | 1 at depth 1 |
| `C:\po-watcher`, **WITHOUT** `-Recurse` | **0** | **7** | 7 | 7 |

**So the mechanism is real for the no-`-Recurse` form and does NOT reproduce with `-Recurse`.**
`-Recurse` rescues the bare-directory path on this PowerShell build, in both a real tree and a
controlled fixture whose truth is known by construction.

⚠️ **[CANNOT MEASURE] the exact documented query.** `Get-ChildItem C:\po-watcher -Recurse -Include
'*.log'` recurses `node_modules` and did **not return in 6 minutes**; it was terminated. So the true
cause of 00's 2026-09-06T17:2xZ zero is unmeasured from here — the remaining candidates are the
*"filtered to the last two hours"* clause the bullet mentions in passing, or the recursion itself.
What is measured is that the *stated* mechanism is not what produced it.

**Why this matters more than an ordinary doc error.** §9 exists to stop a station believing a broken
instrument. A §9 bullet that is wrong in this direction does the inverse: it tells a station its
*working* query is broken, which is how a real absence gets papered over as an instrument fault.
This is §9.5's closing bullet — a claim outliving its truth in the one document every station is told
it can trust — inside §9.1.

🔧 **Complete-and-additive fix (RULE 1): keep the bullet, narrow its scope to the no-`-Recurse`
form, and record the `-Recurse` non-reproduction with the fixture above as its falsifying probe.**
Nothing is retired: `-Filter` and the wildcard path remain the prescribed cures, and the
*"control any recursive file search against a file you know is there"* clause is untouched and is
what a reader needs either way. The alternative — deleting the bullet — fails the *future* half of
RULE 1, because the no-recurse form is live and reproduces at the very root the bullet names.

**DISPOSITION: DISPATCHED** → Station 00, as a DOCTRINE §9.1 correction. 04 is read-only on the
board and does not open PRs.

---

### F2 [S2] — the "newest `*.log` by `LastWriteTimeUtc`" cure, landed eight hours ago, can select a log with ZERO lane information

DOCTRINE §9.5's 2026-09-06T23:0xZ correction (Station 03 F1, landed by 00 at 23:3xZ) reads: *"Take
the NEWEST `*.log` in that directory by `LastWriteTimeUtc`, and never construct the name from a
date, in either clock."* The name half is right and is re-proved above. **The selection half has an
unguarded collision.**

[MEASURED] over `C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs` — 44 `*.log`, each copied
before reading (the live file is held open by the watcher):

| file | `LastWriteTimeUtc` | bytes | `opened PR #` | `[merge]` (POS) | NEG |
|---|---|---|---|---|---|
| `2026-09-07.log` | **06:23:15Z** | 55,140 | 2 | 5 | 0 |
| **`supervisor.log`** | **05:38:27Z** | 680,086 | **0** | **0** | 0 |
| `2026-09-06.log` | 2026-09-06T23:04:05Z | 145,258 | 5 | 11 | 0 |
| `2026-09-04.log` | 2026-09-06T05:27:31Z | 244,157 | 10 | 20 | 0 |

**Five of the 44 are not daily logs** — `supervisor.log`, `supervisor.rot-20260814-235900.log`,
`supervisor.rot-20260814-221005.log`, `supervisor.crashed-20260814-182052.log`,
`supervisor.crashed-20260814-160809.log`.

`supervisor.log` **was written today**, is currently **second-newest by 45 minutes**, and answers
`opened PR #` → **0** and `[merge]` → **0**. Any gap longer than that margin — a watcher relaunch, a
kill-loop pause, the daily file rolling to a new name at the next launch — makes it the newest, and
the prescribed cure then hands the reader a log where **every count is zero and the positive control
also fails**. That is §9.6 exactly — an empty result read as an empty world — sitting inside the
cure written for §9.6 eight hours earlier. It is the same shape as the `ensure-watcher.log` warning
already in that bullet, except that warning names one file by hand and this one is structural.

🔧 **Complete-and-additive fix (RULE 1): filter to the daily-log NAME SHAPE and *then* take the
newest by mtime** — `Get-ChildItem "$logDir\*" -Filter '*.log' | Where-Object { $_.BaseName -match
'^\d{4}-\d{2}-\d{2}$' } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1`.
This keeps the whole of the 23:0xZ correction (the name is still never *constructed*, only
*validated*), adds the guard, and damages nothing: the falsifying probe stays the two-file table.
The alternative — naming `supervisor.log` in prose as `ensure-watcher.log` is named — fails the
*future* half of RULE 1: it is exhaustive-by-hand over a directory that has already accumulated
five non-daily names, and the sixth will not be in the prose.

⚠️ **Falsifying probe:** re-run the table above. If `supervisor.log` stops being written, or the
daily-log shape guard is in place, this finding is dead.

**DISPOSITION: DISPATCHED** → Station 00, as a DOCTRINE §9.5 amendment in the same PR as F1.

---

### F3 [S3] — §9.4's `merged`-on-a-list bullet has the wrong SYMPTOM for `gh`, and a reader checking it through `gh` will read the trap as dead

The bullet asserts *"`merged` READS FALSE ON EVERY ENTRY OF A PULL-REQUEST LIST RESPONSE"* and gives
`{"merged": false, "merged_at": "…"}` as the shape to look for. It was measured through the **GitHub
MCP**, which is the only transport named in it.

[MEASURED] 2026-09-07T06:3xZ through `gh api` — the transport STATION-CAPABILITIES §3 calls the
authority — over `/repos/GH-Mantova/ProjectOperations/pulls?state=closed&per_page=10`:

- entries returned: **10**
- entries where `merged === true`: **0**
- entries where the `merged` key is **defined at all**: **0** — the field is **ABSENT**, not `false`
- entries where `merged_at` is populated: **10 / 10**
- POSITIVE control, same PR, single GET `/pulls/1762`: `{"merged": true, "merged_at":
  "2026-09-07T05:49:35Z"}`

**The RULE is correct and stands** — never read `merged` from a list; read `merged_at`, or re-ask
per PR. **The symptom is transport-specific.** A run that goes looking for the documented `false`
through `gh` does not find it, and the available conclusion is *"the trap no longer reproduces"* —
which retires a live rule whose whole job is to stop a dozen phantom stranded-branch escalations.

🔧 **Fix: one clause — "through `gh api` the key is ABSENT rather than `false`; both readings are
unusable, and `merged_at` is correct on both transports."** Complete-and-additive: nothing is
retired, and the bullet's own falsifying probe (the two-endpoint pair) now works from either
transport instead of only one.

**DISPOSITION: DISPATCHED** → Station 00, DOCTRINE §9.4, same PR.

---

### F4 [S3] — a LIVE scheduled task sits outside every layer map, every authority matrix and every "the five bootstraps" sweep

STATION-CAPABILITIES §1 states its own rule: *"when a layer is added, add it here first"*, and
records why — PR #1465 put 203 damaged sequences on `main` in a layer no sweep was pointed at.

[MEASURED] from the scheduled-tasks MCP: **five** enabled tasks, and the fifth is
**`weekly-security-audit`** (`30 7 * * 1`, lastRun `2026-09-06T21:32:44Z`, bootstrap mtime
`2026-08-17T06:37:17Z`). It is **absent** from STATION-CAPABILITIES §1's layer table, §5's authority
matrix and §6's cadence table. `C:\Users\Marco\Claude\Scheduled\` holds **11** `SKILL.md` files;
every "the five bootstraps" probe this pipeline runs — including the open escalation
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md` — therefore covers **5 of 11
files and 4 of 5 live tasks**.

**This is not an actor risk.** Its bootstrap was read in full: it is genuinely read-only
(*"you never change any GitHub setting, never merge, never touch the board"*), it delegates to
`scripts/security-audit.ps1` and trusts the exit code, and on DRIFT it escalates to Marco rather than
fixing. Severity is S3 because of the **map**, not the task: a sweep whose corpus is defined by a
count rather than by the live task list will keep missing it, and the count is already wrong.

🔧 **Complete-and-additive fix (RULE 1): add the row to §1, §5 and §6, and re-express every
bootstrap sweep's corpus as "every `SKILL.md` behind an ENABLED task in the scheduled-tasks MCP",
not "the five".** That fixes this instance and the next one, and damages nothing — the MCP is
already the prescribed source for cadence (§6's own red rule). The alternative, adding
`weekly-security-audit` by name, fixes only the instance and fails the *future* half.

**DISPOSITION: DISPATCHED** → Station 00 (STATION-CAPABILITIES is a `docs/` change, inside 00's lane).

---

### F5 [S3] — the 00/04 cron collision is structural every four hours, not the near-midnight triple the open escalation describes

`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` and STATION-CAPABILITIES §6 both
frame the collision as 00 (`:05` hourly), 04 (`:00` every 4 h) and 05 (`00:10` daily) all landing
*"within ten minutes of MIDNIGHT LOCAL, every night"*, and conclude that **05** is the one that must
move because its slot is fixed.

[MEASURED] this run, from `lastRunAt`: **00 `2026-09-07T06:08:25Z`, 04 `2026-09-07T06:10:04Z` — 99
seconds apart**, at 16:08 local. Nowhere near midnight, and 05 is not involved.

`5 * * * *` and `0 */4 * * *` collide **six times a day by construction**, independently of 05 and
independently of the local-midnight coincidence. The escalation's stated cause is a special case of
a broader one, and its proposed remedy (move 05) does not touch it.

🔧 **Complete-and-additive fix (RULE 1): the offset must be applied to 04 as well as 05** — e.g. 04
to `:35` (`35 */4 * * *`), which clears 00's `:05` slot every time rather than only at midnight, and
clears 05's `00:10` as a side effect. **The cron lives in the scheduled-tasks layer, so the change is
Marco's.** The alternative — moving only 05 — fixes one of the six daily collisions and leaves five.

**DISPOSITION: DISPATCHED** → Station 00, to fold into the existing escalation file rather than
open a second one. The escalation is already Marco's; what is new is that its *scope* is wrong.

---

### F6 [S4] — `git status`' ` M` on a dev tree that is BEHIND `origin/main` does not mean uncommitted work, and 04's own station doc invites that misreading

04's station doc records a real past failure: *"two consecutive advances sat uncommitted (measured
2026-09-02, 04's F6)"*, and tells this station to name the file it leaves dirty.

[MEASURED] at the top of this run, before advancing: `git status --porcelain` showed
` M docs/pipeline/sweep-rotation.json`, while `git diff --numstat origin/main --
docs/pipeline/sweep-rotation.json` returned **EMPTY**. The dev tree is 7 commits behind
`origin/main`, so the working copy matched `origin/main` and differed only from the behind-HEAD.
**Station 00 HAD committed the 02:21Z advance.** A run that read the ` M` alone would have re-filed
the 09-02 finding against a board where it is already fixed.

The same reasoning applies to every ` M` and ` D` a station reads in the dev tree while it is behind
— including the two consumed-HOLD ` D` entries, whose deleting PRs are already on `origin/main`.

🔧 **Fix: one clause, in the same place the dev-tree bullets live (§9.2) — "on a tree that is behind
`origin/main`, `git status` answers a question about HEAD, not about `origin/main`; the
uncommitted-work probe is `git diff --numstat origin/main -- <path>`, where EMPTY is the real
answer."** That is the same cure §9.3's length-comparison bullet already prescribes, applied to the
status read; complete-and-additive, and it retires nothing.

**Also carried here, and it is why the security-audit script was measured at all:**
`weekly-security-audit`'s fallback path is
`git -C C:\ProjectOperations2 show origin/main:scripts/security-audit.ps1 | powershell.exe -Command -`,
which pipes a native command's stdout through PowerShell — the re-encoding §9.3 records. [MEASURED]
that script is **2321 B / 41 lines / ZERO non-ASCII bytes**, so the pipe is lossless **today**. It
becomes a live defect the first time a non-ASCII character lands in that file, and nothing warns.
**Falsifying probe: the non-ASCII byte count of `origin/main:scripts/security-audit.ps1`.**

**DISPOSITION: DEFERRED.** Real, not now. It becomes urgent the moment (a) a station re-files the
uncommitted-advance finding off a ` M` line, or (b) `security-audit.ps1` gains a non-ASCII byte.
Both have named probes above.

---

### F7 [S3] — DOCTRINE.md is a CONTAMINATED CORPUS for its own probes, and running a §9 probe against §9 inverts the answer

[MEASURED] this run, by walking into it. The first run of §9.1's `\\`-needle probe was pointed at
`DOCTRINE.md` itself:

| pattern (single-quoted `-SimpleMatch`) | hits on `DOCTRINE.md` | hits on the 5 bootstraps |
|---|---|---|
| `'C:\\ProjectOperations2\\docs…'` — the BROKEN form | **3** | **0** |
| `'C:\ProjectOperations2\docs…'` — the WORKING form | **1** | **3** |

**The result on `DOCTRINE.md` is the exact inverse of the truth**, because the document *quotes* the
double-backslash form as documentation. Written up as-is it reads *"the broken needle finds more than
the working one — the bullet is backwards"*, which is a confident, coherent, wrong finding about the
one document every station is told to trust. Re-run against the corpus the bullet actually names it
returns `0` and `3`, exactly as recorded.

This is §9.6's *"a negative control you wrote down is a positive"* generalised from **needles** to
**patterns**: §9 is a written description of broken queries, so it contains a literal instance of
every broken query it warns about. **Any §9 probe run against §9 measures the documentation, not the
world** — and instrument-honesty is the one sweep in the rotation guaranteed to reach for it.

🔧 **Fix: one clause in §9.6, alongside the minted-needle rule — "run every §9 probe against the
corpus the bullet NAMES, never against §9 itself; this document contains a literal instance of every
broken query it records."** Complete-and-additive; it generalises the rule already there rather than
replacing it.

**DISPOSITION: DISPATCHED** → Station 00, DOCTRINE §9.6, same PR as F1/F2/F3.

---

### F8 [S3] — `check-breadcrumb.mjs`'s `CADENCE` map still reads `'00': 2`; the one-character fix has NOT landed

STATION-CAPABILITIES §6 records this and names its own falsifying probe: *"the `const CADENCE =`
line itself"*. Run this run at `origin/main` `9a905ec6`:

`const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 };` · NEG needle **0**.

Unchanged. `--freshness` — the probe COLLECT is told to START with — will not call `00` SILENT until
**4 h**, i.e. after **three** consecutive missed hourly runs, which is escalation #23's exact failure
direction. `03` (24) and `04` (4) match their live crons; `00` is still the only wrong row.

**Not a new finding — a re-proof that a recorded, one-character, already-diagnosed fix is still
open** after being filed for Marco because it is a `scripts/` change outside 00's merge lane. Filed
here so the age is visible.

**DISPOSITION: ESCALATED** → Marco, folded into the existing needs-marco item rather than a new one.
The question, with options, RULE 1 order:

**(a) [complete + additive — FIRST] Derive `CADENCE` from the scheduled-tasks MCP / a single
checked-in schedule file, rather than hard-coding it in `check-breadcrumb.mjs`.** Fixes `00` and
every future cron change at once, and cannot drift again — which is the *future* half of RULE 1. It
touches no data entry. Cost: `check-breadcrumb.mjs` gains a source of truth it does not have today,
and the schedule must be checked in for CI to read it.

**(b) Change the one character (`'00': 1`).** Fixes today's error completely and damages nothing,
but fails the *future* half: the map has already rotted once and the next cron change re-opens it —
this is the third document to carry the same number and the second to be corrected without the
instrument following.

**(c) Leave it and rely on cross-checking `lastRunAt` from the MCP, as §6 currently instructs.**
Fails the *immediate* half: the cross-check is a discipline in prose, and the run that skips it is
exactly the run that has already missed something.

## WHAT I DID NOT DO

- **Merged, labelled, armed, disarmed, renamed or moved nothing.** 04 is read-only on the board.
  Four PRs and two BLOCKED entries were visible in the sweep; none was touched, and no RULE 2
  classification was attempted, because none was needed for a read-only sweep and a classification
  nobody acts on is a lead, not a finding.
- **Staged no prompt.** All eight findings are documentation corrections to `docs/pipeline/`, which
  is 00's own lane and lands faster as one board PR than as eight queued prompts. Staging them would
  also collide with §10.6 — 00 may already be writing the same corrections this hour.
- **Did not commit `docs/pipeline/sweep-rotation.json`.** Named in WHAT CHANGED; 00 commits it.
- **Did not run the remaining three sweeps** (gate liveness, repo hygiene, instruction drift). One
  named sweep per run, covered completely, is the contract; rotation now sits at `last_index=1`.
- **Did not `git checkout` / `reset --hard` / `stash pop` / `clean` anywhere**, and did not
  fast-forward the dev tree — it is 7 behind, which is 03's and 00's to resolve, and every reading
  above that could be affected was taken from `origin/main` by SHA rather than from the working copy.
- **Did not touch Azure / Entra / SharePoint, production data, or the watcher clone's git state.**
  The clone was read only — file copies before `Select-String`, never `git`.
- **[CANNOT MEASURE]** the exact `Get-ChildItem C:\po-watcher -Recurse -Include '*.log'` query of
  F1 — it did not return in 6 minutes and was terminated. Three other forms of the same query were
  measured instead, and F1 says so rather than inferring the missing one.
