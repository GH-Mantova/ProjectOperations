# Station 00 — Supervisor | 2026-09-14T14:08Z–2026-09-14T14:30Z

## GROUND

```
UTC            2026-09-14T14:09:08Z
origin/main    ed3e5e42            (fetched, then rev-parse)
dev tree       main @ ed3e5e42     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE, so this run was not read-only. SIGHTED: Desktop Commander loaded
by keyword `ToolSearch`, `start_process` shell `powershell.exe` answered on the first call
(`LIVE 2026-09-15T00:08:38+10:00`).

PREFLIGHT step 2 was satisfied against the working copy rather than `git show origin/main:<path>`,
and that is sound this run because it was proved rather than assumed:
`git diff --numstat origin/main --` over all three binding documents returned EMPTY, with
`HEAD == origin/main == ed3e5e42` and `git rev-list --left-right --count HEAD...origin/main` = `0 0`.

## WHAT I MEASURED

- [MEASURED] **The device-bridge git guard could not be installed — eighth consecutive run.**
  `bash /sessions/<id>/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh` never reached the
  script. Verbatim last line: `source path ... is under Plan9 share "c" which is not mounted`,
  with the host's own note that *"A Windows update released September 8 prevents Claude's workspace
  from reaching your files."* There is therefore no VM transport at all this run, and so no VM-side
  `git` call that could leave a 0-byte `index.lock` (DOCTRINE 9.2). A failed install is a FINDING,
  not a stop.
- [MEASURED] Sweep: `status-sweep.ps1` run to completion, exit 0, runtime 174.9 s, 414 lines.
  Section 0 both instrument controls `[LIVE]` PASS. Section 7 verbatim: `SAFE TO ACT: no board
  mutation in progress, no recent remote activity, no live station worktrees.` Section 3:
  `index.lock interactive/clone: False / False`, `git processes touching our trees (scoped): 0`,
  `no PR touched on GitHub in the last 2 min`.
- [MEASURED] **Section 5 printed no `[STALE]` escalation rows.** Every one of its 53
  `needs-marco/` lines reads either *"cites #N (MERGED) as evidence — not its premise; does not
  clear the escalation"* or *"no PR ref … read it as a SNAPSHOT"*. Nothing needed discharging.
- [MEASURED] Board, re-read live at `14:2xZ` after the sweep: **2 open PRs, unchanged.** `#1923`
  CLEAN, `labels: []`, created `2026-09-14T08:28:53Z`, head `fix/ratescol-s0-column-server-messages`.
  `#1920` BLOCKED, carries `do-not-merge` (*"escalates:true - Marco merges this, not automation"*),
  created `2026-09-14T06:24:12Z`. `main` CI on `ed3e5e42`: `4 success / 0 failed` — trunk green.
- [MEASURED] **RULE 2, re-taken this run** — a lane verdict is non-monotonic (DOCTRINE 10.1) and is
  never carried forward from a breadcrumb. Probe: the PROMPT logs alone, excluding `rev-*`, pinned
  to the live tree `C:\ProjectOperations2\docs\pr-prompts\processed`.

  | probe | result |
  |---|---|
  | log count in the live tree | **2217** |
  | newest log | `rev-1930-ready.md.log @ 2026-09-14T13:23:17Z` — younger than both PRs |
  | POSITIVE control `marco.:true` (regex, no quote character) | **666** |
  | NEGATIVE control, a needle minted this run | **0** |
  | `PR #1923` over `processed\pr-*.log` | **2** |
  | `PR #1920` over the same | **2** |

  Verdict lines, verbatim: `merge result for PR #1923: {"ok":false,"marco":true,"reason":"outside
  tests/ or docs/: apps/api/src/modules/rates/rate-tables.service.ts"}` and `merge result for PR
  #1920: {"ok":false,"marco":true,"fixLane":false,"reason":"escalates:true - held for Marco,
  labelled do-not-merge"}`. Each sits in its own prompt's log
  (`pr-ratescol-s0-column-api-hygiene-ready.md.log`, `pr-ea-s2a-dashboard-preset-seed-ready.md.log`),
  alongside that prompt's own `PR #N opened` line, so neither is a prose scrape
  (`PRNUMBER_SCRAPED_FROM_PROSE_V1`).
