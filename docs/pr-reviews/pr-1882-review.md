VERDICT: MERGE

Scope compliance:
- In scope: docs/pr-prompts/.arming-log.txt (swept for two fix-lane arms), new prompt pr-pr-master-root-known-to-sweep-and-lint-HOLD.md (91 lines, well-formed YAML frontmatter + docstring), two consumed fix-lane prompts retired to superseded/. All files under docs/ only.
- Out of scope: none. This is a Station 00 docs-only publication PR (DOCTRINE 10.2.1, supervised interactive). The prompt's actual implementation (scripts/pipeline/status-sweep.ps1, lint-station.mjs, watcher-loop-check.ps1, PR-MASTER.md file creation) is deferred to a separate execution of the prompt by a code agent.

Self-verification claims (implicit from PR body):
- [pass] .arming-log.txt contains 2 new entries timestamped 2026-09-11T04:39:49Z and 2026-09-11T04:58:35Z for the two fix-lane arms.
- [pass] pr-pr-master-root-known-to-sweep-and-lint-HOLD.md added (91 insertions). YAML parses, premise clause correct (grep -q "PR-Master" scripts/pipeline/status-sweep.ps1), scope and done_when properly specified.
- [pass] Two consumed fix-lane prompts moved to superseded/ (pr-fix-1874-..., pr-fix-1878-...). Files unchanged (0 insertions, 0 deletions), only renamed per git (RENAMED action in file change list).

CI status:
- All checks SUCCESS. Changed-path filters, CodeQL, Tendering Browser Smoke, PR gates, Approval receipt (CP-26), watcher + linter tests, arm-prompt tests all green. Skipped tests (API, web, data model) expected for docs-only PR.

Risks Marco should know:
- None. Docs-only publication. No code changes, no data model, no auth, no client-facing changes.

Recommendation: Marco should merge. This is a routine docs publication of a new prompt and retirement of consumed prompts, with clean CI and proper scope.
