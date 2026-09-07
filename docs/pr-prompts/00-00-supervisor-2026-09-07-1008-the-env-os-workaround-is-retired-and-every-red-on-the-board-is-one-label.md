# Station 00 — Supervisor | 2026-09-07T10:08Z–10:35Z

## GROUND

```
UTC            2026-09-07T10:08:50Z
origin/main    bc41cd78              (fetched, then rev-parse)
dev tree       main @ bc41cd78       C:\ProjectOperations2   (was 9ecd2da9, 1 behind; fast-forwarded this run)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version in the scheduled-task file)
```

Doc version and bootstrap AGREE — this run is READ-WRITE.

## WHAT I MEASURED

**Preflight.** [MEASURED] `start_process` shell `powershell.exe` → PID 34220, prompt returned.
**This run was SIGHTED.** Device-bridge git guard installed first, last line quoted verbatim:
`vm-git-guard installed at /sessions/kind-zealous-dirac/.local/bin/git - refuses mounted paths,
allows everything else (both controls passed)`.

**The three binding documents were read from the dev tree, and the dev tree was proved equal to
`origin/main` for all three** — [MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
→ **EMPTY** (the sound form; no piped hash — PREFLIGHT step 2). Read in full: 00-supervisor.md
1299 lines, DOCTRINE.md 1638, STATION-CAPABILITIES.md 437.

**Fast-forward.** [MEASURED] `git merge --ff-only origin/main` → `Fast-forward`, 2 files
(`docs/decisions/merge-approvals/1769.md`, `scripts/pipeline/triage-holds.ps1`). Read-backs, all
three as the station doc requires: `git rev-list --left-right --count HEAD...origin/main` → `0 0`;
`git diff --numstat` → EMPTY; `git diff --cached --name-status` → EMPTY.

**Sweep.** [MEASURED] `status-sweep.ps1` captured to a FILE (it returns early and hides its own §7
verdict otherwise), generated 10:10:30Z. Section 0 controls both `[LIVE]`. Section 7 verdict:
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`
Watcher node RUNNING pid 31660, wrapper alive (1), heartbeat 23 min, `index.lock` False/False,
0 git processes, no PR touched in 2 min. Armed prompts: **0**.

**COLLECT.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**,
`CLEAN`, `structure: 3 checked, 0 malformed`. All five stations `ok`:
00 09:08Z (1.1h) · 03 2026-09-06T23:02Z (11.2h) · 04 06:10Z (4.1h) · 05 2026-09-06T14:11Z (20.0h).
[MEASURED] `git ls-files --others --exclude-standard docs/pr-prompts` matching `00-NN-` → **none**:
there is no untracked breadcrumb in the dev tree. The only breadcrumbs at depth 1 are my own 0708,
0808 and 0908, all three already tracked on `origin/main`.
**So there is nothing new to collect this run** — the 0908 run was 62 minutes ago and no other
station has reported since. That is an honest quiet, not a blind one.

**Freshness crossed against `lastRunAt`** (scheduled-tasks MCP), as the station doc requires:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-07T10:08:28Z` (this run) | 09:08Z | aligned |
| 03 | `2026-09-06T23:01:13Z` | 2026-09-06T23:02Z | aligned, next 23:00Z |
| 04 | **`2026-09-07T10:10:07Z`** | 06:10Z | **04 started 99 s after me and is running now** |
| 05 | `2026-09-06T14:11:01Z` | 2026-09-06T14:11Z | aligned, next 14:10Z |
| `weekly-security-audit` | `2026-09-06T21:32:44Z` | n/a (not a station) | aligned |

04's fresh `lastRunAt` with no matching breadcrumb is **not** the "started and died" row of the
station doc's table — it is a run that began two minutes ago and has not finished. Its breadcrumb
will land after this one; the 11:08Z run collects it.

**RULE 2 probe, pinned to the live tree** `C:\ProjectOperations2\docs\pr-prompts\processed`:
[MEASURED] 2053 logs, newest `2026-09-07T09:48:27Z` — younger than every open PR's `createdAt`,
which is the control that separates the live directory from the dead decoy in the watcher clone.
POSITIVE `marco.:true` → **620**. NEGATIVE, a needle minted this run → **0**.
Per-PR over `processed\pr-*.log` (excluding `rev-*`, §9.5): `PR #1775` **0** · `#1774` **0** ·
`#1767` **0** · `#1777` **0** · `#1760` **0**. All five read `NO LOG`
⇒ **`[CANNOT MEASURE]` the lane from this probe, never "second lane"** (§9.5, 2026-09-06T19:2xZ
correction). All five are hand-classified below.

**Every red on this board is ONE label, and I read the job log rather than the PR page.**
[MEASURED] `gh run view 34109755617 --job 101702996764 --log` (#1775, `PR gates — diff checks`):
CP-12 PASS · CP-13 PASS · CP-17 PASS · CP-09/10 SKIP · CP-23 PASS · CP-24 PASS · CP-22 SKIP ·
CP-25 PASS · **`FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label]`** → exit 1. And
`gh run view 34109755617 --job 101702996387 --log` (`Approval receipt (CP-26)`):
`FAIL - CP-26 approval-receipt [LABEL_PRESENT]`, same cause.
**So the two reds on #1775, #1774 and #1767 are one cause, not four defects, and the cause is the
gate working.** Only Marco removes that label (STATION-CAPABILITIES §5, gate 1). There is no red on
this board that is mine to fix.

**HOLD triage.** [MEASURED] `triage-holds.ps1` at `bc41cd78`, exit 0:
`SPENT control: PASS -- lint-prompt.mjs emitted exit 3 on the fixture` ·
`TOTALS spent=1 of 47 evaluated  gates-satisfied=18  still-gated=28  unreadable=0`.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `9ecd2da9` → `bc41cd78`, all three read-backs clean (above).
2. **One SPENT hold retired** to `docs/pr-prompts/superseded/` —
   `pr-triageholds-s2-env-os-is-empty-in-a-station-shell-HOLD.md`. Its work shipped as **#1769**,
   merged `2026-09-07T10:04Z`, which is the commit this run fast-forwarded onto. `lint-prompt.mjs`
   returns exit **3** (SPENT) on it, and the fixture control above proves that bucket is measurable.
3. **Two dispositioned breadcrumbs archived** — the 0708 and 0808 runs, both already tracked on
   `origin/main` and both fully dispositioned. The 0908 cycle stays at the root as the station doc
   requires. Safe for `--freshness`, which matches by trailing path segment (§9.5).
4. **Nothing armed. Nothing merged. No label touched.**

## FINDINGS

### F1 — the `$env:OS` workaround is RETIRED, and I proved it both ways

Every run since 2026-09-07T09:4xZ has been told to `SET $env:OS='Windows_NT'` before
`triage-holds.ps1`, or 30 of 53 holds read `PREMISE UNMEASURABLE`. **#1769 fixed that inside the
script and the workaround is now dead.** I ran it twice at the same commit, on the same 47-HOLD
board, changing only the environment:

| | `$env:OS='Windows_NT'` | `$env:OS` removed (`OS-now=[]`) |
|---|---|---|
| SPENT control | PASS (lint exit 3 on the fixture) | **PASS** |
| totals | `spent=1  gates-satisfied=18  still-gated=28  unreadable=0` | **identical** |

[MEASURED] both runs this hour, exit 0 both times. The second run is the one that matters: with the
variable genuinely empty the probe still runs.

**Why this needed saying rather than just being true.** I set the variable out of habit on the first
run, which would have confounded the test — a run that only ever applies the cure can never observe
that the cure is no longer needed, which is §9.1's *"the cure hides the trap from its own control"*
in a new costume. The falsifying probe is the two-row table above: re-run both forms at any later
commit, and if the empty-`$env:OS` form ever reports `unreadable > 0` again, this finding is wrong.

**DISPOSITION: ACTIONED** — recorded here, and the standing note is superseded by this measurement.
Nothing else changes: setting the variable remains harmless.

### F2 — 0 of 18 gate-cleared prompts is tests/docs-only, for the fourth consecutive run

I stopped eyeballing this and parsed each prompt's own `scope:` block against
`classifyPolicyFiles`'s `NESTED_TEST_PATHS` (all three forms). [MEASURED], positive control
**63 scope entries parsed across the 18** (a uniform zero would have meant a broken parser — see F5):

`TESTS_DOCS_ONLY = false` on **18 of 18**. Four carry `apps/api/prisma/migrations/**`
(`pr-company-manage-s1`, `pr-fv2-maintenance-usage-intervals`, `pr-sor-s9a-register-api`,
`pr-tr-s1-reminder-policy`) and so fail `classifyPolicyFiles` on its own clause. Two are Station
05's lane (`pr-sot-01-nav5-reconcile-2026-08-20`, `pr-sot-05-d24-theme-sequencing-reconcile`) and
are not mine to arm at all.

**So arming any of them opens a SIXTH PR onto a board where five already wait on Marco.** That is
the standing throughput constraint stated exactly, and this is the first run to measure it per-prompt
rather than assert it. **DISPOSITION: DEFERRED** — the decision is unchanged (arm nothing), and what
would make it urgent is a single `TESTS_DOCS_ONLY = true` row, which the table above is the probe for.
The constraint itself is already open with Marco as
`needs-marco/arming-throughput-rule-b-is-ungated-2026-09-06.md`.

### F3 — four §10.6 duplicates, and the corrected rule caught a fifth that is NOT one

Crossing each `ADMIT` prompt's `scope:` against the five open PRs' file lists, with directory-form
entries matched as PREFIXES (the 2026-09-07T03:4xZ correction to §10.6):

| prompt | open PR | verdict |
|---|---|---|
| `pr-brandtheme-s2-hex-ratchet` | **#1774** | TRUE duplicate (4/4) |
| `pr-tipid-s2-write-the-ids-backfill-and-admin` | **#1775** | TRUE duplicate |
| `pr-watcher-gate-path-space` | **#1760** | TRUE duplicate (2/2) |
| `pr-tr-s1-reminder-policy` | **#1767** | TRUE duplicate — matched only because `apps/api/prisma/migrations/**` was read as a PREFIX |
| `pr-fixlane-s1-a-fix-lane-prompt-can-never-escalate` | #1760 | **FALSE positive** — 1 shared file (`scripts/pr-watcher/index.mjs`), different marker, different work |

**Both halves of the 09-07 correction earned their keep in one board.** The `pr-tr-s1` row is
exactly the under-report case: an exact-path set test can never match `migrations/**`, so a
full-match rule would have cleared a `gate_allow: migrations` prompt for arming. The `pr-fixlane-s1`
row is exactly the over-report case: a single shared file, precision zero, resolved by the marker
string and not by the file overlap. **DISPOSITION: ACTIONED** — all five classified; none armed.

### F4 — the 00/04 collision reproduced on schedule, four hours after it was written up

[MEASURED] `lastRunAt`: 00 `10:08:28Z`, 04 `10:10:07Z` — **99 seconds apart**, at 20:08 Brisbane
local, nowhere near midnight. The open escalation
`needs-marco/station-schedule-collision-04-and-05-2026-09-03.md` already records the identical
99-second pair at `06:10:04Z` (its line 135) and already names the cause as the fixed per-task
`jitterSeconds` (00: 172 s off `5 * * * *`; 04: 571 s off `0 */4 * * *`) rather than the crons alone,
with options (a) and (b) written out. **This run is a confirmation, not a new finding** — the
escalation predicted a four-hourly recurrence and it recurred, on the hour it said it would.
**DISPOSITION: DEFERRED to the existing escalation. Do not re-raise it as new.** The cron and jitter
values live in the scheduled-tasks layer and are Marco's to change.

### F5 — my own scope parser returned a uniform zero, and only the shape of the zero caught it

First attempt at F2's measurement printed `entries=0` for all 18 prompts, with no `[NO FILE]` — a
clean, coherent, wrong answer that would have read as *"these prompts declare no scope"*. The cause
was a front-matter split that did not survive CRLF; the files were fine. I had written it **without
a positive control**, which is the one thing §9.6 asks for, and the only reason it was caught is that
a uniform zero across eighteen unrelated files is not a shape the world produces. The rewrite prints
`POSCTRL total scope entries across 18 = 63` on every run, so the next reader cannot repeat it.
**DISPOSITION: ACTIONED** — recorded because the near-miss is the finding; a control I skipped is
worth more written down than a probe I got right.

## WHAT I DID NOT DO

- **Merged nothing.** All five open PRs are Marco's and I say why for each, hand-classified because
  the RULE 2 probe returns `NO LOG` for all five (§9.5 — absent is `[CANNOT MEASURE]`, not "second
  lane"): **#1775 · #1774 · #1767** carry `do-not-merge`, which only Marco removes, and #1767 also
  carries a migration; **#1777** (`scripts/pipeline/sweep-breadcrumbs.ps1`) and **#1760**
  (`scripts/pr-watcher/index.mjs`) are outside `NESTED_TEST_PATHS` and outside 00's own `docs/` lane,
  so §10.1 step 3's station-lane exception does not reach them and they fall to step 2 as Marco's.
  #1777 is my own PR from the 09:08Z run; being mine does not make it mine to merge.
- **Armed nothing** — F2.
- **Removed no label, and authored no approval receipt.** #1760 already carries
  `docs/decisions/merge-approvals/1760.md`; I did not write it and did not touch it.
- **Did not chase #1774's BEHIND state.** Its two reds are the label (F3's #1774 row, and the CP-26
  log above), so rebasing it would buy a fresh CI run that fails for the same reason. The
  `pollForBehindPrs` rebase-storm this would feed is already escalated.
- **Did not clear the `C:\po-vg` orphaned worktree** (`23c91ba9`, `fix/no-rebase-while-checks-run`,
  dirty=1, age 4457 min). It holds uncommitted work; `git worktree remove` refuses and `--force`
  would discard it. Station 03's, and already dispatched.
- **Did not act on the watcher clone's `dirty=6`.** 03's lane.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**

---

*Breadcrumb written inside this run's own PR worktree (`C:\po-worktrees\board-1008`), which is the
REPORT CONTRACT's cure 1 — no loose untracked copy exists in the dev tree, so the next
fast-forward has nothing to trip over.*
