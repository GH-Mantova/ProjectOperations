# Station 00 — Supervisor | 2026-09-14T02:30Z–04:25Z (supervised interactive lane 0003, second window)

## GROUND

```
UTC            2026-09-14T02:30Z (window start) / 04:11:52Z (last status sweep)
origin/main    b273f659 at start -> d082333f at 04:00Z (#1911 merge)     (fetch first, then rev-parse)
dev tree       main @ a211e716  C:\ProjectOperations2  (FF pending to d082333f after this PR; append-only-aware cure)
doc version    1
bootstrap      n/a — interactive Cowork lane, not a scheduled task (actor station-00.interactive-0003)
```

Transport: Desktop Commander `start_process` (PowerShell 5.1) — sighted. Cowork VM mount still DOWN
(09-08 Windows update). Continuation of breadcrumb `00-00-supervisor-2026-09-14-0027-…` (same lane, same day).

## WHAT I MEASURED

- [MEASURED] #1911 (ratehub-s6b, watcher build from my 02:37:03Z arm) red on the hex ratchet only:
  `GREW ScheduleOfRatesAdminPage.tsx 22 -> 31`, `NEW PushBackDialog.tsx 0 -> 11`. Station review
  `docs/pr-reviews/pr-1911-review.md` 03:11Z: REJECT-AND-REDO on that one ground, substantive work rated
  well-implemented. Cured on branch: `1426d6b3` (V1 map, left 2 literals — my fix script did NOT gate on the
  ratchet exit code, so it committed red) and `25a13866` (V2, `var(--surface-2, #f9fafb)` ×2 →
  `var(--surface-subtle)`, local ratchet `OK … no file grew, no new file carries one`). 15/15 green on the
  rebased head `f908845a`. Merged 04:00:56Z `d082333f` via `Assert-SmokedOrEscalate -PR 1911 -MustContain
  ratehub-s6b-push-back` → `Merge-Pr`, read back MERGED. Receipt `merge-approvals/1911.md` (`3ff6e4e5`).
- [MEASURED] #1913 (brandtheme-s4, watcher build from my 03:20:25Z arm; lint ADMIT, markers 0/0/0, scope overlap
  0) red on `PR gates — diff checks` job 103849533463: `FAIL - CP-23 seed-without-migration [seed touched with
  no migration: apps/api/prisma/seed-company-profile.ts]`. The prompt carried `seed_only: true`. Read on
  origin/main: the Default scheme row reached prod via `20260716120000_brand_color_scheme_and_asset` lines
  79–82 (guarded insert), i.e. the repo's precedent is migration + seed, not seed alone.
- [MEASURED] A SECOND Station 00 interactive lane became live on this board from ~03:20Z: #1914
  `docs(pr-prompts): Geocodify adapter … (prompt); retire consumed 1905 hex HOLD` body says "Lane: Station 00,
  supervised interactive (Marco directing)"; it merged ~03:45Z and armed `pr-geocodify-v2-host` 03:48:29Z
  (→ #1915). Station 06 also opened #1912 (ratescol cluster) and #1916 (crmvis cluster). Each of their merges
  put my open PRs BEHIND (#1911 rebased twice, #1913 once) and restarted CI.
- [MEASURED] `#1577`'s no-rebase-while-checks-run guard held throughout (`is BEHIND but checks in flight
  (tendering-e2e) - not rebasing` ×12 across #1911/#1913/#1915), then `branch updated (was BEHIND)` once each
  run completed.

## WHAT CHANGED

- #1911 merged 04:00:56Z `d082333f` (details above). The consumed `pr-ratehub-s6b-push-back-ui-HOLD.md` and
  `pr-draftpanel-s2-finish-this-draft-HOLD.md` (#1910 merged before 03:08Z) are retired to `superseded/` in THIS PR.
- Armed `pr-brandtheme-s4-named-presets-seed` 03:20:25Z (actor station-00.interactive-0003) → #1913.
- #1913: pushed `5a6c65c7` = `apps/api/prisma/migrations/20260914041500_brandtheme_s4_named_presets/migration.sql`
  — two `INSERT … ON CONFLICT DO NOTHING` rows, 30/30 hex values checked identical in order to
  `HARBOUR_PRESET`/`GRAPHITE_PRESET`, no UPDATE/DELETE, `active_color_scheme_id` untouched. **Migration
  released by Marco in chat ~04:15Z** (AskUserQuestion: "what do you suggest" → lane recommended the migration
  → "Yes — add the migration"). CI re-running at the end of this window.
- `docs/pipeline/stations/01-code-writer.md`: new DONE item 6 `HEX_RATCHET_IN_DONE_V1` (tokens.css only,
  `var(--x, #hex)` fallbacks count, run the ratchet before pushing) — landed in THIS PR.
- `.arming-log.txt` +2 rows (02:37:03Z ratehub-s6b, 03:20:25Z brandtheme-s4) swept in THIS PR.
- Project memory `project_supervisor_2026_09_14_0100_interactive_lane_0003_marco_rulings.md` updated with the
  migration release, the second-lane finding and the ratchet-gate lesson.

## FINDINGS

### F1 — Five PRs in two days red on the hex ratchet; the rule now lives where the code-writer reads it
#1894, #1895, #1905, #1910, #1911 — every new web page carried `var(--x, #hex)` fallbacks or raw literals.
DISPOSITION: **ACTIONED** — `01-code-writer.md` DONE item 6 in this PR. Watch the next two UI arms; if the
ratchet still trips, the rule is in the wrong place (or the writer is not reading DONE).

### F2 — `seed_only: true` on a prompt whose rows must reach prod (CP-23 caught it)
Station 06 wrote brandtheme-s4 as seed-only; the plan's own words ("a preset the company can open, adjust and
save") make Harbour/Graphite production data. CP-23 is the gate that exists for this and it fired.
DISPOSITION: **ACTIONED** (#1913 migration, Marco-released) / **ESCALATED** to Station 06: a `seed_only: true`
prompt must state whether prod needs the rows; if yes, `scope` must include the migration path.

### F3 — Two Station 00 interactive lanes on one board (LL-38) — Marco told 03:55Z, no ruling yet
Not an incident: both lanes are Marco-directed. Cost: repeated rebases of open PRs; risk: overlapping board
edits (#1914 retired the pr-fix-1905 HOLD that #1909 had already retired — git took it as a no-op because
#1909 merged first). DISPOSITION: **ESCALATED** — Marco to say which lane drives the board, or confirm both.

### F4 — A fix script that does not gate on the ratchet exit code ships red
`sup-0003-fix1911.ps1` printed `ratchet exit=1` and committed anyway (2 literals left). Fixed in
`sup-0003-fix1911b.ps1` (`if ($rc -ne 0) { … exit 5 }`). DISPOSITION: **ACTIONED** — lesson in project memory.

## WHAT I DID NOT DO

- Did not enable the scheduled `00-supervisor` task (still OFF while an interactive 00 lane is live).
- Did not touch `/sot/`, Azure/Entra/SharePoint, any label, any `escalates:true` HOLD, or any other lane's PR
  (#1912, #1914, #1915, #1916 are not mine — reviewed by the watcher's review lane, merged by their owner).
- Did not arm `pr-ea-s2a-dashboard-preset-seed` or `pr-fv2-import-s1-docx-and-persona` yet — one at a time,
  #1913 still open. ea-s2a is ALSO a seed prompt: read its `seed_only` against F2 before arming.
- Did not discharge the `[STALE]` needs-marco rows (`pr-1896-review-reject.md`, `pr-1898-review-fix.md`) or
  archive the five tracked root breadcrumbs — DEFERRED again to the next collect.
