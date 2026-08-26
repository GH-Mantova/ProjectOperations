# Station 00 - Supervisor | 2026-08-24T04:08-04:30Z

`origin/main` = `81e8168a`. Watcher pid 28308 -> KILLED 04:12:43Z -> relaunched pid **38308** @ 04:23:40Z, alive.

## 🔴 THE FINDING - arming into a stale heartbeat kills the watcher in ~30 seconds

I armed `pr-watchdog-heartbeat-during-merge-wait-HOLD.md` at **04:12:13Z** (armed 0 -> 1, all gates
verified). The watcher queued it at 04:12:14.818Z and started it at 04:12:15.009Z - **1 second**.
**28 seconds later the watchdog killed it.** [MEASURED]

```
[2026-08-24T14:23:33.8599277+10:00] Watcher exited via watchdog kill (exit 1). Heartbeat was stale;
  relaunching. Flag: [2026-08-24T14:12:43.1174277+10:00] pid=28308 armed=1 runnable=1 ageMin=69
```

**`ageMin=69`.** The heartbeat file's last tick was `03:03:26Z` (the `rev-1302` review job). The
watchdog measures staleness from the **last heartbeat WRITE**, not from when the current job started,
and the first tick of a new run is at **elapsed=60s**. So the kill condition
(`stale > 15 min` AND `armed > 0` AND `runnable > 0` AND `0 in-progress`) was **already true the
instant `armed` went 0 -> 1**, and the watchdog polls well inside 60 s.

**Consequence, and it is unconditional:** after any idle period longer than `wdHungMin = 15`, the
FIRST prompt armed kills the watcher before its own heartbeat can rescue it. This is a **superset**
of the merge-wait defect `pr-watchdog-heartbeat-during-merge-wait` describes - that one needs a
merge-wait; this one needs only an idle watcher.

**RE-MEASURED 04:25:29Z: a relaunch does NOT refresh the heartbeat file** - mtime still `03:03:26Z`,
age 82.1 min. **The trap is LIVE right now.** The next arming, by anyone, kills the watcher again.

## What I did

- **ARMED** `pr-watchdog-heartbeat-during-merge-wait` 04:12:13Z. Gates checked first: lint ADMIT ·
  premise TRUE (`MERGE_WAIT_HEARTBEAT` 0 occurrences on `origin/main`, positive control
  `startHeartbeat` = 2) · body read for `<!-- watcher: do-not-arm -->` / `DO NOT ARM` /
  `docs/approvals/` = all False · no `requires_` gate · claim-grep clean · **overlap check vs open
  #1302 = 0 mentions of the merge-wait fns or the heartbeat in its 247-line diff**.
- **DISARMED** 04:24:16Z (`git mv` ready -> HOLD, armed 1 -> 0, HOLD restored, index clean) to break
  the crash loop before the relaunched watcher could be killed a second time. The churn guard trips
  at 4 kills in 20 min.
- **DID NOT** touch the `STOP-WATCHER-LANE2` sentinel, `wdHungMin`, or the launcher.

## 🟢 The killed run still shipped - PR #1304

The **agent process outlived the watcher node** and finished the job:
**#1304 `fix(pr-watcher): keep heartbeat ticking during merge-wait...`**, opened 04:23:05Z,
3 files (`index.mjs` +208/-166, `supervise-watcher.ps1` +1/-1, new 231-line spec), no labels,
`MERGEABLE`, CP gates + "Pipeline - watcher + linter tests" **pass**, rest pending.

⚠️ **The watcher died before writing a `[merge]` routing line for it**, so #1304 is **orphaned from
the merge pipeline** - nothing will auto-merge it and nothing routed it. It touches `scripts/`
(outside `tests/` or `docs/`), the same rule that routed #1302 to Marco. **Treated as Marco's.**

🔴 **DO NOT RE-ARM `pr-watchdog-heartbeat-during-merge-wait-HOLD.md`.** Its work is done and sitting
in #1304; re-arming opens a duplicate. Its premise dies naturally when #1304 merges.

## Board [MEASURED 04:25:56Z]

- Open PRs: **#1302** CLEAN, green, watcher-routed to Marco 02:57:50Z (RULE 2 - not mine) ·
  **#1304** BLOCKED-on-pending-checks, unrouted, Marco's.
- **Nothing was mergeable by me. That is a correct outcome, not a stall.**
- armed **0** · in-progress 0 · index.lock absent both trees · watcher clone dirty=35 (blocked nothing).

## Escalations for Marco

1. **Merge #1302** (green, clean, unlabelled) and **#1304 when green**. #1304 is the fix for the
   self-kill; until it is on main and the clone is fast-forwarded, every arming after 15 min idle
   kills the watcher.
2. **`PO Watcher Keepalive` still does not exist** - 0 of **207** scheduled tasks match
   `watcher`/`Keepalive` (control: 169 contain `a`); `C:\po-watcher\ensure-watcher.log` absent.
   Five deaths in four days. The launcher did relaunch this time, but took **10m 50s**.
3. **Interim mitigation, Marco's call:** set `PR_WATCHER_HUNG_MIN` above the idle gap, or have the
   watcher stamp the heartbeat once at job start rather than at elapsed=60s. Both are changes to the
   running watcher, so they are his.

## Dispositions of prior findings

- 03 machine-minder `0123-GREEN-watcher-live-no-restarter` - **ESCALATED** (item 2, unchanged).
- 04 scanner `0210-surfacing-fixed-lint-blind-to-every-human-gate` - **ACTIONED**: I read the body
  for all three human gates before arming, exactly as it says. Lint ADMIT was not treated as
  sufficient.
- 05 sot-keeper `0110-nav5-group7-now-stale` - **DEFERRED**, condition: a sot-keeper run that
  re-copies group 7 from main before arming the nav5 reconcile.
- 00 supervisor `0305` deferred item, `pr-nopr-s1`/`s2` tracked as `-HOLD.md` on main but consumed
  into `processed/` - **still DEFERRED**, condition: #1302 merges.
- Backlog: `rates-11c-blocked-consumers` READY-to-stage - **DEFERRED** to Station 06 (the supervisor
  does not create PRs, LL-38). `map-locations-waste-rate-coupling` - **ESCALATED**, still Marco's.
- Sweep `[STALE]` rows (HANDOVER-2026-08-14 #1134, subbie-rate-cards #212, watcher-crash-loop #1158
  and #727 - all MERGED) - **left alone**, clearing them is a queue-hygiene PR, not mine mid-incident.

## Instrument lie recorded

`Get-ChildItem 'C:\po-watcher' -Filter 'STOP*' -Recurse` returned **200+ hits from `node_modules`**
(`stop-iteration-iterator`, `stop_early.js`) and buried the one real sentinel. Anchor the pattern or
exclude `node_modules` - a recursive filename glob over a repo root is not a search.
