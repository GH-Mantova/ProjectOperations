# Station 00 — Supervisor | 2026-09-25T00:14:14Z–2026-09-25T00:40Z

## GROUND

```
UTC            2026-09-25T00:15:13Z
origin/main    54b7cbbf            (git fetch origin, then git rev-parse --short origin/main)
dev tree       main @ d8eea113     C:\ProjectOperations2   (1 BEHIND origin/main at run start)
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** — no version-mismatch read-only clamp. This run was **SIGHTED**
and read-write.

All three binding documents were read **in full** from the dev tree, after proving the working copy
byte-identical to `origin/main` with the sound form only — `git diff --numstat origin/main -- <path>`
**EMPTY** for all three, no piped `hash-object` anywhere (DOCTRINE §9.1). The previous run at 23:15Z
was blind; this run collects its breadcrumb as well as this hour's.

## WHAT I MEASURED

### Reachability — SIGHTED, and the guard is INERT as expected

[MEASURED] Desktop Commander ids were loaded by **keyword** `ToolSearch` first, never by hard-coded
id; this session offers them prefixed `mcp__plugin_desktop-commander_desktop-commander__`.
`start_process` shell `powershell.exe` returned `NOW=2026-09-25T10:14:41.7149091+10:00` and
`main / d8eea113` on the first call.

[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`, exit read on the
following line with no pipeline appended: **`GUARD_EXIT=2`**, last line verbatim
`vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.` That is the
FINDING-not-STOP row. **No `git` was run against the mount at any point this run** — every git call
went through the Windows host shell.

⚠️ [MEASURED] The `start_process` call carrying `status-sweep.ps1` returned
`timed out after 180s` **at the MCP layer**. Per §9.1 that is a claim to falsify, not a dead shell:
`list_sessions` showed PID 41528 alive at 188 s and `read_process_output` returned the full buffer
including `SWEEP_EXIT=0`. **The shell had not terminated.** Every multi-statement chain this run
carried a literal marker after each statement (`MARKER_A`…`MARKER_AD`) and **every marker printed**,
so no statement was read as having found nothing when it had not run.

### The sweep — SAFE TO ACT

[MEASURED] `status-sweep.ps1` captured to a file and decoded `utf16le` (the `*>` redirection writes
UTF-16LE — §9.3): 145,646 bytes, 425 lines, `SWEEP_EXIT=0`. Section 0 instrument controls both
passed (`gh` reached GitHub, `node` runs); no `[BROKEN]`.

```
7. VERDICT
  [LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.
```

### The board — four PRs, and all four are parked on Marco's label

[MEASURED] `gh pr view <n> -R <owner>/<repo> --json …` per PR (`-R` on every call, `$LASTEXITCODE`
tested, `--json` + `ConvertFrom-Json`, **no `--jq` string literal anywhere** — §9.4):

| PR | state | merge | labels | files | head |
|---|---|---|---|---|---|
| `#2184` | OPEN | BLOCKED | **`do-not-merge`** | 4 | `fix/s8i-travel-index-reset-and-tip-dailykm` |
| `#2183` | OPEN | BLOCKED | **`do-not-merge`** | 14 | `feat/sec-a1-auth-fail-fast` |
| `#2167` | OPEN | BLOCKED | **`do-not-merge`** | 3 | `fix/verdict-guard-spaced-path-candidates` |
| `#2158` | OPEN | BLOCKED | **`do-not-merge`** | 10 | `feat/fv2-formrule-contract-drop` |

[MEASURED] `gh pr checks <n>`: **all four are 15 checks, 13 pass, exactly 2 not-passing, and the two
are the SAME two on all four** — `Approval receipt (CP-26)` and `PR gates — diff checks (CP-09–13,
CP-17, CP-22, CP-23)`.

🔴 **That is §9.4's documented signature, not four coincidences: one cause showing as two reds,
because the CP-26 check runs twice.** Read the **verdict token**, never the pass/fail counts — pulled
from **column 3** of each CP-26 job log (`gh run view <run> --job <job> --log`, split on tab, last
column — §9.1):

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

