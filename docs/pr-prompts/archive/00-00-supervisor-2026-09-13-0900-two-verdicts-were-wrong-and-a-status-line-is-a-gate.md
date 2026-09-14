# Station 00 — Supervisor (interactive lane, Marco directing) | 2026-09-11T03:2xZ–09-13T09:xxZ

## GROUND

```
UTC            2026-09-11T03:20Z (this segment starts where breadcrumb 0002 ended) → 2026-09-13T09:xxZ
origin/main    fd7234c6 at 03:20Z 09-11 → db6bf2f5 at 07:40Z 09-13 (the lane merged 12 PRs in this segment)
dev tree       main, ff'd after every merge; C:\ProjectOperations2
reboot         Marco restarted the box 2026-09-11 ~06:16Z (asked "finish what you need to do so I can restart
               my computer safely"); the lane resumed 2026-09-13 06:00Z on "keep driving the board"
doc version    1
bootstrap      1
```

Lane: DOCTRINE §10.2.1, supervised interactive — Marco in the chat. Transport: Desktop Commander; every long
loop runs DETACHED (`Start-Process -WindowStyle Hidden`) after the 06:23Z lesson below. Device-bridge VM still
DOWN ⇒ [CANNOT MEASURE] anything that needs it.

## WHAT I MEASURED

- [MEASURED] The six PRs Marco released on 09-11 all landed: #1832 80a2caee · #1850 f3fbed20 · #1845 2d31827d ·
  #1852 ec7dd590 · #1823 fd7234c6 · #1865 4538fb7b (03:47Z, three `update-branch` rounds — the #24 churn). Each
  through Assert-SmokedOrEscalate → Merge-Pr, each with a receipt in `docs/decisions/merge-approvals/`.
- [MEASURED] Watcher verdicts read from `C:\po-watcher\ProjectOperations\docs\pr-reviews\` (fresh ones live in
  the clone, not the dev tree): #1874 `REJECT-AND-REDO`, #1875 `MERGE`, #1878 `FIX`, #1879 #1881 #1883 #1884
  #1885 `MERGE`.
- [MEASURED] #1874's review blamed the migration's `platform.admin` join for missing the Admin role. It is wrong:
  `seed-reference.ts` grants Admin every `permissions` row; five of the six matrix rows the PR added PASS for admin
  (run 34560047495: 1 failed / 4162 passed); the one red is `PATCH /admin/company/profile … admin: true`, whose
  handler calls `assertSuperUser` after the permission guard, and `admin@projectops.local` is not a super-user.
  Rewriting production data to satisfy a wrong test row was the review's recommendation; the fix is the row.
- [MEASURED] #1878's review cited TS2352 at `:646/:652`; on the live head db0420c2 the same two errors sat at
  `:283/:289` (the watcher rebases every open PR ~3.5 min after each merge — chase the LATEST run's log, never a
  cited line number). 39 suites failed to compile behind them.
- [MEASURED] #1875's `MERGE` verdict did not read the browser job: `Tendering Browser Smoke` was red on EVERY head
  of the branch (4f1f240b, b74f1e90, 6774e9ec, 0bccbeb9 — 2 failed / 164 passed, both in
  `tests/e2e/pr-acceptance/batch4-quotes.spec.ts`, which still clicked "Generate Quote" and "Download PDF quote",
  the two labels the PR renamed). The merge gate refused it correctly, twice.
- [MEASURED] `CP-26 approval-receipt` fails `LABEL_PRESENT` while `do-not-merge` is on, receipt or no receipt.
  "A human must review and REMOVE the label; removing it is what releases the merge." The lane never strips it;
  Marco removed #1875's himself at 05:50Z 09-11 and that label event triggered its own green CI run.
- [MEASURED] #1883's apparent API/Web/pipeline reds were the jobs of a CANCELLED run (34566609219) read through a
  naive rollup filter; its only real reds are CP-26 and the coupled diff-checks.
- [MEASURED] Folder survey before the PR-Master move (09-11 06:06Z): no candidate folder was used by the watcher
  (it uses `C:\po-watcher` + `C:\po-secrets\watcher-app-auth.ps1`, read by `start-watcher.ps1:193`) or by any
  process; the only registered dev-tree worktrees were `C:\po-vg` (dirty 1) and `C:\po-worktrees\pr1823`.
- [MEASURED] 09-13 06:00Z resume: watcher node 4848 up since the reboot; nothing merged in 48 h; four PRs sat CLEAN
  with MERGE verdicts (#1879 #1881 #1884 docs-only, #1885 scripts+docs) because no lane owns hand-opened docs PRs.
- [MEASURED] `triage-holds` 09-13 08:36Z: HOLD 34, GATES SATISFIED 7, STILL GATED 28, SPENT-BEHIND-A-REJECT 2
  (`pr-ea-gate-report-self-filter` shipped in #1823, `pr-vmgitguard-selftest-and-recursion` shipped in #1832 —
  both this lane's own merges). One prose gate the linter cannot see: `pr-fv2-import-s1` `## STATUS` reads
  "HOLD. Marco arms this." — the exact wording that made the SLICE-0 code-writer refuse on 09-11.

## WHAT CHANGED

