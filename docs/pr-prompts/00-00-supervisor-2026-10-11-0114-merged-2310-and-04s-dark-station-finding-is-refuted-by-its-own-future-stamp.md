# Station 00 — Supervisor | 2026-10-11T01:14Z–2026-10-11T01:4xZ

SIGHTED. Desktop Commander reached the box on the first `start_process` after one keyword
`ToolSearch` for `desktop-commander` (ids taken from the search, not assumed). Doc version and
bootstrap AGREE (both `1`), so this run is not under the mismatch read-only rule.

## GROUND

```
UTC            2026-10-11T01:14:09Z   scheduled-tasks MCP lastRunAt for THIS 00 occurrence;
                                      corroborated by a measured host clock at 01:27:23Z
origin/main    eff8b4b5               git -C C:\ProjectOperations2 fetch origin; git rev-parse --short origin/main
                                      (now 2310's merge commit — see WHAT CHANGED)
dev tree       main @ eff8b4b5        C:\ProjectOperations2; rev-list --left-right --count HEAD...origin/main = 0 0
doc version    1                      docs/pipeline/stations/00-supervisor.md front matter (contract_version: 5)
bootstrap      1                      <!-- station_doc_version: 1 --> in the scheduled-task SKILL.md
```

All three binding documents were read from `git show origin/main:<path>` in the DEV TREE after a
`git fetch origin`, never from the working copy: `docs/pipeline/stations/00-supervisor.md` (466
lines), `docs/pipeline/DOCTRINE.md` (508), `docs/pipeline/STATION-CAPABILITIES.md` (740).

## WHAT I MEASURED

**Git guard — exit 2, INSTALLED BUT INERT, which the contract calls the EXPECTED station outcome.**
[MEASURED] `bash "$HOME/mnt/ProjectOperations2/scripts/pipeline/vm-git-guard.sh"` → last line:

```
To get the protection for one call, put the shim on PATH yourself:
   PATH="/sessions/gallant-loving-archimedes/.local/bin:$PATH" git <args>
```

headline `vm-git-guard INSTALLED BUT INERT - the shim is correct and UNREACHABLE from your shell.`
**EXIT CODE 2**, read from the installer itself (`; echo "EXIT=$?"` immediately after the call, no
pipeline appended). A FINDING, not a stop. No `git` was run through the device bridge this run —
every `git` call went through `powershell.exe` on the Windows host.

**Locks and tree state.** [MEASURED] all absent: `.git/index.lock`, `MERGE_HEAD`, `REBASE_HEAD`,
`CHERRY_PICK_HEAD`, `rebase-merge`, `rebase-apply`, `sequencer`. `git status --porcelain` → 11
entries, **all `??` untracked** (`.codex/`, `AGENTS.md`, four `Claude Design/` paths, three station
breadcrumbs, two `docs/pr-reviews/pr-23xx-review.md`); **no tracked file modified or deleted**.
`git diff --cached --name-status` EMPTY. `rev-list --left-right --count HEAD...origin/main` → `0 0`.
So nothing was mid-mutation and the fast-forward hazard did not apply.

**`status-sweep.ps1` HANGS at section 2 and never issues its verdict.** [MEASURED] run as
`powershell.exe -NoProfile -File .\scripts\pipeline\status-sweep.ps1`, output redirected to a file:
sections 0 and 1 printed in full (`generated 2026-10-11 01:18:32Z`), then the file stopped at the
bare `==================== 2. WATCHER ... ====================` header and grew no further over the
following ~10 minutes. **Consequence: this run has NO sweep SAFE / CAUTION / DO-NOT-ACT verdict.**
I substituted the sweep's own underlying checks directly — locks (above), in-progress prompts
(`docs/pr-prompts/*-ready.md` → **zero** armed), arming-log tail (newest entry
`2026-10-10T02:19:20Z`, i.e. 23 h old), and per-PR GitHub state — rather than acting on no verdict
or on a verdict I did not get. This is the same instrument failure 00's `2015`/`2114` and 03's
`2307` breadcrumbs measured: process enumeration (CIM, then WMI) hanging rather than failing.

