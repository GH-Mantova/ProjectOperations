# Station 00 — Supervisor | 2026-09-14T12:09Z–2026-09-14T12:35Z

## GROUND

```
UTC            2026-09-14T12:09:15Z
origin/main    345c5708            (fetched, then rev-parse)
dev tree       main @ 5066f4ec -> fast-forwarded to 345c5708   C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only. SIGHTED: Desktop Commander loaded
by keyword search, `start_process` shell `powershell.exe` returned a live prompt on the first call.

## WHAT I MEASURED

- [MEASURED] **The device-bridge git guard could NOT be installed, and this is a FINDING, not a
  stop.** `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` never reached the
  script: the workspace failed to mount, verbatim —
  `source path ... is under Plan9 share "c" which is not mounted`, plus the host's own note that
  *"A Windows update released September 8 prevents Claude's workspace from reaching your files."*
  So there is no VM transport this run at all, and therefore no VM-side `git` call that could leave
  a 0-byte `index.lock` (DOCTRINE 9.2). Sixth consecutive run with this transport down.
- [MEASURED] Sweep: `status-sweep.ps1` captured to a file and decoded `utf16le` (DOCTRINE 9.3).
  Section 7 verdict verbatim: `SAFE TO ACT: no board mutation in progress, no recent remote
  activity, no live station worktrees.` Section 3: `index.lock interactive/clone: False / False`,
  `git processes touching our trees (scoped): 0`, `no PR touched on GitHub in the last 2 min`.
  Section 5 printed **no `[STALE]` rows** — the eleven that stood on 09-10 stay discharged.
- [MEASURED] Board: **2 open PRs.** `#1923` CLEAN, `15 pass / 0 fail`, no labels, created
  `2026-09-14T08:28:53Z`. `#1920` BLOCKED, `13 pass / 2 fail`, carries `do-not-merge`, created
  `2026-09-14T06:24:12Z`. `main` CI on `345c5708`: `4 success / 0 failed` (trunk green).
- [MEASURED] `#1920`'s two reds are the CP-26 pair and nothing else: `gh pr checks 1920` names
  exactly `Approval receipt (CP-26)` and `PR gates — diff checks`, both from run `34838121614`,
  both 8s. That is DOCTRINE 9.4's one-cause-two-reds shape with the label present — parked by
  design, not work.
- [MEASURED] **RULE 2, re-taken this run** (a lane verdict is non-monotonic — DOCTRINE 10.1 — so it
  is never carried forward from a breadcrumb). Probe: the PROMPT logs alone,
  `docs\pr-prompts\processed\pr-*.log`, 907 files, newest
  `pr-ratescol-s0-column-api-hygiene-ready.md.log @ 2026-09-14T08:29:16Z` — younger than both open
  PRs, so the freshness precondition holds.

  | PR | files | verdict line |
  |---|---|---|
  | `#1923` | 1 | `merge result for PR #1923: {"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` |
  | `#1920` | 1 | `merge result for PR #1920: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true — held for Marco, labelled do-not-merge"}` |
  | `#1850` POSITIVE control | 1 | a real `marco:true` verdict |
  | `#999997` NEGATIVE control | 0 | — |
  | freshly minted needle, NEGATIVE control | 0 | — |

  Each verdict sits in **its own prompt's** log — `pr-ratescol-s0-column-api-hygiene` (armed
  `08:24:38Z`) and `pr-ea-s2a-dashboard-preset-seed` (armed `06:03:57Z`, `escalates=true`) — so
  neither is a prose scrape (DOCTRINE 10.1, `PRNUMBER_SCRAPED_FROM_PROSE_V1`).
- [MEASURED] Queue: `armed = 0`. `triage-holds.ps1` over 36 depth-1 prompts (HOLD=36, ready=0,
  LOOPING=0): `spent=0  gates-satisfied=3  still-gated=33  unreadable=0`. Both instrument controls
  PASSED (`GIT control: PASS`, `SPENT control: PASS`).
- [MEASURED] **0 of the 3 gate-satisfied HOLDs is `tests-docs` eligible**, read from each prompt's
  own `scope:` with the CRLF-safe parser (DOCTRINE 9.3):
  `pr-crmvis-s0-visual-parity-tooling` → `scripts/pipeline/**` (outside `tests|docs`);
  `pr-fv2-import-s2-review-route` → `apps/api/**` + `apps/web/**`;
  `pr-ea-s2a-dashboard-preset-seed` → `apps/api/prisma/seed.ts`.
- [MEASURED] `pr-ea-s2a-dashboard-preset-seed-HOLD.md` is still tracked, still lints ADMIT, and
  `triage-holds.ps1` flags it `POSSIBLE DUPLICATE of open PR #1920 (2 of 2)`. `.arming-log.txt`
  settles it without needing the marker test: `2026-09-14T06:03:57Z ARMED
  pr-ea-s2a-dashboard-preset-seed escalates=true`. `#1920` **is** that build.
