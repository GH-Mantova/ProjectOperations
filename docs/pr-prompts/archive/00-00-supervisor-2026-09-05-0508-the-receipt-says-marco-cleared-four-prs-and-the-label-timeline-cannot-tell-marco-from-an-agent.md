# Station 00 — Supervisor | 2026-09-05T05:08Z–2026-09-05T05:5xZ

## GROUND

```
UTC            2026-09-05T05:08:21Z
origin/main    472ae67c            (fetched, then rev-parse)
dev tree       main @ 472ae67c     C:\ProjectOperations2   (was 85ecee0d — 5 behind; fast-forwarded this run)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md) — MATCH, run is READ-WRITE
```

**SIGHTED RUN.** `start_process` shell `powershell.exe` returned PID 17828 on the first call, after
loading the Desktop Commander schemas via `ToolSearch` (PREFLIGHT step 1: a validation error is not
blindness). The previous run, 04:08Z, was blind. Two consecutive 00 runs, one of each — which is
what made this run's central measurement possible from both sides.

## WHAT I MEASURED

- **[MEASURED] The clock trap fired on my own first command, and I am recording it because the
  station doc's RULE 2 is about exactly this.** `Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ"` returned
  `2026-09-05T15:08:21Z`. That is **AEST wearing a `Z`** — `-Format` does not convert, it just
  prints the literal character. The true UTC was `05:08Z`, confirmed independently by
  `status-sweep.ps1`'s own header (`generated 2026-09-05 05:09:10Z`) one minute later. Ten hours,
  which is exactly the Brisbane offset. Every timestamp in this report is real UTC.
- **[MEASURED] Dev tree was 5 commits behind and is now in sync.** `git rev-list --left-right
  --count HEAD...origin/main` → `0  5` before, `0  0` after `git merge --ff-only origin/main`.
  `git diff --numstat` and `git diff --cached --name-status` both EMPTY before the merge, so no
  untracked-breadcrumb blocker and no shared-index collision this time.
- **[MEASURED] `docs/pipeline/` did not change in those five commits** — `git diff --numstat
  85ecee0d..472ae67c -- docs/pipeline/` returned EMPTY — so the three binding documents I read from
  the working copy before the fast-forward ARE the `origin/main` copies. Recording the probe rather
  than the habit, because PREFLIGHT step 2 says read them from `origin/main` and I read them first.
- **[MEASURED] `status-sweep.ps1` verdict §7: SAFE TO ACT** — no board mutation in progress,
  no remote activity in 2 min, no live station worktrees, 0 in-progress prompts, no `index.lock` in
  either tree, 0 git processes. Captured to a file (`C:\po-sup-fix-scripts\sweep-20260905-1510.txt`,
  37,874 B, 444 lines) rather than read from the stream, because the sweep returns early and hides
  its own §7 verdict.