**All four read `[LABEL_PRESENT]`**, not `[RELEASED_NO_RECEIPT]`. Per §9.4 that is **PARKED BY
DESIGN — there is no agent-side action behind it**, and only Marco removes the label.

[MEASURED] trunk: `main CI on 54b7cbbf: 4 success / 0 failed` — **trunk green**.

### Lane classification, with both controls

[MEASURED] §10.1 step 1 probe, prompt logs only, `rev-*` excluded:
`Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` —
`#2184` → **0** · `#2183` → **2** · `#2167` → **1** · `#2158` → **2**.
POSITIVE control `#2148` → **2**. NEGATIVE control, a freshly minted needle → **0**. Both controls
pass, so the probe discriminates.

`#2184` returns zero hits ⇒ `[NO LANE VERDICT — hand-classified]`, second lane. **It does not matter
to the merge decision this run:** the `do-not-merge` label binds absolutely and independently of
lane, on all four.

### The watcher — OK, and NOT wedged

[MEASURED] the **sanctioned** check, `scripts\restart-watcher-if-wedged.ps1` (report-only, no `-Fix`):

```
armed prompts waiting: 0
watcher process:       ALIVE (pid 42212)
restart churn:         0 cycle(s) in 20 min  (starts=0 exits=0, threshold 4)
VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not wedged.
```

[MEASURED] ENSURE-UP, resolved by **command line** and never by image name: `node=1 wrapper=2`.

```
NODE pid=42212 ppid=44740 start=2026-09-24T07:35:07.2143860Z
WRAP pid=30116 ppid=14324 start=2026-09-20T21:14:02.6820950Z   <- no node of its own since 09-20
WRAP pid=1724  ppid=37808 start=2026-09-24T07:35:03.0901280Z   <- owns node 42212
```

`wrapper=2` is **not** a `wrapper=0` false alarm and no relaunch was warranted — the question the
station doc says to ask is answered the other way: there is one too many, not one too few. This
independently re-confirms Station 03's F1 four days after its first observation and across a watcher
restart. **Nothing was killed and nothing was relaunched.**

### The queue and the freshness table

[MEASURED] armed (`*-ready.md`, top level): **0**. `-HOLD.md`: **14**. `needs-marco/` 48 ·
`no-pr-opened/` 111 · `failed/` 59 · `blocked/` 153.

