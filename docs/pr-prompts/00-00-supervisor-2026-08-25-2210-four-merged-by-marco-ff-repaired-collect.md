# Station 00 — Supervisor | 2026-08-25T22:08Z–2026-08-25T22:17Z

## GROUND

```
UTC            2026-08-25T22:08:44Z   (start)  — env said "2026-08-26"; real UTC is 08-25. AEST+10 trap, caught again.
origin/main    70b1c7f5 at 22:08Z  ->  8f0377e5 at 22:11Z   (it MOVED mid-run; see F1)
dev tree       main @ b968e4f1  ->  main @ 8f0377e5   C:\ProjectOperations2  (fast-forwarded this run, F4)
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. Not blind: Desktop Commander reached the box on the first call
(`BOX-OK 2026-08-25T22:08:44Z`), full read **and** write coverage.

## WHAT I MEASURED

**Board — 8 open at my last run, 4 open now.** [MEASURED]
`gh pr list --state open --json ... ` written with `cmd /c` (PS `>` writes UTF-16 and node refused it —
§9.1 hit live), parsed with `node -e`:

```
OPEN=4
1325 | UNKNOWN | labels=[do-not-merge] | docs/sot-04-bp0a-job-canonical
1323 | BEHIND  | labels=[do-not-merge] | feat/arm-prompt-serializer
1320 | UNKNOWN | labels=[]             | worktree-agent-ae6eefd9604700b45
1316 | UNKNOWN | labels=[]             | feat/ew-2a-capacity-service
```

**Four merged in the last hour, by a human clearing the gate.** [MEASURED] `gh pr list --state merged`:
`#1322 21:18:30Z · #1319 21:32:18Z · #1317 21:50:28Z · #1321 22:10:19Z`. #1319 and #1321 both carried
`do-not-merge` at my 20:10Z run; **only Marco removes that label**, so this is Marco working the queue.

**All FOUR remaining open PRs are Marco-gated (RULE 2).** [MEASURED] grep of
`scripts/pr-watcher/logs/2026-08-24.log`, control `[merge]` lines = 52 so the instrument is not blind:

| PR | routing line |
|---|---|
| #1316 | `stays for Marco (outside tests/ or docs/: apps/api/jest.config.ts)` |
| #1320 | `stays for Marco (outside tests/ or docs/: apps/web/src/App.tsx)` |
| #1323 | `stays for Marco (escalates:true - held for Marco, labelled do-not-merge)` |
| #1325 | `stays for Marco (escalates:true - held for Marco, labelled do-not-merge)` |

**I merged nothing. There was nothing I was permitted to merge.**

**Watcher LIVE.** [MEASURED] `.queue-state.json` `ts=2026-08-25T22:08:07.381Z` (23 s before my first probe),
and a clean fixed-interval GAP series in the live log — `verdict-archive sweep` at 21:38:08, 21:43:07,
21:48:08, 21:53:08, 21:58:07, 22:03:07, 22:08:07 — **six consecutive gaps, all 5 m 00 s ±1 s.** It also
did real work at 21:54, updating five BEHIND branches after the merges.

**ARMED = 0**, agreed by two independent probes: depth-1 glob `docs\pr-prompts\*-ready.md` = 0, and
`.queue-state.json` `armed=0 lane=""`. [MEASURED]

**Shared index CLEAN** — `git diff --cached --name-status` empty at start and at end. **No R100 orphan
this cycle** (there was one on each of the last three runs; nothing armed since, which is consistent).

**#1323's three reds, root-caused from the JOB LOGS, not the diff.** [MEASURED]
- `PR gates` — the job printed **PASS on CP-11, 12, 13, 17, 22, 23, 24, 25** and exactly one failure:
  `FAIL - CP-26 do-not-merge [PR carries the do-not-merge label ... removing it is what releases the merge.]`
  **That is the gate, not a defect.** Confirms the 20:10Z finding; do not spend a run "fixing" it.
- `Analyze (javascript-typescript)` and `tendering-e2e` — **GitHub Actions infrastructure**, not code:
  `Failed to download action 'github/codeql-action@v4'` / `'pnpm/action-setup@v4.0.0'` —
  `Error: Name or service not known (internal-api.service.iad.github.net:443)`, three attempts each,
  between 21:54:24Z and 21:55:24Z. A DNS outage inside GitHub's own action-download path. Nothing in
  #1323's diff can cause it; blast radius is any job that started in that window.

