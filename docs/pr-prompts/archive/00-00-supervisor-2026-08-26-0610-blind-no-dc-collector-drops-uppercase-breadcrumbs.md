# Station 00 — Supervisor | 2026-08-26T06:09Z–2026-08-26T06:26Z

> **FIRST LINE: THIS WAS A BLIND RUN.** Desktop Commander was absent. I could not start a
> PowerShell shell on the Windows host, so I could not run `git`, `gh`, `pipeline-lib.ps1`,
> `status-sweep.ps1`, `smoke-pr.ps1`, or any arming/merging primitive. **I armed nothing, merged
> nothing, dispatched nothing, and committed nothing — because I structurally could not.** Read
> every "no change" below as *blind*, not as *healthy*. This is the **7th blind run in 6 days**.
>
> Read coverage was NOT lost: the dev tree `C:\ProjectOperations2` and the watcher clone
> `C:\po-watcher` are both mounted and were read directly. GitHub was read via the read-only MCP
> and is labelled as such — it is **not** presented as box coverage.

## GROUND

```
UTC            2026-08-26T06:09:46Z (start)   2026-08-26T06:26Z (end)
origin/main    8f0377e5   (GitHub API, HEAD of main, authored 2026-08-25T22:10:18Z)
               8f0377e5   (dev-tree .git/refs/remotes/origin/main — agrees, tree is current)
dev tree       main @ 8f0377e5   C:\ProjectOperations2
doc version    1   (docs/pipeline/stations/00-supervisor.md front matter)
bootstrap      1   (scheduled-task SKILL.md, station_doc_version: 1)
```

Version check: **doc version 1 == bootstrap 1. No mismatch.** The read-only posture of this run is
caused by DC absence, not by a version mismatch.

## WHAT I MEASURED

**Reachability [MEASURED]** — `ToolSearch` for Desktop Commander tools, three separate queries
(`+desktop-commander`; `start_process interact_with_process powershell shell session`;
`read_file write_file list_directory search_files edit_block process`). All three returned zero
DC tools. The server was advertised as "still connecting" for the first ~2 minutes of the run and
then vanished from the connecting list without ever exposing a tool. **`[CANNOT MEASURE]` for every
PowerShell-only probe named in the station doc.**

Per the bootstrap's own diagnostic, this station **does** appear in the scheduled-task listing
(`00-supervisor`, `5 */2 * * *`, enabled, `lastRunAt 2026-08-26T06:08:45Z` = this run), which the
doc reads as "cloud-fired, structurally cannot reach the box." **[INFERRED — and partly refuted]:**
04-scanner and 03-machine-minder appear in the same listing and *have* reached the box on recent
runs, and 00 itself reached it on 08-25 22:10Z and 08-26 00:08Z/02:08Z. So presence-in-the-listing
is **not** a sufficient explanation. The honest statement is: **DC availability is intermittent and
unpredictable across runs of the same task**, which is worse to plan around than a clean structural
failure.

**Board [MEASURED, GitHub read-only MCP]** — `list_pull_requests(state=open)`:

| PR | Title | Head | Labels |
|---|---|---|---|
| #1325 | docs(sot-04): reverse B-P0a direction to Job-canonical | `docs/sot-04-bp0a-job-canonical` | `do-not-merge` |
| #1323 | feat(pipeline): arm-prompt.ps1 serializer — exclusive lock + index guards | `feat/arm-prompt-serializer` | `do-not-merge` |
| #1320 | fix(web): gate /crm and /clients routes behind RequirePermissions crm.view | `worktree-agent-ae6eefd9604700b45` | *(none)* |
| #1316 | feat(tendering): capacity service + tenders.allocate permission (EW-2a) | `feat/ew-2a-capacity-service` | *(none)* |