- [MEASURED] Watcher, by the sanctioned probe only: `restart-watcher-if-wedged.ps1` →
  `armed prompts waiting: 0`, `watcher process: ALIVE (pid 30976)`, `restart churn: 0 cycle(s) in
  20 min`, `VERDICT: OK - nothing armed and the watcher is alive. An idle watcher is correct, not
  wedged.` The sweep's 47-minute heartbeat age is the documented idle reading, not a hang.
- [MEASURED] Queue: self-counted `READY=0  HOLD=36  LOOPING=0`. `triage-holds.ps1` (exit 0, both
  instrument controls PASS): `spent=0  gates-satisfied=3  still-gated=33  unreadable=0`, and
  `0 spent behind a REJECT` across all 33. The three gate-satisfied names are unchanged for the
  third consecutive run: `pr-crmvis-s0-visual-parity-tooling`, `pr-ea-s2a-dashboard-preset-seed`
  (annotated `POSSIBLE DUPLICATE of open PR #1920`, 2 of 2 scope entries), `pr-fv2-import-s2-review-route`.
- [MEASURED] Freshness at `14:12Z`: `check-breadcrumb.mjs --freshness` → `structure: 3 checked,
  0 malformed, 0 skipped`, exit 2; `00` 1.0h ok, `04` 4.0h ok, `03` **87.0h SILENT**,
  `05` **96.0h SILENT**.
- [MEASURED] **Crossed against `list_scheduled_tasks`, read TWICE, and the second read is the
  finding.** First read: `05` `lastRunAt 2026-09-10T14:10:55Z`, `nextRunAt 2026-09-15T14:10:37Z` —
  the next-run field had already advanced a whole day while the last-run field had not moved.
  Second read, minutes later: `05` `lastRunAt 2026-09-14T14:11:11.338Z`. `03` unchanged in both:
  `lastRunAt 2026-09-10T23:01:10Z`, `nextRunAt 2026-09-14T23:00:45Z`, `enabled: true`.
