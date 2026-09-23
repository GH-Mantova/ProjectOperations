# Station 00 — Supervisor | 2026-09-23T10:14:22Z–2026-09-23T10:40Z

**SIGHTED run.** Desktop Commander connected on the first call. The sweep ran, its verdict is
**SAFE TO ACT**, and the board was read live. Headline: **Station 04's 10:09Z occurrence ran BLIND
and executed no sweep** — `gate-liveness` is owed. **#2114 is parked on Marco's label, by design.**
**Nothing is armable, measured with controls.** Nothing was armed, merged, or labelled.

## GROUND

```
UTC            2026-09-23T10:14:22Z
origin/main    85d85b54            (git fetch, then git rev-parse --short origin/main, dev tree)
dev tree       main @ 85d85b54     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** (1 == 1). Full authority this run.

**PREFLIGHT step 2, freshness of the binding documents — [MEASURED], and it is why the working copy
was a sound source this run.** The rule is to read from `git show origin/main:<path>`, never the
working copy. Rather than assume, the three documents were diffed against `origin/main` using the
sound form (`git diff --numstat`, never a piped hash — §9.1):

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md \
                                  docs/pipeline/DOCTRINE.md \
                                  docs/pipeline/STATION-CAPABILITIES.md
  -> EMPTY
git rev-list --left-right --count HEAD...origin/main  ->  0	0
```

EMPTY is the real answer: the working copy and `origin/main` hold the same bytes for all three, so
this run read the current text. All three were read **in full** (00-supervisor 1593 lines,
DOCTRINE 2734 lines, STATION-CAPABILITIES 571 lines).

## WHAT I MEASURED

**[MEASURED] STEP 1 — the box is reachable.** `start_process`, shell `powershell.exe`, first
attempt, after a `ToolSearch` load (a validation error is an unloaded schema, not blindness — the
load succeeded and so did the call):

```
HOST_OK 0<hostname>2026-09-23T20:14:22   (host clock is Brisbane, UTC+10 => 10:14:22Z)
main
85d85b54 2026-09-23 09:25:04 +0000 docs(pr-prompts): station 00 collect - #2114 parked ... (#2117)
```

**[MEASURED] `vm-git-guard.sh` → exit 2, INSTALLED BUT INERT.** Exit code read off the installer
itself, not off a pipeline appended to it. Last line quoted verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/lucid-funny-cannon/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

Per the station doc's three-outcome table this is **the EXPECTED outcome for a station**, not an
anomaly — a FINDING, carry on. Its practical consequence stands: the device-bridge git ban is
**remembered, not mechanical**, and no `git` was run through the bridge this run.

**[MEASURED] §9.1's `-Command` expansion trap fired on this run's own first probe, and is recorded
here because it is a live reproduction, not a quotation.** The opening status probe was sent as
`powershell.exe -NoProfile -Command "... ('FRESHNESS_EXIT=' + $LASTEXITCODE) ..."` — the **nested**
form the 2026-09-14 correction names as the one that has an expansion layer. `$LASTEXITCODE` was
consumed before the child parsed, and the shell answered:

```
You must provide a value expression following the '+' operator.
+ ... ('FRESHNESS_EXIT=' + ); Writ ...
```

Every probe after that point was written into a `.ps1` and run with `-File`, and every one of them
returned its values intact. **The bullet stands unqualified; this is one more instance of it.**

**[MEASURED] Breadcrumb freshness — CLEAN, exit 0.** `node scripts/pipeline/check-breadcrumb.mjs
--freshness`:

```
structure: 2 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-09-23T09:13:00Z   1.0h ago   (cadence 1h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-22T23:29:00Z  10.8h ago   (cadence 24h)  ok
  04  last 2026-09-23T10:10:00Z   0.1h ago   (cadence 4h)   ok
  05  last 2026-09-22T14:23:00Z  19.9h ago   (cadence 24h)  ok
CLEAN                                        FRESHNESS_EXIT=0
```