**#1316 and #1320 are fully green** (12 checks, 0 not-green) and **#1325's only red is CP-26.** [MEASURED]
All four are BEHIND again because #1321 landed at 22:10Z; the watcher updates BEHIND branches itself.

**Station 03 is NOT silent — the instrument is wrong.** [MEASURED] `list_scheduled_tasks`:
`03-machine-minder` cron `0 9 * * *` = **DAILY**, `lastRunAt 2026-08-24T23:00:51Z`,
`nextRunAt 2026-08-25T23:00:45Z` — it ran exactly on schedule and is due in 45 minutes.
`check-breadcrumb.mjs` carries `CADENCE['03'] = 4`. Wrong by 6×. Third run in a row this fires.

**Station 04 is running CONCURRENTLY with me** — `04-scanner lastRunAt 2026-08-25T22:09:59Z`. [MEASURED]
Read-only by charter, so not a collision risk, but its breadcrumb will land after this one.

## COLLECT — breadcrumbs since my 20:10Z run

Two, and one of them landed **while this run was in progress**.

**`00-06-pr-master-2026-08-25-2209-...`** — Station 06, interactive, invoked by Marco at 22:09:39Z.
This is the concurrent actor F1 detected. Its measurements were taken independently of mine and
**agree on every overlapping claim**: 4 open, all four watcher-routed to Marco with a control
(1475 `[merge]` lines / 645 `stays for Marco` hits), `ARMED = 0`, index clean, `#1323`'s `PR gates`
red is CP-26 only, and its CodeQL + e2e reds share one GitHub action-download signature. Two
independent stations, two different controls, same answer. Its dispositions:

