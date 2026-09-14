# Station 00 — Supervisor | 2026-09-11T04:08Z–2026-09-11T04:2xZ

## GROUND

```
UTC            2026-09-11T04:08:50Z  (scheduled-tasks lastRunAt for 00-supervisor; no shell clock)
origin/main    a3e5a1d2  (.git/refs/remotes/origin/main, AS LAST FETCHED — I cannot fetch)
dev tree       main @ a3e5a1d2       C:\ProjectOperations2  (.git/refs/heads/main)
doc version    1   (docs/pipeline/stations/00-supervisor.md, read from the WORKING COPY)
bootstrap      1   (scheduled-task SKILL.md)   MATCH
```

🔴 **BLIND RUN. Desktop Commander could not be reached, so no board mutation was attempted and none
was made.** Four `ToolSearch` loads were run first — a keyword search for `desktop-commander`, a
literal `select:` on three plausible ids, and two capability keyword searches (`start process
terminal command execute shell`, `desktop commander read file write file list processes`). None
returned a Desktop Commander tool, and the harness then reported the server itself as
`plugin:desktop-commander:desktop-commander (CONNECT_TIMEOUT): "MCP server … connection timed out
after 30000ms"`. That is a failure of the server, not an unloaded schema, so PREFLIGHT step 1's
STOP binds: **no `start_process`, no PowerShell, no `gh`, no `git`, no `.ps1`, therefore no liveness
verdict, no smoke, no `SAFE TO ACT`, no merge, no arm.**

⚠️ **PREFLIGHT step 2's "read from `git show origin/main:<path>`, never the working copy" could not
be honoured on the surviving transport, and this run says so rather than implying otherwise.** Every
document below was read from the working copy in `C:\ProjectOperations2`. The two loose refs read
equal (`a3e5a1d2` both sides), so the tree is not behind `origin/main` *as last fetched* — but no
fetch ran this cycle, so `main` may have moved since and this run cannot see it.

## WHAT I MEASURED

**Transport census. Both transports `STATION-CAPABILITIES.md` §3 names were down at the same time,
on a blind run — the exact condition the 03:09Z run's F4 and Station 04's 02:11Z F4 both named as
the thing that would make the mount escalation urgent.**

| transport | result |
|---|---|
| Desktop Commander (the only one that can RUN anything) | `CONNECT_TIMEOUT` after 4 loads — **BLIND** |
| Cowork Linux workspace mount `/sessions/<id>/mnt/…` | **failed to start, twice** |
| Cowork native file tools (`Read`/`Glob`/`Grep`) | **WORKED — carried the whole of COLLECT** |

The workspace failure was reproduced on two separate calls naming two different mount paths
(`…/spaces/…/memory as .auto-memory` and `…/local_…/outputs as outputs`), with one identical cause
both times: `is under Plan9 share "c" which is not mounted`, plus the harness's own note *"A Windows
update released September 8 prevents Claude's workspace from reaching your files."* Attempt 2 of 5;
I stopped retrying on the identical second failure rather than burning the cycle on it.

🔴 **So `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`'s falsifying probe was run for real, from the run it
was written for, and it PASSED.** That paragraph says: *"from a run with neither Desktop Commander
nor a mount, `Read` any tracked file under `C:\ProjectOperations2`; if it fails, this paragraph is
wrong."* POSITIVE controls this run: `Read docs/pipeline/STATION-CAPABILITIES.md` returned content
at lines 155–266; `Grep 'No second transport'` over `docs/pipeline` → **1** hit at line 155;
`Grep 'NATIVE_FILE_TOOLS_READ_TRANSPORT_V1'` over `docs` → hits in
`STATION-CAPABILITIES.md` and three breadcrumbs. NEGATIVE control: `Glob '*-ready.md'` under
`docs/pr-prompts` → **0** files, against the positive control `Glob '*-HOLD.md'` → **39**, proving
the glob distinguishes present from absent rather than matching everything.

**Cross-check that the file tools read the WORKING TREE and not the index.** The two prompts the
03:09Z run recorded as consumed-but-still-tracked (F3) —
`pr-company-manage-s1-permission-and-grant-HOLD.md` and `pr-qpdf-1-estimate-preview-mark-HOLD.md` —
are **absent** from the 39-file glob, which is exactly what a ` D` (deleted in worktree, still in
the index) looks like from the filesystem side. F3's state is unchanged and its DEFERRED condition
has not been met from anything I can see.

