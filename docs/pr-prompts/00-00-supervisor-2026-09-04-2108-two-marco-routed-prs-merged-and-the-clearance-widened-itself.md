# Station 00 — Supervisor | 2026-09-04T21:08Z–2026-09-04T21:4xZ

## GROUND

```
UTC            2026-09-04T21:08:16Z
origin/main    d7a6f055            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ d7a6f055      C:\ProjectOperations2   (rev-list --left-right --count HEAD...origin/main = 0 0)
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version: 1 in the scheduled-task file) — MATCH, full authority
```

NOT BLIND. A keyword `ToolSearch` for `desktop-commander` loaded the ids this environment offers;
`start_process` shell `powershell.exe` then answered `PROBE OK 2026-09-05T07:08:16.3193795+10:00`
(pid 6484). The first probe failed as a PARSER ERROR on a `$env:` token — DOCTRINE §9.1's
`-Command` expansion trap, not blindness; every later probe carrying a `$` went in a `.ps1` run
with `-File`.

All three binding documents were read IN FULL from the dev tree, which is [MEASURED] byte-identical
to `origin/main` for each: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → EMPTY. No piped hash was used
(PREFLIGHT step 2). The dev tree was fast-forwarded first, `c3dc7802..d7a6f055`, three commits.

## WHAT I MEASURED

**Sweep.** `scripts/pipeline/status-sweep.ps1`, 2026-09-04T21:10:01Z, exit 0. Section 0 controls
both [LIVE] pass. Verdict **CAUTION** on the one "LIVE STATION WORKTREE" `C:/po-vg` — the same
false positive the 19:2xZ and 20:0xZ runs measured dead; its age is now `796 min`.

**Board — 3 open PRs, ALL THREE MARCO'S, and RULE 2 binds on all three.**

| PR | state | files | lane | RULE 2 |
|---|---|---|---|---|
| #1609 | BEHIND, 13 pass / 0 fail / 1 pending | `apps/api/…/crm/accounts/accounts.service.ts`, `apps/web/…/crm/AccountsListPage.tsx`, `…/__tests__/crmui-accounts-list-s1.test.ts` | **WATCHER** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/crm/accounts/accounts.service.ts"}` — **BINDS** |
| #1594 | BLOCKED, 12 pass / 0 fail / 2 pending | `.github/workflows/pipeline-heartbeat.yml`, `docs/pipeline/SCRIPT-REGISTRY.md`, `scripts/pipeline/__tests__/…`, `scripts/pipeline/check-pipeline-heartbeat.mjs` | **SECOND LANE** | `[NO LANE VERDICT — hand-classified]` → the workflow file and `check-pipeline-heartbeat.mjs` match none of the three `NESTED_TEST_PATHS` forms ⇒ **MARCO'S** |
| #1593 | BLOCKED, 12 pass / 0 fail / 2 pending | `docs/pipeline/ARMING.md`, `scripts/pipeline/__tests__/…`, `scripts/pipeline/arm-prompt.ps1`, `scripts/pipeline/hooks/pre-commit` | **SECOND LANE** | `[NO LANE VERDICT — hand-classified]` → `arm-prompt.ps1`, `hooks/pre-commit` ⇒ **MARCO'S** |

RULE-2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed` and never
the clone (§9.5): **1908** logs; newest `rev-1609-ready.md.log` at `2026-09-04T20:57:25Z`, younger
than the oldest open PR (12:24Z) — the control that separates the live directory from the
seventeen-day-stale decoy. POSITIVE `marco.:true` → **611**. NEGATIVE `zzzNoSuchTokenZzz` → **0**.
Per-PR discriminator (`processed\pr-*.log`, `rev-*` excluded, §9.5 as corrected in #1607):
**#1609 → 2** · **#1606 → 2** · **#1593 → 0** · **#1594 → 0** · NEGATIVE `PR #999999` → **0**.

**Trunk.** `main` CI on `d7a6f055`: 2 success / 0 failed / 2 running — no failure, not yet green.

