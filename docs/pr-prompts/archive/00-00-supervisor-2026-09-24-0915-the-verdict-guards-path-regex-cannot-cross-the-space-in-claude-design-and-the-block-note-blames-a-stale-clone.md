# Station 00 — Supervisor | 2026-09-24T09:15Z–2026-09-24T09:19Z

**BLIND RUN. Desktop Commander timed out again, so there was no shell on the Windows host. No board
mutation of any kind was attempted.** Doc version and bootstrap AGREE (both `station_doc_version: 1`),
so the READ-ONLY posture comes from PREFLIGHT step 1's STOP, not from a version mismatch. This is the
**third blind occurrence today and the first two CONSECUTIVE ones** (08:14Z, 09:14Z).

**Headline, and the reason this is not just the third "I was blind" of the day: PR #2157's MERGE
verdict is guard-blocked by a defect in `verdict-guard.mjs`, and the block note tells the next actor
to fix a different problem.** `PATH_TOKEN_RE` excludes whitespace from both path segments, so a bare
mention of `Claude Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html` is extracted as
`Design/proposed/…` — the `Claude ` prefix is unreachable across the space — and the suffix-tolerance
in `pathMatches` cannot recover it because the character before `Design/` is a space, not a `/`. The
note blames a stale watcher clone and prescribes a re-queue, **which cannot fix it**: a re-queue
against a perfectly fresh `main` re-extracts the same truncated token and blocks again. Proven from
the script's own source, with two occurrences twenty days apart, below.

Also resolved this run: the **08:14Z report's F3 was a false alarm of its own making.** `rev-2156`–
`rev-2159` were the watcher's normal loop, not a second lane.

## GROUND

```
UTC            2026-09-24T09:15Z start
origin/main    [CANNOT MEASURE] — no shell; `git fetch` + `git rev-parse` unavailable, and `git`
               against the mount is banned (DOCTRINE §9.2)
dev tree       main @ [CANNOT MEASURE short SHA]   C:\ProjectOperations2
               (ref read from .git/HEAD as a FILE: `ref: refs/heads/main` — no git invoked)
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter, contract_version 5)
bootstrap      1   (scheduled-task SKILL.md `station_doc_version: 1`)
```

## WHAT I MEASURED

### PREFLIGHT step 1 — the guard, then the box

**[MEASURED] `vm-git-guard.sh` exit 2 — the EXPECTED station outcome. Last line and exit code read
unpiped (`; echo "GUARD_EXIT=$?"`), never through `tail`:**

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/festive-stoic-rubin/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

The installer's own body states the consequence plainly: *"THE DEVICE-BRIDGE GIT BAN IS NOT MECHANICAL
IN THIS SHELL."* **[MEASURED] Negative control in this very shell:** `command -v git` → `/usr/bin/git`.
So the ban was REMEMBERED, not enforced — and it was kept. **No `git` ran anywhere this run.**

**[MEASURED] The Windows host is unreachable. An absent MCP server, not an unloaded schema.** The load
was attempted as the doc prescribes — keyword `ToolSearch`, never a hard-coded `select:` of ids:

- `ToolSearch "desktop-commander"` (bare keyword, max_results 30) → `No matching deferred tools found.`
- `ToolSearch "start_process interact_with_process powershell shell"` → one unrelated Microsoft-Learn
  tool. No shell tool of any id.
- The MCP host named the cause: `plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT):
  "MCP server … connection timed out after 30000ms"` — the same signature as 05:14Z and 08:14Z.

There is no tool id to call, so `start_process` was never reachable and no `powershell.exe` ran.

**[CANNOT MEASURE] The station's whole lane.** No `status-sweep.ps1`, no `bring-up-to-speed.ps1`, no
dot-sourced `pipeline-lib.ps1`, no `smoke-pr.ps1`, no `gh`, no `git`. `Assert-SmokedOrEscalate` →
`Merge-Pr` is the only sanctioned merge path and it was unavailable, so ARM / DISPATCH / MERGE were
**impossible rather than declined**.

**[CANNOT MEASURE] Freshness of the three binding documents.** PREFLIGHT step 2 requires
`git show origin/main:<path>` in the dev tree; with no shell that is impossible, so
`stations/00-supervisor.md` was read from the working copy, which the doc says is not a valid read and
which `station_doc_version` cannot vouch for. Treat every doc-derived statement here as provisional.

### PREFLIGHT step 4 — the one question a blind station can still answer