**COLLECT window 03:45Z → 04:08Z: no new station breadcrumb.** `Glob docs/pr-prompts/00-*.md`
returns four, the newest being the 03:09Z Supervisor breadcrumb, whose findings are all
dispositioned by their author. Station 04 last ran 02:10Z, 03 at 2026-09-10T23:01Z, 05 at
2026-09-10T14:10Z (scheduled-tasks layer). **There was nothing to collect, and this run says that
rather than presenting silence as coverage.**

**Queue census (STATE — measured now, do not quote it later).** 39 `-HOLD.md` at depth 1;
**0** `-ready.md` on disk; `needs-marco/` holds **51** files (50 escalations plus
`pr-subbie-rate-cards-scope-pricing-HOLD.md`, which is a prompt, not an escalation).

**Arming log, the only instrument that sees a concurrent lane.** Tail since 2026-09-10:

```
2026-09-11T00:57:09Z  ARMED  pr-scopecards-s0-plan                     actor=station-00.cowork-0002
2026-09-11T01:25:22Z  ARMED  pr-scopecards-s0-plan                     actor=station-00.cowork-0002
2026-09-11T02:30:04Z  ARMED  pr-company-manage-s1-permission-and-grant  actor=station-00.cowork-0002
2026-09-11T03:02:53Z  ARMED  pr-qpdf-1-estimate-preview-mark            actor=station-00.cowork-0002
2026-09-11T03:30:22Z  ARMED  pr-rateparity-s1-harness                   actor=station-00.interactive-0002
```

The 03:30:22Z line is **new since the last breadcrumb was written** and by a *fourth* actor string.

## WHAT CHANGED

**Nothing on the board, and nothing in the repo but this file.** No PR merged, no prompt armed, no
label touched, no watcher restarted, no worktree pruned, no `/sot/` edit, no Azure / Entra /
SharePoint action, no production data written, no `git` run anywhere — on a blind run none of these
is reachable, and reaching for a substitute is the failure the contract names.

This breadcrumb was written to the tracked path with the `Write` tool, which
`STATION-CAPABILITIES.md` §3 records as how a blind run leaves a report at a tracked path even
though it cannot open the PR that tracks it.

## FINDINGS

### F1 — Both named transports were down at once on a blind run; the third one carried COLLECT, so the mount escalation does NOT become urgent

The 03:09Z run's F4 deferred the workspace-mount failure with an explicit trigger: *"It becomes
urgent if a blind run reports it could not COLLECT."* Station 04's 02:11Z F4 named the same trigger
in the same words. **This run is that run, and it could COLLECT.** Desktop Commander at
`CONNECT_TIMEOUT`, the Plan9 share unmounted, and the native file tools nonetheless returned the
station doc, `STATION-CAPABILITIES.md` §3, the breadcrumb corpus, the queue census, the
`needs-marco/` census, the arming log and both loose refs — with the positive and negative controls
quoted above.

**ACTIONED as a measurement; DEFERRED as an escalation.** The trigger condition occurred and the
predicted consequence did not follow, which is evidence *for* the existing filing rather than a
reason to raise a new one. Three files already carry this question
(`linux-sandbox-fails-to-start-four-consecutive-runs-2026-09-10.md`,
`cowork-vm-mount-unreachable-two-stations-2026-09-10.md`,
`station-00-blindness-desktop-commander-connect-timeout-2026-09-01.md`) and a fourth would split one
question across four homes. ⚠️ **What a sighted run should land, in one sentence added to §3:** the
mount escalation's urgency trigger is now *measured as satisfied and survived*, so the trigger
should be restated as **"a blind run that loses the native file tools as well"** — otherwise the
next blind run reads a trigger that has already fired and cannot tell whether it is in new territory.
🔧 **The consecutive-run count for both outages is STATE. Re-measure it; never quote a prior count.**

### F2 — A fourth concurrent arm landed at 03:30:22Z, and the breadcrumb that should have recorded it was already written

[MEASURED] `docs/pr-prompts/.arming-log.txt` line 81:
`2026-09-11T03:30:22Z  ARMED  pr-rateparity-s1-harness  escalates=true
actor=station-00.interactive-0002  by=Marco@LAPTOP-E6NHU4E4  pid=23380`. The 03:09Z run's F5
recorded concurrent arms for two consecutive hours and closed its window at 03:45Z; this arm falls
**inside** that window and appears in none of its tables, because the log line arrived after the
section that would have carried it. Four distinct actor strings are now in play in twenty-four hours
(`cloud-lane-1010`, `cowork-audit`, `cowork-0002`, `interactive-0002`).

