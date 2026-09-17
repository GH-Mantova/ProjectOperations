# Station 00 — Supervisor | 2026-09-17T13:07Z–2026-09-17T13:25Z

## GROUND

```
UTC            2026-09-17T13:08:35Z
origin/main    576e2add            (git fetch origin +refs/heads/main:..., then git rev-parse --short origin/main)
dev tree       main @ 576e2add     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **AGREE**. Full authority for the lane; this run was not read-only.

**This run was SIGHTED.** `start_process` shell `powershell.exe` answered on the first call after a
keyword `ToolSearch` for `desktop-commander`. Stated explicitly because a blind run and a healthy
quiet run produce identical silence.

## WHAT I MEASURED

**Device-bridge git guard, installer's last line quoted as the contract requires.** [MEASURED]
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`:

```
vm-git-guard installed at /sessions/<session>/.local/bin/git - refuses mounted paths and mounted cwd,
allows everything else (three controls passed)
persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim
```

PASS. Every `git` below ran through Desktop Commander on the Windows host, never the VM.

**Binding-document freshness, by the sound forms only — no piped hash (PREFLIGHT §2).** [MEASURED]
in the **dev tree**: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, and
`git rev-list --left-right --count origin/main...HEAD` → `0	0`. The working copy is therefore
byte-identical to `origin/main` for all three, which is what makes the reads below sound.

✅ **Scope of the read, stated honestly: all three were read IN FULL this run** — `00-supervisor.md`
1349 lines, `DOCTRINE.md` **2588 lines** end to end (§1–§10.6), `STATION-CAPABILITIES.md` 544 lines.

**§9.1's nested-`-Command` expansion trap REPRODUCED LIVE, and its 2026-09-14 correction is
confirmed rather than merely re-read.** [MEASURED] both transports inside this session, minutes
apart, same machine, same shell:

| transport | result |
|---|---|
| `start_process` command = `powershell.exe -NoProfile -Command "… + $LASTEXITCODE …"` — the NESTED form | `ParserError: You must provide a value expression following the '+' operator`, the token gone before the child parsed — **expansion** |
| `start_process` shell `powershell.exe`, statements sent **direct** | `FRESHNESS_EXIT=0` and `MARKER_A` — **no expansion** |

This is the discriminating pair §9.1's `COMMAND_LAYER_EXPANSION_IS_THE_NESTED_FORM_V1` clause asks
for, and it landed in the direction that clause predicts. Every subsequent statement in this run went
through the **direct** transport, and every chain carries a literal `MARKER_*` echo after its last
statement so an unrun statement cannot be read as one that found nothing (§9.1 guard 1).

**`status-sweep.ps1` — run, and DRAINED rather than believed at first read.** [MEASURED] exit 0,
runtime 193 s, **427 lines**, read with explicit offsets until `0 remaining`. The first
`read_process_output` returned 384 lines mid-section-5; had that been treated as the whole report,
sections 6 and 7 — **including the verdict** — would have been missing and unnoticed.

```
==================== 7. VERDICT ====================
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

**Section 5 holds ZERO `[STALE]` escalation rows this run.** [MEASURED] a `-SimpleMatch` search for
`[STALE]` over the capture returned **3** hits and **all three are the legend or a quotation** — the
report header, the HOW-TO-READ line defining the tag, and one `[FILE]` line quoting an older station
summary. **No escalation is tagged `[STALE]`, so the discharge work my station doc assigns me here
has nothing to clear.** POSITIVE control `[FILE]` → **301**; NEGATIVE control, a freshly minted
needle → **0**. ⚠️ **Coverage stated honestly:** that search covered the **384** lines persisted to
the capture file, not all 427; the remaining 43 were read directly in this run and are sections 6, 7
and the completion line, which carry no escalation rows at all.

**The 12:19Z run's F1 falsifying probe, run as written.** [MEASURED] over the same capture:
`two-orphaned-worktrees-hold-eighteen-unpushed-commits` → **0** hits, and the question it was split
into, `status-sweep-prune-warning-ignores-unpushed-commits` → **4** hits. The discharge took and the
live half survived it.

**Breadcrumb freshness, and the `lastRunAt` cross-check the contract requires.** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit **0**:

```
structure: 1 checked, 0 malformed, 0 skipped as pre-contract
  00  last 2026-09-17T12:19:00Z   0.9h ago  (cadence 2h)   ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-16T23:02:00Z  14.2h ago  (cadence 24h)  ok
  04  last 2026-09-17T10:11:00Z   3.0h ago  (cadence 4h)   ok
  05  last 2026-09-16T14:11:00Z  23.0h ago  (cadence 24h)  ok
