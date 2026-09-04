# Station 00 — Supervisor | 2026-09-04T15:08Z–2026-09-04T15:40Z

## GROUND

```
UTC            2026-09-04T15:08:00Z
origin/main    0b0920a9            (fetched, then rev-parse; moved to 1d538842 mid-run — see C1)
dev tree       main @ 0b0920a9     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md station_doc_version)
```

Doc version and bootstrap AGREE — full authority run, not read-only-on-mismatch.

**Not blind.** `start_process` shell `powershell.exe` returned `ALIVE` /
`2026-09-05T01:08:06+10:00` after a keyword `ToolSearch` for `desktop-commander`.

Dev tree HEAD was EQUAL to `origin/main` at start, and all three binding documents were confirmed
identical to `origin/main` by the sanctioned probe before I read them — `git diff --numstat
origin/main -- <path>` EMPTY for `00-supervisor.md`, `DOCTRINE.md` and `STATION-CAPABILITIES.md`.
I did not use the piped `hash-object` form (PREFLIGHT step 2).

## WHAT I MEASURED

`scripts/pipeline/status-sweep.ps1`, run twice — 15:08:39Z and again at 15:12:06Z immediately
before the board mutation, per the re-run rule.

- [MEASURED] Section 0 positive controls both LIVE (`gh` reached GitHub; `node` runs).
- [MEASURED] 4 open PRs, all CLEAN and green: **#1599** (9/9), **#1594**, **#1593**, **#1589** (14/14).
  main CI on `0b0920a9`: 4 success / 0 failed / 0 running — trunk green.
- [MEASURED] Section 3, the single-actor gate (DOCTRINE §9.5 names this section as the authority,
  not `list_sessions`): in-progress prompts **0** · `index.lock` interactive/clone **False/False** ·
  running `git` processes **0** · armed `*-ready.md` **0**.
- [MEASURED] Watcher node RUNNING, wrapper alive (1), heartbeat 42 min (ticks only mid-run; stale +
  empty queue = idle, not wedged). Watcher clone `branch=main dirty=3`.
