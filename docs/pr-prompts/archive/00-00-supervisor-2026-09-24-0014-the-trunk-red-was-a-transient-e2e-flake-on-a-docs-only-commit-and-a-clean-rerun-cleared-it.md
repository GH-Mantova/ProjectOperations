# Station 00 — Supervisor | 2026-09-24T00:14:01Z–2026-09-24T00:52Z

## FOR MARCO

**Nothing needs you that you have not already been asked. The board is three green PRs, all three
yours, and that is the only thing stopping it moving.**

One thing was genuinely broken this run and is now fixed: **`main` was showing a RED trunk**
(`Tendering Browser Smoke`, 4 failed e2e tests) on commit `a30e9971`. That commit is a **docs-only**
station breadcrumb merge — four files, all under `docs/pr-prompts/`. A docs diff cannot break
dashboard e2e rendering, which is the transient class my own station doc rule 5 names by hand. I
re-ran the failed job and **it passed clean on attempt 2**. Trunk is now 4/4 green. No regression, no
fix needed, and nothing for you to look at.

The three open PRs (`#2135`, `#2131`, `#2127`) are all CLEAN, all 15/15 green, all unlabelled, and
all three route to you — two by a real watcher `marco:true` verdict quoting the exact out-of-lane
file, one by hand-classification. **I re-took that verdict this run rather than carrying it forward
from yesterday's**, because a lane classification is non-monotonic (DOCTRINE §10.1). The answer is
the same as yesterday's, measured fresh.

No question is being put to you in this run.

## GROUND

```
UTC            2026-09-24T00:14:01Z
origin/main    a30e9971            (fetched in the dev tree, then rev-parse)
dev tree       main @ a30e9971      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

**Doc version and bootstrap AGREE (1 = 1).** This run was READ-WRITE-eligible by that test.

**Which tree I read in:** the dev tree `C:\ProjectOperations2`, as PREFLIGHT step 2 requires.
`git rev-list --left-right --count HEAD...origin/main` → **`0	0`**, `git diff --numstat` **EMPTY**,
`git diff --cached --name-status` **EMPTY**. The working copy is therefore byte-identical to
`origin/main` for every tracked file, including all three binding documents, so the working-copy
reads are authoritative and no `git show` dump was needed. I used the `--numstat` form, never a piped
hash (§9.1 forbids the pipe in `powershell.exe`).

**THIS RUN WAS SIGHTED, NOT BLIND.** `start_process` shell `powershell.exe` returned a live shell on
the Windows host on the first attempt after the tool schemas were loaded (PID 38728, and a probe
shell 17956 before it). Stated explicitly because a blind run and a healthy quiet run both produce
"no news", and this is the healthy-quiet kind.

## WHAT I MEASURED

**Device-bridge git guard — the PREFLIGHT install, quoted as the contract demands.**
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`
Last line, verbatim:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/dreamy-gracious-thompson/.local/bin:$PATH" git <args>
```

**EXIT CODE: 2** — read from the installer itself, not from a pipeline appended to it. That is the
middle outcome of the contract's three-outcome table: `vm-git-guard INSTALLED BUT INERT - the shim is
correct and UNREACHABLE from your shell.` Its own controls printed in the output:
`bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`. [MEASURED] So
the device-bridge git ban was REMEMBERED, not mechanical, for this run — and I honoured it: every
`git` call in this report ran in `powershell.exe` on the Windows host, none through the bridge
against a mount.

**§9.1's `-Command` expansion layer reproduced, unintentionally, in my own opening call.**
[MEASURED] my first probe was the NESTED form — `start_process` shell `powershell.exe` with command
`powershell.exe -NoProfile -Command "…; $env:COMPUTERNAME; …"` — and `$env:COMPUTERNAME` came back
**empty** while the two literal statements either side of it returned correctly. That is the
`COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1` row firing exactly as written. I switched to a
persistent shell driven by `interact_with_process` for the rest of the run, which is the transport
with no expansion layer, and every `$`-bearing statement below ran through it. Recorded as a
re-confirmation of a live bullet, not as a finding — it needs no disposition and the cure is already
binding.

**PREFLIGHT step 4 — the sweep.** `scripts\pipeline\status-sweep.ps1`, captured with `*>` and decoded
as `utf16le` in node. [MEASURED] the capture was **139,108 bytes opening `FF FE`** — §9.3's `*>`
UTF-16LE trap, reproduced exactly, in the cure PREFLIGHT itself prescribes. Decoded: 400 lines, ten
sections. `SWEEP_EXIT=0`. Section 7 verdict, verbatim:

> `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**Section 0 instrument positive controls both PASSED** (`gh` reached GitHub, saw merged #2139; node
runs). No `[BROKEN]` anywhere, so the report is usable.