It also emitted `NOTE  00-04-scanner-2026-09-23-1010-…md is UNTRACKED — it reaches nobody until a
board PR commits it`. **That is this PR.** Both breadcrumbs were validated by
`check-breadcrumb.mjs` itself, which is the only validator (`lint-prompt.mjs` is not) — so 04's
breadcrumb, which its own author declined to certify, **is** `breadcrumb-clean`: 2 checked,
0 malformed, exit 0.

**[MEASURED] `--freshness` crossed against `lastRunAt` — the breadcrumb is one instrument and cannot
name a cause, so both were read.** From the scheduled-tasks MCP:

| station | cron | `lastRunAt` | newest breadcrumb | row |
|---|---|---|---|---|
| 00 | `5 * * * *` | 2026-09-23T10:13:54Z | 09:13Z | fresh + this run's own session live ⇒ **not a defect** |
| 03 | `0 9 * * *` | 2026-09-22T23:28:57Z | 09-22 23:29Z | both fresh and aligned ⇒ healthy |
| 04 | `0 */4 * * *` | 2026-09-23T10:09:33Z | 10:10Z | both fresh and aligned ⇒ **it ran, and it reported — see F1 for WHAT it reported** |
| 05 | `10 0 * * *` | 2026-09-22T14:23:04Z | 09-22 14:23Z | both fresh and aligned ⇒ healthy |

🔴 **04's row is the one that matters, and it is the case `--freshness` is structurally unable to
see.** `ok` and an aligned `lastRunAt` are exactly what a healthy run produces — and 04 *did* fire,
*did* report, and reported that it **could not do its job**. Neither instrument distinguishes a
station that swept and found nothing from one that never swept. **Only reading the breadcrumb does**,
which is what COLLECT is for.

**[MEASURED] 00's cadence, read live from the MCP and not from any document:** `5 * * * *`, hourly.
`nextRunAt 2026-09-23T11:13:52Z`. The bootstrap's hourly claim and the MCP agree.

**[MEASURED] Sweep — `status-sweep.ps1`, captured to a file and decoded `utf16le` (§9.3: `*>`
writes UTF-16LE).** `SWEEP COMPLETE 2026-09-23 10:16:17Z`, 134,964 B, 388 lines. Section 0 positive
controls both pass (`gh CAN reach GitHub (saw merged PR #2117)`, `node runs`); no `[BROKEN]`.
Instrument controls on my own reader: `[LIVE]` rows → **80** (positive), a freshly minted needle →
**0** (negative).

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**[MEASURED] Section 5 `[STALE]` escalation rows: ZERO this run.** A literal `[STALE]` search over
the decoded sweep returns 4 lines, and **none of them is an escalation row** — they are the HOW TO
READ legend, the `SWEEP COMPLETE` footer, the header, and one `[FILE]` line *quoting* an older run's
dispatch. So there is nothing for me to discharge into `needs-marco/discharged/` this cycle. The
eleven dead rows the station doc records from 2026-09-10 are gone and have stayed gone.

**[MEASURED] Q1 — every open PR, verbatim.** `gh pr list --state open` → **1 PR**:

```
#2114  BLOCKED  feat(tendering): scopecards S9 - transport capacity matrix defaults waste-line capacity per load
       CI: 13 pass / 2 fail / 0 pending
       labels: [do-not-merge]  headRefName: worktree-agent-a7fb6f7f79e60c457  createdAt: 2026-09-23T06:10:46Z
```

**DIRTY count: ZERO.** No PR on this board is conflicted, so the "N dirty ⇒ N have no working CI ⇒
the board cannot move" finding does not apply. `main` CI on `85d85b54`: **4 success / 0 failed**,
trunk green.

**[MEASURED] The two reds on #2114 are ONE cause, and I read the VERDICT TOKEN rather than the
pass/fail counts (§9.4).** The two failures are `Approval receipt (CP-26)` and `PR gates — diff
checks`, which is the documented two-reds-one-cause signature. Column 3 of the CP-26 job log
(tab-split per §9.1, never a whole-line grep):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

