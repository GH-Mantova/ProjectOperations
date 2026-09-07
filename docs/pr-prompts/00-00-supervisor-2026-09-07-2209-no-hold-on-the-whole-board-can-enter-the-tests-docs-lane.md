# Station 00 — Supervisor | 2026-09-07T22:09Z–2026-09-07T22:3xZ

## GROUND

```
UTC            2026-09-07T22:09:11Z
origin/main    0eca4c55            (fetched, then rev-parse)
dev tree       main @ 0eca4c55  C:\ProjectOperations2
doc version    1
bootstrap      1
```

Doc version and bootstrap AGREE. **Sighted run** — `ToolSearch` loaded the Desktop Commander
schemas first, then `start_process` opened a persistent `powershell.exe` REPL on the Windows host
at the first attempt, and that shell served the whole run.

All three binding documents were read after the fetch, and
`git diff --numstat origin/main -- <path>` was EMPTY for all three of
`docs/pipeline/stations/00-supervisor.md`, `docs/pipeline/DOCTRINE.md` and
`docs/pipeline/STATION-CAPABILITIES.md` — so the working copies are byte-identical to
`origin/main` (PREFLIGHT step 2, and the no-piped-hash rule).

vm-git-guard installer last line, quoted:
`persistence controls passed: .bashrc byte-identical on re-run; login shell resolves shim`

## WHAT I MEASURED

- [MEASURED] The dev tree needed **no fast-forward**: `git rev-list --left-right --count
  HEAD...origin/main` -> `0  0` at the top of the run, with `git diff --numstat` and
  `git diff --cached --name-status` both EMPTY. `docs/pipeline/sweep-rotation.json` was clean.
  Something outside this run had already advanced it past `#1792`.
- [MEASURED] `status-sweep.ps1` captured to a file (it returns early and hides its own section 7),
  exit 0, generated `22:09:50Z`. Section 0 instrument controls both PASS. Section 7 verdict:
  `SAFE TO ACT: no board mutation in progress, no recent remote activity, no live station
  worktrees.` The capture file was deleted from the dev tree root afterwards.
- [MEASURED] Board: **2 open PRs, unchanged from the 21:12Z run, both carrying `do-not-merge`.**
  `#1775` TIP-ID-S2 (`08:57:26Z`) and `#1767` TR-1 (`06:43:58Z`), each `BLOCKED`, each
  13 pass / 2 fail. `main` CI on `0eca4c55`: 4 success / 0 failed (trunk green).
- [MEASURED] RULE 2 probe, pinned to the LIVE tree `C:\ProjectOperations2\docs\pr-prompts\processed`
  and never the clone: **2059** logs, newest `2026-09-07T20:25:33Z` — younger than the oldest open
  PR's `createdAt`, which is the age control that separates the live directory from the decoy.
  POSITIVE `marco.:true` -> **620**. NEGATIVE, a needle minted this run -> 0. Matching `PR #<n>` in
  the BODY of `pr-*.log`: `#1775` -> 0, `#1767` -> 0, NEGATIVE control `PR #999999` -> 0. Both read
  `NO LOG`, so both are `[NO LANE VERDICT — hand-classified]`, and both hand-classify to **MARCO'S**
  on the same grounds the 21:12Z run measured (a `migrations/` path on `#1767`, `apps/api` and
  `scripts/` on `#1775`). **MERGE NONE.**
- [MEASURED] **Zero of the 43 HOLDs on the board is tests-or-docs only** — not zero of the 15
  gate-satisfied ones, which is what earlier runs measured, but zero of the whole board. Each
  prompt's `scope:` paths were tested against all three `NESTED_TEST_PATHS` forms, with four
  controls run first in the same process: `docs/pipeline/DOCTRINE.md` -> true,
  `apps/api/src/main.ts` -> false, `scripts/pipeline/__tests__/x.mjs` -> true,
  `apps/web/src/a.test.tsx` -> true — all four as expected, so the widened forms are live and the
  zero is a real absence rather than a broken classifier. Split of the 43:
  `tests-or-docs-only=0  gate_allow-migrations=12  other=31`.
- [MEASURED] `triage-holds.ps1`: `TOTALS spent=0 of 43 evaluated  gates-satisfied=15
  still-gated=28  unreadable=0`. GIT control PASS (read `origin/main:docs/pipeline/DOCTRINE.md`,
  128649 chars); SPENT fixture control PASS (lint exit 3 on the fixture), so the SPENT bucket is
  measurable and `spent=0` is an observation, not an instrument failure. The 28 REJECTs were
  re-probed directly: 0 spent behind a REJECT, 0 UNMEASURABLE.
- [MEASURED] Armed `*-ready.md` counted by hand -> **0**. HOLDs -> **43** (44 before the 21:12Z run
  retired the spent fix-lane prompt).
- [MEASURED] COLLECT: `check-breadcrumb.mjs --freshness` -> `CLEAN`, exit 0,
  `structure: 1 checked, 0 malformed`. Rows: 00 `21:12Z` 1.0h (cadence 2h) ok · 03 `2026-09-06T23:02Z`
  23.2h (24h) ok · 04 `18:10Z` 4.0h (4h) ok · 05 `14:12Z` 8.0h (24h) ok. Crossed against `lastRunAt`
  from the scheduled-tasks MCP: 03 `2026-09-06T23:01:13Z`, 05 `2026-09-07T14:11:15Z` — both aligned
  with their newest breadcrumb. **No station breadcrumb has been written since the 21:12Z run**, so
  the only thing to collect was that run's own four findings.
- [MEASURED] **Station 04 fired 98 seconds into this run.** `lastRunAt`: 00 `22:08:34.359Z`,
  04 `22:10:12.988Z`. 04's newest breadcrumb is still the `18:10` one, so its current run had not
  reported when I collected — its output is the next run's to collect, not this one's.