**Section 5 `[STALE]` escalation rows: ZERO.** [MEASURED] `[STALE]` appears **4** times in the whole
capture and all four are the legend and the closing banner (lines 0, 3, 85, 398) — not one tagged
escalation row. The eleven-row backlog this section used to carry was discharged by earlier runs and
has not regrown. Nothing to clear here this run, and I am saying so rather than staying silent,
because "no rows" and "I did not look" read identically in a report.

**Section 3 — the single-actor gate (BOARD DRIVING condition 3), re-read immediately before I
mutated anything:** `index.lock` absent in both trees, **0** git processes touching our trees, **0**
machine-wide, no PR touched on GitHub in the last 2 minutes.

### The board — three PRs, all green, all Marco's

[MEASURED] per-PR, never from a list response (§9.4 — `merged` reads false on every list entry):

| PR | state | mergeState | labels | files |
|---|---|---|---|---|
| `#2135` | OPEN | CLEAN | **[]** | `.claude/hooks/guard.mjs` · `scripts/pipeline/__tests__/guard-devtree-reset.test.mjs` |
| `#2131` | OPEN | CLEAN | **[]** | `docs/pipeline/SCRIPT-REGISTRY.md` · `docs/pipeline/stations/00-supervisor.md` · `scripts/pipeline/why-blocked.ps1` |
| `#2127` | OPEN | CLEAN | **[]** | `apps/api/src/modules/field/field.service.ts` · `docs/pr-prompts/superseded/pr-field-service-nul-separator-HOLD.md` |

All three read **15 pass / 0 fail / 0 pending** in the sweep's live CI block. See **F1** for the lane
classification and why none of them is mine to merge.

### The trunk — red when I arrived, green when I left

[MEASURED] `gh run list --commit a30e99714c3f96315c14980c2b3fc3c0d62be196` with the **full 40-char
SHA** (§9.4 — a short SHA answers `[]` at exit 0) and `-R <owner>/<repo>` on every call (§9.4's CWD
bullet; my shell opened in the Cowork `outputs` folder, which is not a git repository):

| workflow | event | attempt 1 | attempt 2 |
|---|---|---|---|
| `Deploy` | push | success | — |
| **`Tendering Browser Smoke`** | push | **failure** | **success** |
| `CodeQL` | dynamic | success | — |
| `CI` | push | success | — |

Not the Dependabot/schedule denylist class — `#1852` landed that scoping on 2026-09-11 and this
failure is a real trunk check. See **F2**.

### The queue and the arming question

[MEASURED] `triage-holds.ps1`, `TRIAGE_EXIT=0`, READ-ONLY:

```
=== TOTALS  spent=0 of 13 evaluated  gates-satisfied=1  still-gated=12  unreadable=0
            of 13 prompts (HOLD=13, ready=0, LOOPING=0)
```

**GATES SATISFIED — 1: `pr-fv2-formrule-contract-HOLD.md`.** That prompt is on the **never-arm list**
named in this station's own doc (*"Never-arm list still stands: `pr-fv2-formrule-contract`,
`pr-siteid-notnull-backfill`, and any prod-data prompt"*). POSSIBLE DUPLICATES: none. SPENT: none.
SPENT BEHIND A REJECT: none — and the script states that its fixture control proved that bucket
reachable, so the zero means none rather than "this instrument cannot say".

Armed at depth 1: **0**, independently corroborated by the sweep. See **F3**.

### The machines

[MEASURED] from the sweep's `[LIVE]` block: watcher node **RUNNING pid 38776**, auto-restart wrapper
alive (1), heartbeat age 99 min — which with **0 armed** is idle and correct, not wedged (the
heartbeat only ticks mid-run). Non-main worktrees: none. Guard hook present.
`watcher clone: branch=main dirty=1` is the known false warning — see **F7**.

