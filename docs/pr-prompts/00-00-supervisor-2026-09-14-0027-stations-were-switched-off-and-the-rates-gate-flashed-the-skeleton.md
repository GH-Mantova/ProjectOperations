# Station 00 — Supervisor | 2026-09-14T00:27Z–02:30Z (supervised interactive lane 0003)

## GROUND

```
UTC            2026-09-14T00:27:54Z (sweep) / 01:05:32Z (preflight stamp)
origin/main    f748f6ed at start -> b273f659 at 02:23Z            (fetch first, then rev-parse)
dev tree       main @ f748f6ed -> b273f659  C:\ProjectOperations2  (read in the DEV TREE; git diff --numstat origin/main -- <the three docs> EMPTY)
doc version    1
bootstrap      n/a — interactive Cowork lane, not a scheduled task (actor station-00.interactive-0003)
```

Transport: Desktop Commander `start_process` (PowerShell 5.1) — sighted. The Cowork VM mount
(`device_bash`) is DOWN on this box since the 2026-09-08 Windows update (`mnt/ProjectOperations2 failed
to mount`); the `vm-git-guard.sh` installer therefore could not be run (no VM shell to install into) —
FINDING, not STOP: no VM-side git was possible at all this run, which is the guard's own goal.

## WHAT I MEASURED

- [MEASURED] `bring-up-to-speed.ps1` 00:27:54Z exit 0: §0 controls PASS (gh saw #1904, node runs); OPEN 2
  (#1905 red `Pipeline — watcher + linter tests`; #1891 red `tendering-e2e`); trunk green on `f748f6ed`
  5/5; `Pipeline heartbeat` 3 runs 3 failing (NOT trunk); watcher node pid 30976 + wrapper 1, clone
  `main dirty=0`, heartbeat 550 min on an empty queue (idle); armed 0; needs-marco 53 · no-pr-opened 109 ·
  failed 47 · blocked 135; §3 locks False/False, git procs 0; §7 `SAFE TO ACT`; backlog gates ready=1
  needs-marco=2 blocked=4 broken=0; lessons 5/5 holding.
- [MEASURED] `check-breadcrumb.mjs --freshness` exit 2 at 01:05Z: 00 16.1h, 03 73.9h, 04 70.9h, 05 82.9h ALL
  SILENT. [MEASURED] `Pipeline heartbeat` run 34788546122 (23:03Z): `SILENT: NO station has reported for
  14.1h (threshold 6h)`. Cause, [stated by Marco in chat 01:03Z]: he switched the station tasks and the five
  cloud scheduled tasks OFF on 2026-09-11 (~06:10Z) — the desktop store `scheduled-tasks.json` (mtime
  2026-09-11T06:10:28Z) read `enabled:false` on all five, model `claude-opus-5`.
- [MEASURED] A second actor was live at start: `.arming-log.txt` 00:44:44Z `ARMED
  pr-fix-1891-e2e-scope-tests-must-lock-rates-first actor=station-00.interactive-0002`; #1906 opened
  00:28:43Z (merged 01:0xZ); #1907 opened 01:00:26Z. [stated by Marco 01:03Z] that lane was his own chat and
  he stopped it. Board-driving condition 3 was therefore satisfied from 01:03Z on.
- [MEASURED] RULE 2 probe, live tree pinned (`C:\ProjectOperations2\docs\pr-prompts\processed`):
  `#1891` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/api/src/modules/tendering/scope-of-works.service.ts"}`
  (00:56Z, fix-lane build); `#1905` → `{"ok":false,"marco":true,"reason":"outside tests/ or docs/: apps/web/src/App.tsx"}`
  (01:30Z, fix-lane build). `#1907`, `#1908`: NO LOG, second lane (this lane / lane 0002), hand-classified —
  #1907 all `docs/pr-prompts/**` → 00's own lane; #1908 `.claude/agents/**` → Marco's, released by name.
- [MEASURED] #1905 red = `##[error]apps/web/src gained a hard-coded colour literal` (hex ratchet, run
  34793553563 job 103822221077, column 3), 62 literals in `JobSorRegisterPage.tsx`.
- [MEASURED] #1891 e2e after lane 0002's fix (d045c813, job 103824117979): `2 failed / 164 passed`, both in
  `batch3-scope-items.spec.ts` (:285 `element(s) not found` on the WASTE_FLAG checkbox right after clicking it;
  :398 test timeout). Cause read from source at `refs/temp/pr1891`: `ScopeCardsTab.tsx` `loadRateSet` called
  `setRateSetLoading(true)` on EVERY reload and the render returns the skeleton while `rateSetLoading`, so
  `reloadEverything()` after any item PATCH unmounted the card stack and closed the open Measurement
  expandable. No e2e spec deletes a rate set (grep `rate-set|Delete rate set` over `tests/e2e` → only
  `ensureRatesLocked` callers), so it was not a cross-worker race.
- [MEASURED] After my fix (1dc31858): `Tendering Browser Smoke` run 34795358857 → `1 failed / 165 passed`,
  the two batch3 failures GONE; the one red was `batch7-field.spec.ts:264` (timesheet submit, unrelated
  surface). Re-run on the rebased head 06e2f080 → all 15 checks SUCCESS ⇒ transient (rule 5).
- [MEASURED] `#1577`'s no-rebase-while-checks-run guard SEEN LIVE for the first time: clone log
  `[update] PR #1891 is BEHIND but checks in flight (tendering-e2e) - not rebasing` ×4 (01:21–01:27Z), then
  `branch updated (was BEHIND)` 01:31:12Z once the run completed.
- [MEASURED] `Merge-Pr -PR 1908` refused `#1908 is 'OPEN', not MERGED` at 02:24Z because #1905's merge had put it
  BEHIND between the assert and the merge — the read-back working as documented; cured with `gh pr update-branch`.

## WHAT CHANGED

- Cloud scheduled tasks (claude-code-remote): all five re-ENABLED and model → `claude-fable-5-1`
  (01:03–01:04Z), read back from the API responses.
- Desktop scheduled-task store `…\local-agent-mode-sessions\…\scheduled-tasks.json`: model →
  `claude-fable-5-1` on 00/03/04/05/weekly-security-audit; `enabled:true` on 03/04/05/weekly-security-audit;
  **00 left `enabled:false` deliberately** while this interactive lane is live (two 00s on one board =
  LL-38). Backup `scheduled-tasks.bak-before-fable-2026-09-14T02-04-46-835Z.json`. Read back by re-parse.
  ⚠️ The app rewrites this file from memory on exit (standing note) — Marco asked to confirm in the app UI.
- #1891: pushed `1dc31858` (`SCOPE_RATES_GATE_NO_REFETCH_FLASH_V1`, 5 insertions / 1 deletion in
  `ScopeCardsTab.tsx`) from disposable worktree `C:\po-fix1891`; receipt `merge-approvals/1891.md`
  (`3fb944dc`); merged 02:05:09Z `5036c74c` via `Assert-SmokedOrEscalate -PR 1891 -MustContain
  scope-cards-rates-gate` → `Merge-Pr`, read back MERGED.
