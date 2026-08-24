---
premise: grep -qE "^[[:space:]]+siteId[[:space:]]+String\?" apps/api/prisma/schema.prisma
premise_means: siteId is still nullable on Tender/Job/FormSubmission/Project; NOT NULL has not been enforced.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/**
  - apps/api/src/common/tenancy/__tests__/siteid-notnull-backfill.spec.ts
  - docs/data-model/**
done_when: pnpm build && pnpm lint && ! grep -qE "^[[:space:]]+siteId[[:space:]]+String\?" apps/api/prisma/schema.prisma && node scripts/data-model/build-relationship-map.mjs --check
size: 8
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: >-
  PRODUCTION DATA. The backfill UPDATE is idempotent (WHERE site_id IS NULL) and
  re-runnable. The NOT NULL constraint is the irreversible half - reverting means
  dropping the constraints, which restores the previous shape but NOT the
  knowledge of which rows were originally blank. That knowledge lives only in the
  CSV export taken before the migration runs, which is therefore mandatory. If the
  run aborts mid-flight the constraint is simply not applied and it can be re-run
  after investigation.
requires_file_on_main: docs/approvals/siteid-notnull-backfill-approved-by-marco.md
---
<!-- watcher: do-not-arm -->
# HOLD — [Chore] Enforce siteId NOT NULL on Tender/Job/Project/FormSubmission (+ backfill)

STATUS: STAGED, NOT ARMED. Has an open BACKFILL decision (below) — it touches existing rows
and flips a nullable FK to required, so confirm in MAIN chat before arming, then rename to
`pr-siteid-notnull-backfill-ready.md`.

Branch: `chore/siteid-notnull-enforcement`
Reviewer: `GH-Mantova`
Migration: YES — backfill + NOT NULL + FK behaviour change. `GATE-ALLOW: migrations` at
column 0. Full-timestamp migration with inline data backfill. Do NOT auto-merge.

## Context (verified in-repo)

`siteId` is nullable with `onDelete: SetNull` on exactly four models:
`Tender` (schema ~838), `Job` (~1088), `FormSubmission` (~1593), `Project` (~2118). The
roadmap's last-mile list flags this as still Open. Making it required tightens data
integrity but must not orphan or fail on existing null rows.

## Decision required BEFORE arming (take to MAIN chat)

**What is the backfill source for existing rows whose `siteId` is currently NULL?** Options:
- (A) **Derive from a related record** where one exists — e.g. `Job.siteId` /
  `FormSubmission.siteId` from their parent `Project`/`Tender`'s site; `Project`/`Tender`
  from any linked job/site. (Recommended where a deterministic parent exists.)
- (B) **A single "Unassigned" sentinel Site** that null rows point to, seeded idempotently,
  so enforcement can proceed even for rows with no derivable site.
- (C) Some models get A, others B — likely reality: confirm per model.
Also confirm the new `onDelete` for the now-required FK (`Restrict` vs `Cascade` — deleting
a Site should probably be `Restrict` once siteId is mandatory; confirm).

## Scope (once decided)

1. Audit current NULL counts per model on a representative DB and state them in the PR body.
2. Migration: backfill NULLs per the decision, THEN alter each column to NOT NULL and set
   the agreed `onDelete`. One migration, ordered: backfill first, constraint second.
3. Update Prisma schema (`String?` -> `String`, relation optionality) for all four models
   and any DTO/validation that assumed nullable.
4. If any row cannot be backfilled deterministically under option A, do NOT force it —
   STOP and report the count so Marco can choose B for those.

## Verify before PR

- Migration applies cleanly on a fresh seeded DB AND on a DB with pre-existing null rows
  (test both); seed idempotent x2; `compliance:smoke` green; API+web build/lint/test.
- `node scripts/data-model/build-relationship-map.mjs` regenerated + `--check` OK.
- PR body: NULL counts before backfill, backfill strategy per model, new `onDelete`, and a
  **Data-model impact** section.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Every scope limit stated above still applies. A scope limit is **not** a reason to stop
before pushing.
