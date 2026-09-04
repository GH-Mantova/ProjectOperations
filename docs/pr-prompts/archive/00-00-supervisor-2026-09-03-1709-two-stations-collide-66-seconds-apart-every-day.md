# Station 00 - Supervisor | 2026-09-03T17:09Z-2026-09-03T17:3xZ

## GROUND

```
UTC            2026-09-03T17:09:05Z
origin/main    6b30ada1            (fetched, then rev-parse)
dev tree       main @ 6b30ada1     C:\ProjectOperations2
doc version    1
bootstrap      1
```

Bootstrap and station doc AGREE (both `station_doc_version: 1`) - this run is READ/WRITE.

All three binding docs were read from the working copy, and the working copy was proved
byte-identical to `origin/main` by content, not by version number:

    git hash-object <path>  vs  git rev-parse origin/main:<path>
    docs/pipeline/stations/00-supervisor.md   a2640ab2...  ==  a2640ab2...   same=True
    docs/pipeline/DOCTRINE.md                 ea91409d...  ==  ea91409d...   same=True
    docs/pipeline/STATION-CAPABILITIES.md     eeaaf877...  ==  eeaaf877...   same=True

SIGHTED run. Desktop Commander reached the box (`start_process` PID 23448, powershell.exe).

## WHAT I MEASURED

**Sweep verdict.** `scripts/pipeline/bring-up-to-speed.ps1`, generated 2026-09-03T17:09:55Z:
`[LIVE] SAFE TO ACT: no board mutation in progress, no recent remote activity, no live
station worktrees.` [MEASURED]

**Board - four PRs, all four Marco's, unchanged since the 16:09Z run.** [MEASURED]

| PR | mergeState | CI | labels | lane verdict |
|---|---|---|---|---|
| #1544 | UNKNOWN | 14 pass / 0 fail | `[]` | NO verdict - hand-classified MARCO'S |
| #1543 | CLEAN | 14 pass / 0 fail | `[]` | genuine `marco:true` |
| #1541 | CLEAN | 14 pass / 0 fail | `[]` | genuine `marco:true` |
| #1536 | BLOCKED | 12 pass / 2 fail | `[do-not-merge]` | genuine `marco:true` |

RULE-2 probe, quote-safe regex form, run against `docs/pr-prompts/processed/*.log`:

    Select-String -Pattern "PR #<n>.*marco.:true"
    #1544 -> 0 hits    #1543 -> 1    #1541 -> 1    #1536 -> 1
    POS control (`marco.:true` anywhere) -> 606      NEG control (`zzzNoSuchTokenZzz`) -> 0

The probe is calibrated, so #1544's zero is a real absence of a watcher verdict, not a broken
query. Per DOCTRINE 10.1 that absence proves nothing about its risk, so it is hand-classified:
`fix/agent-defs-double-encoded` touches `.claude/agents/**` and `scripts/pipeline/**`, both
outside `^(tests|docs)/`, therefore **MARCO'S**. `[NO LANE VERDICT - hand-classified]`

**Label read is instrument-sound.** The same `gh pr view N --json labels | ConvertFrom-Json`
call form returned `do-not-merge` on #1536 and `[]` on the other three in one loop, so the
empties are true empties and not the LL-47 broken-query-reads-as-no-labels failure. [MEASURED]

**Queue and machinery.** armed (`*-ready.md`): **0**. in-progress prompts: 0. git processes: 0.
`index.lock` interactive/clone: False / False. watcher node RUNNING pid **24744**, wrapper
alive (1), heartbeat 47 min (ticks only mid-run; stale + empty queue = idle, NOT wedged).
main CI on `6b30ada1`: 4 success / 0 failed. [MEASURED]

**Dev tree index is clean.** `git diff --cached --name-only` -> count **0**, so this run's
commit carries nothing another chat staged. [MEASURED]

**Freshness, crossed against `lastRunAt` - the detector is wrong about BOTH daily stations.**

`node scripts/pipeline/check-breadcrumb.mjs --freshness` -> exit **2**: [MEASURED]

```
00  last 2026-09-03T16:09:00Z   1.0h ago  (cadence 2h)   ok
03  last 2026-09-01T23:02:00Z  42.1h ago  (cadence 24h)  ok
04  last 2026-09-03T10:10:00Z   7.0h ago  (cadence 4h)   ok
05  last 2026-09-01T14:11:00Z  51.0h ago  (cadence 24h)  SILENT
```

`list_scheduled_tasks` (scheduled-tasks MCP), same minute: [MEASURED]

