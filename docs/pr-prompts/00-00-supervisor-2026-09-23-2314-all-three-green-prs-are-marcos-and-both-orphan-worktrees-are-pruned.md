# Station 00 — Supervisor | 2026-09-23T23:14:33Z–2026-09-23T23:2xZ

## FOR MARCO

**Three PRs are green, clean and finished, and every one of them needs you — not because anything
is broken, but because all three touch files outside `tests/` and `docs/`, which is the one thing no
station may merge.**

| PR | what it is | why it stops here |
|---|---|---|
| **#2135** | blocks `git reset` in the shared dev tree | watcher verdict `marco:true` — `.claude/hooks/guard.mjs` |
| **#2131** | `why-blocked.ps1` is an unconditional squash-merge that both docs called read-only | second lane; `scripts/pipeline/why-blocked.ps1` is outside `tests\|docs` |
| **#2127** | replaces a raw NUL byte with a Unicode escape in a composite sort key | watcher verdict `marco:true` — `apps/api/src/modules/field/field.service.ts` |

All three are **CLEAN, 15/15 green, unlabelled**. Nothing needs fixing; they need a merge decision.
This is not a new question — it is the standing escalation
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`, now on its third
consecutive board. **#2131 and #2135 both exist to repair this pipeline's own instruments**, which is
exactly the class that accumulates here.

Everything else this run was healthy or was fixed: the watcher is alive and on cadence, the queue is
correctly empty, nothing is armable, and the two orphan worktrees Station 03 dispatched to me are
**pruned**.

**No other question is being put to you.**

## GROUND

```
UTC            2026-09-23T23:14:33Z
origin/main    e3e3a471            (fetched in the dev tree, then rev-parse)
dev tree       main @ e3e3a471      C:\ProjectOperations2
doc version    1                    (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                    (station_doc_version declared by the scheduled-task file)
```

**Doc version and bootstrap AGREE (1 = 1).** This run was READ-WRITE eligible by that test.

**THIS RUN WAS SIGHTED, NOT BLIND.** `start_process` shell `powershell.exe` returned a live
interactive REPL (PID 28968) on the Windows host after the Desktop Commander schemas were loaded by
`ToolSearch`. Stated explicitly because a blind run and a healthy quiet run both produce "no news",
and this is the healthy-quiet kind.

**Which tree I read in:** the dev tree `C:\ProjectOperations2`, as PREFLIGHT step 2 requires.
`git rev-list --left-right --count HEAD...origin/main` → `0	0`, and
`git diff --numstat origin/main -- <each of the three binding documents>` returned **EMPTY** at exit
0 for all three, so the working copy is byte-identical to `origin/main` and the working-copy reads
are authoritative. I used the `--numstat` form, never a piped hash (§9.1 forbids the pipe in
`powershell.exe`).

## WHAT I MEASURED

### Device-bridge git guard — the PREFLIGHT install, quoted as the contract demands

`bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` — last line, verbatim:

```
   PATH="/sessions/busy-stoic-gates/.local/bin:$PATH" git <args>
```

**EXIT CODE: 2**, read from the installer itself and not from a pipeline appended to it. That is the
middle outcome of the contract's three-outcome table: `vm-git-guard INSTALLED BUT INERT - the shim is
correct and UNREACHABLE from your shell.` Its own controls printed in the output —
`bash -lc 'command -v git'` → the shim; `bash -c 'command -v git'` → `/usr/bin/git`. [MEASURED] So
the device-bridge git ban was **REMEMBERED, not mechanical**, for this run, and I honoured it: every
`git` call below ran in `powershell.exe` on the Windows host, none through the bridge against a mount.

### PREFLIGHT step 4 — the sweep

`scripts\pipeline\status-sweep.ps1`, captured with `*>` and decoded as `utf16le` in node.
[MEASURED] the capture was **139,916 bytes opening `FF FE`** — §9.3's `*>` UTF-16LE trap, reproduced
exactly, inside the cure PREFLIGHT itself prescribes. Decoded: **404 lines**, seven sections.
Section 7 verdict, verbatim:

> `[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**Section 0 instrument positive controls both PASSED** (`gh` reached GitHub, saw merged #2138; node
runs). No `[BROKEN]` anywhere, so the report is usable.

🔴 **Section 5 produced ZERO `[STALE]` rows this run.** Every section-5 line is the
`cites #N (MERGED) as evidence -- not its premise` form, which explicitly does **not** clear an
escalation. **So the `[STALE]`-discharge obligation my own station doc puts on COLLECT is empty
today — there is nothing to move to `needs-marco/discharged/`.** Stated as a measurement rather than
passed over, because an absent obligation and an unperformed one read identically in a report.
`needs-marco/` holds **47** files. ⚠️ That is STATE — re-measure it, never quote it.

### The board — every open PR, its lane, and its verdict

[MEASURED] `gh pr view <n> -R GH-Mantova/ProjectOperations --json number,state,title,headRefName,createdAt,mergeStateStatus,labels,files`,
per PR, `-R` on every call and `$LASTEXITCODE` tested before parsing (§9.4's CWD bullet):

| PR | mergeState | labels | files |
|---|---|---|---|
| #2135 | CLEAN | **none** | `.claude/hooks/guard.mjs` · `scripts/pipeline/__tests__/guard-devtree-reset.test.mjs` |
| #2131 | CLEAN | **none** | `docs/pipeline/SCRIPT-REGISTRY.md` · `docs/pipeline/stations/00-supervisor.md` · `scripts/pipeline/why-blocked.ps1` |
| #2127 | CLEAN | **none** | `apps/api/src/modules/field/field.service.ts` · `docs/pr-prompts/superseded/pr-field-service-nul-separator-HOLD.md` |

**CI: 15 pass / 0 fail / 0 pending on all three**, from the sweep's `[LIVE]` lines. **Trunk green**
on `e3e3a471` (4 success / 0 failed).

**DIRTY count: ZERO.** No PR on this board has frozen CI. The board is not stuck on a conflict; it is
stuck on merge authority, which is a different thing and has a different remedy.

### §10.1 step 1 — the lane probe, with both controls

[MEASURED] `Select-String -Path docs\pr-prompts\processed\pr-*.log -Pattern 'PR #<n>\b'` — the
PROMPT logs alone, `rev-*` excluded (§9.5), run in the **dev tree** `C:\ProjectOperations2` and never
the watcher clone's decoy copy:

| PR | hits | verdict line |
|---|---|---|
| **#2135** | **1** | `[watcher] merge result for PR #2135: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}` |
| **#2131** | **0** | no watcher log names it ⇒ **second lane** |
| **#2127** | **2** | `PR #2127 shipped and verified.` · `[watcher] merge result for PR #2127: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}` |
| #2138 — a station's own board PR | 0 | POSITIVE control that `NO LOG` means *second lane*, not *probe broken* |
| #999321 — freshly minted | **0** | NEGATIVE control |

**Decoy-directory control, which is the only one that separates the live corpus from the clone's
corpse (§9.5):** the probe directory holds **2,409** logs and its newest is
`rev-2138-ready.md.log` at **2026-09-23T22:38:41Z** — younger than the oldest open PR (`#2127`,
created `16:36:48Z`). So this is the live directory, not the seventeen-day-stale clone copy.

**Anti-scrape cross-check (§10.1, `PRNUMBER_SCRAPED_FROM_PROSE_V1`):** both verdicts survive it. Each
sits in a `processed/<prompt>.md.log` whose prompt name matches the PR's own subject —
`pr-devtree-sync-ff-only-guard-ready.md.log` for #2135's dev-tree reset guard, and
`pr-field-service-nul-separator-ready.md.log` for #2127's NUL-separator fix — so neither number was
scraped out of unrelated prose.

### The queue

[MEASURED] `Get-ChildItem docs\pr-prompts -File`, depth 1 only:
**armed (`*-ready.md`) = 0** · **`*-HOLD.md` = 13**. `.queue-state.json` independently reported
`armed: 0` to Station 03 twelve minutes earlier. An idle watcher with zero armed prompts is
**correct**, not wedged.

`scripts\pipeline\triage-holds.ps1`, exit **0**, decoded from its UTF-16LE capture:

```
=== TOTALS  spent=0 of 13 evaluated  gates-satisfied=1  still-gated=12  unreadable=0
```

Its own SPENT fixture control **PASSED** (`lint-prompt.mjs` emitted exit 3 on the fixture), so the
SPENT bucket was measurable and genuinely empty rather than unreachable. The duplicate-check control
read **3 open PRs from the board and scanned 1 admitted prompt**, and found **no** possible
duplicates.

### Watcher and machines

Not re-derived — Station 03 measured all of it at `23:04–23:15Z`, ten minutes before this run, and
its findings are collected below. The sweep's independent `[LIVE]` reading agrees: watcher node
**RUNNING pid 38776**, auto-restart wrapper **alive**, heartbeat 38 min (ticks only mid-run; stale
heartbeat + empty queue = idle, **not** wedged). `index.lock` absent in both trees, **0** git
processes touching our trees, no PR touched on GitHub in the last 2 minutes.

## WHAT CHANGED

**1. Both orphan worktrees are PRUNED.** This is Station 03's F3 dispatch, executed and read back.

```
git worktree remove C:\po-wt\rel06    -> exit 0
git worktree remove C:\po-wt\s9hex    -> exit 0
```

Read-back, all four probes:

| probe | result |
|---|---|
| `git worktree list` | **one line** — `C:/ProjectOperations2 e3e3a471 [main]` |
| `Test-Path C:\po-wt\rel06` / `C:\po-wt\s9hex` | **False / False** |
| `git diff --numstat` in the dev tree | **EMPTY** |
| `git diff --cached --name-status` in the dev tree | **EMPTY** |

Safe-to-act was **re-measured in the same call immediately before the first removal**, not carried
from the sweep 8 minutes earlier (§7: `[LIVE]` means "true when measured"): `index.lock` False in
both trees, **0** `git.exe` processes touching our trees.

I did **not** delete the branch `board/release-gates-and-06-handover-2026-09-24` that `rel06` was
checked out on. Branch deletion is irreversible and therefore Marco's (DOCTRINE §5.4); removing a
worktree is not.

**2. This breadcrumb, and Station 03's, land in this run's own PR.** Written inside the PR worktree
(`C:\po-wt\collect2314`), which is cure 1 of the REPORT CONTRACT — so no loose copy of *my* report is
left in the dev tree. Station 03's breadcrumb had to be copied in from the dev tree, because 03
cannot open a PR (STATION-CAPABILITIES §5) and the dev tree is its only sanctioned home.

**3. Two fully-dispositioned breadcrumbs archived** — `00-00-supervisor-2026-09-23-2214-…` and
`00-04-scanner-2026-09-23-2210-…`, both collected by `#2137`/`#2138`. `git mv` to
`docs/pr-prompts/archive/` in this PR. This is safe for freshness: `check-breadcrumb.mjs` builds its
tracked set with `git ls-tree -r` and matches by trailing path segment, so an archived breadcrumb
still counts (§9.5). The CURRENT cycle — 03's 23:04Z report and this one — stays in the root.

**Nothing else.** No merge, no arm, no label change, no `/sot/` edit, no production data, no process
killed or started.

## FINDINGS

### F1 — All three open PRs are Marco's, by three different routes, and that is the whole of what blocks this board.

Measured per-PR above. The three routes, because they matter to the remedy:

- **#2135 and #2127** carry live watcher `marco:true` verdicts. **RULE 2 binds absolutely** — no
  station may clear a watcher routing verdict, and neither verdict is the byte-identical *timeout*
  shape §10.3 warns about: both name a specific offending path in their `reason`, which the timeout
  path does not produce (`"timeout waiting for green checks + MERGE verdict"`).
- **#2131** has no watcher verdict at all, so §10.1 step 2 applies: hand-classify by
  `classifyPolicyFiles`. Its `scripts/pipeline/why-blocked.ps1` is outside all three
  `NESTED_TEST_PATHS` forms, so the PR is **Marco's**. It is **not** rescued by step 3's station-lane
  exception: 00's recorded lane is `docs/`, and this PR is not docs-only.

🔴 **The necessary-vs-sufficient trap was live here and I did not take it.** `#2131` is green,
clean, unlabelled and watcher-unrouted — the exact four properties that
`STATION-CAPABILITIES.md` §5's retired clause once read as authorisation to merge, and that its
`NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` narrowing removed on 2026-09-22. This is the
second consecutive board on which that narrowing has done real work, and both times the PR it
protected was **an instrument-repair PR** — the class a station is most tempted to merge itself.

**DISPOSITION: ESCALATED** — to the existing file
`needs-marco/instrument-repair-prs-cannot-reach-main-without-you-2026-09-10.md`, **not** a new one.
Filing a fresh escalation for a third instance of a known class is the re-diagnosis the brief
forbids. What is new and worth Marco's eye is the composition: **3 of 3 open PRs, zero DIRTY, zero
armed prompts, and a green trunk** — the board is not congested, it is *finished*, and its entire
remaining throughput is one human decision. **RULE 1 on the options I can offer him:**

1. **Complete-and-additive (this one):** merge all three. Each is green with 15/15 checks, each has a
   named single-purpose diff, and two of the three repair this pipeline's own instruments — `#2135`
   installs the guard that stops `git reset` in the shared dev tree, and `#2131` corrects a script
   both binding documents describe as read-only while it is in fact an unconditional squash-merge.
   Merging solves it immediately (the board empties) and for the future (the guard and the corrected
   script are permanent), and it damages no data entry: none of the three writes data, and `#2127` is
   a pure correctness fix to a sort key.
2. **Incomplete alternative — merge only `#2135` and `#2131` and leave `#2127`.** Fails the
   **immediate** half: `#2127` is a live correctness defect in `field.service.ts` shipping a raw NUL
   byte into a composite sort key, so deferring it leaves a real bug on `main`. It passes the
   future/data half.
3. **Incomplete alternative — merge nothing this cycle.** Fails **both** halves. `why-blocked.ps1`
   stays an unconditional squash-merge that two binding documents call read-only, which is a merge
   hazard aimed at exactly the agents told to trust those documents; and the dev-tree reset guard
   stays unlanded, which leaves the `git reset` class §9.2 forbids protected only by memory.

---

### F2 — Station 03's F3 prune dispatch is CORRECT, and the probe it prescribes for confirming it is WRONG on one of the two worktrees.

03's F3 ends with an explicit instruction to whoever prunes: *"do not reach for `rev-list --count` or
a two-dot diff… The sound probe is the three-dot diff crossed against the two-dot diff"*, and asserts
of both worktrees that **"not one of those paths appears in the two-dot diff"**. [MEASURED] at
`e3e3a471`, immediately before pruning:

| worktree | tracked_dirty | 3-dot paths | 2-dot paths | **3-dot paths still in the 2-dot diff** |
|---|---|---|---|---|
| `C:\po-wt\s9hex` | 0 | 16 | 42 | **0** ✅ — as 03 states |
| `C:\po-wt\rel06` | 0 | 4 | 10 | **2** ❌ — **not** as 03 states |

The two survivors in `rel06` are
`docs/pr-prompts/00-06-pr-master-2026-09-24-1200-…md` and
`docs/pr-prompts/pr-devtree-sync-ff-only-guard-HOLD.md`.

🔴 **A run applying 03's stated probe literally reads `rel06` as holding unlanded work and refuses
the prune it was dispatched to perform.** The dispatch would then bounce between 03 and 00
indefinitely, each run re-spending the same four-instrument measurement — which is the exact cost 03's
own option (2) names.

🔧 **The prune is still right, and the reason is per-path, not per-diff.** I settled each survivor
individually:

| survivor | probe | result |
|---|---|---|
| the 06 breadcrumb | `git rev-parse origin/main:docs/pr-prompts/archive/<basename>` vs. `git -C rel06 rev-parse HEAD:docs/pr-prompts/<basename>` | **`8a63486b…` on BOTH sides** — a pure rename into `archive/`; `main` holds the identical blob |
| the consumed HOLD | `git cat-file -e origin/main:docs/pr-prompts/pr-devtree-sync-ff-only-guard-HOLD.md` | **exit 128** (absent), against POSITIVE control `origin/main:CLAUDE.md` → **exit 0** |

The HOLD is **spent, not unlanded**: it was armed and consumed into `#2135`, which its own
`processed/pr-devtree-sync-ff-only-guard-ready.md.log` records by number. And it could never have
armed anything from a worktree — the watcher's `READY_PATTERN` is `/^(pr|rev)-.*-ready\.md$/i`, which
a `-HOLD.md` cannot match, and `PROMPT_DIR` resolves to the watcher's own repo root.

⚠️ **The mechanism 03 names is real and nothing about it is retired** — squash merges keep the
merge-base pinned, so `rev-list --count` and the two-dot diff both over-report. What is corrected is
only the claim that the three-dot/two-dot cross therefore returns a clean zero on both worktrees. **It
returns zero when `main` has moved the path *nowhere*, and a false positive when `main` has RENAMED
the path** — `--name-only` compares paths, not blobs, so a rename is indistinguishable from unlanded
work at that level. **The complete probe has a third step: for any survivor, compare the BLOB on both
sides, and treat equal blobs as landed.**

**DISPOSITION: ACTIONED** — both worktrees pruned this run, read back four ways under WHAT CHANGED.
The corrected probe is recorded here rather than sent to `/sot/` or DOCTRINE, because it is a
correction to one station's report and not to binding law; if it recurs on a third worktree it earns
a DOCTRINE §9.2 bullet and I will say so then.

---

### F3 — Nothing is armable: 13 HOLDs, exactly one gate-satisfied, and that one is on the never-arm list.

[MEASURED] `triage-holds.ps1` exit 0: `gates-satisfied=1`, and the single name in that bucket is
**`pr-fv2-formrule-contract-HOLD.md`**.

🔴 **That prompt is named verbatim on my own station doc's never-arm list** — *"`pr-fv2-formrule-contract`,
`pr-siteid-notnull-backfill`, and any prod-data prompt (MT-3/MT-5) — those are Marco-run."* So the
one prompt whose gates are satisfied is the one prompt I may not arm, and **`ADMIT` is necessary, not
sufficient** (§9.5) is doing its job rather than being quoted at it.

The remaining 12 are correctly gated: **8** `HUMAN_GATE_PRESENT`, **3** `FILE_GATE_NOT_RELEASED`,
**1** `GATE_NOT_RELEASED`. The script re-probed all 12 directly and found **0 spent behind a
REJECT**, so none of them is shipped work sitting gated.

**DISPOSITION: ACTIONED** — checked and deliberately not armed. This is the second consecutive run to
reach this verdict (`#2137` reported the same of the same thirteen), and the composition has not
moved.

---

### F4 — Station 03's F1: the watcher died `raw node exit: -1` and the keepalive had it back in 4 m 51 s. Eighth occurrence in fourteen days, eight recoveries.

03 measured the death at `2026-09-23T18:35:05Z`, 59 s into a build, with the relaunch at `18:39:56Z`
and the killed job's verdict (`pr-2129-review.md`) present in `C:\po-watcher\verdicts-archive\` — all
three homes checked, not one. **No work lost.** The new information is the *rate*: 8 deaths across
the 10 newest daily logs, every one followed by recovery.

**DISPOSITION: DEFERRED**, and 03's own disposition is carried unchanged. The crash class is already
Marco's in `needs-marco/watcher-launcher-chain-unversioned-2026-09-04.md`; a ninth instance of a
known class is not a new question. **What would make it urgent, verbatim from 03 because its triggers
are better than any I would invent:** a recovery exceeding one keepalive interval (10 min), a daily
log whose launcher-banner count goes above ~5 (the kill-loop signature — 09-18 hit 269), or any death
where the started job's verdict is absent from **all three** homes.

---

### F5 — Station 03's F2: the clone's stash closed loop is at 77, up from the 71 DOCTRINE records.

+6 in 13 days, ≈0.46/day, strictly monotonic — the launcher auto-stashes a tracked-dirty clone on
every start and nothing ever pops. Harming nothing today: the clone reads `--untracked-files=no`
clean and the watcher is running.

**DISPOSITION: DEFERRED**, 03's disposition carried. **Urgent at** ~150 entries, any stash-related
`git` failure in the clone, or the clone's `.git` growth becoming a disk question. The remedy when it
comes is `git stash drop`, **never `pop`** (§9.2). I did not run it: the clone is a shared tree and
the watcher is live in it.

---

### F6 — Station 03's F4: `.queue-state.json` still carries `#1960` in `conflictedPrs`, 7.8 days after that PR closed unmerged.

03 measured it per-PR and live (`gh pr view 1960 --json number,state,closedAt,mergedAt` →
`CLOSED`, `mergedAt: null`), with a negative control (`gh pr view 999997` → exit 1) that avoids
§9.4's `--json number` fabrication trap. The list is **still exactly `[1960]`** — it has not grown.

**DISPOSITION: DEFERRED**, 03's disposition carried. One stale integer in a diagnostic field.
**Urgent at** 5+ entries, or on any evidence the watcher *acts* on `conflictedPrs` rather than merely
reporting it — which 03 correctly marks `[CANNOT MEASURE]` rather than assuming inert.

---

### F7 — Station 03's F5 and F6: the sweep's clone-dirty warning and the INERT git guard, both re-confirmed as documented behaviour.

**F5 (clone dirty):** 03 re-ran §9.5's falsifying probe — both `git status` forms against the clone in
the same minute — and got **1** (`?? docs/pr-reviews/pr-2127-review.md`) against **0**. The forms
still disagree, so the bullet stands and the correct response is **to recognise it and not dispatch**,
which is what 03 did and what I am confirming rather than re-routing to 03 as clone hygiene. That
mis-routed dispatch has happened 13 times by DOCTRINE's own count.

**F6 (git guard):** exit **2**, INERT. I reproduced the identical outcome independently in this run
and quoted it under WHAT I MEASURED.

**DISPOSITION: DEFERRED** for both — each is expected, documented behaviour with a live falsifying
probe attached, and both probes were run this cycle rather than quoted.

## WHAT I DID NOT DO

- **Merged nothing.** All three open PRs are Marco's by measurement, not by caution (F1). `#2135` and
  `#2127` carry live watcher `marco:true` verdicts, which no station may clear; `#2131` is
  second-lane and outside both `tests|docs` and 00's own `docs/` lane. I did not reach for
  `Assert-SmokedOrEscalate` on any of them, because the primitive refuses them and the answer would
  not have been mine to override anyway.
- **Armed nothing.** The one gate-satisfied HOLD is on the never-arm list (F3). I did not arm a second
  prompt "since the first was blocked" — arming is ONE AT A TIME and the count today is zero.
- **Removed no `do-not-merge` label**, and there was none to remove: all three PRs are unlabelled.
  Only Marco removes that label in any case.
- **Filed no new `needs-marco/` escalation.** F1 belongs to a file that already exists; opening a
  fourth copy of it would make Marco's queue longer and his decision no clearer. `needs-marco/` is at
  47 files and 03's and my findings added none.
- **Discharged no `[STALE]` escalation rows**, because the sweep produced none this run. Stated as a
  measurement under WHAT I MEASURED so an empty obligation is not mistaken for a skipped one.
- **Did not delete the branch `board/release-gates-and-06-handover-2026-09-24`** left behind by the
  `rel06` worktree. Branch deletion is irreversible (§5.4) and therefore Marco's; removing the
  worktree directory is not, and that is all I did.
- **Did not do 03's, 04's or 05's work.** I re-verified 03's F3 before executing it, which the
  re-read rule requires, and collected the other five findings rather than re-deriving them. I did
  not re-run the watcher chain resolution, the freeze-probe sampling or the daily-log analysis: 03
  measured all of it ten minutes earlier with its own controls.
- **Did not re-diagnose the 2026-09-18 kill-loop episode** (269 launcher banners) that surfaced in
  03's rate table. It is on record and outside this run's window.
- **Did not run `git` through the device bridge against either Windows `.git`**, the guard having
  installed INERT; and ran no `git checkout .`, `reset --hard`, `stash pop` or `git clean` anywhere —
  consumed prompts come back armed.
- **Did not touch Azure, Entra or SharePoint**, and wrote no production data. Absolute, and not
  reasoned past.
- **Did not commit anything on `main` in the dev tree.** This report goes through a PR from an
  isolated worktree off `origin/main`, torn down after the merge.

<run-summary>Sighted run: the board is finished rather than congested — three green, clean, unlabelled PRs and every one of them is Marco's by measurement, with zero DIRTY, zero armed and a green trunk — and the only work available to me was Station 03's worktree prune, which I re-verified, corrected the confirming probe for, and executed.</run-summary>
