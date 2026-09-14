# Station 00 — Supervisor | 2026-09-14T09:08Z–09:40Z

## GROUND

```
UTC            2026-09-14T09:08Z
origin/main    e5d40aff              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ e5d40aff       C:\ProjectOperations2   (0 ahead, 0 behind after ff)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

Read in full this run, from the working copy after proving it identical to `origin/main`
(`git diff --numstat origin/main -- <the three paths>` → **EMPTY**, so the PREFLIGHT step-2 concern
does not arise): `docs/pipeline/stations/00-supervisor.md` (1318 lines), `docs/pipeline/DOCTRINE.md`
(2383 lines, every section), `docs/pipeline/STATION-CAPABILITIES.md` (514 lines).

## WHAT I MEASURED

- [MEASURED] **NOT blind.** `start_process` shell `powershell.exe` returned a live shell; every probe
  below ran on the box. The opening `-Command` call did lose `$env:COMPUTERNAME` to the pre-expansion
  layer (DOCTRINE §9.1) — recorded, and all later work went through `interact_with_process`, which
  does not expand.
- [MEASURED] **The VM transport is DOWN, so `vm-git-guard.sh` could NOT be installed.** Quoted, as
  the PREFLIGHT requires, pass or fail: `failed to mount … is under Plan9 share "c" which is not
  mounted; create: RPC error -1: ensure user: user … already exists unexpectedly`. This is a FINDING,
  not a STOP, and the guard is moot this run — with no mount there is no VM-side `git` to guard. It
  is the same condition `STATION-CAPABILITIES.md` §3 records and
  `needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md` already carries.
- [MEASURED] **`status-sweep.ps1` §7: `SAFE TO ACT`** at `09:10:34Z` — no board mutation in progress,
  no remote activity in 2 min, no live station worktrees. Section 0 controls both PASS (`gh` reached
  GitHub, `node` runs). Captured with `*>` and decoded `utf16le` per §9.3 (141,746 B on disk, 413
  lines) — the raw capture is UTF-16LE exactly as that bullet predicts.
- [MEASURED] **The board is 2 open PRs and BOTH are Marco's**, on live watcher verdicts read from the
  pinned live tree `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone — §9.5):

  | PR | state | verdict in its OWN prompt's log |
  |---|---|---|
  | `#1923` | CLEAN, 15 pass / 0 fail | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` |
  | `#1920` | BLOCKED, 12 pass / 2 fail / 1 running | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco, labelled do-not-merge"}` |

  Probe controls: **2214** logs, newest `2026-09-14T08:35:22Z` — younger than the oldest open PR
  (`#1920`, created `06:24:12Z`), which is the control that separates the live directory from the
  17-day-stale decoy in the clone. POS `marco.:true` → **666**. NEG `PR #999994` → **0**.
  Each verdict sits in the log of its **own** prompt alongside that prompt's own `opened PR #<n>` /
  PR-URL line for the same number, so §10.1's `PRNUMBER_SCRAPED_FROM_PROSE_V1` cross-check passes:
  these are genuine routings, not numbers scraped out of prose.
- [MEASURED] **`#1920`'s two reds are ONE cause and it is not a defect.** Read from **column 3** of
  the CP-26 job log (run `34825695353`, job `103917199669`, 220 lines, split on tab per §9.1 — a
  whole-line grep for `CP-26` matches every line, because `CP-26` is in column 1 of all of them):
  `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
  A human must review and REMOVE the label`. NEG control, a freshly minted needle → **0**.
  `[LABEL_PRESENT]` is **parked by design** (§9.4): the same check runs twice, as the required check
  and as a step inside `PR gates — diff checks`, so one cause shows as two reds. Only Marco removes
  the label. **There is no agent-side action behind this red.**
- [MEASURED] **`check-breadcrumb.mjs --freshness` exit 2**: `00` 0.4 h `ok` · `04` 3.1 h `ok` ·
  **`03` 82.1 h SILENT** · **`05` 91.0 h SILENT**. `structure: 12 checked, 0 malformed`.
- [MEASURED] **Crossed against `list_scheduled_tasks`, which names the cause and it is not a station
  defect.** Both are **enabled** with a **future** `nextRunAt`: `03` `0 9 * * *`, lastRun
  `2026-09-10T23:01:10Z`, next `2026-09-14T23:00:45Z`; `05` `10 0 * * *`, lastRun
  `2026-09-10T14:10:55Z`, next `2026-09-14T14:10:37Z`. `lastRunAt` older than one cadence is the
  *"the occurrence never fired"* row of the station-doc table, and the cause is the 09-11 switch-off
  already ACTIONED on file. `lastRunAt` **cannot** move before each `nextRunAt`, so `--freshness`
  will keep reading SILENT until each fires.
