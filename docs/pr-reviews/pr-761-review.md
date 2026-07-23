# PR #761 Review: docs(pr-prompts): stage Xero env-drift fix prompt

VERDICT: MERGE

## Scope compliance

In scope:
- New file: docs/pr-prompts/pr-qa-xero-env-example-drift-ready.md (77 lines, well-formed prompt template)
- Prompt template has correct front-matter (premise, premise_means, scope, done_when, size, gate_allow, seed_only, escalates)
- Describes finding 04-scanner Part 0 (f) env-drift: three Xero override env vars undocumented in .env.example
- Guardrails and Do-NOT sections are clear and properly scoped

Out of scope:
- None. File is docs-only, affecting no source code, config, migrations, or actual .env.example

## PR metadata

- Changed files: 1 (all additions, no deletions or modifications)
- Additions: 77 lines
- Diff matches title (staging a prompt file, not executing it)
- PR body accurately describes the finding and scope

## CI status

- CodeQL: success
- PR gates (diff checks): success
- Web build/lint: success
- Data model generator sanity: success
- CodeQL analyze: success
- tendering-e2e: in_progress (not affected by docs-only change)
- API lint/test: in_progress (not affected by docs-only change)

The in-progress checks are unrelated to this change and will not affect the merge. The completed checks all pass.

## Prompt quality verification

- Prompt file has proper YAML front-matter with all required keys
- Premise is testable (grep for env var absence)
- Done-when is clear and testable (three grep checks for presence)
- Scope limit is correct (only .env.example, size=1)
- Gate allow is set (env-vars) — future fired PR will need GATE-ALLOW marker in body
- Guardrails section correctly warns: do NOT touch xero.config.ts, do NOT modify other env keys
- Do NOT section aligns with prompt intent (docs-only, no code changes)

## Self-verification claims

The prompt file itself will be executed later. This PR is staging it, not executing it. The guardrails within the prompt (done-when checks, Do NOT constraints) are well-formed and will be evaluated when the prompt fires.

## Risks Marco should know

None detected. This is a pure metadata/docs addition with no code, config, or schema implications. The prompt instructs future work correctly and guards against common mistakes (modifying source code or reordering env keys).

## Recommendation

Merge once CI completes. This is a safe-to-merge documentation staging PR with no runtime impact.
