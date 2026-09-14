# Station 00 — Supervisor | 2026-09-14T15:09Z–2026-09-14T15:4xZ

## GROUND

```
UTC            2026-09-14T15:09:01Z
origin/main    5fca4305            (fetched first, then rev-parse)
dev tree       main @ 5fca4305      C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (1 = 1) — this run was not restricted to read-only.

SIGHTED run. `start_process` shell `powershell.exe` returned PID 19392 at 15:09Z on the first call,
after a keyword `ToolSearch` for `desktop-commander`. The schemas arrive deferred; a cold call is an
unloaded schema, not blindness.

Binding documents read this run: `docs/pipeline/stations/00-supervisor.md` (1318 lines, in full).
[MEASURED] `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, which per §9.2 is the
real answer that the working copy IS `origin/main` for all three. No piped hash was taken and none is
quoted (§9.1 — the piped form is unsound in `powershell.exe`).
⚠️ **[CANNOT MEASURE] in part:** DOCTRINE and STATION-CAPABILITIES were **not** re-read line-by-line
this run; their clauses were applied from the standing index. The numstat above proves only that the
working copy matches `origin/main`, not that I read them. Saying so is cheaper than implying I did.

## WHAT I MEASURED

**Device-bridge git guard — [CANNOT MEASURE], same outage, now its second week.** PREFLIGHT step 1
requires `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` and its last line
quoted pass or fail. It could not run. Quoted verbatim:

```
bash failed on resume, create, and re-resume. resume: RPC error -1: failed to mount
/mnt/.virtiofs-root/shared/c/... is under Plan9 share "c" which is not mounted;
create: RPC error -1: ensure user: user sharp-trusting-johnson already exists unexpectedly
(attempt 1 of 5 since last success)
A Windows update released September 8 prevents Claude's workspace from reaching your files.
```

A failed install is a FINDING, not a STOP (station-contract v3). No hazard was created: the guard
exists to stop VM-side `git` against the mount, and with no VM no such call was possible. See F1.

**Status entry point.** `scripts/pipeline/bring-up-to-speed.ps1`, exit 0, self-stamped
`SWEEP COMPLETE 2026-09-14 15:09:32Z`. [LIVE] lines only:

- **OPEN PRs 3** — `#1932` CLEAN, CI 10/0/0 green · `#1923` CLEAN, CI 15/0/0 green ·
  `#1920` BLOCKED, CI 13 pass / **2 fail**.
- main CI on `5fca4305`: 4 success / 0 failed (trunk green).
- watcher node RUNNING pid 30976; auto-restart wrapper alive (1); heartbeat 41 min
  (stale + empty queue = idle, NOT wedged).
- watcher clone `branch=main dirty=3` — NOT clean-on-main.
- three non-main worktrees, all orphaned: `C:/po-fix1891` (dirty=0, 834 min) ·
  `C:/PR-Master/worktrees/po-vg` (**dirty=1, 14836 min ≈ 10.3 days — HOLDS UNCOMMITTED WORK**) ·
  `C:/PR-Master/worktrees/pr1823` (dirty=0, 6778 min).
- queue: **armed 0** · needs-marco 53 · no-pr-opened 109 · failed 49 · blocked 135.

**Section 5 carried ZERO `[STALE]` rows this run.** Every row was `[FILE] … section 5 CANNOT decide`.
So the COLLECT duty to clear PR-scoped `[STALE]` escalations had **nothing to clear** — and that is a
measurement, not an omission. Nothing was moved to `needs-marco/discharged/`.

**Safe-to-act gate, re-measured immediately before the only mutation of this run (§7 — `[LIVE]` means
"true when measured"):** `index.lock` interactive/clone = `False / False`; `git` processes touching
our trees = **0**; armed = **0**; no PR touched on GitHub in the last 2 min. Condition 3 satisfied.

### RULE 2 — the probe, its controls, and the answer for all three PRs