- **06 F3 — two chain gates opened today**: `formatWinRate` is on main (2 hits in `AccountDetailPage.tsx`)
  and `tenderWinCounted` is on main (`schema.prisma`, landed with #1321), so
  `pr-crm-tender-count-truth-HOLD.md` and `pr-crm-wincount-s2-close-bypasses-HOLD.md` are **armable
  right now**. 06 deferred; arming is my lane. **DISPOSITION: DEFERRED — same trigger as F5.** The
  gates being open is a *permission* to arm, not a reason to; the reason not to is that both PRs would
  route to Marco on top of four already waiting.
- **06 F5 — dev tree 5 behind, "must be fast-forwarded BEFORE anything is armed"**.
  **DISPOSITION: ACTIONED this run** — F4 below. 06's hard precondition for the next arm is now met.
- **06 F1 — three review defects in `#1323`** carried over from the outgoing chat, not re-verified by
  06 and not by me: unchecked `git mv` rollback at `:317` followed by `exit 3`; the PID is never
  readable because the lock is `FileShare::None`, with `ARMING.md:36` enshrining the false claim; the
  test harness silently falling back to the live shared repo. **DISPOSITION: ESCALATED** — folded into
  F6(a). They carry no SHA from either of us, so per §7.1 they are **leads, not findings**, and the
  right next step is Marco choosing fix-forward vs re-prompt, not a station re-litigating them.
- **06 F2 — Marco lifted RULE 2 for the 2026-08-25 batch explicitly.** That is what the four merges
  were. **06 is right that the permission does not carry forward**, and I did not treat it as standing.
- **06 F4 — 35 untracked breadcrumbs.** Same escalation as my F6(b), fourth consecutive run.
  **DISPOSITION: ESCALATED** (merged into F6(b); deliberately not re-argued).

**One correction to hand back to 06.** Its `[CANNOT MEASURE]` on the station schedule was caused by a
retired tool name: `list_triggers` no longer exists — the tool is **`list_scheduled_tasks`, and it DOES
return the device tasks.** It listed all five (`00`, `03`, `04`, `05`, and the disabled weekly audit)
with crons, `lastRunAt` and `nextRunAt`. That is how F3 below settles the 03 cadence question 06 could
not answer. This is the second time this month a station reported blindness that was really a stale
tool name.

**`00-05-sot-keeper-2026-08-25-1411-...`** — collected at 16:10Z, merged in #1324. Its central claim
(`--check` is not a drift gate) is unchanged. Its ask "arm the bp0a reconcile" was ACTIONED at 16:10Z
and is now `#1325`, open and gated.

## WHAT CHANGED

1. **Re-ran #1323's `tendering-e2e`** (`gh run rerun 32903461057 --failed`, exit 0). Read back 20 s later:
   `status=in_progress`. Its CodeQL run refused re-run (`This workflow run cannot be retried`) — that one
   re-fires on the next branch update, which the watcher does automatically while the PR is BEHIND.
2. **Fast-forwarded the dev tree** `b968e4f1 -> 8f0377e5` (F4). Read back: `behind=0`, `ARMED=0` unchanged,
   staged index still empty, no `-ready.md` created.
3. Nothing else. **I armed nothing** (F5) and **I merged nothing** (nothing was eligible).

## FINDINGS

### F1 — `status-sweep.ps1` printed SAFE TO ACT 61 seconds before a merge landed

`SWEEP COMPLETE 2026-08-25 22:09:18Z` with `[LIVE] SAFE TO ACT: no board mutation in progress, no recent
remote activity.` **#1321 merged at 22:10:19Z** and `origin/main` moved `70b1c7f5 -> 8f0377e5` between my
22:08Z and 22:11Z `rev-parse`. [MEASURED, both timestamps from the tools themselves]

This is the standing "SAFE TO ACT is blind to a concurrent fast-forward" shape, now caught **in the act**
rather than inferred. The verdict is not wrong, it is *perishable* — and its shelf life here was one
minute. Any station that reads SAFE TO ACT and then does five minutes of work before mutating is acting
on an expired reading.

**DISPOSITION: DEFERRED** — the sweep is not lying, it is a snapshot, and the station contract already
says re-measure immediately before acting. It becomes urgent if a station is ever caught mutating on a
sweep older than ~60 s; the durable fix is for the sweep to print an explicit expiry.

### F2 — `check-breadcrumb.mjs --freshness` reads the WORKING TREE, so a merged breadcrumb goes INVISIBLE

**Proven causal this run.** [MEASURED, positive control both sides]

Before the fast-forward, with the dev tree 5 commits behind main:

```
05  last 2026-08-24T14:15:00Z  31.9h ago  (cadence 24h)  ok
structure: 14 checked
```

After the fast-forward, same command, same file:

```
05  last 2026-08-25T14:11:00Z   8.1h ago  (cadence 24h)  ok
structure: 16 checked
```

**The instrument was 24 hours wrong about Station 05.** The breadcrumb
`00-05-sot-keeper-2026-08-25-1411-sot04-remerged-check-is-not-a-drift-gate.md` was on `origin/main`
(it landed in #1324 at 16:13Z) and **absent from the dev tree working directory**. Independently
corroborated by the scheduler: `05-sot-keeper lastRunAt 2026-08-25T14:10:50Z`.

This is the exact mirror of the known untracked-breadcrumb problem, and it is worse, because it is
silent in the other direction: a breadcrumb that **succeeds** at getting committed **disappears** from
00's COLLECT view until someone fast-forwards the dev tree. A station could be falsely declared SILENT
purely as a function of how stale the tree happens to be.

**DISPOSITION: ACTIONED** — dev tree fast-forwarded (F4), instrument re-run, verdict corrected. The
durable fix (read the breadcrumb set from `origin/main`, not the worktree) is a code change I cannot PR;
it is folded into the ask in F6.

### F3 — `CADENCE['03'] = 4` is wrong; every "03 SILENT" verdict since is a false positive

`check-breadcrumb.mjs` treats 03 as 4-hourly. The scheduler says `0 9 * * *` — **daily**, next fire
`2026-08-25T23:00:45Z`. [MEASURED, `list_scheduled_tasks`] 03 ran on time at `2026-08-24T23:00:51Z`.

`--freshness` still exits **2** on that basis, which means the COLLECT step's own exit code is
untrustworthy: a real silence and this false one are indistinguishable to a caller checking the code.

**DISPOSITION: ESCALATED** (see F6) — one-line map change in a file no scheduled station may PR.
**Do not carry "03 silent" into any brief.** It has now been refuted three runs running.

### F4 — Dev tree was 5 commits behind main; every worktree-reading instrument was reading stale

`git rev-list --count HEAD..origin/main` = 4 at 22:08Z, 5 at 22:11Z. `check-breadcrumb`, `lint-prompt`
and every prompt premise read this tree.

Fast-forwarded under the documented safety criterion, with the checks run first, not after:
- **dirty ∩ incoming = 1 file**, `docs/data-model/metadata-catalog.json` — and its local change is
  **empty**: `git diff --numstat` returned nothing but the `LF will be replaced by CRLF` warning, while
  `git diff --numstat HEAD origin/main` returned `6 0`. Stat-dirt, not content. Restored that ONE named
  file (`git checkout HEAD -- <path>` — a single explicit file, never a directory, never `reset --hard`).
- **Incoming `-ready.md` at depth 1 = 0**, control `docs/pr-prompts/*` incoming = 1. The fast-forward
  therefore **could not arm anything** — this was checked BEFORE the merge, not asserted after.
- Result `FF_RC=0`, `b968e4f1..8f0377e5`, read back `behind=0 · ARMED=0 · staged=0`.

**DISPOSITION: ACTIONED.**

### F5 — Armed nothing, on purpose, and the resume trigger is now sharper

RULE 1, both halves:
- **Complete?** No. **Every tracked HOLD I could arm produces a PR that routes to Marco.** There is no
  tracked HOLD whose PR would be docs-only, so nothing I arm can reach `main` without him. Arming adds
  to the queue at the exact point where it is already backed up.
- **Without damaging existing/future data entry?** No. Every arm to date has left an orphaned `R100`
  rename in the **shared** dev-tree index (drained three times in the last three runs). **#1323 is the
  fix for precisely that, and it is CP-26-held.** Arming now knowingly re-creates the hazard its own fix
  is waiting on.
- And a concurrent actor mutated the board **during this run** (F1), with Station 04 also live. LL-38 is
  explicit: when something else is acting, stop.

Superseding my 20:10Z trigger ("open < 4 OR #1323 merges"), which was ambiguous at exactly 4:

> **Resume arming when `#1323` has merged, OR when Marco-gated open PRs ≤ 2 — AND no commit has landed
> on `origin/main` in the preceding 10 minutes.**

**DISPOSITION: DEFERRED** — with a stated, checkable trigger, not an open end.

### F6 — For Marco: three asks, one of them repeating for the fourth time

**(a) The four gated PRs.** `#1316` and `#1320` are **fully green** — 12 checks, 0 red — and carry **no
label**; they are held only by the watcher's `tests-docs` routing (`apps/api/jest.config.ts` and
`apps/web/src/App.tsx` respectively). `#1325`'s only red is CP-26. `#1323`'s only *real* red is CP-26 too;
its other two were a GitHub DNS outage and one is already re-running. **All four are one human decision
away from merging.** `#1325` additionally blocks the whole bp0a chain — no downstream slice can even be
authored until it lands.

**(b) Who commits station output — fourth time asked.** 30+ breadcrumbs sit untracked on disk, including
this one. `check-breadcrumb` flags each with `is UNTRACKED — it reaches nobody until a board PR commits
it`. No scheduled station may open a PR, so the loop cannot close from inside. **RULE 1 options:**
1. *(complete + additive)* Give Station 00 authority to open a **docs-only** PR containing nothing but
   `docs/pr-prompts/00-*.md`. Closes it permanently, adds a channel, removes none. Passes both halves.
2. *(fails "future")* Have Marco periodically commit them by hand — works now, silently re-breaks the
   moment he is busy, which is the failure mode we already have.
3. *(fails "complete")* Let them stay untracked and treat project memory as the only channel — memory is
   working, but a breadcrumb nobody can `git log` is not a report.

**(c) Two one-line instrument fixes to `scripts/pipeline/check-breadcrumb.mjs`**, both proven causal
above and both needing a PR I cannot open: `CADENCE['03'] = 24` (F3), and read the breadcrumb set from
`origin/main` rather than the worktree (F2). Until then its exit code cannot be trusted by a caller.

**DISPOSITION: ESCALATED.**

## WHAT I DID NOT DO

- **Did not merge anything.** All four open PRs are watcher-routed to Marco, measured per-PR against a
  52-line control. Not overridden by green, by an absent label, or by CP-26 being the only red.
- **Did not remove a `do-not-merge` label**, and did not treat CP-26 red as a defect to drive green.
- **Did not arm** — F5, with a stated resume trigger.
- **Did not restart or touch the watcher.** It is live on a six-gap 5-minute series and actively updating
  branches; there was nothing to fix.
- **Did not run `git` in `C:\po-watcher\ProjectOperations`** beyond read-only `gh` / `git` queries.
- **Did not chase #1323's CodeQL red** past establishing it was infrastructure — the branch is BEHIND and
  the watcher's next update re-fires it. Re-running by hand was refused by GitHub anyway.
- **Did not fast-forward the watcher CLONE.** That requires stopping the watcher, and the watcher is
  healthy, idle, and mid-cycle — 03's lane, and not worth an outage with nothing armed.

---
*Breadcrumb is UNTRACKED until a board PR commits it — see F6(b).*
