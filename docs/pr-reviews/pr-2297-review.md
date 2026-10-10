VERDICT: MERGE
REVIEWED-SHA: b9351d5973e0c79fe5c8038f9e17d73b0b275429

## Summary

PR #2297 is a Station 00 supervisor breadcrumb — the operational report from the 2026-10-09T21:06Z hourly cycle. It is docs-only and properly measured per DOCTRINE §7.1.

## Scope compliance

Scope: Station 00 (supervisor) operational breadcrumb per QUEUE_LAYOUT_V1 §8.5. One new report document added; previous cycle's breadcrumb renamed to archive.

- In scope: Single new breadcrumb file (241 lines) documenting:
  - Dev tree fast-forward 6332dd05 → 120b7ad3, with EOL-restoration of `.arming-log.txt`
  - Two external Docker Hub rate-limit failures diagnosed and failed jobs re-run
  - Board sweep: 1 PR open (#2294, do-not-merge gated); 0 armed; 13 HOLD prompts rejected (all gated)
  - Five findings properly disposed (F1/F2 ACTIONED, F3/F4/F5/F6/F7 DEFERRED with runbook lines)
  - Prior cycle breadcrumb moved to archive (QUEUE_LAYOUT_V1 compliance)
- Out of scope: None. No functional code, no config, no schema changes.

## CI status

All required checks passed:
- Changed-path filter: SUCCESS
- PR gates — diff checks (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Approval receipt (CP-26): SUCCESS
- Pipeline — watcher + linter tests: SUCCESS
- Pipeline — arm-prompt tests (Windows): SUCCESS
- E2E restoration markers: SUCCESS
- CodeQL: SUCCESS

All non-required checks either SUCCESS or SKIPPED (by path filter). No red.

## Self-verification claims

The originating prompt (the breadcrumb itself, per QUEUE_LAYOUT_V1 §8.5, is a REPORT not a prompt) declares:

- [✓ MEASURED] Dev tree FF: `git rev-list --left-right --count HEAD...origin/main` → 0 0; `git diff --numstat origin/main` → EMPTY; `git diff --cached --name-status` → EMPTY; `git status --porcelain --untracked-files=no` → EMPTY.
- [✓ MEASURED] Arming log restored from HEAD by raw-Buffer node write, then `git update-index --refresh`, then per-path `git status --porcelain` → EMPTY.
- [✓ MEASURED] Board state: 1 open PR (#2294, do-not-merge gated); 0 armed; 13 depth-1 HOLDs all rejected at lint-prompt.mjs.
- [✓ MEASURED] Breadcrumb freshness: `check-breadcrumb.mjs --freshness` → CLEAN, exit 0.
- [✓ MEASURED] Status sweep verdict: SAFE TO ACT.
- [✓ MEASURED] Main CI: 11 of 12 last runs green; 120b7ad3 failure is external (Docker Hub rate limit, not regression).
- [✓ MEASURED] All findings properly tagged: F1/F2 ACTIONED with read-backs, F3/F4 DEFERRED with explicit runbook lines for Marco.

## Findings and escalations

**F1 — Mixed-EOL arming log blocked FF, now ACTIONED:**
- Root cause: .arming-log.txt had mixed line endings (lf=161 crlf=157) visible to `git status --porcelain` but clean on all four prescribed read-backs (`--numstat`, `--cached`, `rev-list`, diff).
- Fix: Restored byte-exactly from HEAD via raw-Buffer node write (`fs.writeFileSync + git show`), then `git update-index --refresh`. Verified clean post-restore.
- Read-back: All four prescribed checks pass; no `git checkout` / `git clean` / `reset` used.

**F2 — Docker Hub unauthenticated pull rate limit, ACTIONED:**
- Root cause: Both CI and Tendering Browser Smoke failures occurred in "Initialize containers" before `actions/checkout`, with `Error response from daemon: toomanyrequests`. Named external cause, not a regression in trunk code.
- Fix: Re-ran failed jobs (`gh run rerun <id> --failed`). Both were in_progress at cycle end; next cycle confirms. This is the correct response per DOCTRINE §2 (external, self-clearing cause named first).

**F3 — Permanent Docker fix deferred to Marco (DEFERRED):**
- Two options outlined with RULE 1 applied:
  1. Authenticate the pull via docker/login-action with Docker Hub token secret (needs Marco to create secret).
  2. Pull from alternate registry (ghcr.io / mcr.microsoft.com) — possible autonomously but incomplete (swaps dependency to unnamed registry).
- Trigger for escalation: One failure in 12 runs (low urgency); would escalate immediately on second container-init rate-limit failure in 24h or on a near-merge PR.

**F4 — #2294 do-not-merge gate, ESCALATED (not this PR's gate, named for Marco's action):**
- #2294 (fix(pipeline): dedupe section 5 PR crawl + add -SkipSection5 fast switch) carries `do-not-merge` label; CI is 13 pass / 2 fail; failures are CP-26 diff-check gate + approval-receipt gate, both rooted in the label.
- No fix lane here. Marco must remove label to unblock merge. Once label removed, diff-check will turn green; approval-receipt will then require a fresh `authority: personal` receipt at merge time (UPDATE_AT_MERGE_TIME_V1).
- PR is BEHIND; Station 00 did not run `gh pr update-branch` on it (that is Merge-Pr's job at merge time per UPDATE_AT_MERGE_TIME_V1).

**F5, F6, F7 — Document narrowings, DEFERRED:**
- F5: lint-prompt.mjs classification guard (never substring-match; always read exit code first; use first line only for human tag). **Cure line ready for `00-supervisor-REFERENCE.md`.**
- F6: check-breadcrumb --freshness false-negative on behind dev trees; would become urgent if polarity flips. **Cure: resolve basename across `origin/main`'s full `docs/pr-prompts/**`.**
- F7: raw-Buffer FF cure succeeded on mixed-EOL file; narrows #2296/#2288 claim. **Cure: wording narrowing for `00-supervisor-REFERENCE.md §POST-MERGE-FF-CURE` with byte counts.**

## Risks Marco should know

1. **F3 may recur:** Docker Hub rate-limit failures are non-deterministic and low-frequency. Measured: 1 in 12 runs. A second occurrence in 24h would trigger permanent-fix escalation. No action needed now; arming a follow-up "add Docker Hub credential" prompt would be appropriate if it repeats.

2. **#2294 is explicitly waiting on Marco:** The label `do-not-merge` is doing its job; CI shows the gate. Removal is Marco's decision. The PR is correctness-ready (13/15 checks green, only gate failures are label-gated).

3. **Breadcrumb quality:** The supervisor's measurements are sound, properly tagged [MEASURED] / [INFERRED] / [CANNOT MEASURE] per DOCTRINE §7.1. Five findings are properly disposed with runbook lines for follow-up.

## Recommendation

MERGE. Breadcrumb PR is properly formed, CI is fully green, and all measured actions are correctly reported. Marco has two explicit decisions waiting: (1) F3 — create Docker Hub credential secret or choose registry; (2) F4 — remove `do-not-merge` label from #2294 when ready to unblock merge.
