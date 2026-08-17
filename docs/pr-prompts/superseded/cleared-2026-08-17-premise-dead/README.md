# Cleared 2026-08-17 ÔÇö premise dead

Both prompts were armed in `docs/pr-prompts/` but could never dequeue. Verified by running the
intake linter against each on origin/main aefbe227.

## pr-gate-a-backfill-lint-rule-ready.md ÔÇö STALE
Its premise asserts that Gate A's intake lint is not built. It was built and merged in #937, so the
linter bins the prompt before spawning an agent: "The work is ALREADY DONE."

## pr-pr-master-hardening-slice0-ready.md ÔÇö REJECT, and premise also stale
It was written to add the `DESTRUCTIVE_MUST_ESCALATE` rule. That rule is already on main, so its
premise (`! grep -q "DESTRUCTIVE_MUST_ESCALATE" scripts/pipeline/lint-prompt.mjs`) is false. It also
trips the very rule it introduced, on the literal signal quoted in its own prose.

Neither was hazardous; both were queue noise that would have produced quarantine artifacts the first
time the watcher walked the queue. Retired rather than left to self-bin so the queue is clean before
the lanes restart.
