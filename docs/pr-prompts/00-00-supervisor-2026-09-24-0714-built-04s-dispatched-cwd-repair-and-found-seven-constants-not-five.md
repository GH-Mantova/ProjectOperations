# Station 00 — Supervisor | 2026-09-24T07:14:27Z–2026-09-24T08:0xZ

## GROUND

```
UTC            2026-09-24T07:14:27Z
origin/main    7de4d964            (fetched, then rev-parse)
dev tree       main @ dc697304     C:\ProjectOperations2   (2 BEHIND at run start)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version in the scheduled-task file)
```

Versions AGREE — this run had full authority, not read-only.

## WHAT I MEASURED

### PREFLIGHT step 1 — the box, and the VM git guard

**SIGHTED run.** [MEASURED] Desktop Commander `start_process` shell `powershell.exe` returned
`2026-09-24T17:14:27.4908744+10:00`, `main`, `dc697304` from `C:\ProjectOperations2`. The tool
schemas were loaded with `ToolSearch` FIRST; no call was made cold.

**vm-git-guard: exit 2, INSTALLED BUT INERT.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`; `GUARD_EXIT=2`, read from
the installer itself and not from a pipeline appended to it. Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/charming-quirky-edison/.local/bin:$PATH" git <args>
```

The EXPECTED station outcome per the contract — a FINDING, not a STOP. **No `git` ran against the
mount at any point in this run**; every `git` call went through Desktop Commander on the Windows host.

### PREFLIGHT step 2 — and my own station doc was STALE in the working copy

[MEASURED] `git diff --numstat origin/main -- <the three binding docs>`:

| path | numstat vs `origin/main` |
|---|---|
| `docs/pipeline/DOCTRINE.md` | **EMPTY** — identical |
| `docs/pipeline/STATION-CAPABILITIES.md` | **EMPTY** — identical |
| `docs/pipeline/stations/00-supervisor.md` | **`1  12`** — the working copy is BEHIND |

The dev tree opened **2 behind** (`git rev-list --left-right --count HEAD...origin/main` → `0 2`),
so PREFLIGHT step 2's *"read from `origin/main`, never the working copy"* was load-bearing rather
than ceremonial this run. The difference is `#2131`'s correction moving `why-blocked.ps1` out of the
READ-ONLY tool list into the MUTATING one — i.e. the stale copy would have told me a squash-merge
attempt was a read-only diagnostic. I read that hunk from `origin/main` via `git diff origin/main`
before relying on the file. All three documents read in full (DOCTRINE 2841 lines,
STATION-CAPABILITIES 579, 00-supervisor 1648).

### PREFLIGHT step 4 — the sweep

`status-sweep.ps1` captured to a file (the script returns early otherwise) and decoded **`utf16le`**
in node — the `*>` redirection trap of DOCTRINE §9.3 DID fire on this capture: the file opens
`FF FE`, 107,516 bytes, 827 lines once decoded.

- **Section 0 positive controls PASSED:** `gh CAN reach GitHub (saw merged PR #2153)`, `node runs`.
- **Section 7 verdict:** `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote
  activity, no live station worktrees.`
- **Section 5: ZERO `[STALE]` rows.** [MEASURED] a literal `[STALE]` scan over the decoded report
  returns **4** lines and all four are the header legend, the footer, and one `[FILE]` line quoting
  the word — **no escalation row was tagged `[STALE]`**. So there is nothing to discharge into
  `needs-marco/discharged/` this cycle. POSITIVE control `[LIVE]` → **81**; NEGATIVE control, a
  freshly minted needle `zqx0924supNeedle` → **0**.
- Queue: `armed (*-ready.md): 0`, `needs-marco/: 47`, `failed/: 59`, `blocked/: 150`.
- Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.
- **Trunk: `[CANNOT MEASURE]`** — `main CI on 7de4d964: 0 success / 0 failed / 4 running`. The sweep
  reports this as *"NOT a green trunk"* rather than as red, which is the third verdict state
  DOCTRINE §9.5 records the landed `#1852` denylist as having added. Nothing was concluded from it.

### COLLECT — and my predecessor had already dispositioned everything but one item

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**. No station SILENT:

