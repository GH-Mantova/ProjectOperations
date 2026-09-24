# Station 00 — Supervisor | 2026-09-24T03:10Z–2026-09-24T03:30Z

## GROUND

```
UTC            2026-09-24T03:10Z
origin/main    ea1d6500              (fetched, then rev-parse)
dev tree       main @ ea1d6500       C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap **AGREE** (both `1`). This run was not read-only-by-mismatch and acted in
full authority.

**Sighted run.** `start_process` shell `powershell.exe` answered on the first call after the schema
load — `hostname` → `LAPTOP-E6NHU4E4`, `git rev-parse --abbrev-ref HEAD` → `main`. Nothing below is a
GitHub-side substitute for a dev-tree read.

**Which tree I read the binding documents in.** The dev tree, `C:\ProjectOperations2`. PREFLIGHT
step 2's *"read from `origin/main`"* is satisfied by measurement rather than by transport:
`git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md docs/pipeline/DOCTRINE.md
docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY** and
`git rev-list --left-right --count HEAD...origin/main` returned `0	0`. [MEASURED] All three working
copies are byte-identical to `origin/main`. No piped `hash-object` comparison was made (§9.1 —
unsound in PowerShell).

---

## WHAT I MEASURED

**vm-git-guard installer.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`.
Headline, verbatim: `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your
shell.` Last line, verbatim:

```
   PATH="/sessions/peaceful-determined-cori/.local/bin:$PATH" git <args>