POSITIVE control, `approval-receipt` rows in the same column → **4**; NEGATIVE control, a freshly
minted needle → **0**. **`[LABEL_PRESENT]` means PARKED BY DESIGN — not a defect, and not work.**

**[MEASURED] #2114's lane, re-taken this run rather than carried forward from a breadcrumb (a lane
verdict is non-monotonic — §10.1).** The §10.1 step-1 probe over the PROMPT logs only,
`processed\pr-*.log`, `rev-*` excluded:

```
PR #2114        ->  3 hits      POSITIVE control 'marco.:true' -> 703      NEGATIVE 'PR #999997' -> 0
```

Hits ⇒ **watcher-opened**. So step 1 applies and wins: this PR carries a real watcher routing **and**
the `do-not-merge` label. Two independent gates, both binding on me, and **only Marco removes the
label.**

**[MEASURED] Q3 — I counted the armed prompts myself.** `Get-ChildItem docs\pr-prompts -Filter
*-ready.md` → **ARMED_COUNT=0**. `*-HOLD.md` → **HOLD_COUNT=14**. `*-LOOPING.md` → 0.

**[MEASURED] Nothing is armable, and the triage script's own two positive controls passed.**
`triage-holds.ps1`, read-only, exit 0:

```
GIT control:   PASS -- git read origin/main:docs/pipeline/DOCTRINE.md (215487 chars)
SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture
TOTALS  spent=0 of 14 evaluated   gates-satisfied=0   still-gated=14   unreadable=0
```

All 14 rejected at lint exit 1, before the premise ran: **10 `[HUMAN_GATE_PRESENT]`** (`pr-524-rates-b-slice2-canonical`,
`pr-devtree-sync-ff-only-guard`, `pr-fv2-formrule-contract`, `pr-nav-jobs-projects-merge`,
`pr-queue-layout-sot-entry`, `pr-retire-tenderclientnote-s2`, `pr-scopecards-s8b-azure-maps-travel`,
`pr-siteid-notnull-backfill`, `pr-tipid-s3-retire-the-name-guard-for-an-id-check`,
`pr-vendor-invoice-ocr`) and **4 `[FILE_GATE_NOT_RELEASED]`** (`pr-fv2-ai-digests`,
`pr-fv2-output-channels`, `pr-rates-s11c-drop-legacy-tables`,
`pr-tenant-mt4-s2-ownership-migration`). Zero ADMIT, zero spent, zero possible duplicates.

🔴 **The script prints `SUSPECT: every prompt landed in ONE bucket … prove node and git both resolve
before believing this run`. They do — that is exactly what its two controls above measure**, and
`lint-prompt.mjs` returned three distinct rejection codes across the corpus rather than one uniform
answer. The uniform bucket is real. **ARMED_COUNT=0 with nothing armable is the correct state of
this board, not a stalled one.**

**[MEASURED] Watcher — judged only by the sanctioned instruments, never by `ps` across an OS
boundary.** Sweep section 2:

```
watcher node: RUNNING pid 9744        auto-restart wrapper: alive (1)
heartbeat age: 223 min   (ticks only mid-run; stale + empty queue = idle, NOT wedged)
watcher clone: branch=main dirty=0    guard hook (.claude/hooks/guard.mjs): present
```

**A 223-minute heartbeat with ZERO armed prompts is IDLE, and idle is correct.** The heartbeat ticks
mid-run only; with nothing armed there is nothing to tick. Section 3 agrees independently: no build
in flight, `index.lock` False in both trees, **0** git processes touching our trees, no PR touched on
GitHub in the last 2 minutes. Five signals, all consistent. **This is not a WEDGED or DOWN verdict
and I did not treat it as one.**

