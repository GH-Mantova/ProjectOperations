# Station 00 — Supervisor | 2026-09-04T01:09Z–2026-09-04T01:20Z

## GROUND

```
UTC            2026-09-04T01:09:09Z
origin/main    16955727 (at entry, before fetch) -> 10fcce53 (after fetch) -> 5b1aff93 (at exit; #1543 merged mid-run)
dev tree       main @ 16955727 -> ff'd to 10fcce53   C:\ProjectOperations2   (read HERE, not the watcher clone)
doc version    1
bootstrap      1
```

Version match — full authority, not read-only. **SIGHTED, not blind:** `start_process`
(powershell.exe) returned a live shell (PID 22264); every claim below is from that shell.

## WHAT I MEASURED

- **[MEASURED] Blindness check.** `start_process` shell `powershell.exe` → live shell, PID 22264.
  Not blind.
- **[MEASURED] Preflight freshness cure, run in the DEV TREE per the contract.** `git fetch origin
  --prune` then `git merge --ff-only origin/main`: `Updating 16955727..10fcce53`, 8 files. Dev tree
  and `origin/main` identical at `10fcce53` before any read of the binding docs. The three documents
  were read from that tree after the ff.
- **[MEASURED] Sweep.** `scripts/pipeline/status-sweep.ps1`, `SWEEP COMPLETE 2026-09-04 01:09:53Z` —
  §7 `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
  worktrees`. ⚠️ That verdict was **false 16 seconds later** (see FINDING 3); `[LIVE]` means "true
  when measured".
- **[MEASURED] Breadcrumb shape + freshness.** `node scripts/pipeline/check-breadcrumb.mjs
  --freshness` → `structure: 9 checked, 0 malformed`, exit 2. It also printed
  `NOTE … 00-00-supervisor-2026-09-04-0009-… is UNTRACKED — it reaches nobody until a board PR
  commits it`. That is the 00:09Z run's own breadcrumb, and committing it was the obligation it left
  this run. Done — see WHAT CHANGED.
- **[MEASURED] Freshness crossed against `lastRunAt` (scheduled-tasks MCP), per the contract table.**

  | station | newest breadcrumb | `lastRunAt` | cron | reading |
  |---|---|---|---|---|
  | 00 | 2026-09-04T00:09Z, 1.0h | `2026-09-04T01:08:47Z` | `5 * * * *` | healthy — this run |
  | 03 | 2026-09-03T23:02Z, 2.1h | `2026-09-03T23:01:39Z` | `0 9 * * *` | aligned |
  | 04 | 2026-09-03T22:10Z, 3.0h | `2026-09-03T22:10:24Z` | `0 */4 * * *` | aligned; next 02:09Z |
  | 05 | **2026-09-01T14:11Z, 59.0h SILENT** | **`2026-09-03T14:11:26Z`** | `10 0 * * *` | **row 2 — ran and did not report** |

  05 is the contract table's row 2 (`lastRunAt` fresh, no breadcrumb), i.e. the known
  529-on-turn-one. **It is not a stopped station.** Next fire `2026-09-04T14:10:37Z`. Unchanged from
  the 00:09Z reading; see FINDING 4.
- **[MEASURED] Machinery.** `scripts/restart-watcher-if-wedged.ps1` (report-only) at 01:11:03Z:
  `armed prompts waiting: 0`, `watcher process: ALIVE (pid 24744)`, `restart churn: 0 cycle(s) in
  20 min`, `VERDICT: OK`. No `.lock` in `C:\ProjectOperations2\.git`, zero `git.exe` processes.
- **[MEASURED] Queue.** `*-ready.md` = **0** armed. `*-HOLD.md` = **80**.
- **[MEASURED] RULE 2 probe, pinned to the LIVE tree** — `C:\ProjectOperations2\docs\pr-prompts\processed`,
  **1869 logs, newest `2026-09-04T00:40:03Z`**, positive control `marco.:true` = **606**, negative
  control `zzzNoSuchTokenZzz` = 0. The newest log is younger than the oldest open PR (#1544,
  `2026-09-03T11:18:52Z`), which is the control that separates this directory from the 2026-08-17
  decoy in the watcher clone.