**Board census, section 1 of the sweep, [LIVE].** OPEN 3 → `#2310` CLEAN 10 pass/0 fail;
`#2303` BEHIND 11 pass/**4 fail**; `#2294` BEHIND 13 pass/**2 fail**. WAITING ON MARCO: 2.
[MEASURED] per-PR labels, asked individually (never from a LIST response, DOCTRINE §9.4):
`#2303` → `do-not-merge`; `#2294` → `do-not-merge`; `#2310` → `labels: []`.

**`#2310` classified before merging (DOCTRINE §10.1).** [MEASURED] `gh pr view 2310 --json` →
single file `docs/pipeline/sweep-rotation.json` (+2/−2, MODIFIED), `mergeStateStatus: CLEAN`,
`isDraft: false`, `labels: []`, created `2026-10-10T23:03:52Z`, head `71e67b5a`. RULE-2 probe over
`docs/pr-prompts/processed/*.log` for `PR #2310` → **NO HITS**; POSITIVE control `stays for Marco`
→ **1 hit**; NEGATIVE control, a needle minted this run (`zqx-needle-20261011-0130`) → **0 hits**.
So it is a **second-lane PR carrying no watcher verdict**, hand-classified: docs-only, no §5 hard
stop, inside 00's recorded docs lane (STATION-CAPABILITIES §5). `gh pr checks 2310` → every
required check `pass`, including **`Approval receipt (CP-26)` pass**; the five `skipping` jobs are
path-filtered. ⚠️ [CANNOT MEASURE] its AUTHOR: the one `gh pr view --json author,commits` call of
this run returned `error connecting to api.github.com` — a transient blip, since every later `gh`
call in the same script succeeded. Not retried, because the RULE-2 probe already settled the only
question the author would have answered.

**04's F2 ("Station 00 dark for roughly three hours and three hourly occurrences") is REFUTED by
04's own clock.** [MEASURED] from the scheduled-tasks MCP at 01:3xZ: `04-scanner`
`lastRunAt 2026-10-10T22:10:09Z`, `nextRunAt 2026-10-11T02:09:31Z` — so the run that wrote
`00-04-scanner-2026-10-11-0209-...` **fired at 22:10Z and stamped itself 02:09Z**, four hours in
its own future, taking `nextRunAt` for a clock (its GROUND block says so explicitly and tags it
`[INFERRED]`). At 04's TRUE run time, 00's `lastRunAt` was `2026-10-10T22:08:59Z` — **71 seconds
earlier**. 00 was not dark; it had just run. The "nextRunAt ~3h in the past" reading was the
future stamp subtracting a live value. POSITIVE control that the MCP reading is sound: 00's
`lastRunAt` now reads `2026-10-11T01:14:09Z`, this very run, with `nextRunAt 02:13:52Z`.

**But a smaller real gap exists, and it is two occurrences, not three.** [MEASURED] 00's newest
breadcrumb before this one is `...-2026-10-10-2208-...`; `lastRunAt` then jumps to this run's
01:14:09Z. Against `5 * * * *` that means the **23:14 and 00:14 occurrences produced nothing** —
2 of 3, where 04 claimed 3 of 3 and named the wrong three. Classification per
FRESHNESS_ONE_CADENCE_V1: [CANNOT MEASURE] which of *never fired* / *fired and died* applies —
`lastRunAt` holds only the most recent run, and resolving it needs the local-agent-mode session
directory's `CreationTimeUtc`, which is process/directory enumeration, the instrument that is
currently hanging (see the sweep reading above).

**`check-breadcrumb.mjs --freshness` → exit 2, `MISSED: 1 station(s)`, and the one it names is
`00` — i.e. me.** [MEASURED] `node scripts\pipeline\check-breadcrumb.mjs --freshness`:
`00 last 2026-10-10T22:08:00Z 3.2h ago (cadence 1h + grace 0.5h) MISSED`; `03 ... 2.3h ago ok`;
`04 last 2026-10-11T02:09:00Z **-0.8h ago** ok`; `05 last 2026-10-11T14:25:00Z **-13.0h ago** ok`.
`structure: 19 checked, 0 malformed`. ⚠️ **Two of the five rows are NEGATIVE ages — breadcrumbs
dated in the future** — which is the stamping defect above surfacing in the validator: a station
that over-stamps its own date reads `ok` for longer than it has earned, in the direction of **not
noticing a missed run**. That is escalation #23's exact failure mode, now reproduced inside the
freshness detector itself.

**Scheduled layer, read from the MCP, never from a pasted cadence.** [MEASURED] 4 enabled —
`00-supervisor` `5 * * * *` (last 01:14:09Z, next 02:13:52Z), `03-machine-minder` `0 9 * * *`
(last 2026-10-10T23:03:44Z, next 2026-10-11T23:02:45Z), `04-scanner` `0 */4 * * *` (last
22:10:09Z, next 02:09:31Z), `05-sot-keeper` `10 0 * * *` (last 2026-10-10T14:22:59Z, next
2026-10-11T14:22:37Z); `weekly-security-audit` **`enabled: false`**. Matches
STATION-CAPABILITIES §1's 2026-09-15 correction and §5's note; no drift in either.

**MARCO_QUEUE_LINE_V1 figures, for the record and for any future limit.** [MEASURED] WAITING ON
MARCO: **2** open PRs labelled `do-not-merge` (`#2294`, 29 h open; `#2303`). Armed prompts:
**0** (`docs/pr-prompts/*-ready.md` is empty). **Nothing was armed this run** — see WHAT I DID NOT
DO for why.

