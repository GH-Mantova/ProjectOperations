# Station 00 — Supervisor | 2026-09-05T18:08Z–2026-09-05T18:30Z

## GROUND

```
UTC            2026-09-05T18:08:28Z
origin/main    f86f689e            (fetched, then rev-parse)
dev tree       main @ f86f689e     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions MATCH — full authority run. SIGHTED: `start_process` returned a live `powershell.exe` on
the Windows host after a `ToolSearch` keyword load for `desktop-commander`. All three binding
documents were read from the working copy and proved current:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md`
returned **EMPTY** — the PREFLIGHT-approved form, no piped hash anywhere in this run.

Dev tree entered and left clean: `git diff --numstat` EMPTY, `git diff --cached --name-status`
EMPTY, `git rev-list --left-right --count HEAD...origin/main` = `0	0`.

## WHAT I MEASURED

**Sweep verdict.** `scripts/pipeline/status-sweep.ps1` captured to a file (it returns early and
hides its own §7 verdict when read inline). §7: **`SAFE TO ACT`** — no board mutation in progress,
no recent remote activity, no live station worktrees. [MEASURED]

**Freshness.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → exit 0, `CLEAN`.
`00` 0.9h ago, `03` 19.2h, `04` 4.0h, `05` 4.0h — all `ok`, none SILENT. [MEASURED]

**Collect.** Exactly one breadcrumb in the queue root: my own 17:17Z run, already tracked on `main`
via `#1674`. **No un-collected breadcrumbs from 03/04/05.** Nothing to disposition from other
stations this cycle. [MEASURED]

**Board.** 4 open PRs, all `CLEAN`, all green, none draft, **none carrying a single label**:

| PR | title | mergeState | CI | labels |
|---|---|---|---|---|
| #1675 | docs(plans): CD-S2 — measure Claude Design spec drift | CLEAN | 9/0/0 | none |
| #1667 | fix(lint): Arm ONLY marker case-insensitive | CLEAN | 14/0/0 | none |
| #1665 | feat(scope-costs): operational cost lines table + CRUD | CLEAN | 14/0/0 | none |
| #1662 | feat(scope)!: retire legacy plant-days, **drop five columns** | CLEAN | 14/0/0 | none |

**RULE 2 probe — controls first.** Tree pinned to the LIVE `docs/pr-prompts/processed` (1960 logs,
newest `2026-09-05T16:34:08Z` — inside the hour, so not the 17-Aug decoy). Regex form
`marco.:true`, never `-SimpleMatch`. **POS 612, NEG (`zzzNoSuchNeedleZzz`) 0.** Mandated negative
control: my own board PR **#1674 reads `NO LOG`**, proving `NO LOG` means "not a watcher-opened PR",
not "broken probe". [MEASURED]

Second instrument, `merge result for PR #<n>` across the same 1960 logs — POS control **662** lines
matching `merge result for PR`. For **#1675, #1667, #1665, #1662: NO MERGE-RESULT LINE.** [MEASURED]

**Launch-log lane test.** `C:\po-watcher\watcher-launch.log`, `opened PR #… policy=…` — POS control
**14** `policy=tests-docs, waiting…` lines. Only **#1675** appears:

```
[2026-09-05T17:27:48.484Z] [merge] pr-claudedesign-s2-spec-regeneration-plan-ready.md:
    opened PR #1675, policy=tests-docs, waiting…
```

**#1667, #1665 and #1662 have no `opened PR` line at all ⇒ SECOND LANE.** [MEASURED]

🔴 **A control refused an inference here and I obeyed it.** I also grepped the launch log for
`marco.:true` to test Marco-routing: it returned **0 — and its negative control also returned 0.**
Two opposite questions, identical answers. That is §9's shape exactly, so **the launch log cannot
answer the Marco question** and I did not read "no marco line" as "not routed to Marco". The marco
verdict lives only in `processed/*.log`. [MEASURED]

