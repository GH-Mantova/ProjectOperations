# Station 00 — Supervisor | 2026-09-10T05:08Z–2026-09-10T05:45Z

## GROUND

```
UTC            2026-09-10T05:08:52Z
origin/main    bb04235e            (fetch --prune first, then rev-parse)
dev tree       main @ bb04235e     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md, station_doc_version: 1)
```

Doc version and bootstrap AGREE — this run was not read-only.

**SIGHTED run.** `start_process` shell `powershell.exe` returned a live prompt on the first call
(pid 7756). This was not a blind run and is not being reported as a quiet one.

**vm-git-guard: [CANNOT MEASURE].** PREFLIGHT step 1 asks for
`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` at the top of the run. The
Linux workspace refused to start — verbatim: `Workspace unavailable. The isolated Linux environment
failed to start (RPC error -1: SDK version 2.1.260 not verified …)`. Per the station contract a
failed install is a FINDING, not a STOP, and the hazard it guards is narrower than usual this run:
with no VM at all, there is no VM-side `git` that could reach the Windows `.git`. **No `git` was run
through the device bridge at any point.** Every command below ran through Desktop Commander on the
host.

**Read from the working copy, and that was PROVED sound rather than assumed.** PREFLIGHT says read
the three binding documents from `origin/main`, never the working copy. `git diff --numstat
origin/main -- <path>` returned EMPTY for all three of `docs/pipeline/stations/00-supervisor.md`,
`docs/pipeline/DOCTRINE.md` and `docs/pipeline/STATION-CAPABILITIES.md`, so the working copy and
`origin/main` are the same blobs and the distinction could not bite. Read in full: all three.

## WHAT I MEASURED

**Sweep verdict — SAFE TO ACT.** [MEASURED] `scripts/pipeline/status-sweep.ps1`, exit 0, captured to
a file rather than read from the stream (it returns early and hides its own section 7 verdict).
`SWEEP COMPLETE 2026-09-10 05:10:03Z`. Section 7 verbatim: `SAFE TO ACT: no board mutation in
progress, no recent remote activity, no live station worktrees.` Section 3: `git index.lock
interactive/clone: False / False`, `git processes running: 0`, `no PR touched on GitHub in the last
2 min`. Condition 3 satisfied at the moment of measurement and re-checked immediately before the
teardown below.

**Board — 2 open, both CLEAN, both green.** [MEASURED] `#1832` (`scripts/pipeline/vm-git-guard.sh`,
opened 00:12:33Z, 15 pass / 0 fail) and `#1823` (5 API files + its own receipt, opened
2026-09-09T00:05:42Z, 15 pass / 0 fail). `main` CI on `bb04235e`: 4 success / 0 failed. Armed
prompts: **0**.

**RULE 2 — both open PRs carry a LIVE watcher verdict. [MEASURED]**, probe pinned to the live tree
`C:\ProjectOperations2\docs\pr-prompts\processed` and never the clone: **2106** logs, newest
`2026-09-10T04:27:04Z` — younger than both PRs, which is the control that separates the live
directory from the seventeen-day-stale decoy. POSITIVE `marco.:true` → **627**. NEGATIVE, a needle
minted this run → **0**.

- `#1832` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/vm-git-guard.sh"}`
- `#1823` → `{"ok":false,"marco":true,"reason":"escalates:true - held for Marco, labelled do-not-merge"}`

Both are genuine policy routings, not the timeout path. **RULE 2 binds on both and I merged
neither.** Both currently read `labels: []` — and label removal does not clear RULE 2.

**`#1823` is released, receipted, green, and still open.** [MEASURED] via `gh pr view 1823 --json
commits` and the receipt blob on its own head. The receipt `docs/decisions/merge-approvals/1823.md`
was authored by commit `9664f95a` `<supervisor@local>`, message `docs(approvals): merge-approval
receipt for #1823`, and records Marco's clearance in his own words — *"1823 label removed"* — cross-
checked by that lane against the issue timeline (`unlabeled`, `label=do-not-merge`, 22:40:06Z). The
receipt is honest about its own limits and carries a `[CANNOT MEASURE]` on which production roles
hold `tenders.allocate`. **The clearance is real. It was given in a chat this lane cannot read.**

