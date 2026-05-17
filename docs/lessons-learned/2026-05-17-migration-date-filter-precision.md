# Migration date-filter precision

**Date:** 2026-05-17
**PRs:** #188 (the migration), #190 (subsequent housekeeping —
unrelated but adjacent in the timeline)
**Severity at time:** Codex P2. No data lost in dev or CI.

## What happened

PR #188 (B-followup) shipped a migration that deletes
pre-B4b orphan cutting rows before adding a NOT NULL
constraint on `cutting_sheet_items.card_id`. The DELETE was
date-bounded for safety: anything older than B4b's merge
time was assumed to be a legitimate pre-card-scoping orphan
(and safe to delete); anything newer would be a bug worth
investigating, and would block the migration via the
subsequent NOT NULL ALTER instead of being silently
destroyed.

B4b actually merged at 2026-05-17 07:30:39 UTC. The
migration's date filter used `2026-05-17 07:30:00+00`, which
is 39 seconds earlier. Codex's review of PR #188 caught the
discrepancy:

> "Use exact B4b cutoff when deleting cardless cutting rows.
> The migration comment says the safety boundary is
> 2026-05-17 07:30:39 UTC, but the predicate currently uses
> 07:30:00+00, which widens the delete window and can silently
> remove post-B4b rows created in the first 39 seconds after
> release."

## Why it matters

The entire purpose of the date filter was to fail loud on
post-B4b orphans — they shouldn't exist (B4b's create paths
all wire cardId), but if they do, the NOT NULL constraint
addition that follows the DELETE should fail and force
investigation. With the cutoff 39 seconds too early, any
orphan created in that 39-second window would have been
deleted, and the NOT NULL ALTER would then succeed cleanly —
silently destroying data that the safety guard was supposed
to protect.

Blast radius in this specific case: zero. The dev DB had 2
orphans, both from 2026-05-16 (well before either timestamp).
CI shadow DB was empty. No data was harmed.

Blast radius in a parallel universe where another developer
or a staging environment had an orphan in that 39-second
window: silent data loss, the migration would succeed, no
alert would fire, and we'd only notice if the row's absence
caused a downstream failure days or weeks later.

## Lesson

For date-bounded delete migrations (any migration where the
safety property is "delete X but only if X is older than
timestamp T"):

- Use the EXACT timestamp T, never a rounded-down minute or
  hour. PR merge SHAs and their timestamps are available
  verbatim from `git log --format=%cI <sha>` or from the
  GitHub API. There is no good reason to round.
- State T's exact value in the migration comment AND in the
  WHERE clause. If they don't match, treat that as a bug,
  not a stylistic choice.
- Treat the safety filter as the rolling-back contract: any
  slack in the filter widens the destructive window. The
  whole point is that the window is narrow.

## References

- PR #188: https://github.com/GH-Mantova/ProjectOperations/pull/188
- Codex review comment chain: on PR #188 (look for "P2" or
  "exact B4b cutoff" in review threads)
- Migration file: `apps/api/prisma/migrations/20260517090000_b_followup_cardid_not_null/migration.sql`
- B4b merge SHA (the cutoff): `fe39e27`, merged 2026-05-17 07:30:39 UTC
