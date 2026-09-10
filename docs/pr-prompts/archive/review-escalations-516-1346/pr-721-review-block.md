PR #721 BLOCKED — Missing gate marker in PR body.

PR body mentions "(`GATE-ALLOW: migrations`)" inline in a descriptive paragraph, but CI gate check CP-11 requires the marker on its own line at column 0 for the regex parser to recognize it. The migration file introduction violates the gate check. Fix: add "GATE-ALLOW: migrations" as a standalone line (column 0) in the PR body, then trigger CI re-run by closing/reopening or pushing an empty commit.