```

Crossed against `list_scheduled_tasks` (the breadcrumb is one instrument and cannot name a cause):

| station | `lastRunAt` | newest breadcrumb | cron | `nextRunAt` | reading |
|---|---|---|---|---|---|
| 00 | 2026-09-17T13:07:53Z — **this run** | 12:19Z | `5 * * * *` | 14:07:52Z | aligned |
| 03 | 2026-09-16T23:01:15Z | 2026-09-16T23:02Z | `0 9 * * *` | 2026-09-17T23:00:45Z | aligned |
| 04 | 2026-09-17T10:10:30Z | 10:11Z | `0 */4 * * *` | 14:09:31Z | aligned |
| 05 | 2026-09-16T14:11:02Z | 2026-09-16T14:11Z | `10 0 * * *` | 14:10:37Z | aligned |

**No station is SILENT and none missed an occurrence** — each `lastRunAt` is within one cadence of
its newest breadcrumb and each `nextRunAt` is in the future, so neither the never-fired row nor the
ran-and-did-not-report row of the contract's table is live. `weekly-security-audit` remains
`enabled: false` (last run 2026-09-06T21:32:44Z), so the live enabled count is **FOUR**, as
`STATION-CAPABILITIES.md` §1's 2026-09-15 correction says.

**The board, LIVE, re-derived from its own source rather than from the sweep line.** [MEASURED]
`gh pr view <n> -R GH-Mantova/ProjectOperations --json ...`, `-R` present and `$LASTEXITCODE` tested
on every call (§9.4's CWD bullet), exit **0** both:

| PR | state | mergeStateStatus | labels | head | created |
|---|---|---|---|---|---|
| `#2002` | OPEN | BLOCKED | `[do-not-merge]` | `feat/rates-tc-column-order` | 09:41:45Z |
| `#1998` | OPEN | BLOCKED | `[do-not-merge]` | `feat/crmvis-s5-followups` | 09:05:20Z |

**ZERO are DIRTY**, so no PR on this board has frozen CI. Both show `13 pass / 2 fail`, and the two
failures are the one cause counted twice that §9.4 predicts — `Approval receipt (CP-26)` and
`PR gates — diff checks`, same run, same PR.

**The CP-26 VERDICT TOKEN, read from column 3 of the job log and not from the pass/fail counts.**
[MEASURED] `gh run view <run> -R <repo> --job <job> --log`, each log **223** lines, each split on the
tab with only the last column searched (§9.1):

```
#2002  FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
       (escalates:true). A human must review and REMOVE the label; removing it is what releases the merge.
#1998  FAIL - CP-26 approval-receipt [LABEL_PRESENT]  (identical verdict, 12:31:53Z)
```

**`verdict_rows = 1` out of 223 lines on each** — which is itself the control that the column split
worked, since a whole-line grep for `CP-26` matches all 223 because the job name is column 1.
NEGATIVE control, a freshly minted needle over the same last-column set → **0** on both.

**Watcher liveness, from the sanctioned instrument only.** [MEASURED]
`restart-watcher-if-wedged.ps1` (no `-Fix`), quoted verbatim:

```
armed prompts waiting: 1
watcher process:       ALIVE (pid 30248)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
queue last moved:      212 min ago  (rev-2002-ready.md)
heartbeat last write:  0 min ago

VERDICT: BUSY - queue idle 212 min BUT heartbeat is fresh (0 min). It is mid-run on a long prompt. DO NOT restart.
```

**The in-flight build is NOT looping.** [MEASURED] from the watcher's daily clone log, selected by
**name shape then mtime** and never by a constructed name (§9.5), copied before reading because the
live file is held open: `2026-09-16.log`, mtime **2026-09-17T13:15:26Z**, 1263 lines. ⚠️ **The
"daily" log is named `2026-09-16` while the host-local date is 2026-09-17** — the fixed-at-launch
naming §9.5 records, met and handled rather than tripped over. Rows for the armed prompt:

```
[2026-09-17T12:19:07.224Z] [queue] pr-scopecards-s3-line-markup-all-types-ready.md (depth: 1, source: watch)
[2026-09-17T12:19:08.688Z] [deps] ...: all dependencies met (merged: [], files: 0, on-main: 1)
[2026-09-17T12:19:08.688Z] [start] ...: (max-turns=240)
```

**Exactly ONE `[start]`, no `[NO-PR]`, no `-b-ready.md` restage** — so neither the watchdog kill loop
nor the `PR **#n**` emphasis-defeats-the-regex restage of §10.1 is running. POSITIVE control,
`opened PR #` over the same copy → **5** rows (`#1991 #1995 #1998 #1999 #2002`); NEGATIVE control →
**0**.

**The watcher clone is HEALTHY, and the sweep's `dirty=3` is the documented false warning.**
[MEASURED] both forms against `C:\po-watcher\ProjectOperations` in the same minute:

| form | result |
|---|---|
| `git status --short` — the sweep's form | **3** |
| `git status --porcelain --untracked-files=no` — `start-watcher.ps1`'s own form | **0** |

The three are `?? docs/pr-reviews/pr-1998-review.md`, `?? docs/pr-reviews/pr-2002-review.md` and
`?? scripts/pr-watcher/.conflict-notified-prs.json`. **The corruption test, which is the one that
decides:** `MERGE_HEAD` False · `rebase-merge` False · `rebase-apply` False · `CHERRY_PICK_HEAD`
False · unmerged paths **0**.

**Dev-tree index, before any commit (BOARD DRIVING condition 3).** [MEASURED]
`git diff --cached --name-status` → **EMPTY** and `git diff --numstat` → **EMPTY**, so nothing
another chat staged rode along with this run's commit.

**The breadcrumb I archived is TRACKED, asked of the tracked set and not of the dev tree** (§9.5's
de-duplication rule). [MEASURED] `git ls-files --error-unmatch <breadcrumb>` → exit **0**; NEGATIVE
control, the same query on a path that does not exist → exit **1**.

**Canonical-block boundaries, measured before deciding F3's disposition.** [MEASURED] over
`DOCTRINE.md`: `CANONICAL-BLOCK: instruments v2` opens at line **354** and closes at line **1813**;
the `status-sweep.ps1` clone-dirty bullet sits at line **1696** — **inside** the hash-gated block.

## WHAT CHANGED

One board PR, built in an **isolated worktree off `origin/main`** on the Windows FS
(`C:\po-wt\st00-20260917-1316`, branch `docs/st00-collect-2026-09-17-1316`) — never the dev tree,
never the watcher clone, torn down at the end of the run.

- **Archived the one dispositioned breadcrumb** to `docs/pr-prompts/archive/` by `git mv` — the
  12:19Z supervisor report, all six of whose findings carry a disposition. Confirmed tracked first,
  so it could not be mistaken for unreported.
- **This breadcrumb**, written **inside the PR worktree** — cure 1 of the post-merge fast-forward
  rule, so no untracked copy is left in the dev tree to block the next FF.

**Nothing else, and the omissions are deliberate.** **Nothing was armed** — see WHAT I DID NOT DO.
No PR merged, closed, labelled or rebased. No `do-not-merge` label removed. No watcher restarted. No
branch, remote ref, worktree or stash deleted. Nothing under `sot/`, `apps/`, `scripts/`, `packages/`
or `.github/` touched. No `git` run against the mount, no commit on `main`, no `git checkout .` /
`reset --hard` / `stash pop` / `git clean` anywhere (§9.2). No Azure, Entra or SharePoint. No
production data.

## FINDINGS

### F1 — The whole open board is parked on one human decision, re-measured live rather than inherited, and there is no agent-side work behind either red.

The 12:19Z run reached this conclusion and I did not carry it forward: §7's `[LIVE]` rule says a
verdict expires the moment it prints, and §10.1's non-monotonicity clause says a lane verdict is only
as of the minute it was taken. So both PRs were re-asked individually, and the CP-26 verdict token
was pulled from column 3 of each job log rather than read off the failure counts.

Both carry `do-not-merge`, both read `[LABEL_PRESENT]`, and **only Marco removes that label.** §9.4
is explicit that this state is **PARKED BY DESIGN, not a defect and not work** — and it names the
specific error of listing such PRs "among the reds as though they were something to fix", which three
consecutive collect runs once did.

