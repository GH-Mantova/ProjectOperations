# Finding — Schema drift between schema.prisma and migrations folder

**Severity:** CRITICAL
**Discovered:** 2026-06-09, Phase 0 setup, before sanity check began
**Module:** Platform Foundation (Prisma migration discipline)

## Symptom

Running `pnpm prisma:migrate` (which expands to `prisma migrate dev` per the
api package script) on a freshly-pulled, clean main branch triggers Prisma's
"Enter a name for the new migration" interactive prompt. Prisma has detected
that `apps/api/prisma/schema.prisma` contains schema changes that are NOT
captured in any of the 102 migration files in `apps/api/prisma/migrations/`.

Meanwhile, `prisma migrate status` reports "Database schema is up to date!"
and confirms 102 migrations are present and applied.

## Verification

```powershell
# Working tree is clean
git status apps/api/prisma/schema.prisma
# > nothing to commit, working tree clean

# No local diff
git diff apps/api/prisma/schema.prisma
# > (empty)

# But migrate dev wants a new migration
pnpm prisma:migrate
# > "Enter a name for the new migration:"
```

That sequence proves the drift exists in the committed main, not in an
uncommitted local edit.

## Why this matters

1. **Production deploys will be wrong.** `prisma migrate deploy` (the
   production-safe apply command) only runs what's in the migrations folder.
   If `schema.prisma` has additional columns/tables/indexes the migrations
   don't, the deployed DB will be missing them — and any application code
   reading those columns will get runtime errors.

2. **Fresh clones break.** Anyone running `pnpm prisma:migrate` on a fresh
   clone gets the same interactive prompt. Onboarding any new developer
   would mean they either invent a migration name (creating a
   not-version-controlled migration on their machine) or skip the step.

3. **The cause is a recently-merged PR that forgot its migration.** Per
   CLAUDE.md project rules: *"Migration files committed in the same commit
   as the schema change."* Some PR in the recent merge wave changed
   `schema.prisma` without shipping the corresponding migration. The watcher
   queue or the PR author missed the gate.

## To diagnose which PR introduced the drift

```powershell
# Generate the SQL diff that would be needed to bring migrations up to schema
pnpm --filter @project-ops/api exec prisma migrate diff `
  --from-migrations apps/api/prisma/migrations `
  --to-schema-datamodel apps/api/prisma/schema.prisma `
  --script
```

That SQL tells us exactly what tables/columns are in `schema.prisma` but not
in any migration file. Once we see the diff, `git log -p apps/api/prisma/schema.prisma`
limited to the affected lines will identify the PR that introduced them.

## Recommended fix

A reconciliation PR (similar to PR #289 from the 2026-06-02 set, which closed
a previous drift):

1. Generate the missing SQL via `prisma migrate diff` (see above).
2. Create a new migration file:
   `apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_chore_reconcile_schema_drift/migration.sql`
3. Paste the generated SQL.
4. Test against a fresh DB: `prisma migrate reset --force` should now complete
   without the new-migration prompt.
5. PR title: `[Chore] Reconcile schema.prisma <-> migrations drift`
6. Reviewer: GH-Mantova, no auto-merge.

## Workaround for Phase 0

For the sanity-check work happening immediately after this finding, run
`prisma migrate reset --force --skip-generate` to drop and rebuild from
migration files. That leaves the DB matching the *migration history* (not
schema.prisma), which is the canonical production state. The drift will be
invisible to the running app — but it will reappear on the next
`migrate dev` run.

## Related

- CLAUDE.md "Prisma discipline" section
- PR #289 — previous drift reconciliation (2026-06-02)
- This finding belongs to the queued PR-FIX-QUEUE.md