Probe tree pinned to the LIVE one, `C:\ProjectOperations2\docs\pr-prompts\processed`:
**2219 logs, newest `2026-09-14 14:28:48`** (the decoy at `C:\po-watcher\...` is stale since
2026-08-17 and would clear every PR since — the discriminator is log AGE, not POS>0).

```
POS control  Select-String -Pattern 'marco.:true'      -> 666
NEG control  Select-String -Pattern 'zzqNeedle915Zz'   ->   0      (fresh needle, minted this run)
```

Written without a quote character, per the standing rule — the `-SimpleMatch` form returns 0 **and**
its negative control returns 0, two opposite questions with identical answers. Matched on `PR #<n>`
in the log **body**, never the filename.

| PR | watcher verdict | evidence |
|---|---|---|
| `#1923` | **`marco:true`** | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` |
| `#1920` | **`marco:true`** | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |
| `#1932` | **NO LANE VERDICT** | no `merge result for PR #1932` line exists (POS control: the identical probe returns 1 for `#1923`) |

**`#1932` is a SECOND LANE PR, and the discriminator was run rather than assumed.** `NO LOG` has
three causes — second lane; a watcher PR whose verdict was never written; or a watcher PR still
inside its `policy=tests-docs, waiting…` window. The third is settled by a **different instrument**,
the launch log's own `opened PR #<n>` line:

```
[2026-09-14T06:24:44Z] [merge] pr-ea-s2a-…-ready.md: opened PR #1920, policy=tests-docs, waiting…
[2026-09-14T08:29:12Z] [merge] pr-ratescol-s0-…-ready.md: opened PR #1923, policy=tests-docs, waiting…
                        <- no such line for #1932 anywhere in C:\po-watcher\watcher-launch.log
```

Two POSITIVE controls present, the subject absent ⇒ the watcher never opened `#1932`. It is Station
05's own doc-reconcile PR, opened by 05's 14:11Z run. Hand-classified by `classifyPolicyFiles`:

```
docs/pipeline/stations/05-sot-keeper.md          ^(tests|docs)/   MATCH
docs/pr-prompts/00-05-sot-keeper-…-1411-….md     ^(tests|docs)/   MATCH
sot/04-data-model.md                             no form matches  -> MARCO'S
```

**`[NO LANE VERDICT — hand-classified] → MARCO'S.`** Not "not routed to Marco". `sot/` is outside all
three forms, so one file decides the whole PR.

**Therefore 0 of 3 open PRs is mine to merge.** Not one of them is blocked on anything I can do:
`#1923` is green and waiting on Marco, `#1932` is green and waiting on Marco, `#1920` is red on a
question only Marco can answer. See F4.

**`#1920`'s two reds, named rather than diagnosed from the PR page.** `gh pr checks 1920`:
`Approval receipt (CP-26)` fail 11s · `PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23)` fail
7s — **one cause, two reds**, the standing CP-26/`pr-gates.mjs` coupling. The review lane already
named the cause and escalated it: `rev-1920-ready.md.log` → *"Verdict: **BLOCK** on PR #1920. Root
issue: prompt EA-2a declares `seed_only: false` + `gate_allow: none`, which contradicts CP-23. Marco
must resolve whether this is dev-only (`SEED-ONLY: dev`), needs a real migration
(`gate_allow: migrations`), or a special ruling."* Escalation on file at
`docs/pr-prompts/needs-marco/pr-1920-review-block.md`. I did not re-diagnose it and I did not chase
the red — the red IS the escalation.

### Station freshness, crossed against `lastRunAt` — the breadcrumb alone cannot name the cause

`node scripts/pipeline/check-breadcrumb.mjs --freshness` → structure 3 checked, 0 malformed;
**exit 2**.

```
00  last 2026-09-14T14:10:00Z   1.0h ago  (cadence 2h)   ok
02  dispatch-only — no cadence to miss
03  last 2026-09-10T23:10:00Z  88.0h ago  (cadence 24h)  SILENT
04  last 2026-09-14T14:16:00Z   0.9h ago  (cadence 4h)   ok
05  last 2026-09-14T14:11:00Z   1.0h ago  (cadence 24h)  ok
```