- [MEASURED] **The session-directory instrument confirms it independently.** Every scheduled run
  creates `…\local-agent-mode-sessions\<a>\<b>\local_<uuid>\` whose `CreationTimeUtc` is the fire
  time to the second. A directory exists at **`2026-09-14T14:11:11.342Z`** — the same second as
  `05`'s new `lastRunAt`. POSITIVE control: `04`'s `lastRunAt 14:10:05.319Z` matches a directory at
  `14:10:05.324Z`, and this run's own `00` `lastRunAt 14:08:26.281Z` matches one at `14:08:26.290Z`.
  NEGATIVE control, a needle minted this run: **0** directories. Retention is not a confounder:
  **1511** `local_*` directories survive, oldest `2026-04-27T02:30:15Z`.
- [MEASURED] **The 69-hour hole, measured end to end rather than inherited.** Grouping the session
  directories by `CreationTimeUtc` over `2026-09-10T20:00Z .. 2026-09-14T04:00Z` returns **15**
  directories, and they stop dead: the last before the hole is `2026-09-11T06:06:58Z`, the first
  after it is `2026-09-14T03:08:21Z`. **69.0 hours with no session of any station.** `03`'s own
  `2026-09-10T23:01:10Z` directory is inside that window and matches its `lastRunAt` exactly, which
  is the positive control that a directory *is* a fire.

## WHAT CHANGED

- **Two dispositioned breadcrumbs were `git mv`-ed into `docs/pr-prompts/archive/`** in this run's
  own PR worktree (`C:\po-wt\col1410`, branch `docs/board-collect-2026-09-14-1410`, off
  `origin/main` at `ed3e5e42`): 00's `1215` and 00's `1310`. 04's `1010` stays at the root as that
  station's newest.
- This breadcrumb was written **inside the PR worktree** (cure 1 of the delete-the-disk-copy rule),
  so no loose untracked copy is left in the dev tree to block the next fast-forward.
- **Nothing on the board was mutated.** No merge, no arm, no label, no rename, no restart.

## FINDINGS

### F1 — 05 is not a stopped station: it fired at its first slot after the hole, and the prediction the 13:10Z run wrote down is what caught it

The 13:10Z run filed its silent-stations finding as DEFERRED with an explicit falsifying condition:
*"It becomes real … if `05` still shows `lastRunAt 2026-09-10` after `2026-09-14T14:11Z`."* This run
is the first that crosses that boundary, and the condition is **REFUTED**: `05` fired at
`14:11:11Z`, confirmed by two independent instruments — the task store's `lastRunAt` and a session
directory created in the same second, each with its own positive control.

The whole of `05`'s and `03`'s silence is accounted for by one cause that belongs to neither of
them: **no scheduled task of any kind fired between `2026-09-11T06:06:58Z` and
`2026-09-14T03:08:21Z`.** `03`'s three missed occurrences (`09-11`, `09-12`, `09-13`, each at
`23:00Z`) and `05`'s three (`14:1xZ`) all fall inside it. `00` recovered at `03:08Z`, `04` at
`06:10Z`, and `05` now.

🔴 **Do not report 03 or 05 as stopped stations, and do not restart or re-arm anything for either.**

**DISPOSITION: ACTIONED** — the 13:10Z run's F3 is discharged for `05` by measurement. It survives
for `03` only, with a date: `03`'s first post-hole occurrence is `2026-09-14T23:00:45Z`. If
`lastRunAt` still reads `2026-09-10T23:01:10Z` after `2026-09-14T23:01Z`, that is a station-level
defect and the run that crosses it owns filing it. Until then it is the hole, not the station.

### F2 — `nextRunAt` advances at fire and `lastRunAt` is written later, so there is a window in which the task store reads as a missed run

Read twice, minutes apart, over one occurrence: `05` presented `nextRunAt` already rolled forward a
full day while `lastRunAt` still held a four-day-old value. Both fields came from the same call, and
either one alone is a coherent story — *"the occurrence was skipped and the scheduler moved on"* is
exactly what the first read says, and it is wrong.

This matters because the COLLECT step is told to cross `--freshness` against `lastRunAt`, and that
table's first row — *"`lastRunAt` older than one cadence ⇒ the occurrence never fired"* — is the
reading this window manufactures. A run sampling inside it files a station as dead at the very
moment that station is starting.

🔧 **The discriminator is the session directory, and it costs one probe.** It is written at fire
time, it carries no second field to disagree with, and it is already the instrument
`00-supervisor.md` names for *"did an EARLIER occurrence fire?"*. **Re-read the task store before
concluding a station missed a slot that falls inside your own run's window** — this run's two reads
disagreed about `05` and the second one was right. ⚠️ The width of the window is
**[CANNOT MEASURE]** from two samples; what is measured is that it is non-zero and that it spans a
station's own start.

**DISPOSITION: DEFERRED** — the cure is a reading discipline that costs nothing and is recorded
here; changing the task store is the scheduled-tasks layer, which is Marco's. What would make it
urgent: a run acting destructively on a station it read as missed — restarting, re-arming, or
escalating — rather than merely reporting it.

### F3 — Both open PRs are Marco's, re-measured rather than inherited, so there was nothing on this board for me to merge

`#1923` is fully green (`CLEAN`, `labels: []`) and I still may not touch it: the watcher routed it
`marco:true` for `apps/api/src/modules/rates/rate-tables.service.ts`. A `marco:true` verdict is not
cleared by green, by CLEAN, by the absence of a label, or by a diff check. `#1920` is
`do-not-merge`, which only Marco removes. Fifth consecutive run with this shape, and it is
re-derived from the probe every time because DOCTRINE 10.1 makes a lane verdict non-monotonic.

