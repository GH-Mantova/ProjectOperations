# Station 00 — Supervisor | 2026-09-21T02:08Z–2026-09-21T02:5xZ

## GROUND

```
UTC            2026-09-21T02:09:33Z
origin/main    8c651574              (git fetch origin +refs/heads/main:..., then git rev-parse --short origin/main)
dev tree       main @ 8c651574       C:\ProjectOperations2   (clean, 0 0 against origin/main at open)
doc version    1                     (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                     (station_doc_version declared by the scheduled-task file)
```

Doc version and bootstrap **agree**, so this run acted rather than going read-only.

**Preflight, all four steps.** (1) **Not blind** — `ToolSearch` loaded the Desktop Commander schemas
first (a validation error is not blindness), then `start_process` shell `powershell.exe` returned
**PID 28156**, which carried the entire run; one shell, no second one started. (2) The device-bridge
git guard installed, last line quoted verbatim: *"persistence controls passed: .bashrc byte-identical
on re-run; login shell resolves shim"*. (3) Ground stamped above. (4) Sweep run, captured to a file,
and its section 7 verdict obtained — `SAFE TO ACT`.

**The three binding documents were read in full, and their freshness was proved before they were
trusted.** `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` returned **EMPTY**, run in the dev
tree, which PREFLIGHT step 2 names as the real answer. No piped hash was compared against anything.
DOCTRINE was read end to end (2616 lines, §1 through §10.6), not sampled.

## WHAT I MEASURED

**`main` WAS RED at 02:09Z, the sweep was right about it, and it is not the Dependabot false
positive.** (It is green again by 02:29Z — F-1. The tense matters: this block records the reading as
taken, and a reader who re-runs the query today gets the post-re-run answer.)
[MEASURED] The sweep printed `main CI on 8c651574: 3 success / 1 failed  <-- TRUNK IS RED`.
DOCTRINE §9.5 records that this exact `[LIVE]` line has been wrong before — a single
`Dependabot Updates` run flipping the headline — and requires it to be re-derived from its own
source before anyone acts on it. Re-derived with the full 40-char SHA and `-R` (§9.4):

```
gh run list -R GH-Mantova/ProjectOperations --commit 8c6515740f2d9f2ca9db9532ca7b5caea68ed2ce \
  --json conclusion,name,event,workflowName      ->  exit 0
```

| workflow | event | conclusion |
|---|---|---|
| **Tendering Browser Smoke** | **push** | **failure** |
| CI | push | success |
| Deploy | push | success |
| CodeQL (`Push on main`) | dynamic | success |

**No Dependabot run, no `schedule` event — the failing run is a real trunk check on a `push`.** The
verdict survives re-derivation this time, which is the outcome the §9.5 rule is there to establish
in either direction.