```
00  last 2026-09-24T06:14:00Z   1.1h ago  (cadence 1h)   ok
03  last 2026-09-23T23:04:00Z   8.3h ago  (cadence 24h)  ok
04  last 2026-09-24T06:10:00Z   1.2h ago  (cadence 4h)   ok
05  last 2026-09-23T14:23:00Z  16.9h ago  (cadence 24h)  ok
```

Crossed against `lastRunAt` from the scheduled-tasks MCP (the breadcrumb is one instrument and
cannot name a cause): `00` `07:14:05Z`, `04` `06:09:44Z`, `03` `2026-09-23T23:02:54Z`, `05`
`2026-09-23T14:22:41Z` — every row **both fresh and aligned**, which is the healthy row of the
station doc's four-way table. `weekly-security-audit` remains `enabled: false`, matching
`STATION-CAPABILITIES.md` §1's 2026-09-15 correction. Live enabled count **4**.

Three breadcrumbs at depth 1, all three already **TRACKED** (`git status --porcelain
--untracked-files=no` EMPTY): the 05:14Z blind run, the 06:14Z run, and 04's 06:10Z report. The
06:14Z run swept all three up in `#2152`/`#2153` and dispositioned 04's F1/F2/F3 as its own
F3/F4. **So the collect channel was already closed on everything except one item, and that item was
addressed to me by name.**

### 04's F1 — the deferral that named this run as its trigger

The 06:14Z run dispositioned 04's F1 **DEFERRED**, with an explicit and dated trigger, quoted:

> *"The trigger is explicit and dated: it is the FIRST work item of the next Station 00 run, ahead
> of collect, with the scope 04 already named."*

I am that run. **It was built, and building it found the scope understated.**

**[MEASURED] SEVEN cwd-relative state constants across the four scripts, not five.** 04 listed five;
two more in `lint-station.mjs` are the identical class and were missed because they are not named
`DIR` or `FILE`:

| script | constant | in 04's list? |
|---|---|---|
| `check-breadcrumb.mjs` | `DIR = 'docs/pr-prompts'` | yes |
| `check-pipeline-heartbeat.mjs` | `PAUSE_FILE = 'docs/pipeline/pause.json'` | yes |
| `check-pipeline-heartbeat.mjs` | `DIR = 'docs/pr-prompts'` | yes |
| `lint-station.mjs` | `STATION_DIR = 'docs/pipeline/stations'` | yes |
| `next-sweep.mjs` | `FILE = 'docs/pipeline/sweep-rotation.json'` | yes |
| **`lint-station.mjs`** | **`DOCTRINE = 'docs/pipeline/DOCTRINE.md'`** | **NO** |
| **`lint-station.mjs`** | **`AGENT_DIR = '.claude/agents'`** | **NO** |

**And THREE `execSync` calls inherit the caller's cwd, which no constant fix reaches.** Absolute
paths alone would have left all three still answering about the wrong directory:
`check-breadcrumb.mjs`'s `git ls-tree` / `git ls-files` probe and its `gh pr list` call, and
`lint-station.mjs`'s `git ls-files`. The `gh` one is DOCTRINE §9.4's CWD bullet exactly — `gh` infers
the repo from the cwd and answers an empty board for every question from a non-repo cwd.

**The repair, and 04's own falsifying probe re-run against it.** All four scripts, from
`%TEMP%\sup-nonrepo-*` (`IS_REPO_HERE=False`) and from the repo root, in the same minute:

| script | non-repo cwd BEFORE (04, 06:2xZ) | non-repo cwd AFTER | repo root AFTER |
|---|---|---|---|
| `next-sweep.mjs` | `REJECT … is missing`, exit 1 | prints `SWEEP: gate-liveness`, **exit 0** | identical, exit 0 |
| `check-breadcrumb.mjs` | `REJECT docs/pr-prompts does not exist`, exit 1 | `CLEAN`, `3 checked`, **exit 0** | identical, exit 0 |
| `lint-station.mjs` | `REJECT _canonical-blocks.json is missing`, exit 1 | `ADMIT: all 8 docs clean`, **exit 0** | identical, exit 0 |
| `check-pipeline-heartbeat.mjs` | `SKIP: … run from the repo root`, exit 2 | `[heartbeat] ALIVE`, **exit 0** | identical, exit 0 |