**DISPOSITION: ACTIONED** — measured with positive and negative controls, and acted on by standing
off both PRs.

### F4 — I armed nothing, for the seventh consecutive run, and the reason is measured rather than cautious

`gates-satisfied = 3`, and none of the three is `tests-docs` eligible: their scopes are
`scripts/pipeline/**`, `apps/api/prisma/seed.ts`, and `apps/api/**` + `apps/web/**`. So every arm
available today becomes a PR only Marco can merge, on a board that already holds two of those — one
green and waiting since `08:28Z`. Arming here lengthens the queue without shortening it.
Specifically I did **not** arm `pr-ea-s2a-dashboard-preset-seed-HOLD.md`: `triage-holds.ps1` flags
it `POSSIBLE DUPLICATE of open PR #1920` at 2 of 2 scope entries, and `#1920` is that prompt's own
build — the stays-armable-forever defect, not fresh work.

**DISPOSITION: DEFERRED** — arming resumes when the `tests-docs` lane has an eligible prompt, or
when Marco clears the two PRs in front. What would make it urgent: a gate-satisfied HOLD whose
`scope:` is confined to `tests/` or `docs/`, which the next run's `triage-holds.ps1` will surface.

### F5 — `weekly-security-audit` is still `enabled: false`, nine days after its last run

Read live from the scheduled-tasks MCP this run: `enabled: false`, no `nextRunAt`,
`lastRunAt 2026-09-06T21:32:44Z`. It is not a station and has no lane on the board, so this costs
the pipeline no coverage, but the weekly GitHub security baseline has now not run for nine days and
the re-enable applied on 09-14 has still not stuck.

**DISPOSITION: DEFERRED** — already escalated as a scheduled-task-layer change, which is Marco's
alone. Recorded so the gap stays visible in the current cycle rather than only in an archived
breadcrumb.

### F6 — The workspace transport is down for the eighth consecutive run

Named so the failure is visible in the report rather than inferred from its absence. It cost this
run nothing: with no VM transport there is no VM-side `git` call to guard against, and every probe
in this report ran through Desktop Commander on the host.

**DISPOSITION: DEFERRED** — known, already escalated, and outside this station's reach to fix.

## WHAT I DID NOT DO

- **Did not merge, label, rebase or touch either open PR.** Both carry live `marco:true` verdicts;
  `#1920` additionally carries `do-not-merge`, which only Marco removes.
- **Did not re-run `#1920`'s reds** — the CP-26 pair reads `[LABEL_PRESENT]`, one cause, two reds,
  and no re-run changes a label.
- **Did not arm anything**, per F4, and specifically not the prompt flagged as a duplicate of `#1920`.
- **Did not restart, re-arm or escalate on behalf of 03 or 05**, per F1, and did not touch the
  watcher: the sanctioned probe returned `OK`.
- **Did not clear anything from `needs-marco/`** — section 5 of the sweep printed no `[STALE]` rows.
- **Did not archive 04's `1010` breadcrumb** — it is that station's newest and belongs to the
  current cycle.
- **Did not prune any worktree** — `C:/po-fix1891` (dirty=0), `C:/PR-Master/worktrees/po-vg`
  (dirty=1, holds one uncommitted file) and `C:/PR-Master/worktrees/pr1823` (dirty=0) are 03's,
  report-only for me, and `po-vg` would lose work.
- Left alone: `/sot/`, Azure/Entra/SharePoint, production data, the watcher clone's untracked review
  verdicts (written there by design), the dev tree's single ` D` on
  `docs/pr-prompts/pr-ratescol-s0-column-api-hygiene-HOLD.md` — the consumed prompt whose deletion
  open `#1923` carries, not this tree's to land — and the `no-pr-opened/` and `failed/` backlogs,
  whose newest entries are unchanged at `2026-09-02 03:47Z` and `2026-09-14 08:32Z`.
