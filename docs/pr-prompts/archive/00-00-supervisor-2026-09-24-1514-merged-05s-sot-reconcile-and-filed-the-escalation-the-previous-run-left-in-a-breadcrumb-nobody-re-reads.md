# Station 00 — Supervisor | 2026-09-24T15:14:09Z–2026-09-24T15:40Z

## GROUND

```
UTC            2026-09-24T15:14:09Z
origin/main    6750da36  (at start)  ->  c0e15205  (after this run's merge of #2170)
dev tree       main @ 6750da36 -> c0e15205  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE (both `1`) — this run was **not** read-only-by-mismatch.

Binding documents read **in full** this run: `docs/pipeline/stations/00-supervisor.md` (1660 lines),
`docs/pipeline/DOCTRINE.md` (2842 lines), `docs/pipeline/STATION-CAPABILITIES.md` (593 lines). Read
from the **working copy**, then proved byte-equivalent to `origin/main` by the §9.3-sanctioned form —
no piped hash was taken, per PREFLIGHT's `git show | hash-object` warning:

```
git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md   ->  EMPTY
git diff --numstat origin/main -- docs/pipeline/DOCTRINE.md                 ->  EMPTY
git diff --numstat origin/main -- docs/pipeline/STATION-CAPABILITIES.md     ->  EMPTY
git rev-list --left-right --count HEAD...origin/main                        ->  0   0
```

So the §9.2 behind-HEAD caveat does not apply to any `git status` reading below.

## WHAT I MEASURED

**Host reachable — NOT a blind run.** [MEASURED] Desktop Commander tool ids were loaded via
`ToolSearch` **before** any call (so no `InputValidationError` was available to be misread as
blindness); `start_process` shell `powershell.exe` then returned on the first call
`2026-09-25T01:14:38.0246779+10:00`, `main`, `6750da36`. A persistent shell (pid 12344) carried the
whole run.

**Device-bridge git guard.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"`,
exit code read from the **installer** and not from a pipeline appended to it. Last line and headline,
verbatim:

```
vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.
...
   PATH="/sessions/gifted-sharp-hawking/.local/bin:$PATH" git <args>
GUARD_EXIT=2
```

[MEASURED] **EXIT CODE 2** — the station doc's expected middle outcome for a non-interactive
non-login shell. The ban was therefore **remembered, not mechanical**, for this entire run, and it
was kept: every `git` call below ran through Desktop Commander on the Windows host, and no `git` ran
against a mounted folder from the VM. See F5.

### COLLECT — freshness, then the `lastRunAt` cross-check

`node scripts/pipeline/check-breadcrumb.mjs --freshness`, **exit 0**, verbatim:

```
ADMIT   00-00-supervisor-2026-09-24-1414-…-all-five-open-prs-are-marcos.md
ADMIT   00-04-scanner-2026-09-24-1410-…-is-still-armed-on-main.md

structure: 2 checked, 0 malformed, 0 skipped as pre-contract (before 2026-08-25T0000)

  00  last 2026-09-24T14:14:00Z  1.1h ago  (cadence 1h)  ok
  02  dispatch-only — no cadence to miss
  03  last 2026-09-23T23:04:00Z  16.3h ago  (cadence 24h)  ok
  04  last 2026-09-24T14:10:00Z  1.2h ago  (cadence 4h)  ok
  05  last 2026-09-24T14:23:00Z  0.9h ago  (cadence 24h)  ok

CLEAN
```

Legitimate here because this run is **sighted** — `STATION-CAPABILITIES.md` §3 forbids the validator
only to a blind run, since it shells `git ls-tree` / `git ls-files` **and** `gh pr list`.

⚠️ **That third instrument is why 05 reads fresh at all, and it is worth stating so the next run does
not re-find it as a contradiction.** 05's `…-1423-…` breadcrumb was **not** on `origin/main` at the
moment `--freshness` ran and **not** on disk at depth 1 of the dev tree — [MEASURED]
`git ls-tree -r --name-only origin/main -- docs/pr-prompts/ | Select-String '2026-09-24'` returned
only the two depth-1 files above plus `archive/` entries, and `Get-ChildItem docs\pr-prompts -Filter
'00-05-*'` returned nothing. It was inside **open PR #2170**, which the validator's
`gh pr list --state open --limit 100 --json files` call can see. The instrument is sound; its corpus
is wider than the tracked set.