**Cost of the wait, [MEASURED] from the same commit list:** `#1823` carries **13** `Merge branch
'main'` commits between 2026-09-09T00:21Z and 2026-09-10T04:27Z — the `pollForBehindPrs` auto-update
firing after each board merge. The most recent landed 41 minutes into this run's window. That is the
already-open poller escalation, now with a per-PR figure attached.

**Encoding of DOCTRINE — clean.** [MEASURED] on the `origin/main` blob: `U+FFFD` → **0**;
`U+00E2 U+20AC` → **2**, both on lines 557 and 562, which are section 9.3 *quoting its own mojibake
signature as documentation*. That is section 9.6's closing rule, not damage. My own insert
contributed **0**.

**COLLECT — nothing new since my 04:08Z run.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs
--freshness`: `structure: 30 checked, 0 malformed`, `CLEAN`, exit 0. Freshness: `00` 1.1h · `03` 6.2h
· `04` 3.1h · `05` 7.2h — all `ok`. Newest breadcrumb on disk is my own 04:08Z file (mtime 04:26Z);
no station has filed since. `04` is next due 06:10Z, `03` 23:01Z, `05` 22:02Z. **`ok` is not an
all-clear** and was not treated as one: the newest-file check is the second instrument, and it
agrees.

**Watcher — healthy, and specifically NOT wedged.** [MEASURED] node RUNNING pid 13352, auto-restart
wrapper alive (1), heartbeat 44 min. Heartbeat ticks only mid-run, and the queue is empty, so a
stale heartbeat with `armed: 0` is the *correct* idle reading, not a wedge. No restart was
considered.

## WHAT CHANGED

1. **`docs/pipeline/DOCTRINE.md`** — one new bullet in section 9.4 (the `gh` CWD trap, F1 below),
   inserted by concatenation in node, never `String.replace` with a replacement string. Byte delta
   ASSERTED: 140036 → 143367, expected 3331, actual **3331**, match true. Anchor unique before the
   edit; double-apply guard present.
2. **`docs/pipeline/stations/_canonical-blocks.json`** — `instruments v2` hash re-recorded to
   `b5dd599152bf548e` via `lint-station.mjs --write-canonical`. Read-back: lint went `REJECT: 1 of 8
   docs failed` (exit 1) before, `ADMIT: all 8 docs clean` (exit 0) after. One document, not seven —
   `instruments v2` lives only in DOCTRINE.
3. **Six orphaned worktrees removed** (F2 below). Read-back: `git worktree list` went 9 entries to
   3. Dev tree afterwards: `rev-list --left-right --count HEAD...origin/main` → `0 0`,
   `diff --numstat` → EMPTY, `diff --cached --name-status` → EMPTY.
4. **This breadcrumb**, written inside this run's own PR worktree — cure 1 of the delete-the-disk-
   copy rule, so no untracked copy is left in the dev tree to block the next fast-forward.
5. **Nothing merged. Nothing armed. No label touched. No production data. No Azure/Entra/SharePoint.**

## FINDINGS

### F1 — `gh` run outside a git repository answered EMPTY for every question, and section 9.1's own cure is what put me there

Deciding which worktrees were safe to tear down needed each branch crossed against the board. My
first probe ran `gh pr list --head <branch> ... 2>$null` from a script whose working directory was
`C:\po-sup-fix-scripts`. **All eight branches came back `pr=none`** — including
`feat/ea-gate-reporting-team-permission`, which is `#1823`'s own head branch and was OPEN at that
moment. A uniform zero across a heterogeneous input set was the only thing that looked wrong.

[MEASURED] with controls, stderr discarded the way a script discards it:

| form | exit | stdout chars |
|---|---|---|
| non-repo CWD, no `-R` — the failing form | **1** | **0** |
| non-repo CWD, with `-R` — POSITIVE control | 0 | 33 |
| dev-tree CWD, no `-R` — POSITIVE control | 0 | 33 |
| dev-tree CWD, with `-R` — POSITIVE control | 0 | 33 |