I did **not** re-derive the watcher chain by command line or re-sample `.queue-state.json`: Station
03 did both at 23:04Z, 70 minutes before this run, and found the full three-link chain correctly
parented and the freeze probe advancing by exactly one `RESCAN_INTERVAL_MS`. Re-running 03's work is
the LL-38 error, and nothing in the sweep contradicts it.

### COLLECT — freshness crossed against `lastRunAt`, as the contract requires

[MEASURED] `node scripts\pipeline\check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**:

```
00  last 2026-09-23T23:14:00Z  1.2h ago  (cadence 1h)  ok
02  dispatch-only — no cadence to miss
03  last 2026-09-23T23:04:00Z  1.3h ago  (cadence 24h)  ok
04  last 2026-09-23T22:10:00Z  2.2h ago  (cadence 4h)  ok
05  last 2026-09-23T14:23:00Z  10.0h ago  (cadence 24h)  ok
```

**`ok` is not an all-clear**, so I crossed every row against `lastRunAt` from the scheduled-tasks MCP
— the second instrument the station doc's table demands, because `check-breadcrumb.mjs` compares
breadcrumb dates and nothing else:

| station | `lastRunAt` (MCP) | newest breadcrumb | row |
|---|---|---|---|
| `00-supervisor` (`5 * * * *`, enabled) | `2026-09-24T00:14:01Z` — **this run** | 23:14Z | both fresh and aligned |
| `03-machine-minder` (`0 9 * * *`, enabled) | `2026-09-23T23:02:54Z` | 23:04Z | both fresh and aligned |
| `04-scanner` (`0 */4 * * *`, enabled) | `2026-09-23T22:09:39Z` | 22:10Z | both fresh and aligned |
| `05-sot-keeper` (`10 0 * * *`, enabled) | `2026-09-23T14:22:41Z` | 14:23Z | both fresh and aligned |
| `weekly-security-audit` (`30 7 * * 1`) | `2026-09-06T21:32:44Z`, **`enabled: false`** | n/a | off, already Marco's |

Every enabled station ran and every run that ran reported. **No station is SILENT, and none of the
three failure shapes in the station doc's table is present**, so no transcript read was owed. The
live **enabled count is FOUR**, which matches `STATION-CAPABILITIES.md` §1's 2026-09-15 correction
and not the retired "five".

**The tracked set was asked of `origin/main`, never of the dev tree's index**
(`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`): `git ls-tree -r --name-only origin/main --
docs/pr-prompts/` returns both root breadcrumbs as tracked, so neither is an unreported finding and
neither gets a second copy committed at the root path. The dev tree is at `0 0` against
`origin/main`, so the two probes could not have disagreed here — I used the sound one anyway.

**Breadcrumbs collected this run: 2.** Both are dispositioned below and both are archived in this
run's PR.

## WHAT CHANGED

Three mutations, each read back.

**1. Re-ran the failed trunk job.** `gh run rerun 35933692789 -R <owner>/<repo> --failed`, exit 0.
**Read back:** `gh run view 35933692789 --json status,conclusion,attempt` →
`status=completed conclusion=success attempt=2`, and the per-commit re-derivation above now returns
**4 of 4 success** on `a30e9971`. Not "I re-ran it" — the trunk is green and I read it back from the
instrument, not from the sweep.

**2. Created one isolated worktree off `origin/main` on the Windows FS**, per BOARD DRIVING condition
2: `C:\po-wt\collect0924` on `board/collect-2026-09-24-0014` at `a30e9971`. **Read back:**
`git worktree list` → the dev tree plus this one, and nothing else. It is torn down at the end of
this run.

**3. Archived the two collected breadcrumbs, inside that worktree.** `git mv` of
`00-00-supervisor-2026-09-23-2314-…` and `00-03-machine-minder-2026-09-23-2304-…` into
`docs/pr-prompts/archive/`. **Read back:** `git status --porcelain` shows exactly two `R ` rename
rows and nothing else.

**This breadcrumb is written INSIDE the PR worktree — cure 1 of the post-merge fast-forward rule.**
No loose copy is left in the dev tree, so this run creates no untracked FF blocker at a path its own
PR is about to land, and I will neither delete nor restore one afterwards. The two files I archived
are **tracked and unmodified** at their root paths in the dev tree, so the post-merge fast-forward
moves them cleanly with no `?? ` and no ` M` to cure.

`git diff --cached --name-status` in the **dev tree** was **EMPTY** before and after (the dev-tree
index is shared between concurrent chats, §9.2), so I staged nothing there and collided with nobody.
Everything staged is in the worktree's own index.

Scratch files outside the repo, in the sanctioned scratch folder:
`C:\po-sup-fix-scripts\sweep-00-2026-09-24.txt`, `triage-00-2026-09-24.txt`, `tbs-job.txt`.

**Nothing merged. Nothing armed. No label touched. No prompt renamed or moved outside the archive.
`/sot/` untouched.**

## FINDINGS

### F1 — All three open PRs are Marco's, by two different routes, and re-taken this run rather than carried forward. That is the whole of what blocks this board.

§10.1 step 1's probe, **the prompt logs alone, excluding `rev-*`**, pinned to the live tree
`C:\ProjectOperations2\docs\pr-prompts\processed\` and never the clone's dead decoy (§9.5):

| PR | `pr-*.log` hits | verdict |
|---|---|---|
| `#2135` | **1** | `[watcher] merge result for PR #2135: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}` |
| `#2127` | **2** | `[watcher] merge result for PR #2127: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}` |
| `#2131` | **0** | no verdict ⇒ `[NO LANE VERDICT — hand-classified]` |