**All four are watcher-routed to Marco — RULE 2 [MEASURED, not inferred from labels].** The
label-only check would have called #1316 and #1320 free; it is wrong on half the board, exactly as
recorded. The `stays for Marco` probe on the live watcher log
(`C:\po-watcher\ProjectOperations\scripts\pr-watcher\logs\2026-08-24.log`) names all four:

```
[2026-08-25T07:37:21.458Z] [merge] pr-ew-s2a-capacity-service-ready.md: PR #1316 stays for Marco (outside tests/ or docs/: apps/api/jest.config.ts)
[2026-08-25T09:48:19.492Z] [merge] pr-crm-route-permission-guard-ready.md: PR #1320 stays for Marco (outside tests/ or docs/: apps/web/src/App.tsx)
[2026-08-25T12:28:10.948Z] [merge] pr-arm-lock-s1-serialize-arming-ready.md: PR #1323 stays for Marco (escalates:true — held for Marco, labelled do-not-merge)
[2026-08-25T16:29:20.073Z] [merge] pr-sot-04-bp0a-job-canonical-reconcile-ready.md: PR #1325 stays for Marco (escalates:true — held for Marco, labelled do-not-merge)
```

**Nothing merged in 8 h 10 m [MEASURED].** `main` HEAD is still `8f0377e5` (#1321), authored
2026-08-25T22:10:18Z; now 06:26Z. **This is the board obeying RULE 2, not the board being broken.**
The 08-25 22:10Z clearance was spent on #1322/#1319/#1317/#1321 and does not carry forward.

**Armed [MEASURED]** — dev tree `docs/pr-prompts/*-ready.md` at depth 1: **0**. Depth-1 `pr-*.md`:
**61**, of which **57** are `-HOLD`. Clone (`C:\po-watcher\ProjectOperations`) depth 1: **2** —
`pr-sot-ll36-sot-purity-ready.md` and `rev-1162-ready.md`. `rev-*` is a review job, not a prompt
(DOCTRINE §9.5); clone-side `-ready` files are **INERT** — the watcher globs the dev tree. This is
also the explanation for `supervisor.log`'s repeated `WATCHDOG armed=1 runnable=0`: it is counting
the clone's one inert file. **Not a fault.**

**Watcher liveness [MEASURED] — LIVE, and NOT frozen.** Two independent signals:

1. `<clone>\scripts\pr-watcher\.queue-state.json` **`ts` field** = `2026-08-26T06:08:08.224Z`,
   read at 06:09Z (the clone-root copy does not exist, as recorded).
2. **Fixed-interval tick GAP series, 14 consecutive ticks** from the live log — the only probe that
   catches an in-job freeze. Every gap 299.23 s – 300.63 s against a 300 s interval, unbroken from
   05:08:07Z through 06:13:07Z. No stall, no skipped tick.

`kept=4` on every sweep, consistent with 4 open PRs. **I did not restart, stop, or touch the
watcher** — and could not have.

**Station freshness [MEASURED, with controls]** —
`node scripts/pipeline/check-breadcrumb.mjs --freshness`, run in the Linux sandbox (pure file read,
no `git` invoked against the Windows `.git`). True exit code **2** (SILENT). *Note for the next
station:* I first read the exit through a pipe (`| tail`) and got **0** — that was `tail`'s exit,
not the tool's. A §9-class instrument lie I nearly filed. Re-run unpiped.

```
00  last 2026-08-26T02:08:00Z   4.1h ago  (cadence 2h)   SILENT
02  dispatch-only
03  last 2026-08-25T23:01:00Z   7.3h ago  (cadence 4h)   ok
04  last 2026-08-26T02:10:00Z   4.1h ago  (cadence 4h)   ok
05  last 2026-08-25T14:11:00Z  16.1h ago  (cadence 24h)  ok
```

**That `00 ... SILENT` verdict is FALSE, and the reason it is false is the finding below.**

## WHAT CHANGED

**Nothing on the board, nothing in git, nothing in the queue.** No arm, no disarm, no merge, no
label change, no restart, no commit, no push, no dispatch. The only write this run made anywhere is
this breadcrumb file. That is not restraint — it is the full extent of what a blind run can do.

## FINDINGS

### F1 — The breadcrumb collector silently drops any breadcrumb with an uppercase character, and all four it is currently dropping are the BLIND runs

`check-breadcrumb.mjs:39` is
`NAME_RE = /^00-(\d\d)-([a-z0-9-]+)-(\d{4}-\d{2}-\d{2})-(\d{4})-([a-z0-9-]+)\.md$/`. The slug class
is **lowercase-only**, and a non-matching `00-*.md` is **skipped, not reported as malformed** — so
it leaves no trace in the output at all.

**[MEASURED], with a positive control, a negative control, and an arithmetic control:**

- Breadcrumbs on disk dated ≥ `CONTRACT_FROM` (2026-08-25): **26**.
- Of those, carrying any uppercase character: **4**.
- The tool reported: **`structure: 22 checked, 0 malformed`**. **26 − 4 = 22, exactly.**
- Negative controls (NOMATCH against NAME_RE in node, and absent from the ADMIT list):
  `00-00-supervisor-2026-08-26-0410-BLIND-...md`,
  `00-00-supervisor-2026-08-25-1810-BLIND-...md`.
- Positive control (MATCH, and present in the ADMIT list):
  `00-00-supervisor-2026-08-26-0208-four-marco-gated-board-idle-cp26-by-design.md`.

**Consequence, and why this is not cosmetic.** The four post-contract files being dropped are
`0408-BLIND`, `1009-BLIND`, `1810-BLIND` (08-25) and `0410-BLIND` (08-26). **The collector is
systematically blind to exactly the reports that say "I could not see anything."** It then reports
00's last breadcrumb as 02:08Z and declares 00 SILENT — while the 04:10Z report sits on disk,
correctly written, unreadable by the one instrument whose job is to read it. A defect that hides
blind runs from the collector is the ideal shape for keeping a recurrent outage invisible: DC has
now been absent 7 times in 6 days and 4 of those reports do not exist as far as the collector is
concerned.

**Also measured in the same file:** `CADENCE = { '00': 2, '02': null, '03': 4, '04': 4, '05': 24 }`.
`03-machine-minder`'s real schedule is `0 9 * * *` — **daily**, per `list_scheduled_tasks`. The map
says 4 h, so 03 would be called SILENT after 8 h when its true budget is 48 h. It reads "ok" right
now only because it happens to be 7.3 h old.

**Fix, under RULE 1 — complete-and-additive option FIRST:**

1. **(Complete + additive — recommended.)** In `check-breadcrumb.mjs`: make the slug and station
   classes case-insensitive **and** make any `00-*.md` that fails `NAME_RE` report as **MALFORMED**
   instead of being skipped in silence; and correct `CADENCE['03']` from `4` to `24`. *Solves it
   immediately* — the 4 existing blind reports become visible without touching them — *and in
   future* — the next misnamed breadcrumb is named out loud rather than swallowed. Damages no
   existing or future data entry: it only widens what the reader is shown; no file is moved,
   renamed or rewritten.
2. *(Alternative — fails the "future" half.)* Rename the 4 files to all-lowercase. It clears
   today's symptom, but the next station that types an uppercase slug is invisible again, and it
   mutates existing artifacts (changing paths other reports may cite). It does not fail the
   "damage" half, but it fails "solves it for the future".

I could not open a PR for option 1: no DC, therefore no `git`, no `gh`. Writing a `-HOLD` prompt
would also not help — an untracked HOLD cannot be armed (`git mv` refuses an untracked path), which
is a trap already logged three times.

**DISPOSITION: DISPATCHED** — to **04-scanner** (next run 2026-08-26T10:09Z) to confirm the two
controls independently, and to the next **00** run that has Desktop Commander, to author and arm the
one-file fix to `scripts/pipeline/check-breadcrumb.mjs`. Evidence and the exact line numbers are
above; nothing further needs re-deriving.

### F2 — Desktop Commander absent again: 7 blind runs in 6 days, and the cause is intermittency, not configuration

Blind runs: 08-21 0610 · 08-22 0010 · 08-25 0408 · 08-25 1009 · 08-25 1810 · 08-26 0410 · **08-26
0610 (this run)**. Between them, 00 reached the box normally at 08-25 2210, 08-26 0008 and 08-26
0208. **The same scheduled task, the same machine, the same listing — sometimes DC is there and
sometimes it is not.** Computer-use is not a fallback: terminals are granted at tier "click", so
typing into a shell is blocked by design.

Effect: **whenever DC is absent, Station 00 cannot arm, cannot merge, cannot commit, cannot push,
and cannot dispatch.** The board can only be driven on the runs that happen to get a shell. Right
now that costs nothing, because all four open PRs are Marco-gated anyway — but the moment Marco
clears a batch, whether the queue moves becomes a coin flip on DC.

**Question for Marco (not a status update):** which do you want?

1. *(Complete + additive.)* Make the Windows shell a **precondition** of the scheduled run — have
   the launcher verify Desktop Commander is connected before the station starts, and retry/re-fire
   rather than starting a station that cannot act. Solves it now (no more half-capable runs) and in
   future (any new station inherits the guarantee), and it cannot damage data entry because it only
   gates *starting*, never mutates anything.
2. *(Fails the "future" half.)* Leave it, and accept that roughly half the supervisor runs are
   read-only reports. Cheap today; it silently caps board throughput the next time the board is
   busy.
3. *(Fails the "complete" half.)* Move 00 to a device-fired schedule if that is what actually
   distinguishes the runs that get DC — I could not determine that from inside the run, so this is
   a hypothesis, not a recommendation.

**DISPOSITION: ESCALATED** — to Marco. This is the 2nd consecutive run escalating it (04:15Z was
the 1st) and the 7th occurrence. It needs a configuration decision only he can make.

### F3 — Board idle 8 h 10 m; all four open PRs are Marco-gated; both reds are CP-26 by design

`main` unchanged at `8f0377e5` since 2026-08-25T22:10:18Z. #1316, #1320, #1323, #1325 are all
watcher-routed to Marco (F-log above). **RULE 2 forbids me from merging any of them, and the
08-25 22:10Z clearance was for that batch only.** #1323 and #1325 additionally carry `do-not-merge`,
which I did not touch and will not touch. `ci.yml`'s `on: pull_request` still has no `types:`, so
CP-26 runs the label race both ways — a red CP-26 on a `do-not-merge` PR is the gate working, not a
defect, and no run should be spent driving it green.

**The single most important thing blocking progress right now: nothing on the board is mine to
move.** The board is waiting on Marco's clearance, correctly.

**DISPOSITION: DEFERRED** — this becomes urgent the moment Marco clears a batch in chat. Standing
resume-arming condition is unchanged: resume when #1323 merges **or** Marco-gated open ≤ 2, **and**
no commit on `origin/main` in the preceding 10 minutes.

### F4 — COLLECT: one new breadcrumb since my last run, and it is the one the collector cannot see

Only breadcrumb written since 04:10Z is
`00-00-supervisor-2026-08-26-0410-BLIND-no-dc-four-marco-gated-board-frozen-6h.md` (mtime
2026-08-26 14:14 local = 04:14Z). Its two findings, re-verified live rather than repeated:

- *DC absence is a recurrent structural fault* — **still true, and worse**: re-measured this run,
  now 7 occurrences. Rolled into **F2, ESCALATED**.
- *Board frozen 6 h, four Marco-gated* — **still true, now 8 h 10 m**, re-measured against the live
  GitHub board and `main`'s commit timestamp, not repeated from the note. Rolled into **F3,
  DEFERRED**.

No breadcrumbs from 03, 04, 05 or 06 since my last run — all are within cadence (03 daily, last
23:01Z; 04 4-hourly, last 02:10Z, next 10:09Z; 05 daily, last 14:11Z, next 14:10Z). **The one
`SILENT` the tool reported is the false positive caused by F1**, not a station that failed to run.

**DISPOSITION: ACTIONED** — collected and dispositioned; verified by reading the live board and the
live watcher log rather than by re-reading the note.

### F5 — ADDENDUM: Station 04 landed a breadcrumb at 06:11Z, mid-run, after my COLLECT window

`00-04-scanner-2026-08-26-0611-repo-hygiene-sixteen-holds-and-a-blocked-report-channel.md`
(04's `lastRunAt` 06:10:24Z). Eight findings, headline severities S2–S4:

```
F1  16 executed HOLD prompts still tracked on origin/main; one `git checkout` re-arms them   S2
F2  the only reporting channel that closes is 43 reports deep and 5 days behind              S2
F3  18 settled remote branches never deleted, oldest 72 days                                 S3
F4  328 local branches in the dev tree, 298 with deleted upstreams                           S3
F5  an ancestor-based "is this branch merged" check is structurally blind here    S3, instrument
F6  the watcher clone's stash loop is at 39 and still closed                                 S3
F7  the four orphaned worktrees: prior DO NOT PRUNE verdict RE-VERIFIED, still standing      S2
F8  queue-root litter                                                                        S4
```

I have **not** dispositioned these — they arrived after my collect and I have read only their
headings. **Its F2 is the same wound as my F1 from the other side**: 04 measures the report channel
as 43 deep and 5 days behind, and my F1 explains why 4 of those reports would not have been counted
even once the channel drains. Both need the same thing: a board PR that commits
`docs/pr-prompts/00-*.md`, which needs `git`, which needs DC (**F2**).

**DISPOSITION: DEFERRED** — to the 08:07Z Station 00 run, whose collect window this falls in. It
becomes urgent if that run is also blind, because then two collect cycles will have passed with a
channel 44+ deep. Re-verified this run at 06:26Z: the file exists on disk, is lowercase, and ADMITs.

## WHAT I DID NOT DO

- **Armed nothing.** Dev-tree armed count went 0 → 0. I could not have armed anyway: arming is a
  `git mv` of a tracked `-HOLD`, and I had no `git`. The two candidates standing from earlier runs
  (`pr-rates-consumers-s3-persona-export`, `pr-fv2-maintenance-usage-intervals`) and 05's two
  reconcile HOLDs (bp0a P1, sot/02 P3) are **untouched and still queued**.
- **Merged nothing, and would not have.** All four open PRs are watcher-routed to Marco (RULE 2);
  two also carry `do-not-merge`. Correct on policy *and* on capability — I am saying both, because
  a policy-correct outcome reached by an incapable run is not evidence the policy was applied.
- **Did not remove or add any label.**
- **Did not touch the watcher.** It is LIVE and tick-clean; there was nothing to fix, and
  §3b ENSURE-UP is a known defect that would have started a second supervisor.
- **Did not run `git` in any form against the Windows `.git`** — not from the sandbox, not through
  the mount. That is the 0-byte-`index.lock` trap, and a blind run is exactly when it is tempting.
- **Did not quote a trunk colour** from `status-sweep.ps1` — could not run it, and its
  `TRUNK IS RED` is a coin flip regardless.
- **Did not commit this breadcrumb.** It is **UNTRACKED** and reaches nobody until a board PR
  commits it — and, until F1 is fixed, note that this file *is* all-lowercase and therefore *is*
  visible to the collector.
- **Did not verify whether the two self-blocking untracked HOLDs still block themselves**
  (`pr-hygiene-gitignore-no-pr-opened`, `pr-watcher-idle-tick-liveness`) — that needs
  `git status` / `git ls-files`. **[CANNOT MEASURE]** this run.
