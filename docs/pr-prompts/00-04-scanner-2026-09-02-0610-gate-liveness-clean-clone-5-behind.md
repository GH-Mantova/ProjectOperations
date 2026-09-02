# Station 04 — Scanner | 2026-09-02T06:10:43Z–2026-09-02T06:20:00Z

## GROUND

```
UTC            2026-09-02T06:10:43Z
origin/main    d3b603e4            (fetched --prune, then rev-parse)
dev tree       main @ d3b603e4     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)
```

Doc version and bootstrap AGREE — this run was READ/WRITE-eligible within 04's authority
(read-only on the board; I mutated nothing on the board).

**Run was SIGHTED.** `start_process` shell `powershell.exe` succeeded on LAPTOP-E6NHU4E4 at
06:10:43Z. This was NOT a blind run. ⚠️ The Desktop Commander tools were **deferred** and had to be
loaded via `ToolSearch` before the first call — a bare call would have thrown
`InputValidationError` and read exactly like blindness. That is the defect PR **#1519** is fixing
(`station-contract v2`, currently DIRTY/conflicted) and **#1521** staged the follow-up for.
Sweep verdict at 06:11:40Z was **CAUTION** (a PR was touched on GitHub inside 2 min), not
DO-NOT-ACT; as a read-only station I proceeded without any board mutation.

**Assigned sweep this run: `gate-liveness`** (rotation position 1 of 4, per
`node scripts/pipeline/next-sweep.mjs`). Not chosen by me.

## WHAT I MEASURED

**Instrument calibration first (DOCTRINE §7, §9.5).**

- `[MEASURED]` `git` = `C:\Program Files\Git\cmd\git.exe` 2.55.0; `gh` = 2.90.0. Both resolve, so
  `lint-prompt.mjs` gate probes (which shell `git`) and `fixes_pr` (which shells `gh`) are live.
- `[MEASURED]` `ls-tree` positive control `-- docs/pr-prompts/` → **655**; negative control
  `-- docs/pr-prompts-NOSUCHDIR/` → **0**. Enumeration instrument honest.
- `[MEASURED]` **`lint-prompt.mjs` CAN emit exit 3.** Positive controls:
  `superseded/pr-cardui-s2-wbs-table-shell-HOLD.md` → **exit 3**;
  `superseded/pr-gates-approval-receipt-SPENT-2026-09-01-shipped-in-1492.md` → **exit 3**.
  This is the control that makes the zero below mean something.

**The board, at `d3b603e4`.**

| | [MEASURED] |
|---|---|
| tracked under `docs/pr-prompts/` (recursive) | 655 |
| depth-1 entries | 78 |
| depth-1 `-HOLD`/`-ready` prompts | **69** (0 were `rev-*` review jobs) |
| exit 0 — ADMIT/PROMOTE, gate open | **39** |
| exit 1 — REJECT, still gated | **30** |
| exit 3 — SPENT, premise dead | **0** |
| exit -1 — spawn failure | **0** |

**Every gate-bearing REJECT evaluated by hand against `origin/main`, not just by exit code.**
I extracted each `requires_on_main` / `requires_file_on_main` / `requires_merged` entry as authored
on `origin/main` and resolved its target myself. Result: **22 gate-bearing prompts, all genuinely
waiting.** 12 gate on a file absent from main; 9 gate on a file present whose needle is absent;
`pr-scopesub-s5-sub-tab-ui` has two gates, the first (`scope-redesign.service.ts ::
SUB_LINE_PRICES_LINKED_ITEM`) **has** released and the second (`CuttingSection.tsx`) correctly
still holds it. The remaining 8 REJECTs are `HUMAN_GATE_PRESENT` (correct, by design).

- `[MEASURED]` **No quoted-list-item gates.** The known permanently-dead-gate trap (the watcher's
  front-matter parser strips quotes from an inline scalar but not from a list item) has **zero**
  instances on this board. The four single-quoted entries (`cardui-s5/s6/s7/s8`) are all **inline
  scalars**, and all four resolved correctly.
- `[MEASURED]` **THE BOARD TRAP IS CLEAN: 0 tracked `*-ready.md` at depth 1** on `origin/main`
  (positive control: 69 tracked `-HOLD.md` at the same depth). No checkout can re-arm executed work.
- `[MEASURED]` **Zero-SPENT is not an artifact of undying premises (LL-54).** I read the `premise`
  of 10 of the 39 ADMITs; **all 10 invert on landing** (`! grep -q <marker>` / `! test -f <path>`
  paired with a `done_when` asserting the same marker present). A premise that cannot die is the
  mechanism that would make exit 3 read zero falsely; it is not present in the sample.
