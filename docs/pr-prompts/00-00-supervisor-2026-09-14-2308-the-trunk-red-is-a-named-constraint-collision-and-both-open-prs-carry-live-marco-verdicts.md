# Station 00 — Supervisor | 2026-09-14T23:08Z–2026-09-14T23:3xZ

## GROUND

```
UTC            2026-09-14T23:08:59Z
origin/main    8c6bffc3            (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 8c6bffc3     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was read-write.

`git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **EMPTY** in the dev tree, so the working copies I
read are byte-identical to `origin/main`. No piped hash was taken (station-contract v3 forbids it).

⚠️ **Read-in-full disclosure, because a partial read reported as a full one is the failure this
contract exists to stop.** `00-supervisor.md` (1318 lines) was read in full. `DOCTRINE.md` (2505
lines) was read for sections 1–9.4, 9.6 and 10.1; **section 9.5 was read to line 1484 of 1690, and
sections 10.2–10.6 were NOT read this run** — the trunk was red and I chose to spend the remaining
run on the board rather than on the tail of a document whose operative rules for this run (the
RULE-2 probe, the arming detector, the `NO LOG` discriminator, section 10.1's lane test) all sit
inside what I did read. Nothing in this report rests on an unread section, and nothing this run did
required one: **armed = 0, no arm was made, and no merge was possible.**
`STATION-CAPABILITIES.md` was NOT read this run — same reason, same disclosure.

## WHAT I MEASURED

- [MEASURED] **Sighted run.** Desktop Commander ids loaded by keyword `ToolSearch` FIRST (never
  assumed); `start_process` shell `powershell.exe` returned pid 27800 and
  `2026-09-15T09:08:59.4373392+10:00` (= `2026-09-14T23:08:59Z`; the host is Brisbane, UTC+10).
- [MEASURED] **`vm-git-guard.sh` COULD NOT BE INSTALLED — third consecutive station, same cause.**
  Installer's last line, quoted per contract: `bash failed on resume, create, and re-resume …
  source path … is under Plan9 share "c" which is not mounted … A Windows update released
  September 8 prevents Claude's workspace from reaching your files.` A **FINDING, not a STOP** (F6).
  No VM-side `git` was run against the mount — there was no mount to run it against.
- [MEASURED] `bring-up-to-speed.ps1` captured to a FILE (it returns early and hides its own section 7
  verdict). Section 0 instrument controls both PASS. **Section 7: `SAFE TO ACT: no board mutation in
  progress, no recent remote activity, no live station worktrees.`** Section 5: **no `[STALE]`
  escalation rows** — the three `[STALE]` string hits in the capture are the legend and the
  read-checklist, not rows. The 09-10 backlog of eleven dead PR-scoped escalations stays cleared.
- [MEASURED] **Board, live.** `gh pr list --state open` → **2**: `#1923` CLEAN (CI 15 pass / 0 fail /
  0 pending), `#1920` BLOCKED (13 pass / 2 fail) carrying `do-not-merge`. **0 DIRTY.** `armed` = **0**.
  `needs-marco/` 55 · `no-pr-opened/` 109 · `failed/` 49 · `blocked/` 135.
- [MEASURED] **RULE 2 binds on BOTH open PRs — re-measured live this run, not quoted from 03.** Probe
  pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`, prompt logs only
  (`pr-*.log`, `rev-*` excluded), newest log `2026-09-14T22:30:38Z` — younger than both PRs, which is
  the control that separates this directory from the 2026-08-17 clone decoy:

  | | hits | verdict line |
  |---|---|---|
  | `PR #1923` | **2** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` |
  | `PR #1920` | **2** | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |
  | `PR #999412` — NEGATIVE control | **0** | — |

  POSITIVE control that the probe finds verdicts at all: `marco.:true` (regex, `.` matching the quote
  — the `-SimpleMatch` form returns 0 on BOTH questions) returns real rows. NEGATIVE control, a
  needle minted for this run, over the same corpus → **0**.
  🔴 **`#1923` is CLEAN, fully green, and carries NO label — and it is still Marco's.** Removing or
  lacking `do-not-merge` does not clear RULE 2. **Zero merges were available to me this run.**
- [MEASURED] **Trunk red, re-derived from source.** `gh run list --commit
  8c6bffc3a17563dc5bb5db334f4256be882445cb` (full 40-char SHA — the short form answers `[]` at exit 0):
  `Push on main/success` · `CI/success` · `Deploy/success` · `Claude Code/skipped` ·
  **`Tendering Browser Smoke` FAILURE**, run `34904096022`. The sweep's `TRUNK IS RED` is correct.
- [MEASURED] **Watcher healthy.** Sweep section 2: node **pid 30976** RUNNING, auto-restart wrapper
  alive (1), heartbeat 40 min (ticks only mid-run; stale + `armed=0` is **idle, not wedged**).
  `index.lock` absent in both trees; git processes touching our trees = **0**.
- [MEASURED] **Freshness CLEAN, and crossed against `lastRunAt` — the breadcrumb alone cannot name a
  cause.** `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 3 checked, 0
  malformed`, `CLEAN`, **exit 0**; `00` 0.6 h · `03` 0.2 h · `04` 1.0 h · `05` 9.0 h, all `ok`.
  `list_scheduled_tasks` cross-check: `00` `lastRunAt 23:08:30Z` (this run) · `03` `23:01:23Z` ·
  `04` `22:10:09Z` · `05` `14:11:11Z`, every one aligned with its newest breadcrumb and every station
  `enabled`. **No station is SILENT and none is masking a 529-consumed cadence.**
- [MEASURED] **Two breadcrumbs uncollected since my 22:35Z run**, both UNTRACKED, both confirmed
  absent from the TRACKED SET by basename (`git ls-files docs/pr-prompts`, not a dev-tree
  `git status` — that is the duplication trap): `00-04-scanner-…-2211-…` and
  `00-03-machine-minder-…-2301-…`. Both are committed by this run's PR.
- [CANNOT MEASURE] Whether the `user_dashboards` collision is ordering-dependent inside the suite or a
  defect in the dashboard-create path. The re-run I fired is the one call that discriminates, and it
  was still `in_progress` when this report was written — see F1.

## WHAT CHANGED

1. **Re-ran the failing main job.** `gh run rerun 34904096022 --failed -R GH-Mantova/ProjectOperations`,
   exit **0**. Read back, not assumed: `gh run list --commit <full SHA>` now shows
   `Tendering Browser Smoke` `status: in_progress`, `conclusion: ""`, the other four unchanged. The
   commit is current `origin/main`, so this is not the superseded-commit case that returns `cancelled`.
2. **Wrote one escalation** at `docs/pr-prompts/needs-marco/two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md`
   (F3). That folder is gitignored, so it reaches nobody on its own — which is why it is named here.
3. **This board PR**, carrying the two collected breadcrumbs, `docs/pipeline/sweep-rotation.json`
   (advanced by Station 04 and left deliberately dirty for me), the two untracked `-LOOPING.md`
   retirement receipts under `superseded/`, and this breadcrumb — written **inside the PR worktree**,
   which is cure 1 and leaves no loose copy in the dev tree.

**No merge. No arm. No label touched. No watcher restart. No lock cleared. No worktree pruned. No
branch deleted. Nothing in `/sot/`.**

## FINDINGS

### F1 — The trunk red is a named unique-constraint collision, not a mystery, and I fired the one call that classifies it

Station 03 did the diagnosis I would otherwise have spent this run on: run `34904096022`, job
`tendering-e2e` `104176643946`, **4 failed / 162 passed**, all four dashboard assertions, with three
Postgres `duplicate key value violates unique constraint "user_dashboards_user_id_slug_is_system_key"`
errors in the same log against `@@unique([userId, slug, isSystem])` in `schema.prisma`. The red commit
`8c6bffc3` is `#1940`, a **docs-only** collect breadcrumb, and the seven main smokes before it were
green. No commit since the clone's HEAD touches dashboard code.

03 handed me one decision and I took it: **re-run the job first.** It is one call, it is squarely a
board action in my lane, and it discriminates in a way no amount of reading does — green implies
ordering-dependent/non-deterministic, red again implies a real defect in the create path with a named
constraint to aim at. Writing a `fixes_pr` prompt before that answer would be a fix applied without a
proven cause, which DOCTRINE section 8.1 calls a second bug.

⚠️ **The prior two collects (`#1939`, `#1940`) called the same signature "non-deterministic" on `#1920`
and cleared it on a re-run. This is the third occurrence and the first on `main`.** If this re-run goes
green, "flake" is no longer an adequate disposition — three occurrences is a pattern, and the *next*
run should stage the permanent fix rather than re-run a fourth time.

**ACTIONED** — re-run fired and read back `in_progress`. ⚠️ **The verification is INCOMPLETE inside
this run**: I did not see the conclusion. The next 00 run must read
`gh run view 34904096022 --json status,conclusion` **first**, before anything else, and dispose of it:
green implies stage a `fixes_pr` prompt naming the collision (do not re-run a fourth time); red implies
it is a real main defect and the board is blocked behind it.

### F2 — A clean, green, unlabelled PR is still Marco's, and this is the fourth consecutive run to have to say so

`#1923` is `CLEAN`, `isDraft: false`, `labels: []`, CI 15/0/0. Every visible signal says merge it. The
watcher's own verdict says `{"ok":false,"marco":true}`. **RULE 2 is not cleared by green, by CLEAN, by
an empty label array, or by my own reading of the diff** — only by Marco, in chat, for that batch.

I record it as a finding rather than a fact because the shape is a standing hazard: the more thoroughly
the board is driven green, the more a Marco-routed PR looks like an oversight. `#1920` is the easy case
(it carries the label and CP-26 correctly reports `[LABEL_PRESENT]`, which is **parked by design, not
work**). `#1923` is the dangerous one.

**DEFERRED** — there is nothing to do but not merge it, which I did. What would make it urgent: a run
merging a `marco:true` PR on the strength of an absent label. The standing escalation
`needs-marco/rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md` already holds
the general question and does not need a fourth copy.

### F3 — Two orphaned worktrees read `dirty=0` — "safe to prune" — while holding eighteen commits that exist nowhere else

Station 03's F3, dispositioned here. `status-sweep.ps1` warns on **dirty files** and therefore singles
out only `po-vg`. Measured: `C:/po-fix1891` (detached `1dc31858`) is `dirty=0` and **14** commits ahead
of `origin/main`; `C:/PR-Master/worktrees/pr1823` is `dirty=0` and **4** ahead. `git worktree remove`
on either destroys the tip and the reflog in one command.

A prune is irreversible (DOCTRINE section 5.4) and therefore not mine. RULE 1 says the
complete-and-additive move is **push the branches (or `format-patch` the commits into the repo) before
anything is removed** — nothing is lost, the registry is freed, and it generalises to every future orphan.

**ESCALATED** — written to
`needs-marco/two-orphaned-worktrees-hold-eighteen-unpushed-commits-2026-09-14.md` with the three
options RULE-1 ordered and a falsifying probe. `po-vg` is deliberately excluded; it already has its own
file, ten days old.

### F4 — Station 04's remote-head finding is already escalated three times over, and that duplication is the actual finding

04's F4 asks Marco to turn on auto-delete-head-branches and to decide about ten dead remote heads. I did
**not** write a fourth escalation, because three already exist and say the same thing:
`remote-branches-outlive-their-prs-2026-09-05.md`, `stale-remote-heads-and-auto-delete-2026-09-08.md`,
`stale-remote-heads-need-auto-delete-on-merge-2026-09-10.md`.

Three files, one question, five to nine days old, none answered. The cause is not indiscipline: it is
that `needs-marco/` is **gitignored**, so no station can cheaply ask "has this been raised?" and the
honest default is to raise it again. That is the same root as `#1935` ("181 escalations live only in the
watcher clone where no instrument can see them").

⚠️ **Two classes of the ten heads are load-bearing as evidence and must not be deleted**: the four
`*verdict-home-resolver*` heads are DOCTRINE section 9.5's own falsifying probe, and `#1612`'s branch is
on record as possibly holding the only copy of its work. 04 got this right and it is worth carrying forward.

**DEFERRED** — already escalated; do not re-raise. What would make it urgent: Marco answering any one of
the three, at which point the other two must be moved to `discharged/` in the same act.

### F5 — Two prompt-retirement receipts and one sweep-rotation advance existed only on this disk

04's F5, dispositioned here. `superseded/pr-fix-1891-scope-cards-literal-fallbacks-trip-the-ratchet-c-LOOPING.md`
and `superseded/pr-scopecards-s0-plan-b-LOOPING.md` are untracked in a **tracked** directory — each is the
receipt for a build loop that was stopped, and neither was visible to a clone, to CI, or to any station not
standing on this machine. `docs/pipeline/sweep-rotation.json` is the file 04 is instructed to advance and
leave dirty for me.

**ACTIONED** — all three are in this run's PR. 04 also asks whether `.queue-sync-ledger.txt` (mtime
2026-08-19) and `queue-watch-state.md` (mtime 2026-08-31) should be tracked or gitignored. **DEFERRED**
on those two: it is a real question — the sweep's section 4C quotes `queue-watch-state.md` as the
*"freshest station summary"* while it is three weeks old — but it is a `.gitignore` change with a blast
radius across every station's file census, and it is not work for a collect run with a red trunk. What
would make it urgent: a run acting on that stale summary as though it were current.

### F6 — The workspace VM has been unreachable for three consecutive stations, so every blind run has lost one of its two read transports

`vm-git-guard.sh` could not be installed by 04 (22:0xZ), 03 (23:0xZ) or me (23:0xZ), all three quoting the
same September 8 Windows update. The guard's own hazard is absent for the same reason the guard is — no
mount, no VM-side `git`. The cost lands on **blind** runs: `STATION-CAPABILITIES.md` section 3 tells a
blind run that the mount carries the whole of COLLECT, and that transport has been gone since at least 09-08.

**DEFERRED** — already escalated twice (`cowork-vm-mount-unreachable-two-stations-2026-09-10.md`,
`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`), both naming the same cause, which sits
on Marco's machine and outside this repo entirely. No station can fix it and no prompt can be written for
it. What would make it urgent: **the mount returning while the guard is still uninstalled**, which restores
the `index.lock` hazard without the protection.

### F7 — The `tests-docs` lane is starved: no gate-satisfied HOLD is eligible, so every arm available tonight lands on Marco

04 measured 37 tracked `-HOLD.md` at depth 1, `spent=0`, `gates-satisfied=4`, `still-gated=33`, and
annotated two of the four ADMITs as **possible duplicates of the two open PRs**
(`pr-ea-s2a-dashboard-preset-seed-HOLD.md` against `#1920`,
`pr-ratescol-s0-column-api-hygiene-HOLD.md` against `#1923`).

**I armed nothing, and that is the finding rather than an omission.** Arming a duplicate of an open PR is
the `#1483` trap verbatim — the HOLD stays tracked on `main`, its premise still passes, and the arm opens a
second PR for work already in flight. The other two ADMITs would classify outside `tests|docs` and route to
Marco, who already has two PRs waiting. With the trunk red, adding a third Marco-routed PR is negative work.

**DEFERRED** — re-assess after F1's re-run lands and after `#1920`/`#1923` move. What would make arming
right: trunk green, and a gate-satisfied HOLD that `classifyPolicyFiles` accepts into the `tests-docs` lane.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry live `marco:true` verdicts, re-measured this run with
  POSITIVE and NEGATIVE controls. `#1923`'s green, clean, unlabelled state does not clear RULE 2.
- **Did not remove or touch `#1920`'s `do-not-merge` label.** Only Marco removes it; CP-26's
  `[LABEL_PRESENT]` is parked by design and is not a red to chase.
- **Did not arm any prompt** — see F7. `armed` was 0 at the start of this run and 0 at the end.
- **Did not prune, force-prune or delete any worktree or branch**, including the two whose PRs are merged.
  Irreversible, and one class of them is a live falsifying probe.
- **Did not `git stash drop`** in the watcher clone (72 stashes). The clone is Station 03's lane and the
  renormalize cure belongs to 03, who already holds 04's F1 dispatch.
- **Did not restart the watcher.** pid 30976 alive, wrapper alive, rescan `ts` fresh, `armed=0`. 03
  measured the clone 20 behind and none of the 20 touches `scripts/pr-watcher/**`, so a restart would adopt
  nothing and cost an idle window.
- **Did not stage a `fixes_pr` prompt for the trunk red.** The class of the failure is `[CANNOT MEASURE]`
  until the re-run concludes; staging one now would be a fix without a proven cause (section 8.1).
- **Did not write a fourth remote-heads escalation** — see F4.
- **Did not touch `/sot/`.** Station 05's, CP-24.
- **Did not touch Azure, Entra or SharePoint** in any form. Absolute.
- **Did not run `git` through the device bridge against the Windows `.git`.** Every `git` and `gh` call in
  this run was PowerShell on the Windows host through Desktop Commander, in the dev tree or a disposable
  worktree — never in `C:\po-watcher\ProjectOperations`.
- **Did not read `DOCTRINE.md` section 9.5's tail, sections 10.2–10.6, or `STATION-CAPABILITIES.md` in
  full** — disclosed in GROUND rather than left for a reader to assume otherwise.