[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **`CLEAN`, exit 0**:

```
00  last 2026-09-24T23:15:00Z  1.1h ago  (cadence 1h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-24T23:20:00Z  1.0h ago  (cadence 24h)  ok
04  last 2026-09-24T22:11:00Z  2.2h ago  (cadence 4h)   ok
05  last 2026-09-24T14:23:00Z  10.0h ago (cadence 24h)  ok
```

**Crossed against `lastRunAt` from the scheduled-tasks MCP** — the breadcrumb is one instrument and
cannot name the cause, so this is the second: `00` `2026-09-25T00:14:14Z` (this run) · `03`
`2026-09-24T23:03:07Z` · `04` `2026-09-24T22:09:52Z` · `05` `2026-09-24T14:22:54Z`. Every station's
`lastRunAt` sits within minutes of its newest breadcrumb, which is the **"both fresh and aligned —
healthy"** row. No station is SILENT and no occurrence needs chasing. `weekly-security-audit` remains
`enabled: false` (live enabled count is **four**).

### The tracked set was asked of `origin/main`, never of the dev tree

[MEASURED] `git ls-tree -r --name-only origin/main -- docs/pr-prompts/` (trailing slash AND `-r`,
§9.2), matched by basename — the dev tree is 1 behind, which is exactly the condition
`TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1` says makes `git ls-files` answer "unreported" about a
landed breadcrumb:

| breadcrumb | on `origin/main`? |
|---|---|
| `00-00-supervisor-2026-09-24-2226-collect-…` | **1 path** — already landed, depth 1 |
| `00-00-supervisor-2026-09-24-2315-blind-no-windows-shell.md` | **0** — genuinely unreported |
| `00-03-machine-minder-2026-09-24-2320-…` | **0** — genuinely unreported |

### The `packed-refs` trap, re-measured at a new commit

[MEASURED] in the dev tree this run, after `git fetch`:

```
loose       : 54b7cbbf85091cb1347536a6bf206cc61d6cf708
packed      : 66194af6e50fe497ee39e0199797112941755843 refs/remotes/origin/main
git-resolves: 54b7cbbf85091cb1347536a6bf206cc61d6cf708
```

The blind run saw `packed=66194af6` against `loose=d8eea113`. **The packed value has not moved while
the loose ref advanced twice** — it is a frozen snapshot, not a one-commit lag, and `git` agreed with
the loose ref on both readings.

### The dev tree's one dirty file is a line-ending smudge, not work

[MEASURED] `git status --porcelain --untracked-files=no` → ` M docs/data-model/metadata-catalog.json`.
But `git diff --numstat origin/main -- <path>` → **EMPTY** and `git diff --numstat -- <path>` →
**EMPTY**. Per §9.2 the uncommitted-work probe is the `--numstat` form, and EMPTY is the real answer:
**there is no local-only content.** [MEASURED] `git show --stat 54b7cbbf` — the one commit the dev
tree is behind — touches `TipFinderDrawer.tsx`, `ScopeWasteTab.tsx`, two test files and
`docs/decisions/merge-approvals/2164.md`, and **not** `metadata-catalog.json`, so it does not block
this run's fast-forward.

### Controls run this session

POSITIVE: `gh` reached GitHub (sweep §0, and `gh pr view 2164` → exit 0 `MERGED`); lane probe
`PR #2148` → 2; `lint-station.mjs` → ADMIT on all 8 docs.
NEGATIVE: `gh pr view 999997 --json number,state` → **exit 1** GraphQL "could not resolve" (a
server-side field, never `--json number` alone — §9.4); a freshly minted needle over
`processed\pr-*.log` → **0**. That needle is spent the moment this file lands.

## WHAT CHANGED

One board PR, **entirely under `docs/`** — no code, no `sot/`, so CP-24 is not engaged and the diff
sits inside both `^(tests|docs)/` and Station 00's own recorded lane.

1. **Collected two untracked breadcrumbs** into the PR, copied byte-exactly (`byteExact=true`,
   14,023 B and 26,871 B) rather than re-typed.
2. **Archived** `00-00-supervisor-2026-09-24-2226-collect-…` via `git mv` (staged `R100`) — every
   finding in it was dispositioned by its own run and by this one.
3. **Opened a tracked `needs-marco/` file** for Station 03's F1 (`git add -f`, since `needs-marco/`
   is gitignored by rule).
4. **Staged** `pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md` for 03's F2+F3+F4.
5. **Landed the `packed-refs` trap in DOCTRINE §9.2** and re-recorded the canonical hash.
   [MEASURED] the edit was built by **concatenation**, never `String.replace` with a replacement
   string (§9.3): `expected_delta=2988`, `actual_delta=2988`, `BYTE_DELTA_OK=true`,
   `anchor_still_once=true`, and `git diff --numstat` → **`41 0`** — a clean insert, not a rewrite.
   `node scripts/pipeline/lint-station.mjs --write-canonical` → `instruments v2 7f62b4f68347856f`;
   full `lint-station.mjs` → **ADMIT, all 8 docs clean, exit 0**.
6. **Discharged the sweep's one `[STALE]` escalation row** (see F5).

All work was done in an **isolated worktree off `origin/main`** at `C:\po-wt\sup-0025` (`54b7cbbf`,
clean at creation), never in the dev tree and never in the watcher clone. This breadcrumb was written
**inside that worktree** — Cure 1 — so no loose untracked copy is left in the dev tree to block the
next fast-forward.

**Nothing was merged, nothing was armed, no label was touched, no process was killed or restarted,
and no worktree was pruned.**

## FINDINGS

### F1 — The entire open board is parked on `do-not-merge`, and the four reds are one cause, not four defects.

All four open PRs carry the label; all four CP-26 verdicts read `[LABEL_PRESENT]`; all four show the
same two failing checks because that check runs twice. **There is no red on this board that an agent
can fix**, and 13 of 15 checks pass on every one. Arming another prompt adds a fifth parked PR — the
throughput constraint is the label, not the queue.