Crossed against `lastRunAt` from the scheduled-tasks MCP, per the station doc's four-row table:

| station | `lastRunAt` | newest breadcrumb | row | verdict |
|---|---|---|---|---|
| 00 | `2026-09-24T15:14:09.738Z` — **this run** | 14:14Z | both fresh and aligned | healthy |
| 03 | `2026-09-23T23:02:54.300Z` | 23:04Z | both fresh and aligned (cadence 24 h, `nextRunAt` 23:02:45Z today) | healthy |
| 04 | `2026-09-24T14:09:48.251Z` | 14:10Z | both fresh and aligned | healthy |
| 05 | `2026-09-24T14:22:54.276Z` | 14:23Z | both fresh and aligned | healthy |

**No station is SILENT and none needed a transcript read.** `weekly-security-audit` remains
`enabled: false` (`lastRunAt 2026-09-06T21:32:44Z`) — unchanged, already open with Marco, not a
station. Live enabled count is **four**, which is what `STATION-CAPABILITIES.md` §1's 2026-09-15
correction says to expect.

### The board — every open PR, with its lane

`gh pr list --state open` → **6**. Per-PR `gh pr view <n> --json …` (never a list response — §9.4's
`merged`-field bullet), `-R GH-Mantova/ProjectOperations` on every call:

| PR | files | label | §10.1 lane | verdict |
|---|---|---|---|---|
| **#2170** | `sot/04-data-model.md`, `docs/data-model/sweeps/`, `docs/pr-prompts/` | **none** | **NO LOG — Station 05 doc-reconcile, step 3 exception, lane NAMED in the body** | **MERGED by me — see WHAT CHANGED** |
| #2167 | 3 × `scripts/pr-watcher/**` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds |
| #2166 | the SAME 3 files | `do-not-merge` | **NO LOG — second lane, hand-classified** | Marco's (step 2) |
| #2164 | 4 × `apps/web/**` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds |
| #2158 | 10, incl. `apps/api/prisma/migrations/` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds + migration |
| #2148 | 7 × `apps/api/**` | `do-not-merge` | watcher-opened, **`marco:true`** | RULE 2 binds |

**RULE 2 probe, with its controls.** Run over `C:\ProjectOperations2\docs\pr-prompts\processed\pr-*.log`
— the LIVE dev tree, never the clone decoy (§9.5) — from a `.mjs` file on disk, matched with
`indexOf('PR #<n>')` plus an explicit next-character digit guard and **no backslash escape crossing a
shell layer** (§9.1 `NODE_E_REGEX_BACKSLASH_DOUBLES_THROUGH_POWERSHELL_V1`, whose whole point is that
a `\b` written for `node -e` arrives doubled through PowerShell and answers a uniform zero):

- corpus **952** `pr-*.log`, newest `2026-09-24T13:53:36Z` — **younger than every open PR's
  `createdAt`**, which is the freshness precondition, so a `NO LOG` here is a real absence;
- POSITIVE control: `"marco":true` present in **710** files; #2167 → 1 hit, #2164 → 2, #2158 → 2,
  #2148 → 2, each carrying a real `marco:true` verdict quoted in full;
- NEGATIVE control: freshly minted `PR #999731` → **0**;
- **#2170 → 0** and **#2166 → 0**, both hand-classified below.

### The reds — all ten of them are one cause, and it is not work

CP-26's verdict TOKEN, read from **column 3** of the job log after splitting on the tab (§9.1's
three-column bullet), never from the PR page. On #2166, run `36016339748`:

```
FAIL - CP-26 approval-receipt [LABEL_PRESENT] PR carries the do-not-merge label (escalates:true).
A human must review and REMOVE the label; removing it is what releases the merge.
```

