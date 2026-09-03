# Station 00 — Supervisor | 2026-09-03T13:08:59Z–13:36Z

## GROUND

```
UTC            2026-09-03T13:08:59Z
origin/main    12df7bfc            (fetched --prune, then rev-parse)
dev tree       main @ 12df7bfc     C:\ProjectOperations2
doc version    1                   (docs/pipeline/stations/00-supervisor.md)
bootstrap      1                   (scheduled-task SKILL.md)
```

Versions AGREE — this run was read-write. **SIGHTED run**: `start_process` shell `powershell.exe`
returned a live prompt on the first call. All three binding documents were read from a dev tree
proved byte-identical to `origin/main` (`git diff --stat origin/main --` over all three: empty).

## WHAT I MEASURED

**Board — 4 open PRs, unchanged since 12:18Z.** [MEASURED] `status-sweep.ps1` 13:10:20Z, instrument
positive controls both `[LIVE]` (gh saw merged #1546; node runs).

| PR | state | CI | label | lane verdict |
|---|---|---|---|---|
| #1544 | UNKNOWN | 14/0/0 green | `[]` | **none — second lane** |
| #1543 | CLEAN | 14/0/0 green | `[]` | `marco:true` `outside tests/ or docs/: scripts/pipeline/__tests__/lint-prompt.design-ref.test.mjs` |
| #1541 | CLEAN | 14/0/0 green | `[]` | `marco:true` `outside tests/ or docs/: scripts/pipeline/visual-smoke.mjs` |
| #1536 | BLOCKED | 12/2 **red** | `do-not-merge` | `marco:true` `escalates:true - held for Marco, labelled do-not-merge` |

[MEASURED] RULE-2 probe `Select-String -Path *.log -Pattern 'marco.:true'` in
`docs/pr-prompts/processed/` — **POS control 606**, **NEG control (`zzzNoSuchTokenZzz`) 0**. Labels
read **per-PR** via `gh pr view N --json labels` (LL-47), not from the board listing — the listing
form collapsed the JSON array to one object (§9.4) and showed a single `do-not-merge` that could not
be attributed; the per-PR reads resolve it to #1536 alone.

**[MEASURED] #1544 is NOT conflicted — its `UNKNOWN` is a stuck GitHub cache.** Two probes 12 s
apart both returned `mergeable=UNKNOWN`; the positive control `#1543` returned `MERGEABLE`
immediately, so the instrument works. Direct local test:
`git merge-tree --write-tree origin/main refs/pull/1544/head` → **exit 0**, tree `914072b2`.
It merges clean against `12df7bfc`. Its 14 checks are real and current, not frozen-stale.
Hand-classified per DOCTRINE §10.1 rule 2 — files are `.claude/agents/**` (×6),
`docs/pipeline/STATION-CAPABILITIES.md`, `scripts/pipeline/lint-station.mjs`,
`scripts/pipeline/next-sweep.mjs`; everything outside `^(tests|docs)/` ⇒
**[NO LANE VERDICT — hand-classified MARCO'S]**. Independently corroborated: its own review file
line 25 records *"PR was hand-opened by Marco (not auto-fired by watcher)"*.

**[MEASURED] #1536's two reds are ONE cause.** `gh pr checks 1536` → `Approval receipt (CP-26)` fail
and `PR gates — diff checks` fail, both in run `33754736329`. Correctly HELD; its remedy is a
`merge-approvals/1536.md` receipt **no agent may author**. Not a broken PR.

**[MEASURED] Machinery healthy.** watcher node pid **24744**; auto-restart wrapper alive (1);
heartbeat 51 min (ticks only mid-run — stale + empty queue = idle, not wedged); armed **0**;
in-progress prompts 0; `index.lock` false in both trees; 0 git processes; no PR touched in 2 min ⇒
**SAFE to act**. Watcher clone read-only: `branch=main`, `MERGE_HEAD` **False**, no rebase dirs,
**0** unmerged paths; its `dirty=3` is three **untracked** review files
(`pr-1541/1543/1544-review.md`). **NOT corrupt — do not run `rescue-watcher-repo.ps1`.**

**[MEASURED] Breadcrumbs collected.** `check-breadcrumb.mjs --freshness` → structure 3 checked,
0 malformed; **CLEAN, exit 0**. The three are 04's 1010 and my own 1109 and 1220 — **all already
dispositioned in prior runs. No new station breadcrumb since 12:20Z.**

**[MEASURED] Scheduled tasks, from the MCP (the only live source).** All five `enabled: true`.

| task | cron | lastRunAt | nextRunAt |
|---|---|---|---|
| 00-supervisor | `5 * * * *` (**hourly**) | 2026-09-03T13:08:41Z | 14:07:52Z |
| 04-scanner | `0 */4 * * *` | 2026-09-03T10:10:18Z | 14:09:31Z |
| 05-sot-keeper | `10 0 * * *` | **2026-09-01T14:11:31Z** | **2026-09-03T14:10:37Z** |
| 03-machine-minder | `0 9 * * *` | **2026-09-01T23:01:43Z** | **2026-09-03T23:00:45Z** |

Cron is Brisbane-local, `nextRunAt` is UTC; the +14 h offset reconciles exactly (00:10 AEST =
14:10 UTC) so the schedule itself is **correct**. What the table shows is that **05 and 03 each
skipped exactly one occurrence — the 09-02 one — and fired neither before nor since.**

## WHAT CHANGED

1. **Staged** `docs/pr-prompts/pr-verdict-anchor-heading-form-HOLD.md` (size 3, `escalates:false`).
   Read back: `lint-prompt.mjs` → **`ADMIT (size 3)`, exit 0**. The same instrument returned
   **`REJECT [MISSING_STANDING_AUTHORITY]`, exit 1** on the first draft, so it is proved able to
   produce both verdicts (§7 guard 1) — the ADMIT is a real reading, not a skipped check.
   **NOT ARMED.** It is a tracked `-HOLD.md`; committing one cannot start work.
2. **This breadcrumb.**
3. Nothing else. **No merge, no arm, no label change, no `/sot/` edit, no watcher restart.**
   Two scratch probes were written to `C:\po-sup-fix-scripts\` (outside the repo) and one temporary
   ref `refs/temp/pr1544` was created and **deleted** (read back: `git update-ref -d` confirmed).

## FINDINGS

### F1 🔴 The watcher's verdict reader is anchored, and a markdown heading silently defeats it

`scripts/pr-watcher/index.mjs:1418` decides whether the reviewer approved a PR with
`/^VERDICT:\s*MERGE\b/m` — anchored at start-of-line, tolerating no heading prefix. The comment at
`:1410-1411` states the contract ("the verdict on the first line"); **nothing enforces it on the
reviewer**, and the reviewer does not always honour it.

[MEASURED] Reproducing the live regex verbatim in node over all 602 reachable `pr-*-review.md`
(watcher clone + `verdicts-archive/` + dev tree), 478 distinct MERGE verdicts:

```
matched by the LIVE strict regex : 474
SILENTLY MISSED (heading form)   :   4  -> pr-1543 (live, open) + pr-762 (historic, 3 copies)

POS  'VERDICT: MERGE'    -> true     NEG  'VERDICT: BLOCK'  -> false
BUG  '## VERDICT: MERGE' -> false
```

`pr-1543-review.md` line 3 is `## VERDICT: MERGE` and its Recommendation reads "Merge."
`verdictApproves(1543)` returns **false**. `verdictApproves` is neither exported nor covered by any
test in `scripts/pr-watcher/__tests__/` (searched; 0 hits).

**Honest scoping — this is LATENT today, not operative.** #1543's `marco:true` names a *policy*
path, so it fell out at `:1774/:1776` before the verdict was ever consulted. This defect bites the
first PR that is *otherwise policy-eligible* (diff confined to `tests/**`+`docs/**`) whose reviewer
writes the heading form — and `pr-762` shows that has already happened once. When it does, `:1826`
falls through and `:1848` writes `"timeout waiting for green checks + MERGE verdict"` — **byte-
identical to a genuine routing**, which RULE 2 then correctly refuses to clear.

It is the **same defect shape as the GATE-ALLOW marker trap** ("must be BARE at column 0"), on a
second regex. The pipeline learned this lesson once already and the verdict reader has it too.
It is a **third, independent** cause on the `tests-docs` deadlock thread — and unlike the CI-latency
timeout and the `verdict-guard` extractor, it is a one-line fix.

**DISPOSITION: ACTIONED** — root-caused, measured with a full control set, and the fix staged as
`pr-verdict-anchor-heading-form-HOLD.md` with the widening (`/^#{0,6}[ \t]*VERDICT:\s*MERGE\b/m`,
strictly additive), the export-for-testability step, and the four required test cases including the
two negative controls that prove the widening did not make the reader permissive. The prompt
explicitly forbids touching `verdict-guard.mjs`, folding anything into `pr-gates.mjs`, and relaxing
`MERGE\b`. **Not armed** — see WHAT I DID NOT DO.

### F2 🔴 The freshness detector cannot see a single missed run, and 00's cadence is recorded wrong

`check-breadcrumb.mjs:36` — `const CADENCE = { '00': 2, '02': null, '03': 24, '04': 4, '05': 24 }`,
with `:35` declaring *"SILENT past 2x its cadence"*. Against the live cron measured above:

- **00 is HOURLY (`5 * * * *`), recorded as 2 h.** SILENT therefore needs 4 h of silence —
  **four consecutive missed hourly runs** — before the only detector fires.
- **On a 24 h station the 2× rule makes one missed occurrence structurally invisible.** Right now
  03 (38.1 h) and 05 (47.0 h) have each missed exactly one occurrence and the gate prints **`ok`**
  for both, exit 0. It is not wrong by its own rule; the rule is too blunt to catch what happened.

This is the instrument that is supposed to notice a station that stopped — and "all four stations
sat disabled for 16.6 h" (#1524) is the incident it exists to prevent.

**DISPOSITION: ESCALATED** — this needs Marco because it is a *sensitivity* choice, not a bug with
one right answer, and tightening it wrongly produces false SILENT alarms, which §7 records as
actively harmful (a false alarm licenses destructive action and trains the reader to ignore it).

> **The question.** How should a missed station run be detected?
>
> **(a) COMPLETE + ADDITIVE — record each station's real cadence, and alarm on `1×cadence +
> grace`, with the grace per-station.** Fixes both halves: 00 gets its true 1 h, and a 24 h station
> alarms after ONE missed occurrence instead of two. Additive — no existing breadcrumb, path or
> exit code changes; only the threshold moves, and `--freshness` keeps exit 2 for silence.
> **Passes both RULE-1 tests.**
> **(b) Fix only 00's cadence (`2`→`1`), leave the 2× rule.** Cheap and safe, but fails the
> *complete* half: 03 and 05 keep needing two missed days, which is the case that actually
> happened today.
> **(c) Drive freshness off the scheduled-tasks MCP `lastRunAt`/`nextRunAt` instead of breadcrumb
> mtimes.** Strictly the most correct — it measures whether the task *fired*, not whether it
> *reported*, and those are different failures. Fails the *immediate* half: the MCP is not reachable
> from CI, where `check-breadcrumb.mjs` runs under `pipeline-tests`, so it cannot replace the
> current check — only supplement it from a station run.
>
> My reading: **(a)**, with **(c)** as a follow-up probe run by 00 each cycle. I have not staged
> either — the threshold is Marco's call.

### F3 🟢 #1544's `UNKNOWN` is a stuck cache, not a conflict — do not report it as DIRTY

Recorded so no later run repeats the inference. Q1 of the answer sheet actively pushes a reader
toward *"UNKNOWN/DIRTY ⇒ CI frozen ⇒ biggest blocker on the board"*; here that is **false**, proved
by `merge-tree` exit 0 and a working positive control. #1544 is green, mergeable, and waiting on
Marco alone.

**DISPOSITION: DEFERRED** — nothing to fix. It would become urgent if `merge-tree` started
returning 1, or if the 14 checks aged out against a moved base.

### F4 The board is four PRs and **all four are human-gated**

Three carry genuine `marco:true` verdicts naming specific non-`tests|docs` paths; the fourth is
second-lane with no verdict, hand-classified Marco's. **I can merge none of them**, and that is
correct, not a fault. Note for the next run: **#1543's routing reason names a unit-test file** —
`scripts/pipeline/__tests__/…test.mjs`. `classifyPolicyFiles` is a **path-prefix** test, so a file
under `scripts/` is outside `tests/` however test-like it is; **no pipeline-script change can ever
reach the `tests-docs` lane.** The reason is correct; it only reads odd.

**DISPOSITION: DEFERRED** — Marco's to merge. Nothing an agent may do clears any of the four.

### F5 03 and 05 each skipped their 09-02 occurrence; both fire again within hours

[MEASURED] above. 05's next fire is **14:10:37Z** (~34 min after this run ends) and 03's is
**23:00:45Z**. Both tasks are `enabled: true` and their `nextRunAt` is scheduled and in the future,
so this is a *missed* occurrence, not a *stopped* task. A plausible mechanism is already on record:
`scheduled-tasks.json` is rewritten from memory when Claude Desktop exits, and a daily task whose
window passes while the app is down does not catch up.

**DISPOSITION: DEFERRED** — deliberately **not** escalated this run. Escalating a station that is
scheduled to fire in 34 minutes is the false-emergency shape §7 and the answer sheet both warn
about. **The trigger for the next run is specific: if 05 has not filed a breadcrumb by the 15:07Z
run, or 03 by the first run after 2026-09-04T00:00Z, that is a stopped station — escalate it then.**
F2 is the reason neither was caught automatically.

## WHAT I DID NOT DO

- **Armed nothing (armed = 0), deliberately — second run in a row.** Four human-gated PRs and a
  `tests-docs` lane with three known causes means the next arm lengthens a queue nobody can drain.
  RULE 4's own first instruction is to ask whether to arm **at all**. The one thing I staged is a
  `-HOLD.md`, which cannot run until someone arms it.
- **Did not fix F1 directly**, though it is a one-line change I could have pushed. It touches
  `scripts/`, so the policy classifier would route the PR to Marco and make the board **five**
  human-gated PRs instead of four — buying nothing, since the fix cannot take effect until it
  merges either way. Staging it keeps my board PR docs-only and hand-landable.
- **Did not touch `verdict-guard.mjs`** (the backticked-path extractor, already dispatched to 06),
  `#1536`'s receipt (no agent may author one), or any `do-not-merge` label.
- **Did not restart or repair the watcher** — it is healthy (pid 24744, wrapper alive) and its
  clone's `dirty=3` is untracked review files, not corruption.
- **Left to 03:** three orphaned worktrees (`C:/po-1483-fix` 2090 min, `C:/po-sa-fix` 452 min,
  `C:/po-work/s2-e2e` 2218 min, all `dirty=0`) and two registry escapees under `C:\po-worktrees`
  (`fix-1523`, `vs-s2-durable-smoke`, both 0 KB, no `.lock`). All dead-looking; none is mine to prune.
- **Did not act on the sweep's three `[STALE]` cross-check lines.** A prior run measured that this
  cross-check calls live escalations dead; it is a lead, not a finding.
- `/sot/`, Azure/Entra/SharePoint, production data, `metadata-catalog.json`.