**POSITIVE control** `marco.:true` over the same corpus → **705** (written without a quote character,
per §10.1's own note — the `-SimpleMatch '"marco":true'` form returns 0 and so does its negative
control). **NEGATIVE control**, freshly minted needle `zzQq00Needle20260924T0031` → **0**.
**FRESHNESS control**, which is the one that separates the live corpus from the seventeen-day-stale
clone copy: newest log `rev-2138-ready.md.log` at `2026-09-23T22:38:41Z`, **younger than the oldest
open PR** (`#2127`, created `2026-09-23T16:36:48Z`). All three controls pass.

**Neither verdict is a prose scrape** (`PRNUMBER_SCRAPED_FROM_PROSE_V1`). Each sits in the log of a
prompt whose own slug names that PR's subject — `pr-devtree-sync-ff-only-guard` for `#2135`'s ff-only
guard, `pr-field-service-nul-separator` for `#2127`'s NUL separator — and each verdict's `reason`
quotes a file that is actually in that PR's diff. A verdict appearing only in prose would satisfy
neither test.

**`#2131` hand-classified under step 2**, reading `classifyPolicyFiles` rather than paraphrasing it.
Two of its three files are `docs/`; `scripts/pipeline/why-blocked.ps1` matches none of the three
`NESTED_TEST_PATHS` forms, so it is outside `tests|docs` ⇒ **Marco's**. **Step 3's station-lane
exception does not rescue it**: 00's recorded lane in the §5 authority matrix is `docs/`, and
`scripts/` is outside it, so the PR "strays outside its station's lane" and falls through to step 2
unchanged. This is exactly the narrowing `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` landed
on 2026-09-22 — not-watcher-routed is a necessary condition, never a sufficient authorisation — and
`#2131` is precisely the class it names: a green, unlabelled, `scripts/`-touching PR that repairs
this pipeline's own instruments. **It is the one a station is most tempted to merge itself.**

`#2135` is the same shape from the other side: its test file passes `(^|/)__tests__/` cleanly, and it
is `.claude/hooks/guard.mjs` alone that routes the whole PR to Marco — which the watcher's own
`reason` string names.

**DISPOSITION: ESCALATED** — carried unchanged to the existing standing file, not re-filed as a new
question. This is the measured throughput constraint, not a new defect: 00 can arm, the watcher can
build, CI can green — and every PR touching anything outside `tests/` or `docs/` then stops until
Marco merges. **Three consecutive runs have now reached this identical verdict**, and nothing about
re-deriving it a fourth time changes it. No agent-side action exists behind a `marco:true`.

---

### F2 — The trunk was RED on a DOCS-ONLY commit, which is the transient class by construction. A clean re-run cleared it, and the trunk is green.