**[MEASURED] Q5 — the silent-exit folders, contents not counts.** `no-pr-opened/` 111 total, newest
**09-22 17:25Z** (`pr-scopecards-s7-one-cutting-total-b-ready.md.log`); `failed/` 59 total, newest
**09-21 14:37Z** (`rev-2052-ready.md.log` — a review job, not a prompt, §9.5). **Nothing new since
my last run**, so there is no new silent no-op to diagnose this cycle. Both newest entries predate
the 09-23 run series and were dispositioned by earlier collects.

**[MEASURED] `sweep-rotation.json` is CLEAN — 04's claim that its predecessor's advance is still
uncommitted is REFUTED.** 04's F4 closes by telling me *"the previous run's advance is still sitting
uncommitted in the dev tree and needs your collect."* It is not:

```
git status --porcelain            -> 3 untracked files, NONE of them sweep-rotation.json
git rev-list --left-right --count HEAD...origin/main  ->  0	0
```

With the tree at `origin/main` and the file absent from `--porcelain`, the working copy and `main`
hold the same bytes — and `#2115` ("station 00 collect — … 04 rotation advance landed") is where it
went. The file reads `last_index: 3`, `last_run_utc 2026-09-23T06:10:31Z`, exactly as 04 read it.
**Nothing is owed to the collect here.** This is DOCTRINE §9.2's own trap seen from the far side: a
station correctly reporting a dirty file it inherited, after the cause had already been cleared.

**[MEASURED] Untracked in the dev tree, and what each one is:**

```
?? docs/pr-prompts/00-04-scanner-2026-09-23-1010-blind-device-bridge-down.md   <- 04's report. COMMITTED HERE.
?? docs/pr-reviews/pr-2114-review.md                                           <- review verdict. COMMITTED HERE.
?? "Claude Design/docs/index.html"                                             <- LEFT ALONE, see below.
```

`pr-2114-review.md` (4693 B) carries `VERDICT: MERGE` for #2114 and a `[YELLOW]` note that the two
checks failed — which this run has now resolved to `[LABEL_PRESENT]`, i.e. not a defect. It is
committed because it is a `docs/` artifact of real review work that otherwise reaches nobody, and
because an untracked file at a path a future PR must create is the documented fast-forward blocker.
⚠️ Its bytes were copied with a raw-Buffer node write, never re-encoded: read through
`Get-Content` it *displays* the `â€"` signature, which §9.3 records as **false mojibake in the
reader, not damage in the file** — "fixing" it is what causes the corruption for real.

**[CANNOT MEASURE] What 04's `gate-liveness` sweep would have found.** No Station 04 coverage exists
for the 06:10Z–14:09Z window. I am not reporting that slot clean; I am reporting that nobody looked.

## WHAT CHANGED

**Nothing on the board. One docs-only PR, in my own lane.**

- **No prompt armed, disarmed, renamed, moved, binned or staged.** `*-ready.md` was 0 before and 0
  after.
- **No PR merged, opened against product code, closed, labelled or unlabelled.** The
  `do-not-merge` label on #2114 was **not touched** — only Marco removes it.
- **No watcher action.** Not restarted, not killed, not paused. `restart-watcher-if-wedged.ps1` was
  not run with `-Fix` and nothing in the five signals above would have justified it.
- **No `git` run through the device bridge**, in any tree, by any route. Every git command in this
  run went through PowerShell on the Windows host.
- **This PR**, containing exactly three things: 04's 10:10Z breadcrumb (was untracked), this
  breadcrumb, `docs/pr-reviews/pr-2114-review.md` (was untracked), and the `git mv` of my own
  09:13Z breadcrumb into `archive/` now that every finding in it is dispositioned.

## FINDINGS

