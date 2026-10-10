VERDICT: MERGE

Scope compliance:
- In scope: Adds `docs/pr-prompts/pr-queue-layout-s2-guard-new-files-HOLD.md` — a HOLD prompt file staging the queue layout guard specification. No code files, no config changes.
- Out of scope: None observed.

Self-verification claims:
- The prompt file is well-formed YAML with all required fields (premise, done_when, scope, size, escalates, module, etc.)
- Prompt correctly designates this as a HOLD file (not armed/ready)
- Marco's rulings (2026-10-02) are documented: line drawn at today, tracked files only, archive/ is reports folder, S3 cancelled
- Scope clearly defines S2 (shared constant + classifyQueuePath) and S4 (CI step); S3 implementation is cancelled per ruling
- Prompt notes follow-up for Station 05 to add SOT entry
- Marked `escalates: true` — will add a CI gate when armed

CI status:
- All checks PASS (green): linter tests, PR gates, approval receipt, pipeline tests, CodeQL all successful. No failures.

Risks Marco should know:
- Historical replay table (required when this prompt is armed per its "Before opening the PR" section) is not in the PR body. This is correct — the table is an instruction to the agent who will arm it, not a requirement for this staging PR. When armed, the agent must run the replay and add the violations table to catch any retroactive issues with the new guard.
- The prompt correctly scopes S2+S4 together, explicitly cancelling S3 (migration). No legacy files move; guard applies only to new/renamed files.
- Extra merge commits in the branch history (3 commits total including 2 merge commits) — not a defect for a docs-only HOLD staging.

Recommendation: Merge. This prompt is well-specified and ready for arming. Station 00 can pick it up when needed.