Second instrument, `list_scheduled_tasks` (scheduled-tasks MCP), all five tasks:

| task | enabled | cron | lastRunAt | nextRunAt |
|---|---|---|---|---|
| `00-supervisor` | true | `5 * * * *` | 2026-09-14T15:08:26Z | 2026-09-14T16:07:52Z |
| `03-machine-minder` | **true** | `0 9 * * *` | **2026-09-10T23:01:10Z** | **2026-09-14T23:00:45Z** |
| `04-scanner` | true | `0 */4 * * *` | 2026-09-14T14:10:05Z | 2026-09-14T18:09:31Z |
| `05-sot-keeper` | true | `10 0 * * *` | 2026-09-14T14:11:11Z | 2026-09-15T14:10:37Z |
| `weekly-security-audit` | false | `30 7 * * 1` | 2026-09-06T21:32:44Z | — |

**03's `lastRunAt` is older than one cadence ⇒ row 1 of the freshness table: the occurrences never
fired, nothing ran.** This is NOT "it ran and did not report", and it is NOT a 529 (a 529 updates
`lastRunAt` anyway — that is the whole trap). 03 is **enabled**, and its three missed occurrences
(09-11, 09-12, 09-13, each at 23:01Z) all fall inside the scheduler hole my own 14:10Z run measured
and #1931 records. **Same outage, third station.** See F2. 03 is NOT a stopped station.

### COLLECT — breadcrumbs since my last run (14:10Z)

Asked the TRACKED set, not the dev tree, per the de-duplication rule:

- `00-04-scanner-2026-09-14-1416-gate-liveness-is-clean-and-the-session-clock-names-tomorrow.md` —
  **UNTRACKED**, reaches nobody until a board PR commits it. Read in full; three findings, two
  DISPATCHED to me. **This PR commits it.**
