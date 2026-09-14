# Station 00 — Supervisor | 2026-09-14T08:08Z–08:35Z

## GROUND

```
UTC            2026-09-14T08:08:42Z
origin/main    6a3fb6c4              (git fetch origin --prune, then git rev-parse --short origin/main)
dev tree       main @ 6a3fb6c4       C:\ProjectOperations2   (0 ahead, 0 behind)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE — this run was not read-only.

## WHAT I MEASURED

- [MEASURED] **SIGHTED run.** `start_process` shell `powershell.exe` returned PID 29988 and
  `(Get-Date).ToUniversalTime()` → `2026-09-14T08:08:42Z`. Desktop Commander reached the box on the
  first call after a keyword `ToolSearch` load.
- [MEASURED] **The three binding documents were read from a tree proved level with `main`.**
  `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
  docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, with `HEAD` and `origin/main` both `6a3fb6c4`.
  Per PREFLIGHT step 2 that is the sound form (`--numstat` empty = not different), never a piped hash.
  All three read in full: `00-supervisor.md` 1318 lines, `DOCTRINE.md` 2383, `STATION-CAPABILITIES.md` 514.
- [MEASURED] **`status-sweep.ps1` §7 → `[LIVE] SAFE TO ACT`**, twice: `08:09:56Z` and again at
  `08:16:16Z` immediately before the arm. Captured with `*>` and decoded `utf16le` in node — the
  capture was **142,076 bytes opening `FF FE`**, exactly the trap DOCTRINE §9.3 names, so a naive
  utf8 read would have found no section headers at all.
- [MEASURED] **Zero `[STALE]` escalation rows this run.** `Select-String '\[STALE\]'` over the decoded
  sweep → **4** hits, and all four are the legend line, the header, a quoted instruction and the
  footer — no section-5 escalation row. The three cleared by the 07:09Z run have not come back.
- [MEASURED] **Board: 3 open PRs, and all three are Marco's.** Read live per-PR, never from a list
  response (§9.4's `merged`-field bullet):

  | PR | state | labels | lane probe | classification |
  |---|---|---|---|---|
  | `#1918` | CLEAN, green | none | 2 prompt-log hits, `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: …inspection-builder.controller.ts"}` | watcher-routed ⇒ **RULE 2 binds** |
  | `#1919` | CLEAN, 10/0 green | none | **0** hits ⇒ `[NO LANE VERDICT — hand-classified]` second lane | body says `HOLD — Marco releases` |
  | `#1920` | BLOCKED | `do-not-merge` | 2 hits, `{"ok":false,"marco":true,…"escalates:true - held for Marco, labelled do-not-merge"}` | parked by design |

  RULE 2 probe controls, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`
  and never the clone: **2212** logs, newest **2026-09-14T07:33:18Z** — younger than the oldest open
  PR, which is the control that separates the live directory from the 17-day-stale decoy;
  POSITIVE `marco.:true` (regex, no quote character) → **665**; NEGATIVE, a freshly minted needle → **0**.
- [MEASURED] **Both `#1918` and `#1920` pass the anti-scrape cross-check** (§10.1,
  `PRNUMBER_SCRAPED_FROM_PROSE_V1`): each verdict sits in the log of a prompt whose own scope matches
  that PR's files. `#1918`'s log additionally carries its own `PR #1918 opened: <URL>` line.
- [MEASURED] **`#1920`'s two remaining reds are the one-cause label pair**, not work: `Approval
  receipt (CP-26)` + `PR gates — diff checks`, which §9.4 records as `[LABEL_PRESENT]` — parked by
  design, and only Marco removes the label.
- [MEASURED] **`triage-holds.ps1`, both instrument controls PASS** (GIT control read
  `origin/main:DOCTRINE.md`, 187,697 chars; SPENT control emitted exit 3 on the fixture).
  37 prompts at depth 1: `spent=0  gates-satisfied=3  still-gated=34  unreadable=0`.
- [MEASURED] **None of the three ADMIT candidates can reach the auto-merge lane.** Parsed each
  `scope:` with the CRLF-explicit regex §9.3 prescribes (the `\s*\n` form returns null on every
  prompt in this queue) and applied all three `NESTED_TEST_PATHS` forms:

  | candidate | scope | tests-docs eligible |
  |---|---|---|
  | `pr-crmvis-s0-visual-parity-tooling` | `scripts/pipeline/…` ×3, `docs/…` ×2 | **false** |
  | `pr-ratescol-s0-column-api-hygiene` | `apps/api/…/rate-tables.service.ts` + its spec | **false** |
  | `pr-fv2-import-s1-docx-and-persona` | — | CONFIRMED DUPLICATE of open `#1918` |

