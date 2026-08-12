# MIG-1 — Landed

**Status:** shipped 2026-08-12.

## What shipped

- Removed `@@unique([name])` from `model Site` in `apps/api/prisma/schema.prisma`.
- Prisma migration: `20260812200000_drop_site_name_unique` — `DROP INDEX IF EXISTS "sites_name_key";`.
- Regenerated data-model artifacts: `docs/data-model/relationship-map.json`,
  `relationship-map.md`, `metadata-catalog.json`.

## Why

Per `docs/plans/tender-tracker-migration-plan.md` decision **D4**: MIG-2 imports 540 tenders
and creates a name-only stub `Site` per tender. Real-world project names collide (multiple
projects share a site name over years), so the previous `Site @@unique([name])` constraint
would have blocked MIG-2. Marco: *"sites/addresses are NOT unique — the auto ID is the key;
you revisit addresses over years."*

## Rollback

Additive/reversible. Restoring the unique index is a one-line inverse migration
(`CREATE UNIQUE INDEX "sites_name_key" ON "sites"("name");`) plus re-adding the
`@@unique([name])` line on `model Site`. No data transformation happened, so no data loss on
rollback.

## Downstream

- **MIG-2** (`docs/pr-prompts/pr-mig-s2-tender-import-ready.md`) chains on this file via
  `requires_file_on_main: docs/data-model/tender-migration/MIG-1-DONE.md`. Once this file is
  on `main`, MIG-2 dequeues.
- **MIG-3** (`docs/pr-prompts/pr-mig-s3-sharepoint-legacy-copy-ready.md`) chains on a file
  MIG-2 creates.