| station | `lastRunAt` | newest breadcrumb | table row | detector said |
|---|---|---|---|---|
| 03 | 2026-09-01T23:01:43Z | 2026-09-01T23:02Z | aligned, but **>1 cadence stale** = occurrence never fired | `ok` |
| 04 | 2026-09-03T**14:10:20**Z | 2026-09-03T10:10Z | **fresh, no breadcrumb** = started and died | `ok` |
| 05 | 2026-09-03T**14:11:26**Z | 2026-09-01T14:11Z | **fresh, no breadcrumb** = started and died | `SILENT` |

**Cause READ FROM THE TRANSCRIPTS, not inferred** (`list_sessions` -> `read_transcript`):
session `local_f5f47c05` "04 scanner" and session `local_57274869` "05 sot keeper" each contain
exactly one user turn (the bootstrap) and one assistant turn:

    API Error: 529 Overloaded. This is a server-side issue, usually temporary...

Zero instructions ran in either. [MEASURED] So **05 is NOT a stopped station** - it ran three
hours ago and died - and **04's `ok` is not an all-clear** - it silently lost its 14:00Z
occurrence. Reporting 05 as stopped would be the §7 false alarm that licenses destructive action.

## WHAT CHANGED

Nothing on the board. No arm, no merge, no label, no queue mutation, no watcher action.
`origin/main` is still `6b30ada1` at the end of this run as it was at the start.

Two file moves, both housekeeping, both in this run's PR:

- this breadcrumb, added at `docs/pr-prompts/`
- `00-00-supervisor-2026-09-03-1509-*.md` `git mv`d to `docs/pr-prompts/archive/`, its findings
  having been dispositioned by the 16:09Z run. Safe for freshness: `check-breadcrumb.mjs` builds
  `trackedSet` with `git ls-tree -r` and matches by **basename** (`:98`, `:162`), so an archived
  breadcrumb still counts and cannot make a station read SILENT.

## FINDINGS

### F1. NEW. Stations 04 and 05 are scheduled 66 seconds apart EVERY DAY, by construction - so one transient upstream error takes out both cadences at once. That is what happened today.

Today's two losses have been recorded as two independent 529s. They are not independent: they
are one outage hitting a **standing collision** in the schedule. The cron expressions plus each
task's fixed jitter offset put the two stations in the same minute, deterministically, daily.

`list_scheduled_tasks`, arithmetic checked both ways: [MEASURED]

| | 04-scanner | 05-sot-keeper |
|---|---|---|
| `cronExpression` | `0 */4 * * *` | `10 0 * * *` |
| local base (Brisbane, UTC+10) | 04:00 / 08:00 / **00:00** / ... | 00:10 |
| `jitterSeconds` | **571** | **37** |
| fires at | base + 571s | base + 37s |
| `nextRunAt` | 2026-09-03T**18:09:31**Z = 18:00:00Z + 571s | 2026-09-04T**14:10:37**Z = 14:10:00Z + 37s |
| `lastRunAt` today | 2026-09-03T**14:10:20**Z | 2026-09-03T**14:11:26**Z |

The jitter is a **fixed per-task offset, not a random one** - `nextRunAt` equals base + jitter to
the second in both rows, which is the arithmetic that makes this a standing property rather than
a coincidence. 04's 14:00Z slot lands at 14:09:31Z and 05's daily run at 14:10:37Z: **66 seconds
apart, and it recurs at the same two timestamps tomorrow.** Today's actual runs were 66.05 s
apart. Both died on the same error.

**Why it matters more than the individual 529s.** The blast radius of any one-minute upstream
outage is currently TWO stations, and one of them is a **daily** station, so a single bad minute
costs 24 h of `/sot/` coverage plus 4 h of scanning. `/sot/` has now been unkept since
2026-09-01T14:11Z. Nothing retries, and escalation #23 already establishes that neither the
freshness detector nor `lastRunAt` can see the loss.

This is a **contributing cause that has not been named** in `needs-marco/station-freshness-
detector-cannot-see-a-missed-run-2026-09-03.md`, which is about the DETECTOR. This finding is
about the SCHEDULE, and it is fixable independently of the detector: separating the two stations
costs nothing and removes the correlation whatever the detector eventually does.

**RULE 1 options** (complete-and-additive first):

- **(a) Stagger 05 away from every 04 slot, AND add a retry.** Move 05's cron off the 00:xx local
  hour (e.g. `40 2 * * *` = 16:40Z, which no 04 slot touches at any jitter), and separately give
  the stations a retry on a turn-one API error. **Complete** - removes the correlation now and
  survives a future 529 on either station. **Additive** - a schedule offset and a retry damage no
  data and change no station's behaviour. Passes both halves of RULE 1.