- [MEASURED] **`#1918` really does retire its own prompt**, re-verified live rather than quoted:
  `gh pr view 1918 --json files` lists `docs/pr-prompts/superseded/pr-fv2-import-s1-docx-and-persona-HOLD.md`
  among its 7 files. `#1920` and `#1923` list no such path.
- [MEASURED] **armed (`*-ready.md`) = 0.** Queue: `needs-marco/` 52 · `no-pr-opened/` 109 ·
  `failed/` 49 · `blocked/` 135.
- [MEASURED] **The dev tree's one dirty path is the deliberate safe state, not new damage.**
  `git status --porcelain --untracked-files=no` → ` D docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md`
  — a plain **unstaged deletion** (not the `RD` staged-rename shape), left in place on purpose by the
  08:52Z run while `#1923` is open. I did not restore it and did not commit it; my commit is
  pathspec-scoped so it could not carry it.
- [MEASURED] **Trunk is not red.** `main CI on e5d40aff: 3 success / 0 failed / 1 running` — no
  failure, so the `TRUNK IS RED` mis-derivation §9.5 records does not arise this run.

## WHAT CHANGED

- **`docs/pr-prompts/PROMPT-SCHEMA.md` gained a `scope` subsection requiring every prompt to name its
  own `-HOLD.md`.** 51 insertions, 0 deletions — purely additive, and the zero deletions are the
  proof that no line-ending rewrite rode along (§9.3). Edited in **node by concatenation**, never a
  `String.replace` replacement string, and the **byte delta was asserted**: before 45,821 → after
  48,917, `actualDelta=3096 expectedDelta=3096 DELTA_MATCH=true`. Both anchors were checked unique
  before the write; the `premise` heading still occurs exactly once after it.
- Written in an **isolated worktree off `origin/main`** (`C:\po-wt\schema-retire`, clean at
  `e5d40aff`, 0 dirty on creation), never the shared dev tree.
- **This breadcrumb was written INSIDE that worktree**, which is cure 1 of the station doc's
  delete-the-disk-copy rule: no loose copy is left in the dev tree, so it cannot become the next
  run's fast-forward blocker.
- **Nothing else.** No arm, no label touched, no `/sot/`, no Azure, no production data, no watcher
  restart, no worktree pruned.

## FINDINGS

### F1 — S2. The stays-armable-forever defect now has a cure at its source, not a cure by hand

Five runs have re-found this: the watcher deletes the `-ready.md` it builds, but the `-HOLD.md` stays
**tracked on `origin/main`**, so restoring that path makes `lint-prompt.mjs` read it `ADMIT` again —
an armable duplicate of an open PR. Every previous disposition was a hand cure applied after the
fact by whichever run noticed a lone `0 <n> docs/pr-prompts/...-HOLD.md` row after a fast-forward.

The measurement above is what makes this fixable rather than merely re-describable: **one of the
three prompts armed in the last day DID retire itself**, and the difference is entirely in the
prompt — `#1918`'s `scope` named its own path, so the code-writer moved it to `superseded/` in the
same PR. The cure is therefore already proven in production; it was simply not written down.

DISPOSITION: **ACTIONED.** `PROMPT-SCHEMA.md` now requires the entry, shows it in the front-matter
example, says to `git mv` into `superseded/` and never delete, notes that the retirement counts
toward `size`, and states why it deliberately does **not** fire for a PR closed unmerged. Verified by
the byte-delta assertion and the additive `--numstat`; the PR is named under WHAT CHANGED.
**Falsifying probe, written into the section itself:** `gh pr view <n> --json files` on the next PR
built from an armed prompt — if `docs/pr-prompts/superseded/<prompt>-HOLD.md` is absent from that
file list, the rule was not followed.

### F2 — S3. Both open PRs are parked by design; the board has nothing an agent may move

`#1923` is green and carries a live `marco:true` routing. `#1920` is red for exactly one reason —
its own `do-not-merge` label — and that red is the gate working, not a failure to fix. RULE 2 binds
on both, and only Marco removes a label.

This is worth stating rather than reporting as "board healthy, nothing to do", because the two look
identical in a summary and are not: **the board is not idle, it is full and waiting on one person.**
Three consecutive collect runs have previously listed a `[LABEL_PRESENT]` red among "the reds" as
though it were work.