- [MEASURED] **The `fv2-import-s1` duplicate flag is a TRUE positive, and `#1918` already cures it.**
  `triage-holds.ps1` scored it 5 of 5 against `#1918`, and `#1918`'s own file list contains
  `docs/pr-prompts/superseded/pr-fv2-import-s1-docx-and-persona-HOLD.md` — this PR retires its own
  prompt, which is the defect the last three runs have been reporting, fixed. Not armed.
- [MEASURED] **`.arming-log.txt` after the arm:** newest row
  `2026-09-14T08:24:38Z ARMED pr-ratescol-s0-column-api-hygiene escalates=false actor=station-00.0808
  by=Marco@LAPTOP-E6NHU4E4 pid=27640`. `*-ready.md` → **1**, index → EMPTY.

## WHAT CHANGED

- **Armed exactly one prompt**, `pr-ratescol-s0-column-api-hygiene`, via `arm-prompt.ps1` (the
  primitive, never a bare `git mv`), `-WhatIf` first and then for real. Read back: one `-ready.md`,
  the audit row above, index clean.
- This board PR: this breadcrumb, the 07:45Z addendum it sweeps up, and `.arming-log.txt`.
- **Nothing else.** No merge, no label, no `/sot/`, no Azure, no watcher restart, no production data.

## FINDINGS

### F1 — S2. `arm-prompt.ps1` has a MANDATORY parameter, and omitting it hangs a headless run forever on a prompt no human will ever answer

`arm-prompt.ps1 -Name <slug>` with no `-Actor` does not fail. PowerShell binds `[Parameter(Mandatory
= $true)]` by **prompting on the console**, so the process sits waiting for input. In a scheduled run
there is no human, so it waits until something else kills it. Mine ran past the 180 s Desktop
Commander tool ceiling and returned a timeout error.

🔴 **The dangerous part is what the timeout looks like.** DOCTRINE §9.5 records a "180 s DC
timeout-but-succeeded" trap — a call that *did* complete while the tool gave up waiting. The correct
response to that trap is *do not re-run, read back the state* — and that is exactly what saved this:
`Get-ChildItem docs\pr-prompts\pr-ratescol-s0*` returned **`-HOLD.md`** and `*-ready.md` → **0**, so
the arm had **not** happened. **A re-run on the assumption "the timeout means it failed" would have
been correct here and wrong in the other case, and nothing in the timeout distinguishes them.** The
read-back is what discriminates, not the error.

[MEASURED] the cure: the same command with `-Actor station-00.0808` completed in seconds, `-WhatIf`
exit 0 then the real run exit 0. Terminated the hung session (PID 29988) only after proving it had
mutated nothing — `git diff --cached --name-status` EMPTY, file still `-HOLD.md` — per HARD STOP 5,
never kill without reporting what it was first.

DISPOSITION: **ACTIONED** for this run (armed correctly), and the general lesson is recorded here
rather than fixed in code, because `scripts/` is outside this station's merge lane. **What a future
run needs is one line: `arm-prompt.ps1` takes `-Name` AND `-Actor`, both mandatory.** ⚠️ Falsifying
probe: run it with `-Name` only from a headless session; if it exits non-zero instead of hanging,
this finding is dead.

### F2 — S3. Every arm available on this board lands on Marco, and that is now measured rather than assumed

`gates-satisfied=3`; one is a confirmed duplicate; the other two both fail all three
`NESTED_TEST_PATHS` forms. So there was no arm available this run that could auto-merge, and the one
I made will open a fourth PR that only Marco can land.

