# Station 00 — Supervisor | 2026-09-04T10:09Z–2026-09-04T10:4xZ

**SIGHTED, not blind.** `start_process` shell `powershell.exe` returned on the first call after a
keyword `ToolSearch` for `desktop-commander` (the ids this environment offers are
`mcp__plugin_desktop-commander_desktop-commander__*`). Every reading below was taken on the box.

## GROUND

```
UTC            2026-09-04T10:09:18Z
origin/main    aac5e187                (git fetch origin --prune, then rev-parse)
dev tree       main @ aac5e187         C:\ProjectOperations2   (already level; no ff needed)
doc version    1                       (station_doc_version, docs/pipeline/stations/00-supervisor.md)
bootstrap      1                       (station_doc_version in the scheduled-task SKILL.md)
```

Doc version and bootstrap **AGREE** — full authority this run.

**Which tree I read in:** the dev tree `C:\ProjectOperations2`. I did **not** compare a piped hash
against anything (DOCTRINE §9.5, the PowerShell re-encode trap). The freshness probe I used is the
sound one: `git diff --numstat origin/main -- docs/pipeline/stations/00-supervisor.md
docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md` → **EMPTY**, so the working copies
of all three binding documents are byte-identical to `origin/main` and reading them locally is
reading `main`.

## WHAT I MEASURED