This is not new and it already has a standing channel:
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md` and
`needs-marco/three-prs-released-and-no-scheduled-run-can-write-their-receipts-2026-09-24.md` (which
cites `#2167` and `#2158` by number). Re-filing it would be noise, and the sweep already tags dead
escalation rows every run.

**What would make it urgent:** a CP-26 verdict reading `[RELEASED_NO_RECEIPT]` instead of
`[LABEL_PRESENT]` — that is a released PR with no receipt and IS a real finding — or the open count
climbing while every PR stays labelled.

**DISPOSITION: DEFERRED**

### F2 — Station 03's F1 had been escalated twice into breadcrumbs and never into a channel; it now has one.

03 escalated the duplicate-wrapper symptom on 2026-09-16, the breadcrumb was archived
`DISPOSITION: ESCALATED`, and nine days later the defect was still live — 03 measured the gap itself
(`watchdog` → 1 unrelated hit in `needs-marco/`). A breadcrumb disposition is not a channel.

I re-measured the defect independently before filing it: `wrapper=2`, pid 30116 with no node of its
own since 2026-09-20, resolved by command line at `54b7cbbf` — a different day and a different commit
from 03's read. Filed as
`needs-marco/ensure-watcher-relaunches-a-second-wrapper-because-it-only-asks-about-the-node-2026-09-25.md`,
**force-added so it is tracked** (the folder is gitignored by rule and only partly tracked in fact,
which is precisely why 03 declined to write it there itself). It carries the measurements, both
stations' readings, RULE 1 options (a)/(b)/(c) with (a) first, and a falsifying probe.

**DISPOSITION: ACTIONED** — verified by `git diff --cached --name-status` showing the file staged as
`A`, and by the file being force-added rather than silently ignored.

### F3 — Station 03's F2, F3 and F4 are one PR in two tracked files, and they are now staged.

The adopt-branch ancestry check (`supervise-watcher.ps1`), the missing PID on every `WATCHDOG` line
(same file), and `status-sweep.ps1` reporting `wrapper: alive (2)` in the health column. Staged as
`pr-watcher-adopt-ancestry-and-watchdog-identity-HOLD.md` with an executable premise
(`! grep -q "ADOPT_REQUIRES_NO_WRAPPER_ANCESTOR_V1" …`), a `scope` that names its own
`superseded/` path so the build retires it, `escalates: true`, and the restart-after-merge note.

**Staged, deliberately not armed** — see F1: an armed prompt becomes a fifth parked PR, and this one
touches `scripts/pr-watcher/**`, which is outside `tests|docs` and therefore Marco's on merge.

**DISPOSITION: ACTIONED**

### F4 — The blind run's `packed-refs` finding is real, reproduces at a different commit, and is now in DOCTRINE.

Re-measured this run: the packed value `66194af6` did not move while the loose ref advanced
`d8eea113` → `54b7cbbf`, and `git rev-parse` agreed with the loose ref. So it is a frozen snapshot,
not a lag — which is a stronger claim than the blind run could make, because it had no `git`.

Landed in **§9.2** as `PACKED_REFS_SERVES_A_STALE_ORIGIN_MAIN_V1` with the two-reading table, the
mechanism, the cure (read the loose ref first; with a shell, `git rev-parse origin/main` is the
answer), and a falsifying probe written so that it can actually fail.

⚠️ The blind run also dispatched the `sot/05-decisions-and-lessons.md` half to **Station 05**. That
half is untouched here and remains 05's: CP-24 hard-fails any PR mixing `sot/` with anything else, so
it must be a separate doc-reconcile PR.

**DISPOSITION: ACTIONED**

### F5 — The sweep's one `[STALE]` escalation row was dead and is discharged.

Exactly one row, not the eleven this section has carried before:
`pr-2164-review-block.md references #2164 which is MERGED -- escalation is DEAD, clear it.`