NEGATIVE control, `-R` naming a repo that does not exist: exit 1. The failing form writes
`failed to run git: fatal: not a git repository (or any of the parent directories): .git` to stderr
and nothing to stdout.

**The exit code is 1, so this is loud — but only to a caller that looks at it.** The pairing that
silences it is one every station already writes: `2>$null` to keep git's stderr chatter out of a
report, plus a result read straight into `ConvertFrom-Json` with no `$LASTEXITCODE` test.

**Why it belongs in section 9 and not in one station's notes:** section 9.1 says put anything
containing `$` in a `.ps1` and run it with `-File`, and a `.ps1` launched through `start_process`
inherits the **session's** working directory — [MEASURED] this run, Desktop Commander's shell opens
in the Cowork session's `outputs` folder, which is not a repository. **Following 9.1's cure moves
the script out of the repo and arms this trap.** Two correct cures composing into a silent one.

Re-run with `-R`, the same eight branches returned six MERGED PRs, one OPEN, and one merged six days
earlier — which is what F2 acted on.

**ACTIONED** — landed in DOCTRINE section 9.4 in this PR, with the four-row table as its falsifying
probe. Verified by `lint-station.mjs` exit 0 after re-recording the canonical hash.

### F2 — six of my own board-PR worktrees were never torn down, and nothing was ever going to notice

The sweep reported 8 non-main worktrees, ages 245–8476 min, every one tagged `orphaned worktree
(aborted run leftover)`. Six are `docs/*` branches created by Station 00's own board PRs over the
preceding seven hours. BOARD DRIVING condition 2 says *"Clean isolated worktree only … Tear it down
always."* They were not.

Crossed against the board with the working instrument (POS 1, NEG 0): `docs-ea-gate-class` → `#1824`
MERGED · `docs-handover06` → `#1831` MERGED · `docs-receipt1827` → `#1834` MERGED ·
`docs-verdict-anchor` → `#1825` MERGED · `docs-vmg-track` → `#1826` MERGED ·
`sot-reconcile-20260909` → `#1828` MERGED. All six `dirty=0`, re-checked immediately before removal.

⚠️ **`git branch -r --contains <sha>` is the wrong instrument here and said so quietly.** It reported
`headOnMain=False` for all six *merged* branches, because every merge on this board is a squash and
the branch head is never an ancestor of `main` (section 9.2 records exactly this). Its positive
control — the dev tree's own HEAD — correctly read `True`, so the instrument was live and still
answered the wrong question.

**ACTIONED** — removed the six. Read-back: worktree list 9 → 3; dev tree `0 0` / EMPTY / EMPTY.

**Deliberately preserved:** `C:\po-vg` (`dirty=1`, holds one uncommitted file, 8476 min old, its
`#1577` merged 2026-09-04 — already escalated, and `worktree remove` would refuse while `--force`
would discard the work) and `C:\po-worktrees\pr1823` (its PR is still OPEN).

### F3 — Marco cleared `#1823` in a chat this lane cannot read, so it has sat green and unmerged for 6.6 hours

`#1823` is CLEAN, 15/15 green, unlabelled, and carries a receipt recording Marco's clearance
verbatim. Every gate a machine can read says go. It has not merged, and no scheduled run can merge
it: the watcher's `marco:true` verdict binds under RULE 2, and RULE 2 is cleared only by Marco *in
chat*, for that batch — a channel a headless run has no access to by construction (section 10.2's
last bullet). The clearance exists, it is durable, it is committed to the repo in the receipt, and
**nothing in the pipeline can act on it.** Meanwhile the poller has rebased the PR 13 times.

This is not the poller escalation and not the vacuous-CP-26 escalation; it is the gap between where
a clearance is *given* and where it can be *read*. Options, RULE 1 order:

**(a) Make the receipt carry the clearance, and gate on it.** Add one machine-readable field —
`rule2_clearance: chat | standing | none` — and extend `approval-receipt-check.mjs` to require it
wherever a receipt claims to release a watcher-routed PR. A scheduled run then clears RULE 2 from a
signed artifact in the repo rather than from which chat it was in. *Complete:* fixes this PR and
every future one. *Additive:* every existing receipt lacking the field simply does not clear
anything, so no past merge changes meaning and no data is touched. **Passes both halves.**

**(b) The supervised lane must not stop with a released PR open.** *Fails the "future" half* — it
depends on a human-driven session being present at the right moment, and a lane that stops
mid-batch recreates the gap exactly as it did here.

**(c) Scheduled 00 treats "label ever removed + receipt present + green" as clearance.** *Fails the
"without damaging" half* — label removal is already recorded as NOT clearing RULE 2, and this would
retroactively re-interpret every receipt already on `main`.

**ESCALATED** — filed at `docs/pr-prompts/needs-marco/rule-2-clearance-lives-in-a-chat-no-scheduled-run-can-read-2026-09-10.md`.
The question for Marco is (a) vs (b) vs (c), not a status update.

### F4 — my own probe walked into section 9.4's `ConvertFrom-Json` collapse while documenting a different section 9.4 trap

The control table in F1 originally reported a parsed row count. It read `rows=1` on all three
passing forms, against a truth of **2** open PRs, because `@(ConvertFrom-Json $raw).Count` answers 1
for any array — the documented collapse, three bullets above where I was writing. The contrast
between rows still held, so no conclusion moved, but the number was fiction.

**ACTIONED** — the published table reports exit code and stdout byte count, both of which are
instrument-independent, and no row count is quoted anywhere in this report.

### F5 — the watcher clone is dirty on main

[MEASURED] by the sweep: `watcher clone: branch=main dirty=2`, flagged `NOT clean-on-main; the
watcher may refuse to start`. The clone is Station 03's lane and I do not run `git` in it — reading
its state is allowed, changing it is not.

**DISPATCHED** — to Station 03 (next occurrence 23:01Z), folded into its existing clone-hygiene
work: identify the 2 dirty paths, and if they are build residue, restore them the section 9.2 way
(`git show HEAD:<path>` piped to a write) rather than `checkout --`. Not urgent: the watcher is
running now, so this bites only at the next relaunch.

### F6 — the Linux workspace could not start, so the device-bridge git guard was not installed

Verbatim: `Workspace unavailable … SDK version 2.1.260 not verified`. PREFLIGHT requires the
installer's last line be quoted pass or fail; there was no installer run to quote.

**DEFERRED** — the guard exists to stop a VM-side `git` call from leaving a 0-byte `index.lock` on
the Windows `.git`, and with no VM there is no such call to guard. **What would make it urgent:** a
run where the workspace *does* start. Any run that reaches a working `bash` must install the guard
before its first mount-side call, and must not treat this note as cover for skipping it.

## WHAT I DID NOT DO

- **Did not merge anything.** Both open PRs carry a live watcher `marco:true` verdict. `#1832` is a
  genuine `outside tests/ or docs/` routing; `#1823` is `escalates: true`. RULE 2 binds on both and
  is not cleared by green, by CLEAN, by the label being absent, or by a receipt.
- **Did not remove or add a label** on either PR. Only Marco removes `do-not-merge`.
- **Did not arm anything.** `armed: 0` at the start and at the end. I did not go looking for a HOLD
  to arm: the last four collect runs have each measured that no gate-satisfied HOLD is
  tests-or-docs-only, so every arm available lands on Marco, and lengthening a queue Marco is
  already the constraint on is not progress.
- **Did not touch `C:\po-vg`.** It holds one uncommitted file and its removal is destructive.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`.** Read-only reads only.
- **Did not touch `/sot/`** (Station 05's), Azure / Entra / SharePoint (absolute), or production
  data.
- **Did not re-file** the `pollForBehindPrs` poller escalation, the vacuous-CP-26 escalation, or the
  `C:\po-vg` orphan. All three are open; F3 and F2 add measurements to them rather than duplicates.
- **Did not fix the two mojibake sequences in DOCTRINE.** They are section 9.3 quoting its own
  signature, and "repairing" them would delete the documentation.