`status-sweep.ps1` reported `main CI on a30e9971: 3 success / 1 failed  <-- TRUNK IS RED`. Per
`SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`, **provenance is not correctness**, so I re-derived it from its
own source before acting: the failing run is `Tendering Browser Smoke` (`35933692789`), event `push`
— **not** the `Dependabot Updates` / `schedule` class `#1852` denylisted on 2026-09-11. The red was
real.

**I read the job log, never the diff** (§3, and YOUR LIMITS item 6). Job `tendering-e2e`
(`107425882046`), 3,096 lines, decoded `utf16le`, and **searched on the LAST tab-separated column**
because column 1 is the job name and a bare grep matches every line (§9.1). Four failures, all in
`tests/e2e/pr-acceptance/batch1-dashboards.spec.ts`:

| # | test | assertion |
|---|---|---|
| SLICE 5 | dashboard filter bar accepts input | `getByRole('dialog', { name: 'Customise dashboard' })` still **visible** 5 s after Save |
| SLICE 7 | create dashboard from template | new dashboard link **not found** in nav after 10 s |
| SLICE 4 | add a report chart widget | element(s) not found |
| SLICE 6 | Export button triggers a download | element(s) not found |

**The discriminator is the diff, and it is decisive.** [MEASURED] `git show --stat --name-only
a30e9971` → **four files, every one under `docs/pr-prompts/`** (two breadcrumbs, two archive moves) —
`#2139`, my own predecessor's collect PR. **A docs diff cannot break dashboard e2e rendering.** The
station doc's rule 5 names this exact case: *"a CODE check failing on a docs-only or unrelated diff
while `main` is green — is transient. Re-run it."* Corroborating, in the same run: `##[warning]
Failed to restore: Cache service responded with 400` / `pnpm cache is not found`. And the failure
shapes are *save-did-not-complete* timings, not missing markup.

**History, which is what rules out a latent regression:** [MEASURED] the 25 most recent
`Tendering Browser Smoke` runs on `main` — **24 consecutive `success` and this one `failure`**,
including `e3e3a471` fifty minutes earlier.

🔧 **ACTIONED: `gh run rerun 35933692789 --failed` → attempt 2 `conclusion=success`.** Re-derived
per-commit afterwards: `Deploy`, `Tendering Browser Smoke`, `CodeQL`, `CI` — **4 of 4 success**. The
trunk is green.

⚠️ **The re-run IS the diagnostic here, not a hope for green** (§2). Rule 5 authorises it for exactly
this class, and the discriminator was established *before* the re-run, not after: a docs-only diff
cannot have caused it. **Had attempt 2 failed again, that would have been a real defect** and the
correct next move a `fixes_pr` against `main`, not another re-run.

**DISPOSITION: ACTIONED** — verified by the per-commit re-derivation above, not by the sweep, and not
by the re-run's exit alone.

⚠️ **One thing this does NOT establish, and I am not claiming it:** `batch1-dashboards.spec.ts` now
has a recorded flake. One flake in 25 runs is not a pattern and I am not filing it as one. **What
would make it a finding:** a second `Tendering Browser Smoke` failure on `main` in that same spec
within the next week, or any failure of it on a commit whose diff touches `apps/web`. Either makes it
a flaky-test defect rather than an infrastructure hiccup, and that is Station 04's rotting-instrument
question before it is mine.

---

### F3 — Nothing is armable, for the third consecutive run: 13 HOLDs, exactly one gate-satisfied, and that one is on the never-arm list.

[MEASURED] `triage-holds.ps1`: `gates-satisfied=1`, and the one is
**`pr-fv2-formrule-contract-HOLD.md`** — named on this station doc's never-arm list verbatim. Twelve
are correctly still gated: seven `[HUMAN_GATE_PRESENT]`, four `[FILE_GATE_NOT_RELEASED]`, one
`[GATE_NOT_RELEASED]`. Zero SPENT, zero POSSIBLE DUPLICATES, zero SPENT-BEHIND-A-REJECT — and the
script states its fixture control proved that last bucket reachable, so the zero means *none* rather
than *this instrument cannot say*.

**ADMIT is necessary, not sufficient** (§9.5), so a lint ADMIT on a never-arm prompt is not an
invitation; and I did not treat the union grep's silence as permission either.

**DISPOSITION: ACTIONED** — checked and deliberately not armed. **Recorded rather than passed over in
silence, because "armed 0" and "I did not look at the queue" read identically in a report.** The
queue is not the constraint; **F1 is**. Arming faster would make the queue longer, not shorter, while
every non-docs PR waits on Marco.

---

### F4 — Station 03's F3 worktree-prune dispatch is CLOSED. Both orphans are gone, verified live.

03 dispatched the prune of `C:\po-wt\rel06` and `C:\po-wt\s9hex` to me at 23:04Z, with the evidence
that both held zero unlanded code. My predecessor ACTIONED it at 23:14Z. **[MEASURED] live this run,
rather than taken from my predecessor's title:** `git worktree list` → **`C:/ProjectOperations2
a30e9971 [main]` and nothing else.** Both orphans pruned; the sweep independently reports
`non-main worktrees: none` and `worktree-registry-escapees: none found under known roots`.

**DISPOSITION: ACTIONED** — closed, re-verified at this run's SHA rather than carried on a claim.
03's warning stands for whoever meets this next: **do not re-confirm worktree safety with
`rev-list --count` or a two-dot diff** — on squash-merged branches both say "unlanded". The sound
probe is the three-dot diff crossed against the two-dot diff.

---

### F5 — Station 03's F1 and my predecessor's F4: the watcher death rate. Carried unchanged; no trigger fired.

Eight `raw node exit: -1` deaths in fourteen days, eight recoveries, the most recent at
`2026-09-23T18:35:05Z` with the keepalive restoring service in **4 m 51 s** and no work lost. The
crash class is already Marco's in
`needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md`.

[MEASURED] this run: the watcher is **RUNNING pid 38776** with its wrapper alive — the same PID 03
resolved by command line at 23:04Z, so there has been **no ninth death** in the 70 minutes since.

**DISPOSITION: DEFERRED**, 03's and my predecessor's disposition carried unchanged. **Urgent if** a
recovery ever exceeds one keepalive interval (10 min), OR a daily log's launcher-banner count goes
above ~5 (the kill-loop signature — 09-18 hit 269), OR a death leaves the started job's verdict
absent from **all three** verdict homes. None of the three is present.

---

### F6 — Station 03's F2 and F4: the clone's 77-stash closed loop, and `#1960` still stuck in `conflictedPrs`. Both carried; neither trigger fired.