- #1907: receipt `merge-approvals/1907.md` (`f7c4619c`); merged 01:19:55Z via the same path (the DC call
  timed out at 60 s with the merge already done — the 180 s timeout-but-succeeded trap; read back MERGED).
- Armed `pr-fix-1905-register-page-hex-literals-to-tokens` 01:21:57Z (lint ADMIT, union grep 0/0/0, POS
  control pr-524 = 3); watcher built it, pushed `e4a2075e` to #1905 (lint/test/build green in its log);
  receipt `merge-approvals/1905.md` (`2d421e1f`); merged 02:23:30Z `b273f659`.
- Armed `pr-draftpanel-s2-finish-this-draft` 02:13:14Z (lint PROMOTE/GATE_RELEASED by #1891, markers 0/0/0,
  scope overlap 0 against both open PRs, `design_ref` present). Build in flight at the end of this window.
- Opened #1908 `chore(agents): station agent definitions 00/03/04/05 run on Fable 5.1` (`.claude/agents/*.md`
  `model:` → `fable`, `lint-station` ADMIT all 8); receipt `merge-approvals/1908.md`; merge pending
  (update-branch done, checks re-running).
- Dev tree fast-forwarded twice with the append-only-aware cure (save log → restore to HEAD → ff → reapply
  the arm rows absent from the new HEAD): `61a26bec → b3387e02` and `b3387e02 → b273f659`, both read back
  `0 0` / numstat empty except the reapplied arm rows / cached empty.