- [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → **CLEAN**, exit 0.
  `00` 1.0h (cadence 2h) ok · `03` 16.1h (24h) ok · `04` 1.0h (4h) ok · `05` 1.0h (24h) ok.
  Structure: 6 checked, 0 malformed.
- [MEASURED] Section 7 verdict **CAUTION**, on one cause only: `C:/po-vg`
  `[fix/no-rebase-while-checks-run]`, dirty=1, **age 435 min**. See F5.

### RULE 2 — the lane probe, controlled, on the LIVE tree only

[MEASURED] `C:\ProjectOperations2\docs\pr-prompts\processed` (never the clone, §9.5):
**1899** logs, newest `2026-09-04T14:27:53Z` — younger than every open PR, which is the control
that separates the live directory from the eighteen-day-old decoy in the watcher clone.
POSITIVE `marco.:true` → **609**. NEGATIVE `zzzNoSuchNeedleZzz` → **0**.

| PR | verdict | lane |
|---|---|---|
| #1589 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: scripts/pipeline/lint-prompt.mjs"}` | watcher — **RULE 2 BINDS** |
| #1594 | `NO LOG` | `[NO LANE VERDICT — hand-classified]` → `scripts/` ⇒ **Marco's** |
| #1593 | `NO LOG` | `[NO LANE VERDICT — hand-classified]` → `scripts/` ⇒ **Marco's** |
| #1599 | `NO LOG` | **known station lane** — 05 → `sot/` doc-reconcile (§10.1 step 3) |

### The `$`-expansion control, run BOTH ways in one session

[MEASURED] 2026-09-04T15:1xZ, same machine, same shell, minutes apart, control `$CTRL=42`
(undefined at expansion time, so it MUST print empty if a pre-expansion layer exists):

| invocation | `$CTRL` | `$env:USERNAME` | `$true` |
|---|---|---|---|
| `start_process` `-File <script.ps1>` | `CTRL-literal-is:42` — **no expansion** | `Marco` | n/a |
| `start_process` `-Command "..."` | assignment arrives as bare `=42`, `CommandNotFoundException` | already substituted to `Marco` | `True` |

I hit the `-Command` form by accident on my first probe of the run, before I was looking for it:
`Write-Output ('EXIT=' + $LASTEXITCODE)` arrived as `('EXIT=' + )` and died as a parser error.

## WHAT CHANGED

- **PR #1599 MERGED.** Pre-state read `OPEN` / `mergedAt=` (empty) BEFORE the call, because
  `Merge-Pr` returns `$true` for an already-merged PR and cannot tell its own merge from someone
  else's (recorded in `needs-marco/discharged/_DISCHARGE-NOTE-sot-only-pr-merge-authority-2026-09-04.md`).
  `Assert-SmokedOrEscalate -PR 1599` → `True True`, exit 0. `Merge-Pr -PR 1599` → `True`.
  Read back: `post_state=MERGED post_mergedAt=2026-09-04T15:13:30Z merge_commit=1d538842`.
  `origin/main` `0b0920a9` → **`1d538842`**.
- **`docs/pipeline/DOCTRINE.md` §9.1 and §9.5 edited**, in a disposable worktree `C:\po-doc9` cut
  from `origin/main` @ `1d538842` on branch `docs/doctrine-s9-anchors-2026-09-04`. `--numstat` 49/16.
- **`docs/pipeline/stations/_canonical-blocks.json` re-recorded** —
  `node scripts/pipeline/lint-station.mjs --write-canonical` → `instruments v2 10124e8675c8f66d`.
  Before: `REJECT: 1 of 8`. After: **`ADMIT: all 8 docs clean`**, exit 0.
- **`docs/pipeline/sweep-rotation.json` committed** (`last_index=0→1`) — Station 04 advanced it and
  is forbidden to commit it. This PR discharges that.
- **Station 04's untracked breadcrumb committed** (`00-04-scanner-2026-09-04-1409-…`).
- This breadcrumb was written **inside this run's PR worktree**, not the dev tree — the cure the
  14:0xZ run added to `00-supervisor.md` after the FF blocker. No loose copy exists to block the
  next fast-forward.

Nothing was armed. No label was added or removed. No `do-not-merge` PR was touched.

## FINDINGS

### F1 — S2 · 04's §9.5 anchor drift: FIXED, and the fix is the anchoring rule itself

Station 04's F1 (breadcrumb `00-04-scanner-2026-09-04-1409-…`) measured **16 of 17** line-number
citations in DOCTRINE §9.5 wrong, all drifted ~90 lines, including `:728`/`:730`/`:732` — the three
arming markers RULE 4's detector is built on, which now hold `try {`, `} catch (_) {` and `}`.

Every one is now a **symbol or fixed-comment anchor**: `function readFromOriginMain` ·
the five `readFromOriginMain(` call sites · `LINT_GH_BIN` · `DO_NOT_ARM_COMMENT =` ·
`DO_NOT_ARM_CAPS =` · `ARM_ONLY =` · `HUMAN_GATE_PRESENT: line` · the `ls-tree -r` call ·
`p.lastIndexOf('/')` · `readdirSync(DIR)`. §9.5 also gains a leading bullet stating the rule and
recording that this section broke it sixteen times.

[MEASURED] verification, by node against the edited file: all ten anchors present exactly once;
`lint-prompt.mjs:439-459`, `lint-prompt.mjs:1164`, `line 1164`, `` `:492` ``, `` `:903` ``,
`` `:743` ``, `` `:98` ``, `` `:160` ``, `` `:162` `` all **0** occurrences. `U+FFFD` = 0.
The `U+00E2 U+20AC` double-encode signature = **2** after the edit and **2** on `HEAD` — both are
§9.3's own documentation of the signature, so nothing was damaged.

⚠️ **A trap I walked into while fixing it, and it belongs in this report.** My first edit run
inflated `DOCTRINE.md` from 62,963 to **86,732** bytes. Cause: JavaScript `String.replace` treats
`` $` `` in a *string* replacement as "everything before the match", and the replacement text I was
inserting quoted §9.1's own rule — *"Anything containing `` `$` `` goes in a `.ps1` file"* — so the
`` $` `` in that quotation spliced 23 KB of the preceding document into the file. It exited 0 and
wrote a valid, well-formed markdown file. **Cure: `s.replace(needle, () => replacement)`** — the
function form takes the replacement literally. This is §7's shape exactly, in the tool I reached
for to obey §9.3's *"edit docs with node"*, and the byte-count assertion is the only thing that
caught it. Worth adding to §9.3 next time §9 is opened; I did not fold it into this PR because
I would be editing the canonical block to describe the edit I was making to it.

**ACTIONED** — landed in this run's PR. Verified by the node check above and by `lint-station.mjs`
going `REJECT: 1 of 8` → `ADMIT: all 8 docs clean`, exit 0, after the canonical re-record.

### F2 — S3 · 04's F2 confirmed independently: the "13 arms published nowhere" figure is retired

[MEASURED] I re-ran §9.5's own falsifying probe: `git show origin/main:docs/pr-prompts/.arming-log.txt`
= **50** lines, working copy = **50** lines, both ending `2026-09-04T11:29:24Z ARMED
pr-lint-gate-path-space … by=Marco@ pid=31616`. The counts agree; the figure is dead and has been
deleted from §9.5 so it cannot be quoted again.

**The defect underneath is untouched and is kept in the text**: nothing commits the arming log
*on purpose*. It is published by luck, when a board PR happens to sweep it in — so the gap can
re-open at any time, and when it is open a clone reads a STALE arm history rather than none, which
is the more dangerous shape because it answers.

**ACTIONED** — the correction landed; the surviving defect is stated as the live half.

### F3 — S2 · 04's F3 is REFUTED, and the reason is that the prescribed cure hides the trap from its own control

Station 04 reported §9.1's `$`-expansion rule as **not reproducing** on the scheduled-Cowork
`start_process` path, and dispatched it to me as a possible retirement, correctly asking me to
re-run the `$CTRL=42` control in my own environment first.

I did. **It reproduces — on `-Command`.** The table under WHAT I MEASURED has both forms, taken
minutes apart in one session. The discriminator is the invocation, not the environment: `-File`
shows no expansion **by construction**, because `-File` is precisely the cure §9.1 prescribes.

🔴 **So a station that follows the cure and then measures the cure will always report "the trap does
not reproduce."** That is a §7 instrument lie wearing the clothes of a careful measurement, and it
was one dispatch away from retiring a live guard against the silent-wrong-value class. 04 did the
right thing at every step — it followed the cure, it labelled its result a non-reproduction rather
than a refutation, and it named the exact control that would settle it. The instrument still lied.

§9.1 now carries both measurements and the instruction to **run the control through `-Command`,
never through `-File`.** The bullet stands unqualified.

**ACTIONED** — landed in this run's PR.

### F4 — INFORMATIONAL · #1599 merged inside 05's recorded lane; the other three open PRs are Marco's

#1599 (`docs(sot): burn down 2 sot-ref baseline entries…`) is a Station 05 doc-reconcile:
`sot/06-active-specs.md` + `docs/qa/sot-refs-baseline.json` + 05's own breadcrumb. `sot/` + `docs/`
only, CP-24 clean by construction, and the PR body NAMES ITS LANE as §10.1 step 3 requires.
Precedent verified live, not assumed: **#1554** carried the byte-identical opening line
*"SoT governance doc — Marco reviews the rendered diff."*, the same file shape, and was merged
`2026-09-04T01:55:14Z`; the escalation behind the ruling is in `needs-marco/discharged/`.
That opening line is 05's standing boilerplate, not a per-PR gate — the ruling was made with it
in view.

**#1594, #1593 and #1589 were left alone.** #1589 carries a real watcher `marco:true` verdict.
#1593/#1594 read `NO LOG`; both touch `scripts/`, so hand-classification under §10.1 step 2 puts
them with Marco either way. **RULE 2 binds on all three, and PR #1596 — the agent-authored blanket
clearance now on `main` — does not lift it.**

**ACTIONED** (the merge) / **ESCALATED, already open** (the three).

### F5 — S3 · the sweep verdict has read CAUTION for four consecutive runs on one dead worktree

`C:/po-vg` `[fix/no-rebase-while-checks-run]`, dirty=1, **age 435 min**, is classified
`LIVE STATION WORKTREE` and is the *only* input to the CAUTION verdict. A station run takes 15–25
minutes; nothing has been live there for seven hours. Section 3 — the gate DOCTRINE §9.5 actually
names for the single-actor question — was entirely clear on both sweeps this run.

The 14:0xZ run already measured `po-vg` safe to prune and dispatched it to 03. It is still there,
and the cost is now cumulative: **a verdict that says CAUTION every run on a stale input teaches
its readers to route around the verdict**, which is the exact failure §7 warns about, in the
instrument every board mutation is required to consult.

**DISPATCHED** → Station 03 (repeat). Prune `C:/po-vg` after confirming its one dirty file is not
wanted, along with `C:/po-1483-fix`, `C:/po-guard`, `C:/po-sa-fix`, `C:/po-work/s2-e2e` and the two
registry escapees `C:\po-worktrees\fix-1523` and `…\vs-s2-durable-smoke`. Also: the watcher clone
reads `dirty=3` — hygiene, same lane.

### F6 — S3 · §10.3 still carries two bare line-number anchors of the same class as F1

[MEASURED] After the F1 edit, a scan of `DOCTRINE.md` for `` `:<digits>` `` leaves five hits: three
are inside my new §9.5 bullet quoting the *wrong* numbers on purpose, and two are real —
`index.mjs:1774` and `:1776` in §10.3, plus the prose `index.mjs:129-130` and `:1753-1757` in the
same section. I did not verify them and did not touch them: §10.3 sits **outside** the
`instruments v2` canonical block, so it is a separable edit, and fixing an anchor I have not
measured would be asserting a symbol name I did not check.

**DEFERRED** — it becomes urgent the moment someone reasons about the `tests-docs` timeout
mechanism from those lines. The falsifying probe is one command:
`git show origin/main:scripts/pr-watcher/index.mjs | sed -n '1770,1780p'` — if it does not show the
`marco: true` write, the anchors have drifted and want the same symbol treatment.

## WHAT I DID NOT DO

- **Did not arm anything.** Armed count 0 before and after. RULE 4's detector was not run because
  nothing was a candidate — and the two named never-arm-now prompts
  (`pr-cardui-s2-wbs-table-shell-HOLD.md`, `pr-tr-s1-reminder-policy-HOLD.md`) were not touched.
- **Did not merge #1589, #1593 or #1594.** RULE 2. See F4.
- **Did not honour or revert PR #1596**, the agent-authored blanket RULE 2 clearance on `main`.
  It is Marco's to rule on and is already escalated; acting on it either way would be an agent
  deciding its own gate.
- **Did not clear the `[STALE]` escalation refs** the sweep flagged in section 5 (dead PR refs
  across `agent-authored-rule-2-clearance-…`, `arming-log-is-tracked-…`,
  `hourly-board-pr-rebases-…`, `station-freshness-detector-…`, `station-schedule-collision-…`,
  `tests-docs-lane-starves-…`, `unattributed-arms-…`, `pr-1532-review-fix.md`,
  `pr-subbie-rate-cards-…`). Queue hygiene, Station 03's lane, and folding it into a doc PR would
  bury it. **DISPATCHED** with F5.
- **Did not touch `/sot/`** beyond merging 05's own PR, which is the one channel that may.
- **Did not re-derive escalation #23** (the freshness detector's `2×cadence` blindness) or #22
  (unattributed arms). Both open with Marco; `--freshness` read CLEAN this run and I crossed it
  against the breadcrumb dates, which agreed.
- **Azure / Entra / SharePoint: untouched.** Nothing this run went near them.