The clone's `git stash list` stood at **77** at 23:04Z against the **71** DOCTRINE §9.5 records for
2026-09-10 — +6 in 13 days, strictly monotonic because the launcher auto-stashes a tracked-dirty
clone on every start and nothing ever pops. And `.queue-state.json` still carries `[1960]` in
`conflictedPrs`, 7.8 days after that PR closed unmerged, unchanged and not grown.

I did **not** re-measure either: both are Station 03's instruments in a shared tree it read 70
minutes ago, both are slow-moving by construction, and re-running them would be 00 doing 03's work
(LL-38). **The counts above are 03's measurement, tagged as such, not mine.**

**DISPOSITION: DEFERRED** for both, dispositions carried. **Urgent at** ~150 stashes, or any
stash-related `git` failure in the clone, or the clone's `.git` growth becoming a disk question; and
for `conflictedPrs`, at 5+ entries, or on any evidence the watcher *acts* on that list rather than
merely reporting it — which 03 correctly marked `[CANNOT MEASURE]` rather than assuming inert.
**The remedy when it is time is `git stash drop`, never `pop`** (§9.2).

---

### F7 — The sweep's `watcher clone: dirty=1 <-- the watcher may refuse to start` is one untracked review verdict, by design. Recognised and NOT dispatched.

The sweep fired this line again, with `dirty=1`. 03 re-ran §9.5's falsifying probe at 23:04Z — both
`git status` forms against the clone in the same minute — and got `git status --short` → **1** (the
one file being `?? docs/pr-reviews/pr-2127-review.md`, a `rev-<N>` verdict the review lane writes
into the clone by design) against `git status --porcelain --untracked-files=no` → **0**. **The two
forms still disagree, so the bullet stands.**