- [MEASURED] Freshness: `check-breadcrumb.mjs --freshness` → `structure: 17 checked, 0 malformed`;
  `00` 1.1h ok, `04` 2.1h ok, `03` **85.1h SILENT**, `05` **94.1h SILENT**, exit 2. Crossed against
  `list_scheduled_tasks`: `03` `lastRunAt 2026-09-10T23:01:10Z`, `nextRunAt 2026-09-14T23:00:45Z`;
  `05` `lastRunAt 2026-09-10T14:10:55Z`, `nextRunAt 2026-09-14T14:10:37Z`. Both `enabled: true`.
- [MEASURED] Worktrees, from the sweep: `C:/po-fix1891` (656 min, dirty=0), `C:/PR-Master/worktrees/po-vg`
  (**14658 min**, dirty=1 — holds uncommitted work), `C:/PR-Master/worktrees/pr1823` (6600 min, dirty=0).
- [CANNOT MEASURE] The trigger of the false-termination message in F1 below, after two honest
  reproduction attempts.

## WHAT CHANGED

- The dev tree was **1 behind** `origin/main` and dirty in the way the post-merge fast-forward note
  in `00-supervisor.md` describes. The documented two-step cure worked exactly as written, first
  time: `git show HEAD:<path>` piped to a node write (never `git checkout -- <path>`), then
  `git add --renormalize`, which staged **nothing** — so no `git restore --staged` was needed —
  then `git merge --ff-only origin/main`. Read back all three: `git rev-list --left-right --count
  HEAD...origin/main` → `0 0`; `git diff --cached --name-status` → EMPTY; `git diff --numstat` →
  the single `0 95 docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md`, which is the
  consumed prompt whose deletion is carried by open `#1923` and is not this tree's to land.
- `docs/pipeline/DOCTRINE.md` gains one bullet in section 9.1 recording F1, and
  `docs/pipeline/stations/_canonical-blocks.json` is re-recorded for it (`instruments v2` is
  DOCTRINE-only, so the edit cost `REJECT: 1 of 8` and one hash, not seven). Read back:
  `lint-station.mjs` → `ADMIT: all 8 docs clean`, exit 0.
- **Nothing on the board was mutated.** No merge, no arm, no label, no rename.

## FINDINGS

### F1 — NEW: the transport reported a live shell as finished, and three read-backs that never ran looked exactly like three read-backs that found nothing

`interact_with_process` against shell PID `31964` was given five statements: a node restore, a
fast-forward, and three read-backs. It returned the node line, the FIRST line of git's multi-line
refusal, and then `✅ Process 31964 has finished execution`. The three read-backs produced no
output. This run abandoned that shell and started a second one.

**The shell was alive.** Twenty minutes later the same PID answered `git rev-parse --short HEAD` →
`345c5708` on the first try, working directory intact. DOCTRINE 9.1 already records that streamed
output *"can return EARLY with output still pending"* and prescribes calling `read_process_output`
again — but it describes the symptom as a pause, and a reader told the process has **finished** has
no reason to call anything again. The cure is unreachable from the symptom as reported.

The cost is 9.6 with the emptiness manufactured by the instrument: `git diff --numstat` EMPTY and
`git diff --cached --name-status` EMPTY are the prescribed PASS readings of the fast-forward cure,
so UNRUN and CLEAN are the same bytes. Two honest attempts to reproduce the trigger — a `git`
command writing a multi-line `NativeCommandError` through `2>&1 | Select-Object -Last N`, with and
without a preceding `node -e` — both ran every following statement and printed both markers;
`$ErrorActionPreference` was `Continue` in every shell measured, so guard 7 is not the mechanism.

**DISPOSITION: ACTIONED** — landed as a section 9.1 bullet in this run's own PR, carrying both
guards (echo a marker after every statement and assert it; treat `finished execution` as a claim to
falsify with one command to the same PID) and its falsifying probe. The guards do not depend on the
unmeasured trigger.

### F2 — Both open PRs are Marco's, re-measured rather than inherited, so this board has no work for me to merge

`#1923` is fully green and unlabelled and I still may not touch it: the watcher routed it
`marco:true` for `apps/api/src/modules/rates/rate-tables.service.ts`, and a `marco:true` verdict is
not cleared by green, by CLEAN, by the absence of a label, or by a diff check. `#1920` is
`do-not-merge` and only Marco removes that. This is the third consecutive run with the same shape,
and it is re-derived from the probe each time because DOCTRINE 10.1 makes a lane verdict
non-monotonic.

**DISPOSITION: ACTIONED** — verified by probe with positive and negative controls, and acted on by
standing off.

