VERDICT: REJECT-AND-REDO

Scope compliance:
- In scope: .vscode/tasks.json task definition replaced with call to new script in dry-run mode (✓), scripts/branch-prune.ps1 created with 644 lines covering all six exclusion rules (✓), test file scripts/pipeline/__tests__/branch-prune.test.mjs added with PART A/B/C coverage (✓), merge-approvals receipt 1756.md documenting standing authority (✓).
- Out of scope: None identified.

Self-verification claims:
- `test -f scripts/branch-prune.ps1`: ✓ File exists in diff
- `grep -q "DryRun" scripts/branch-prune.ps1`: ✓ Confirmed in diff, `[switch]$DryRun` parameter present
- `! grep -q "branch -D" .vscode/tasks.json`: ✓ Confirmed, old force-delete fall-through removed entirely
- PR body claims "pipeline tests 171 → 200, all pass, skipped 0": ✗ FAILED — Windows CI ran 223 tests, 222 PASS, 1 FAIL, skipped 0. Test #21 "A: for-each-ref %(upstream:track) is the field that says [gone]" failed on line 343 of branch-prune.test.mjs.

Risks Marco should know:
- CI FAILURE — CONFIRMED ROOT CAUSE: The Windows job failed on test 21 with error: "fatal: cannot lock ref 'refs/heads/weird|name.with-stuff': Unable to create ... .lock': Invalid argument". The test attempts to create a git branch named "weird|name.with-stuff" with a pipe character (`|`) in the name. On Windows, the pipe is a reserved character and invalid in filenames; git rejects it. On Linux/Unix, pipe characters are permitted in branch names, so the test passes. The test code is platform-specific but has no skip guard (skip is load-bearing so cannot be used per ci.yml). The fix is to either: (a) use a different branch name without reserved characters, or (b) gate the test on `!IS_WIN`. Since the test validates git behavior (not the .ps1 script), option (a) is preferred to keep the test portable.
- The house rule (CLAUDE.md) requires "build + lint + smoke green" — one RED job = cannot merge. This failure blocks merge even under standing authority.
- The PR was auto-merge-armed but the auto-merge itself was correctly blocked by CI failure (the merge did not occur; PR is still OPEN).

Recommendation: The agent must fix the test to use a branch name valid on Windows (e.g., "weird_name_with_stuff" instead of "weird|name.with-stuff"), then re-fire the prompt or open a fix PR. The branch-prune script itself appears sound; this is purely a test portability issue.