**I armed anyway, and the reason is a measurement that refutes the standing "arming faster makes the
queue longer" note for today.** That note assumes the board grows monotonically because Marco merges
rarely. [MEASURED] from the sweep's `MERGED (most recent 8)`: `#1911 #1912 #1913 #1914 #1915 #1916
#1917 #1921` all merged between `03:40Z` and `07:44Z` — **eight merges in about four hours**, on a
board holding three open PRs. Marco is actively clearing. On a moving board, keeping one slice in
flight is throughput; on a stalled one it is noise. **The discriminator is the merge rate, not the
open count**, and it should be re-measured every run rather than inherited from this one.

`pr-ratescol-s0` was chosen over `pr-crmvis-s0` on two grounds: it is 2 files against 5, and
`crmvis-s0`'s scope includes `docs/pipeline/stations/00-supervisor.md` — a canonical-block-gated
binding document, which is a materially riskier thing to hand an unattended code-writer. It is also
`cluster_order: 1` of a five-slice chain whose s1–s4 all read `GATE_NOT_RELEASED`, so it is the one
arm that unblocks four others.

DISPOSITION: **ACTIONED** — armed, read back, audit row written with a discriminating actor.

### F3 — S4. RULE 4's marker detector was controlled in both directions before the arm, and the prose read is what actually cleared it

The union grep returned **0/0/0** on the target. That is worthless on its own — DOCTRINE §9.6, a
negative control you cannot see fail. POSITIVE control `pr-524-rates-b-slice2-canonical-HOLD.md`, a
known `HUMAN_GATE_PRESENT`: `DO NOT ARM` (case-sensitive) → **1**, `Arm ONLY` → **1**. NEGATIVE, a
freshly minted needle → **0**. So the instrument can fire and did not.

Then the body was read, because §9.5 records that a **prose** gate matches neither regex and is
invisible to both instruments. `pr-ratescol-s0`'s body carries the `## STANDING AUTHORITY`
boilerplate (present on ~51 of 61 prompts, **not** an arming grant and not a gate) and an explicit
*"Open the PR … and leave it UNMERGED"*. No prose gate. `gate_allow: none`, `seed_only: false`,
`escalates: false`, no migration path, `design_ref` present.

DISPOSITION: **ACTIONED** — recorded as a confirmation that the documented detector works when run
with its controls, which is the only way it means anything.

### F4 — S3. `03` and `05` still read SILENT, and the run-slot probe handed forward by the 07:09Z run has NOT yet come due

`--freshness` exit 2: `03` 81.1h, `05` 90.0h. Crossed against the scheduled-tasks MCP, which is the
instrument the breadcrumb cannot be: both **enabled**, both `lastRunAt` on **2026-09-10**, and both
`nextRunAt` still in the **future** at the moment of this run — `05` at `14:10:37Z`, `03` at
`23:00:45Z`, against a run start of `08:08Z`. That is row 1 of the freshness table (the occurrence
never fired) and it is the already-recorded switched-off outage, not a station defect.

**I am not re-deriving this, and that is the point.** The 07:09Z run deferred it with an explicit
hand-off *"the 14:1xZ or 15:0xZ run owns `05`; the 23:0xZ+ run owns `03`"*. Neither slot has arrived.
Calling either station stopped now would be the §7 false alarm that licenses destructive action.

DISPOSITION: **DEFERRED**, carried forward **unchanged** to those two run-slots. What would make it
urgent, stated as a probe: **`nextRunAt` passing with `lastRunAt` unchanged.** At that point read the
session transcript before calling the station stopped — `lastRunAt` alone can never answer whether an
*earlier* occurrence fired.

### F5 — S4. Collected the 07:45Z addendum, which was untracked and reached nobody until this PR

`check-breadcrumb.mjs --freshness` printed `NOTE … is UNTRACKED — it reaches nobody until a board PR
commits it` against the 07:45Z addendum. Its own closing line says the same and asks for exactly
this. Both its findings are carried:

- its **F1** (the deliberate `0 137` deletion of `pr-ea-s2a-dashboard-preset-seed-HOLD.md`) —
  **DEFERRED again, unchanged**, and deliberately NOT actioned this run. Its instruction is *retire
  it once `#1920` merges*; `#1920` has **not** merged. Restoring the path would put an armable
  duplicate of an open PR back in the queue, and retiring it early would destroy the prompt if
  `#1920` were closed unmerged. **Leaving the deletion in place is the safe state, and my commit used
  a pathspec so it could not pick it up.**
- its **F2** (both fast-forward blockers reproducing in the documented order) — **ACTIONED**, closed
  by its own read-backs.

DISPOSITION: **ACTIONED** — swept into this PR at a tracked path. Note for the next run: per the
station doc's de-duplication rule, ask the TRACKED set (`git ls-files docs/pr-prompts`, matched by
basename) before ever committing a breadcrumb as unreported; a dev-tree `git status` answers about
the dev tree and will show this file as untracked forever.

### F6 — S3. Q6: the one most important thing blocking progress

**Every open PR on this board requires Marco, and no arm available today can change that.** Three
open PRs, three Marco classifications, `gates-satisfied=3` of which zero are tests-docs eligible.
This is the throughput constraint already on file, re-measured rather than re-raised.

DISPOSITION: **ESCALATED** — not as a new `needs-marco/` file. The constraint is already stated in
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`, and the one genuinely
new clause on it is the 07:09Z run's F6 question about giving a PR body's prose HOLD a machine form,
which is still open and which I am not restating. Adding a file per run to an already 52-deep queue
is the noise the standing rules warn about.

### F7 — S4. The Linux VM transport is down, so the PREFLIGHT git guard could not be installed

`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` failed before reaching the
script: the workspace could not mount, reporting the Plan9 share `c` *"is not mounted"* and naming a
**Windows update released September 8** as the cause. Quoted as required, pass or fail.

**This is benign THIS run and must not be generalised.** The guard exists to stop a VM-side `git`
call leaving a 0-byte `index.lock` against the Windows `.git`; with no VM there is no transport that
could do that, so the hazard is absent rather than unguarded. Desktop Commander — the only transport
that can RUN anything on the host — was fine throughout, so this run was **sighted**, not blind.

DISPOSITION: **DEFERRED** — already on file as
`needs-marco/cowork-vm-mount-unreachable-two-stations-2026-09-10.md`, and the 04:08Z breadcrumb
records the same double-transport loss. What would make it urgent: the VM returning while Desktop
Commander is absent, which is the combination in which the guard actually matters.

## WHAT I DID NOT DO

- **Did not merge anything.** All three open PRs are Marco's on live evidence: `#1918` and `#1920`
  carry genuine watcher `marco:true` verdicts, `#1920` additionally carries `do-not-merge`, and
  `#1919`'s body carries a prose HOLD. `Assert-SmokedOrEscalate` was never called, because there was
  nothing on this board I am permitted to put through it.
- **Did not remove a label, author a merge-approval receipt, or clear a `marco:true` verdict.** A
  scheduled run may never author a receipt.
- **Did not arm a second prompt** (RULE 4, one at a time), **did not arm `pr-crmvis-s0`**, and **did
  not arm `pr-fv2-import-s1-docx-and-persona`** — confirmed duplicate of open `#1918`.
- **Did not restore or retire `pr-ea-s2a-dashboard-preset-seed-HOLD.md`** — F5 above.
- **Did not touch the three stale worktrees** (`C:/po-fix1891`, `C:/PR-Master/worktrees/po-vg`,
  `C:/PR-Master/worktrees/pr1823`). `po-vg` **holds 1 uncommitted file** and is 14,416 min old;
  pruning it is Station 03's and `--force` would discard that work.
- **Did not update the three BEHIND branches.** `pollForBehindPrs` owns that; re-running it by hand
  is the churn the open escalation is about.
- **Did not restart the watcher.** `restart-watcher-if-wedged.ps1` was not needed: the sweep read
  node RUNNING pid 30976 with the wrapper alive, and an idle watcher with 0 armed prompts is CORRECT,
  not wedged. It now has one armed prompt to pick up.
- **Did not touch `/sot/`, Azure/Entra/SharePoint, or production data.**