- Merged by this lane (receipt first, Assert-SmokedOrEscalate → Merge-Pr): the six above; board PRs #1869 #1876
  #1880 23cbcc20 #1882 83008383 #1888 b1a2d0f1; on Marco's "All four" (09-13 06:1xZ) #1879 017ca0a2 · #1881
  92e53022 · #1884 5bc78980 · #1885 67394572; on Marco's "Merge it for me" + his label removal + the fix lane,
  #1875 db6bf2f5 (09-13 07:40Z).
- Armed (actor `station-00.interactive-0002`, one at a time, `arm-prompt.ps1` only, sweep before each):
  09-11 — SLICE-0 (→ #1870), company-manage-s1 (→ #1874), qpdf-1 (→ #1875), rateparity-s1 (→ #1878),
  fix-1874 (pushed 957a778d), fix-1878 (pushed 91e63413), brandtheme-s3 (→ #1883), pr-master (→ #1885);
  09-13 — brandtheme-s6 (→ #1886), qpdf-3 (→ #1887), qpdf-4 (→ #1889), fix-1875 (pushed to its branch),
  fv2-maintenance-usage-intervals (→ #1890), draftpanel-s1 (→ #1891), qpdf-2 (→ #1892), bp-s2.
- Three fix-lane prompts authored, published (arm-prompt refuses an untracked HOLD) and armed: each says "do this
  ON PR #N's branch, do NOT open a new PR", "FIRST: re-verify against the CURRENT head", carries the verbatim
  STANDING AUTHORITY sentence plus "in the fix lane OPEN THE PR is already satisfied".
- PR-Master: `C:\PR-Master` (Marco's folder) is the one root for PR worktrees. Moved with `git worktree move`:
  po-vg, pr1823 → `C:\PR-Master\worktrees\`. Moved with `Move-Item` to `C:\PR-Master\_retired-2026-09-11\`:
  po-fix923, po-fix933, po-sec-fix, po-smoke, po-sup-fix, po-watcher-worktrees, po-wt, po-work, po-preserve,
  po-worktrees (+v1823), tmp. Nothing deleted. Left in place: po-sup-fix-scripts, po-watcher, po-secrets,
  _SWEEP-2026-09-02, the repos. #1885 taught `status-sweep.ps1`, `lint-station.mjs`, `watcher-loop-check.ps1`
  the new root; `docs/pipeline/PR-MASTER.md` carries the convention.
- This PR: `pr-fv2-import-s1` `## STATUS` reworded ("Armed by Station 00 under Marco's direction; the -ready
  rename IS the dispatch"); the two SPENT-behind-a-REJECT prompts and the consumed HOLDs retired to
  `superseded/`; `.arming-log.txt` swept.

## FINDINGS

- Two of five verdicts this segment were wrong in a way that would have cost production data or a merge of a red
  branch: #1874's diagnosis (a migration rewrite for a test that was wrong about the endpoint) and #1875's MERGE
  (browser suite red on every head). A `VERDICT: MERGE` proves the reviewer read the diff; it proves nothing about
  the jobs. Before acting on any verdict, read the LATEST run's failing job logs on the CURRENT head — it costs
  seconds with `gh run view --job <id> --log`.
- A "HOLD. Marco arms this." STATUS section is a prose gate that turns an arm into a no-op: the code-writer reads
  it and refuses. It is invisible to `lint-prompt.mjs` and to the three RULE 4 marker greps. The chain-arm script
  now greps `Marco arms|Marco will arm|do not arm|not to be armed|wait for Marco|until Marco` as a fourth
  instrument; the cure is to reword the STATUS in a board PR before arming (done here for fv2-import-s1, as for
  SLICE-0 and draftpanel on 09-11).
- `parseFrontMatter` strips exactly one outer quote pair and processes no escapes: a YAML `''` inside a
  single-quoted premise reaches bash as two empty strings, grep receives extra file arguments, exit 2 →
  `PREMISE_INVALID`. Write a premise that needs both quote kinds in DOUBLE quotes with single-quoted grep.
- Loops started as Desktop Commander children die when the MCP link blinks — at 06:23Z 09-13 the sequential
  merge driver and the #1875 loop both vanished one second after #1884's merge returned; nothing was half-done,
  but nothing continued either. Detach every loop (`Start-Process -WindowStyle Hidden`) and read its log file.
- Hand-opened docs-only PRs with MERGE verdicts have no lane: the watcher's `tests-docs` auto-merge covers only
  PRs it opened, so #1879/#1881/#1884 sat green for 48 h until Marco released them in chat. Worth a rule.
- ESCALATED (needs Marco, unchanged): `pr-ea-s2a` (seed-only CP-23 class), `pr-e2e-container-s2` (trial-run
  evidence; carries the do-not-arm marker), `draftpanel-s2` and `ratehub-s6b` wait on their S1/S6a landing.

## WHAT I DID NOT DO

- Did not remove any `do-not-merge` label, merge any PR Marco had not named in chat, author a receipt for a
  scheduled run, or touch `/sot/`.
- Did not move `po-sup-fix-scripts`, `po-watcher`, `po-secrets` or `_SWEEP-2026-09-02` (reasons in WHAT CHANGED);
  did not delete any folder or file.
- Did not merge #1883/#1886/#1887/#1889/#1890/#1891/#1892 — all code, all Marco's; their CI carries no red beyond
  CP-26 and its coupled diff-check.
- Did not restart the watcher for the PR-Master move (measured unnecessary) and did not fast-forward the watcher
  clone (03's, by standing rule).
