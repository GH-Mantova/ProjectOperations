# PR #915 Fix — Remove Merge Commit

PR #915 contains a merge commit (`Merge branch 'main'`) on top of the substantive docs commit. House rule requires single commit per PR. The branch fell out of sync with main and was auto-merged to sync, but this violates the rule before merge.

**Fix:** Rebase the branch to collapse the merge commit:
```
git checkout docs/lock-realtime-tenancy-decisions
git rebase origin/main
git push -f
```

After rebase, the PR will show a single commit (`7aa6cca5 — docs(plans): lock realtime=SSE...`). CI will re-run; after tendering-e2e greens, safe to merge.

This is a follow-up PR fix (no new work needed — the docs content is correct).