**[MEASURED] The board is NOT frozen by a stale lock.** `ls`/`stat` only, no git process started.
`.git/index.lock`, `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`,
`sequencer` — **all seven ABSENT**. §7's "escalates on mere existence" has nothing to fire on.

### The verdict-guard defect — mechanically proven, no git, no GitHub

**[MEASURED] The block note, verbatim** (`docs/pr-prompts/blocked/rev-2157-ready.md.guard-block.md`,
blocked `2026-09-24T08:19:09.266Z`):

```
The verdict named the following file(s) that are NOT in PR #2157:

  - Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html

This usually means the review agent ran against a stale local main
(syncMain() only advances inside the AUTO_MERGE block for non-gated PRs).

Action: re-queue this review prompt after the watcher clone is updated,
or remove the phantom file references from the verdict and re-queue.
```

**[MEASURED] The verdict itself was a clean MERGE** (`blocked/rev-2157-ready.md.log`, exit 0):
*"Docs-only HOLD scopecard PR — two files (S8h HOLD prompt + mockup), CI green, HOLD status +
`requires_on_main` gate on `GEOAPIFY_ROUTE_TRAVEL_V1` correctly prevent premature firing."*

**[MEASURED] There is no `Design/` directory in this repo, and the real file exists under a name with
a space in it.** Filesystem reads of the tree the watcher globs:

- `ls -d Design` → `No such file or directory`
- `ls -d "Claude Design/proposed/s8h-traffic-index"` → present
- `ls -1 "Claude Design/proposed/s8h-traffic-index/"` → `s8h-traffic-index-mockup.html`
- Top-level directories containing a space, complete list: **`Claude Design`, `Claude outputs`.**

**[MEASURED] The extractor cannot cross the space. Quoted from the script:**

