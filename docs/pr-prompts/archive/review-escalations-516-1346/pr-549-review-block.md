## PR #549 — CP-11 gate format error

The PR adds a migration for the company-profile feature, but the `GATE-ALLOW: migrations` marker in the PR body is malformed. The gate parser requires the marker at column 0 (bare `GATE-ALLOW: migrations`), but the PR declares it as `## GATE-ALLOW: migrations` (markdown heading prefix). This prevents the CI gate from recognizing the legitimate exception.

**Fix:** Edit the PR body to move the marker to column 0. Delete the line `## GATE-ALLOW: migrations` and replace it with a bare `GATE-ALLOW: migrations` line at column 0 (e.g., immediately after the ## Why section closes, or anywhere else at column 0 in the body). Then close/reopen the PR or add an empty commit to trigger a fresh CI run. CP-11 will pass, and the PR can merge.

Scope and substance of the PR itself are solid — all other checks (build, lint, tests, e2e, compliance, data-model drift) are green.