- **(b) Stagger only.** Cheap, one config change, kills the correlation. **Fails "complete"**: a
  529 in 05's new minute still eats its whole day silently.
- **(c) Retry only.** **Fails "complete"** for the same reason from the other side - a long
  outage spanning the retry window still takes both, because both are still in that window.
- **(d) Do nothing.** Fails both halves; today is the measured cost.

**DISPOSITION: ESCALATED.** Rewriting the cron of Marco's standing scheduled tasks is persistent
configuration, and RULE 3 makes it his call - I will not silently re-time his stations. The
measurement above is the whole decision; (a) needs one word from him.

### F2. The board cannot move without Marco. All four open PRs are his, and #1536's entire red is one label.

Re-measured this run, not carried: #1543, #1541 and #1536 each carry a genuine `marco:true`
watcher verdict; #1544 carries none and hand-classifies to Marco on file paths. #1536's two red
checks remain CP-26 `[LABEL_PRESENT] do-not-merge` and the `PR gates - diff checks` job it drags
down with it - every other gate (CP-11/12/13/17/22/23/24/25) passes, so there is no code defect
to fix. Removing that label is the whole of the fix and only Marco may remove it.

No agent may author `merge-approvals/1536.md` or any approval file, and removing `do-not-merge`
does not clear RULE 2 in any case.

**DISPOSITION: ESCALATED** - already open with Marco; restated here because it is unchanged and
it is the answer to "what is blocking the board".

### F3. 03 has still not run since 2026-09-01T23:01:43Z. Its next occurrence is tonight.

`lastRunAt` is a full cadence stale while `--freshness` prints `ok` - the missed 09-02T23:00Z
occurrence, already escalated as #23. `nextRunAt` 2026-09-03T23:00:45Z, about 6 h out. The work
waiting for it is unchanged and non-urgent: 3 orphaned worktrees (`C:/po-1483-fix`,
`C:/po-sa-fix`, `C:/po-work/s2-e2e`) and 2 registry escapees
(`C:\po-worktrees\fix-1523`, `C:\po-worktrees\vs-s2-durable-smoke`), **all `dirty=0`**. [MEASURED]

**DISPOSITION: DEFERRED.** Nothing is at risk from a clean orphaned worktree, and pruning them is
03's lane, not mine (LL-38). It becomes urgent if 03 also misses tonight's 23:00Z occurrence -
that would be two consecutive misses and a genuinely stopped station rather than one lost run.

### F4. `armed: 0` was deliberate again this run, and arming a docs prompt right now would manufacture Marco backlog rather than reduce it.

The `tests-docs` auto-merge lane is deadlocked (escalation #21, four open causes). While it is
deadlocked, a docs-only PR that misses the 90-minute `MERGE_TIMEOUT_MS` window records
`{"ok":false,"marco":true,...}` **byte-identically to a genuine policy routing**, so it becomes
permanently human-gated and RULE 2 correctly forbids any station from clearing it. With four PRs
already waiting on Marco, arming a fifth docs prompt has a live chance of adding a fifth.

**DISPOSITION: DEFERRED** until #21 is resolved. What would make it urgent: the queue is not
starved - 0 armed with 4 open PRs is a healthy board that is waiting on a human, not a stalled one.

## WHAT I DID NOT DO

- **Merged nothing.** All four open PRs are Marco's - three by watcher verdict, one by hand
  classification. RULE 2 bars every one.
- **Removed no label**, and authored no approval file for #1536.
- **Armed nothing** (F4).
- **Did not re-time 04 or 05** despite having the scheduled-tasks MCP write available. F1 is a
  persistent-configuration change to Marco's standing tasks; RULE 3 makes it his.
- **Did not prune the 3 orphaned worktrees or 2 registry escapees** - 03's lane, all `dirty=0`,
  nothing at risk (F3).
- **Did not touch the watcher.** pid 24744 running, wrapper alive, 0 armed: an idle watcher with
  an empty queue is CORRECT, not wedged. No restart, no `-Fix`.
- **Did not report the console mojibake in the sweep's section C as file corruption.** DOCTRINE
  §9.3: `Get-Content` reports false mojibake through the console encoding. I did not decode the
  bytes, so I make no claim either way - it is not a finding.
- **Did not clear the 19 `[STALE]` cross-check lines** the sweep printed. They are gitignored
  `needs-marco/` files; clearing them is real work but it is not this run's highest leverage and
  it needs the file-by-file read the sweep explicitly says a `[STALE]` line does not substitute for.