**It is a flake, and I read the job log before saying so.** [MEASURED] run `35551077706`, job
`106185845749` (`tendering-e2e`). Twelve of the job's fourteen substantive steps are `success`,
including `Apply Prisma migrations`, `Seed database`, `Validate API build` and `Validate web logic`;
step 14 `Run Tendering browser smoke` is the only failure. Read from **column 3** of the tab-separated
log (§9.1's job-name-in-column-1 trap), quoted verbatim:

```
[webkit] > tests/e2e/tendering.spec.ts:44:7 > Tendering - redesigned register + pipeline >
          /tenders renders the redesigned register page (24.6s)
Error: page.goto: WebKit encountered an internal error
1 failed
```

`page.goto: WebKit encountered an internal error` is a browser-engine crash, not an assertion. Two
independent cross-checks say the same thing:

- **The diff cannot have caused it.** `gh pr view 2023 --json files` → **9 files, every one under
  `docs/`** (`DOCTRINE.md`, `_canonical-blocks.json`, seven breadcrumbs). A docs diff cannot break a
  Playwright test.
- **The same test passed on the five preceding `main` commits.** `gh run list --workflow "Tendering
  Browser Smoke" --branch main --limit 12`: `c5744acf` success (00:57Z) · `1c845124` success ·
  `6484d25a` cancelled · `26dfcfc7` success · `64abcdcd` success. The app code on `main` has not
  changed across any of them.

⚠️ **So the station doc's rule 5 reading — *"a docs-only PR failing a CODE check is instant proof of a
MAIN regression"* — does NOT apply here, and saying why matters.** That rule is written for a check
failing **on the PR**, where the merge-base is green and the only variable is the diff. This failure is
on the **post-merge push run**, and the thing it would indict — a regression already sitting on `main` —
is refuted by the five green runs above on that same code. What is left is the transient branch of
rule 5.

**Nothing is armable, counted by hand rather than quoted (Q3).**
[MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md -File`, counted with the §9.4 null guard
`@($x | Where-Object { $null -ne $_ }).Count` → **armed = 0**; `*-HOLD.md` → **27**. Both agree with
the sweep's section 4 and with the previous run's per-file lint of all 27.

**The machinery is healthy, and I claim no liveness verdict beyond the sweep's own `[LIVE]` lines.**
watcher node **RUNNING pid 9744** · auto-restart wrapper **alive (1)** · heartbeat **72 min** (ticks
mid-run only; a stale heartbeat with an empty queue is *idle*, not wedged) · `git index.lock`
dev/clone **False / False** · scoped git processes **0** · no PR touched on GitHub in the last 2 min.
`restart-watcher-if-wedged.ps1` was **not** run.

**The sweep's clone-dirty warning is the known false positive, re-derived rather than repeated.**
[MEASURED] `[LIVE] watcher clone: branch=main dirty=1  <-- ... the watcher may refuse to start`
against `git -C C:\po-watcher\ProjectOperations status --porcelain --untracked-files=no` → **EMPTY**,
and `git status --porcelain` → **1**, the untracked `scripts/pr-watcher/.conflict-notified-prs.json`.
That is exactly DOCTRINE §9.5's measured bullet: the sweep counts untracked files and
`start-watcher.ps1` does not. **Not a finding, not a dispatch** — recorded so the next run does not
re-file it for the fourteenth time.

**Freshness is CLEAN and every station's `lastRunAt` agrees with its newest breadcrumb.**
[MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` → `structure: 1 checked, 0
malformed`, all four enabled stations `ok`, **`CLEAN`, exit 0**. Crossed against the scheduled-tasks
MCP in the same minute, which the breadcrumb instrument cannot do alone:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| `00` | `2026-09-21T02:08:28Z` | `01:10Z` | this run; aligned |
| `03` | `2026-09-21T00:20:35Z` | `00:21Z` | aligned |
| `04` | `2026-09-21T02:10:07Z` | `00:04Z` | **mid-run right now** — not silent |
| `05` | `2026-09-21T00:04:02Z` | `00:04Z` | aligned |

`weekly-security-audit` remains `enabled: false`, so the live enabled count is **four** —
`STATION-CAPABILITIES.md` §1's 2026-09-15 correction still holding.

⚠️ **Station 04 fired 99 seconds after me and was still running while I worked.** That is the
structural 00×04 collision `STATION-CAPABILITIES.md` §6 records: `00` is hourly at `:05` and `04` is
`0 */4 * * *`, so they land inside ten minutes of each other on **every one of 04's six daily runs**,
not only at midnight local. 04 is read-only and mutates nothing I touched, so condition 3 of BOARD
DRIVING is satisfied — but **04's breadcrumb for this cycle did not exist when I wrote mine**
([MEASURED] `docs/pr-prompts/00-*.md` at depth 1 → one file, the 01:10Z supervisor breadcrumb, and
`git status --porcelain -- docs/pr-prompts` shows no new untracked breadcrumb). **It is the next 00
run's to collect, and this line is the hand-over.**

**No `[STALE]` escalation rows to clear.** [MEASURED] a `[STALE]` scan over all 901 lines of the
decoded sweep returned **zero** matches outside the legend and the closing instruction. Section 5
produced only `[FILE]` cross-check rows. `needs-marco/` stands at **60**.

## WHAT CHANGED

1. **Re-ran the failed trunk job and `main` is green again.** `gh run rerun 35551077706 --failed`,
   exit 0; attempt 2 completed `success` at 02:28:02Z, and `gh run list --commit <full sha>` then
   returned **4 of 4 `success`**. Rule 5's sanctioned response to a transient, taken **after**
   reading the log, not instead of it. See F-1.
2. **Staged `pr-sotinpr-freshness-gate-HOLD.md`** — the CP-27 gate, discharging the previous run's
   own deferred hand-over. See F-2.
3. **Archived the 01:10Z supervisor breadcrumb** to `docs/pr-prompts/archive/` in this PR; every
   finding in it carries a disposition.
4. **No merge. No arm. No label touched. No board mutation beyond the CI re-run and this docs PR.**

## FINDINGS

### F-1 — `main` went red on a WebKit engine crash under a docs-only merge; one re-run cleared it

The measurement is under WHAT I MEASURED: a real trunk check (`Tendering Browser Smoke`, event
`push`) failed at `8c651574` on `page.goto: WebKit encountered an internal error`, under a
**docs-only** merge, with the same test green on the five preceding `main` commits.

Station doc rule 5: *"A failure that is a known flake — Node OOM / heap (exit 134), a setup/network
flake, or a CODE check failing on a docs-only or unrelated diff while `main` is green — is transient.
Re-run it … Only treat a red as a real defect after a clean-diff re-run still fails."* All three
conditions hold at once here.

**Re-run issued at 02:16Z, and it is GREEN — the flake reading is confirmed, not assumed.**
[MEASURED] `gh run view 35551077706 -R GH-Mantova/ProjectOperations --json status,conclusion,attempt`,
polled at 02:20:32Z, 02:23:11Z and 02:26:06Z as `{"attempt":2,"conclusion":"","status":"in_progress"}`,
then at **02:28:02Z** as:

```
{"attempt":2,"conclusion":"success","status":"completed"}
```

**And the trunk verdict itself was re-derived from its own source afterwards**, not inferred from the
job result — `gh run list --commit 8c6515740f2d9f2ca9db9532ca7b5caea68ed2ce --json
conclusion,name,event,workflowName`, exit 0: **CI · Deploy · Tendering Browser Smoke · CodeQL, all
four `success`**. The same command that returned one `failure` at 02:09Z returns **4/4 green** at
02:29Z. `main` **is green at `8c651574`**.

⚠️ **The next run must not read this as "trunk was never red".** The workflow conclusion the sweep
aggregates is per-**run**, and a successful re-run updates that run's conclusion **in place** — so
the 02:11Z sweep's `TRUNK IS RED` line is now unreproducible from GitHub, and the only surviving
record that it fired is this breadcrumb. **The failed attempt is still readable at attempt 1 of run
`35551077706`** if anyone needs the log.

⚠️ **One re-run, and only one.** §2 forbids re-running hoping for green; had attempt 2 failed, the
next step would have been the job log again, not a third attempt. It did not fail, so the rule was
never reached — recorded because "it went green on the re-run" and "I re-ran it until it went green"
read identically in a summary and are different acts.

**DISPOSITION: ACTIONED** — log read first, cause named, one sanctioned re-run, green read back from
two independent queries.

### F-2 — the previous run's deferred hand-over is discharged: CP-27 is staged

The 01:10Z run's F-6 recorded Station 05's third hand-refresh of `sot/02`'s In-PR table in fifteen
days, DEFERRED with an explicit hand-over: *"The next run with slot to spare should stage it as an
ordinary `-HOLD.md`; it is small and self-contained."* I had slot, so it is staged.

**Re-verified before acting on it (§7.1's re-read rule), at `8c651574`:** `sot/02-roadmap-and-status.md`
§2 reads `## 2. 🔧 In-PR — open right now (1)` and its table names `#2017`, which **is** the one open
PR — so the table is correct *today*, four hours after 05 refreshed it. That is the point: it is
correct today and was wrong by three PRs four hours before that. The defect is the maintenance model,
not the current contents.

**What was staged.** `docs/pr-prompts/pr-sotinpr-freshness-gate-HOLD.md`, `SOT_INPR_FRESHNESS_V1`.
A CP-27 gate in `scripts/pr-gates/pr-gates.mjs` that **SKIPs unless the PR's diff contains
`sot/02-roadmap-and-status.md`**, and otherwise parses §2's table, resolves each named PR's state
through `gh`, and FAILs if any is not `OPEN` or if the header count and the row count disagree.

**RULE 1, both halves, and why this shape rather than the obvious one.** The obvious gate runs on
every PR — that is *complete* and it **fails the second half**: it would red the whole board over a
documentation snapshot, which is damage to future work. Scoping it to PRs that touch the file itself
keeps both halves: a stale refresh cannot land, and no unrelated PR is ever touched. The alternative
considered and rejected was a generator (`--fix` rewrites the table from the live board); it fails the
*immediately* half on its own, because nothing would run it, and it is additive to this gate rather
than a substitute — the prompt says so.

**Proved rather than asserted.** `lint-prompt.mjs` **REJECT**ed the first draft
`[MISSING_STANDING_AUTHORITY]` (positive control that the linter was actually reading my file), and
**ADMIT (size 4), exit 0** after the standing-authority sentence was added. Its `scope` names its own
`-HOLD.md` under `superseded/`, per PROMPT-SCHEMA's measured rule that a prompt not naming its own
path stays armable forever. It touches `scripts/` + `docs/` and **no `sot/`**, so CP-24 is satisfied
by construction; and `scripts/pr-gates/__tests__/*.mjs` is already wired into the `pipeline-tests`
job (anchor: that line in `ci.yml`), so it needs **no `.github/` change**.

⚠️ **Staged, deliberately NOT armed**, and the reason is measured rather than cautious: its PR would
touch `scripts/`, which `classifyPolicyFiles` routes to Marco, so arming it adds a second PR to a
board that already cannot move (F-3) — and arming anything while trunk is red hands the build an
inherited failure. **Arm it when trunk is green and Marco has cleared `#2017`.**

**DISPOSITION: ACTIONED.**

### F-3 — the board is still one PR waiting on one label, and that has not changed in this cycle

Not a new defect; the shape of the board, restated because Q6 demands one sentence and because the
previous run's escalation is still the live answer.

[MEASURED] `gh pr list --state open` → **1**: `#2017`, `mergeStateStatus BLOCKED`, carrying
`do-not-merge`. Its reds are the CP-26 `[LABEL_PRESENT]` pair DOCTRINE §9.4 describes — **one cause,
two checks, parked by design, no agent-side action behind it.** Only Marco removes the label.
`armed` has been **0** since 2026-09-17T19:19:51Z.

Removing that one label releases `pr-crmvis-s7-comms-inbox` (its `requires_on_main` gate is the
`CRM_PARITY_BULKLINK_V1` needle `#2017` puts on `main`), and s7's own output releases
`pr-crmvis-s8-comms-threads`. **One label, three slices.**

**DISPOSITION: ESCALATED** — Marco, as one line and not a chase: *`#2017` is green on everything
except the CP-26 pair, which is the label itself; removing it releases a three-slice CRM chain that
is otherwise idle.* This is the same escalation the 01:10Z run raised; it is restated rather than
re-filed, because nothing has changed and a second file would split it.

### F-4 — 03's two worktree items are still open and are still 03's

[MEASURED] from the sweep's `[LIVE]` section 2, unchanged from the previous cycle: orphaned worktree
`C:/PR-Master/worktrees/po-vg` on `fix/no-rebase-while-checks-run`, **holding 1 uncommitted file**,
age **24137 min (~16.8 days)** — the sweep's own line warns *preserve or commit before pruning;
`git worktree remove` will refuse and `--force` would discard it* — and registry escapee
`C:\po-worktrees\po-fix-2005` (0 KB, age 4952 min, no `.lock`). `git worktree list` in the dev tree
confirms `po-vg` as the only non-dev worktree registered.

I did not touch either. Worktrees are 03's lane, and `po-vg` is the subject of
`needs-marco/po-vg-holds-the-unpushed-fix-for-an-open-escalation-2026-09-05.md`.

**DISPOSITION: DISPATCHED** → **Station 03**, next occurrence `2026-09-21T23:00:45Z`. Handed over:
list `po-vg`'s uncommitted file with `git -C C:/PR-Master/worktrees/po-vg status --porcelain` and
preserve it before any prune; confirm `po-fix-2005` is dead before removing it.
⚠️ **This hand-over is subject to the open escalation
`needs-marco/dispatched-findings-have-no-file-backed-home-2026-09-10.md`** — a dispatch that lives
only in a Station 00 breadcrumb is measured not to arrive. It is also printed in the sweep's own
`[LIVE]` section 2 every run, which is the one place 03 meets it without reading me.

### F-5 — Station 04's 02:10Z run is mid-flight and its breadcrumb is the next run's to collect

[MEASURED] 04 `lastRunAt 2026-09-21T02:10:07Z`, **99 seconds after mine**, and at the time this
breadcrumb was written `docs/pr-prompts` held no 04 breadcrumb for this cycle and `git status` showed
no new untracked file there. This is not a defect in 04 and not silence — `--freshness` reads it `ok`
and its `lastRunAt` is current.

It is recorded because of what the COLLECT contract turns on: **a station that reports after I have
collected is indistinguishable, in my breadcrumb alone, from one that did not report.** Naming it here
is the only thing that stops the next run reading my silence about 04 as 04's silence.

**DISPOSITION: DEFERRED** — to the next 00 occurrence (`2026-09-21T03:07:52Z`), which should collect
04's 02:10Z breadcrumb first. The trigger that would make it urgent: 04 reaching **8 h** since its last
breadcrumb (twice its 4 h cadence), at which point `--freshness` will call it SILENT and it becomes a
real finding rather than a scheduling overlap.

## WHAT I DID NOT DO

- **Did not touch `#2017`.** `do-not-merge` binds absolutely; only Marco removes it. Never attempted.
- **Did not merge anything.** Nothing was mergeable: the one open PR is parked on Marco's label, and
  this run's own docs PR is the only other thing on the board.
- **Did not arm anything.** `armed` opened and closed at **0**, counted by hand. The prompt staged in
  F-2 is deliberately left `-HOLD`, for the two reasons named there.
- **Did not re-run the failed job a second time.** One re-run, read back green from two independent
  queries. §2 forbids re-running hoping for green, and a second attempt would have been exactly that.
- **Did not treat the red trunk as a `fixes_pr` candidate.** Rule 5's regression reading is refuted by
  the five green `main` runs on the same code; authoring a fix prompt for a WebKit engine crash would
  be a fix without a proven cause, which §8.1 calls a second bug.
- **Did not file anything about the sweep's `dirty=1` clone line.** It is DOCTRINE §9.5's measured
  false positive, re-derived this run and recorded under WHAT I MEASURED so the next run does not
  dispatch it to 03 for the fourteenth time.
- **Did not touch `C:/PR-Master/worktrees/po-vg` or `C:\po-worktrees\po-fix-2005`** (F-4).
- **Did not run `restart-watcher-if-wedged.ps1`**, and claim no liveness verdict beyond the sweep's
  `[LIVE]` lines. The watcher is RUNNING with its wrapper alive against an empty queue, which is
  *correct*, not wedged.
- **Did not discharge anything from `needs-marco/`.** The sweep produced no `[STALE]` rows this run.
- **Did not run `git` through the VM mount**; did not `git checkout .` / `checkout -- <dir>` /
  `reset --hard` / `stash pop` / `git clean` anywhere; did not commit on `main`; did not edit `/sot/`;
  did not write production data; did not touch Azure, Entra or SharePoint.
- **Wrote every file of this run inside an isolated worktree** (`C:\po-wt\sup-20260921-0215`, branch
  `docs/station-00-2026-09-21-0215`, created off `origin/main`). The dev tree's index was not touched
  at all this run — which is cure 1 of the post-merge fast-forward rule, so no loose disk copy of this
  breadcrumb exists for the next FF to trip over.