Cleared on the **individual** re-ask, never on the tag alone:
`gh pr view 2164 --json number,state,mergedAt` → exit 0,
`{"mergedAt":"2026-09-24T23:33:42Z","state":"MERGED"}`; NEGATIVE control `gh pr view 999997
--json number,state` → **exit 1**. The file's content is **entirely PR-scoped** — one hex-ratchet
violation on one line of `#2164`'s `ScopeWasteTab.tsx` — so nothing general survives the merged PR.
It was **not** in `needs-marco/`'s tracked set (9 tracked files, none matching `2164`), so moving it
cannot ride into another actor's commit.

Moved to `needs-marco/discharged/` with a `_DISCHARGE-NOTE-2026-09-25-0025.md` beside it. **Never
deleted.** ⚠️ That folder is gitignored, so the note reaches nobody on its own — which is why the
discharge is recorded here.

**DISPOSITION: ACTIONED**

### F6 — Six orphaned worktrees, one holding uncommitted work. Not pruned.

`C:/po-worktrees/sup-cwd-paths` (age 1001 min) holds ` M docs/data-model/metadata-catalog.json` and
`?? pr-body.md`; `git worktree remove` will refuse it and `--force` would discard the work. The other
five (`fv2drop`, `s8h`, `s8i-fixforward`, `sec-a1`, `stage-formrule-web`) are `dirty=0`, but four of
them name branches belonging to PRs that are **open right now** (`#2158`, `#2184`, `#2183`) or merged
within the hour. `worktree-registry-escapees: none found under known roots`.

Pruning is not this run's highest-leverage move and the risk is asymmetric — a wrong `--force`
discards work that exists nowhere else. **What would make it urgent:** the dirty one aging past a
week with its branch closed unmerged, or the count climbing past the open-PR count, which would mean
teardown has stopped happening at all.

**DISPOSITION: DEFERRED**

### F7 — The blind run's own F4 is discharged: this hour's COLLECT happened.

The 23:15Z run recorded that its COLLECT did not run and that *"the next 00 run with a shell must
collect this breadcrumb plus everything since the last healthy run, not just the current hour's."*
Done: both untracked breadcrumbs are in this PR, all of 03's seven findings carry a disposition
here, the `[STALE]` row is cleared, and the dispositioned predecessor is archived.

Its F1 (blindness at roughly 40% of 00 runs, cause unknown) and F2 (`vm-git-guard` inert) both stand
and both already have standing channels
(`needs-marco/station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`); my own guard
read exit 2 this run, matching. 03's F7 (clone stash closed loop at 77, no growth in 24 h) likewise
stands unchanged and was re-confirmed by the sweep reading the clone `dirty=0`.

**DISPOSITION: ACTIONED**

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs carry `do-not-merge` and all four CP-26 verdicts read
  `[LABEL_PRESENT]`. Only Marco removes that label. I did not reach for `Assert-SmokedOrEscalate`,
  because there is nothing on this board it could pass.
- **Did not remove, add or alter a label on any PR**, and did not comment on one.
- **Did not arm any prompt.** Armed count is 0 and stays 0 — F1's reasoning. `arm-prompt.ps1` was not
  called and no `-HOLD.md` was renamed.
- **Did not kill wrapper pid 30116 or watchdog pid 12044**, and did not restart or relaunch the
  watcher. The sanctioned check returned `OK`; `wrapper=2` is a defect to escalate, not a licence to
  start a third supervisor family against a healthy machine.
- **Did not prune a worktree or drop a stash** (F6, and 03's F7).
- **Did not edit `C:\po-watcher\ensure-watcher.ps1` or any launcher** — outside every repo, and
  Marco's.
- **Did not touch `/sot/`** — Station 05's, CP-24 — including the `sot/05` half of the `packed-refs`
  lesson, which stays dispatched to 05 as a separate doc-reconcile PR.
- **Did not run `git` through the device bridge against either Windows `.git`.** The guard reported
  INERT, so the ban was kept by hand.
- **Did not commit in the dev tree or the watcher clone.** All work happened in a disposable worktree
  off `origin/main`, and this breadcrumb was written inside it.
- **Did not use `--jq` with a string literal, `git show | git hash-object --stdin`, a bare
  `gh pr view --json number` existence probe, or `Measure-Object -Line`** — every one of these is a
  recorded §9 trap and each has a sound form that was used instead.
- **Left Azure, Entra and SharePoint entirely alone.** Absolute.