- `00-00-supervisor-2026-09-14-1410-…` and `00-04-scanner-2026-09-14-1010-…` are already tracked
  (landed in #1931 / #1926) — not re-collected, not re-committed.

**One new breadcrumb, three findings, all dispositioned below.**

### The dev tree held a deleted tracked prompt, and nothing on the board was going to restore it

[MEASURED] `git status --porcelain=v1` at 15:09Z reported
`" D docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md"` — deleted **in the worktree**,
unstaged (` D`, not `RD`: this is not the staged-`R100` shape the standing note warns about). The
prompt was armed, consumed, and its `-ready.md` removed; the `-HOLD.md` deletion was never staged
and never committed.

**And `#1923`'s own diff does not retire it.** `gh pr view 1923 --json files` returns exactly two
paths — `apps/api/src/modules/rates/rate-tables.service.ts` and
`apps/api/src/modules/rates/__tests__/rate-tables.service.spec.ts`. The prompt is not in them. So
`pr-ratescol-s0-column-api-hygiene-HOLD.md` remains **tracked on `origin/main`** while its work sits
in an open PR: the **stays-armable-forever defect**, live, with a fresh instance. See F3.

## WHAT CHANGED

**One mutation in the dev tree, and it was a restore, not a deletion.**

`docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md` restored from `HEAD` the §9.2-safe way —
`git show HEAD:<path>` piped to a node write, **5330 bytes** — never `git checkout -- <path>`, which
is one typo from `checkout -- <dir>` and resurrects consumed prompts. Read back: the path no longer
appears in `git status --porcelain=v1`.

**Why restore rather than commit the deletion.** Committing it would retire a prompt whose PR is
sitting on Marco and is not mine to move; if `#1923` is ever closed rather than merged, that work
would have no prompt. Restoring is the reversible half and it clears an FF landmine. The *decision*
to retire is dispatched, not taken — F3.

**This PR** carries three docs-only paths and nothing else:

- `docs/pr-prompts/00-04-scanner-2026-09-14-1416-….md` — 04's breadcrumb, swept up from the dev tree.
- `docs/pipeline/sweep-rotation.json` — 04 advanced it (`last_index=0
  last_run_utc=2026-09-14T14:16:50Z`) and may not commit to the shared dev tree, so it lands here.
  **If it does not land, the rotation silently stops and 04 repeats gate-liveness.**
- this breadcrumb, written **inside the PR worktree** (cure 1) so no loose dev-tree copy exists and
  the post-merge fast-forward cannot trip on it.

**Nothing else changed.** No prompt armed, disarmed, renamed, moved or staged (armed was 0 before and
0 after). **No PR merged. No label added or removed. `/sot/` untouched. The watcher clone untouched.
No worktree pruned. No process killed.**

## FINDINGS

### F1 — the mandatory guard install is unreachable, and the escalation for it already exists and just failed its own falsifying probe again

04's F1 dispatched two things to me: (a) decide whether `station-contract v3` should spell out a
*"workspace unreachable ⇒ `[CANNOT MEASURE]`, continue"* clause, and (b) author a `needs-marco/` file
because the subject — a Windows update on Marco's box — is outside the repo.

**(b) is already done and I did not duplicate it.** `docs/pr-prompts/needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`
was filed 2026-09-10T03:4xZ at `719fbf16`, names the same Plan9 `"c"` share, and carries this
falsifying probe: *"Next scheduled run of any station: if the guard returns an installer line rather
than an RPC mount error, this escalation is discharged."* **[MEASURED] it returned the RPC mount
error again at 15:09Z. The probe fired and failed. The escalation is LIVE and is now 4.5 days old**,
spanning at least four station runs (04 at 09-10T02:1xZ, 00 at 09-10T03:1xZ, 04 at 09-14T14:1xZ, 00
here). A 54th file saying the same thing would make 53 escalations harder to read, not easier.
⚠️ That file is under `needs-marco/`, which is **gitignored** — naming it here is the only way this
re-measurement reaches anybody.

**(a) is a seven-document change and I am deliberately not taking it in a collect run.** The clause
would sit inside `station-contract v3`, the cross-doc canonical block; editing it means the same edit
in all seven station docs plus `lint-station.mjs --write-canonical`, shipped together. My own doc
already says a canonical-block change is more than a collect run should carry. It is also arguably
already implied — the block says in terms *"a failed install is a FINDING, not a STOP"*, and both
stations that met it this week continued correctly.

**DEFERRED.** ⚠️ **What would make it urgent:** a station **stopping** on a failed guard install, or
the mount returning (at which point the clause is moot and the escalation discharges instead). The
cheap half — (b) — is already carried.

### F2 — 03 has missed three consecutive occurrences, the cause is the scheduler hole and not the station, and 03 is the only actor allowed to fix two things that are now rotting

[MEASURED] `03-machine-minder` is **enabled**, cron `0 9 * * *`, `lastRunAt` **2026-09-10T23:01:10Z**,
`nextRunAt` **2026-09-14T23:00:45Z**. `--freshness` reads `88.0h ago SILENT`, exit 2.

**`lastRunAt` older than one cadence is row 1 of the freshness table: the occurrence never fired.**
That distinguishes it from the 529 trap (which updates `lastRunAt` and prints `ok`) and from
"ran and did not report" (fresh `lastRunAt`, no breadcrumb). The three missed slots — 09-11, 09-12
and 09-13 at 23:01Z — sit inside the scheduler hole that #1931 records and that 04 and 05 both
recovered from at their first slot after it. **Three stations, one outage. 03 is not stopped, and
reporting it as a stopped station would be the §7 false alarm that licenses destructive action.**

**What it is costing, which is the part worth raising.** 03 is the ONLY actor permitted to
fast-forward the watcher clone, and the clone is [LIVE] `dirty=3`. 03 also owns worktree hygiene, and
`C:/PR-Master/worktrees/po-vg` has now held **1 uncommitted file for 14,836 minutes (10.3 days)** —
`git worktree remove` will refuse it and `--force` would discard the work. The standing four-ask
dispatch to 03 (unclean watcher death, the stash loop, the unfindable stash, UTC log naming) has sat
unread for 88 hours on top of that.

**DEFERRED — the recovery is already scheduled and is ~7.9 hours out.**
⚠️ **What would make it urgent, stated as a probe the next run can execute:** if `lastRunAt` for
`03-machine-minder` is still `2026-09-10T23:01:10Z` **after 2026-09-15T00:00Z**, the hole is not the
explanation, 03 has a defect of its own, and it escalates. Until then the honest reading is that the
scheduler lost it and the clock will return it.

### F3 — a consumed prompt is still tracked on main and its PR does not retire it, so it can be armed again tomorrow and open a duplicate

[MEASURED] `pr-ratescol-s0-column-api-hygiene-HOLD.md` is tracked on `origin/main` at `5fca4305`; its
work is in open PR `#1923`; `#1923`'s two-file diff does not touch it. Its premise still evaluates
against `origin/main` (where the change has not landed), so `lint-prompt.mjs` will say **ADMIT** and
arming it would open a second PR for work `#1923` already carries. This is the standing
stays-armable-forever defect with a new, named instance — the same shape as
`pr-ea-s2a-dashboard-preset-seed-HOLD.md` vs `#1920`, which 04 flagged in the same cycle.

I restored the dev-tree copy rather than committing its deletion (WHAT CHANGED). Retiring it is a
board decision on a PR that is Marco's, and taking it would pre-judge `#1923`.

🔴 **DO NOT ARM `pr-ratescol-s0-column-api-hygiene-HOLD.md` while `#1923` is open.**
🔴 **DO NOT ARM `pr-ea-s2a-dashboard-preset-seed-HOLD.md` while `#1920` is open** (04's F3).
Both die on their own the moment their PR merges, and `triage-holds.ps1` will then report them SPENT.

**DISPATCHED → Station 06 (PR Master)**, which owns prompt retirement, as the general defect: *an
armed prompt whose PR does not delete it stays armable forever.* Two live instances today out of 36
HOLDs. The complete-and-additive cure is the one already written down — **a prompt's `scope` must
name its own `-HOLD.md` so its own PR retires it** (#1924 landed exactly that rule this morning); it
needs applying to prompts authored before it.

### F4 — the tests-docs lane is starved to zero and every open PR on the board is Marco's

[MEASURED] 3 open PRs; **3 of 3 route to Marco** — two by watcher verdict (`marco:true`), one by
hand-classification with controls. armed = 0. 04 measured `gates-satisfied=3` out of 36 HOLDs, and
one of those three (`pr-ea-s2a`) is a duplicate of an open PR, so **2** are genuinely armable — and
neither is `tests/`-or-`docs/`-only, so arming either also lands on Marco.

**The board cannot move without Marco, and it is not stuck on a defect.** Every green PR is green;
trunk is green; the watcher is alive and correctly idle on an empty queue. This is the standing
"starved lane" condition, measured again: the automation's own throughput is bounded by how often
Marco looks at the board, and the number of things waiting for him is 3 PRs + 53 escalation files.

**ESCALATED.** ⚠️ Filed as a breadcrumb finding only — **no new `needs-marco/` file**, deliberately:
the specific asks already have theirs (`#1920` → `pr-1920-review-block.md`; the mount → the 09-10
file), and the general one is already on his list as
`rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`. Adding a 54th file to a
53-file queue is how this finding would disappear.

**The question for Marco, RULE 1 applied — complete-and-additive FIRST:**

**(a) Give the lane a second gate that is not "Marco looked".** `#1923` is `marco:true` solely
because one of its two files is `apps/api/**` — but it also ships its own `__tests__` spec, CI is
15/0/0 green, and a review job already ran on it. A rule of the form *"a PR whose non-test changes
are confined to one module AND which adds or updates tests for that module AND is green AND carries
a `rev-<n>` MERGE verdict may auto-merge"* would move PRs like `#1923` without ever touching the
irreversible class. **Complete:** it removes the bottleneck for the ordinary case rather than
widening it once. **Additive:** it only ever *adds* a path to merge; `classifyPolicyFiles` is
unchanged, every migration and every `sot/` and every `escalates:true` PR still stops dead, and no
existing or future data entry is touched. It also needs no change to RULE 2 itself.

**(b) Widen `classifyPolicyFiles` to include `sot/`-only PRs** so 05's doc-reconciles self-merge.
Fails the **future** half: `sot/` is the source-of-truth law, and the day an agent gets a `sot/` edit
wrong is the day nobody notices, because the thing that would have caught it is the review you just
removed.

**(c) Leave it.** Fails the **immediate** half: three green PRs are already waiting, and the count
only goes up.

**What only you can answer:** whether the `#1923` class — *green, tested, single-module, reviewed* —
is one you want moving without you, or whether the current bottleneck is the point.

## WHAT I DID NOT DO

- **Merged nothing, and did not enable auto-merge on anything.** All three open PRs route to Marco:
  `#1923` and `#1920` by live watcher verdict, `#1932` by hand-classification. RULE 2 is not cleared
  by green, by CLEAN, by an unlabelled PR, by a `rev-` MERGE verdict, or by my own diff reading.
  **`#1932` carries a `rev-1932` verdict of MERGE and I still did not merge it** — a review verdict
  is not a lane verdict.
- **Did not remove a `do-not-merge` label from anything**, and did not read `#1920`'s empty `labels`
  array as clearance. Marco removing a label does not clear RULE 2.
- **Did not author a `merge-approvals/<N>.md` or any approval receipt.** A scheduled run may never
  author one, regardless of the supervised-cloud-lane ruling.
- **Did not re-diagnose `#1920`'s red.** Both failures are named from `gh pr checks`; the cause is
  already on file as a Marco-only CP-23 ruling, and chasing a red whose fix is a human decision is
  wasted CI.
- **Armed nothing.** armed=0 before and after. Two of 04's three ADMIT candidates are do-not-arm
  today (F3); arming the third would land on Marco anyway (F4).
- **Did not touch the watcher clone** (`dirty=3`). Only 03 may fast-forward it; 00's ABSOLUTE forbids
  `git merge` there, and `nobody-may-fast-forward-the-watcher-clone-2026-09-07.md` is still open.
- **Did not prune the three orphaned worktrees**, and specifically did not go near
  `C:/PR-Master/worktrees/po-vg` — it holds 1 uncommitted file at 10.3 days and `--force` would
  discard it. Worktree hygiene is 03's.
- **Did not restart the watcher.** It is RUNNING (pid 30976) with a live wrapper and a 41-minute
  heartbeat on an **empty** queue — that is idle and correct, not WEDGED. An idle watcher with 0
  armed prompts is the right state, and `restart-watcher-if-wedged.ps1` was therefore not run with
  `-Fix`.
- **Did not clear any `needs-marco/` escalation.** Section 5 produced zero `[STALE]` rows this run, so
  there was nothing whose tag licensed a discharge, and I cleared none on a `[FILE] CANNOT decide`
  line.
- **Did not edit `station-contract v3`** (F1a) — seven documents and a hash re-record.
- **Did not touch `/sot/`** (05's), Azure / Entra / SharePoint (absolute, Marco only), or production
  data.
- **Did not commit the deletion of a consumed prompt** whose PR is Marco's (F3).

---

Board PR: this file's own. Breadcrumb written **inside the PR worktree** (`C:\po-00-1509`), so no
untracked copy exists in the dev tree and the post-merge fast-forward has nothing to trip on.

Stamped `2026-09-14T15:4xZ` at `origin/main` `5fca4305`. **Every count above is STATE — re-measure,
never quote.**