- **[MEASURED] Per-PR lane verdicts, with the mandated NO-LOG control passing in the same query.**

  | PR | lane probe | classification | state at exit |
  |---|---|---|---|
  | #1559 | only `rev-1559-ready.md.log` (a REVIEW JOB, no merge verdict) | `[NO LANE VERDICT — hand-classified]` `docs/**` only ⇒ **not Marco's** | CLEAN |
  | #1558 | only `rev-1558-ready.md.log` | `[NO LANE VERDICT — hand-classified]` `docs/**` only ⇒ **not Marco's** | CLEAN |
  | #1554 | only `rev-1554-ready.md.log` | `[NO LANE VERDICT — hand-classified]` `sot/**` outside `^(tests\|docs)/` ⇒ **MARCO'S** | CLEAN |
  | #1544 | **NO LOG** | `[NO LANE VERDICT — hand-classified]` `.claude/agents/**` + `scripts/pipeline/**` ⇒ **MARCO'S** | DIRTY → **BLOCKED, mergeable** |
  | #1543 (merged) | `pr-visualreview-s3-…-ready.md.log` → `marco:true` | positive control | merged 01:10:09Z |
  | #1536 (merged) | `pr-wbsshift-s2-…-ready.md.log` → `marco:true` | positive control | merged 00:05:59Z |

  #1544 read **NO LOG** in the same query in which #1543/#1536 returned verdicts, so NO LOG means
  *second lane*, not *broken probe* (the control FINDING 3 of the 00:09Z run established).
- **[MEASURED] `main` CI, the 00:09Z run's other obligation.** That run merged #1557 to `dd51a2f8`
  and left post-merge CI in flight. Re-read with the FULL 40-char sha (§9.4): `dd51a2f8` → 4 runs,
  `CI` / `Deploy` / `Tendering Browser Smoke` / `Push on main` **all `completed success`**. Current
  head `10fcce53` likewise 4/4 success. **No regression from #1557.** Obligation discharged.
- **[MEASURED] `PR_WATCHER_AUTO_UPDATE` still churning.** #1558 and #1559 each received a
  `Merge branch 'main' into …` commit at `01:11:18Z` / `01:11:15Z`, ~65 s after #1543 merged. Live
  re-confirmation of the already-dispatched finding.

## WHAT CHANGED

- **RESOLVED #1544's conflict and unfroze its head.** Work done in a disposable worktree
  (`C:\po-worktrees\wt-1544`, off the PR ref, torn down at exit — `Test-Path` → `False`), never in a
  shared tree. One file conflicted: `docs/pipeline/STATION-CAPABILITIES.md`, one region.
  Resolution keeps **both** sides' corrections — #1544's "Station 01 was missing from this matrix"
  and "the 00 Create-a-PR cell was wrong" paragraphs, and `origin/main`'s measured
  "**Station 03 IS self-scheduled**" refutation — and drops only #1544's
  `Stations 01, 02 and 03 have NO schedule` sentence, which `origin/main` refutes by measurement.
  The 01 half of it is preserved as its own sentence so nothing is lost.
  **Verified before pushing:** 0 conflict markers, 0 `U+FFFD`, 0 `â€` mojibake sequences, all five
  content assertions true, and the PR's own `scripts/pipeline/lint-station.mjs` →
  `ADMIT: all 8 docs clean`, exit 0.
  **Read back, not assumed:** `git ls-remote` → `refs/heads/fix/agent-defs-double-encoded` =
  `2dfe056f` **and** `refs/pull/1544/head` = `2dfe056f`; `gh api …/pulls/1544` → `head.sha
  2dfe056f`, `mergeable true`, `mergeable_state blocked` (was `dirty`). CI created 14 jobs and is
  running for the first time since the PR opened; all required pipeline gates already `SUCCESS`.
- **COMMITTED two orphaned breadcrumbs** — the 00:09Z run's and this one's — in this PR.
- **Nothing armed. Nothing disarmed. No label touched. No `/sot/` edit. No PR merged.** No
  breadcrumb archived (the current cycle is still live).

## FINDINGS

### FINDING 1 — a PR's head ref froze 14 hours behind its own branch, and every PR-level instrument reported the stale commit