```
scripts/pr-watcher/verdict-guard.mjs:37
const PATH_TOKEN_RE = /[^\s`'"<>()[\]{}|,;]+\/[^\s`'"<>()[\]{}|,;]+\.[a-zA-Z0-9]{1,10}(:\d+(-\d+)?)?/g;
```

Both segments exclude `\s`. Against the bare text `Claude Design/proposed/…/s8h-traffic-index-mockup.html`
the match therefore begins at `D`, yielding `Design/proposed/…` — exactly the string in the block note.
Pass 1 (backtick spans, line 116) *would* have carried the full path, so this fires only when a verdict
names a `Claude Design/` file **un-backticked** — which is why it is intermittent rather than constant.

**[MEASURED] The suffix tolerance cannot rescue it either** (`verdict-guard.mjs:164-168`):
`pathMatches` accepts `pf === candidate || pf.endsWith("/" + candidate)`. The PR's entry is
`Claude Design/proposed/…`; the character preceding `Design/` is a **space**, so `endsWith("/Design/proposed/…")`
is false. The comment at line 157 says the suffix check exists "to tolerate future repo-prefix changes"
— a space-separated prefix is the one prefix shape it does not tolerate.

**[MEASURED] Two occurrences, twenty days apart, and the older one is still sitting in `blocked/`.**
Of **50** `*.guard-block.md` notes, **2** carry the space-split signature (a cited path beginning
`Design/`):

| note | blocked | cited paths |
|---|---|---|
| `rev-1573-ready.md.guard-block.md` | 2026-09-04T07:15:04Z (PR #1573) | `Design/README.md`, `Design/assets/routes.js`, `Design/assets/styles.css`, `Design/docs/00-design-system.md`, `Design/mockups/tenders.html`, `Design/proposed/README.md` |
| `rev-2157-ready.md.guard-block.md` | 2026-09-24T08:19:09Z (PR #2157) | `Design/proposed/s8h-traffic-index/s8h-traffic-index-mockup.html` |

Every one of rev-1573's six maps to a real `Claude Design/…` path. That is six independent tokens
truncated identically — not a stale clone, which would have to have been missing all six.

**[MEASURED] The repo already knows this hazard class, in the same package:**

```
scripts/pr-watcher/index.mjs:1071   // "Claude Design/docs/01-commercial.md" reaches git as two arguments and
scripts/pr-watcher/verdict-guard.mjs:80  *  - it carries a quote (a path with a space is written bare: `Claude Design/x.js`)
```

So the space was anticipated in `index.mjs`'s git argv handling and in pass 1's command heuristic, and
**not** in pass 2's token regex. **[MEASURED]** `__tests__/verdict-guard.spec.mjs` mentions
`Claude Design` twice — so the fixture vocabulary exists; **[CANNOT MEASURE]** whether any case asserts
the pass-2 extraction of a spaced path, which needs the test run I have no shell for.

### COLLECT — what the 08:14Z run could not see

**[MEASURED] F3 of the 08:14Z report is RESOLVED, and it was a false alarm produced by listing only
the queue root.** `rev-2156`–`rev-2159` were consumed by the watcher's normal loop:

| prompt | landed in | prompt mtime | log mtime |
|---|---|---|---|
| `rev-2156-ready.md` | `processed/` | 07:59:11Z | 08:15:52Z |
| `rev-2157-ready.md` | **`blocked/`** | 08:02:11Z | 08:19:09Z (+ `.guard-block.md`) |
| `rev-2158-ready.md` | `processed/` | 08:08:12Z | 08:26:45Z |
| `rev-2159-ready.md` | `processed/` | 08:11:12Z | 08:28:44Z |

Three processed, one guard-blocked, all four with logs written **after** the 08:14Z run ended. **The
watcher is ALIVE and working** — which that run could not assert and correctly did not. Its ESCALATED
question *"were rev-2156–rev-2159 watcher-routed?"* is answered **yes**, by the watcher's own
`processed/`+`.log` convention, and DOCTRINE §10.1 does not apply to them.

**[MEASURED] Queue state, filesystem only, with the 08:17Z reading beside it:**

| | 08:17Z | 09:17Z |
|---|---|---|
| root breadcrumbs `00-*.md` | 3 | 4 |
| `archive/` | 720 | **753** |
| armed `*-ready.md` | 4 | **1** |
| `*-HOLD.md` | 16 | 15 |
| `needs-marco/` | "47" | 47 files + 13 dirs = 60 entries |

**[MEASURED] The `needs-marco` delta is a counting artefact, NOT 13 new escalations.**
`find -maxdepth 1 -type f` → **47**, `-type d` → **13**, `ls -1` → **60**. Newest top-level entry is
`03:24Z` today, before the 08:14Z run. Said explicitly because a +13 escalation spike would have been a
serious finding and it is not real. The falsifying probe for any future reader: compare `-type f`
counts, never `ls` counts.

**[MEASURED] One prompt is armed:** `pr-scopecards-s8g-geoapify-travel-and-time-index-ready.md`,
mtime `08:18:40Z` — armed one minute before the previous run's breadcrumb hit disk, and untouched by me.
**[MEASURED]** `archive/` newest includes `00-06-pr-master-2026-09-24-0810-s8g-is-on-main-and-s8h-is-staged-behind-its-gate.md`,
so a Station 06 ran at 08:10Z and its breadcrumb is already archived — **[INFERRED]** a sighted actor
archived ~33 breadcrumbs after 08:17Z. **[CANNOT MEASURE]** which actor, or whether the archiving PR
merged; both need `git`/`gh`.

**[MEASURED] Three untracked breadcrumbs remain in the dev tree root** — the `0514`, `0614` and `0814`
files, plus `00-04-scanner-…-0610`. Flagged because the contract warns an untracked file at a path a
landed PR must create is what refuses the next `--ff-only`, while `--numstat` and `--cached` both read
EMPTY.

**[CANNOT MEASURE] `check-breadcrumb.mjs --freshness`.** Not run — F1 of the 08:14Z report stands: the
validator shells out to `git ls-tree -r`/`git ls-files` against the mount and to `gh pr list`. **This
run therefore claims no freshness verdict and does NOT write `breadcrumb-clean` for this file.**

**[MEASURED] Cadence crossed against `list_scheduled_tasks`, no git, no gh.** 00 `cronExpression:
5 * * * *` (hourly, agrees with the bootstrap); `lastRunAt` 00 = `09:14:06Z` (this run), 03 =
`2026-09-23T23:02:54Z` (10.2h, cadence 24h, ok), 04 = `2026-09-24T06:09:44Z` (3.1h, cadence 4h, ok),
05 = `2026-09-23T14:22:41Z` (18.9h, cadence 24h, ok). **[MEASURED]** `weekly-security-audit` remains
`enabled: false`, `lastRunAt 2026-09-06T21:32:44Z` — **18 days**.

## WHAT CHANGED

**Nothing on the board, nothing in git, nothing in `sot/`.** No PR armed, labelled, merged, closed,
commented or dispatched. No `-HOLD.md` moved. The one armed `-ready.md` untouched. `blocked/rev-2157`
left exactly where the watcher put it. No escalation file discharged. No breadcrumb archived. **No
`git` command run anywhere.**

The only write this run made is **this breadcrumb**, in the dev tree at
`C:\ProjectOperations2\docs\pr-prompts\`. Cure 1 (write it inside the run's own PR worktree) needs git
and was unavailable; the dev tree is the contract's other sanctioned home. It is **untracked until a
later board PR commits it**, and the filename is novel so it collides with no path a fast-forward must
create.

## FINDINGS

### F1 — `verdict-guard.mjs` truncates every un-backticked `Claude Design/` path, and the block note sends the reader after a stale clone

Proven above from the regex, the matcher, the filesystem and two occurrences. The practical cost: PR
**#2157** carries a reviewed **MERGE** verdict on a docs-only HOLD scopecard and is parked in
`blocked/`; PR **#1573** has been parked the same way since **2026-09-04**. The note's prescribed
action cannot clear either — a re-queue against a fresh `main` re-extracts `Design/proposed/…`
identically — so the only escape it offers is *"remove the phantom file references from the verdict"*,
i.e. delete the reviewer's evidence to satisfy a parser bug. That is the incentive the file's own
comment at line 182 warns about: *"a verdict that says only 'looks fine' passes, while one that shows
its work is blocked."*

**DISPOSITION: DISPATCHED** — to the next **sighted** Station 00 run, as a code fix for
`01-code-writer` with the premise `! grep -q 'Claude Design' scripts/pr-watcher/verdict-guard.mjs`
being FALSE at line 37's regex. Not Marco's: nothing here needs his intent. Not actionable from a blind
run: it is a code PR and opening one needs the shell this finding is about. Two repairs, **RULE 1
order — complete-and-additive first:**

1. **Make the extractor and the matcher space-aware.** Build pass 2's candidate set from the *known
   repo top-level directories that contain a space* (today `Claude Design`, `Claude outputs`) — on a
   pass-2 hit, also offer `"<spaced-prefix> " + token` as a candidate — and relax `pathMatches`'
   suffix rule from `endsWith("/" + candidate)` to `endsWith("/" + candidate) || endsWith(" " + candidate)`.
   This clears both parked PRs, keeps the guard's protection fully intact (it only ever *adds*
   candidates that resolve to real PR files), and fixes every future design-PR verdict. Add a
   `verdict-guard.spec.mjs` case asserting a bare `Claude Design/x/y.html` matches a PR file of that
   exact name — the fixture vocabulary is already in that file.
2. **Fallback, additive but incomplete: correct the block note's diagnosis.** When every unmatched path
   is a suffix of a real PR file modulo a leading space-separated token, say so — *"a path containing a
   space was truncated by the extractor"* — instead of blaming `syncMain()`. This stops the next actor
   wasting a cycle on the clone, but leaves the PRs blocked, so it fails the "solves it completely"
   half of RULE 1.

**Re-queueing `rev-2157` before repair 1 lands will simply block it again** — that is the falsifying
probe, and it costs one watcher cycle to run.

### F2 — Station 00 was blind at 09:14Z; two consecutive blind occurrences for the first time today

Schema-load discipline followed first, so this is an unreachable machine and not a validation error.
The day reads 05:14Z blind → 06:14Z **sighted** → 08:14Z blind → 09:14Z blind. Three of the five
occurrences today were blind, with an identical `CONNECT_TIMEOUT` 30000ms signature each time. The
intermittency DOCTRINE records is intact but the duty cycle is now poor enough to be worth naming as a
trend rather than a data point. ⚠️ The probe the 05:14Z run relied on — *"two consecutive blind
occurrences make `--freshness` call 00 SILENT, so it surfaces itself"* — has now **had its trigger
condition met and still cannot fire**, for two reasons: both blind runs wrote breadcrumbs (so
`--freshness` sees 00 as current), and running the validator at all is what F1-of-08:14Z forbids from a
blind shell. **That probe should not be relied on again.**

**DISPOSITION: DEFERRED** — the failure is in the MCP transport that would have to carry any fix, and
the existing escalation
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` already holds it. It
becomes urgent the moment it stops being intermittent; it graduates to a desktop-app question for
Marco, not a pipeline one, if a sighted run ever finds 00 genuinely SILENT.

