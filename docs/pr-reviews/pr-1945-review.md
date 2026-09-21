VERDICT: MERGE

Scope compliance:
- In scope: docs-only PR staging one 275-line prompt file (pr-draftpanel-s3-carry-over-and-picker-HOLD.md) documenting the third slice (S3) of the draftpanel cluster. Prompt is correctly formatted with HOLD suffix, indicating Marco must explicitly rename to -ready.md to dispatch it for building.
- Out of scope: None - single file addition, no code or data-model changes.

Self-verification claims (from PR body):
- Lint result: node scripts/pipeline/lint-prompt.mjs → PROMOTE (size 6), GATE_RELEASED on DraftProgressPanel.tsx ✓ (CI job "Pipeline — arm-prompt tests (Windows)" passed)
- MD5 checksum match: fc610f4d357b163be1f747f28f2191a8 verified in PR body ✓
- Grounding reads: PR body cites specific line numbers on origin/main commit 834747ef (2026-09-14); prompt is well-researched and cross-references existing code paths ✓

CI status:
- All checks green: Changed-path filter, CodeQL (actions & js/ts), E2E restoration markers, PR gates (CP-09–13, CP-17, CP-22, CP-23), Approval receipt (CP-26), Pipeline watcher + linter tests, Pipeline arm-prompt tests (Windows)
- No failures, no red tests
- Mergeable: true

Risks Marco should know:
- This PR does not stage buildable code—it stages documentation describing what will be built when Marco decides to rename the file to -ready.md. No build, lint, or smoke gates apply to the prompt file itself; they will apply to the PR that results from the prompt dispatch.
- The prompt depends on DraftProgressPanel.tsx (S2, PR #1910) already being on main. PR body confirms it is.
- The prompt is marked gate_allow: migrations and references a rollback strategy (additive column drop only). The actual migration will be subject to migration-naming rules and ordering on dispatch.

Recommendation: Merge. This is a well-researched, correctly formatted docs-only staging PR with no scope violations and full CI green. It holds a documented prompt awaiting Marco's explicit dispatch decision.
