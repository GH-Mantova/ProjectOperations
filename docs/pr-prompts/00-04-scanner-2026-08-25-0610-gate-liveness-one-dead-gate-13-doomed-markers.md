# Station 04 — Scanner | 2026-08-25T06:10:25Z–2026-08-25T06:20:00Z

## GROUND

```
UTC            2026-08-25T06:10:25Z
origin/main    16c1cb28              (fetched +refs/heads/main:refs/remotes/origin/main, then rev-parse)
dev tree       main @ 16c1cb28       C:\ProjectOperations2   (behind=0 ahead=0)
doc version    1                     (docs/pipeline/stations/04-scanner.md front matter)
bootstrap      1                     (scheduled-task SKILL.md) — MATCH, full authority this run
```

NOT BLIND. Desktop Commander reached the box on the first call (`start_process`, `powershell.exe`,
PID 36276). Every line below tagged `[MEASURED]` was obtained on the Windows host.

**Named sweep this run: `gate-liveness`** (rotation position 1 of 4; `next-sweep.mjs` chose it,
previous run: never). Advanced afterwards to `instrument-honesty` for the next run —
`docs/pipeline/sweep-rotation.json` now reads `last_index=0 last_run_utc=2026-08-25T06:10:25Z`
and is **uncommitted**; see WHAT I DID NOT DO.

## WHAT I MEASURED

**Instrument positive controls, run before any negative was believed.**

- `[MEASURED]` `gate-eval.selfTest` → `positive+negative controls both behaved` (exit 0 = PASS,
  exit 1 = FAIL). Every premise reading below came through that evaluator.
- `[MEASURED]` tracked-file probe at `origin/main`: 1 tracked-file set built once with
  `git ls-tree -r --name-only origin/main` (**`-r` present** — DOCTRINE §9.2); control
  `package.json` present = true.
- `[MEASURED]` orphan probe control: `.github/workflows/ci.yml` resolves on **44 of 44** origin
  branches; `.github/workflows/playwright-container-trial.yml` resolves on **0 of 44**. The query
  can produce a positive, so its zero is real.
- `[MEASURED]` `GATE-ALLOW` regex control: matches `GATE-ALLOW: migrations` (true), rejects
  `## GATE-ALLOW: migrations` (false).

**Board shape.**

- `[MEASURED]` depth-1 prompts: **56 `-HOLD.md`, 0 `-ready.md`**. All 56 have front matter and all
  56 have a `premise` — the old "HOLD files lack front matter" claim stays refuted.
- `[MEASURED]` tracked depth-1 `*-ready.md` on `origin/main`: **0** (board trap clear). Positive
  control on the same query: 63 tracked depth-1 `*-HOLD.md`.
- `[MEASURED]` gate evaluation of all 56 against `origin/main` 16c1cb28:
  `premiseAlive=55 · premiseDead=1 · premiseBroken=0 · noFrontMatter=0 · noPremise=0`.
  `gateOpen(or ungated)+alive=27 · gateStillShut=28 · dead=1`.
- `[MEASURED]` `status-sweep.ps1` @06:10:35Z: SAFE TO ACT · watcher node RUNNING pid 29024 ·
  wrapper alive · `index.lock` absent in both trees · in-progress prompts 0 · git processes 0.

**Two instrument corrections, so the next run does not repeat my mistakes.**

- `[MEASURED]` A `do NOT auto-merge` prose scan fires on **55 of 56** board prompts. It is
  boilerplate, **not** a gate. Only two prompts carry a real body-level arming block
  (`<!-- watcher: do-not-arm -->`): `pr-arm-lock-s1-serialize-arming-HOLD.md` and
  `pr-siteid-notnull-backfill-HOLD.md`.
- `[MEASURED]` My orphan-gate query flags the five `docs/approvals/<slug>-approved-by-marco.md`
  gates as "no producer on the board". That is **correct by design** — `docs/approvals/README.md`
  says so explicitly ("nothing in any chain creates it"). `docs/approvals/` on main contains
  **README.md only**. A future orphan sweep must exclude `docs/approvals/` or it will re-file this
  every four hours. I re-checked the README's own claim rather than trusting it: all five prompts
  do carry `escalates: true`, `gate_allow: migrations` and a `rollback_strategy` — control fires,
  a `false` is readable (`pr-watchdog-…` reads `escalates=false`).

