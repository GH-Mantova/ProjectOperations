# PR #690 blocked: one prompt incorrectly marked for deletion

PR #690 ("chore(queue): bin 8 armed prompts whose work has already shipped") includes pr-qa-permission-registry-coverage-guard-ready.md in its 8 deletions, but the linter confirms this prompt's premise is still TRUE (file does not exist) and correctly classifies it as ADMIT (needed). The other 7 prompts are correctly identified as STALE. Re-fire the prompt to delete only the 7 shipped prompts.

See docs/pr-reviews/pr-690-review.md for full findings.
