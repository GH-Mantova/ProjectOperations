# Station 00 - Supervisor | 2026-09-07T16:08Z-2026-09-07T16:40Z

## GROUND

```
UTC            2026-09-07T16:09:32Z
origin/main    a025023e            (fetched, then rev-parse)
dev tree       main @ a025023e     C:\ProjectOperations2   (0 0, --numstat EMPTY, --cached EMPTY)
doc version    1
bootstrap      1
```

SIGHTED run. Desktop Commander reached the box on the first call. Read `00-supervisor.md`,
`DOCTRINE.md` and `STATION-CAPABILITIES.md` in full from the DEV TREE, licensed by
`git diff --numstat origin/main -- <each>` returning EMPTY for all three - so the working copy IS
`origin/main`'s content, proved by the sound instrument rather than assumed.

vm-git-guard installer last line, quoted as the contract requires:
`vm-git-guard installed at /sessions/blissful-vibrant-fermat/.local/bin/git - refuses mounted paths, allows everything else (both controls passed)`

Fresh needle minted this run: `zzQq00N20260907T1615` (NEG control 0 everywhere it was used).
It is now spent - it is written down here. Mint another next run.

## WHAT I MEASURED

**Sweep.** `status-sweep.ps1` captured to a FILE (it returns early and hides its own section 7
verdict otherwise). Section 7: `[LIVE] SAFE TO ACT: no board mutation in progress, no recent
remote activity, no live station worktrees.` [MEASURED]

**Board - 4 open, and every one of them is Marco's.** [MEASURED] `gh pr list --json
number,title,mergeStateStatus,labels,files`, assign-then-count:

| PR | state | labels | why it is Marco's |
|---|---|---|---|
| `#1777` | CLEAN, 15 pass / 0 fail | none | `scripts/pipeline/sweep-breadcrumbs.ps1` - outside `tests|docs`, and `scripts/` is NOT a lane in STATION-CAPABILITIES section 5 |
| `#1775` | BLOCKED, 13/2 | `do-not-merge` | label is absolute; also `apps/api` + `scripts/` outside the test-or-docs forms |
| `#1774` | BLOCKED, 13/2 | none | released by a human; `.github/` + `scripts/` outside the test-or-docs forms |
| `#1767` | BLOCKED, 13/2 | `do-not-merge` | label is absolute; AND `apps/api/prisma/migrations/` - `classifyPolicyFiles` refuses migrations outright |

**RULE 2 probe, tree PINNED to the live dev tree.** [MEASURED]
`C:\ProjectOperations2\docs\pr-prompts\processed` = **2057** logs, newest
`rev-1784-ready.md.log` at `2026-09-07T15:35:17Z` - younger than the oldest open PR
(`#1767`, created `06:43:58Z`), which is the control that separates the live directory from the
watcher clone's 17-day-stale decoy. POS `marco.:true` -> **620**; NEG (fresh needle) -> **0**;
NEG `PR #999999` over `pr-*.log` -> **0**.
All four open PRs -> **0** hits ⇒ `[NO LANE VERDICT - hand-classified]`, classified in the table
above by `classifyPolicyFiles` under DOCTRINE section 10.1 step 2. Corroborated by
`.arming-log.txt`: no arm since `2026-09-07T07:20:53Z`, so no watcher build could have opened
`#1774` (08:57Z), `#1775` (08:57Z) or `#1777` (09:33Z).

**The three reds are ONE gate, and I read the job log rather than the PR page.** [MEASURED]
`gh run view <run> --job <job> --log`:

- `#1775` -> `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label`
- `#1767` -> `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label`
- `#1774` -> `FAIL - CP-26 approval-receipt [RELEASED_NO_RECEIPT] PR #1774 was labelled
  do-not-merge and released, but docs/decisions/merge-approvals/1774.md is not in this PR's diff`

And on `#1774` the diff-checks job is red on **CP-26 itself**, with every other gate green:
`PASS CP-11 · CP-12 · CP-13 · CP-17 · CP-23 · CP-24 · CP-25`, `SKIP CP-09/10 · CP-22`,
`FAIL - CP-26 do-not-merge`. So the second red carries **zero independent information**.

**Instrument fault caught in flight, recorded because it nearly became a finding.** My first
pass filtered the job logs with `Select-String -Pattern 'CP-\d\d|FAIL|error'` and got twelve
runner-preamble lines back for every job. Cause: `gh run view --log` emits three tab-separated
columns and **column 1 is the job NAME**, which for this job is literally
`Approval receipt (CP-26)` - so every line of a 220-line log matches `CP-\d\d`, at exit 0, with
nothing empty and nothing warning. Read as-is it says *"the log contains no verdict"*. The cure
is to split on tab and match column 3 only. This is DOCTRINE section 9.6's shape with the polarity
inverted - not an empty result read as an empty world, but a **saturated** one read as noise.

**Stations.** `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0, all five `ok`. Crossed
against `lastRunAt` from the scheduled-tasks MCP, because `ok` is not an all-clear:
00 `16:08:31Z` (this run) · 03 `2026-09-06T23:01:13Z` vs breadcrumb `23:02Z` · 04 `14:10:09Z` vs
`14:10Z` · 05 `14:11:15Z` vs `14:12Z`. All aligned - no station both fired and failed to report.
The known-wrong `CADENCE` map (`'00': 2` against a live cron of `5 * * * *`) is unchanged and
already filed; not re-raised.

**Machines.** watcher node RUNNING pid **31660**, wrapper alive (1), heartbeat 36 min with an
empty queue = idle, not wedged. `index.lock` False/False, git processes 0. armed **0**.
Watcher clone `branch=main dirty=5`. `C:/po-vg` still orphaned at **4817 min** holding 1
uncommitted file - already escalated in `needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.