- This board PR: lands the untracked 0408 blind-run breadcrumb, `.arming-log.txt` (+2 rows), retires the consumed
  `pr-fix-1905-…-HOLD.md` to `superseded/` (its PR is merged), and this breadcrumb.

## FINDINGS

### F1 — All four stations SILENT because Marco switched them off on 09-11; the store is the instrument, not the breadcrumbs
[MEASURED] above. Not #17 blindness, not an outage — do NOT re-diagnose. What made it visible from outside
was the GitHub `Pipeline heartbeat` workflow (SILENT 14.1h), which is exactly what it was built for.
DISPOSITION: **ACTIONED** — 03/04/05/weekly-security-audit re-enabled in the store; cloud triggers re-enabled.
ESCALATED (one line, not new): the scheduled 00 stays OFF while an interactive 00 lane is live — Marco to
flip it when this lane signs off, or tell the lane to.

### F2 — `ScopeCardsTab` re-rendered the skeleton on every reload (the #1891 e2e red was a real UI defect, not a test-setup gap)
Cause and fix above. Lane 0002's `ensureRatesLocked` fix was necessary (the gate itself) but not sufficient.
DISPOSITION: **ACTIONED** — 1dc31858 on #1891, merged.

### F3 — Marco's ruling of 09-14: the interactive 00 lane opens/arms gate-open and slice-0 prompts, drives them green and merges
[stated in chat ~02:02Z]: "keep opening/arming prs that are either slice-0 or have their gates open / drive them
to green and merge". Read together with the 01:12Z RULE 2 release of #1891 + #1905 and the 09-07 ruling
(§10.2.1: the lane merges, but writes a receipt first). Applied this run to draftpanel-s2 (armed).
Hard stops unchanged: `escalates:true` / migrations / prod-data prompts still stop at Marco per PR.
DISPOSITION: **ACTIONED** — recorded here and in project memory; triage at 02:11Z listed 5 gate-satisfied
HOLDs (brandtheme-s4-named-presets-seed, draftpanel-s2, ea-s2a-dashboard-preset-seed,
fv2-import-s1-docx-and-persona, ratehub-s6b-push-back-ui); one armed, the rest are the next arms, ONE AT A TIME.

### F4 — Station agent model retarget has THREE layers and only one is in the repo
[stated by Marco ~02:03Z]: station agents 00/03/04/05 to Fable 5.1 (high). Layers: (1) cloud triggers — done
via API; (2) desktop `scheduled-tasks.json` `model` — done on disk, subject to the app's rewrite-on-exit;
(3) repo `.claude/agents/*.md` `model:` — #1908. Agent front matter has no effort field, so "high" has no home
in layer 3; layers 1–2 take a model id only.
DISPOSITION: **ACTIONED** (1, 2) / **ACTIONED** (3, #1908 pending merge) / **ESCALATED**: where should
"high" effort be expressed for scheduled stations, if anywhere — Marco's (product question).

### F5 — Two consumed HOLDs and the stays-armable-forever rule
`pr-fix-1905-…-HOLD.md` retired in this PR (its PR merged). `pr-draftpanel-s2-finish-this-draft-HOLD.md`
is CONSUMED (armed 02:13Z, build in flight) but MUST STAY TRACKED until its PR merges (RULE 1 second test);
🔴 **DO NOT ARM `pr-draftpanel-s2-finish-this-draft` again** — read the arming log before any arm.
DISPOSITION: **DEFERRED** — retire it in the board PR after its PR merges.

## WHAT I DID NOT DO

- Did not enable the scheduled `00-supervisor` task (see F1). Did not touch `/sot/`, Azure/Entra/SharePoint,
  any label (none existed), any migration prompt, or the `escalates:true` / `HUMAN_GATE_PRESENT` HOLDs.
- Did not discharge any `needs-marco/` file: the sweep's §5 `[STALE]` rows named only `pr-1896-review-reject.md`
  and `pr-1898-review-fix.md` (PR-scoped, both PRs merged) — left for the next COLLECT to read and move,
  because this run's window was spent on the board.
- Did not archive the five tracked root breadcrumbs (0002/0209/0309/0900/04-0211) — not re-read for
  disposition this run; DEFERRED to the next collect.
- Did not prune `C:\PR-Master\worktrees\po-vg` or `pr1823` (03's, and po-vg holds 1 uncommitted file).
- Did not run `vm-git-guard.sh` (no VM shell exists on this box right now — FINDING above, not a STOP).
