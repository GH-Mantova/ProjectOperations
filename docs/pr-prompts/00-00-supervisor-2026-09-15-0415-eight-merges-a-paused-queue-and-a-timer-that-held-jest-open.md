# Station 00 — Supervisor | 2026-09-15T00:55Z–04:15Z (supervised interactive lane 0003, second shift)

## GROUND

```
UTC            2026-09-15T04:11:09Z (#1955 merged) / 04:15Z (this breadcrumb)
origin/main    4396b12e at 00:55Z -> 8b2c0189 at 04:11Z            (fetch first, then rev-parse)
dev tree       main @ 38262308 -> ff to 8b2c0189 after this PR  C:\ProjectOperations2  (tracked dirty: .arming-log.txt +1 row, swept here)
doc version    1
bootstrap      n/a — interactive Cowork lane, not a scheduled task (actor station-00.interactive-0003)
```

Transport: Desktop Commander `start_process` (PowerShell 5.1) — sighted. Marco's ruling for this shift [stated
~00:55Z]: "keep driving the board, opening prs, running all checks/tests marked in their body, driving them to green,
and merging them"; and "leave the stations like that for now" (scheduled 00 hourly on Opus 5, models unchanged).

## WHAT I MEASURED

- [MEASURED] Merged with receipts this shift, each after re-running the body's greps/`test -f` on the head and reading
  the diff: #1945 (draftpanel-S3 staging), #1923 (ratescol-S0), #1946 (crmvis-S0 tooling), #1948 (fv2-import-S2),
  #1950 (EA-2b), #1954 (ratescol-S1), #1957 (scopecards-S2a staging), #1955 (scheduled 00's collect 0308, sat green
  40 min). `pnpm build/lint/test` claims are executed by CI on the head; the greps this lane re-runs itself
  (`sup-0003-body-checks.ps1`).
- [MEASURED] Armed (one at a time): crmvis-s0 01:03:10Z → #1946; fv2-import-s2 01:13:02Z → #1948; ea-s2b 02:02:13Z →
  #1950; ratescol-s1 02:39:25Z → #1954; crmvis-s1 03:06:27Z → #1956 (escalates); ratescol-s2 03:51:02Z (escalates,
  building at close).
- [MEASURED] fv2-import-s2 first fire: the writer read the prompt's own `## STATUS — **HOLD.** Marco arms this.`
  block, refused three times in 20 s each, and the watcher PAUSED the queue (`queuePaused` is in-memory; nothing
  clears it but a restart). Re-fired with the block reworded (arming-log `REFIRED` 01:20:51Z), `rev-1946` moved back
  from `paused/`, watcher stopped wrapper-first and relaunched via `C:\po-watcher\ensure-watcher.ps1` (detached,
  ancestry verified, node 18940). Second fire built #1948.
- [MEASURED] Hex ratchet tripped on #1948 (`NEW FormImportReviewPage.tsx 0 -> 16`) and #1954 (`GREW
  FilterableRateGrid.tsx 7 -> 9`); did NOT trip on #1950 (EA-2b, first clean UI build since
  `HEX_RATCHET_IN_DONE_V1`) nor #1956 (crmvis-S1, whose prompt carries its own "tokens, not hex" house rule).
- [MEASURED] #1948's API job sat 25+ min in `pnpm test:api:serial` after every suite passed: the preview-import
  store's 30-minute cleanup `setTimeout` had no `unref()`, so the jest worker never exited. Fixed `a7163241`;
  the next run finished in the normal ~10 min.
- [MEASURED] The watcher restarted itself again at 03:55:09Z (not this lane) and re-seeded its reviewed-set with
  1474 PRs; the review job for #1956 that was running at 03:29 wrote "Verdict: MERGE" to its log but the verdict
  file is in no home — lost with the reclaimed worktree. #1956 therefore has a MERGE verdict only in
  `processed/rev-1956-ready.md.log`, and no side-by-side compare PNG was produced for Marco's visual acceptance.

## WHAT CHANGED

- Fixes pushed on branches: `5e40ab26` (#1948 hex→tokens, 16 lines), `a7163241` (#1948 TTL timer unref),
  `59530620` (#1954 hex→tokens). Generic tool `sup-0003-hexfix.ps1` + `sup-0003-hexmap-edit.mjs` now do this in one
  call, gated on the local ratchet.
- This PR retires the consumed+merged HOLDs `pr-ea-s2b-dashboard-filter-surface`, `pr-fv2-import-s2-review-route`,
  `pr-ratescol-s0-column-api-hygiene`, `pr-ratescol-s1-header-chips` to `superseded/` and sweeps `.arming-log.txt`
  (+1: ratescol-s2). `pr-crmvis-s1-accounts-list` and `pr-ratescol-s2-header-menu-edit` stay tracked (PRs open).

## FINDINGS

### F1 — A prose `## STATUS — HOLD` block in a prompt body makes the writer refuse and pauses the queue
Station 06 writes it on chained slices; lint does not see it (`sup-0003-prearm2.ps1` now greps for it). DISPOSITION:
**ESCALATED** to 06 — drop the block or make it front-matter; **ACTIONED** for this fire.

### F2 — Hex ratchet: 2 of 4 UI builds this shift still tripped it after the DONE rule landed
#1948 and #1954 tripped; #1950 and #1956 did not. Half the builds is better than every build, but the rule is not
sufficient. DISPOSITION: **ESCALATED** to 06 — put the tokens-only line in the prompt template's Guardrails as
crmvis does; 04 to measure the next four.

### F3 — A watcher restart loses an in-flight review and drops in-flight PRs from the reviewed-set
#1956's review verdict survived only in the job log. DISPOSITION: **ESCALATED** to 03 — on startup, re-enqueue
`rev-<n>` for any open PR without a verdict file, instead of seeding it as already reviewed.

### F4 — Timers in API services must be `unref()`ed or lazily expired
A 30-minute `setTimeout` held the serial jest run open for 25 minutes. DISPOSITION: **ACTIONED** on #1948; worth a
line in the code-writer DONE list next to the hex rule.

## WHAT I DID NOT DO

- Did not arm `pr-draftpanel-s3-carry-over-and-picker` or `pr-scopecards-s1-operational-costs-priced` — Marco's own
  staging PRs say "Marco releases the prompt"; asked him 03:00Z, no answer yet.
- Did not remove any `do-not-merge` label (#1956, and the ratescol-s2 PR when it opens) — Marco's, after visual acceptance.
- Did not touch `/sot/`, the desktop scheduled-task store, or the cloud triggers.