- [MEASURED] Watcher: node RUNNING pid **31660**, auto-restart wrapper alive (1), heartbeat age
  105 min. With 0 armed prompts an idle watcher and a stale heartbeat are CORRECT, not wedged.
  `git index.lock` False in both trees; 0 git processes; no PR touched in the last 2 min.
- [MEASURED] Watcher clone `C:\po-watcher\ProjectOperations`: `branch=main dirty=3`. `C:\po-vg`
  still orphaned, `age=5176 min`, holding 1 uncommitted file.

## WHAT CHANGED

- Archived the 21:12Z breadcrumb to `docs/pr-prompts/archive/` in this PR — every finding in it
  carries a disposition. `git ls-files --error-unmatch` -> exit 0 beforehand, so the `git mv` acted
  on a tracked file and stages as a rename.
- Deleted the `status-sweep` capture file this run wrote to the dev tree root. The tree is
  otherwise untouched.
- **Nothing armed. Nothing merged. No label touched. No receipt authored. No `[STALE]` line
  cleared by me.**

## FINDINGS

### F1 — The tests-docs lane has no supply anywhere on the board, not just among the ADMIT prompts

Earlier runs measured that none of the **15** gate-satisfied prompts is tests-or-docs only, which
leaves open the reading that supply exists but is gated. It does not. Measured this run over all
**43** HOLDs, with four classifier controls passing in the same process: **zero** qualify. Twelve
carry `gate_allow: migrations`; the other thirty-one reach `apps/api`, `apps/web`, `scripts/`,
`.github/workflows/` or `sot/` in their first non-test path.

So no amount of gate-clearing, and no re-arming, can put work into the auto-merge lane. The lane
can only be fed by a prompt written for it, and authoring one is Station 06's lane — which is the
escalation already open. This measurement narrows that escalation rather than adding to it: option
(a), give 06 a cron, is not merely the complete-and-additive option, it is the **only** one that
produces eligible supply.

**DISPOSITION: ESCALATED — already open, not duplicated.**
`docs/pr-prompts/needs-marco/station-06-has-no-cadence-and-owns-the-only-remedy-2026-09-07.md`
carries the options in RULE 1 order. This run adds the board-wide measurement to that cause and
**no new file**; a second escalation on one cause is noise.

### F2 — Eighth consecutive run in which nothing on the board can move without Marco

Both open PRs carry `do-not-merge`, which only Marco removes, and both independently hand-classify
to Marco under section 10.1. Nothing is armed. Nothing is spent. Of the 15 gate-satisfied prompts,
four are `gate_allow: migrations`, two duplicate an open PR
(`pr-tipid-s2-write-the-ids-backfill-and-admin-HOLD.md` against `#1775`,
`pr-tr-s1-reminder-policy-HOLD.md` against `#1767`) and must be neither armed nor retired while
that PR is open, and two are Station 05's `sot/` lane. Arming any of the remainder adds a PR to
Marco's queue rather than moving the board.

**DISPOSITION: DEFERRED.** It becomes urgent the moment either open PR's label is removed, or the
06-cadence escalation is answered. Neither is mine to trigger. Recorded so the eighth instance is
countable rather than re-derived; nothing here justifies arming to look busy.

### F3 — Station 04 started 98 seconds after this run, at a slot no earlier measurement covered

`lastRunAt` 00 `22:08:34Z` against 04 `22:10:12Z`. The two prior measurements of this collision
were both at 04:10 local, a day apart, which left open the reading that it was tied to a particular
hour. It is not — 00's cron is hourly and 04's is every four hours, so they collide at **every** 04
occurrence, exactly as `#1786` recorded. This instance is confirmatory evidence at a fresh slot.

No harm was done: 04 is a read-only audit station and the sweep's safe-to-act gate saw no live
station worktree, no git process and no index lock at the moment I acted. The hazard is the shared
dev-tree git index, and it was clean throughout.

**DISPOSITION: ESCALATED — already open, not duplicated.** The cron-offset escalation needs **two**
offsets from Marco, not one, and stands unchanged. Adding a third file for a third sighting of one
cause would bury it.

### F4 — The watcher clone is dirty and `C:\po-vg` is still orphaned, both already with 03

`branch=main dirty=3` in the clone; `C:\po-vg` has held 1 uncommitted file for 5176 minutes.
`git worktree remove` refuses it and `--force` would discard the work. Neither is new and neither
is mine: only 03 may fast-forward the clone, and the orphan is already escalated. 03's next
scheduled run is `2026-09-07T23:00:45Z`, inside the hour.

**DISPOSITION: DISPATCHED — Station 03, already open.** Named so the dispatch does not go stale,
along with the two dead `needs-marco/` files the 21:12Z run handed over (the `#1774` and `#1777`
escalations, both PRs now merged with receipts present) — move to `needs-marco/discharged/`, never
delete.

## WHAT I DID NOT DO

- **Armed nothing.** Zero of 43 HOLDs can enter the auto-merge lane, and every gate-satisfied
  candidate stops at Marco. Adding supply does not move a board whose constraint is a human gate.
- **Merged nothing and removed no label.** Both open PRs read `NO LOG`, hand-classify to Marco, and
  carry `do-not-merge`.
- **Wrote no approval receipt.** A scheduled run may never author one.
- **Did not clear any `[STALE]` line in the sweep's section 5 myself** — dispatched to 03 instead.
- **Did not re-file** the 06-cadence escalation, the 00x04 cron collision, or the `check-breadcrumb`
  cadence-map defect. All three are open with Marco.
- **Did not touch the watcher clone, `C:\po-vg`, `/sot/`, Azure, Entra or SharePoint**, and did not
  interrupt Station 04's concurrent run.