**F1 — Station 04's 10:09Z occurrence ran BLIND; no sweep executed, and `gate-liveness` is now
owed. [MEASURED, collected from 04's breadcrumb]**

04 reports three `ToolSearch` load attempts in three query forms, then the server's own verdict —
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): connection timed out after 30000ms`.
That is a failure **after** a successful load, which the contract defines as blindness. It did the
right thing throughout: it did not declare on the first miss, it did not substitute GitHub-side
reads as coverage, it refused to run `check-backlog.mjs` (which `execSync`s git gate strings with
`cwd` = the mounted repo, the exact action that has frozen this board seven times), and it did not
advance the rotation past a sweep it never ran.

Cross-checking the pattern rather than the occurrence: **my own run, 5 minutes later on the same
box, connected on the first call.** So this is the intermittent blindness
`STATION-CAPABILITIES.md` §2 records at ~40% of runs with **no known cause** — one more data point
in a known pattern, not a new break. The cost is specific and cumulative: **the board has had no
Station 04 coverage in this 4-hour slot**, and `gate-liveness` — the sweep that catches finished
work still armed on the board — is owed. Next 04 occurrence: `2026-09-23T14:09:31Z`.

**DISPOSITION: ESCALATED.** The standing escalation
`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md` already carries
this question and is live — the sweep's section 5 confirms it is not stale (its three cited PRs are
evidence, not premise). I am **not** appending to it: that folder is gitignored by rule and **partly
tracked in fact**, so an append can ride into another actor's commit, and the question there is
already correctly framed. What this run adds is the tally and 04's own option set, which is better
than mine and is reproduced in its breadcrumb (now tracked by this PR): (1) make the stations
tolerant of a dead bridge — a `git`-free, `pwsh`-free read-only pass that turns ~40% of runs from
zero coverage into partial coverage; **complete and additive, passes both halves of RULE 1**;
(2) diagnose the 30 s timeout itself — complete only if the cause proves fixable, and §2 records it
as unknown; best run alongside (1), not instead; (3) accept it — fails both halves, coverage keeps
dropping invisibly.

**F2 — #2114 is release-ready and parked on Marco's label. The gate is working exactly as designed.
[MEASURED]**

13 pass / 2 fail, and both reds are the one CP-26 `[LABEL_PRESENT]` cause, quoted verbatim above.
The PR is watcher-opened (3 prompt-log hits, controls 703/0), so two independent gates bind me: the
label, and the watcher's own routing. Its review verdict is `VERDICT: MERGE` and its migration is
additive — two **nullable** columns (`estimate_plant_rates.transport_type`,
`scope_waste_items.capacity_source`), with `GATE-ALLOW: migrations` at column 0 in the body.
It has been parked since 06:10:46Z.

**DISPOSITION: ESCALATED — Marco, a decision, not a status line.** RULE 1 order:

1. **Remove the `do-not-merge` label and let the gate release it.** The diff is additive (two
   nullable columns, no drop, no retype, no backfill), the review verdict is MERGE, and CI is green
   on everything that is not the label itself. **Solves it completely — immediately, because the two
   reds clear the moment the label goes, and for the future, because nothing about this change
   constrains later data entry.** Passes both halves of RULE 1.
2. **Review the migration first, then remove the label.** Same endpoint, one extra step. Fails
   neither half of RULE 1; it costs a cycle, and the only thing it buys is a second look at a
   nullable-column add.
3. **Leave it parked.** Fails the "immediately" half: the board's only open PR stays blocked, and
   every S9-dependent prompt behind it stays gated. It damages no data, so it fails one half, not
   both.

I cannot progress this myself under any reading: the label is yours alone, and the watcher routing
binds independently of it.

**F3 — Nothing on the board is armable, and that is the board's correct state. [MEASURED]**

0 armed, 14 HOLD, 0 ADMIT, 0 spent, 0 possible duplicates, with `triage-holds.ps1`'s GIT and SPENT
controls both PASS and three distinct rejection codes across the corpus. Ten prompts carry a human
gate (Marco's, by construction) and four are waiting on a file that has not landed. **No arming
decision was available this run, and I did not manufacture one.** Q6's single most important
blocker follows directly: **it is F2** — the one open PR is parked on a label only Marco can remove,
and with nothing armable behind it the board has no other move.

**DISPOSITION: ACTIONED** — measured live this run with controls, not quoted from a prior
breadcrumb; nothing armed, nothing retired, nothing binned.

**F4 — 04's claim that its predecessor's rotation advance is uncommitted is REFUTED. [MEASURED]**

`sweep-rotation.json` is absent from `git status --porcelain` on a tree that is `0 0` against
`origin/main`; `#2115` landed the advance. 04 read the file correctly (`last_index: 3`,
`2026-09-23T06:10:31Z`) and drew a stale conclusion about its commit state, which it could not
check — it had no git. Recording it so the next collect does not go looking for work that is done:
this is the same shape as DOCTRINE §9.2's *"on a tree that is behind, `git status` answers a question
about HEAD"*, reached from the opposite direction by a run with no `git` at all.

