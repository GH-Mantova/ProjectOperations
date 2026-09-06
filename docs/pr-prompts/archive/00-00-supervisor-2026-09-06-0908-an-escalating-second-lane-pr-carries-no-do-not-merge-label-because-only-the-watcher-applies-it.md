# Station 00 — Supervisor | 2026-09-06T09:08Z–2026-09-06T09:30Z

## GROUND

```
UTC            2026-09-06T09:08:59Z
origin/main    163876d8            (fetched, then rev-parse)
dev tree       main @ 6ca27999      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED.** Desktop Commander reached the box on the first call
(`ALIVE 02026-09-06T19:08:28+10:00`). All three binding documents were read in full from the dev
tree, and `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, so the working
copies I read are byte-identical to `origin/main` (PREFLIGHT step 2, sound form — no piped hash).

## WHAT I MEASURED

**Sweep.** `status-sweep.ps1` captured to a file through `cmd /c` (so PowerShell's UTF-16LE `>` never
runs) — 46 505 B, exit 0. §0 controls both PASS. §7 verdict: **`SAFE TO ACT`** — no board mutation in
progress, no `index.lock` in either tree, 0 git processes, no PR touched in the last 2 min. [MEASURED]

**Board — 2 open PRs, ZERO failures between them.** [MEASURED] `gh pr checks`:

| PR | lane | files | checks | state |
|---|---|---|---|---|
| **#1699** `fix(rates)` unit-less VALUE columns | **second lane** (no watcher log) | migration + seed + CP-08 spec | 14 pass / 0 fail / 1 pending (`tendering-e2e`) | BLOCKED |
| **#1700** `feat(jr-s1)` JobRolesPage NoAccess | watcher, from an armed prompt | `apps/web/…/JobRolesPage.tsx` + its test | 11 pass / 0 fail / 4 pending | BLOCKED |

Both are BLOCKED on **pending required checks only**. Neither has a red. Neither is mine to merge —
see FINDINGS.

**RULE 2 probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`, matched
on `PR #<n>` in the BODY of `pr-*.log` only (`rev-*` excluded — DOCTRINE §9.5): [MEASURED]