- **[MEASURED] Instrument positive controls inside the sweep both passed** — `gh` reached GitHub
  (saw merged #1637); `node` runs.
- **[MEASURED] COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, CLEAN.**
  9 breadcrumbs checked, 0 malformed. Freshness: `00` 1.0h (cadence 2h) · `03` 6.2h (24h) ·
  `04` 3.0h (4h) · `05` 15.0h (24h) — all `ok`. **No station is SILENT.**
  It also printed the NOTE that my own 04:08Z breadcrumb is UNTRACKED and reaches nobody. That is
  this run's sweep-up job and it is in this PR.
- **[MEASURED] COLLECT set is ONE breadcrumb.** The only breadcrumb newer than my last run
  (04:08Z) is that run's own. `04`'s newest is 02:09Z and its findings were already retired by
  #1635; `03`'s is 2026-09-04T23:01Z; `05`'s is 2026-09-04T14:11Z. Nothing else is uncollected.
- **[MEASURED] Board: 4 open PRs, ZERO DIRTY.** `gh pr list --state open --json
  number,title,mergeStateStatus,isDraft,labels,headRefName,author,createdAt`, **assigned before
  iterating** (§9.4 — the piped form collapsed the array to one object on my first attempt and
  printed `System.Object[]`, which is the trap doing exactly what it is documented to do):

  | PR | state | labels | created | head |
  |---|---|---|---|---|
  | #1640 | BLOCKED | **none** | 05:07:12Z | `pr-cardfix-s3-plant-picker` |
  | #1639 | BEHIND  | **none** | 04:27:11Z | `pr-cardpersist-s4-tender-total-reads-item-markup` |
  | #1638 | BLOCKED | **none** | 04:16:32Z | `pr-cardnav-s1-discipline-stacking` |
  | #1615 | BLOCKED | **none** | 2026-09-04T23:00:57Z | `pr-crmui-comms-s1-threads-rail-and-todos` |

  All four author `GH-Mantova`. CI on all four was still running at sweep time (0 failures).
  **Q1 answer: 0 DIRTY, so no frozen-CI blocker on this board.**
- **[MEASURED] Armed prompts, counted myself: 0.** (`status-sweep.ps1` §4, `armed (*-ready.md): 0`.)
  Queue: needs-marco 19 · no-pr-opened 109 · failed 41 · blocked 117.
- **[MEASURED] RULE 2 probe, in the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`,
  with all three controls.** 1931 logs · newest `2026-09-05T04:33:16Z` — younger than the oldest
  open PR (#1615, 2026-09-04T23:00Z), which is the control that separates the live directory from
  the 17-day-stale decoy in the watcher clone · POS `marco.:true` → **612** · NEG
  `zzzNoSuchNeedleZzz` → **0** · NEG `PR #999999` over `pr-*.log` → **0**.
  Matching `PR #<n>\b` over `pr-*.log` only (excluding `rev-*`, which name PRs from both lanes):
  **#1640 → 0 · #1639 → 0 · #1638 → 0 · #1615 → 0.** All four: **`[NO LANE VERDICT]`.**
- **[MEASURED] The second instrument agrees: none of the four was armed.** `.arming-log.txt` is
  **53 lines on disk and 53 on `origin/main`** (`git show origin/main:...` — the publish gap is
  closed, again). Last arm `2026-09-04T22:03:13Z pr-crmui-account360-s1-tiles-and-next-action`.
  No arm names any of the four head branches, and no arm at all falls inside the window
  23:00Z–05:07Z in which all four were opened. **Two instruments, same answer: SECOND LANE.**
  I did not classify from the branch names, which read exactly like queue prompts — that is the
  #1633 trap.
- **[MEASURED] Hand-classification under DOCTRINE §10.1 step 2, against the three
  `NESTED_TEST_PATHS` forms as they stand today.** Paths outside all three / migrations:
  **#1640 2 / 0** (`apps/web/src/components/TooltipSelect.tsx`, `.../ScopeQuantitiesTable.tsx`) ·
  **#1639 1 / 0** (`apps/api/src/modules/tendering/scope-redesign.service.ts`) ·
  **#1638 6 / 0** (`apps/web/src/pages/tendering/scope-cards/*`) ·
  **#1615 1 / 0** (`apps/web/src/pages/crm/CommsHubPage.tsx`).
  **All four are MARCO'S. `[NO LANE VERDICT — hand-classified]`. None is mine to merge.**
- **[MEASURED] Three new CP-26 approval receipts landed since my last run** — `1614.md`, `1619.md`,
  `1621.md`, taking `docs/decisions/merge-approvals/` to 13 files. **Each arrived inside its own
  PR's diff** (`gh pr view <n> --json files` → `receipt-in-diff=1` for all three), not as a separate
  commit by a reviewer afterwards.
- **[MEASURED] The receipts are AGENT-AUTHORED, and they say so in their own text.** `1621.md`
  verbatim: *"The text was written by the Station 00 cloud lane on his instruction; the approval is
  his, and it is independently checkable in the label timeline."* It records Marco removing
  `do-not-merge` at `02:01:33Z` in one pass across #1614, #1615, #1619 and #1621 and telling that
  lane in chat to drive the board to green and merge.
- **[MEASURED] The timing half of that claim is TRUE.** `gh api repos/.../issues/<n>/events`:

  | PR | `do-not-merge` removed at | actor |
  |---|---|---|
  | #1614 | 2026-09-05T02:00:04Z | `GH-Mantova` |
  | #1615 | 2026-09-05T02:00:34Z | `GH-Mantova` |
  | #1619 | 2026-09-05T02:00:57Z | `GH-Mantova` |
  | #1621 | 2026-09-05T02:01:33Z | `GH-Mantova` |

  One pass, 89 seconds, exactly the four PRs the receipt names. #1614 and #1615 also show an
  earlier remove/re-apply cycle (23:57Z→00:12Z and 00:01Z→00:12Z).
- **[CANNOT MEASURE] WHO removed the labels.** Every one of those eight label events reads actor
  `GH-Mantova` — and `gh` on this box is authenticated as `GH-Mantova`. Marco and every agent share
  one identity in that timeline. See F1.
- **[MEASURED] The Cowork workspace mount IS the live dev tree.** See F2 — this is the finding I
  came in owing from the 04:08Z run, and it is now measured from the sighted side.
- **[MEASURED] Watcher healthy** — node pid 20000 RUNNING, auto-restart wrapper alive (1),
  heartbeat 36 min (ticks only mid-run; stale + empty queue = idle, not wedged), 0 armed. I did not
  restart anything.
- **[MEASURED] Two pre-existing machine items, unchanged, not mine:** the watcher clone reads
  `branch=main dirty=4`, and `C:/po-vg` is an orphaned worktree, age 1276 min, **holding 1
  uncommitted file**. Both are 03's lane. See DISPOSITIONS.
- **[MEASURED] `main` CI on `472ae67c`: 2 success / 0 failed / 2 running** at sweep time — no
  failure, but not yet fully green.

## WHAT CHANGED

1. **Dev tree fast-forwarded** `85ecee0d` → `472ae67c`. Read back `0  0`, `--numstat` EMPTY,
   `--cached --name-status` EMPTY.
2. **`docs/pipeline/STATION-CAPABILITIES.md` §3 "No second transport" corrected** (this PR).
   `git diff --numstat` → `35  1`; file 17,941 B → 20,465 B, delta **+2,524**, and the two anchor
   headings still occur exactly once each — the §9.3 byte-delta assertion, run because the
   `String.replace` `$`-injection trap is invisible to every read-back that only looks for what you
   wrote.
3. **The 04:08Z blind-run breadcrumb swept up** from the dev tree into this PR, so it stops being
   untracked and reaches somebody.
4. **This breadcrumb**, written inside this run's own PR worktree — REPORT CONTRACT cure 1, which
   is the one that leaves no loose copy in the dev tree and cannot block the next fast-forward.
5. **`needs-marco/label-removal-is-the-release-path-and-leaves-no-signature-2026-09-05.md` amended**
   with F1's measurement. Untracked by design (`.gitignore:76-83`), so the tracked copy of that
   finding is F1 below.

Nothing else. **No merge, no arm, no label change, no restart, no queue mutation.**

## FINDINGS

### F1 — The four open PRs carry an agent-authored release receipt, and its one falsifiable claim is refuted

The receipt in `docs/decisions/merge-approvals/1621.md` asserts its own checkability: *"the approval
is his, and it is independently checkable in the label timeline."* **It is not.** The label timeline
records actor `GH-Mantova` for all eight events, and `gh` on this box authenticates as `GH-Mantova`.
The timeline can prove **when** the gate was released and **in what batch** — both of which it does,
cleanly. It cannot prove **by whom**, which is the only fact a receipt exists to record.

So the chain is: an agent wrote a document attesting to Marco's approval, and pointed at an
instrument that cannot distinguish Marco from that agent. Standing rule: **no agent may ever author
a `merge-approvals/<N>.md` or any approval file.** That rule was broken three more times since my
last run — transparently, and pointing at real evidence, but broken. And #1615 is **still open**,
named in that release list, unlabelled: the receipt chain would license merging it.

**I did not merge it.** RULE 2 is cleared only by Marco in chat, for that batch only, and a
clearance an agent wrote is not that — same shape as the #1596 blanket clearance already ruled
DO NOT HONOUR. This is not a new escalation; it is the sharpened form of the open one (#1630/#1635),
and it now has a probe instead of a shrug.

**RULE 1 options for Marco.** *Complete-and-additive first.*

**(a) Give the receipt a signature the timeline cannot fake, and make CP-26 check it.**
`approval-receipt-check.mjs` currently proves a file is *present*. Make it prove the release was
**Marco's**: the receipt must carry the `do-not-merge` removal event id and the check must resolve
that event's actor against a distinct identity — a GitHub App or PAT that only Marco holds, so his
label removals stop reading as `GH-Mantova`. Nothing existing breaks; every past receipt stays
readable; the gate gets teeth it never had. **Solves it immediately and in future, and damages no
data entry — both halves of RULE 1 pass.** It is the only option here that does.

**(b) Forbid receipts inside the PR's own diff; require a separate commit by the approver.**
Cheap, and it removes the self-approval shape. **Fails the future half** — the separate commit is
still authored by `GH-Mantova`, so it moves the ambiguity rather than closing it.

**(c) Do nothing; keep treating an agent-authored receipt as non-binding.**
Costs nothing and loses nothing today, since RULE 2 already refuses. **Fails the immediate half** —
#1615 and its successors sit indefinitely, and the next run re-derives this whole argument from
scratch, which is the third run in a row to pay for it.

**DISPOSITION: ESCALATED.**

### F2 — "A blind run can see nothing" is false, and it costs every blind run its COLLECT

`STATION-CAPABILITIES.md` §3 read *"Desktop Commander is the **only** transport onto the Windows
host … the run is blind and stops."* The **stop** is right. The **only transport** is not.

**[MEASURED] this run, from the sighted side, which is the side that can cross-check.** I
fast-forwarded the Windows dev tree to `472ae67c` through Desktop Commander; the Cowork mount's
`/sessions/<id>/mnt/ProjectOperations2/.git/refs/heads/main` then read
`472ae67c8ac6607f87e9599a5c3e2087f6108bcf` — same commit, different transport. A file I wrote to
`C:\po-sup-fix-scripts\` through Desktop Commander appeared under the mount in the same minute.
The 04:08Z blind run had already reached this from the other side with no Desktop Commander at all.

That mount carries **the whole of COLLECT**: the queue, `processed/*.log` (the RULE 2 probe),
`.arming-log.txt`, every breadcrumb, the three binding documents. What it cannot do is **run**
anything — no `.ps1`, so no sweep, no liveness, no smoke, no merge, no arm — and it must never run
`git` against the Windows `.git` (§9.2, the 0-byte `index.lock` that freezes every station). The
GitHub MCP is write-403, so a blind run still cannot open a PR instead.

**ACTIONED** in this PR under RULE 1 option (a): the claim is narrowed to *"the only transport that
can RUN anything on the host"*, the stop is kept verbatim, and the mount's ceiling is written out so
no future run mistakes read-access for authority. Verified by `git diff --numstat` (`35 1`) and the
byte-delta assertion above.

**DISPOSITION: ACTIONED.**

### F3 — The watcher clone is dirty and an orphaned worktree holds uncommitted work

`status-sweep.ps1` §2: watcher clone `branch=main dirty=4`, with the sweep's own note that the
watcher *may refuse to start*; and `C:/po-vg` at `23c91ba9 [fix/no-rebase-while-checks-run]`,
age 1276 min, **dirty=1 — it holds uncommitted work**, so `git worktree remove` will refuse and
`--force` would discard it.

Both are Station 03's lane and I am not touching either — this is the LL-38 line. The watcher is
alive (pid 20000, wrapper alive, 0 armed), so neither is urgent right now; the clone's dirtiness
becomes urgent the moment a restart is needed, and the worktree becomes urgent the moment anybody
prunes without listing it first (`git -C C:/po-vg status --porcelain`).

**DISPOSITION: DISPATCHED — Station 03 (Machine-minder), next cadence.** Clean the clone to
clean-on-main so a restart cannot be refused; and list, then preserve or commit, `C:/po-vg`'s one
file before deciding anything about that worktree.

### F4 — Four second-lane PRs are open, all Marco's, and none carries a `do-not-merge` label

#1640, #1639, #1638 and #1615 are all `apps/**` feature work, all `[NO LANE VERDICT]`,
all hand-classified **Marco's**, and **all four are unlabelled** — so CP-26 does not apply to any of
them. This is the same hole already escalated as *"the hole is the four never labelled"* (#1630),
with four fresh instances. I am recording the instances and **not re-raising it as new**.

**DISPOSITION: DEFERRED** — folded into F1's escalation, which is the same question one layer up
(who may release a gate, and how a run can tell). It becomes urgent if one of these merges without a
label and without a receipt, which is the state that has now happened five times.

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs are hand-classified Marco's under §10.1 step 2, and
  the only thing offering to clear #1615 is a receipt an agent wrote. RULE 2 binds.
- **Did not arm anything.** 90 HOLDs, 0 armed, and four of Marco's PRs already in flight. Arming
  needs RULE 4's full detector and a reason; I had neither, and "the queue is quiet" is not a reason.
  Explicitly: `pr-cardui-s2-wbs-table-shell-HOLD.md`, `pr-tr-s1-reminder-policy-HOLD.md` and the
  three `pr-crmui-{chrome,comms,relationships}-s1-…-HOLD` remain on the do-not-arm list.
- **Did not touch the watcher, the clone, or `C:/po-vg`** — F3, dispatched to 03.
- **Did not remove or add any label.** Only Marco removes `do-not-merge`.
- **Did not clear the `[STALE]` escalation lines** the sweep §5 flagged. Several reference merged
  PRs and read as dead, but `agent-authored-rule-2-clearance-2026-09-04.md` is the file F1 is about
  and clearing it on a `[STALE]` PR reference would delete the live question with the dead one.
- **Did not edit `/sot/`** — 05's lane, and CP-24 hard-blocks it anyway.
- **Did not fold the breadcrumb-blocks-the-fast-forward rule into the `station-contract` canonical
  block.** Still the right fix for all seven stations at once; still more than a collect run should
  carry, because it must be re-recorded and shipped across seven docs in one PR.
