PR #1156 merge blocked: merge commit contains unintended file deletions (LocationProvider.ts, LocationProvider.test.ts, pr-fix-1151 prompt file) that would break the repository if merged. These files exist on main and are unrelated to F-7 scope. Re-fire the prompt on a clean branch or manually restore the deleted files then force-push.


---

## SUPERSEDED 2026-08-18 08:xx - verified against the live PR, this block no longer holds

The deletion claim above does NOT reproduce. Pulled the PR's file list from the GitHub API:
**9 files, every one 'added' or 'modified', ZERO deletions.** No LocationProvider.ts, no
LocationProvider.test.ts, no pr-fix-1151 prompt file.

This block was written 2026-08-17 08:57Z; the PR was updated at 14:40Z - a later merge from main
resolved it. Do NOT re-fire the prompt on a clean branch on the strength of this block.

The PR's real remaining state: CP-11 was failing as 'undeclared migrations', but the body has
since been corrected to carry a bare column-0 'GATE-ALLOW: migrations' marker. The failing gate
run was stale (14:40:53Z, against the old body); a re-run was queued 2026-08-18. After that only
CP-26 (the do-not-merge label) should remain, which is Marco's to release.

