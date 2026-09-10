# PR #844 — Fix-forward escalation

**Status:** FIX-FORWARD — content is correct, but merge is blocked by stalled CI check.

**Action:** Cancel the hung Playwright e2e job (run 30767518325, started 2026-08-02 21:16:37, still IN_PROGRESS after 10+ hours). Once canceled, the PR merges cleanly (all code-adjacent checks pass).

**Why:** This is a docs-only PR (14 prompts + decisions record); it should never trigger e2e tests. The workflow lacks path filters to skip docs-only PRs. Canceling the stalled job unblocks this merge; a separate follow-up workflow fix should add path filters to prevent future e2e runs on docs-only changes.

**No re-fire needed.** All content is staged correctly and follows house style.