DISPOSITION: **DEFERRED** — nothing here is an agent's to act on. What would make it urgent: either
PR going DIRTY (its CI would freeze), or `#1920`'s red changing to a token other than
`[LABEL_PRESENT]` — in particular `[RELEASED_NO_RECEIPT]`, which IS a real finding.

### F3 — S3. `03` and `05` read SILENT for four days, and the cause is on file and already actioned

Measured above: both **enabled**, both with a **future** `nextRunAt`, neither able to move
`lastRunAt` before it fires. This is the 09-11 switch-off, already ACTIONED by the 00:27Z run; `04`
came back on the same re-enable and now reads `ok`, which is the positive control that the re-enable
takes effect.

DISPOSITION: **DEFERRED.** **Do not re-diagnose this as an outage or as a stopped station** — that
is the §7 false alarm the station doc names by name, and a false alarm licenses destructive action.
Falsifying probe, and it is due today: `05` at `14:10:37Z` and `03` at `23:00:45Z`. If either
`lastRunAt` does not move past its own `nextRunAt`, this is no longer the outage and becomes a real
station defect worth escalating.

### F4 — S3. Three orphaned worktrees, one holding uncommitted work, and its owner is silent until tonight

[MEASURED] from the sweep §2: `C:/po-fix1891` (detached, dirty=0, 475 min) · `C:/PR-Master/worktrees/pr1823`
(dirty=0, 6419 min) · **`C:/PR-Master/worktrees/po-vg` (dirty=1, 14477 min ≈ 10 days) — HOLDS
UNCOMMITTED WORK.** `git worktree remove` will refuse it and `--force` would discard it.

Worktrees and local trees are **Station 03's** lane, not mine (LL-38 — doing 03's job myself is the
incident). 03 is SILENT until `23:00:45Z` tonight, so this hand-over will not be read for ~13 h.

DISPOSITION: **DISPATCHED → 03.** Fold into the existing clone-hygiene dispatch. The ask: list
`git -C C:/PR-Master/worktrees/po-vg status --porcelain` **first**, preserve or commit whatever that
one file is, and only then prune. The other two are dirty=0 and are ordinary prunes. ⚠️ This
breadcrumb is the whole of the hand-over — 03 wakes on its own clock and reads it; it is not a
`needs-marco/` item and must not become one.

### F5 — S4. The sweep's `watcher clone: dirty=2` warning is the known false positive, re-confirmed

The sweep prints `dirty=2 <-- NOT clean-on-main; the watcher may refuse to start`. Both halves are
wrong in the way DOCTRINE §9.5 already records: the flag counts **untracked** files while
`start-watcher.ps1` counts only tracked ones, and a tracked-dirty clone **auto-stashes** rather than
refusing. The two files are review verdicts the `rev-<N>` job writes into the clone **by design**.

DISPOSITION: **DEFERRED**, already carried by
`needs-marco/sweep-clone-dirty-flag-counts-untracked-files-2026-09-10.md`. Recorded here only so this
run's reader does not mis-route it to 03 as clone hygiene — which is the measured cost of that
bullet, 13 times over in `archive/`.

## WHAT I DID NOT DO

- **Did not merge, or attempt to merge, `#1923` or `#1920`.** Both carry live watcher `marco:true`
  verdicts. Removing a `do-not-merge` label is Marco's alone and was not considered.
- **Did not arm anything.** `armed=0` and the board is already full of work waiting on one person;
  every arm available today lands on Marco, so arming now makes the queue longer, not shorter. The
  sweep's one `READY TO STAGE` backlog item (`rates-11c-blocked-consumers`) is gated behind a parity
  proof that must have RUN clean, which I did not run.
- **Did not restore or retire `pr-ratescol-s0-column-api-hygiene-HOLD.md`.** `#1923` is still open;
  retiring early destroys the prompt if that PR is closed unmerged, and restoring early puts an
  armable duplicate back in the queue. The deletion staying in the dev tree is the safe state.
- **Did not prune any worktree** — 03's lane (F4), and one of the three holds uncommitted work.
- **Did not touch `/sot/`, Azure, Entra, SharePoint, production data, or the watcher process.**
- **Did not archive the collected breadcrumbs this run.** The 09-14 cycle is still current and the
  station doc says archive only what has already been dispositioned; the 08:52Z addendum is swept
  into this PR instead, which is what it was waiting for.
