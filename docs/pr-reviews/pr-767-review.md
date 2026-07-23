VERDICT: MERGE

Scope compliance:
- In scope: Single file added (docs/pr-prompts/pr-fix-735-acceptance-specs-new-ia-ready.md). Docs-only, as claimed in PR body.
- Out of scope: None. No code or config changes.

Prompt quality:
- Premise valid: PR #735 is OPEN, matching the authorized date (2026-07-22)
- Structure sound: YAML front-matter, clear scope (3 specific test files), explicit "Do NOT" guardrails, autonomous (escalates: false, no AskUserQuestion)
- Bounded authority: STANDING AUTHORITY section correctly frames agent as autonomous ("there is no human in this run")
- No premature assumptions: Prompt instructs agent to verify failures in job log before editing ("doctrine: read the job log, never diagnose from the diff")

Self-verification claims (prompt's internal structure):
- [✓] Premise check command provided
- [✓] Scope boundaries specified (3 files, explicit exclusions)
- [✓] Branch name specified (feat/fold-archive-resources)
- [✓] Success criterion clear (pnpm build && pnpm lint)
- [✓] Guardrails explicit (no new PR, no app code changes, no merge)

CI status:
- CodeQL: PASS
- Data model sanity: PASS
- PR gates: PASS
- Web lint/test/build: PASS
- API lint/test/smoke: IN_PROGRESS (expected for docs-only)
- tendering-e2e: IN_PROGRESS (expected for docs-only)

Risks Marco should know:
- None. The PR is staging only, not executing. The prompt will fire separately when queued by the watcher.
- Prompt targets PR #735 which has meaningful code changes (nav-IA fold); the spec fixes are legitimate and narrow.

Recommendation: Merge. The prompt is well-scoped, properly authorized, and safe to queue.