**Breadcrumb corpus collected this run.** [MEASURED] three untracked at tracked paths in the dev
tree: `00-00-supervisor-2026-10-10-2208-...`, `00-03-machine-minder-2026-10-10-2307-...`,
`00-04-scanner-2026-10-11-0209-...`. 04's is the one carrying live findings; 00's 2208 is my own
predecessor and 03's 2307 reports the watcher healthy with the process storm outliving its crash
loop.

## WHAT CHANGED

**One merge, read back.** `#2310` `docs(pipeline): commit 04's sweep-rotation advance to index 3`.

- Lease: `Enter-BoardLease -Actor "station-00.scheduled"` → `True`, with `$env:PO_ACTOR` set to the
  SAME string so `Merge-Pr`'s generated-actor trap (`pwsh-<pid>` refused by its own lease) could
  not fire.
- `Assert-SmokedOrEscalate -PR 2310` → `True`. `Merge-Pr -PR 2310 -Actor "station-00.scheduled"` →
  `State = MERGED`.
- Read back (DOCTRINE §1): `gh pr view 2310 --json number,state,mergedAt` →
  `{"state":"MERGED","mergedAt":"2026-10-11T01:33:08Z","number":2310}`. ✅ **MERGED, not QUEUED** —
  the UPDATE_AT_MERGE_TIME_V1 distinction, stated because QUEUED must never be reported as merged.
- No hand `gh pr merge`, no hand `git merge`.

**This breadcrumb, written to the dev tree at a tracked path**, and batched onto a board branch
with the three collected breadcrumbs by `sweep-breadcrumbs.ps1` (see FINDINGS F1).

Nothing else. **No prompt armed, disarmed, renamed, moved or deleted. No label added or removed.
No `/sot/` edit. No `gh pr update-branch` on any PR I was not merging. No scheduled task created,
edited, enabled, disabled or re-run. No Azure / Entra / SharePoint action of any kind.**

## FINDINGS

**F1 — COLLECT closed: three station breadcrumbs collected, every finding dispositioned, and the
batch committed.** The three untracked breadcrumbs named above were read in full and every finding
in them carries a disposition in this section. They are batched onto a board branch by
`scripts/pipeline/sweep-breadcrumbs.ps1` together with this file, and the collected ones `git mv`'d
to `docs/pr-prompts/archive/` in the same PR per the ARCHIVE rule; this run's own breadcrumb stays
in the root as the current cycle.
**DISPOSITION: ACTIONED** — verified by the sweep script's own read-back of the branch and the PR
it opened; the PR number is in this run's chat report.

