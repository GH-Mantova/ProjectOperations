# Station 00 — Supervisor | 2026-09-14T04:25Z–23:59Z (supervised interactive lane 0003, closing window)

## GROUND

```
UTC            2026-09-14T23:58:16Z (#1920 merged) / 23:59Z (this breadcrumb)
origin/main    d082333f at 04:25Z -> 86a6efea at 23:58Z            (fetch first, then rev-parse)
dev tree       main @ 86a6efea  C:\ProjectOperations2  (ff --ff-only, read back; tracked dirty: none)
doc version    1
bootstrap      n/a — interactive Cowork lane, not a scheduled task (actor station-00.interactive-0003)
```

Transport: Desktop Commander `start_process` (PowerShell 5.1) — sighted. The lane's link to the box dropped
several times (06:30–08:30Z gap, 09:52Z–23:25Z Marco away); the scheduled Station 00 (hourly, actor
`station-00.<HHMM>`) drove the board in between — #1922, #1924, #1925, #1935–#1942 are its collects.

## WHAT I MEASURED

- [MEASURED] #1913 (brandtheme-s4) CP-23 red → migration `20260914041500_brandtheme_s4_named_presets` (Marco
  release ~04:15Z), `GATE-ALLOW: migrations` bare at column 0 (CP-11 had refused the undeclared migration),
  15/15 green, merged 05:23:16Z `73048f1a`, receipt `1913.md`.
- [MEASURED] #1918 (fv2-import S1, armed 05:03:57Z) red on the hex ratchet `GREW ImportFromPdfModal.tsx 8 -> 26`
  — the FIRST build after `HEX_RATCHET_IN_DONE_V1` landed on main (04:49Z), so the DONE rule did not reach the
  writer. Cured on branch `deeebddb` (21 lines, tokens by role, local ratchet OK); station review MERGE;
  merged 08:34:38Z `9b98e199`, receipt `1918.md`.
- [MEASURED] #1920 (ea-s2a, escalates:true, armed 06:03:57Z after Marco's chat release) had THREE reds: the seed
  crashed (`prisma.user.findMany` on a relation `permissions` that does not exist — `Role.rolePermissions`
  does), CP-23 seed-without-migration, CP-26 label+receipt. Fixed `375c603a`, migration
  `20260914063000_ea2a_estimating_analytics_preset` (Marco release ~06:30Z; INSERT … SELECT per reporting.view
  user, WHERE NOT EXISTS, config identical to the seed's 10 widgets), receipt `1920.md` (`7b257b2d`, Marco
  "Approve — I'll remove the label"). The scheduled 00 ALSO pushed two commits to it during the 07:18–07:29Z
  gap (`b1efa896`, `869807f0`: reporting.service ↔ definitions require cycle) — outside prompt scope,
  reported to Marco 23:30Z before release. Label removed by Marco 23:32Z; stale labeled-state check runs
  kept `fail=2` on the head until `gh pr update-branch` produced a clean run; merged 23:58:16Z `86a6efea`.
- [MEASURED] The desktop `scheduled-tasks.json` edit of 02:04Z did NOT survive: the app rewrote the file at
  04:08:21Z with every task back on `claude-opus-5` and the hourly 00 `enabled=true`. Marco told 04:50Z; the
  model change must be made in the app UI, not the file.

## WHAT CHANGED

- Merged with receipts this window: #1913, #1917 (collect 0300), #1918, #1920. Whole lane, 09-14: #1907, #1891,
  #1905, #1908, #1909, #1910, #1911, #1913, #1917, #1918, #1920.
- Armed: fv2-import-s1 05:03:57Z, ea-s2a 06:03:57Z (both consumed, both merged). No gate-open prompt remains
  that this lane may arm.
- This PR retires the consumed `pr-ea-s2a-dashboard-preset-seed-HOLD.md` to `superseded/` (#1920 merged).
  `pr-ratescol-s0-column-api-hygiene-HOLD.md` stays tracked — #1923 (the scheduled 00's) is open.

## FINDINGS

### F1 — The hex-ratchet DONE rule has not yet been seen to work
Landed 04:49Z; the next build (fv2-import, 05:04Z) tripped the ratchet anyway. Either the writer built from a
clone that had not synced, or DONE is not where the writer looks. DISPOSITION: **ESCALATED** to 04/06: measure
the next two UI builds; if either trips, move the rule to the prompt template's Verification block.

### F2 — Two seed prompts in one day needed a migration the prompt did not name
brandtheme-s4 (`seed_only: true`) and ea-s2a (`seed_only: false`, no migration in scope) both hit CP-23; both
needed a Marco release. DISPOSITION: **ESCALATED** to 06 — a prompt that touches `prisma/seed*.ts` must say
whether prod needs the rows and, if so, carry the migration path in `scope` and `gate_allow: migrations`.

### F3 — Three Station 00 actors on one board, and the desktop store cannot be edited from disk
Scheduled 00 (hourly, Opus 5, `enabled=true` after the app's rewrite), Marco's 0002 chat (geocodify arm
03:48Z), this lane. The scheduled 00 pushed to this lane's escalated PR (#1920) unannounced. DISPOSITION:
**ESCALATED** — Marco to set models and the 00 enable state in the app UI; a lane should not push to another
lane's PR without a row in the arming log or a PR comment.

### F4 — Stale check runs after a label change block `Assert-SmokedOrEscalate`
Removing `do-not-merge` re-ran only the gate jobs; the failed runs from the labeled state stayed in the rollup
(`checks=25 fail=2`). `gh pr update-branch` cured it. DISPOSITION: **ACTIONED** (method note in project memory).

## WHAT I DID NOT DO

- Did not touch #1923 (scheduled 00's ratescol-s0), `/sot/`, labels (Marco removed #1920's himself), the desktop
  store again, or the cloud triggers (those five are Marco's email/soak tasks, not stations).
- Did not discharge `[STALE]` needs-marco rows or archive root breadcrumbs — the scheduled 00's collects own
  that now.
- Lane 0003 signs off with this PR unless Marco re-engages it.