**DISPOSITION: ACTIONED** — verified and correctly classified. The verdict token is §9.4's own
prescribed falsifying probe and it is what I read; `verdict_rows = 1 of 223` is the evidence the read
was of the verdict and not of the job title.

### F2 — The armed build has been running 57 minutes, which my station doc says I must never be quiet about — but every signal that would make it a hang is healthy, so the correct action is to leave it alone.

`pr-scopecards-s3-line-markup-all-types-ready.md` started at `12:19:08Z` and was still building at
`13:16Z`. My station doc names **>45 min** as a thing to report and `sot/05` names **75 min** as the
point at which a run is a hang rather than slow tests. This sits between the two, so the honest
report is the number plus the signals, not a verdict.

Every cross-check refutes "wedged": the sanctioned instrument returns **BUSY** with a **0-minute**
heartbeat, restart churn is **0 cycles in 20 min**, and the clone log shows exactly one `[start]`
with no restage. §3 is direct about this — *"kill on a missed heartbeat or a timeout, never on
quiet"* — and my own station doc records that two productive runs were killed as "wedged" (LL-25) and
that restarting on BUSY is worse than the stall it was meant to fix. The 212-minute "queue last
moved" is the age of the last queue file event, not evidence about this build.

**DISPOSITION: DEFERRED**, with the trigger stated so the next run does not have to re-derive it.
**Urgent when** either the heartbeat goes stale past 90 minutes while the prompt is still armed — at
which point the instrument itself will return WEDGED and `-Fix` becomes the sanctioned move — or a
second `[start]` or a `[NO-PR]` restage line appears for this prompt, which is the kill-loop
signature and whose sanctioned remedy is the `*-LOOPING.md` rename, not a restart.

### F3 — The clone-dirty false warning reproduced, and it now has a third file class the bullet does not name: a watcher state file, not a review verdict.

§9.5's `status-sweep.ps1` clone-dirty bullet is correct and fired exactly as written — sweep form
**3**, `start-watcher.ps1`'s own form **0**, no corruption of any kind. But the bullet explains the
untracked count as *"review verdicts the `rev-<N>` job writes into the clone by design"*, and here
only **two of the three** are that. The third is
`scripts/pr-watcher/.conflict-notified-prs.json` — the watcher's own conflict-notification state,
written by the watcher into its own clone, also by design, and also permanently untracked.

This matters only in one direction, and it is the direction the bullet exists to guard: a reader who
knows the count should be review verdicts, sees a **non**-review file in it, and may read that as the
clone having genuinely drifted — reopening the mis-routed dispatch to Station 03 that the bullet
records **13 verbatim quotations** of in `archive/`. The cure the bullet already prescribes —
*"read the clone's health from `git status --porcelain --untracked-files=no`"* — is unaffected and
answered **0** here.

**DISPOSITION: DEFERRED**, and the reason is measured rather than assumed. The bullet sits at
`DOCTRINE.md` line **1696**, inside the `instruments v2` canonical block, which spans **354–1813**.
A change there must be re-recorded and shipped across all seven station docs in one PR, which my own
station doc calls *"more than a collect run should carry"* — the same ground on which the 11:25Z run
deferred the §9.3 `node -e` bullet. **Urgent when:** any other §9 change forces a canonical re-record,
at which point this rides along for free; or a run files a clone-hygiene dispatch to 03 off this
count, which is the cost becoming real.

### F4 — COLLECT is closed for this cycle: one breadcrumb, six findings, all already dispositioned, and its own falsifying probe passes.

The only breadcrumb at depth 1 was the 12:19Z supervisor report (`structure: 1 checked`). Every one
of its findings F1–F6 already carried a disposition, so the collect obligation here was to **verify
the dispositions still hold** rather than to assign new ones — and one of them was verifiable by the
probe it wrote down for me: the split escalation is gone from the sweep and its successor is present,
4 hits to 0.

Its F4 — `pr-queue-layout-sot-entry-HOLD.md`, dispatched to **Station 05** because Station 01 has no
`/sot/` access and CP-24 hard-fails any PR mixing `sot/` with code — **remains correctly outstanding
and is not mine to take back.** 05's `nextRunAt` is `2026-09-17T14:10:37Z`, inside the hour, and it
reads this breadcrumb. I left that prompt `-HOLD.md` and untouched.