**`[LIVE]` expiring while I watched it — worth recording as evidence, not as a finding.**

`[MEASURED]` `status-sweep.ps1` at 06:10:35Z reported **#1313 UNSTABLE, 10 pass / 1 fail**. At
06:18Z the same PR read `headRefOid dac7a914`, `updatedAt 2026-08-25T06:14:47Z`, and a check
rollup of **8 SUCCESS / 3 IN_PROGRESS / 0 failures** — a concurrent chat pushed to it four
minutes into my run. Nobody should carry "#1313 is red" out of this breadcrumb.

## WHAT CHANGED

One board write, inside Station 04's staging authority:

- **Created** `docs/pr-prompts/pr-e2e-container-s1-trial-workflow-HOLD.md` — a **byte-identical**
  copy of `docs/pr-prompts/no-pr-opened/pr-e2e-container-s1-trial-workflow-ready.md`
  (`src 8931 bytes == dst 8931 bytes`, `Buffer.equals` true, copied with node, not PowerShell).
  Read back: first line `---`. Lint: **ADMIT (size 1)**, with one WARN quoted in F2.
  It is a `-HOLD`, so it is inert: nothing arms, nothing runs.

Nothing else. No rename, no delete, no arm, no merge, no commit, no push.
`docs/pipeline/sweep-rotation.json` was advanced by its own script and left uncommitted.

## FINDINGS

### F1 — A genuinely dead gate: `pr-e2e-container-s2` can never open, and its predecessor's work was destroyed

`[MEASURED]` `pr-e2e-container-s2-swap-required-job-HOLD.md` gates on
`requires_on_main .github/workflows/playwright-container-trial.yml :: mcr.microsoft.com/playwright`.
That file is absent from `origin/main` (workflows on main are exactly `ci.yml`, `deploy.yml`,
`playwright.yml`), absent from **0 of 44** origin branches, and absent from the `.github/workflows`
directory of **both** the dev tree and the watcher clone.

`[MEASURED]` The producer, `pr-e2e-container-s1-trial-workflow-ready.md`, ran on
**2026-08-20T06:22:14Z**, exited **0 in 61 seconds**, and was filed to `no-pr-opened/`. Its log
ends:

> "The workflow file already exists at `.github/workflows/playwright-container-trial.yml`
> (untracked, 116 lines) and satisfies every `done_when` gate … **Want me to commit and push this
> as the slice-1 PR, or is more work needed first?**"

