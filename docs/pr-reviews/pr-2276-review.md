VERDICT: MERGE
REVIEWED-SHA: ba53eff44e7e953d38ef986c3fc82cf7657032c9

## Scope compliance

**In scope:**
- Added the `STANDING AUTHORITY` sentence to `pr-sweep-quote-the-heartbeat-alarm-HOLD.md` (the exact text named by `lint-prompt.mjs` itself)
- Archived the 0314 breadcrumb file to `docs/pr-prompts/archive/` (by `git mv`)
- Created the 0515 breadcrumb file documenting the measurements from this Station 00 run

**Out of scope:** None. All changes are within `docs/pr-prompts/` only. No scripts, no `/sot/`, no production files touched.

## Self-verification claims

- [PASS] HOLD file now lints ADMIT (exit 0) instead of REJECT [MISSING_STANDING_AUTHORITY]: Verified with `node scripts/pipeline/lint-prompt.mjs docs/pr-prompts/pr-sweep-quote-the-heartbeat-alarm-HOLD.md` -> ADMIT, exit 0.
- [PASS] 0314 breadcrumb moved to archive: File exists at `docs/pr-prompts/archive/00-00-supervisor-2026-10-09-0314-...md` and no longer at the root of `docs/pr-prompts/`.
- [PASS] New breadcrumb created: 0515 breadcrumb file present with 386 lines of detailed measurements and findings.
- [PASS] Authority sentence inserted verbatim from validator text, additively only: Diff shows exactly 2 lines added to the HOLD file (the blank line and the STANDING AUTHORITY sentence).
- [PASS] No arm performed this run (deliberate sequencing): Breadcrumb explicitly states "armed = 0 before and after", and file counts show only three files changed (one added, one moved, one modified with +2 lines only).

## CI status

All 15 checks completed:
- Changed-path filters: SUCCESS
- CodeQL (actions + javascript-typescript): SUCCESS
- PR gates (CP-09–13, CP-17, CP-22, CP-23): SUCCESS
- Approval receipt (CP-26): SUCCESS
- Pipeline tests (watcher + linter + arm-prompt): SUCCESS
- E2E restoration markers: SUCCESS
- Tendering e2e: SKIPPED (changed-path filter matched)
- Data model, API, Web, raw-error-envelope: SKIPPED (docs-only, correct filtering)

## Risks Marco should know

None identified. This is a docs-only PR from Station 00's scheduled run. The substance of the work is straightforward:

1. **F23 (the main finding):** A prompt (`pr-sweep-quote-the-heartbeat-alarm-HOLD.md`) has been armable since 2026-10-08T23:2xZ but held by a missing one-line authority sentence. Thirteen other tracked HOLD prompts are held by gates Station 00 cannot open (human gates or file-gate predecessors not on main). This run executed all 14 gates individually (rather than inferring "nothing armable"), which made the typo visible. The fix is additive, verified, and lints clean.

2. **F21/F24 (secondary findings):** Confirmations of prior findings about Desktop Commander tool-call timeouts and orphaned process continuations. No action needed.

3. **F22 (tertiary finding):** One Station 00 run at 04:1xZ went BLIND (Desktop Commander timeout) but did complete COLLECT via file transport. Deferred for instruction-drift correction outside this station's lane. The breadcrumb records this for rotation position 3.

4. **F25 (status):** F19 (from 0314 breadcrumb) is now spent — the streamed sweep form returned all sections this run (468 lines, exit 0).

5. **F26 (escalation state):** #2261 unchanged at 50h open. Still BEHIND on CI (13 pass / 2 fail), red on `RELEASED_NO_RECEIPT`, no label. Awaiting Marco's release marker. Breadcrumb correctly escalates this as unchanged and records the prior hand-off.

The next action is Marco's: this PR merges, then Station 00's next run will fast-forward the dev tree, re-lint the repaired HOLD file's copy on main (which will now ADMIT), and arm it. That produces a PR that Station 00 can both drive and sign for (unlike #2261).

## Recommendation

Merge as-is. This is Station 00's board-state collection PR with high measurement rigor and properly deferred findings.