**DISPOSITION: ACTIONED** — verified nothing is owed; no file touched.

**F5 — `vm-git-guard` is INERT, so the device-bridge git ban is remembered rather than mechanical.
[MEASURED, independently reproduced]**

Exit 2, byte-for-byte the station doc's own middle row, reproduced in my session
(`lucid-funny-cannon`) as 04 reproduced it in its own. This is the **expected** outcome, not a
regression: the installer writes its `PATH` export to `~/.bashrc` / `~/.profile` and a station's
shell is non-interactive and non-login, so it sources neither.

**DISPOSITION: DEFERRED.** **What would make it urgent:** an `index.lock` in
`C:\ProjectOperations2\.git` with no owning Windows process — **measured absent this run** (sweep
section 3: `index.lock interactive/clone: False / False`, git processes touching our trees: **0**);
or any station's breadcrumb reporting it ran a `.mjs` checker from the VM — none did. The complete
fix is for the installer to emit something a non-login shell can `source`, which is a
`scripts/` change and therefore outside my lane to merge.

**F6 — 04's F3 dispatched me a documentation gap that is already filled, but names two real
cross-reference holes. [MEASURED — the central claim is REFUTED]**

04's F3 states that *"no binding document covers"* the bridge-down / mount-readable state and
dispatches the amendment to me. **That is not so.** `STATION-CAPABILITIES.md` §3 covers it twice and
in detail — the 2026-09-05 block (*"THE STOP STANDS. WHAT IS FALSE IS 'A BLIND RUN CAN SEE
NOTHING'"*), which establishes that the mount **is** the live dev tree and enumerates what a blind
run may read; and the 2026-09-10 `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1` block, which adds the Cowork
native file tools as a third read transport and states the ceiling — no `.ps1`, no `git`, therefore
no liveness, smoke, safe-to-act or merge verdict. Both are in a document 04's own preflight requires
it to read in full. The capability list 04 proposes is, near enough, the one already written down.

What **is** true is narrower and worth keeping: neither of 04's two quoted passages — the STEP 1
blindness paragraph and §7.1's *"sanctioned liveness probes are PowerShell on the Windows host"*
sentence — points at §3, so a reader who meets the stop first can stop without learning the state is
covered. 04 did exactly that, in good faith, and spent a run's worth of reasoning re-deriving it.

**DISPOSITION: DEFERRED, and the reason is mechanical rather than a judgement about value.** The
STEP 1 blindness paragraph sits **inside the `CANONICAL-BLOCK: station-contract v5`**, which is
byte-identical across all seven station docs and hash-gated by `lint-station.mjs`. Amending it means
re-recording the hash and shipping all seven docs in one PR — which the station doc itself calls
more than a collect run should carry, and which would be the second such change deferred for the
same stated reason. **What would make it urgent:** a third station reaching the same wrong
conclusion, or any run improvising past the STEP 1 stop on the strength of a readable mount. The
substantive request behind it — letting a blind 04 run the `git`-free Part 0 static audit — is
F1 option (1) and belongs with F1, which is already Marco's.

**F7 — One orphaned worktree, `C:\po-wt\s9hex`. [MEASURED]**

Sweep section 2: `orphaned worktree (aborted run leftover): C:/po-wt/s9hex  f878a0a1 (detached
HEAD), dirty=0 files, age=241 min`. Clean, detached, and ~4 hours old — consistent with the S9 build
that produced #2114 at 06:10Z. Nothing is running in it (section 3: 0 git processes touching our
trees, no build in flight), so it is leftover rather than live.