`[INFERRED]` The slice was *done* — 116 lines, every `done_when` satisfied — and then the agent
asked a question into a headless run (DOCTRINE §6, "10 runs died waiting for an answer nobody was
there to read"). The artifact was never committed and has since been cleaned away. The work is
gone, s1 was retired to a gitignored folder, and s2 has been parked behind an unreachable gate for
**five days**.

`[MEASURED]` s1's premise is alive again now that the file is destroyed
(`! grep -rq "mcr.microsoft.com/playwright" .github/workflows/` → PASS).

**ACTIONED** — re-staged s1 verbatim as `pr-e2e-container-s1-trial-workflow-HOLD.md`; byte-equality
and lint ADMIT both verified above. The gate is now reachable again. Arming is Station 00's, and
**must not happen before F2 is closed**.

### F2 — The linter predicted F1 in advance, and its warning does not block anything

`[MEASURED]` Linting the re-staged prompt prints, above the ADMIT:

```
WARN  pr-e2e-container-s1-trial-workflow-HOLD.md  MISSING_STANDING_AUTHORITY (no standing-authority
text) — body grants no authority to push; this run may exit 0 without opening a PR.
```

That is a verbatim description of what happened on 08-20. `lint-prompt.mjs:710` marks it
**WARN-ONLY, "does not affect exit code"**, so `ADMIT` is returned and nothing downstream stops.

`[MEASURED]` Blast radius on today's board: **56 of 57** depth-1 prompts carry the grant string
`STANDING AUTHORITY to finish the work, commit, push`; **0 imposters**. The single prompt without
it is the one I just re-staged — the same prompt that burned a run.
`[MEASURED]` In `no-pr-opened/`, 8 of the 10 prompt files lack the grant (5 none, 3 imposter).
`[INFERRED, NOT causal]` The last 200 `processed/-ready.md` carry the grant **0 of 200**, so the
grant is a recent convention and the no-pr-opened-vs-processed comparison is confounded by time.
I am not claiming the missing grant *causes* no-PR runs; I am reporting that the one board prompt
missing it is the one that failed that way, and the linter said so first.

**DISPATCHED — Station 00, then 06.** Two things, in this order:
1. Before arming s1, add the standing-authority grant to its body. I did not edit it: the
   ADVERSARIAL PROMPT CRITIQUE rule forbids Station 04 patching a prompt under critique.
2. RULE 1 on the permanent fix, complete-and-additive first:
   **(a) COMPLETE + ADDITIVE — promote `MISSING_STANDING_AUTHORITY` to a REJECT** (exit 1) and
   backfill the grant into any prompt that lacks it. Fixes it now and forever, adds text only,
   touches no repo data, and the board is already 56/57 compliant so the migration cost is one
   file. **(b)** Leave it a WARN and rely on the arming station reading stderr — fails the
   *future* half of RULE 1: the warning was printed on 08-20 and still lost a day of work.
   **(c)** Have the watcher refuse to file a zero-PR exit as complete — fails the *complete* half:
   it catches the symptom after a whole agent run is spent.

### F3 — One HOLD is finished work still sitting on the board

`[MEASURED]` `pr-watchdog-heartbeat-during-merge-wait-HOLD.md`, premise
`! grep -q "MERGE_WAIT_HEARTBEAT" scripts/pr-watcher/index.mjs` → **FAIL (exit 1)** at 16c1cb28,
i.e. the string is present: the work shipped in **#1304** (merged 2026-08-24 04:51Z). It declares
no dependency gate, so nothing is masking it — it is simply a dead prompt occupying the board, and
it is the **only** one of the 56 in that state.

**DISPATCHED — Station 00.** Bin it. Removing a prompt is a board mutation and is not Station 04's
to make. Do not re-arm it: it duplicates #1304.

### F4 — 13 of 15 migration prompts are born doomed, and 6 of them are promotable right now

`[MEASURED]` 15 depth-1 prompts declare `gate_allow != none`. Only **2** carry a bare column-0
`GATE-ALLOW:` line in their own body. The other **13** do not:

`pr-524-rates-b-slice2-canonical` · `pr-company-manage-s1-permission-and-grant` ·
`pr-fv2-formrule-contract` · `pr-fv2-maintenance-usage-intervals` · `pr-fv2-output-channels` ·
`pr-rates-s11c-drop-legacy-tables` · `pr-rates-value-column-units` ·
`pr-retire-tenderclientnote-s2` · `pr-siteid-notnull-backfill` · `pr-sor-s9a-register-api` ·
`pr-tenant-mt4-s2-ownership-migration` · `pr-transport-capacity-column-order` ·
`pr-vendor-invoice-ocr` (`env-vars`).

`[MEASURED]` Why that matters: `scripts/pr-gates/pr-gates.mjs:67` reads the marker out of the **PR
body** (`/^GATE-ALLOW: (migrations|env-vars|dependencies)\s*$/gm`). `gate_allow` front matter is
read by **`lint-prompt.mjs:823` only** — a coherence check — plus test fixtures. A `git grep
gate_allow origin/main -- scripts` returns nothing in `scripts/pr-watcher/**` except one test
fixture (control on the same query: `READY_PATTERN` returns 3 hits in `index.mjs`). **Nothing
bridges front matter to body.**

`[MEASURED]` Six of the 13 are in this run's "gate open / no gate + premise alive" set — armable
today: `pr-company-manage-s1-permission-and-grant`, `pr-fv2-formrule-contract`,
`pr-fv2-maintenance-usage-intervals`, `pr-rates-value-column-units`, `pr-sor-s9a-register-api`,
`pr-vendor-invoice-ocr`. Each will burn an agent run and then red-fail CP-11/CP-12.

**DISPATCHED — Station 06.** RULE 1, complete-and-additive first:
**(a) COMPLETE + ADDITIVE — have the watcher emit the bare marker into the PR body from
`gate_allow` at PR-open time.** One writer, every future prompt covered, no prompt bodies edited,
no existing data touched, and CP-11 keeps its authority because the marker is still a declaration
the prompt author made. **(b)** Backfill the 13 bodies by hand — additive, but fails the *future*
half: prompt #16 is born doomed the same way. **(c)** Make `lint-prompt.mjs` REJECT a
`gate_allow != none` prompt whose body lacks the marker — cheap and it does stop the waste, but it
fails the *complete* half: it converts a red CI run into a red lint and still leaves 13 prompts
needing a hand edit. (a) and (c) compose well; (b) alone does not.

### F5 — The shared dev-tree index is carrying another chat's staged rename

`[MEASURED]` `git diff --cached --name-status` in `C:\ProjectOperations2`:

```
R100  docs/pr-prompts/pr-apierr-s12-ci-gate-HOLD.md -> docs/pr-prompts/pr-apierr-s12-ci-gate-ready.md
```

`[MEASURED]` `git status --porcelain` shows that entry as **`RD`** — staged rename, **deleted in
the worktree**. The armed prompt was consumed (it opened **#1314**), so the `-ready.md` no longer
exists on disk, but the rename is still sitting in the index. `[INFERRED]` Any chat that commits
in the dev tree without a pathspec will ship an arming rename for a prompt that has already run —
exactly the collision DOCTRINE §9.2 records twice, both times caught by eye rather than by a guard.

**DISPATCHED — Station 00.** Drain the index (project memory records `git restore --staged` as the
safe drain; **never** `checkout .` / `reset --hard` / `stash pop` — the board trap). Station 04 is
read-only on the board and does not touch a shared index.

### F6 — Chain health, for Station 00's arming decision

`[MEASURED]` Not a defect — the gate-liveness reading 00 actually needs. Gates satisfied AND
premise alive, i.e. promotable today (00 decides, one at a time):

`pr-ew-s2a-capacity-service` (`schema.prisma :: model EstimatorCapacity` FOUND) ·
`pr-fv2-maintenance-usage-intervals` (`model AssetUsageReading` FOUND) ·
`pr-lessons-folder-s2-unfold-sot05` (`docs/lessons-learned/README.md` PRESENT since #1305) ·
`pr-rates-consumers-s3-persona-export` (`requires_merged #1257` MERGED) ·
`pr-unified-api-key-vault-slice4c-retire-old-screens` (`requires_merged #1111` MERGED) ·
plus 22 ungated prompts whose premises are alive, incl. the already-staged
`pr-hygiene-gitignore-no-pr-opened-HOLD.md`.

`[MEASURED]` 28 remain correctly gate-shut, every one of them behind an artifact a *live* board
prompt produces (21 such gates) or behind a Marco approval marker (5). No further orphans.

**DEFERRED** — nothing here is urgent; it becomes urgent the moment 00 arms, because six of the
promotable set are in F4's doomed list.

## WHAT I DID NOT DO

- **Did not commit anything.** `docs/pipeline/sweep-rotation.json` (advanced) and this breadcrumb
  are both **untracked/uncommitted** in the dev tree. The station contract says the breadcrumb is
  untracked until the next board PR picks it up — but this run had a second reason: the shared
  index is dirty with another chat's staged rename (F5), so any commit of mine would have needed a
  pathspec and would still have raced a live chat. **Station 00: sweep both files up.**
- **Did not arm anything**, did not rename, move or delete any existing prompt — including the dead
  `pr-watchdog-…-HOLD.md` (F3) and the 13 doomed prompts (F4). Read-only on the board.
- **Did not edit** `pr-e2e-container-s1-trial-workflow-HOLD.md` to add the standing-authority grant,
  though I know that is what it needs. Report-not-run: Station 04 never patches a prompt it is
  critiquing.
- **Did not touch** `/sot/` (Station 05's), the watcher clone's git, or any mutating STATION 00
  script. Did not mint a throwaway worktree — `origin/main` was read with `git show` / `ls-tree -r`
  at a named SHA, per the 2026-08-24 supersession.
- **Did not run Part 1 (GitHub reconciliation) or Part 2 (live-site visual patrol).** One named
  sweep per run, covered completely, is the contract; a shallow pass over everything is why
  findings rot.
- **Did not re-diagnose #1313.** It was mid-push and mid-CI throughout this run and belongs to
  whoever is driving it.
- Azure / Entra / SharePoint: not touched, not read-modify-write, not once.