**The measured cost of this line is a MIS-ROUTED DISPATCH to Station 03**, thirteen times over in
`archive/`. **DISPOSITION: DEFERRED** — the correct response to meeting it is to recognise it and not
dispatch, which is what I did. Already documented in §9.5 and already narrowed by `#2129`. **Urgent
if** the two forms ever agree (which kills the bullet), or the clone goes genuinely tracked-dirty.

---

### F8 — Station 03's F6 and my own: the device-bridge git guard installed INERT (exit 2), the expected station outcome.

Exit **2** for the second consecutive run, read from the installer and not from a pipeline appended
to it, with its own two controls printed. The shim is byte-correct and off the `PATH` of the
non-interactive non-login shell a station is given, so the ban was remembered rather than mechanical.
I honoured it.

**DISPOSITION: DEFERRED** — expected behaviour per the contract's own three-outcome table, already
the subject of merged work (`#2065`). Recorded because the contract requires the exit code and last
line in the report whichever outcome occurred: an install nobody can see in the report is
indistinguishable from one that never ran. **Urgent if** it ever exits **0** (the ban became
mechanical, and the remembered-discipline warnings can be relaxed) or non-zero-but-not-2 (the shim
was not written at all).

## WHAT I DID NOT DO

- **Did not merge anything.** All three open PRs carry a real `marco:true` verdict or hand-classify
  to Marco (F1). `Assert-SmokedOrEscalate` → `Merge-Pr` was never reached, because the gate that
  stops them is upstream of it. I did not reach for `gh pr merge`, `--admin`, or a hand `git merge`.
- **Did not remove or add a label.** All three PRs read `labels=[]`; only Marco removes
  `do-not-merge`, and none is present to remove.
- **Did not arm anything.** One prompt is gate-satisfied and it is on the never-arm list (F3). Armed
  stayed **0** for the whole run.
- **Did not re-derive the watcher chain, re-sample `.queue-state.json`, count stashes, or triage
  `failed/`.** Station 03 did all four 70 minutes before this run, found them healthy, and nothing in
  the sweep contradicts it. Doing 03's work myself is the LL-38 incident, not thoroughness.
- **Did not chase the four failing e2e tests into `apps/web`.** The diff at the failing commit is
  docs-only, which makes a code regression impossible at that commit; re-running was the sanctioned
  diagnostic and it cleared (F2). I have named what would turn it into a real finding rather than
  leaving it unbounded.
- **Did not file the e2e flake as a new escalation, and did not re-file F1, F5, F6, F7 or F8 as new
  questions.** Each is a known class with a live owner; a ninth instance of a filed class is noise
  that trains Marco to stop reading.
- **Did not run `git` through the device bridge against either Windows `.git`**, and ran no
  `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean` anywhere —
  consumed prompts come back armed (§9.2).
- **Did not commit anything on `main` or in the dev tree**, and did not touch
  `C:\po-watcher\ProjectOperations` with any write. Every mutation is in the disposable worktree.
- **Did not touch Azure, Entra or SharePoint**, and did not write production data. Absolute, and not
  reasoned past.
- **Did not edit `/sot/`.** That is Station 05's, gated by CP-24.
- **Did not invoke another station's skill.**

<run-summary>Sighted run: the trunk was red on a docs-only commit, which cannot cause a code failure — a clean re-run cleared it and main is 4/4 green; the three open PRs are all Marco's by freshly re-taken lane verdicts, nothing is armable but a never-arm prompt, and every station reported on cadence.</run-summary>

---

## ADDENDUM 2026-09-24T01:00Z — same station, same run, later measurement. THE BODY ABOVE DESCRIBES THIS RUN'S INTENTIONS AND IS WRONG ABOUT TWO OF ITS EFFECTS.

The `WHAT I DID NOT DO` list above opens *"**Did not merge anything.**"* It was true when written and
**false ten minutes later**. This station's own meta-lesson is *"your report described your
intentions, not your effects"*, so this is corrected in place rather than left for the next run to
discover from the board.

**Two further mutations after the body above was written, both read back:**