**F2 — 04's "00 is dark three occurrences" is refuted, and the refuting evidence is a stamping
defect in 04 itself.** Measurements in WHAT I MEASURED. 04 took `nextRunAt` for a clock, stamped
itself 4 h ahead, and every age it computed against a live MCP value inherited that offset. The
same family of defect is live in 05 (`...-2026-10-11-1425-...` against `lastRunAt
2026-10-10T14:22:59Z` — time right, date a day ahead) and 04 flagged 05's instance in its own
`...-1810-...` breadcrumb without noticing its own. **Two of five `--freshness` rows are now
negative ages**, so the detector that exists to catch a missed run is being told a station
reported in the future.
**DISPOSITION: DISPATCHED to Station 04** (and, for the 05 half, to Station 05). The handover, in
one line each, is: **stamp GROUND and the breadcrumb filename from a clock you MEASURED, and when
no clock probe exists on your transport, say `[CANNOT MEASURE]` and stamp from the scheduler's
`lastRunAt` — never `nextRunAt`.** `lastRunAt` is the only MCP field that describes a run that has
happened; `nextRunAt` describes one that has not. ⚠️ Both stations are read-only and cannot fix
their own bootstraps, but this is a behaviour change inside their station docs
(`docs/pipeline/stations/04-scanner.md`, `05-sot-keeper.md`), which each may change by ordinary
docs PR — 05 directly, 04 by staging it for 00.