**[MEASURED] `status-sweep.ps1` at 10:10:28Z–10:11:00Z.** Both §0 positive controls PASS (`gh`
reached GitHub and saw merged #1581; `node` runs). **VERDICT: CAUTION** — 1 "LIVE STATION WORKTREE"
(`C:/po-vg`). CAUTION binds me to new branches and an isolated worktree; it does not bar action.

- `[LIVE]` **OPEN PRs: 0.** Armed `*-ready.md`: **0** at the start of the run.
- `[LIVE]` watcher node **RUNNING pid 20000** (the process restarted at 09:37:14Z, so #1570/#1572/
  #1574/#1577 are the code that runs), wrapper alive, heartbeat 35 min — stale-with-empty-queue is
  idle, not wedged. `restart-watcher-if-wedged.ps1` at 10:13:57Z → **`VERDICT: OK`**, `ALIVE (pid
  20000)`, churn `0 cycles in 20 min` against a threshold of 4.
- `[LIVE]` single-actor gate at 10:15:44Z, re-measured immediately before the one mutation:
  in-progress prompts **0**, `index.lock` dev/clone **False / False**, git processes **0**,
  `git diff --cached --name-status` **EMPTY**, no PR touched in the last 2 min.
- `[LIVE]` **main CI on `aac5e187` is fully green** — `gh run list --commit` with the **full 40-char
  SHA** (§9.4: the short form answers `[]` at exit 0) returns four runs, `Push on main` / `CI` /
  `Deploy` / `Tendering Browser Smoke`, all `success`. The sweep's `1 running` at 10:10Z had
  completed by 10:12Z.

**[MEASURED] `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.** 3 breadcrumbs in the queue root,
0 malformed. `00 1.1h ok · 03 11.2h ok · 04 4.0h ok · 05 12.3h ok`. Crossed against
`list_scheduled_tasks`, as the contract requires, because `--freshness` alone cannot name a cause:

| station | `lastRunAt` | newest breadcrumb | reading |
|---|---|---|---|
| 00 | `2026-09-04T10:08:51Z` (this run) | 09:08 | aligned |
| 03 | `2026-09-03T23:01:39Z`, cron `0 9 * * *`, next 23:00:45Z | 23:02 | aligned |
| 04 | **`2026-09-04T10:10:30Z`** | 06:10 | **04 is running RIGHT NOW**, concurrently with me |
| 05 | `2026-09-03T14:11:26Z`, next 14:10:37Z today | 21:54 | aligned |

No station is SILENT, so no transcript read was needed for freshness. **04 fired at 10:10:30Z and
`list_sessions` shows `local_4d82ade5 "04 scanner" (running)`** — 04 is a read-only station and
mutates nothing on the board, but it is a second live actor and I record it rather than leaving the
next reader to infer a quiet board.

**[MEASURED] RULE 2 probe, pinned to the LIVE tree** `C:\ProjectOperations2\docs\pr-prompts\processed`
(never the clone, §9.5): the per-PR body match `PR #1567` returns exactly one line —
`{"ok":false,"marco":true,"reason":"outside tests/ or docs/: .github/workflows/ci.yml"}`. That is
this run's positive control and it is the finding itself; see F1. **The board held 0 open PRs when
I read it, so there was no PR to clear and RULE 2 gated nothing this run.**

**COLLECT.** Three breadcrumbs in the queue root: `00-0809`, `00-0908` (both mine, each dispositions
its own findings) and `00-04-scanner-2026-09-04-0610`. 04's `0610` was collected and dispositioned by
the `0809` run — verified by reading `0809`, not assumed — so I did not disposition it twice.
**Nothing was left uncollected.** The two open handovers addressed to *this* run are F1 and F3 below.

## WHAT CHANGED

1. **Armed exactly one prompt** — `pr-approval-receipt-test-gaps` (F3), via `arm-prompt.ps1`
   (`-WhatIf` first, then behind its `po-arm.lock`). `10:15:53Z ARMED`. The watcher queued it at
   `10:15:54.439Z` and started it at `10:15:54.567Z`.
2. **This PR**: this breadcrumb.

**Nothing else.** No merge (the board held 0 open PRs the whole run), no label added or removed, no
`do-not-merge` cleared, no `/sot/` edit, no worktree pruned, no watcher restart, no `git` mutation in
the watcher clone, no rename other than the arm.

## FINDINGS

### F1 — #1567 merged, and the merge was Marco-directed in an interactive continuation, not an autonomous station action

The `0908` run handed this run one explicit instruction: *"Confirming #1567's fate is one
`gh pr view 1567` and belongs to the next run — do that before anyone writes a fourth detector."*

**[MEASURED]** `#1567` — `feat(pipeline): detect docs/pr-prompts/*-ready.md that .gitignore
swallowed` — is **MERGED at `2026-09-04T05:02:11Z`**, `author: GH-Mantova`, `mergedBy: GH-Mantova`,
files `.github/workflows/ci.yml` + `scripts/pipeline/check-armed-tracked.mjs` + its test. Its watcher
verdict is a genuine `marco:true`.

**That combination reads, on its face, as a RULE 2 violation**, and the `0409` breadcrumb makes it
look worse: it wrote *"the next 00 run should drive it green and **leave it unmerged** (RULE 2)"* —
and #1567 was merged 37 minutes later. `mergedBy: GH-Mantova` attributes nothing (open escalation
\#22), and the `0540` run's session census concluded *"the 04:08 run was still working long after it
wrote breadcrumb 0409: it merged #1567 at 05:02Z"*.

🔴 **That conclusion is incomplete, and the missing half changes the verdict.** [MEASURED] via
`read_transcript` on session `local_38901e4d` — the 04:08 session — the transcript shows the
scheduled run **finishing and posting its 04:09Z–04:25Z report**, and then a **`[user]` turn**:

> *"bring yourself up to speed / you are station 00, once you are up-to-date, check the board, keep
> arming/opening prs that have their gates open or are the slice-0 of a cluster. / you will drive
> them to open > green > merged"*

**Marco was present.** Everything after 04:25Z in that session — the 05:02Z merge of #1567 and the
05:14:45Z opening of #1568 — is an **interactive, human-directed continuation**, not the scheduled
station acting alone. RULE 2 is cleared by Marco in chat, for that batch, and that is what happened.
**No RULE 2 violation occurred, and no station should re-raise one.**

Two things worth keeping, because both cost this run time to establish:

- **A session directory does not distinguish a scheduled run from an interactive continuation inside
  the same session.** The `0540` census was sound about *when* and wrong about *who*, and "the 04:08
  run merged it" is the kind of half-true line DOCTRINE warns is the worst shape a binding claim can
  take. **The transcript is the instrument that separates them, and it is cheap.**
- The same transcript ends on an **`AskUserQuestion`** with no answer, which is why
  `local_38901e4d` still reads `running` in `list_sessions` — the already-recorded §9.5 trap, now
  with its cause named: *a session that ends on an unanswered question never clears its flag.*
  Asking was correct there (RULE 3, Marco present); it is the flag that lies, not the run.

**DISPOSITION: ACTIONED.** The handover is closed: #1567's fate is MERGED, the merge is accounted
for, and no escalation follows from it.

### F2 — #1567 does NOT cure the spent-`-HOLD.md` defect, and the `0908` breadcrumb says it does

The `0908` run's F4 recorded a spent `-HOLD.md` still tracked on `main` for the third time in one
day, and wrote: *"The general cure was already built: `pr-queue-armed-tracked-detector` ran at
04:24Z and opened **#1567**."* **[MEASURED] that is wrong, and it is wrong in the direction that
stops the next run looking.**

`scripts/pipeline/check-armed-tracked.mjs` (now on `main`, wired into CI by #1567) answers a
different question. From its own header and its rule list, read in full:

> *Rule per top-level `docs/pr-prompts/*-ready.md` file: 1. If it is tracked → pass. 2. If untracked
> but a `-HOLD.md` twin exists on `origin/main` (a legitimate arming-by-rename mid-flight) → pass.
> 3. Otherwise → FAIL.*

It detects **arming-by-creation swallowed by `.gitignore:75`** — a `-ready.md` that no station can
see. **A spent `-HOLD.md` left tracked on `main` is not merely undetected by it: rule 2 makes that
exact state a PASS by construction.** The two defects share a filename pattern and nothing else.

🔴 **And they are not independent — the obvious cleanup breaks the new CI gate.** Deleting a spent
`-HOLD.md` from `main` while its `-ready.md` is still in the working tree removes the twin rule 2
relies on, so `check-armed-tracked.mjs` would then FAIL on a perfectly healthy mid-flight arm. **The
cure has an ordering constraint: a `-HOLD.md` may only be deleted once its `-ready.md` is gone,
i.e. in or after the consuming PR — never at arming time.** I hit this live this run: I armed
`pr-approval-receipt-test-gaps` at 10:15:53Z, and its `-HOLD.md` is still tracked on `origin/main`
by design and must stay there until the prompt is consumed.

[MEASURED] scale, so the next run does not re-derive it: `git ls-tree -r --name-only origin/main --
docs/pr-prompts/` filtered to depth-1 `-HOLD.md` returns **75**; `triage-holds.ps1` over those 75
returns **spent=0**, gates-satisfied=33, still-gated=42, unreadable=0, with its own SPENT verdict
proved reachable against a fixture control. **So there is no spent-HOLD residue on the board right
now** — the `0908` run deleted the one instance in #1581 — and this is a latent defect, not a live
mess. It recurs once per armed prompt whose PR does not happen to touch `docs/pr-prompts/`.

**DISPOSITION: ACTIONED for the false claim** — corrected here, in the channel the next run reads,
which is the whole point of the collect. **DEFERRED for the defect itself**, with the cure written
down rather than left to be rediscovered a fourth time: extend `check-armed-tracked.mjs` (do not
write a fourth script) with a second, independent pass — *for every depth-1 `-HOLD.md` tracked on
`origin/main`, FAIL if no `-ready.md` twin exists in the working tree **and** its `premise` no
longer holds*, which is exactly the `SPENT` verdict `lint-prompt.mjs` already computes and
`triage-holds.ps1` already calls. It becomes urgent the moment `triage-holds.ps1` reports
`spent > 0`, because that is the state in which a consumed prompt can be offered as a live arming
candidate. **That probe is one line and it is the falsifier for this finding — run it, do not quote
this paragraph.**

### F3 — The nested-test-path lane goes live for the first time, on a prompt whose own routing note is now stale

`#1570` (`classifyPolicyFiles` matches nested `__tests__` and `.test`/`.spec` files) merged at
07:5xZ but only started **running** at 09:37:14Z with the restarted watcher. It has never been
observed live. The `0908` run also left a falsifying probe unrun: *"the next watcher-opened docs-only
PR should reach `autoMergeRequest: ENABLED` inside its 90-minute window with no supervisor touching
it."* Both needed a watcher-opened PR, and the board held zero.

I armed **`pr-approval-receipt-test-gaps`** — size 1, `escalates: false`, `gate_allow: none`, no
migration, scope exactly one file: `scripts/pr-gates/__tests__/approval-receipt.test.mjs`. It adds
the four CP-26 branches #1493 covered and #1492 did not. RULE 4 applied in full: `lint-prompt.mjs`
**ADMIT** (which runs the three literal don't-arm markers at `:728`/`:730`/`:732` *before* the
premise), plus I read the body — `## STANDING AUTHORITY` is the boilerplate on ~51 of 61 prompts and
is not an arming grant, and there is no prose gate.

**Why this prompt and not another.** [MEASURED] on `origin/main`, `NESTED_TEST_PATHS` is
`[/^(tests|docs)\//, /(^|\/)__tests__\//, /\.(test|spec)\.[cm]?[jt]sx?$/]`. The single file in this
prompt's scope matches the **second and third** patterns. So under the code now running, this PR
classifies into the **automatic `tests-docs` lane** — and it is therefore a live probe for #1570,
for the `0908` F1 auto-merge question, and (if it ever goes BEHIND with checks in flight) for
#1577's no-rebase guard, all from one arm.

🔴 **The prompt's own `## Gate routing` section says the opposite**, in prose: *"`scripts/` is
outside `^(tests|docs)/`, so `classifyPolicyFiles` routes this to Marco and the watcher will not
auto-merge it."* **That was true when it was written and #1570 refuted it.** The general lesson,
which is worth more than the instance: **a prompt that hard-codes a prediction about how the
classifier will route it goes stale silently when the classifier changes, and it is read by an agent
who has no reason to doubt it.** A prompt should state its *scope*; the classifier states the
routing.

**DISPOSITION: ACTIONED (armed and running).** **What the next run must do, and must MEASURE rather
than assume:**

1. `gh pr view <n> --json autoMergeRequest,files` on whatever PR this prompt opened. **ENABLED with
   no supervisor touching it ⇒ #1570 and the auto-merge lane are both confirmed live.**
2. `autoMergeRequest: none` while all checks are green ⇒ the `0908` F1 ordering effect (the
   `rev-<n>` review job queued behind the merge wait on a single-lane worker) is a **second,
   independent cause** and becomes a new escalation. The evidence to bring is the
   `[queue] rev-<N> … busy` line with no `[start]` before the merge.
3. A `marco:true` verdict on this PR ⇒ either #1570 is not doing what its code says, or the 90-min
   `MERGE_TIMEOUT_MS` expired and wrote a routing byte-identical to a policy decision (DOCTRINE
   §10.3). **Distinguish those two by the `reason` string before concluding anything**, and note
   that RULE 2 then binds either way.

### F4 — Escalation #23 recurrence: 00's recorded cadence is still 2h against an hourly cron

[MEASURED] `check-breadcrumb.mjs --freshness` printed `00 … (cadence 2h) ok` while
`list_scheduled_tasks` returns `cronExpression: "5 * * * *"` for `00-supervisor` and
`nextRunAt 2026-09-04T11:07:52Z` — hourly. With the detector alarming only past **2×** cadence,
Station 00 must miss **four** consecutive occurrences before it can read SILENT. Unchanged from the
`0809` and `0908` runs.

**DISPOSITION: ESCALATED — Marco, as recurrence evidence on OPEN escalation #23**
(`needs-marco/station-freshness-detector-cannot-see-a-missed-run-2026-09-03.md`). **Not a new
escalation and no new options.** #23's RULE-1 option **(a)** — record each station's real cadence and
alarm at `1× cadence + grace` — remains first, and remains the only one that is both complete
(fixes it for every station, now and future) and additive (adds a table, damages no existing data).
Option (b), changing 00's `2`→`1` alone, fails *complete*. Option (c), the `lastRunAt` +
session-directory cross-check, is necessary alongside (a) but cannot replace it, because the MCP is
unreachable from CI.

### F5 — Six non-main worktrees and two registry escapees, unchanged, and `C:/po-vg` is still classified LIVE

[MEASURED] from the 10:10:28Z sweep: orphaned `C:/po-1483-fix` (3350 min), `C:/po-guard` (605 min),
`C:/po-sa-fix` (1712 min), detached `C:/po-work/s2-e2e` (3478 min); "LIVE STATION WORKTREE"
`C:/po-vg` on `fix/no-rebase-while-checks-run`, **dirty=1, age 137 min**; registry escapees
`C:\po-worktrees\fix-1523` and `…\vs-s2-durable-smoke`, both 0 KB with no `.lock`.

`C:/po-vg` holds the work that shipped as **#1577, merged 08:15Z** — so it is almost certainly no
longer live, and it is the sole reason the sweep verdict has read CAUTION for three consecutive
runs. **Almost certainly is not a measurement I will prune on**, and pruning next to a worktree I do
not own is the shape of the incident this station is named for. The classifier keys on `dirty>0`,
which cannot distinguish *a station is working here* from *a station finished and left a file*.

**DISPOSITION: DEFERRED → Station 03**, whose lane this is; unchanged from `00-0609` F5, `00-0809`
and `00-0908` F6. It becomes urgent if the count grows, or if `git status --short` inside any of
them shows uncommitted work that is not already on `main`. 03 next runs at `2026-09-04T23:00:45Z`.
**Worth 03's attention specifically: the `dirty>0` liveness heuristic is producing a standing
CAUTION on a dead worktree, and a verdict that is always CAUTION is a verdict nobody reads.**

## WHAT I DID NOT DO

- **Did not merge anything.** The board held **0 open PRs** for the entire run; there was nothing to
  drive. The PR my own arm produces is deliberately left to the automatic lane — merging it myself
  would destroy the probe F3 exists to run.
- **Did not arm a second prompt.** RULE 4 is one at a time. 33 of the 75 depth-1 HOLDs lint ADMIT;
  ADMIT is necessary, not sufficient, and I did not treat the other 32 as a queue.
- **Did not touch the named never-arm prompts**: `pr-fv2-formrule-contract`,
  `pr-siteid-notnull-backfill`, any prod-data prompt, `pr-tr-s1-reminder-policy` (size 9,
  `gate_allow: migrations` — Marco's), `pr-verdict-anchor-heading-form` (staged, not armed; it opens
  a `scripts/` PR), `pr-hygiene-s1-guarded-branch-prune` (irreversible), or
  `pr-watcher-app-auth-switch-on` (production auth config — Marco's, hard stop 4).
- **Did not delete any spent `-HOLD.md`**, and specifically did **not** delete
  `pr-approval-receipt-test-gaps-HOLD.md` from `main` — F2 shows that would break
  `check-armed-tracked.mjs` on a healthy mid-flight arm.
- **Did not restart the watcher.** `restart-watcher-if-wedged.ps1` → `OK`; it runs today's code
  already, and restarting mid-prompt would kill the F3 probe.
- **Did not prune any worktree** (F5), and did not mutate `git` in the watcher clone — every clone
  read this run is `Test-Path` / `Get-Content` only.
- **Did not add or remove a label anywhere**, and did not clear any `do-not-merge`.
- **Did not drain or re-queue `blocked/`** (109 entries, mostly `rev-*`). The verdict-guard fix is
  only now running; whether those should be replayed is a decision with a blast radius nobody has
  measured, and it is not this run's work.
- **Did not archive `00-0809`, `00-0908` or `00-04-scanner-0610`.** They are this cycle.
- **Did not touch** `/sot/`, Azure, Entra, SharePoint, or production data.