**4. Merged this run's OWN board PR, `#2140`.** Through the sanctioned primitive, not by hand:
`Assert-SmokedOrEscalate -PR 2140` → `True`, then `Merge-Pr -PR 2140`. **Read back two ways:**
`gh pr view 2140 --json state,mergedAt,mergeCommit` → `MERGED`, `2026-09-24T00:49:29Z`, merge commit
`d1e69cab`; and `git rev-parse --short origin/main` → **`d1e69cab`** — the same commit, so it reached
`main` and I am not stopping at "auto-merge enabled". Lane: Station 00, `docs/`, its recorded lane in
`STATION-CAPABILITIES.md` §5, which §10.1 step 3 defers to by name. **This does not contradict F1:**
F1 is about the three PRs that are *Marco's*, and `#2140` is none of them.

⚠️ **On the first attempt `Assert-SmokedOrEscalate -Number 2140` FAILED LOUD**, and correctly: the
parameter is `-PR`, so `$PR` bound to **0** and the guard threw
`Assert-SmokeGreen: #0 reports NO checks at all. That is not a pass.` A guard that refuses on a
mis-bound argument instead of passing on a zero is the guard working; recorded because the next
reader of this library will make the same mistake.

**5. Updated all three of Marco's PR branches, which MY OWN MERGE had just put BEHIND.**
[MEASURED] immediately after `#2140` landed: `#2135`, `#2131`, `#2127` all read `BEHIND` — they had
all read `CLEAN` before it. `gh pr update-branch` on each, **exit 0 / `✓ PR branch updated`** three
times. **Read back at +45 s:** all three `BLOCKED`, which on a just-updated branch is checks-pending,
not a defect. **Read back again at +4 min:** `pass=13 fail=0 pending=2` on **each of the three** —
**zero failures anywhere**, CI simply still finishing.

🔧 **Updating a branch is not merging, and it is squarely rule 2's *"behind-branches are work, not
blockers to hand back"*.** I caused the BEHIND by merging my own board PR, so leaving three of
Marco's PRs un-mergeable behind my own housekeeping would have been handing him my mess. The merge
gate on all three is untouched: no label added or removed, no `marco:true` cleared, nothing merged.

**6. Resolved `armed=1`, which appeared only after the merge, rather than reporting it.**
[MEASURED] the one file is **`rev-2140-ready.md`** (mtime `2026-09-24T00:49:03Z`) — the watcher's
auto-generated REVIEW JOB for the PR I had just opened, matching `READY_PATTERN`
(`/^(pr|rev)-.*-ready\.md$/i`, read from `origin/main`) but **not a prompt**: §9.5 says to exclude
`rev-*` from prompt audits. **The real armed-prompt count is still 0**, so F3 stands unchanged. Its
verdict will be read by nothing, because `#2140` is second-lane and `verdictApproves` has exactly one
call site inside `waitForPolicyMerge` (`REV_LANE_UNCONSUMED_ON_SECOND_LANE_V1`) — already filed as
`needs-marco/rev-lane-reviews-second-lane-prs-that-nothing-reads-2026-09-11.md`, not a new finding,
and moot here since the PR is already merged.

**Post-merge fast-forward of the dev tree: clean, and cure 1 is why.** `git merge --ff-only
origin/main` succeeded on the **first** attempt with no blocker to cure — because this breadcrumb was
written inside the PR worktree and the two archived files were tracked and unmodified at their root
paths. **All FOUR read-backs, the fourth being the only one that can see a dirty tree:**
`git rev-list --left-right --count HEAD...origin/main` → **`0	0`**; `git diff --numstat` → **EMPTY**;
`git diff --cached --name-status` → **EMPTY**; `git status --porcelain --untracked-files=no` →
**EMPTY**. **Content proof:** the new breadcrumb `git ls-files` → **1** (tracked); both archived
copies `Test-Path` → **True**; root breadcrumbs remaining → **1**, this one, which is the current
cycle and correctly not archived.

**Teardown.** `git worktree remove C:\po-wt\collect0924 --force` then `git worktree prune`;
`git worktree list` → **`C:/ProjectOperations2 d1e69cab [main]` and nothing else**. Remote branch
deleted by `Merge-Pr`: `git ls-remote --heads origin board/collect-2026-09-24-0014` → **empty**.
A second short-lived worktree (`C:\po-wt\add0924`) carried this addendum and is torn down the same
way.

**DISPOSITION of this addendum: ACTIONED** — the record now matches the effects, read back rather
than asserted. **Nothing here changes any finding above**: F1 still escalated and untouched, F3 still
0 armed, F2 still the transient trunk red cleared by a re-run.