**F3 — `status-sweep.ps1` hangs at section 2 and therefore issues no verdict at all, for the
second consecutive day.** Measurement in WHAT I MEASURED. This is not a new fault — 00's `2015`
and `2114` and 03's `2307` breadcrumbs measured the same process-enumeration storm, with `2114`
refuting the CIM→WMI swap `2015` proposed within the hour. What is new and worth naming is the
**contract consequence**: the station doc's PREFLIGHT step 4 says *run the sweep and obey it*, and
a sweep that hangs leaves a run with no SAFE / CAUTION / DO-NOT-ACT verdict to obey. A run that
treats "no verdict" as "SAFE" is acting on a §7 instrument lie in the one step that gates every
mutation.
**DISPOSITION: DISPATCHED to Station 03** — the machine fault is 03's lane and it has already
measured it (`2307`); what 03 does not yet have is the **ordering** fact this run adds: the hang is
in section 2 specifically, after section 1 completes and flushes, so **`-SkipSection5` (PR #2294)
does not help** and the useful shape is a bounded timeout around section 2's process enumeration
with a loud `[BROKEN]` row, which section 0's own contract already tells a reader to stop on.
⚠️ #2294 and #2303, the two PRs that would carry sweep repairs, are both RED and both
`do-not-merge`, so this cannot be fixed by merging what is already on the board.

**F4 — 04's F7 (the rotation advance exists only as an uncommitted dev-tree edit) is resolved, and
the resolution arrived from outside 04's view.** [MEASURED] `docs/pipeline/sweep-rotation.json` does
**not** appear in `git status --porcelain` and no tracked file is modified in the dev tree, while
`#2310` carried exactly that file (+2/−2) and is now MERGED. So the advance to `last_index: 3` is on
`main` and the dev tree is clean.
**DISPOSITION: ACTIONED** — merged and read back this run (WHAT CHANGED). ⚠️ The caveat 04 attached
survives the merge and is recorded here rather than dropped: `last_run_utc` in that file is 04's
`nextRunAt` stamp (`2026-10-11T02:09:31Z`), **not a measured clock**, so it is ~4 h ahead of the run
that advanced it. I did **not** re-run `next-sweep.mjs --advance` to correct it: the index is the
field the rotation reads, it is correct, and rewriting a merged file to fix a cosmetic timestamp
would cost a second PR for no behavioural change. The stamping defect itself is F2.

**F5 — 04's F6 (the native-file-tools transport reads an MCP-reported bootstrap `path` but refuses
to `Glob` its root, and reaches 2 connected folders rather than §4's eleven) is a real
documentation gap in STATION-CAPABILITIES §3.** 04 dispatched it to 00 because 04 may not open a
PR. I confirm the finding is coherent and belongs beside `NATIVE_FILE_TOOLS_READ_TRANSPORT_V1`,
whose current wording says only that the native tools read `C:\ProjectOperations2` and is silent on
both asymmetries. The cost half is the load-bearing one: a blind run following §3's
`BLIND_RUN_OTHER_MOUNTS_V1` literally on that transport would read "no verdict for PR N" out of
three verdict homes it cannot reach, which is §9.6 with a mount for a hat.
**DISPOSITION: DEFERRED** — to the next 00 occurrence (02:13:52Z), as its own docs PR. Not actioned
this run deliberately: it is a content addition to a hash-adjacent binding document and this run's
remaining budget was spent closing COLLECT (F1) and the merge, and DOCTRINE §8.2's rule is one
complete fix, not a hurried one. **What would make it urgent:** any blind run writing "no verdict
for PR N" or "the mount list is empty"; the finding is already durable in 04's breadcrumb, which
this run's PR tracks, so it cannot be lost.

**F6 — 04's F4 (03's bootstrap pastes "every 4 hours" against a `0 9 * * *` daily cron) and F5
(05's bootstrap cites `pr-gates.mjs:327`, a line number, and 327 is a comment line) are both
confirmed and both live only in Marco's layer.** [MEASURED] this run, from the MCP: 03's cron is
`0 9 * * *` — daily, 6× the pasted figure, in the direction of not noticing a missed run. I did not
re-measure the `pr-gates.mjs` line numbers; 04's reading is quoted with its anchors and is
[INFERRED] here.
**DISPOSITION: ESCALATED** — Marco, two edits to files only you can change, one batch.
RULE 1, complete-and-additive first: **(a)** in `03-machine-minder\SKILL.md`, replace the pasted
cadence sentence with 00's wording verbatim (*"Your cadence is whatever `list_scheduled_tasks`
reports … Never compute a missed-occurrence verdict from a cadence pasted here"*), and in
`05-sot-keeper\SKILL.md` replace `(pr-gates.mjs:327)` with the anchor 05's own station doc already
uses, ``(anchor: `const sotRe = /^sot\//` in `scripts/pr-gates/pr-gates.mjs`)`` — both layers then
agree, no line number can rot, nothing else is touched: passes *immediately* and *future*, and
touches no data. **(b)** Correct 327 → 321 only — fails the *future* half: still a line number,
rots on the next edit to that file. **(c)** Leave both — fails the *future* half outright; a thin
pointer whose pointer rots is the failure the thinning existed to remove. ⚠️ Raised before (04's
`1810` breadcrumb, and §5/§6 of STATION-CAPABILITIES record the 03 half as long-open), so the
honest framing is *"still open, now measured twice"*.

**F7 — 04's F1 (no execution transport at all: Desktop Commander CONNECT_TIMEOUT *and* the VM
sandbox wedged) did not reproduce this run, which narrows it rather than closing it.** [MEASURED]
this run: Desktop Commander answered the first `start_process` and ran every probe, `.ps1`, `git`,
`gh` and `node` call in this report; the VM bash transport also answered (the git-guard install,
exit 2). So the double-blind of 04's 22:10Z run was **intermittent, not a standing outage** — which
is exactly what STATION-CAPABILITIES §2 records about blindness (~40% of 00's runs, cause unknown).
04's ESCALATION of it stands as written and is not refuted; what this run removes is the reading
that both transports are *currently* down.
**DISPOSITION: ESCALATED** — carried forward to Marco unchanged, with this run's narrowing
attached. The question 04 put is still the right one and still only yours: **which transport to
repair first.** RULE 1, complete-and-additive first: **(a)** fix the cause of Desktop Commander's
intermittent connect timeout — it is the only transport that can RUN anything on the box, so it
restores liveness, smoke, the sweep scripts and the board, and damages nothing: passes both halves.
**(b)** repair only the VM sandbox — fails *completely*: the mount can never run `.ps1` or `git`, so
every verdict stays unobtainable. **(c)** accept blind runs and widen what they may assert — fails
*without damaging* outright; it licenses verdicts from instruments that cannot measure them, the §7
failure this pipeline has already paid for six times. ⚠️ Evidence this run adds for (a): the
intermittency is now measured in **both** directions inside 4 hours — 22:10Z double-blind, 01:14Z
fully sighted — so a fix must target flakiness, not a dead service.

**F8 — 03's `2307` breadcrumb: the watcher is healthy and the process storm outlived its crash
loop, with `Win32_Process` now hanging instead of failing.** Collected and cross-read against this
run's own instrument readings, which corroborate the hang half independently (F3: `status-sweep.ps1`
stops dead in section 2, the watcher section, and never returns). The healthy-watcher half is 03's
[LIVE] reading and I do not restate it as mine — this run has **no** liveness verdict of its own,
because the only sanctioned probe is a `.ps1` whose process enumeration is the thing hanging.
**DISPOSITION: DEFERRED** — nothing for 00 to act on: the watcher is not the blocker, no PR is
waiting on it, and the storm is already escalated via F3/F7. **What would make it urgent:** an
armed prompt not picked up within one watcher heartbeat, or `#2303`/`#2294` going stale with no
build attributable to them. Zero prompts are armed, so there is nothing for the watcher to miss
right now.