## WHAT CHANGED

This breadcrumb, and the archiving of the previous cycle's breadcrumb. Nothing else. No merge, no
arm, no label, no rebase, no re-run, no receipt, no restart.

## FINDINGS

### F1. A `do-not-merge` PR can NEVER be green, and three collect runs have carried its redness as if it were work

[MEASURED] above: CP-26 returns `FAIL ... [LABEL_PRESENT]` for as long as the label is on, and
CP-26 also runs as a step **inside** the diff-checks job. So a labelled PR shows exactly two red
required checks, permanently, by design - and `#1775` and `#1767` are not failing PRs at all.
They are correctly parked ones.

This matters because the ACTIVE DRIVE MANDATE says an escalating PR is *"OPENED and driven green
but NOT auto-merged"*. For a labelled PR the first half is **impossible by construction**: no
amount of fixing turns it green, because the gate is reporting the label, not the code. A run that
reads "13 pass / 2 fail" and goes looking for a defect is chasing a gate doing its job. Three
consecutive collects have listed these two among "the reds" without that distinction.

The falsifying probe: read the CP-26 verdict token, never the pass/fail counts. `LABEL_PRESENT`
means parked; `RELEASED_NO_RECEIPT` means a real missing artefact; anything else is a real defect.

DISPOSITION: **ACTIONED** - recorded here as the reading rule for the next collect. Verified by
the three quoted verdict lines, each from `gh run view --job --log`, not from the PR page.

### F2. `#1774` is one file away from fully green, and that file is not mine to write

[MEASURED] every gate on `#1774` passes or skips except CP-26, which wants
`docs/decisions/merge-approvals/1774.md` on the PR branch. The label is already gone, so a human
released it; only Marco removes that label. Writing the receipt would be an agent authoring
Marco's approval, which the standing rule forbids without qualification.

Already escalated: `needs-marco/pr-1774-released-but-cp26-demands-a-receipt-2026-09-07.md`
(written `12:31Z`). **Not re-raised, not duplicated.** What this run adds is the measurement that
nothing ELSE is wrong with `#1774` - it is not a broken PR, it is a complete PR missing one
human artefact.

DISPOSITION: **DEFERRED** - the escalation is already with Marco and a second file would be
noise. It becomes urgent if `#1774` is still unreceipted when the next PR touching
`.github/workflows/ci.yml` needs to land behind it.

### F3. Eighth consecutive run with nothing armed, and the constraint is downstream of arming

The 15:16Z run measured 17 `ADMIT` prompts of which zero has a `scope:` lying entirely inside
`classifyPolicyFiles`' three test-or-docs forms. `origin/main` has not moved since
(`a025023e` then and now) and no prompt file changed, so that measurement still holds and
re-deriving it would buy nothing. [INFERRED from the unchanged SHA, not re-measured.]

The board is **not supply-constrained**. It holds four PRs, three of which wait on a label or a
receipt only Marco can supply, and the watcher has been idle with `armed: 0`. Arming adds a fifth
PR to the same queue behind the same human. That is why this run armed nothing, and the reason is
a judgement about the bottleneck rather than a rule - which is exactly the kind of judgement that
silently becomes permanent if nobody names it.

DISPOSITION: **DEFERRED** - with a named trigger, so it cannot quietly become policy: if a
collect run finds the open-PR count at 2 or below, or finds any `ADMIT` prompt whose `scope:`
entries all match the test-or-docs forms, arm one that run and say so. Otherwise carry this
forward and re-state it, so the streak stays visible as a decision rather than a habit.

### F4. The `gh run view --log` column-1 trap

Written up in full under WHAT I MEASURED. It belongs in DOCTRINE section 9.4 next to the other
`gh` traps, because the job-name column will match any pattern naming a check, and every station
that reads a gate log reaches for exactly such a pattern.

DISPOSITION: **DEFERRED** - a section 9 edit is a canonical-block change costing one document,
and this run's PR is a collect. It is recorded here with its cure and its cause; the next run
that opens a DOCTRINE PR should carry it. Falsifying probe: grep any gate job log for the
check's own name and count the hits against the log's line count.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs hand-classify as Marco's; two carry `do-not-merge`, which
  is absolute. `#1777` is CLEAN and green and I still may not merge it: `scripts/` is not a lane
  in the section 5 matrix, and section 10.1 step 3 is explicit that a lane without a CI gate
  proving its boundary is self-declaration, not classification. The `sot/` precedent set at
  15:19Z does not generalise - it had CP-24 as its proving gate.
- **Armed nothing** (F3).
- **Authored no receipt**, for `#1774` or anything else.
- **Removed no label**, touched no `do-not-merge`.
- **Did not chase the three reds** - F1 measures them as one gate reporting a label, not a defect.
- **Did not rerun CI** on anything; no red here is transient.
- **Did not touch `C:/po-vg`** - it holds 1 uncommitted file, `git worktree remove` would refuse
  and `--force` would discard it, and it is already escalated.
- **Did not touch the watcher, the clone's 5 dirty files, or `/sot/`.** The clone is 03's.
- **Did not run `git` from the VM against the Windows `.git`.** The guard is installed and its
  last line is quoted in GROUND.