`#1544` read `DIRTY` / `CONFLICTING` all run. Resolving it produced a push rejection —
`! [rejected] … (non-fast-forward)` — which is not what a DIRTY PR should do, and that rejection is
the only reason this was found.

Asking the remote (§9.2: ask the remote, never the local cache), with two independent instruments:

| probe | answer |
|---|---|
| `git ls-remote origin refs/heads/fix/agent-defs-double-encoded` | **`0d7e1638`** |
| `gh api …/branches/fix/agent-defs-double-encoded --jq .commit.sha` | **`0d7e1638`** |
| `git ls-remote origin refs/pull/1544/head` | `d19162ef` |
| `gh api …/pulls/1544 --jq .head.sha` | `d19162ef` |
| `gh api …/pulls/1544 --jq .head.label` | `GH-Mantova:fix/agent-defs-double-encoded` — **same repo, same branch** |

`0d7e1638` is `Merge branch 'main' into fix/agent-defs-double-encoded`, committed
**2026-09-03T11:27:12Z** — ten minutes after the PR opened, and **fourteen hours** before this run.
So somebody had already merged main into that branch, and GitHub never re-pointed the PR at it: the
`synchronize` webhook was dropped. Every PR-level read — `gh pr view --json headRefOid`,
`mergeStateStatus`, the checks rollup, `refs/pull/1544/head` — went on evaluating the pre-merge
commit, so the PR reported `dirty` against a conflict that had already been resolved on the branch,
and its CI stayed frozen for fourteen hours.

**This is a §7 instrument lie with a new shape:** not a broken script, but *four* instruments
agreeing with each other and all reading the same stale source. There is no cross-check inside the
PR API that can catch it — only `git ls-remote` / the branches endpoint can, and no station
currently consults them when triaging a DIRTY PR.

**The cure is a fresh push.** Pushing `2dfe056f` re-fired the event and both refs advanced together
(read back above). Note the asymmetry that makes this dangerous: the 11:27Z push did **not** unstick
it, so "a push always resynchronises" is not safe to assume, and a PR can sit frozen indefinitely
while looking exactly like an ordinary unresolved conflict.

RULE 1 — the complete-and-additive fix: **when a PR reads DIRTY, cross `gh pr view --json
headRefOid` against `git ls-remote origin refs/heads/<headRefName>` before diagnosing the conflict,
and say which you used.** Additive (one extra read-only probe), and it fixes the future case as well
as this one, because it names the discriminator rather than the symptom. The alternative — "always
push an empty commit to a DIRTY PR first" — fails the *no-damage* half: it moves a head under
whoever owns the branch, and on a healthy DIRTY PR it accomplishes nothing.

**DISPOSITION: ACTIONED** — conflict resolved and head unfrozen this run, read back on four probes.
The *doctrine* half (adding the `ls-remote` cross-check to §9.2/§9.4) is **DISPATCHED → Station 06
(PR Master)**: it is an `instruments v2` canonical-block edit, so it must go through
`lint-station.mjs --write-canonical` and ship all seven station docs plus DOCTRINE in one PR. I did
not do it in this PR because mixing a canonical-block rewrite into a breadcrumb PR is exactly the
kind of PR the block's hash gate exists to make reviewable on its own.

### FINDING 2 — #1544 is unblocked but is NOT mine to merge, and that is unchanged by its going green

`.claude/agents/**` and `scripts/pipeline/**` are outside `^(tests|docs)/`, so `classifyPolicyFiles`
puts #1544 with Marco. It carries no watcher verdict (**NO LOG**), which §10.1 says proves nothing
about its risk — the hand-classification is what governs. Its single authored commit `d19162ef` is
`marco@initialservices.net` with **no `claude` co-author**, i.e. Marco's own hand, matching the
signature the 00:09Z run established for `merge-approvals/1536.md`.

Getting it green and mergeable is the whole of my lane here, and it is now done.

**DISPOSITION: ACTIONED** — driven from DIRTY to BLOCKED-and-mergeable, and deliberately left for
Marco.

### FINDING 3 — the sweep's SAFE-TO-ACT verdict expired 16 seconds after it printed