### F3 — `pr-ea-s2a-dashboard-preset-seed-HOLD.md` is a live instance of the stays-armable-forever defect, and the arming log settles it where the marker test cannot

The prompt was armed at `06:03:57Z`, the watcher built it into `#1920`, and that PR does not delete
the prompt — so the HOLD is still tracked, still lints ADMIT, and sits in the GATES SATISFIED
bucket where an arming decision goes looking. `triage-holds.ps1` flagged it as a possible duplicate
and told me to confirm on the marker string; DOCTRINE 10.6's own correction records that only a
handful of prompts carry a marker at all. `.arming-log.txt` answers it outright and for every
prompt, because an arm cannot happen without writing a row there.

`#1924` landed the schema cure for the general defect (a prompt's `scope:` must name its own
`-HOLD.md` so its PR retires it). This instance predates it and is not retired by it.

**DISPOSITION: DEFERRED** — the prompt cannot be retired while `#1920` is open (retiring it would
delete the description of work still waiting on Marco), and it cannot be armed. What makes it
urgent: `#1920` merging without deleting the HOLD, at which point the prompt becomes SPENT and
belongs in `superseded/` in the next board PR. ⚠️ **Do not arm it in the meantime** — the sweep will
keep offering it.

### F4 — 03 and 05 are still SILENT and this run crosses neither boundary, exactly as the 11:08Z run predicted

`03` 85.1h, `05` 94.1h, both `enabled`, both with a `nextRunAt` still in the future at the moment of
measurement (`05` at `14:10:37Z`, `03` at `23:00:45Z`). Their missed occurrences fall inside the
69-hour scheduler hole the 10:08Z run measured; `04` has self-recovered through the same hole, which
is the positive control for "they come back on their own".

🔴 **Do not report 03 or 05 as stopped stations, and do not restart or re-arm anything for them.**

One consequence worth stating rather than re-discovering: 03 is the only station that may fast-forward
the watcher clone or prune a worktree, and `C:/PR-Master/worktrees/po-vg` has now been orphaned
**14658 minutes** holding one uncommitted file. Four days of 03's dispatches have had no consumer.
That is a cost of the silence, not a second defect.

**DISPOSITION: DEFERRED** — self-clearing at the next occurrence. It becomes real, and the next run's
to file, if `05` still shows `lastRunAt 2026-09-10` after `2026-09-14T14:11Z`, or `03` after
`2026-09-14T23:01Z`. **The 13:0xZ run crosses neither; the 15:0xZ run crosses 05's.**

### F5 — I deliberately armed nothing, for the fifth consecutive run, and the reason is measured rather than cautious

`gates-satisfied = 3`, and all three land outside `tests/` and `docs/`: `scripts/pipeline/**`,
`apps/api` + `apps/web`, and `apps/api/prisma/seed.ts`. So every arm available today becomes a PR
only Marco can merge, on a board that already holds two of those — one of them green and waiting
since `08:28Z`. Arming here lengthens the queue without shortening it.

**DISPOSITION: DEFERRED** — arming resumes when the `tests-docs` lane has an eligible prompt, or
when Marco clears the two PRs in front. What would make it urgent: a gate-satisfied HOLD whose
`scope:` is confined to `tests/` or `docs/`, which the next run's `triage-holds.ps1` will surface.

### F6 — The workspace transport is down for the sixth consecutive run, so the git guard could not be installed

Named here so the failure is visible in the report rather than inferred from its absence. It cost
this run nothing: with no VM transport there is no VM-side `git` call to guard against, and every
probe in this report ran through Desktop Commander on the host.

**DISPOSITION: DEFERRED** — known, already escalated, and outside this station's reach to fix.

## WHAT I DID NOT DO

- **Did not merge, label, rebase or touch either open PR.** Both carry live `marco:true` verdicts;
  `#1920` additionally carries `do-not-merge`, which only Marco removes.
- **Did not re-run `#1920`'s two reds.** They are the CP-26 `[LABEL_PRESENT]` pair — one cause, two
  reds — and a re-run cannot change a label.
- **Did not arm anything**, per F5, and specifically did not arm the ADMIT prompt the sweep flags as
  a duplicate of `#1920`.
- **Did not restart, re-arm or escalate on behalf of 03 or 05**, per F4.
- **Did not prune `C:/PR-Master/worktrees/po-vg`** — it holds one uncommitted file, and worktrees are
  03's, report-only for me.
- **Did not clear anything from `needs-marco/`** — section 5 of the sweep printed no `[STALE]` rows.
- Left alone: `/sot/`, Azure/Entra/SharePoint, production data, the watcher clone's two untracked
  review verdicts (written there by design), and the `no-pr-opened/` and `failed/` backlogs, whose
  newest entries are unchanged since 09-14 08:32Z and 09-02 03:47Z respectively.
