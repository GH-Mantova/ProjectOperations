# PR #916 Fix — Remove Merge Commit

PR #916 contains a merge commit (`Merge branch 'main'`) on top of the substantive docs commit. House rule requires single commit per PR. The branch fell out of sync with main and was auto-merged to sync, but this violates the rule before merge.

**Fix:** Rebase the branch to collapse the merge commit:
```
git checkout docs/sot-02-resolve-decisions
git rebase origin/main
git push -f
```

After rebase, the PR will show a single commit (the substantive `docs(sot-02): resolve Â§6 decisions` change). CI will re-run; after all jobs green, safe to merge. This is the same pattern as the PR #915 fix (same day, same root cause — branch sync issue).