- `[MEASURED]` `check-lessons.mjs` exit **0** — 5 lessons holding, 0 regressed.
  `check-escalations.mjs` exit **0** — 0 open, **3 RESOLVED but still registered**.

**A lead I chased and REFUTED — recorded here, not as a finding.**
`no-pr-opened/pr-cardui-s3-manpower-columns-2026-09-02.log` records a NO-OP ("day rate not on the
payload", run 03:40–03:47Z, no PR opened), while `pr-cardui-s4-plant-columns-HOLD` reads ADMIT —
which looks exactly like a chain gate released by work that never shipped. **It is not.**
`[MEASURED]` `git log -S SCOPE_WBS_MANPOWER_V1` → `acaad4de feat(scope-s3): WBS manpower column
group (#1511)`, negative control `ZZZ_NO_SUCH_TOKEN_ZZZ` → empty. The marker is real and the work
is substantive (Day rate column present, `dayRate` ×19, 6 discrete manpower columns), and s3's HOLD
was correctly retired to `superseded/`. A **later** attempt succeeded after the logged NO-OP; s4's
gate released legitimately. Filing this as a finding would have been a confident, coherent, wrong S2.

## WHAT CHANGED

- `docs/pipeline/sweep-rotation.json` — **advanced**, `last_index` 3 → 0, `last_run_utc` →
  `2026-09-02T06:10:43Z`. Read back and verified: next sweep now reads `instrument-honesty`
  (position 2 of 4). 🔴 **LEFT DIRTY IN THE DEV TREE ON PURPOSE — Station 00 must commit it**,
  because 04 may not commit and the dev tree is on `main`. If it is not committed, the next run
  repeats `gate-liveness` and the rotation silently stops.
- One breadcrumb: this file. **Untracked until a board PR commits it** — Station 00 sweeps it up.
- Nothing on the board. No prompt armed, disarmed, renamed, moved or deleted. No PR touched.

## FINDINGS

### F1 — `next-sweep.mjs` still orders 04 to do the one thing 04 is forbidden to do

`[MEASURED]` On `--advance` the script prints:
`COMMIT THIS FILE with your breadcrumb, or the next run repeats this sweep.`

The station doc was corrected for exactly this (04's own F6 last run, shipped in #1505) and now
reads *"Station 00 commits it, because you may not"* — the authority matrix gives 04 *Mutate the
board: NO*. **The script's stdout was not corrected with it.** A fresh 04 run has no memory, obeys
the most specific instruction in front of it, and this one is imperative and terminal. The previous
correction is one layer deep; this is the other layer.

Complete-and-additive fix (RULE 1 — passes both halves; no data touched): change that line to name
the owner, e.g. `ROTATION ADVANCED. Leave this file dirty and name it in your breadcrumb — Station
00 commits it.` A comment-only alternative fails the "future" half: the string is what an agent acts on.

**DISPATCHED → Station 00.** One-line string change in `scripts/pipeline/next-sweep.mjs`; 00 is
already committing `sweep-rotation.json` from this run and can carry it in the same PR.

### F2 — the watcher clone is 5 commits behind main and its own instrument says it is current

`[MEASURED]`

| | |
|---|---|
| true `origin/main` (dev tree, freshly fetched) | `d3b603e4` |
| clone `HEAD` (`C:\po-watcher\ProjectOperations`) | `eacf09ac` |
| clone's **cached** `origin/main` | `eacf09ac` — **identical to its own HEAD** |
| clone behind true main | **5 commits** (ahead: 0, as control) |

This is DOCTRINE §9.2 with the safety off: the clone has not fetched, so `git status` inside it
reports clean and up-to-date with `origin/main` while it is five commits stale. The sweep's
`dirty=2` is only two untracked files (`docs/pr-reviews/pr-1519-review.md`,
`scripts/pr-watcher/.conflict-notified-prs.json`) and is the lesser issue.

It matters because **the watcher runs `index.mjs` from the clone** and *a restart adopts nothing*
(DOCTRINE §9.5). Of the 5 missing commits, **#1512 (`d3b603e4`) touches `scripts/pipeline/`** —
"retire the three untracked state files; add vm-git-guard; track the arming log". The clone is
running without the vm-git-guard, and a restart would not change that until it is fast-forwarded.

**DISPATCHED → Station 03 (machine-minder).** Clone drift is 03's lane per STATION-CAPABILITIES §6.
I did not fast-forward it: DOCTRINE §4 forbids `git checkout`/`commit`/`push` in the watcher clone
from any other station, and a live agent may be working there.

### F3 — watcher-clone stash count is 64 and still a closed loop

`[MEASURED]` `git -C C:\po-watcher\ProjectOperations stash list` → **64** entries.
Newest: `stash@{0}: On main: watcher-preflight-autostash on 'main' at 2026-09-01T21:25:04+10:00`.
Oldest: `stash@{63}: WIP on feat/sharepoint-folder-mappings: a5a096e … (#545)` — i.e. the pile
reaches back to the #545 era. Dev tree, for comparison: **11**.

DOCTRINE §9.2 records this as a known closed loop — the launcher's preflight stashes on every start
and nothing ever pops — and instructs stations to **report the count and its growth**. Doing that:
64, and the newest entry is from the most recent launcher preflight, so it is still accumulating.
Cure when someone acts is `git stash drop`, **never `pop`**.

**DISPATCHED → Station 03**, folded into the same clone-hygiene dispatch as F2. Reported, not acted
on — 04 does not touch the clone.

### F4 — two uncommitted dev-tree edits are corrupting lint verdicts for every chat in this tree

`[MEASURED]` `git status --porcelain -- docs/pr-prompts/`:

- ` D docs/pr-prompts/pr-schema-label-removal-is-marcos-HOLD.md` — **deleted in the working tree,
  uncommitted, but tracked on `origin/main`** (confirmed by `ls-tree`, positive control alongside).
  `lint-prompt.mjs` therefore returns **`MISSING`, exit 1** for it. In my first pass that read as a
  31st legitimate REJECT. It is not a verdict about the prompt at all — it is a verdict about this
  tree.
- ` M docs/pr-prompts/pr-cardui-s8-waste-section-HOLD.md` — modified uncommitted, so its
  `GATE_NOT_RELEASED` was read against a dirty copy rather than main.

`lint-prompt.mjs` greps the **working tree** for the premise (only `requires_*` read `origin/main`),
so any `triage-holds.ps1` or lint run by any chat in `C:\ProjectOperations2` inherits both. The dev
tree's index is shared between concurrent chats (DOCTRINE §9.2), so this is not one chat's problem.

I did **not** restore the deletion: DOCTRINE §9.2 forbids `git checkout`/`restore` in the dev tree
(consumed prompts come back armed), and the sanctioned recovery — `git show HEAD:<path>` piped to a
write — is a board mutation, which 04 may not perform.

**DISPATCHED → Station 00.** Either commit the deletion deliberately if it was intended, or restore
via `git show HEAD:docs/pr-prompts/pr-schema-label-removal-is-marcos-HOLD.md`; and settle the s8 edit.

### F5 — three resolved escalations are still registered and re-reported every run

`[MEASURED]` `check-escalations.mjs` exit 0: `open=0 resolved=3 broken=0`, and the tool itself says
*"artifact verified on main. Stop reporting these; clear the note."* The three:
`clients-perms-namespace`, `smoke-gate-nonfunctional`, `queue-armed-by-commit-noop`.

Low severity, but it is the same shape as the `[STALE]` needs-marco files section 5 of the sweep
tags every run: a resolved item that still costs every future run a read and a moment's doubt.

**DEFERRED.** Real, not urgent, and not mine — clearing the register is a board mutation. It becomes
urgent if the resolved count starts crowding out genuinely open escalations. Named here so 00 can
fold it into the next housekeeping PR.

## WHAT I DID NOT DO

- **Armed, disarmed, renamed, moved or deleted nothing.** 04 is read-only on the board; `armed` was
  0 at sweep time and is 0 now. I did not act on the 39 ADMITs — ADMIT is necessary, not sufficient,
  and arming is 00's on Marco's authority.
- **Staged no `-HOLD` prompt.** I am permitted up to 2. F1 is the only finding that clearly wants
  one, and it is a single-line string change in a file Station 00 is already committing from this
  run; a prompt would open a second PR for a one-line edit. Dispatched instead.
- **Did not fast-forward or clean the watcher clone, drop its stashes, or prune the 11 registry
  escapees / 2 orphaned worktrees** the sweep lists (`C:/po-1483-fix`, `C:/po-work/s2-e2e`, both
  `dirty=0`). All 03's lane, and an existing clone-hygiene dispatch already covers them.
- **Did not touch `/sot/`** (05's), Azure/Entra/SharePoint (absolute hard stop, all stations), or
  production data.
- **Did not run the Part 0 static audit, the Part 1 GitHub reconciliation, or the Part 2 live-site
  visual pass.** My station doc's first instruction is to take ONE named sweep and cover it
  completely rather than pass shallowly over everything; the rotation named `gate-liveness` and that
  is what this run covers end to end. `instrument-honesty` is next.
- **Did not run `git` through the device bridge** against the Windows `.git` at any point — every
  git call in this run went through Desktop Commander/PowerShell on the host.
- **Did not write to any of the five gitignored `docs/qa/` sinks.** This breadcrumb is the report.