`--freshness` now also runs from a non-repo cwd and returns the same five-station table it returns
from the repo root — it could not run there at all before.

🔴 **One of those exit codes was a lie I nearly wrote down.** `lint-station.mjs` first read
**`EXIT=-1`** in BOTH columns. That was my own `| Select-Object -First 8` severing the pipe and
killing node, not the script failing. Re-run with no pipeline to sever it: **exit 0 from both cwds,
`IDENTICAL_EXIT=True`.** A truncating pipe and a failing script are byte-identical in
`$LASTEXITCODE`, and the reading I would have filed — *"the fix broke lint-station"* — was available
and wrong.

**NEGATIVE CONTROL, and it is the one that matters for this class of fix.** A module-rooted path that
genuinely does not exist must still fail LOUDLY, or the repair has traded a false negative for a
false positive, which is worse. A probe resolving `./docs/zqSup0924AbsentDir/` from its own location:
`REJECT … does not exist`, **exit 1**. Real absence still reports as absence.

**Read-backs on the edit itself** (DOCTRINE §9.3 — node, never PowerShell; and a replacement
FUNCTION or concatenation, never a replacement STRING, because `$&` and `` $` `` are live in one):

```
next-sweep.mjs:               edits=2  crlf=true ending_kept=true intended_delta=838  actual_delta=838  OK
check-breadcrumb.mjs:         edits=7  crlf=true ending_kept=true intended_delta=1135 actual_delta=1135 OK
check-pipeline-heartbeat.mjs: edits=3  crlf=true ending_kept=true intended_delta=1244 actual_delta=1244 OK
lint-station.mjs:             edits=10 crlf=true ending_kept=true intended_delta=1421 actual_delta=1421 OK
```

Every edit asserted exactly-one-occurrence before applying, and the byte delta asserted equal to the
intended delta afterwards — the assertion that catches a spill a "did my text land?" read-back cannot
see. These files are stored **CRLF**; the first attempt failed to match on `\n` and was rewritten to
normalise in memory and restore the file's own ending, so the diff is the change and not a
line-ending rewrite.

**Gates:** `pnpm lint` **exit 0**. `node --test` on all three affected suites
(`pipeline-heartbeat.test.mjs`, `check-breadcrumb.gitignored-sink.test.mjs`,
`check-breadcrumb.open-prs.test.mjs`) **exit 0** each — and the exit code is the verdict, because my
`# pass` grep matched nothing on node 24's reporter, which reads identically to tests that never ran.
`pnpm build` initially failed with **3617** `Property … does not exist on type 'PrismaService'`
errors; the cause is `pnpm install`'s own warning — `Ignored build scripts: @prisma/client,
@prisma/engines, prisma` — i.e. the Prisma client was never generated in a fresh worktree, not
anything in this diff, which contains no TypeScript. `pnpm prisma:generate` exit 0, then rebuilt.

**Why `PAUSE_FILE` and `DIR` stayed repo-relative.** `PAUSE_FILE` is **exported** and asserted on by
`__tests__/pipeline-heartbeat.test.mjs`; `check-breadcrumb.mjs`'s `DIR` is a git **pathspec** and the
key shape of `trackedSet`, whose members arrive from `git ls-tree` as repo-relative paths. Making
either absolute would have compared an absolute path against a repo-relative set and reported every
breadcrumb UNTRACKED — a uniform wrong answer at exit 0, §9.6's shape, inside the cure for it. The
`*_REL` names print; the resolved names touch the filesystem.

### THE BOARD — one open PR, and it moved twice while I watched

**[MEASURED] at 07:3xZ, live, `-R` on every call and `$LASTEXITCODE` tested before parsing:**
`OPEN_COUNT=1` — **`#2148`**, `labels=[do-not-merge]`.

`#2135` **MERGED between the sweep (07:15:39Z, which saw it BLOCKED with 4 checks pending) and this
read**. `#2127` and `#2131` also merged since the 06:14Z run — which is why the dev tree opened 2
behind. The board my predecessor described as *"four open PRs, all Marco's"* is now one. **That is
`[LIVE]` meaning "true when measured" doing exactly what the station doc warns about**, and it is
why the board was re-read immediately before acting rather than taken from the sweep.

**RULE 2 on `#2148`, from the corrected probe my predecessor landed** — prompt logs only,
`rev-*` excluded, in the **LIVE dev tree** and never the watcher clone:

```
PROBE_DIR=C:\ProjectOperations2\docs\pr-prompts\processed   948 prompt logs
newest log 2026-09-24T02:56Z pr-sec-a3-no-credential-logs-ready.md.log
POSITIVE CONTROL  marco.:true      -> 706
NEGATIVE CONTROL  zqSup0924Board   -> 0
PR #2148 -> 2 hits, in pr-sec-a3-no-credential-logs-ready.md.log:
  - **PR #2148** - `feat/sec-a3-stop-credential-logs`  https://github.com/…/pull/2148
  - [watcher] merge result for PR #2148: {"ok":false,"marco":true,"fixLane":false,
    "reason":"escalates:true - PR already carries `do-not-merge` - no duplic…"}
```

The verdict line and the PR's own `opened` line sit in the **same** prompt log, which is the
cross-check DOCTRINE §10.1 requires against a PR number scraped out of agent prose. **`#2148` is
doubly gated — a real watcher `marco:true` AND the `do-not-merge` label — and only Marco clears
either.** Its two red checks are one cause: CP-26 `[LABEL_PRESENT]`, parked by design, nothing to
fix and nothing to re-run.

### The machine

Watcher `node` RUNNING **pid 38776**; auto-restart wrapper alive (1); watcher clone `branch=main
dirty=0`; non-main worktrees none; registry escapees none; guard hook present; no `index.lock` in
either tree; `git` processes touching our trees **0**. **An idle watcher with `armed=0` is CORRECT,
not wedged.** No restart was considered.

## WHAT CHANGED

**One PR, opened by this run. Nothing on the board was merged, labelled, closed or commented on.**

- `scripts/pipeline/next-sweep.mjs`, `check-breadcrumb.mjs`, `check-pipeline-heartbeat.mjs`,
  `lint-station.mjs` — 22 edits across four files, resolving seven state paths from
  `import.meta.url` and passing `cwd` to three `execSync` calls. `git diff --numstat`:
  `22/7`, `21/4`, `30/13`, `14/3`.
- This breadcrumb, written **inside the PR worktree** (REPORT CONTRACT cure 1), so no loose copy
  exists in the dev tree and it cannot block the next fast-forward.

**In the shared dev tree: nothing.** No file was written, staged or committed there. The rotation
advance 04 left dirty was already committed by the 06:14Z run — `git show
origin/main:docs/pipeline/sweep-rotation.json` and the working copy both read `last_index=3`,
`last_run_utc=2026-09-24T06:21:32Z`, so 04's hand-over item is discharged and needed nothing from me.
No prompt was armed, disarmed, renamed or binned. No `-HOLD.md` moved. No escalation discharged.
No watcher process touched. `sot/` not written.

## FINDINGS

### F1 — 04's dispatched cwd repair is BUILT, and the scope was larger than the dispatch in two ways that both fail toward a wrong answer

Measured in full above. 04 named five constants; there are **seven**, and the two it missed sit in
`lint-station.mjs` — the script that gates the canonical blocks in CI. Separately, **three
`execSync` calls inherit the caller's cwd**, which no amount of fixing constants would have reached;
one of them is a `gh` call, i.e. DOCTRINE §9.4's CWD bullet, whose documented symptom is a
well-formed **empty board** for every question at what reads as success.

RULE 1, both halves: this is the **complete-and-additive** option (04's option 1). Complete — the
class cannot recur for these paths, and a script added later with the same habit is the only way
back in. Additive — no exported value changed, no test changed, no caller changed, no state file
touched, every message still prints a repo-relative path, and a real absence still fails loudly
(negative control above). The two alternatives 04 listed both still fail: fixing only the messages
re-arms the class on the next script, and leaving them keeps the rotation one wrong-cwd call from
stopping silently.

**DISPOSITION: ACTIONED** — built, verified by 04's own falsifying probe re-run in both columns,
`pnpm lint` exit 0, three test suites exit 0, and opened as a PR. **NOT MERGED**: the diff is
`scripts/pipeline/**`, outside `tests|docs` and outside this station's recorded `docs/` lane per
`STATION-CAPABILITIES.md` §5's 2026-09-22 narrowing, which states plainly that *"not
watcher-routed" is a NECESSARY condition, never a SUFFICIENT one*. It is Marco's to merge.
**Falsifying probe: the two-column table above.** Re-run all four scripts from a non-repo cwd and
from the repo root; if the columns ever disagree, this is wrong and must be re-measured.

### F2 — `lint-station.mjs`'s wrong-cwd message pointed at `--write-canonical`, which DEFEATS the gate it belongs to. Removed.

The message read `… _canonical-blocks.json is missing — run: node scripts/pipeline/lint-station.mjs
--write-canonical`. `--write-canonical` **re-records the canonical block hashes** from whatever the
station docs currently say, so a reader who took that at face value after a wrong-cwd failure would
silently bless any drift in the hash-gated blocks — for a fault that was only a working directory.
The file's own internal message elsewhere says *"run `--write-canonical` **deliberately**"*; the
wrong-cwd message dropped that word. It now names the resolved path it looked in, says the file is
TRACKED so the ordinary cause is an incomplete checkout, and says in as many words not to reach for
`--write-canonical` to clear it.

**DISPOSITION: ACTIONED** — in the same PR. This was the specific hazard 04 flagged as making its
F1 more than a message tidy-up, and it is why that finding was S3 rather than S4.

### F3 — 04's F2 (bootstrap `.gitignore` citations, day 18) — unchanged, still Marco's

The four enabled bootstraps cite `.gitignore:107-111` for the QA sinks, which are at **115-119**;
`05-sot-keeper`'s additionally cites `pr-gates.mjs:327`, which the repo doc retired to a symbol
anchor on 2026-09-10 and which now lands on CP-24's **carve-out comment** rather than the block it
is cited for. The bootstraps live outside the repo, outside CI, versioned by nothing; no station may
rewrite that layer.

**DISPOSITION: ESCALATED** — unchanged, already with Marco as ITEM 1 / ITEM 2 of
`needs-marco/gitignore-citations-in-the-five-bootstraps-2026-09-06.md`, day **18**. Not re-filed as
a new escalation: a second file for the same subject is the duplication the collect channel warns
about. Restated in FOR MARCO in one line only.

### F4 — 04's F3 (`lint-station.mjs` Windows-path advisory fires on regex literals) — carried, still deferred

Confirmed live this run: the exit-0 `ADMIT: all 8 docs clean` run still prints seven `!` advisories,
of which `e:\s` and `r:\s` are regex literals (`/^scope:\s*\n…/m` and `watcher:\s*do-not-arm`) being
read as drive roots, and four more are DOCTRINE quoting path patterns as documentation.

**DISPOSITION: DEFERRED** — 04's own disposition, and I am keeping it deliberately rather than
folding it into this PR even though both live in `scripts/pipeline`. 04's reasoning is that it
should ship *with* ITEM 2's citation check, by whoever writes that check, because the two share a
detector and the advisory's real cost is training readers to skim `!` lines in that script's output.
Shipping a detector tweak now, separately, would make ITEM 2's author inherit a half-changed
detector. **What would make it urgent: ITEM 2 being built.**

### F5 — The board is one PR and it is doubly gated; nothing else can move without Marco

`armed = 0`. One open PR, `#2148`, carrying both a real watcher `marco:true` verdict and the
`do-not-merge` label. Three PRs merged in the last ninety minutes (`#2127`, `#2131`, `#2135`), so
Marco is actively working the board and the queue drained behind him. The shortest remaining path is
unchanged from the 06:14Z run's ranking: **the label on `#2148`**, which also releases the two held
`sec-a1` / `sec-a2` prompts waiting on a marker only `#2148` puts on `main`.

**DISPOSITION: ESCALATED** — see FOR MARCO. No new question; only the count has changed, and it has
changed in the right direction.

## WHAT I DID NOT DO

- **Did not merge anything.** `#2148` carries both gates. My own PR is `scripts/pipeline/**`,
  outside this station's lane — opened and driven, not merged, and deliberately opened **without**
  auto-merge so it cannot merge itself while nobody is looking.
- **Did not re-run `#2148`'s red checks.** The log names CP-26 `[LABEL_PRESENT]` — a human gate
  doing its job. Re-running it is the DOCTRINE §2 *"never re-run hoping for green"* mistake.
- **Did not arm anything.** `armed = 0` and nothing became armable: the board moved by Marco
  merging, not by a gate opening. I did not re-run the 15-prompt lint census — the 06:14Z run
  measured it 55 minutes earlier (ADMIT 1 / REJECT 14, the single ADMIT being the permanent
  never-arm `pr-fv2-formrule-contract`), and nothing merged since touches a prompt gate. **That is
  an INFERENCE, not a measurement, and it is recorded as one**; it gated no action, because arming
  was not on this run's path.
- **Did not discharge any `needs-marco/` file.** The sweep tagged **zero** `[STALE]` rows, so
  nothing was dead to clear, and discharging on anything weaker than a per-PR re-ask is forbidden.
- **Did not fold 04's F3 into this PR** — reasoning under F4.
- **Did not commit to the shared dev tree**, and did not commit `main` anywhere. All work happened
  in a disposable worktree off `origin/main` at `C:\po-worktrees\sup-cwd-paths`.
- **Did not run `git` through the device bridge against the Windows `.git`.** The guard reported
  INERT (exit 2), so the ban was remembered rather than mechanical, and it was kept.
- **Did not `git checkout .`, `reset --hard`, `stash pop` or `git clean`** anywhere.
- **Did not touch `C:\po-watcher\ProjectOperations`** with anything, read or write.
- **Did not touch Azure / Entra / SharePoint**, production data, `sot/`, any label, or any
  `*-ready.md`.
- **Did not edit DOCTRINE or any station doc.** `docs/pipeline/stations/00-supervisor.md` is a
  hash-gated canonical-block carrier and was modified on `main` by `#2131` ninety minutes ago;
  a second edit from here would manufacture a conflict for no gain. The generalisation 04 asked for
  — *"DOCTRINE §9.4's CWD bullet is scoped to `gh` and its generalisation to this pipeline's own
  scripts is not written down anywhere"* — is **named here and deliberately left for a run that can
  carry a canonical-block re-record**, which is a whole PR of its own.
- **Did not use `Measure-Object -Line`, `git ls-tree` without `-r`, `--json number` alone,
  `Filename -Unique`, or a backslash-bearing needle crossing PowerShell into `node -e`.** Fresh
  negative controls this run: `zqx0924supNeedle`, `zqSup0924Board`, `zqSup0924RunNeedle`,
  `zqSup0924AbsentDir` — all 0, each against a positive control that passed. **All four are now
  spent.**

## FOR MARCO — the board is down to one, and it is the same label

Three PRs merged behind you in the last ninety minutes and the board is now **one open PR**.

**`#2148` is still the whole board.** It stops live sign-in codes and password-reset links being
written to the production log. Both its red checks are the same check — CP-26 — saying *"a human
must review and REMOVE the `do-not-merge` label."* Taking that label off also releases `sec-a1`
(JWT fail-closed) and `sec-a2` (email codes / reset links), which wait on a marker only `#2148` puts
on `main`. One label, three things move.

**New from this run: one PR of mine, and it is yours to merge.** It is the repair Station 04
dispatched on 2026-09-24T06:10Z and the 06:14Z run deferred to this one. It makes four pipeline
scripts work from any working directory instead of only from the repo root — including
`check-breadcrumb.mjs --freshness`, the silence detector, which could not run at all from the shell
a scheduled station is actually given. **The part worth thirty seconds of your attention:**
`lint-station.mjs`'s wrong-cwd message used to tell its reader to run `--write-canonical`, which
re-records the canonical block hashes — so following that advice after a wrong working directory
would have silently blessed any drift in the hash-gated blocks the gate exists to protect. That
message is gone. I opened it without auto-merge; it touches `scripts/`, which is outside this
station's lane, so it waits for you by design.

One smaller thing, day **18**, unchanged: the `.gitignore` line-number citations in all four enabled
station bootstraps are stale (`107-111`, actually `115-119`), and `05-sot-keeper`'s still points at
`pr-gates.mjs:327`, which now lands on a carve-out comment rather than the block it names. Those
files live outside the repo, so no station can fix them — same ITEM 1 / ITEM 2 pair already in front
of you.

Nothing else needs you. The watcher is up, no station is silent, nothing is looping, no lock is
stale, and `armed = 0` with nothing armable is the machinery correctly waiting.