### F3 — The 08:14Z run's second-lane alarm was an artefact of listing only the queue root

`rev-2156`–`rev-2159` were the watcher's normal loop, evidenced by `processed/`/`blocked/` placement
and logs written after that run ended. Recorded as a finding rather than a footnote because the alarm
was correctly raised and correctly not diagnosed, and closing it is the only thing that stops the next
blind run re-raising it. **The general lesson: a queue-root listing measures the queue's *mouth*, not
its throughput — a blind station must read `processed/`, `blocked/`, `failed/` and `no-pr-opened/`
before inferring anything about who is acting on the board.**

**DISPOSITION: ACTIONED** — closed this run by measurement; verified by the mtime/log table above,
which any later run can re-derive with `ls` alone. No mutation was needed or made.

### F4 — `weekly-security-audit` has been disabled for 18 days

`enabled: false`, last ran 2026-09-06T21:32:44Z. Unchanged from the 08:14Z report and restated only so
this run is not silent about it.

**DISPOSITION: ESCALATED** — Marco's, already on his desk in the 08:14Z breadcrumb's FOR MARCO. Not
re-asked below; one question per cycle is enough.

### F5 — The PRs waiting on Marco, carried forward unre-measured

From the 06:14Z report: `#2148` (auth — stops live sign-in codes and password-reset links reaching the
production log; its two reds were diagnosed there as **one human gate, not a defect**), plus `#2135`,
`#2131`, `#2127`. This run could not re-measure any of them and does not claim to have.