**DISPOSITION: DISPATCHED — to Station 03 (Machine-minder)**, whose lane is worktrees, locks and
local trees, and which wakes on its own cadence (`0 9 * * *`, next `2026-09-23T23:02:45Z`) and reads
this breadcrumb. Handing over: the path, the SHA `f878a0a1`, `dirty=0`, age 241 min at 10:16Z, and
the standing rule that `git status --short` is run in it before anything is suggested and that
**nothing is deleted unsupervised**. I did not touch it: doing 03's job myself is LL-38, which is
the incident this station is named in.

**F8 — Two real artifacts were sitting untracked in the dev tree and reached nobody. [MEASURED]**

`00-04-scanner-2026-09-23-1010-blind-device-bridge-down.md` — the whole of 04's coverage report for
this slot, including the escalation in F1 — and `docs/pr-reviews/pr-2114-review.md`, a completed
review verdict. `check-breadcrumb.mjs` said so itself in its NOTE line. Before committing either as
unreported I asked the **tracked set on `origin/main`**, not the dev tree's index
(`git ls-tree -r --name-only origin/main -- docs/pr-prompts/`, matched by basename): **1** root
breadcrumb tracked, my own 09:13Z one, and neither of these two. So they are genuinely unreported
and this is not the 2026-09-07 duplicate-basename case.

**DISPOSITION: ACTIONED** — both are committed by this PR, with the read-back recorded in the PR
body. 04's breadcrumb is also now certified `breadcrumb-clean` by the only validator that can do it,
which its own author correctly declined to claim.

## WHAT I DID NOT DO

- **Did not merge anything, and did not touch #2114's `do-not-merge` label.** Two independent gates
  bind: the label (Marco's alone) and a real watcher routing, measured this run and not carried
  forward from a breadcrumb.
- **Did not arm, disarm, rename, bin or stage any prompt.** Nothing was armable (F3), and a
  manufactured arming decision on a board whose only PR is parked would lengthen the queue, not
  shorten it.
- **Did not restart, kill or pause the watcher.** Five independent signals agree it is idle-correct,
  not wedged — and killing a healthy watcher on a stale heartbeat with an empty queue is the
  documented false-emergency this station has already made once.
- **Did not clear, prune or touch `C:\po-wt\s9hex`** — Station 03's lane (F7).
- **Did not discharge anything from `needs-marco/`** — zero `[STALE]` rows this run, measured, so
  there was nothing dead to move. I also did **not** append to the open blindness escalation: that
  folder is gitignored by rule and partly tracked in fact, and an append can ride into another
  actor's commit.
- **Did not amend the canonical station-contract block** (F6) — a seven-document, hash-re-recorded
  change, deliberately out of scope for a collect run and stated as such rather than done quietly.
- **Did not run any `.mjs` checker or any `git` through the device bridge.** The guard is INERT
  (F5), so the ban was honoured by hand.
- **Did not run a smoke or a visual pass.** No PR on this board is mine to drive: the only one is
  parked on Marco, and `apps/web/**` vision review applies to a PR I am merging.
- **Did not commit `Claude Design/docs/index.html`.** It is untracked, sits outside
  `docs/`, and is not a pipeline artifact — it is not mine to land, and I am flagging rather than
  sweeping it. ⚠️ **It will block a future fast-forward if a PR ever lands that exact path**, which
  is the only reason it is named here.
- **Did not touch `/sot/`** (Station 05's, CP-24), production data, or any Azure / Entra /
  SharePoint surface.
- **Did not leave this report in the Cowork session's `outputs` folder.** It is committed by this
  PR, which is the best of the two sanctioned homes.
