# Station 00 — Supervisor | 2026-08-31T10:09Z–2026-08-31T10:5xZ

## GROUND

```
UTC            2026-08-31T10:09Z
origin/main    4ea28d6d            (git fetch origin, then rev-parse)
dev tree       main @ 4ea28d6d     C:\ProjectOperations2   (0 behind / 0 ahead, index EMPTY, no extra worktrees)
doc version    1                   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1                   (scheduled-task SKILL.md)  -> MATCH, full authority
```

SIGHTED. `start_process` shell `powershell.exe` succeeded on the first call (PID 8568, then 4972
after the first shell died on an oversized `gh run view --log` pipe). All three binding documents
were read from the working copy AFTER proving the working copy is byte-identical to `origin/main`:
`git diff --name-only origin/main -- docs/pipeline/DOCTRINE.md docs/pipeline/STATION-CAPABILITIES.md
docs/pipeline/stations/00-supervisor.md` returned **empty**, with HEAD == origin/main.

## WHAT I MEASURED

- **[MEASURED] Sweep verdict: `SAFE TO ACT`** — `scripts/pipeline/status-sweep.ps1`, run 10:09:40Z
  and again 10:10:09Z. Instrument positive controls both pass (`gh` saw merged #1446; `node` runs).
  Re-read immediately before the only board mutation this run.
- **[MEASURED] Watcher HEALTHY.** node pid **32916**, auto-restart wrapper alive (1), heartbeat age
  **3 min**, clone `branch=main dirty=0`, orphaned worktrees none, guard hook present.
  🔧 **The clone's long-standing `dirty=35` permanent amber is GONE — it now reads `dirty=0`.** The
  standing note that calls that amber "not news" is now describing a state that no longer exists.
- **[MEASURED] Board: 2 open PRs, and BOTH are watcher-routed to Marco (RULE 2).** Positive control
  for the probe first: `'"marco":true'` across `docs/pr-prompts/processed/*.log` → **590 hits**, so
  the query works. Then, per PR:
  - `#1443` — `{"ok":false,"marco":true,"reason":"escalates:true - PR already carries do-not-merge - no duplicate apply"}`
  - `#1447` — `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/crm/comms/comms.controller.ts"}`
  **I merged neither, and RULE 2 alone settles it regardless of colour.**
- **[MEASURED] `#1443` is RED on a REAL defect, not the known flake.** `read-gate-failure.ps1 -PR 1443`
  on run `33379866798`: `1 failed / 163 passed`, exit 1. The failing spec is
  `tests/e2e/pr-acceptance/batch8-misc.spec.ts:127` — *"card creation discipline picker gates Create
  until a discipline is chosen (PR #248)"* — dying at **line 161**, `locator.click` timeout of 60000ms
  on `page.getByLabel("Delete card Asbestos removal")`.
  🔴 **The `reference_tendering_e2e_plant_pills_flake` playbook does NOT apply**: that flake is
  `batch3-scope-items.spec.ts:246`, a different spec. And it is not a one-off — the branch has had a
  failing `Tendering Browser Smoke` across **nine** distinct head SHAs from 08:22:26Z to 09:53:24Z.
- **[MEASURED] Another supervisor is mid-fix on `#1443` and pushed 17 minutes before I started.**
  `git log pr1443 --not origin/main`: `d9c7e40c 09:43:52+10 PR Supervisor :: fix(scope): give SUB a
  label and a colour, and make the maps exhaustive` and `2aad4f6f 09:53:16+10 PR Supervisor ::
  test(scope): update the five API discipline canaries for SUB`. Everything older on the branch is a
  `GH-Mantova` merge-from-main. Corroborated by the sweep's `headless claude-code sessions: 2`
  (one of which is this chat). **[INFERRED]** its last push landed at 09:53Z and the browser failure
  only printed at 10:06Z, so it has probably not seen this failure yet.
- **[MEASURED] `#1443`'s `do-not-merge` label was applied and then removed — the SIXTH occurrence,
  and the first one that happened AFTER the cause was documented.**
  `gh api repos/GH-Mantova/ProjectOperations/issues/1443/timeline`:
  `labeled do-not-merge 2026-08-31T08:22:23Z by GH-Mantova` /
  `unlabeled do-not-merge 2026-08-31T09:35:36Z by GH-Mantova`. Live labels: none.
  Control: the same query on `#1447` returns **no label events at all**, so the query is not
  manufacturing events.
- **[MEASURED] COLLECT: nothing new to disposition.** `node scripts/pipeline/check-breadcrumb.mjs
  --freshness` → **exit 0, CLEAN**. `structure: 2 checked, 0 malformed`. Freshness:
  `00 2.0h (cadence 2h) ok · 02 dispatch-only · 03 11.2h (24h) ok · 04 4.0h (4h) ok · 05 20.0h (24h) ok`
  — **no station SILENT**. The only two breadcrumbs in the queue root are 00's own 0809 and 04's 0610,
  and 04's five findings were all dispositioned by the 0809 run.
- **[MEASURED] The DEFERRED HOLD deletions are now SEVEN, not six, and the lane is idle.**
  `git status --short` in the dev tree lists seven ` D docs/pr-prompts/pr-*-HOLD.md`. Each is
  `tracked=True onDisk=False` against `origin/main` (`git cat-file -e` per path), and each maps to a
  PR the watcher already built: `arm-guard-hook`→#1445 · `arm-prompt-release-index`→#1442 ·
  `crm-s8-register-and-followups`→#1447 · `estpricing-s3-rate-table-step-lists`→#1440 ·
  `scopesub-s2-sub-discipline`→#1443 · `watcher-conflict-escalation`→#1446 ·
  `watcher-onmain-dispatch-gate`→#1438. Armed count is **1**, and it is `rev-1447-ready.md`, a
  review job excluded by DOCTRINE §9.5 — so **zero real prompts are armed** and the mid-lane
  condition the prior run deferred on is gone.
- **[MEASURED] `docs/pr-reviews/pr-1442-review.md` (VERDICT: MERGE) exists on disk and is absent
  from `origin/main`** — `git cat-file -e origin/main:<path>` → `fatal: ... exists on disk, but not
  in 'origin/main'`. Another lost review verdict.
- **[INFERRED] `#1443` carries unintended ASCII-downgrade noise.** Its diff of
  `apps/api/src/modules/personas/definitions/disciplines.ts` replaces em dashes with `--` on eight
  comment lines that the SUB change did not need to touch. Same family as DOCTRINE §9.3 — a writer
  that cannot emit non-ASCII rewriting lines it only meant to read past. Not CI-breaking.

## WHAT CHANGED

One board PR, from a disposable worktree off `origin/main` (`C:\po-worktrees\sup-1009`, branch
`board/00-collect-1009`) — never the shared dev tree, never the watcher clone:

1. **Deleted the seven consumed `-HOLD.md` prompts** that were still tracked on `main` while absent
   from disk. This is the item the 0809 run DEFERRED; its stated unblock condition — "commit when
   the lane is idle" — is now measured true.
2. **Landed `docs/pr-reviews/pr-1442-review.md`.**
3. **Landed this breadcrumb.**

**ARMED NOTHING. MERGED NOTHING.** Neither is a silent omission; both are reasoned below.

## FINDINGS

### F1 — The label removal recurred on `#1443`, 73 minutes after the pipeline was proved to instruct it

The 0809 run measured the cause: `scripts/pr-watcher/index.mjs:1526` ships the sentence *"Remove the
label once you have reviewed it — that is what releases the merge"*, `merge-queue.mjs:138` echoes it,
the `rev-*` review jobs repeat it, and the clause after the dash is FALSE — the ruleset requires
exactly four checks and `PR gates — diff checks` is not one. `#1443` was unlabelled at **09:35:36Z**,
after that finding landed in `#1444` at 08:35Z. So the instruction is still shipping and still being
followed, and the count is now six: `#1325`, one on 08-27, `#1431`, `#1440`, `#1442` (merged carrying
`"marco":true`), `#1443`.

This is **new evidence for the existing A/B/C**, not a new question. It removes the argument that
(C) — fix the wording only — is a live option in isolation: the wording has now been publicly wrong
for two hours and produced another occurrence in that window.

**DISPOSITION: ESCALATED** — folded into the standing CP-26 / label-gate item, unchanged in shape.
(A) arm `pr-gates-approval-receipt-HOLD.md` (merged inert in `#1441`), land it, prove the new job
green on a control PR, **then Marco adds it to the required checks** — complete and additive, and
the ruleset half is his under DOCTRINE §5.3 and must come second. (B) ruleset-only fails the future
half. (C) wording-only fails the immediate half, as this occurrence demonstrates. **I did not arm it:
arming decides the question for him.**

### F2 — `#1443` is red on a real regression in exactly the area it changes, and it is not mine to touch

The failure is a click timeout on the delete affordance of a newly-created ASB card, in the spec that
exists to prove the discipline picker. The PR adds a fifth discipline (`SUB`) to
`IS_DISCIPLINE_CODES`, `SCOPE_CARD_DEFAULTS`, `DISCIPLINE_LABELS` and `DISCIPLINE_COLORS`. The delete
button's label is built at `ScopeCardTab.tsx:119` as `` `Delete card ${card.name}` ``, and `card.name`
for an ASB card is still `"Asbestos removal"` — so the label text is unchanged and the timeout is a
visibility/hit-testing failure, not a selector mismatch. **[INFERRED]**, and deliberately left as an
inference: I did not pull the Playwright `error-context.md` artifact, because I must not apply the fix.

**Why not mine:** a second supervisor pushed two fix commits to this branch at 09:43Z and 09:53Z and
is converging (1 failure left of 164). Two supervisors pushing to one branch is the LL-38 shape
precisely. The sweep's `SAFE TO ACT` speaks to the dev tree and the remote at large; it is not a
licence to enter a branch another actor is actively fixing.

**DISPOSITION: DEFERRED** — to the next 00 run, with a named trigger: **if `#1443` is still red at
the next cycle AND its newest commit is older than that run's start**, the other actor is gone and
the browser failure is the next 00's to fix, starting from `batch8-misc.spec.ts:161` and the
`error-context.md` artifact rather than from the diff.

### F3 — Seven consumed `-HOLD.md` prompts were tracked on `main` with no file on disk

The BOARD TRAP state: any `git checkout .` / `reset --hard` in the dev tree would have resurrected
all seven, and two of them (`crm-s8`, `scopesub-s2`) already have live PRs, so a resurrection would
have re-fired work that is currently open. The prior run correctly deferred because two were armed
and mid-lane; that is no longer true (real armed = 0, in-progress prompts = 0).

**DISPOSITION: ACTIONED** — deleted in this run's PR. Verified by `git diff --cached --name-status`
showing exactly seven `D` lines plus the review file, and nothing else.

### F4 — A fourth review verdict has gone missing from `main`

`docs/pr-reviews/pr-1442-review.md` reads `VERDICT: MERGE` with a full scope-compliance section, and
was never committed. This is the same funnel defect recorded in
`REVIEW-VERDICTS-AND-ESCALATIONS-ARE-BEING-LOST-2026-08-26.md`.

**DISPOSITION: ACTIONED** — landed in this run's PR. The underlying funnel is untouched and remains
the open item it already was.

### F5 — I armed nothing, and the reason is a concurrency judgement, not an omission

Real armed prompts: **0**. NEXT-ARM ORDER item 2 is `pr-lint-not-a-prompt-HOLD`, and RULE 4 would
permit one arm. I did not take it: arming is a mutation of the **shared dev-tree index**, and a
second supervisor was pushing 17 minutes before this run opened. The board is not starved — two PRs
are open, one is mid-fix — so the cost of waiting one cycle is a cycle, and the cost of colliding is
LL-38.

**DISPOSITION: DEFERRED** — arm item 2 next cycle if `git log` shows no `PR Supervisor` commit newer
than that run's start, after re-linting it against current `main`.

## WHAT I DID NOT DO

- **Did not merge `#1443` or `#1447`** — both watcher-routed to Marco, RULE 2, cleared only by Marco
  in chat for that batch.
- **Did not touch `#1443`'s branch** — another supervisor is mid-fix on it (F2).
- **Did not arm** — F5.
- **Did not remove or re-apply any `do-not-merge` label**, on `#1443` or anywhere.
- **Did not fast-forward the watcher clone** — barred to 00; it reads `dirty=0`, `branch=main` and is
  not blocking anything this run.
- **Did not land `docs/pr-prompts/superseded/pr-doctrine-s9-four-false-traps-LOOPING.md`** (untracked
  in the dev tree) or the dot-file ledgers `.arming-log.txt` / `.queue-sync-ledger.txt`. The first is
  superseded-folder housekeeping with no reader waiting on it; the ledgers are deliberately untracked
  and are the subject of an open escalation about what they can and cannot prove.
- **Did not touch `/sot/`, Azure, Entra or SharePoint.**