⚠️ **What I can and cannot say.** The arm is coherent on its face: `pr-rateparity-s1-harness` is
plausibly the parity proof that the 03:09Z run named as the gate on `rates-11c-blocked-consumers`,
so this reads as intended work, not a stray. What is **[CANNOT MEASURE]** on a blind run is whether
`ARM ONE AT A TIME` held across it — the 03:02:53Z `pr-qpdf-1` build was in flight at 03:45Z and I
have no `status-sweep.ps1`, no `gh`, and no queue census of *armed* state to say whether it had
finished by 03:30:22Z. I will not infer it from the empty `-ready.md` glob, which is consistent with
both stories.

**DEFERRED — no new escalation.** Open escalation #23 (two Station 00s can drive one board with
nothing guarding it) names this exact failure and a second document fragments the record Marco has
to read. 🔧 **What this run adds as evidence, and it is a sharper claim than the last one's:** the
breadcrumb corpus **structurally under-reports arms**, because a breadcrumb is written at the end of
a cycle and an arm can land after it. The arming log is not merely *the only instrument that sees*
the collision — it is the only instrument that can see it *at all*, and any future count of
concurrent arms taken from breadcrumbs will be low.

### F3 — `origin/main` advanced between 03:45Z and this run with no Station 00 cycle in between, and a blind run cannot attribute it

[MEASURED] The 03:09Z run merged `#1873` and left `origin/main` at `5ce24471`. Both loose refs now
read **`a3e5a1d2`**. So at least one more commit reached `main`, and the dev tree was fast-forwarded
onto it, in the twenty-odd minutes between that run's close and this one's start — by an actor that
is not a scheduled Station 00 run.

**[CANNOT MEASURE] who, what, or how many.** `git log`, `git rev-list --count` and `gh pr list` all
require a shell. The candidates on file are Marco hand-driving the board (he has done so within the
hour before, per the 09-08 breadcrumb), the supervised cloud lane, and the `interactive-0002` actor
that armed at 03:30Z — and DOCTRINE §10.1 is explicit that a PR the watcher did not open carries no
RULE 2 verdict, which no reading available to me could supply.

**DEFERRED to the next sighted run, with the probe named so it costs a minute rather than a
re-derivation:** `git log --oneline 5ce24471..a3e5a1d2` in the dev tree, then for each merge commit
read the PR's **own commit list** for authorship — never `%an` on `main`, which answers `GH-Mantova`
for every receipt, and never the branch name. If any of them is a code merge that reached `main`
unlabelled, that is a second-lane merge and belongs in the existing second-lane record, not a new
one.

## WHAT I DID NOT DO

**I did not substitute GitHub-side reads for the board.** The GitHub MCP is connected this session
and `list_pull_requests` would have answered. I did not call it. `origin/main` is not the tree the
watcher globs, the bootstrap forbids presenting those reads as coverage, and a board table sourced
that way on a blind run is indistinguishable in a breadcrumb from one built on a real sweep. **There
is no board stanza in this report because this run had no way to earn one.**

**I did not merge, arm, label, dispatch a station, restart the watcher, prune a worktree, or edit
`/sot/`.** Every one of those needs a shell, and the two that do not (arming by hand, editing a
tracked doc) are forbidden to a run that cannot smoke, cannot read a RULE 2 verdict, and cannot
re-lint what it changed.

**I did not diagnose `#1874`'s `API — lint, test, compliance smoke` red**, which the 03:09Z run left
for its successor with the exact command. It needs `gh run view --log`. 🔧 **It carries forward
verbatim to the next sighted run:** `gh run view 34556873130 --job 103131327144 --log`, split on the
tab, read the LAST column — column 1 is the job name, so grepping the whole line matches every row.

**I did not retire the two consumed HOLDs** (the 03:09Z F3). Its condition is `#1874` MERGING, which
I cannot observe and must not cause.

**I did not open a PR for this breadcrumb,** because I cannot. ⚠️ **It is therefore an UNTRACKED
file in the dev tree, and an untracked file is one of the three documented blockers of the next
fast-forward.** The next sighted run should `git add` it into its board PR — or, if it has somehow
already reached `main`, compare `git rev-parse origin/main:<path>` against `git hash-object <path>`
and delete the local copy only on a byte-identical match, which is cure (a) the 03:09Z run used.

**I did not install `vm-git-guard.sh`** — the workspace it runs in could not start (the same
platform fault as F1). PREFLIGHT is explicit that this is a FINDING, not a stop. No VM-side `git`
was attempted, so the 0-byte `index.lock` hazard the guard exists to prevent could not arise this
run by construction.