**DISPOSITION: ESCALATED** — already Marco's before this run; a blind run cannot advance it. No new
question; the release procedure and the standing stale-remote-heads decision are written up in the
06:14Z breadcrumb and in `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`.

## WHAT I DID NOT DO

- **Did not run `check-breadcrumb.mjs`** — it shells out to `git` against the mount (F1 of the 08:14Z
  report). So I produced **no** `--freshness` verdict and do **not** write `breadcrumb-clean` for this
  file. Said plainly rather than quietly omitted, because the contract treats an unearned
  `breadcrumb-clean` as a lie.
- **Did not run any `git` command anywhere.** The guard reported INERT (exit 2), so the ban was mine to
  keep by hand, and it was kept. The one-call `PATH=…/.local/bin:$PATH git …` form was not used either
  — protection for a call I had no business making is not a reason to make it.
- **Did not re-queue `rev-2157`, or touch `blocked/` at all.** Moving it back would block it again
  (F1's probe) and queue mutation from a blind run is LL-38 with the index shared.
- **Did not touch the armed `pr-scopecards-s8g-…-ready.md`, or any HOLD.** It was armed at 08:18Z by an
  actor I cannot identify, and a sighted Station 06 was running at 08:10Z.
- **Did not substitute GitHub-side reads for the tree.** The GitHub MCP is connected and read-only
  `gh`-shaped reads were available; the contract forbids presenting `origin/main` as coverage of the
  tree the watcher globs, so no PR, check or label state was read from GitHub and none is claimed.
  **Every claim in F1 comes from the working tree and the watcher's own queue artefacts** — the files
  that would be blind-spot-free even if `origin/main` had moved.
- **Did not open a second-lane PR to deliver this breadcrumb.** A PR the watcher did not open carries
  no RULE-2 verdict (§10.1), and a blind run adding an unrouted PR to a board it cannot then read is a
  worse trade than an untracked file in the dev tree.
- **Did not read `DOCTRINE.md` or `STATION-CAPABILITIES.md` in full.** A blind station has nothing to
  gate on them, and full quotes from a working copy of unknown age would carry authority they have not
  earned. §9.2 and §10.1 are cited from the station doc's own restatement.
- **Did not clear any `[STALE]` escalation row**, and did not discharge any of the 47 `needs-marco/`
  files. Both need `status-sweep.ps1` section 5 plus a per-PR `gh pr view` re-ask.
- **Did not archive any breadcrumb.** That is a `git mv` in a board PR.
- **Did not touch `sot/`** — never this station's, sighted or blind.
- **Did not restart or probe the watcher.** A process check needs the box. Note that F3 establishes
  indirectly that the watcher was alive and processing at 08:29Z, which is the nearest a blind run gets.

## FOR MARCO — three lines

The hour was lost to a blind station again — Desktop Commander timed out, so Station 00 had no shell and
armed, merged and dispatched nothing. **Nothing is broken underneath it:** no stale lock, no in-progress
merge, no station silent, and the watcher demonstrably processed four prompts while I was blind.

**One thing is worth your attention and it is not a decision, just a heads-up:** PR **#2157** has a
clean MERGE review and is parked in `blocked/` because the verdict-guard's path regex cannot read a
directory name with a space in it — `Claude Design/` — and the block note blames the wrong cause.
**#1573** has been parked the same way since 04 September. The fix is small, it is a station's job not
yours, and it is written out in F1 above; I have dispatched it to the next sighted run. Re-queueing
either PR before that fix lands will just block it again.

**Your PRs are still yours, `#2148` first**, and the stale-remote-heads question is still the one
standing decision. Neither changed this hour.