`status-sweep.ps1` printed `SAFE TO ACT: no board mutation in progress, no recent remote activity`
at `01:09:53Z`. At `01:10:09Z` #1543 merged, and at `01:11:15Z`/`01:11:18Z` two open PRs received
auto-update commits. Three board mutations inside 85 seconds of a verdict that said there were none.

The verdict was **correct when printed**. This is the cleanest instance this run of the station
doc's own rule — *"`[LIVE]` means true when measured, not true now"* — and it is why BOARD DRIVING
condition 3 was re-checked against the specific object before acting rather than trusted from the
sweep: `#1544` had `updatedAt 2026-09-04T00:35:15Z` and `headRefOid` unmoved for 14 h, no git locks,
no `git.exe` processes. The object I touched was quiet even while the board around it was not.

Recorded because a later run reading only the sweep line would conclude the board was idle at 01:09Z
and that three merges in the following two minutes therefore came from nowhere.

**DISPOSITION: ACTIONED** — no change needed; the rule already exists and worked. Written down so
the 01:09Z sweep line is not later quoted as evidence the board was quiet.

### FINDING 4 — 05 is still SILENT at 59 h and `/sot/` is unkept; unchanged, still not a new escalation

`--freshness` reads `05 … 59.0h ago SILENT` while `lastRunAt = 2026-09-03T14:11:26Z` says it fired —
row 2 of the contract table, the 529-on-turn-one that consumes a whole daily cadence. Next fire
`2026-09-04T14:10:37Z`, at which point `/sot/` will be ~72 h unkept.

This is the recovery half of open escalation **#23**, already with Marco with RULE-1 options. The
00:09Z run deferred it on the same evidence and set the trigger: **three of four would be a genuine
stoppage rather than a transient.** That trigger has not fired.

**DISPOSITION: DEFERRED** — becomes urgent if the 14:10Z occurrence also produces no breadcrumb.
Re-raising it now would spend Marco's attention on a question he already holds.

### FINDING 5 — the breadcrumb channel had silted up for two consecutive runs

`check-breadcrumb.mjs` flagged the 00:09Z breadcrumb `UNTRACKED — it reaches nobody until a board PR
commits it`. That run wrote it to the sanctioned fallback home and explicitly billed the next run to
commit it. Had this run done the same, two runs' findings would have existed only on one machine,
where `git clean` in the dev tree destroys them — and the station doc names that as the failure mode
in which "a station that believes it reported is indistinguishable from one that did".

Both are committed in this PR, which is the contract's *best* home: the breadcrumb lands with the
change it describes and needs nobody to sweep it up.

**DISPOSITION: ACTIONED** — committed here; `check-breadcrumb.mjs` exit 0 on the shape.

## WHAT I DID NOT DO

- **Did not merge anything.** #1554 (`sot/**`) and #1544 (`.claude/**`, `scripts/**`) hand-classify
  as Marco's. #1558 and #1559 hand-classify as docs-only and **are** mine to merge, but a second
  actor merged three PRs by hand during and around this run (#1536 00:05:59Z, #1541 00:30:55Z,
  #1543 01:10:09Z — the last of them three minutes before I would have acted), and BOARD DRIVING
  condition 3 forbids adding a second board actor to that. Condition 3 is the load-bearing one; the
  board is draining without me, so the cost of waiting is one cycle and the cost of colliding is
  LL-38.
- **Did not arm anything**, with `*-ready.md` = 0 and 80 HOLDs waiting — same reason, plus the
  `tests-docs` auto-merge lane is still deadlocked under escalation #21.
- **Did not force-push.** The push rejection on #1544 was treated as evidence to investigate, not an
  obstacle to overpower; `--force-with-lease` would have silently discarded the 11:27Z merge commit
  and destroyed the only trace of FINDING 1.
- **Did not touch the `verdict-guard` / `verdictApproves` staged fixes** — both open `scripts/` PRs,
  which route to Marco.
- **Did not clear the two modified files in the shared dev tree** (`docs/data-model/metadata-catalog.json`,
  `docs/pr-prompts/.arming-log.txt`). The index is shared with other chats and neither is mine.
- **Did not archive dispositioned breadcrumbs.** The current cycle is still live.
