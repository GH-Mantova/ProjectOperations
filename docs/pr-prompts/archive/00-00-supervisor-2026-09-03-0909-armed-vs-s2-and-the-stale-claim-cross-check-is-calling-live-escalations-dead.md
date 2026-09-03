# Station 00 - Supervisor | 2026-09-03T09:09Z-2026-09-03T09:25Z

## GROUND

```
UTC            2026-09-03T09:09:01Z
origin/main    e82b0cc0            (fetch --prune, then rev-parse)
dev tree       main @ e82b0cc0     C:\ProjectOperations2  (was 5072f3f6 at run start; fast-forwarded this run)
doc version    1                   docs/pipeline/stations/00-supervisor.md
bootstrap      1                   scheduled-task SKILL.md
```

Doc version and bootstrap AGREE. Run was READ-WRITE.

## WHAT I MEASURED

**Reachability.** [MEASURED] `start_process` shell `powershell.exe` -> PID 28540, prompt returned.
This run was **SIGHTED**. (Preceding scheduled run at 08:06Z was also sighted; the 05:37Z one was
blind - escalation #17 stays open, one blind run in the last five is not a re-escalation.)

**Freshness of my own binding docs.** [MEASURED] `git diff --name-only origin/main -- <the three>`
returned exactly ONE file: `docs/pipeline/stations/00-supervisor.md`. DOCTRINE.md and
STATION-CAPABILITIES.md in the dev tree were byte-identical to `origin/main`, so reading the working
copies of those two was safe and is proved so, not assumed. **My own station doc was STALE in the
dev tree** - it was missing the VISION REVIEW block that `#1537` restored. I took the delta from
`git diff origin/main -- <path>` before acting, then fast-forwarded. This is exactly the trap
PREFLIGHT step 2 names, and it fired on the first run after the doc changed.

**Fast-forward.** [MEASURED] `git merge --ff-only origin/main` FAILED first pass:
`untracked working tree files would be overwritten` on
`docs/pr-prompts/00-00-supervisor-2026-09-03-0756-...-missed-caller.md`. The untracked local copy
was **not** identical to the committed one - local 10897 chars vs `origin/main` 14200, compared with
line endings normalised. The committed copy is the superset; the local one was a pre-expansion
draft. Moved the local copy out of the repo (kept as a backup outside the tree), then ff succeeded
to `e82b0cc0`. [INFERRED] the 08:06Z run expanded its 07:56 breadcrumb before committing it and the
on-disk draft was never cleaned up.

**Sweep.** [MEASURED] `scripts/pipeline/status-sweep.ps1` at 09:10:30Z ->
`SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station worktrees.`

**Machinery.** [MEASURED] `restart-watcher-if-wedged.ps1` -> `VERDICT: OK - nothing armed and the
watcher is alive.` (pid 24744). Parent chain resolved: `nodePID=24744 parent=27684`,
`wrapPID=33496`; probe read `node=1 wrapper=1`, so no `wrapper=0` question to resolve this run.
`index.lock` absent in BOTH `C:\ProjectOperations2\.git` and `C:\po-watcher\ProjectOperations\.git`.
`restart churn: 1 cycle(s) in 20 min (starts=1 exits=0, threshold 4)` - explained by the watcher
relaunch at `2026-09-03T08:55:06Z` visible in `C:\po-watcher\watcher-launch.log`. Not churn.

**Lane occupancy.** [MEASURED] `watcher-launch.log` tail shows only 5-minute
`[review] verdict-archive sweep` lines since 08:55Z and no `policy=tests-docs, waiting` line. **No PR
is inside a 90-minute `tests-docs` window right now**, so the standing "waiting PR goes first" rule
had nothing to defer to this run.

**Board.** [MEASURED] `gh pr list --state open --json ...` -> **COUNT=1**.

| PR | state | author | labels | title |
|---|---|---|---|---|
| #1536 | BLOCKED | GH-Mantova | `do-not-merge` | fix(tendering): WBS-SHIFT-S2 - night/weekend shift prices correctly in Path B |

Zero DIRTY. Zero PRs with frozen CI. #1536 is **Marco's alone** and was already established as such
by the 07:56Z run: it needs him to remove the label AND author `merge-approvals/1536.md`. **No agent
may author that receipt.** I did not touch it.

**Armed count, counted myself.** [MEASURED] `Get-ChildItem docs\pr-prompts -Filter *-ready.md`
-> **0** at run start. Not quoted from a note.

**COLLECT.** [MEASURED] `node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit 0, `CLEAN`,
`structure: 21 checked, 0 malformed`. Station ages: `00` 1.1h · `03` 34.2h · `04` 3.0h · `05` 43.0h,
all `ok`. **Newest breadcrumb of any station is my own 08:08Z one**, so there is NOTHING new to
collect since the previous run - every 03/04/05/06 finding on the board was already dispositioned at
08:06-08:35Z. That is a real result, not a skipped step.

**Silent no-ops / failures.** [MEASURED] no `pr-visualreview-s2*` entry in
`docs/pr-prompts/processed/` (positive control: the directory holds **3806** files, so the query is
live). The prompt has never run.

## WHAT CHANGED

**One thing: I armed one prompt.**

`docs/pr-prompts/pr-visualreview-s2-keep-the-screenshots-HOLD.md` -> `-ready.md`, via
`scripts/pipeline/arm-prompt.ps1 -Name pr-visualreview-s2-keep-the-screenshots` (never a bare
`git mv`). `-WhatIf` first, exit 0; then the real arm, exit 0.

Read-back [MEASURED]: `hold_exists=False`, `ready_exists=True`, `git diff --cached --name-status`
EMPTY after the script released the staged rename, and the audit line
`2026-09-03T09:12:50Z ARMED pr-visualreview-s2-keep-the-screenshots escalates=false ... pid=11676`
is in `.arming-log.txt`.

RULE 4 detector, both instruments, each with a control:

1. `lint-prompt.mjs` -> `PROMOTE (size 3)` +
   `GATE_RELEASED requires_on_main: "docs/pipeline/stations/00-supervisor.md :: VISION REVIEW" is
   now on origin/main`. `git --version` -> `2.55.0.windows.3`, so the five gate probes were NOT
   failing open.
2. Gate verified independently of the linter: `git show origin/main:docs/.../00-supervisor.md |
   Select-String 'VISION REVIEW'` -> **1**, negative control `zzzNoSuchTokenZzz` -> **0**.
3. Premise verified live: `Select-String -Pattern '\-\-out' scripts\pipeline\visual-smoke.mjs` ->
   **0**, positive control `playwright` -> **2** in the same file. The premise is alive; the work has
   not shipped.
4. Marker union, all THREE, case-sensitive, against the `pr-524` positive control:

   | marker | target | pr-524 control |
   |---|---|---|
   | `<!-- watcher: do-not-arm -->` | 0 | 0 |
   | `DO NOT ARM` | 0 | **1** |
   | `Arm ONLY` | 0 | **1** |

   The instrument was proved capable of a positive before its zero was believed.
5. **Body read in full.** No prose human gate. The `## STANDING AUTHORITY` block is the boilerplate
   that sits on ~51 of 61 prompts and is NOT an arming grant - it was not treated as one.
6. Not on the never-arm denylist, and not either of the two named must-not-arm-right-now prompts
   (`pr-cardui-s2-wbs-table-shell`, `pr-tr-s1-reminder-policy`).

**Scope of the armed prompt:** `scripts/pipeline/visual-smoke.mjs` + `docs/pipeline/stations/00-supervisor.md`.
[INFERRED, from `classifyPolicyFiles`] the `scripts/` path is outside `^(tests|docs)/`, so the PR the
watcher opens **will route to Marco by policy**. That is correct and expected, not a defect - and it
is deliberately NOT a docs-only prompt, because a docs-only PR would currently be fed to the
deadlocked `tests-docs` lane and come back `marco:true` on a timeout anyway (see FINDING 1).

Nothing else changed. No merge, no label touched, no `sot/` edit.

## FINDINGS

### 1. The `tests-docs` lane deadlock is unchanged and still gates the arming choice
[MEASURED] no `policy=tests-docs, waiting` line since the 08:55Z watcher restart; [INFERRED] because
the queue has been empty, not because the lane recovered. The escalation
`needs-marco/tests-docs-lane-deadlock-2026-09-03.md` (options A-D) is untouched and Marco's answer to
the related question was option (1), a DISTINCT timeout reason. Nothing in this run refutes or
advances it.
**DISPOSITION: DEFERRED** - it becomes urgent the moment a docs-only PR is opened. The workaround
stands: merge a green watcher-opened docs PR *while* it is in `waiting`, and the poll records
`{"ok":true}` and releases the lane.

### 2. The sweep's STALE-CLAIM CROSS-CHECK is telling stations to clear LIVE escalations
[MEASURED] `status-sweep.ps1` section 5 emitted `-- escalation is DEAD, clear it. Do NOT report it
as pending` against, among others:

- `tests-docs-lane-deadlock-2026-09-03.md` (six hits: #1539, #1537, #1301, #1531, #1534, #1500)
- `unattributed-arms-single-actor-2026-09-03.md` (three hits: #1531, #1534, #1532)
- `ruleset-requires-four-checks-...-2026-09-01.md` (four hits: #1488, #1482, #1485, #1504)

[MEASURED] all three of those escalations are OPEN and unanswered. The rule the check implements is
*"the file names a MERGED PR, therefore the escalation is discharged"*. That is **wrong by
construction for any escalation that cites PRs as EVIDENCE rather than as what it waits on** - and
citing merged PRs as evidence is exactly what a well-written escalation does. The failure is not
one bad file: it is three out of the four `[STALE]` groups in this run's output.

This was already known for `ruleset-requires-four-checks` ("AMEND, never bin"). It is now measured
across three files in one sweep, which makes it a defect in the instrument, not a quirk of one note.
A station that obeys section 5 literally will bin Marco's open questions.
**DISPOSITION: DISPATCHED -> 06 (PR Master).** Stage a prompt against
`scripts/pipeline/status-sweep.ps1` section 5 so a `[STALE]` verdict requires the referenced PR to be
the escalation's *subject* (e.g. named in front matter or in a `blocked_on:`/`waits_on:` field), not
merely mentioned in the body; everything else downgrades to `[FILE]`. Do NOT fold this into
`pr-gates.mjs` - CP-26 already couples two required checks to one cause. Until it ships, **no station
may act on a section-5 `[STALE]` line without reading the file.**

### 3. A consumed prompt's `-HOLD.md` stays tracked on `main` and becomes re-armable
The prompt I armed does not delete its own `-HOLD.md` from `main` in its scope, so when its PR merges
the HOLD will still be tracked - and any `checkout .`, `reset --hard` or fresh clone re-arms it.
[MEASURED] this has now happened five times (`#1492`/`#1493`, then `#1531`/`#1534`), and 00 has had to
retire the leftovers by hand twice (`#1535`, `#1539`).
**DISPOSITION: DEFERRED** - the retirement is a one-line `git mv` to `superseded/` that the NEXT 00
run should make in its board PR once the VS-S2 PR lands. It becomes ACTIONED then. The general fix (a
queue check that fails a PR consuming a prompt without retiring it) remains unstaged and is already
recorded against 06.

### 4. `05-sot-keeper` is 43.0h into a 24h cadence and its next miss makes it SILENT
[MEASURED] `--freshness` reports `05 last 2026-09-01T14:11:00Z 43.0h ago (cadence 24h) ok` - `ok`
only because the detector fires at 2x cadence, i.e. 48h. `03` is at 34.2h on the same 24h cadence.
Both missed their 09-02 run inside the escalated 16.6h all-stations disable.
**DISPOSITION: DEFERRED** - falsifying probe: `05` is due `2026-09-03T14:10Z` and `03` is due
`2026-09-03T23:00Z`. If `05` has not filed a breadcrumb by 14:11Z + a run's length, the disable
recurred and it goes straight to ESCALATED. The next 00 run after 14:10Z owns that check.

### 5. Two `needs-marco` files may be genuinely dead, but I did not bin them
`pr-1532-review-fix.md` (references #1532, merged) and
`pr-subbie-rate-cards-scope-pricing-HOLD.md` (references #212/#213, merged) are the two `[STALE]`
groups where the referenced PR plausibly IS the subject. Given FINDING 2, I will not act on the
sweep's word.
**DISPOSITION: DEFERRED** - fold into the existing clone-hygiene dispatch to 03, which already owns
moving dead `needs-marco/` files to `needs-marco/discharged/` (MOVE, never delete), and require the
file to be READ before it moves.

### 6. The board is one PR and it is entirely Marco's
#1536 is green on every real check; its two reds are the `do-not-merge` label itself. It needs Marco
to remove the label AND to author `merge-approvals/1536.md`.
**DISPOSITION: ESCALATED (standing, already with Marco)** - no new question. Nothing for a station to
do; nothing was done.

## WHAT I DID NOT DO

- **Did not merge anything.** The only open PR is `do-not-merge` and Marco's, on both gates.
- **Did not remove any label, and did not author any approval receipt.** Standing rule.
- **Did not arm a second prompt.** ONE AT A TIME. `pr-visualreview-s3-design-ref-frontmatter-HOLD.md`
  is the obvious next candidate and is deliberately left for the next run, after VS-S2's PR exists.
- **Did not touch `pr-cardui-s8-waste-section-HOLD.md`** - it is dirty mid-edit by 06 in the shared
  dev tree. Not committed, not discarded.
- **Did not clear the `[STALE]` needs-marco files** - see FINDING 2.
- **Did not restart the watcher.** Verdict was OK; it relaunched itself at 08:55Z.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
- **Did not run a smoke or a vision review** - there was no PR touching `apps/web/**` to run one on.
  Noting for the record that the VISION REVIEW procedure is now part of this station's doc as of
  `#1537`, and this is the first 00 run that has read it.
