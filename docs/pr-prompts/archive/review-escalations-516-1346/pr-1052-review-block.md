PR #1052 blocked: Postgres enum transaction conflict in migration.

The migration adds new OpportunityStage enum values (open, not_pursued, archived)
with ALTER TYPE ADD VALUE in step 3, then immediately tries to use 'open' in an
INSERT cast in step 4 — all within the same transaction. Postgres forbids this:
new enum values cannot be used until their transaction commits.

Fix: Split into two migrations (enum additions commit first, then data operations),
or rewrite to defer enum casting. This is a standard Postgres enum expansion
gotcha and requires a minor re-fire or manual commit of a corrected migration.

Schema and service code changes are correct; only migration execution is broken.