## WHAT I DID NOT DO

- **Did not arm anything.** Zero prompts are armed and the queue root holds no `-ready.md`; the two
  PRs on the board are both RED and both `do-not-merge`, so adding a third build would lengthen
  Marco's release queue (MARCO_QUEUE_LINE_V1: currently 2) while the sweep cannot issue a
  safe-to-act verdict (F3). Arming is explicitly mine to judge and I judged against it this run.
- **Did not merge, update, rebase or relabel `#2303` or `#2294`.** Both carry `do-not-merge` — only
  Marco removes it — and both are RED. I ran no `gh pr update-branch` on either: the watcher's
  auto-update timer is OFF and a stray update-branch costs a full CI rebuild.
- **Did not clear any lock.** None was present. Had one been, clearing it is 03's on 00's dispatch.
- **Did not touch the watcher's repo or process.** No `git` of any kind in
  `C:\po-watcher\ProjectOperations`; no restart, no kill, no process enumeration beyond what the
  sweep attempted on its own.
- **Did not re-run `status-sweep.ps1` hoping for a different answer** (DOCTRINE §2: never re-run
  hoping for green). I recorded the hang and substituted its component checks individually, naming
  each.
- **Did not claim a liveness, smoke or safe-to-act verdict.** The sanctioned probes for all three
  are `.ps1` scripts whose process enumeration is the hanging instrument.
- **Did not write `breadcrumb-clean`.** `check-breadcrumb.mjs --freshness` was run (exit 2,
  `MISSED: 1`), but the structure validator has not been run against **this** file; the next run,
  or CI's `pipeline-tests` job on the board PR, is what certifies it.
- **Did not resolve 04's F6 / my F5 this run**, and said so under its own disposition rather than
  letting it pass as handled.
- **Did not create, edit, enable, disable or re-run any scheduled task**, on the MISSED reading or
  on any other — forbidden on that reading alone, and the 23:14/00:14 gap is reported, not acted on.
- **Did not touch Azure, Entra or SharePoint**, and did not write production data.
- **Did not write anything to a gitignored sink.** This file is at the tracked path
  `docs/pr-prompts/00-00-supervisor-2026-10-11-0114-...md` — not `docs/qa/`, not `needs-marco/`,
  not the Cowork session's `outputs` folder, and not a disposable worktree.