- POSITIVE control `marco.:true` over `processed\*.log` → **617**;
- newest processed log `2026-09-06T09:02:59Z` — **6 minutes old**, younger than the oldest open PR
  (#1699, opened 08:44:40Z), which is the control that separates the live tree from the 17-day-stale
  decoy in the watcher clone;
- NEGATIVE control `PR #999999` → **0**;
- **#1700 → 2 hits**, including
  `[watcher] merge result for PR #1700: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/admin/JobRolesPage.tsx"}`;
- **#1699 → 0 hits.**

**Freshness, crossed against `lastRunAt` (three instruments, all agreeing).** [MEASURED]
`node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0, all stations `ok`.
Scheduled-tasks MCP `lastRunAt`: 00 `09:08:13Z` (this run) · 03 `2026-09-05T23:01:01Z` · 04
`06:09:51Z` · 05 `2026-09-05T14:10:49Z`. Every one aligns with that station's newest breadcrumb to
the minute. **No station is SILENT and none is a false `ok`.**

**Machinery.** watcher node RUNNING pid **17944**, auto-restart wrapper alive (3), heartbeat **7 min**
on an **empty queue** — idle, not wedged (the heartbeat ticks only mid-run). `armed (*-ready.md): 0`
on arrival. Watcher clone `branch=main dirty=3`. [MEASURED, sweep §2]

**Queue.** 72 `-HOLD.md` at depth 1. `triage-holds.ps1` (read-only, both controls PASS —
GIT control read 96 497 chars of DOCTRINE from `origin/main`, SPENT control emitted exit 3 on the
fixture): **spent=0 · gates-satisfied=34 · still-gated=38 · unreadable=0**. [MEASURED]

**Arming log is a strict superset of `origin/main`, and it was on arrival.**
`git diff --numstat origin/main -- docs/pr-prompts/.arming-log.txt` → `1  0` — **insertions, zero
deletions**, which is exactly the discriminator the 08:2xZ run landed in this station's doc
(`#1697`). The one local-only line is
`2026-09-06T08:22:53Z ARMED pr-jobroles-s1-… actor=marco-delegated pid=5564`. **A `git show HEAD:` restore
would have destroyed it and every prescribed read-back would still have passed.** I did not restore;
I am landing the file instead, which removes the trap rather than surviving it. [MEASURED]

## WHAT CHANGED

**1. `do-not-merge` applied to #1699.** `gh pr edit 1699 --add-label do-not-merge`. Read back:
`gh pr view 1699 --json labels --jq '.labels[].name'` → `do-not-merge`. NEGATIVE control, the same
query against #1700 → **empty**, so the reading is not a broken query in either direction. This is
**adding** a gate, never removing one; only Marco may take it off.

**2. Armed ONE prompt — `pr-watcher-verdict-home-resolver`.** Via `arm-prompt.ps1` (the primitive,
never a bare `git mv`), `-Actor station-00-scheduled-0908Z`. Read back:
`-ready.md` present **True** · `-HOLD.md` **False** · arming log **8122 → 8295 B** with
`2026-09-06T09:20:50Z ARMED pr-watcher-verdict-home-resolver … pid=24508` as its last line ·
`git diff --cached --name-status` **EMPTY** after the script's own index release. [MEASURED]

*Why this one, of 34 ADMIT candidates.* It is the fix for the S1 that Station 03 measured on
2026-09-05 and DISPATCHED to 00, and that now sits in DOCTRINE §9.5: the watcher resolves a review
verdict at one hard-coded path in the clone, while 9 of 12 verdicts that day were written to the dev
tree and a 10th was archived 16 s before the mirror looked for it — 68 `verdict mirror skipped` lines
against a positive control of 262 `verdict mirrored to PR`. Because `verdictApproves` reads the same
single path, a produced verdict that lands in another home cannot release the `tests-docs` lane, and
the PR times out into a `marco:true` that RULE 2 then correctly forbids anyone from clearing. **It is
the lane that exists to remove work from Marco, silently creating it.** RULE 1: the prompt is the
complete-and-additive option — one pure resolver searching all three homes, clone first, newest wins;
it can only turn a MISS into a HIT, never the reverse; no schema, no migration, no policy change,
`git revert` restores today's behaviour exactly.

*The checks I ran before arming.* `lint-prompt.mjs` **ADMIT** (necessary, not sufficient) · the RULE 4
marker union grepped over the prompt → **0 hits**, with the POSITIVE control on
`pr-524-rates-b-slice2-canonical-HOLD.md` returning **3** (`DO NOT ARM YET`, `## Arm ONLY when…`,
`DO NOT arm`), so the instrument answers in both directions · **the whole body read**, because a
prose gate matches neither regex — there is none, only the boilerplate `## STANDING AUTHORITY` ·
§10.6 `scope:` cross-check against the file lists of **both** open PRs: the prompt's scope is
`scripts/pr-watcher/index.mjs` + `scripts/pr-watcher/__tests__/verdict-home-resolver.test.mjs`, and
the overlap with #1699 (`apps/api/**`) and #1700 (`apps/web/**`) is **zero**.

**3. This PR** — the three consumed/armed `-HOLD.md` deletions, the arming log carrying **both**
un-landed lines, and this breadcrumb, written inside the run's own PR worktree (cure 1) so no loose
untracked copy is left in the dev tree to block the next fast-forward.

## FINDINGS

### F1 [S2] An `escalates: true` PR reached the board with no `do-not-merge` label, because only the watcher applies it

**#1699** was built from `docs/pr-prompts/pr-rates-value-column-units-HOLD.md` — a prompt whose front
matter is `escalates: true` — by a **Claude Code session**, not the watcher: its body carries a
`claude.ai/code/session_…` link, the prompt was **never armed** (absent from `.arming-log.txt`), and
the RULE 2 probe returns `NO LOG` for it while returning a real verdict for #1700 in the same query.
Hand-classified under §10.1 step 2: its diff contains
`apps/api/prisma/migrations/20260906120000_rates_value_columns_require_unit/migration.sql`, so
`classifyPolicyFiles` refuses it on the `(^|/)migrations/` clause — **`[NO LANE VERDICT — hand-classified
→ MARCO'S]`**. Its own body agrees: *"This writes to the production database on merge … Marco merges
this."*

The gap is mechanical. `escalates: true` is enforced in exactly one place — the watcher labels the PR
**it** opens (DOCTRINE §8.3a rule 3). A second lane never runs that step, so the flag silently
becomes advisory prose. For ~35 minutes an unlabelled production-migration PR sat on a board whose
supervisor is instructed to drive every open PR to merge. Nothing red would have appeared.

**DISPOSITION: ACTIONED.** Label added and read back with a negative control (WHAT CHANGED 1). The PR
is now protected by the same gate the watcher would have given it, and only Marco can lift it.

### F2 [S2] The general defect behind F1 has no gate, and the next instance will look identical

F1 is fixed for #1699 by hand. The mechanism is not: any lane that builds a prompt without going
through `index.mjs` produces an unlabelled PR from an escalating prompt, and no CI check notices. The
complete-and-additive fix is a gate, not a habit — a PR whose body names a prompt file carrying
`escalates: true` must carry `do-not-merge`, failed loudly at `pr-gates.mjs` (a **new** CP, never
folded into an existing assertion: CP-26 failing already takes `PR gates — diff checks` down with it,
and one cause producing two reds is how a red gets misread).

**DISPOSITION: DISPATCHED → Station 06 (PR Master).** Stage
`pr-gate-escalates-prompt-needs-label-HOLD.md`. The premise evidence is measured and in this
breadcrumb: #1699, opened 08:44:40Z, built from an `escalates: true` prompt, `labels: []` at 09:1xZ.
06 stages; 00 arms. I did not stage it myself because staging is 06's lane and this run had already
spent its one arm.

### F3 [S3] §10.6, live: `pr-rates-value-column-units-HOLD.md` is ADMIT while #1699 is open for exactly that work

The prompt is still on disk (`Test-Path` → **True**) and appears in this run's
`GATES SATISFIED — CANDIDATES` bucket of 34. Its premise dies on **merge**, not on open, so for as
long as #1699 waits on Marco the prompt reads as fresh work and arming it would open a second PR for
an open one. This is the §10.6 shape reached from the second-lane side, and it is why the `scope:`
cross-check ran before this run's arm.

**DISPOSITION: DEFERRED.** It becomes urgent the moment anyone arms it. Re-check after #1699 merges:
if `lint-prompt.mjs` still returns ADMIT rather than exit 3, retire it to `docs/pr-prompts/superseded/`
in a board PR. **Do not arm it before then.**

### F4 [S3] Both open PRs are Marco's, for two different and independently binding reasons

- **#1700** carries a genuine watcher routing verdict —
  `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/pages/admin/JobRolesPage.tsx"}`
  — read from the live tree with POS 617 / NEG 0 and a 6-minute-old newest log. **RULE 2 binds
  absolutely**: not overridden by green, by the absence of a label, or by the routing reason being
  obviously correct. Cleared only by Marco, in chat, for that batch.
- **#1699** is a production-database write on merge (DOCTRINE §5 hard stop 2) and now carries
  `do-not-merge`.

Both are green but for pending required checks; there is nothing to fix on either.

**DISPOSITION: ESCALATED** — the question for Marco is in the chat report, with what each PR needs
and the one open product decision #1699's own body raises (`other-rates` / `Rate` has no single
correct unit, and its table's column add/edit is refused in production today).

### F5 [S3] `C:\po-vg` still holds one uncommitted file, now 49 hours old

Sweep §2: `orphaned worktree C:/po-vg 23c91ba9 [fix/no-rebase-while-checks-run] dirty=1 age=2956 min`,
flagged **HOLDS UNCOMMITTED WORK — `git worktree remove` will refuse and `--force` would discard it.**
Unchanged since it was first reported; `git worktree list` confirms it is still registered.

**DISPOSITION: DISPATCHED → Station 03.** Local trees and worktrees are 03's lane. List the file
first (`git -C C:/po-vg status --porcelain`), preserve or commit it, then prune. Nothing here is
Station 00's to delete.

### F6 [carried forward, not re-derived] The 0808 run's dispatch to 03 is still unread

My previous run DISPATCHED to 03 the **42 untracked `docs/pr-reviews/pr-<N>-review.md`** in the dev
tree (#1535–#1691) — the dev-tree half of the three-homes mirror defect, and evidence a reviewer
cannot re-open. 03 last ran `2026-09-05T23:01:01Z`, **before** that breadcrumb was written, and next
runs `2026-09-06T23:00:45Z`. It is not late and it is not lost.

**DISPOSITION: DEFERRED** — restated here so it is visible in the current cycle, which is also why the
0808 breadcrumb is **not** archived this run.

## WHAT I DID NOT DO

- **Did not merge anything.** #1700 is RULE 2 (`marco:true`); #1699 is a production-data hard stop.
  Zero merges this run, deliberately.
- **Did not remove any label**, and did not touch #1700's (empty) label set — over-routing a PR that
  RULE 2 already binds would add a step for Marco without adding a gate.
- **Did not arm a second prompt.** RULE 4 is one at a time, and a second actor (`actor=marco-delegated`,
  pid 5564) armed on this board 58 minutes ago — the `actor=` field is the only reason that is
  visible at all.
- **Did not arm** `pr-rates-value-column-units-HOLD.md` (F3) · `pr-vmguard-s2-preflight-installs-guard-HOLD.md`
  (docs-only, so it would ride the `tests-docs` auto-merge lane with **no human** while rewriting the
  `station-contract` canonical block in all seven station docs — that is the open
  `needs-marco/tests-docs-lane-can-auto-merge-the-station-contracts-2026-09-05.md`) ·
  `pr-tr-s1-reminder-policy-HOLD.md` (schema migration, Marco's) ·
  `pr-verdict-anchor-heading-form-HOLD.md` (staged, not armed, by standing decision) ·
  `pr-watcher-app-auth-switch-on-HOLD.md` (production auth).
- **Did not restart or touch the watcher.** RUNNING pid 17944, wrapper alive, heartbeat 7 min against
  an **empty** queue — idle is the correct state for 0 armed prompts, and "cannot verify" was never
  in question this run. No `-Fix`, no ENSURE-UP relaunch: the wrapper probe returned present.
- **Did not run `git` in the watcher clone**, did not touch `/sot/`, Azure/Entra/SharePoint, or
  production data, and did not `git checkout`/`reset`/`clean` anywhere in the dev tree.
- **Did not restore `.arming-log.txt` to HEAD** — the `1 0` insertions-with-zero-deletions shape says
  the working copy is a strict superset, so restoring would have been a silent deletion of another
  actor's audit line.
- **Did not archive** the 0808 breadcrumb (F6), and did not touch the 29 `needs-marco/` files the
  sweep tags `[STALE]` — discharging those is already dispatched and is not this run's to redo.
