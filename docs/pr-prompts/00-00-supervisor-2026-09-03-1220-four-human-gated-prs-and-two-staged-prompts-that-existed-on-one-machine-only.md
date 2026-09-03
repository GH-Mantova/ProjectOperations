# Station 00 — Supervisor | 2026-09-03T12:09Z–2026-09-03T12:35Z

## GROUND

```
UTC            2026-09-03T12:09:04Z
origin/main    b32bea48            (fetch --prune first, then rev-parse)
dev tree       main @ b32bea48     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Versions AGREE — this run had full authority. SIGHTED, not blind: a PowerShell shell started on
the Windows host on the first attempt (PID 29172). Station doc, DOCTRINE and STATION-CAPABILITIES
were read from the working copy after proving it is byte-identical to `origin/main` for that path
(`git diff --stat HEAD origin/main -- docs/pipeline/` returned EMPTY, and local main is 0 behind /
0 ahead) — so the "read from origin/main" rule is satisfied without a second checkout.

## WHAT I MEASURED

- [MEASURED] `bring-up-to-speed.ps1` at 12:09:51Z. Instrument positive controls BOTH pass
  (`gh` reached GitHub and saw merged #1545; `node` runs). Section 7 verdict: **SAFE TO ACT** —
  no board mutation in progress, no git lock, 0 git processes, no PR touched in the last 2 min.
- [MEASURED] Board is FOUR open PRs: #1544 (14 pass / 0 fail / 0 pending — GREEN), #1543 CLEAN,
  #1541 CLEAN, #1536 BLOCKED with 12 pass / 2 fail.
- [MEASURED] armed (`*-ready.md`) = **0**, counted by hand in the queue directory, not quoted from
  a note. I armed nothing this run (see WHAT I DID NOT DO for why that was deliberate).
- [MEASURED] RULE-2 probe, quote-free regex form, with both controls:
  `marco.:true` = **606** · positive control `merge result` = **653** · negative control
  `zzzz-never-appears-zzzz` = **0**. The instrument discriminates; an empty result would have
  meant something.
- [MEASURED] Per-PR lane verdicts, quoted verbatim from `processed/*.log`:
  - #1536 — `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`
  - #1541 — `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs"}`
  - #1543 — `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs"}`
  - #1544 — **NO LANE VERDICT.** It is a second-lane PR (I opened it last run, not the watcher), so
    the probe is structurally blind to it and its silence proves nothing. Hand-classified by
    `classifyPolicyFiles`: its nine files include `.claude/agents/*.md`,
    `docs/pipeline/STATION-CAPABILITIES.md`, `scripts/pipeline/lint-station.mjs` and
    `scripts/pipeline/next-sweep.mjs` — paths outside `^(tests|docs)/` ⇒ **MARCO'S**.
    Recorded as `[NO LANE VERDICT — hand-classified]`. Labels: none.
- [MEASURED] #1544 has **no failing and no pending check**; `mergeStateStatus` and `mergeable` both
  read `UNKNOWN`. That is GitHub still recomputing after the watcher's auto-update rebased
  `fix/agent-defs-double-encoded` (`d19162ef..0d7e1638` came down in this run's fetch), not a
  defect. It is green and it is Marco's.
- [MEASURED] **#1536's two reds are ONE cause, and this run has the log to prove it.** The
  CP-26 job log ends `##[error]Process completed with exit code 1` after printing the
  approval-receipt template. The separate `PR gates — diff checks` job's ONLY failing line is
  `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label (escalates:true). A human must
  review and REMOVE the label...]` — every other CP in that job, up to and including CP-25,
  printed PASS. So the standing warning that CP-26 takes `PR gates — diff checks` down with it
  is no longer an inference: it is measured on a live PR. **Two red checks, one human gate.**
- [MEASURED] `check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0. 2 breadcrumbs checked, 0
  malformed. No station SILENT: 00 1.0h (cadence 2h), 03 37.1h (24h), 04 2.0h (4h), 05 46.0h (24h).
- [MEASURED] Scheduled-tasks MCP (the ONLY live schedule): all five tasks **enabled**. But two
  facts the freshness checker cannot see — (a) `00-supervisor` cron is `5 * * * *`, i.e. **HOURLY**,
  while both this station's doc and its bootstrap say "cadence: every 2 hours"; (b) `03` last ran
  2026-09-01T23:01Z with next at 2026-09-03T23:00Z, and `05` last ran 2026-09-01T14:11Z with next
  at 2026-09-03T14:10Z — **each silently skipped its 2026-09-02 occurrence.** Both still read "ok"
  because 2x cadence has not elapsed. This is consistent with the already-open
  `all-stations-disabled-16h...` escalation and is not raised as new.
- [MEASURED] Watcher: node RUNNING pid 24744, auto-restart wrapper alive (1), heartbeat 41 min —
  idle with an empty queue, which is CORRECT, not wedged. Watcher clone `dirty=3`.
- [MEASURED] Dev tree carried 13 changed paths, of which three matter and are handled below.
- [INFERRED] The `--jq` form `select(.conclusion!="SUCCESS")` failed with
  `function not defined: SUCCESS/0` — DOCTRINE §9.4 again: escaped double quotes do not survive
  the PowerShell `-Command` layer. Re-asked with `gh pr checks` and a `Select-String` filter.

## WHAT CHANGED

Three files, one board PR, all under `docs/pr-prompts/`. Built in a clean isolated worktree
(`C:\po-00-1220`, branch `board/00-2026-09-03-1220`) taken off `origin/main` — never in the shared
dev tree, whose index belongs to other chats.

1. **Committed two staged prompts that existed only on this one machine.**
   `pr-cardui-s8-waste-section-HOLD.md` (modified 2026-09-01T23:24Z; size 6→9, adds four e2e /
   gate files to `scope` and a "restoration ratchet" section) and
   `pr-rates-s11c-drop-legacy-tables-HOLD.md` (modified 2026-09-02T22:56Z; +57 lines). Both had
   sat UNCOMMITTED in the shared dev tree for one to two days.
2. **Retired the consumed VS-S3 HOLD.** `pr-visualreview-s3-design-ref-frontmatter-HOLD.md` was
   staged-deleted in the dev tree and still tracked on `main`; #1543 does not retire it.
   `git mv`'d to `docs/pr-prompts/superseded/`.
3. **This breadcrumb.**

Nothing was armed. Nothing was merged. No label was added or removed. The watcher was not touched.

## FINDINGS

### F1 — Two staged prompts existed on exactly one machine, and one of them is destructive

`pr-cardui-s8-waste-section-HOLD.md` and `pr-rates-s11c-drop-legacy-tables-HOLD.md` carried
substantive uncommitted edits in `C:\ProjectOperations2` — 89 insertions across the two — dated
2026-09-01 and 2026-09-02. Two things follow, and both are bad.

First, **the Board Trap eats them.** Any `git checkout .`, `reset --hard`, `stash pop` or
`git clean` in that tree destroys a day's prompt authoring with no error and no trace.

Second, and worse for correctness: **`lint-prompt.mjs` greps `premise:` against the WORKING TREE.**
So every arming decision made on this box for two days was computed against prompt text that
`origin/main`, CI, a clone and every other station could not see. The known trap is "a stale dev
tree reports a spent prompt as armable"; this is its mirror — a dev tree that is AHEAD of main in a
way only it knows about. `pr-rates-s11c-drop-legacy-tables` drops legacy tables, so the version of
that prompt an agent would lint is not the version anyone else can read.

Committing a `-HOLD.md` cannot start work — a HOLD is inert until an explicit `git mv` arms it — so
publishing them is complete-and-additive under RULE 1: it removes the loss risk and the
invisibility, and damages nothing. **The edits are UNREVIEWED and I did not review them**; s11c
remains not-armable without Marco regardless.

**DISPOSITION: ACTIONED** — both committed in this run's board PR, verified by `git status` in the
worktree showing them staged before commit and by the PR's own file list after push.

### F2 — #1536 is not a broken PR; it is a correctly-held one, and its two reds are one gate

12 pass / 2 fail reads like a PR needing repair, and repairing failed PRs is my lane. It is not one.
Both reds trace to CP-26, whose remedy is an approval receipt at `docs/decisions/merge-approvals/`
authored by a human — **and the standing rule is that no agent may ever author an approval file.**
The only correct action here is to leave it alone, which is what I did. Recording it so the next run
does not spend a second cycle re-deriving that "fix the red PR" and "never write an approval file"
point in opposite directions on this one PR.

**DISPOSITION: DEFERRED** — becomes urgent only if #1536 goes red for a reason that is NOT CP-26;
a third failing check on that PR is the signal to look again.

### F3 — The whole board is human-gated, so arming more work makes the queue longer, not shorter

Four open PRs, four human gates: three genuine `marco:true` verdicts naming specific non-docs paths,
and #1544 hand-classified as Marco's because a second-lane PR gets no verdict at all. Armed = 0. The
constraint is not that work is not being produced — it is that every PR touching anything outside
`tests/` or `docs/` stops and waits. The `tests-docs` lane that would relieve it is itself
deadlocked (open escalation #21), so even a docs-only prompt would land human-gated.

**DISPOSITION: ESCALATED** — this is the same throughput ceiling already before Marco; no new
question is raised here, and no new escalation file was written. The one thing this run adds is
that **it now binds on second-lane PRs too**: #1544 is green, correct, and unmergeable by any
station, because the classification rule sends it to Marco and the probe cannot even see it.

### F4 — Three orphaned worktrees and two registry escapees are still on the box

`C:/po-1483-fix` (age 2030 min, dirty=0), `C:/po-sa-fix` (392 min, dirty=0),
`C:/po-work/s2-e2e` (2158 min, detached HEAD, dirty=0), plus registry escapee
`C:\po-worktrees\fix-1523` (0 KB, 393 min, no lock). All measured clean, so nothing is at risk of
data loss, but they are accumulating and the sweep re-reports them every run.

**DISPOSITION: DISPATCHED → 03 (machine-minder)** — prune the four after confirming each is dead;
`git status --short` in each first, never delete unsupervised. Handing over the measurement above so
03 does not re-take it. 03's next scheduled run is 2026-09-03T23:00Z.

### F5 — The 00 cadence in the docs disagrees with the live schedule

Station doc and bootstrap both say "Cadence: every 2 hours". The scheduled-tasks MCP says
`5 * * * *` — hourly. `check-breadcrumb.mjs --freshness` uses the documented 2h, so it would call 00
SILENT only after 4 hours when the real gap that matters is 2. Small, but it is exactly the class of
drift that makes a detector report "ok" through a real outage.

**DISPOSITION: DEFERRED** — a one-line doc change, but it belongs in a PR that is not this one
(this PR is queue hygiene) and it is not urgent while 00 is running every hour and reporting.

## WHAT I DID NOT DO

- **Armed nothing.** With four human-gated PRs, a deadlocked `tests-docs` lane and armed=0, the
  next arm adds a fifth PR to a queue nobody can drain. The backlog gate does report
  `rates-11c-blocked-consumers` as READY TO STAGE; it is already staged, and staging is not the
  bottleneck.
- **Merged nothing.** All four open PRs are human-gated — three by verdict, one by
  hand-classification. RULE 2 is not cleared by green, by CLEAN, by an absent label, or by my own
  reading of the routing reason.
- **Did not touch #1536's `do-not-merge` label**, and did not author an approval receipt for it.
- **Did not review the content** of the two prompt edits I committed. I preserved and published
  them; judging them is the author station's job, and s11c is Marco's regardless.
- **Did not run `rescue-watcher-repo.ps1`** — the watcher clone reads `dirty=3` but that is
  untracked review files, not corruption. No MERGE_HEAD, no rebase, no unmerged paths.
- **Did not prune the orphaned worktrees myself** — that is 03's lane (LL-38), and all four are
  clean, so nothing is decaying while it waits.
- **Did not clear the `[STALE]` escalation lines** the sweep flagged on
  `ruleset-requires-four-checks...` and `tests-docs-lane-deadlock-2026-09-03.md`. The sweep is
  matching merged PR numbers, but both files are AMENDED-and-live, not discharged; the standing
  instruction is never to act on a §5 `[STALE]` line without reading the file, and reading them
  says they are open.
- **Left `/sot/`, Azure/Entra/SharePoint, production data and the dev tree's stashes alone.**