```

**EXIT CODE = 2**, read from the installer itself and not from a pipeline appended to it. [MEASURED]
This is the expected middle outcome for a station: the device-bridge git ban is REMEMBERED this run,
not mechanical. No `git` ran through the device bridge against a mounted `.git` at any point — every
`git` below ran in a PowerShell shell on the Windows host.

**status-sweep.ps1.** `SWEEP_EXIT=0`. Captured with `*>` and decoded `utf16le` in node (§9.3 — the
capture was indeed UTF-16LE), 402 lines. The call outran the 180 s MCP cap; per §9.1 I treated the
subsequent `Process has finished execution` as a claim to falsify and **drained the buffer with
explicit offsets** rather than abandoning the shell — `SWEEP_EXIT=0` and the decode marker were both
sitting in it. The same shell (PID 17908) carried the entire run.

- Section 0 positive controls: `gh CAN reach GitHub (saw merged PR #2149)`, `node runs`. **Both PASS.**
- §7 VERDICT at 03:11:59Z: **`CAUTION`** — no local lock, but a PR touched on GitHub inside 2 min.
  Re-measured before acting; see WHAT CHANGED.
- Board: 4 open PRs (#2148 #2135 #2131 #2127). Queue: `armed: 0` · needs-marco 48 · no-pr-opened 111
  · failed 59 · blocked 150. Backlog gates: `ready=1 needs-marco=2 blocked=4 broken=0`.
- Watcher: `node RUNNING pid 38776`, wrapper alive (1), heartbeat 3 min, no non-main worktrees.
- Section 5 produced exactly one `[STALE]` row: `pr-2142-review-fix.md`. It was **not** cleared on
  that tag (F4).

**COLLECT — `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `CLEAN`, exit 0.** Crossed
against `lastRunAt` from the scheduled-tasks MCP, which is a different instrument and the only one
that can separate *did not fire* from *ran and did not report*:

| station | `--freshness` | `lastRunAt` (MCP) | newest breadcrumb | reading |
|---|---|---|---|---|
| 00 | `0.3h ago (cadence 1h) ok` | `03:10:11Z` (this run) | 03:00Z | aligned |
| 03 | `4.2h ago (cadence 24h) ok` | `2026-09-23T23:02:54Z` | 23:04Z | aligned |
| 04 | `1.1h ago (cadence 4h) ok` | `2026-09-24T02:09:41Z` | 02:10Z | aligned |
| 05 | `12.9h ago (cadence 24h) ok` | `2026-09-23T14:22:41Z` | 14:23Z | aligned |

**No station is SILENT and none is mid-run-with-no-breadcrumb.** Cadence read live from the MCP, never
from a document: `00` is `5 * * * *` (hourly), `03` `0 9 * * *`, `04` `0 */4 * * *`, `05` `10 0 * * *`.

**Breadcrumbs since my last run, and which were uncollected.** `git ls-tree -r --name-only origin/main
-- docs/pr-prompts/` (trailing slash AND `-r`, §9.2), matched by basename — asked of `origin/main` and
never of the dev tree's index (§9.5, `TRACKED_SET_PROBE_MUST_ASK_ORIGIN_MAIN_V1`):

- `00-00-supervisor-…-0214-…` — **tracked**, its own findings self-dispositioned. Archived this run.
- `00-00-supervisor-…-0300-…` — **tracked**, same. Archived this run.
- `00-04-scanner-…-0210-…` — **UNTRACKED**, absent from `origin/main`. Its F1 and F5 were dispositioned
  by neither prior run (the 02:14 run was already in flight when 04 wrote it; the 03:00 run collected
  nothing from 04). **They are mine, and they are dispositioned below.**

**04's one handover to 00 was already discharged and I did not do it twice.** 04's `WHAT CHANGED` says
*"Station 00: `docs/pipeline/sweep-rotation.json` needs committing with your next board PR."*
[MEASURED] `git diff --numstat origin/main -- docs/pipeline/sweep-rotation.json` → **EMPTY**, and
`git show origin/main:docs/pipeline/sweep-rotation.json` carries `"last_index": 2`,
`"last_run_utc": "2026-09-24T02:20:05Z"` — 04's advance is already on `main`, swept in by the 02:14
run (its F8). Acting on the handover would have been a second commit of a landed change.

**Lane classification for every open PR — §10.1 step 1, prompt logs only, `rev-*` excluded.**
POSITIVE control `marco.:true` over the same corpus → **706**; NEGATIVE control `PR #999997` → **0**.
The probe pinned to `C:\ProjectOperations2\docs\pr-prompts\processed`, never the clone's decoy (§9.5).

| PR | hits | verdict line, verbatim | lane |
|---|---|---|---|
| #2148 | 2 | `{"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - PR already carries \`do-not-merge\` - no duplicate apply"}` | **Marco's** — RULE 2 *and* the label |
| #2135 | 1 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .claude/hooks/guard.mjs"}` | **Marco's** — RULE 2 |
| #2127 | 2 | `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/field/field.service.ts"}` | **Marco's** — RULE 2 |
| #2131 | **0** | — | **`[NO LANE VERDICT — hand-classified]`** |

#2131 hand-classified under §10.1 step 2: files are `docs/pipeline/SCRIPT-REGISTRY.md`,
`docs/pipeline/stations/00-supervisor.md` and **`scripts/pipeline/why-blocked.ps1`**. That third path
is outside `NESTED_TEST_PATHS` and outside 00's recorded `docs/` lane, so step 3's station-lane
exception does not reach it. **Marco's.** *"Not watcher-routed" is a necessary condition, never a
sufficient one* (`STATION-CAPABILITIES.md` §5, `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1`).

**So all four open PRs are Marco's, by two independent routes between them, and there was no merge
available to this station.**

**Trunk.** `gh run list --commit <full 40-char SHA>` (§9.4 — the short form answers `[]` at exit 0):
`CI` success · `Deploy` success · `Push on main` success · `Claude Code` skipped · `Tendering Browser
Smoke` in_progress. Nothing failed on `ea1d6500`.

**Single-actor gate, re-measured immediately before the one board mutation** (`[LIVE]` means true when
measured, not true now):

```
NOW=2026-09-24T03:19:52Z
lock_dev=False  lock_clone=False
git_processes=0
PR 2148 / 2135 / 2131 / 2127 all updated 7.6–7.8 min ago
```

All four last touched ~03:12Z, which is `#2149` merging at 03:08Z plus the ~100 s branch auto-update
the 02:14 run's F4 already measured — **not a second actor.** No local lock, no git process, no board
activity inside two minutes. Condition 3 **SATISFIED** at the moment of acting.

---

## WHAT CHANGED

**1. Renamed PR #2148's title — the one red on the board that was a real defect.**
`gh pr edit 2148 -R GH-Mantova/ProjectOperations --title "feat(auth): stop writing sign-in codes and
reset links to the production log"`, exit 0. Read back: `title=feat(auth): …`,
`labels=do-not-merge`, `mergeState=BLOCKED`. **The label was not touched.** Evidence and root cause
in F1.

**2. Corrected DOCTRINE §8.5's `reports/` row** (04's F5). Edited with node by **concatenation**, never
a replacement string (§9.3 — `String.replace` reads `$` in a replacement as a substitution pattern).
Read back: `occurrences=1`, `bytes 217258 → 219279`, `actual_delta=2021`, `expected_delta=2021`,
`delta_matches=true`, `old_gone=true`, `marker_present=true`; `git diff --numstat` → `33 1`. The byte
delta was asserted, so nothing spilled. §8.5 sits at the top of the document and is **outside** the
hash-gated `CANONICAL-BLOCK: instruments v2`, so no hash re-record and no seven-doc ship is needed.

**3. Folded 04's F1 into the existing stale-remote-heads escalation** rather than filing a fourth
one. Appended to `needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md`:
`bytes 7794 → 10892`, `actual_delta == expected_delta == 3098`, `original_head_intact=true`,
`marker_present=true` (`FIX1483_IS_NOT_A_LANDED_HEAD_V1`). Confirmed **untracked**
(`git ls-files --error-unmatch` exit 1) before writing, so it cannot ride into anyone's commit —
and therefore it reaches nobody on its own, which is why it is stated here.

**4. Discharged the one `[STALE]` escalation, and not on the tag.** `pr-2142-review-fix.md` →
`needs-marco/discharged/`, byte-exact (525 → 525), original **moved, never deleted**, with
`_DISCHARGE-NOTE-2026-09-24-0324-pr-2142-review-fix.md` beside it recording every probe. Evidence in F4.

**5. Swept and archived breadcrumbs.** 04's untracked 02:10Z breadcrumb copied into this PR's worktree
byte-exactly (`23136 → 23136`, `byteExact=true`) at `archive/`; the two already-tracked 00 breadcrumbs
`git mv`-ed to `archive/`. This breadcrumb was written **inside the PR worktree** (Cure 1), so no loose
copy is left in the dev tree and the post-merge fast-forward cannot be blocked by it.

**Dev tree state throughout: `git status --porcelain --untracked-files=no` EMPTY**, checked after every
write. Nothing of anyone else's was staged, and nothing was committed on `main`.

**Nothing armed.** Nothing merged. No label added or removed. No `/sot/` edit.

---

## FINDINGS

### F1 — #2148's third red was real, and its cause is that the build agent titled the PR from the prompt's `cluster:` instead of its `module:`. Fixed; CI re-ran on the `edited` trigger a predecessor landed yesterday, and the red is gone.

The sweep reported #2148 as `12 pass / 3 fail`. Two of the three are the CP-26 pair that a
`do-not-merge` label produces by design. **The third was not**, and a run that stopped at *"it's
labelled, so the reds are expected"* would have handed Marco a PR with a live defect dressed as a
parked one.

I did not diagnose it from the diff. `gh run view --log` refused (`run … is still in progress`), so
the job log came from `gh api repos/…/actions/jobs/107477668995/logs`, 5331 lines, split on the tab
and read from the **last** column (§9.1 — column 1 is the job name and greps the whole log).

| probe | result |
|---|---|
| TAP summaries in the job | `348/348`, `330/330`, `37/37` — `# fail 0` on all three |
| `^not ok` | **0** |
| `##[error]` | `Process completed with exit code 1.` |
| the step immediately above it | `node scripts/pipeline/check-pr-title.mjs` |
| its verdict, verbatim | `[TITLE_SCOPE_UNRESOLVED] scope "sec-a3" names nothing this repo can point at.` |

**Every test passed and the job still failed** — which is exactly why §3 says read the log rather than
reason from the result.

**Root cause, measured.** The prompt `pr-sec-a3-no-credential-logs` carries `module: auth` and
`cluster: sec-auth`. Its `module:` is **correct** and is the value `PROMPT-SCHEMA.md#the-pr-title`
says is validated against the same vocabulary the gate uses. The PR was titled `feat(sec-a3)` — the
cluster with its order suffix — and `sec-a3` is not a module directory, not an area directory, and not
a NAMED_AREA. The gate's `-s<N>` slice-suffix stripping does not cover `-a3`.

Run locally against the live vocabulary, both directions, with the gate's own seven self-test controls
passing in both runs:

| `PR_TITLE` | verdict | exit |
|---|---|---|
| `feat(auth): stop writing sign-in codes …` | `PASS  scope=auth normalised=auth via=vocabulary` | **0** |
| `feat(sec-a3): stop writing sign-in codes …` | `FAIL [TITLE_SCOPE_UNRESOLVED]` | **1** |

I renamed the PR to `feat(auth): …` — the gate's own prescribed remedy — and **did not** add `sec-a3`
to `title-scope-baseline.json`, which the gate's message explicitly forbids because that file may only
SHRINK and adding to it is the gate failing open.

🟢 **And this is the first live confirmation that yesterday's fix works.** On 2026-09-23 a predecessor
found that `check-pr-title`'s own prescribed cure was inert — renaming a PR fires only `edited`, and
`edited` was not in `ci.yml`'s `types:` — and added it. [MEASURED] on `origin/main` now:
`types: [opened, synchronize, reopened, labeled, unlabeled, edited]`. The rename at 03:20Z fired a
**new run, `35951013535`**, and four minutes later `Pipeline — watcher + linter tests` reads **pass**.
Before the rename it was fail. That fix had never been exercised; it has now.

**DISPOSITION: ACTIONED** — renamed, read back, CI re-run observed, the red confirmed gone. The two
surviving reds on #2148 are the CP-26 pair and the verdict token was read verbatim from column 3 of the
new run's job log: `FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label
(escalates:true). A human must review and REMOVE the label`. `[LABEL_PRESENT]` is **parked by design,
not work** (§9.4) — there is no agent-side action behind it.

---

### F2 — The prompt that produced #2148 was ARMED carrying a `scope:` that violates PROMPT-SCHEMA.md, after a review note had named the violation by name, and nothing gated it. It cost nothing only because the arming commit absorbed it.

[MEASURED] `pr-sec-a3-no-credential-logs`'s `scope:` lists seven `apps/api` paths and **does not name
its own file**. `docs/pr-prompts/PROMPT-SCHEMA.md` on `origin/main` states the rule verbatim — *"A
prompt whose `scope` does not name its own file is never retired by the PR that builds..."* — with the
worked example and the `! test -f` premise form. `pr-2142-review-fix.md` flagged exactly this
**before** the prompt was armed, asking for one line to be added *"before arming"*. It was armed
anyway at 02:17Z.

The predicted consequence did not occur, and the reason is worth recording because it is not the one
the rule describes:

| probe | result |
|---|---|
| `git log origin/main --diff-filter=D -- <the HOLD and ready paths>` | `b499919b` — removed by **#2147**, the ARMING board PR |
| `git log origin/main --diff-filter=A -- <same>` | `688f7e4c` — added by #2142 |
| #2148's own file list | seven `apps/api` files — **retires nothing** |

**Arming is a `git mv` of a tracked `-HOLD.md` to a `-ready.md` that `.gitignore` swallows, so the
arming commit records the deletion.** The prompt left `main` at arm time, not at build time. The
schema rule is about the BUILD's PR, and the build's PR did behave exactly as the rule warns — the
arming commit is a backstop the rule does not mention, and it is the only reason this was free.

**Why it is a finding and not a curiosity:** the backstop is 00 committing its arm in a board PR. A
prompt armed by any path that does not produce such a commit — or a board PR that fails to land —
leaves the prompt on `main`, still armable, with an open PR for the same work (§10.6). The review note
that would have prevented this existed, was correct, was specific, and was in `needs-marco/`, which is
gitignored: the arming run never saw it.

**DISPOSITION: DISPATCHED → Station 06 (PR Master).** Stage a prompt adding the self-reference check to
`lint-prompt.mjs` as a REJECT: `scope:` must contain the prompt's own path. It is mechanical, the rule
it enforces is already written in `PROMPT-SCHEMA.md`, it fails **closed** (a missing entry blocks
arming rather than admitting it), and it removes the dependency on a human reading a gitignored review
note in the minutes before an arm. 06 designs and stages; it never arms and never merges. **Not
actioned here** because writing a linter gate is a build, not a board operation, and 00 doing 01/06's
work is LL-38.

---

### F3 — Every open PR is Marco's, for the sixth consecutive run, and the queue has nothing armable behind them.

All four verdicts are in WHAT I MEASURED. Three carry a live watcher `marco:true`; the fourth
hand-classifies to Marco on `scripts/pipeline/why-blocked.ps1`. There is no merge this station may
perform.

Behind them: `armed: 0`, and 04's `triage-holds.ps1` run at 02:1xZ reported `spent=0 of 13 ·
gates-satisfied=1 · still-gated=12 · unreadable=0` with both of its own controls passing. The single
gate-satisfied prompt is **`pr-fv2-formrule-contract-HOLD.md`**, which is on the station doc's standing
**never-arm** list by name. So the ADMIT count that matters for arming is **zero**, not one, and that
is a property of the list rather than of the board.

The backlog's only `READY TO STAGE` item, `rates-11c-blocked-consumers`, is a chain whose own gate
stays alive until its consumers merge and which explicitly must not merge before the parity proof has
RUN clean. Staging it ahead of four PRs already parked on Marco lengthens the queue without shortening
anything — the throughput constraint a predecessor stated exactly: *"Arming faster makes the queue
longer, not shorter."*

**DISPOSITION: ESCALATED** — carried unchanged to the existing standing file. It is one question
(below), not six filings, and I added no new escalation for it.

---

### F4 — The sweep's one `[STALE]` row was cleared, and clearing it correctly needed six probes because the tag was right about the wrong thing.

`status-sweep.ps1` §5 tags `pr-2142-review-fix.md` `[STALE]` and prints *"escalation is DEAD, clear
it."* The tag fires on **#2142 having merged**. But that note is about the **prompt** #2142 staged, not
about #2142 — so its subject PR merging settles nothing, and clearing on the tag would have discarded a
live safety claim. Re-asked from scratch, per PR, with controls:

| probe | result |
|---|---|
| `gh pr view 2142 --json state,mergedAt` (single GET, never a list's `merged` field — §9.4) | `MERGED`, `2026-09-24T02:19:55Z` |
| `sec-a3` paths tracked under `docs/pr-prompts/` on `origin/main` | **0** |
| `^docs/pr-prompts/pr-.*-HOLD\.md$` on the same listing — POSITIVE control | **15** |
| a freshly minted needle on the same listing — NEGATIVE control | **0** |
| `pr-sec-a3*` at depth 1 on disk | **nothing** |
| PRs whose title names sec-a3 or credential logs, `--state all` | #2142 and #2147, both merged — **no duplicate build** |

**The prompt is not armable and there is nothing left to duplicate-fire**, so the note's ask is spent.
Nothing general is lost: the rule it invokes lives in `PROMPT-SCHEMA.md` on `main`, independently. What
survives is F2, which is about the arming path and not about this file.

**DISPOSITION: ACTIONED** — moved to `needs-marco/discharged/` (never deleted), byte-exact, with a
discharge note naming every probe above. ⚠️ That folder is gitignored, so the note reaches nobody on
its own — which is why the discharge is stated here, in a tracked path. **Falsifying probe:** re-run
the sweep and read §5; if the name is still tagged, the move did not take.

---

### F5 — DOCTRINE §8.5 sent every station's report to a directory that has never existed, contradicting the canonical station contract. Fixed in this PR.

04's F5, dispatched to 00, re-measured by me at `ea1d6500` rather than taken on its word:

| probe | result |
|---|---|
| `docs/pr-prompts/reports/` on disk | ABSENT |
| `git ls-tree -r --name-only origin/main -- docs/pr-prompts/reports/` | **0** |
| tracked breadcrumbs (`/00-NN-`) on `origin/main` | **642** — `archive/` 641, depth 1 1 |

§8.5 read *"Breadcrumbs and run reports go in `docs/pr-prompts/reports/`"* in the **present tense**,
while the station-contract REPORT CONTRACT — byte-identical in all seven station docs — sends them to
depth 1. All 642 follow the contract; none follows §8.5. A station that had followed it would have
written into a directory no PR has created, and `check-breadcrumb.mjs`'s structure pass iterates
`readdirSync(DIR)` at **depth 1 only** (§9.5) — so the report would have failed no check and been seen
by nobody. That is the nine-day `qa-findings.md` failure reached through a binding instruction instead
of a `.gitignore` line. §8.5's own *"Not yet enforced"* line was not sufficient, because a run reading
§8.5 last acts on the present-tense sentence and not on the caveat below it.

**DISPOSITION: ACTIONED** — §8.5's row is now marked NOT-BUILT, names depth 1 as the live destination
until S4 lands, carries the measurement table and a falsifying probe, and says to retire the block in
the same PR that builds `reports/`. Byte delta asserted (`2021 == 2021`). Landed in this run's PR, and
04's dispatch is discharged.

---

### F6 — Station 04's `clone dirty=N → "the watcher may refuse to start"` line fired again, and I re-derived it rather than acting on it.

My sweep printed `watcher clone: branch=main dirty=2`. 04's F2 measured the same class at 02:1xZ and
recorded it as the surviving live instance of an already-filed defect: the sweep counts **untracked**
files while `start-watcher.ps1` does not, and the entries are `?? docs/pr-reviews/pr-<N>-review.md`
verdicts the review lane writes into the clone **by design**. The measured cost of the line is
mis-routed dispatches to Station 03; DOCTRINE records 13 verbatim quotations of that sentence in
`archive/`.

**I did not dispatch 03 on it, and the watcher is running (pid 38776, wrapper alive, heartbeat 3 min),
so the warning is not biting.**

**DISPOSITION: DEFERRED** — the escalation exists and the remedy is a one-word scope change in
`status-sweep.ps1` (`--untracked-files=no`), which is `scripts/` and therefore lands as a PR that
parks on Marco like the two instrument-repair PRs already on the board. Adding a third to that queue
now buys nothing. **What would make it urgent:** a run that ACTS on the line — dispatching 03, or
treating the clone as unable to start — rather than re-deriving it, which is the second occurrence of
that in two days.

---

### F7 — `vm-git-guard` installed INERT (exit 2) for the fifth consecutive run. Honoured, not reasoned past.

Structural and unchanged: a station's shell is non-interactive and non-login, so it sources neither
file the installer writes its `PATH` export into. The ban is remembered, not mechanical. It bit nothing
— no `git` ran through the device bridge this run.

**DISPOSITION: DEFERRED** — the contract's own three-outcome table calls exit 2 the expected station
outcome and a FINDING rather than a STOP. **What would make it urgent:** a run reporting exit 2 *and* a
0-byte `index.lock` with no owning Windows process, which would mean the remembered ban was finally
forgotten.

---

### F8 — The machinery is healthy, and this line exists so that silence is not the only evidence of it.

[MEASURED] watcher node RUNNING pid 38776 · auto-restart wrapper alive (1) · heartbeat 3 min ·
no non-main worktrees · no registry escapees · `index.lock` absent in **both** trees · 0 git processes
touching our trees · guard hook present · all four scheduled stations fresh and aligned against
`lastRunAt` · trunk green on `ea1d6500` with nothing failed.

**DISPOSITION: ACTIONED** — measured, nothing to do. Stated rather than left silent, because a blind
run and a healthy quiet run produce the same absence of news.

---

## WHAT I DID NOT DO

- **I merged nothing.** All four open PRs are Marco's — three by a live watcher `marco:true` verdict,
  the fourth by hand-classification onto `scripts/pipeline/why-blocked.ps1`. No merge was available.
- **I did not remove a `do-not-merge` label**, from #2148 or anywhere. That is the release action and
  it is Marco's; CP-26 exists to make it a human act. I read the label back after the title edit
  specifically to prove I had not disturbed it.
- **I did not push a commit to #2148's branch** to refresh its verdict. The title edit fires `edited`,
  which is a live CI trigger since yesterday, so the cheap correct path was available and a commit on a
  Marco-gated branch would have been churn.
- **I did not add `sec-a3` to `title-scope-baseline.json`.** The gate's own message forbids it: that
  file may only SHRINK and adding to it is the gate failing open. The title was fixed the right way.
- **I armed nothing.** `armed: 0` and the only gate-satisfied HOLD is `pr-fv2-formrule-contract`, which
  is on the standing never-arm list by name. I did not read its body to form an arming opinion.
- **I did not stage `rates-11c-blocked-consumers`** despite it being the backlog's only READY item —
  see F3. Its chain must not merge before the parity proof has run clean, and the board is already four
  deep on Marco.
- **I did not re-file 04's F1 as a fourth escalation.** It was folded into the existing consolidated
  file, which is what 04 asked for.
- **I did not delete a branch.** `fix1483` is unreviewed work not on `main`; branch deletion is
  irreversible (§5.4) and the whole point of the addendum is to keep it out of a delete set.
- **I did not do 03/04/05/06's work.** F2 is dispatched to 06 by name, F6 is deferred with its owner
  named, and I did not commit `sweep-rotation.json` a second time after measuring that it had landed.
- **I did not touch Azure, Entra or SharePoint**, in any form, read-modify-write included.
- **I did not write production data, commit to `main`, or edit `sot/`.**
- **I did not run `git` through the device bridge against either Windows `.git`**, and ran no
  `git checkout .` / `checkout -- <dir>` / `reset --hard` / `stash pop` / `git clean` anywhere.
- **I did not clear any lock** — there were none, in either tree.
- **Nothing of mine lives only in a gitignored path.** The two gitignored writes (the escalation
  addendum and the discharge) are both restated here, at a tracked path.

---

## FOR MARCO — one question, and one thing that is now easier than it was an hour ago

**Four PRs are waiting on you and none of them is waiting on a defect.**

- **#2148** `feat(auth)` — stops the API writing live field-worker sign-in codes and client-portal
  password-reset links into the production log. **This is the one worth your time first**: until it
  merges, anyone with log access has working credentials. It carries `do-not-merge` because its prompt
  is `escalates: true`. Its third red is gone as of this run.
- **#2135** the dev-tree `git reset` guard · **#2131** `why-blocked.ps1` is an unconditional
  squash-merge that both docs called read-only · **#2127** the raw NUL byte hiding a 52 KB service from
  every grep. All three green, all three routed to you because they touch `scripts/` or `.claude/`.

Releasing one is: remove the `do-not-merge` label where there is one, then commit
`docs/decisions/merge-approvals/<n>.md` to that PR's branch per that folder's README. CI re-runs on
`unlabeled` and CP-26 turns green in the same run.

**The standing question, unchanged and still yours: the stale remote heads.** The consolidated file is
`needs-marco/CONSOLIDATED-stale-remote-heads-one-question-2026-09-21.md` and I added an addendum to it
this run. The short version:

- **Enable Settings → General → Pull Requests → *Automatically delete head branches*.** It fixes the
  problem immediately and in future, and it damages no data — a merged head's commits are already on
  `main`. **Both halves of RULE 1 pass.** This is the option I would take.
- A one-off hand-cleanup fails the *future* half: the population regrows on the next merge. It was 15
  heads on 21 September, 21 at 02:1xZ today, 19 ninety minutes later. All three numbers were right when
  taken, which is the argument.
- **One head must be excluded from any delete set whatever you choose: `fix1483`.** It has no PR, ever,
  and `git merge-base --is-ancestor` says its tip is **not** on `main` (exit 1; positive control exit
  0). It is unreviewed work, not landed work. Auto-delete-on-merge would never touch it, so the setting
  is safe for it; a hand-deletion pass that reads the list without this exclusion would destroy the only
  copy.

**One smaller thing, no decision needed.** #2148 was titled from its prompt's `cluster:` instead of its
`module:`, which failed a CI gate for a reason that had nothing to do with the code. I fixed the title
and dispatched Station 06 to add the matching `lint-prompt.mjs` check so the next one cannot arm with
the same gap. Nothing is waiting on you for it.