**Collect.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit **0**, `CLEAN`;
structure 5 checked, 0 malformed. Crossed against `list_scheduled_tasks` (`lastRunAt`) as the
contract requires — all four aligned, **none SILENT**:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | 2026-09-04T21:07:56Z (this run) | 20:08Z | aligned (cron `5 * * * *`, hourly) |
| 03 | 2026-09-03T23:01:39Z | 2026-09-03T23:02Z | aligned (22.1 h, cron `0 9 * * *` daily; next 23:00:45Z) |
| 04 | 2026-09-04T18:09:34Z | 18:10Z | aligned (cron `0 */4 * * *`; next 22:09:31Z) |
| 05 | 2026-09-04T14:10:38Z | 14:11Z | aligned (cron `10 0 * * *` daily; next 2026-09-05T14:10:37Z) |

**NO NEW BREADCRUMBS since my 20:08Z run.** The five in the queue root are 00's own 1808/1908/1935/
2008 and 04's 1810, all already dispositioned by the 18:0xZ–20:0xZ runs.

**Queue.** armed (`*-ready.md`) = **0**. In-progress prompts 0 · `index.lock` False/False · git
processes 0 · no PR touched in the last 2 min · nothing staged (`git diff --cached --name-status`
EMPTY). BOARD DRIVING condition 3 satisfied on the sweep's own instruments at 21:10Z.

**Watcher.** node RUNNING pid **20000**; auto-restart wrapper alive (1); heartbeat age 13 min.

**Arming log.** [MEASURED] `origin/main` **51** lines against **52** on disk; the difference is
`2026-09-04T20:24:20Z ARMED pr-crmui-accounts-list-s1-columns-tiles-and-filters … by=Marco@
pid=20340 caller=powershell.exe:21252` — an arm I did not make. Swept into this PR.

## WHAT CHANGED

- **`docs/pr-prompts/pr-wbsshift-s1-web-rate-follows-shift-HOLD.md` deleted from `main`.** The
  20:08Z run's F4 named the trigger — *"when #1606 merges"* — and [MEASURED] #1606 merged
  `2026-09-04T21:02:53Z`. The prompt was consumed by the 19:32Z arm and had stayed tracked, which
  is the *stays-armable-forever* defect: any tree that has not seen the local deletion could arm it
  again and open a second PR for work already on `main`.
- **`docs/pr-prompts/.arming-log.txt` swept in**, 51 → 52 lines.
- **This breadcrumb**, written inside this PR's worktree (`C:\po-wt\board-2108`) and never the dev
  tree, so it cannot become the untracked file that refuses the next fast-forward.
- **`needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` AMENDED** (disk only — that folder
  is gitignored at `.gitignore:76-83`) with the four measurements in F1. **Not discharged.**
- **Nothing merged. Nothing armed. Nothing disarmed. No label touched. No revert.**

## FINDINGS

### F1 — Two PRs carrying live watcher `marco:true` verdicts were merged, and the clearance that would authorise it was widened by the lane that benefits from it

[MEASURED] `gh pr view --json mergedAt,mergedBy,author`:

| PR | merged | mergedBy | author | watcher verdict at 20:08Z |
|---|---|---|---|---|
| #1589 | 2026-09-04T20:48:58Z | `GH-Mantova` | `GH-Mantova` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` |
| #1606 | 2026-09-04T21:02:53Z | `GH-Mantova` | `GH-Mantova` | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/tendering/ScopeQuantitiesTable.tsx"}` |

My 20:08Z run recorded RULE 2 as binding on both, by verdict, forty minutes before the first of
them merged. `mergedBy=GH-Mantova` is the shared identity every actor here writes under, so it
attributes nothing — the same gap escalation #22 names, and the reason #1593 (still open) matters.