**DISPOSITION: ACTIONED** — breadcrumb archived to `docs/pr-prompts/archive/` in this run's PR after
confirming it is tracked. Freshness is matched by trailing path segment, so archiving cannot make 00
read SILENT.

### F5 — I armed nothing, and unlike the 11:25Z deferral this is a lane rule rather than a throughput judgement.

The 11:25Z run held a prompt on a throughput argument and the 12:19Z run correctly overrode it,
citing §5b: *"deferring the same prompt every run is a veto by attrition."* That reasoning is sound
and I am not reversing it. It simply does not reach this run, because the binding constraint here is
different and is not a judgement call: **ARM ONE AT A TIME**, and one is in flight. The watcher is
single-lane; arming a second prompt against a mid-build watcher is BOARD DRIVING condition 3 — *"first
confirm nothing else is mid-mutation"* — failing, which is LL-38's collision.

The sweep's own `SAFE TO ACT` verdict is not in tension with this: it reports no *board mutation*
(no index.lock, no git process, no PR touched in two minutes), and it says nothing about whether the
single build lane is occupied. Two different questions; §9.5's `SWEEP_LIVE_LINES_ARE_NOT_EXEMPT_V1`
is the standing warning against reading one as the other.

**DISPOSITION: ACTIONED** — the decision is not to arm, it is recorded with its reason, and the next
run inherits a clean rule rather than a re-derivation. **The moment the in-flight build finishes**,
the gate-satisfied candidates are armable again on the ordinary §5b terms.

### F6 — Carried forward, unchanged, with the trigger that would change each.

- **`'00': 2` in `check-breadcrumb.mjs`'s `CADENCE` map against a live hourly cron.** Confirmed again
  this run (`00 … (cadence 2h) ok`). One-character `scripts/` fix, outside my lane to merge, already
  filed for Marco. Effect today is nil — `lastRunAt` and the breadcrumb agree for all four stations —
  but a green `--freshness` remains a weaker statement about `00` than about any other station.
  **Urgent when:** a 00 occurrence is missed and `--freshness` still reads `ok`, which takes three
  consecutive misses at the current threshold.
- **`binding-read-contract-exceeds-what-a-run-can-carry-2026-09-14.md`.** This run is a **second**
  consecutive counter-example — all three documents read in full — so the escalation's premise is
  "sometimes", not "always", exactly as the 12:19Z run's F5 argued. I did not edit it, for the reason
  that run gave: narrowing someone else's open question on the strength of a counter-example is how a
  live finding gets quietly retired, and the file is gitignored so the edit would reach nobody.
  **Urgent when:** a run declares a partial binding read and then files a finding that one of the
  unread sections already answers.
- **`po-vg`, the one orphaned worktree, still parked and still holding 1 uncommitted file.** Flagged
  again this run on `dirty=1`. Unchanged, and irreversible to resolve, so not a collect run's call.
  **Urgent when:** that one untracked file is removed — which would make the same worktree read
  `dirty=0` and prunable, branch tip and unpushed commit included, turning the live half of the
  split escalation from latent into immediate.

## WHAT I DID NOT DO

- **Did not arm anything.** One prompt is mid-build and the watcher is single-lane (F5).
- **Did not restart, kill or touch the watcher.** The verdict was **BUSY**, and BUSY is the one
  verdict on which restarting is explicitly forbidden.
- **Did not merge, close, label or rebase any PR.** Both open PRs carry `do-not-merge` and read
  `[LABEL_PRESENT]`; only Marco removes that label, and a station that touches it is removing a gate.
- **Did not clear or discharge anything in `needs-marco/`.** Section 5 tagged **zero** rows `[STALE]`
  this run, so there was nothing to clear; I did not go looking for candidates on any weaker signal.
- **Did not edit `DOCTRINE.md`.** F3's correction is real but lands inside a hash-gated canonical
  block (measured: line 1696, block 354–1813).
- **Did not touch `/sot/`, `apps/`, `scripts/`, `packages/` or `.github/`** — none is this station's
  lane, and F4's `/sot/` work is Station 05's by the authority matrix.
- **Did not prune `po-vg`**, its untracked file, or any branch, remote ref or stash. All irreversible.
- **Did not run `git` against the Cowork mount**, and did not diagnose any CI red from the diff or
  the PR page rather than the job log.
- **Did not go near Azure, Entra or SharePoint, and wrote no production data.** Absolute.