**Hand-classification** by `classifyPolicyFiles` (three tests/docs forms: `^(tests|docs)/`,
`(^|/)__tests__/`, `\.(test|spec)\.[cm]?[jt]sx?$`; anything else, or any `(^|/)migrations/`, is
Marco's) — file lists pulled live from `gh pr view --json files`:

- **#1675** — `docs/plans/claude-design-spec-regeneration-plan.md`. Matches `^docs/`. **tests-docs.**
  Agrees with the watcher's own `policy=tests-docs`.
- **#1667** — `scripts/pipeline/lint-prompt.mjs` matches **none** of the three forms (its sibling
  `__tests__/…test.mjs` does; one non-matching path is enough). **`[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S.**
- **#1665** — `apps/api/prisma/migrations/20260905020000_scope_operational_cost_lines/migration.sql`
  matches `(^|/)migrations/`. **`[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S.**
- **#1662** — `apps/api/prisma/migrations/20260905010000_drop_legacy_plant_days/migration.sql`,
  a **DROP**. **`[NO LANE VERDICT — hand-classified]` ⇒ MARCO'S.**

**CP-26 on the three second-lane PRs.** `Approval receipt (CP-26)` = **pass** on #1667, #1665 and
#1662. `gh pr view --json files` filtered for `merge-approvals|receipt` → **none in any diff.**
[MEASURED]

**Prose-gate read on #1675's prompt.** `## STANDING AUTHORITY` L86–87 contains the string
*"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED*. Read in full (L84–93) it is the
**standard boilerplate** defining the term for the code-writer — memory records it on ~51 of 61
prompts — **not** a gate on this prompt. Front matter: `escalates: false`, `gate_allow: none`,
`size: 1`. The `## Do NOT` block (L63–69) is scope limits only, no merge clause. **No prose merge
gate exists on #1675.** [MEASURED]

**Watcher.** node RUNNING pid 20000; wrapper alive (1); heartbeat 0 min; `index.lock` False/False;
0 git processes; 0 in-progress prompts. Armed = 3, of which **`rev-1674-ready.md` and
`rev-1675-ready.md` are REVIEW JOBS, not arms** (DOCTRINE §9.5) — real armed count is **1**,
`pr-claudedesign-s2-spec-regeneration-plan-ready.md`, and that one is **in flight**, held by the
`policy=tests-docs, waiting…` merge waiter that opened #1675. [MEASURED]

**Not a duplicate-arm risk.** I nearly dispositioned that armed `-ready.md` as the never-retired-HOLD
defect. It is not: the only `processed/` copies matching `*claudedesign*` are **s1**
(`pr-claudedesign-s1-track-the-written-half`), and `git ls-tree -r origin/main -- docs/pr-prompts`
matches **no** `claudedesign` path. s2 has never been processed — it is mid-flight, owned by the
waiter, and touching it would be the LL-38 collision. [MEASURED]

## WHAT CHANGED

**Nothing on the board. I merged nothing, armed nothing, labelled nothing, and disarmed nothing.**
The only mutation this run is this breadcrumb and its PR, authored in an isolated worktree off
`origin/main` (REPORT CONTRACT cure 1 — no loose copy in the dev tree, so the post-merge
fast-forward has no untracked blocker to trip on).

## FINDINGS

### F1 — CP-26 passes vacuously on an unlabelled destructive migration

`#1662` drops five columns. `Approval receipt (CP-26)` reports **pass**. There is **no receipt in
its diff**, it carries **no label**, and no watcher verdict exists for it. The check that exists to
prove a human approved a destructive change is green on a change **no human approved**, and green
for the reason that it was never armed: CP-26 is triggered by **labelling**, and an unlabelled PR
gives it nothing to check. The same holds for `#1665` (additive migration) and `#1667`.

This is not a new theory — memory already names the upstream hole ("CP-26 is armed by LABELLING,
not by the DIFF") and `#1635` already asks the gate question. What this run adds is the **worked
instance the question needed**: a green `Approval receipt` badge sitting on an unapproved
five-column `DROP`, on the open board, right now. A reviewer scanning check names sees approval
where there is none.

RULE 1, complete-and-additive first: **(a)** trigger CP-26 off `classifyPolicyFiles` on the **diff**
rather than off the label, so a migration path arms the check regardless of who opened the PR or
whether anything labelled it — solves it immediately (these three) and in future (every lane, every
actor), and damages no data entry. **(b)** require the label on every PR touching `migrations/`,
applied by CI — future-complete but leaves today's three green and depends on the labeller running.
**(c)** treat "no label" as a CP-26 **fail** — immediate, but turns every docs PR red and fails the
no-damage half. Only (a) passes both halves.

**DISPOSITION: ESCALATED** — folded into the open `#1635` gate question rather than raised as a
rival escalation; the choice between (a)/(b)/(c) is Marco's and the evidence above is what (a)
needs. Written to `docs/pr-prompts/needs-marco/`.

### F2 — `NO LOG` has a THIRD cause, and the standing note names only two

Memory records: *"`NO LOG` HAS TWO CAUSES — second lane, or a watcher PR whose verdict was never
written."* **#1675 is neither.** It is a watcher-opened PR whose verdict has not been written *yet*,
because it is still inside its `policy=tests-docs, waiting…` window — opened 17:27:48Z, green since
17:31:03Z, unmerged at 18:30Z.

Read with the two-cause note alone, #1675 classifies as **second lane** — and it is not. The
discriminator that settles it is the **launch log's `opened PR #<n>` line**, which is a different
instrument from the `processed/*.log` merge-result probe. A run holding only the merge-result probe
would have hand-classified a live watcher PR as an unattributed one. **The third cause is
"in-flight", and it is indistinguishable from the other two without the launch log.**

**DISPOSITION: ACTIONED** — recorded here, and the standing note is corrected in this PR's memory
pass. Verified by the launch-log excerpt quoted above with its 14-line positive control.

### F3 — Three of four open PRs are Marco's, and the board cannot move on them

`#1667`, `#1665`, `#1662` all hand-classify to MARCO'S. `#1675` belongs to the watcher's own
in-flight waiter. **There is no PR on this board that Station 00 may merge.** The board is not
stalled by a defect — it is at its documented throughput constraint: 00 arms, the watcher builds,
CI greens, and everything outside `tests/` or `docs/` then stops at a human. Arming more makes the
queue longer, not shorter.

**DISPOSITION: DEFERRED** — real, not actionable by me. It becomes urgent if the count of
Marco-blocked PRs carrying **migrations** exceeds what one review sitting can clear, or if either
migration PR is merged by any actor without a receipt.

### F4 — Two review jobs starved behind the merge waiter for 45+ minutes

`rev-1674-ready.md` queued 17:25:30Z (depth 1, "busy"), `rev-1675-ready.md` queued 17:30:00Z
(depth 2, "busy"). Since 17:30 the launch log records **only** `verdict-archive sweep` every five
minutes — no `[start]` for either. The single lane is held by the `#1675` merge waiter, so review
jobs cannot run while a merge is pending. No `pr-1667-review.md`, `pr-1665-review.md` or
`pr-1675-review.md` exists on disk.

This is the already-recorded "tests-docs lane starves its own review job" shape, still live after
the PRs in that escalation merged (the sweep now tags all four of its references `[STALE]`, which
retires the *escalation*, not the *defect*).

**DISPOSITION: DISPATCHED → 03 (machine-minder).** The lane/queue is 03's, not mine. Handed over:
confirm whether the merge waiter is designed to hold the lane, and if so whether review jobs should
run on a separate lane; the measurement above (timestamps, depths, the 5-minute sweep-only tail) is
the reproduction.

### F5 — a stale local branch collided with this run's branch name

`git worktree add -b board/00-collect-1808` failed `fatal: a branch named 'board/00-collect-1808'
already exists` — a **local, never-pushed** branch from the 2026-09-04T18:15Z run, which used the
undated `00-collect-<HHMM>` form. The current convention is dated
(`board/00-collect-2026-09-05-1508`), so the collision is a 24-hour-period alias in the older form.
I briefly suspected a concurrent Station 00; ruled out by `git ls-remote` (absent on origin), the
branch's commit date, `git worktree list` (two entries, neither a live station), and the node
process table (only watcher pid 20000 predates this session).

**DISPOSITION: ACTIONED** — used the dated form `board/00-collect-2026-09-05-1808`. The stale
branch is left in place; deleting local branches is not this run's business and it harms nothing.

## WHAT I DID NOT DO

- **Merged nothing.** Three PRs are Marco's by hand-classification with no lane verdict; the fourth
  is held by the watcher's own waiter. Merging `#1675` underneath an in-flight waiter is the LL-38
  two-actors collision, and would risk stranding `pr-claudedesign-s2-…-ready.md` in the queue root
  where it re-fires into a duplicate PR. The waiter retires the prompt; I do not.
- **Did not disarm or move `pr-claudedesign-s2-spec-regeneration-plan-ready.md`** — mid-flight, and
  proved not to be the never-retired-HOLD defect.
- **Did not remove any label** (there are none) and **did not author any approval receipt** — no
  agent may, standing rule.
- **Did not clear the `[STALE]` needs-marco references** the sweep flags (11 in
  `agent-authored-rule-2-clearance-2026-09-04.md` alone). Discharging them is 03's dispatched
  clone-hygiene work and they must be MOVED to `needs-marco/discharged/`, never deleted.
- **Did not touch `C:/po-vg`** — orphaned worktree, 2055 min old, **holds 1 uncommitted file**
  (`check-pipeline-heartbeat.mjs`). `--force` would discard it. Already dispatched to 03.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
- **Did not arm anything.** With the lane already held and every eligible PR blocked on a human,
  arming would lengthen the queue without moving the board (F3).