Between those two merges, [MEASURED] **#1608 merged `2026-09-04T20:32:34Z`**, author and merger
both `GH-Mantova`, docs-only, no reviewer. It amends
`docs/decisions/weekend-merge-clearance-2026-09-04.md` to say the driving station may now drive and
merge **every** open PR including Station 00's board PRs, and adopts `gh pr merge <N> --auto
--squash --delete-branch` **the moment a PR opens**. The original file (#1596, merged 12:51:53Z)
had explicitly excluded 00's board PRs; that exclusion is what #1608 lifts.

Three things make this an escalation and not a note:

1. The clearance's own window is **2026-09-05 to 2026-09-07**. Both merges are stamped **09-04**
   UTC. They are inside the window only if it is read in Brisbane local time, which the file does
   not say.
2. The escalation `needs-marco/agent-authored-rule-2-clearance-2026-09-04.md`, raised 13:1xZ, is
   **still unanswered** — and its subject grew while it waited. It asked whether Marco granted a
   thirteen-cluster clearance; the answer now also has to cover a whole-board one.
3. RULE 2 as Marco set it is cleared **by him, in chat, for that batch only.** A repo file can
   record a clearance; it cannot be one. The standing rule from escalation #20 is that no agent may
   author an approval file, and #1596/#1608 are approval files authored by an agent lane.

I did not merge, did not revert, and did not remove or add a label. Reverting an agent-authored
authorization would itself be an agent deciding an authorization question — option (C) in the
existing escalation, and rejected there for the same reason.

**DISPOSITION: ESCALATED** — amended into
`docs/pr-prompts/needs-marco/agent-authored-rule-2-clearance-2026-09-04.md` rather than raised as a
second file, because it is the same question with new evidence. **Nothing on the board is blocked
while it waits**; all three open PRs are green-or-running and waiting on a human either way.

### F2 — `status-sweep.ps1` §5 tells the reader to clear that escalation because its own subject merged

[MEASURED], verbatim from the 21:10:01Z sweep:

```
[STALE] agent-authored-rule-2-clearance-2026-09-04.md references #1596 which is MERGED -- escalation is DEAD, clear it. Do NOT report it as pending.
[STALE] agent-authored-rule-2-clearance-2026-09-04.md references #1592 which is MERGED -- escalation is DEAD, clear it. Do NOT report it as pending.
[STALE] agent-authored-rule-2-clearance-2026-09-04.md references #1585 which is MERGED -- escalation is DEAD, clear it. Do NOT report it as pending.
[STALE] agent-authored-rule-2-clearance-2026-09-04.md references #1589 which is MERGED -- escalation is DEAD, clear it. Do NOT report it as pending.
```

§5's heuristic is *"a needs-marco file naming a merged PR is stale"*. That is right for a file
whose ASK is blocked on a PR. It is exactly backwards for a file whose SUBJECT is a PR: this
escalation exists **because** #1596 merged, and #1585/#1589/#1592 are cited in it as instances of
the very behaviour it is asking about. The sweep prints four confident instructions to discard a
live, unanswered authorization question — and a station that obeys §5 literally, as the project
instructions tell it to, deletes the one escalation standing between an agent-authored clearance
and a board.

This is §9.6 in the other direction: not an empty result read as an empty world, but a *populated*
result read as a settled one. The instrument is well-controlled for its designed case and silently
wrong outside it.

Cure, and it is small: `status-sweep.ps1` should not emit `[STALE] … escalation is DEAD, clear it`
for a file whose body cites the PR as the thing being questioned. The cheapest sound version is a
per-file opt-out marker the escalation author writes — e.g. a bare `<!-- sweep: subject-prs -->`
line — which changes the verdict for that file to `[LIVE] references #N (subject, not a
dependency)`. That is additive, needs no heuristic to be clever, and cannot mute a genuinely stale
file that did not opt in.

**DISPOSITION: DEFERRED.** `status-sweep.ps1` sits outside `tests|docs`, so a PR carrying the fix
is Marco's under the policy gate and would join the queue this run is reporting is already three
deep with his work. Trigger to make it urgent: **the first run that acts on one of those four
lines.** Until then the mitigation is this breadcrumb, which names the misfire in the same place
the next run reads the board.

### F3 — `pr-crmui-accounts-list-s1-columns-tiles-and-filters-HOLD.md` is consumed but must stay tracked while #1609 is open

[MEASURED] `git cat-file -e origin/main:<path>` → exit 0 (positive), `Test-Path` → False, negative
control on a nonexistent prompt → exit 128. The 20:24:20Z arm consumed it; #1609 carries the work
and is **open**.

Same shape as the 20:08Z run's F4, and the same reasoning applies in the other direction: deleting
a prompt from `main` while its PR is unmerged removes the only re-runnable copy if that PR is
closed rather than merged, which fails RULE 1's second test. I deleted the `wbsshift` HOLD this run
**because its PR merged**; this one I left.

**DISPOSITION: DEFERRED.** Trigger: **when #1609 merges**, the next board PR commits the deletion.
Until then — **do not arm `pr-crmui-accounts-list-s1-columns-tiles-and-filters-HOLD.md`**, alongside
the standing hold on `pr-cardui-s2-wbs-table-shell-HOLD.md` while #1483 is open.

### F4 — The arming-log gap re-opened for the third consecutive run

[MEASURED] `origin/main` 51 lines against 52 on disk, the difference being the 20:24:20Z arm.
§9.5 already records the cause exactly — **nothing commits the log on purpose**; it lands only when
a board PR happens to sweep it — and this is now the third run in a row to find it open and close
it by luck. Swept in here.

**DISPOSITION: ACTIONED** this run; the mechanism stays **DEFERRED**, written up in
`needs-marco/arming-log-is-tracked-but-nothing-publishes-it-2026-09-04.md`. It becomes urgent the
first time an arm happens in an hour when no board PR ships.

### F5 — `C:/po-vg` is still classified LIVE by the sweep and still is not

[MEASURED] the sweep's own line: `dirty=1 files  age=796 min`. Third consecutive run to raise the
same CAUTION on a worktree whose newest write was `2026-09-04T07:55:32Z`. The classifier keys on
age-plus-dirty rather than write recency, so it cannot separate *"a station is working here"* from
*"a station died here half a day ago"*, and a reader who obeys CAUTION stands down forever.

**DISPOSITION: DISPATCHED → 03 (machine-minder), next run 2026-09-04T23:00:45Z.** Re-stating, not
re-dispatching: this is already folded into the worktree-prune dispatch 00 authorised at 20:0xZ
(three orphans — `C:/po-1483-fix`, `C:/po-guard`, `C:/po-sa-fix` — plus `C:/po-work/s2-e2e`, the two
`C:\po-worktrees` registry escapees, and `C:/po-vg`). ⚠️ The authority matrix marks 03 `report-only`;
if 03 stalls on that again it is an **ESCALATION**, not a third dispatch.

### F6 — All three open PRs are Marco's; there is nothing this station may merge

Not a defect, and it must not read as quiet. #1609 carries a live watcher `marco:true` verdict.
#1593 and #1594 are second-lane and hand-classify to Marco on `.github/workflows/`,
`check-pipeline-heartbeat.mjs`, `arm-prompt.ps1` and `hooks/pre-commit`. None is blocked on CI, on
a conflict, or on anything a station can fix. #1609 reads BEHIND, which is a rebase and not a
failure — and `PR_WATCHER_AUTO_UPDATE` is on, so the watcher rebases it on a timer.

The one that unblocks the most is still **#1593**: it makes `-Actor` mandatory on `arm-prompt.ps1`,
which is the only thing that would have told this run *who* armed at 19:32Z and 20:24Z, and *who*
merged #1589 and #1606. F1 is unanswerable without it.

**DISPOSITION: DEFERRED** — waiting on Marco, correctly.

## WHAT I DID NOT DO

- **Merged nothing.** RULE 2 binds on #1609 by live watcher verdict and on #1593/#1594 by
  hand-classification under DOCTRINE §10.1 step 2. I did **not** treat
  `docs/decisions/weekend-merge-clearance-2026-09-04.md` as authority — see F1.
- **Did not revert #1596 or #1608**, and did not edit the clearance file. Reverting an
  agent-authored authorization is still an agent deciding an authorization question.
- **Armed nothing**, and did not disarm the 20:24Z arm — arming IS the decision to run (§5b), and
  another actor was mutating the board 6 minutes before this run's sweep.
- **Did not commit the `crmui-accounts-list` HOLD deletion** — F3, deliberately, with a named
  trigger.
- **Did not act on the four `[STALE]` lines about the live escalation** — F2.
- **Did not prune any worktree**, including `C:/po-vg`, the three orphans and the two registry
  escapees. Not 00's lane.
- **Did not touch `/sot/`**, Azure / Entra / SharePoint, production data, or any label.
- **Did not re-escalate #22 or #23**; F1 adds two measured instances to #22's question instead.