POSITIVE control on that read: 3 `Run ` lines in column 3; NEGATIVE control, a freshly minted needle,
**0**. `[LABEL_PRESENT]` is **PARKED BY DESIGN** (§9.4) — and that single cause produces **two** red
rows on each of the five labelled PRs (the required check `Approval receipt (CP-26)` plus the same
check as a step inside `PR gates — diff checks`), which is exactly the `13 pass / 2 fail` the sweep
prints five times. **Ten reds, one cause, zero agent-side action.** Counting them as work is the
mistake three consecutive collect runs made; they are not counted as work here.

### Machinery — `[LIVE]` lines only, from `status-sweep.ps1`

Two sweeps were taken (`15:15:31Z`, and `15:22:09Z` **immediately before the merge**), captured to a
file with `*>` and decoded **utf16le** (§9.3 — the all-streams redirection is the same UTF-16LE trap
as `>`, and PREFLIGHT's own cure walks into it):

- watcher node **RUNNING pid 42212**; auto-restart wrapper **alive (2)**; heartbeat 34 min (ticks only
  mid-run; stale + empty queue = idle, **not** wedged); watcher clone `branch=main dirty=0`.
- safe-to-act at the moment of mutation: `index.lock` interactive/clone **False / False**; scoped git
  processes **0**; machine-wide **0**; no build in flight; **no PR touched in the last 2 min**.
  Verdict line: `SAFE TO ACT`.
- `main` CI on `6750da36`: **4 success / 0 failed** (trunk green).
- armed `*-ready.md` on disk: **0**, counted directly with `Get-ChildItem`, not quoted from a note.
- Two non-main worktrees, both aged (467 min / 402 min); `C:/po-worktrees/sup-cwd-paths` holds **2
  dirty files**. Left alone — see WHAT I DID NOT DO.
- No `MERGE_HEAD`, no rebase state, no unmerged paths in either tree. `restart-watcher-if-wedged.ps1`
  was **not** run: an alive watcher with an empty queue is what the station doc records as CORRECT.
- Section 5 tagged **no `[STALE]` row** this run — every `needs-marco/` line is `[FILE]`, and the
  sweep's own text on each says it *"does not clear the escalation"*. Nothing to discharge.

### The queue — nothing is armable, and that is measured rather than assumed

`triage-holds.ps1`, exit 0, both of its own controls PASS (`GIT control: PASS`, `SPENT control: PASS`):

```
=== queue triage -- 15 prompt(s) at depth 1: HOLD=15, ready=0, LOOPING=0
=== TOTALS  spent=0 of 15 evaluated  gates-satisfied=1  still-gated=14  unreadable=0
```

The single `GATES SATISFIED` candidate is **`pr-fv2-formrule-contract-HOLD.md`**, and it is armable in
neither direction:

1. it is flagged `POSSIBLE DUPLICATE of open PR #2158 (9 of 12)`, and the RULE 2 probe **confirms** the
   duplication rather than leaving it a candidate — `pr-fv2-formrule-contract-ready.md.log` in
   `processed/` names `PR #2158` twice, so that prompt has already been armed, consumed and built
   (§10.6: the premise dies on MERGE, not on OPEN, which is why it still ADMITs);
2. `pr-fv2-formrule-contract` is on the **never-arm denylist** named in this station's own doc
   (alongside `pr-siteid-notnull-backfill` and the prod-data MT prompts) — Marco-run, not mine.

The other 14 are `REJECT`: eight `[HUMAN_GATE_PRESENT]`, four `[FILE_GATE_NOT_RELEASED]`, two
`[GATE_NOT_RELEASED]`. **So `armed` is 0 before this run and 0 after, and there was nothing to arm.**

## WHAT CHANGED

1. **PR #2170 MERGED.** Station 05's `sot/` doc-reconcile, through the sanctioned path only —
   `Assert-SmokedOrEscalate -PR 2170` → `True`, then `Merge-Pr -PR 2170` → `True`. Never raw
   `gh pr merge`, never a hand `git merge`. **Read back, not asserted:**

   ```
   gh pr view 2170 --json number,state,mergedAt,mergeCommit
     -> {"mergeCommit":{"oid":"c0e1520563885294d39a4c60c50f5d4d98e0f8c3"},
         "mergedAt":"2026-09-24T15:26:18Z","number":2170,"state":"MERGED"}
   git rev-parse --short origin/main            ->  c0e15205
   git show origin/main:sot/04-data-model.md | Select-String -SimpleMatch 'markupOverride, totalTripKm'
     ->  1 hit   (the PR's own contribution, on main)
   ```

   It reached `main`; this does not stop at "auto-merge enabled". See F1 for why it was mine to merge.
2. **Dev tree fast-forwarded** `6750da36` → `c0e15205`. All **four** read-backs pass together, not
   just the first three: `rev-list --left-right --count HEAD...origin/main` → `0 0`, `--numstat`
   EMPTY, `--cached` EMPTY, **and `git status --porcelain --untracked-files=no` EMPTY** — the fourth
   being the only one that catches the dirty-tree shape this station has now recorded three times.
3. **This board PR**: this breadcrumb; a new `needs-marco/` escalation (F2); and the archiving of the
   **three** breadcrumbs this run collected — 00's 14:14Z, 04's 14:10Z and 05's 14:23Z — every finding
   in all three now carrying a disposition below.

**Nothing was armed. No label was added or removed. No prompt was renamed, disarmed or binned. No
watcher-routed PR was merged. `/sot/` was not edited — #2170's `sot/` change is Station 05's own work,
merged, not authored.** The watcher was not restarted and no lock was cleared.

## FINDINGS

### F1 — #2170 was the first mergeable PR in five runs, and the thing that made it mergeable is the one signal a station may act on without Marco

[MEASURED] at `c0e15205`. Four consecutive Station 00 runs before this one recorded the merge lane as
genuinely empty. #2170 is different in every respect that the merge gates test:

| gate | #2170 | the other five |
|---|---|---|
| `do-not-merge` label (§9.4 / CP-26 gate 1) | **absent** | present on all five |
| CP-26 conclusion | **SUCCESS** | `FAIL … [LABEL_PRESENT]` ×2 each |
| watcher `marco:true` (§10.1 step 1) | **no log, 0 hits**, controls passing | live verdict on four of five |
| §10.1 step 2 / step 3 | **step 3 applies** — Station 05 acting inside its recorded lane, and the PR body **names that lane** in as many words (`"Lane: Station 05 — sot/ doc-reconcile only (STATION-CAPABILITIES.md §5; DOCTRINE §10.1 step 3)"`) | #2166 is step 2, outside `tests\|docs` and outside 00's `docs/` lane ⇒ Marco's |
| lane boundary proved by CI, not self-declared | **CP-24** — hard-blocks any PR mixing `sot/` with `apps/`, `scripts/`, `.github/`, `packages/`, `package.json` or `pnpm-lock.yaml`, no escape hatch. #2170's three files are `sot/` + `docs/` only, and CP-24 is SUCCESS | n/a |
| `STATION-CAPABILITIES.md` §5 | *"00 may merge docs-only and `sot/`-only PRs"* — this is both | #2166 is `scripts/`, which the 2026-09-22 `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` narrowing settled is **Marco's** |
| all 15 rollup rows | 10 SUCCESS / 5 SKIPPED / **0 non-success** | 13 pass / 2 fail |

**This is the step-3 exception working exactly as designed, and the part worth recording is which
instrument earned it.** §10.1 step 2 would have read *"no watcher log ⇒ apply `classifyPolicyFiles` by
hand ⇒ `sot/` is outside `tests|docs` ⇒ Marco's"* and parked a green governance PR behind a human for
no reason. Step 3 exists because `classifyPolicyFiles` answers *"may this merge with no human
judgement?"* and was being borrowed to answer *"WHICH human?"* — and the discriminator is not the
station's own claim about its lane but **CP-24, a CI gate that proves the boundary**. A lane with no
such gate is self-declaration, and self-declaration is not classification.

**ACTIONED** — merged and read back to `main`, with the content proof above.

### F2 — an ESCALATED finding whose only home was a breadcrumb reaches the one instrument that reads escalations: nowhere

[MEASURED] at `c0e15205`. The 14:14Z run's **F6** (two open PRs fixing the same verdict-guard defect)
carries the literal disposition **ESCALATED** and puts its question in that breadcrumb's `## FOR
MARCO` section. It is a good escalation — a question with three RULE-1-ranked options and a stated
limit on the recommended one. But:

| probe | result |
|---|---|
| tracked files under `docs/pr-prompts/needs-marco/` | **8** |
| a file naming #2166 / #2167 among them | **0** |
| what `status-sweep.ps1` section 5 cross-checks against GitHub | `needs-marco/` — **not** `archive/` |
| what happens to the breadcrumb once its findings are dispositioned | `git mv` to `archive/` — by me, in this very PR |

So the escalation's only copy was about to be archived by the run whose job is to collect it, into a
folder no instrument re-checks. The station doc is unambiguous about the channel — *"**ESCALATE** —
write to `docs/pr-prompts/needs-marco/`"* — and `needs-marco/` is *"the ONLY real stop"* (DOCTRINE
§5b). A `## FOR MARCO` section is a courtesy to a reader of one file; it is not the queue.

**Why this is worth a finding rather than a silent fix.** The failure is structural and recurring: any
run that ESCALATES into its own breadcrumb produces an escalation that (a) is invisible to section 5's
stale-claim cross-check, so nobody will ever notice when it goes dead, and (b) vanishes from the live
queue the moment the next collect run does its job correctly. That is the nine-day `qa-findings.md`
failure with a different path — reached, this time, through a **correct** disposition rather than a
`.gitignore` line.

🔧 **RULE 1 — complete-and-additive first.** The fix applied here is (A): **file the escalation in
`needs-marco/` as its own document, `git add -f`** (the folder is gitignored by RULE and partly tracked
in FACT, so the force-add is required and `git ls-files` was asked first, per the REPORT CONTRACT), and
leave the breadcrumb's `## FOR MARCO` text untouched as its provenance. Immediate — the question is in
the queue now; and future — the file carries its own falsifying probe (`gh pr view 2166/2167 --json
state,labels`) so the next run can discharge it into `needs-marco/discharged/` when it dies, never
delete it. Damages no data entry. The alternative, (B) *"leave it in the breadcrumb and rely on the
next run reading `archive/`"*, fails the future half by construction: the sweep does not read
`archive/`, and no run is instructed to.

**ACTIONED** — `docs/pr-prompts/needs-marco/duplicate-verdict-guard-prs-2166-vs-2167-2026-09-24.md`
is in this PR, force-added, carrying the re-taken RULE 2 measurements rather than the 14:14Z run's
quoted ones (§7.1's re-read rule: a claim that outlives its SHA is a lead, not a finding).

### F3 — Station 04's F2 (a consumed `-ready.md` armed on `origin/main`): the immediate half is DONE, and only a future-half change remains

Re-verified live rather than repeated from either note (`00-supervisor.md` Q4), at `c0e15205`:

| probe | result | reading |
|---|---|---|
| tracked `*-ready.md` at depth 1 on `origin/main` | **NONE** | the invariant is restored |
| POSITIVE control, total depth-1 entries in that listing | **32** | the query works; the zero is real, not §9.6 |
| armed `*-ready.md` on disk | **0** | agrees |
| `git status --porcelain --untracked-files=no` in the dev tree | **EMPTY** | the ` D` that refused the fast-forward is gone |
| what closed it | PR **#2168**, merged `2026-09-24T14:35Z` — *"retire the consumed ready file"* | the 14:14Z run's ACTIONED half landed |

Station 04's `docs/pipeline/sweep-rotation.json` advance (F5 of the 14:14Z run) likewise shows EMPTY in
the same probe, so it too was committed. **Both standing hand-overs from 04's 14:10Z run are closed.**

What remains is option (A)'s **future** half: *stop committing `*-ready.md` in its armed state*, so a
clean tree cut from `main` can never re-arm executed work. It is a change to the arming step, not to
this board, and it must land as its own reviewed change rather than be improvised inside a collect PR.

**DEFERRED** — it becomes urgent the next time an arm is committed to `main`, which is every arming
run. It did **not** become urgent this run, because nothing was armed. The falsifying probe is the
first row of the table above: if `tracked *-ready.md at depth 1` is ever non-zero again, the future
half has bitten and is no longer deferrable.

### F4 — Station 04's F1 (a third arrival shape for the `-Command` / `--jq` trap) is still unlanded, for the same canonical-block reason, and this is its second consecutive deferral

04 measured `& powershell.exe -NoProfile -Command $str` issued from inside a `.ps1`: the quotes are
stripped and the `|` inside a jq expression is re-parsed as a **PowerShell pipeline operator**, so the
error is raised by the **caller** (`CommandNotFoundException: The term 'join' is not recognized`) and
never by `gh`. Both shapes recorded in DOCTRINE §9.1/§9.4 attribute the failure to `gh`, so a run
grepping for a `gh`-side fingerprint finds nothing and has *"the jq trap no longer reproduces"*
available — retiring a live trap.

The claim is sound and belongs in DOCTRINE. **DEFERRED**, with the reason stated rather than implied:
§9.1 and §9.4 both sit inside the hash-gated `CANONICAL-BLOCK: instruments v2`, whose comment requires
the hash to be re-recorded and the block shipped byte-identically across all seven station docs in one
PR. That is a change of its own.

⚠️ **Recorded so the deferral does not become permanent by accretion: this is the SECOND consecutive
run to defer it on the identical reason.** DOCTRINE's own §9.5 records a bullet that went on asserting
a staged fix for thirteen hours after it had merged, and its lesson is that a claim with no probe
outlives its truth. The probe here is 04's: issue `--jq ".labels[] | join(\",\")"` through
`& powershell.exe -NoProfile -Command $str` from inside a `.ps1`; if `gh` itself ever raises the error,
the third row is wrong. 04's evidence is preserved verbatim in its breadcrumb, which is on `main` and
archived by this PR, so nothing is lost by the delay — but a third deferral should carry a plan for
who ships the canonical-block PR, not just the same reason again.

### F5 — the device-bridge git guard is INERT, exit 2

Quoted in full under WHAT I MEASURED. This is the station doc's **expected** middle outcome, not an
anomaly: the installer writes its `PATH` export into `~/.bashrc` and `~/.profile`, neither of which a
station's non-interactive non-login shell sources. The ban was remembered and kept for this whole run.

**DEFERRED** — it becomes urgent if a run ever reports exit **non-zero** (the shim not written at
all), or if a station is measured running `git` against the mount, which is the failure DOCTRINE §9.2
records seven times. Third consecutive run (04 at 14:1xZ, 00 at 14:1xZ, 00 here) to read exit 2, which
is a small positive control on the guard's behaviour being stable rather than intermittent.

### F6 — Station 05's three un-actioned items, dispositioned here because 05 cannot dispatch

From 05's 14:23Z breadcrumb, landed by #2170 and archived by this PR. 05 named dispositions for its
own purposes; these are mine, as the station that collects:

- **`sot/02` §2 is stale again** (it says the board is empty against 6 open PRs). Already open with
  Marco as `needs-marco/sot02-in-pr-table-is-on-its-fifth-refresh-and-rots-within-hours-2026-09-23.md`,
  whose RULE 1 analysis names *"keep refreshing it daily"* as the option that **fails the future
  half**. Refreshing it again would be doing the thing the escalation exists to stop.
  **DEFERRED** — urgent only if Marco answers that escalation, which decides the shape of the fix.
- **`C:/po-worktrees/sup-cwd-paths` holds 2 uncommitted files** (467 min at my reading). **DISPATCHED**
  to Station 03 — worktrees are its lane and it fires at `23:02Z` today. Handed over: the path, the
  dirty count, the branch `fix/pipeline-scripts-resolve-state-paths-from-module`, and the constraint
  that `git worktree remove` will refuse while `--force` would **discard real work**, so it must be
  listed (`git -C <path> status --porcelain`) and preserved or committed before any prune. The second
  worktree, `C:/po-wt/fv2drop` (402 min, clean), belongs to **open PR #2158's** branch and must not be
  torn down while that PR lives.
- **24 of 81 API modules are absent from `sot/01`'s registry.** Report-only by 05's own contract, and
  the inclusion rule is a curated judgement, not a mechanical one. **DEFERRED.**

### F7 — the single most important thing blocking progress is Marco's label, and it is the design working

[MEASURED] this run: **five of six** open PRs carry `do-not-merge`, CP-26 reads `[LABEL_PRESENT]` on
every one, and **only Marco removes that label** (CP-26 gate 1; §10.2.1 restates the prohibition for
both of 00's modes). Four of the five additionally carry a live watcher `marco:true`, which §10.1 step
1 says binds and runs first. The oldest has been waiting since `2026-09-24T02:56Z`.

So the board's throughput is bounded by one human decision, not by any machine. Every part of the
pipeline upstream of that gate is healthy: the watcher is alive with an empty queue, trunk is green,
`--freshness` is CLEAN, all four enabled stations are on cadence, and the queue has nothing armable.
**This is not a defect.** It is worth naming as the blocker anyway, because a report that lists ten
red checks without saying they are one label reads as a broken board.

**ESCALATED** — the actionable half is F2's escalation file, which asks the one question a label
removal needs an answer to first (#2166 or #2167). The remaining four need no question from me: they
are green apart from the label and waiting.

## WHAT I DID NOT DO

- **Merged nothing except #2170.** The other five carry `do-not-merge` and four carry a live watcher
  `marco:true`; the fifth (#2166) is second-lane code under `scripts/pr-watcher/**`, outside
  `tests|docs` and outside 00's recorded `docs/` lane, which the 2026-09-22
  `NOT_WATCHER_ROUTED_IS_NECESSARY_NOT_SUFFICIENT_V1` narrowing settled is **Marco's**. I did not
  reason past that with "it is green and unlabelled would be nice".
- **Armed nothing**, and `.arming-log.txt` is therefore unchanged and is **not** in this PR. The only
  `GATES SATISFIED` candidate is a confirmed duplicate of open #2158 *and* on the never-arm denylist —
  measured, not assumed, above.
- **Did not close, relabel or choose between #2166 and #2167.** #2166 may be Marco's own
  supervised-lane work, which §10.2.1 permits and which leaves no queue trace by construction. Closing
  either would be guessing his intent (§5.5) on a PR that is his.
- **Did not edit DOCTRINE §9** for 04's F1 (F4's canonical-block reason), and did not touch
  `scripts/pipeline/title-scope-baseline.json`, `docs/qa/sot-refs-baseline.json`, or any other
  ratchet file.
- **Did not prune either orphaned worktree**, and did not run `--force` anywhere near the one holding
  2 uncommitted files. Dispatched to 03 instead (F6).
- **Did not restart the watcher or clear any lock.** It is alive (pid 42212) with a wrapper and an
  empty queue, which the station doc records as CORRECT, not wedged;
  `restart-watcher-if-wedged.ps1 -Fix` had no verdict authorising it and was not run. `index.lock` was
  **False** in both trees, so there was no lock to age or classify.
- **Did not discharge any `needs-marco/` file.** Section 5 tagged **no `[STALE]` row** this run; every
  line is `[FILE]` and each says on its face that it *"does not clear the escalation"*. Discharging on
  the tag alone — let alone on its absence — is the error the COLLECT section records.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.** Ran no `az`, no `Connect-MgGraph`, no
  production data read or written. #2170's `sot/` diff is Station 05's authorship; merging a PR is not
  editing the file.
- **Did not commit to `main`** in either tree, and ran no `git` mutation in
  `C:\po-watcher\ProjectOperations` — `Merge-Pr`'s `Push-Location` there issues only a `gh` call, which
  is GitHub-side. All work in this PR is in a disposable worktree cut from `origin/main`
  (`C:\po-wt\sup-0025`, branch `board/station00-2026-09-24-1514`), torn down at the end of the run.
- **Did not run `git` against the mounted folder from the VM**, the guard being inert (F5). Every
  `git` call went through Desktop Commander on the Windows host.
- **Did not write this report to the session `outputs` folder.** It is in this PR's worktree — the
  REPORT CONTRACT's preferred home — so no loose untracked copy is left in the dev tree and the
  post-merge fast-forward trap cannot fire on it.
