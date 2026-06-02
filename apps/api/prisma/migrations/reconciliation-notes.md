# Migration drift reconciliation — 2026-06-02

This note documents the drift between the dev DB and the migration history
that accumulated across PRs #117/#134/#136/#137/#139/#141, and the
reconciliation migration `20260602084115_chore_reconcile_drift` that resolves
it ahead of the first Azure `prisma migrate deploy`.

## Diff sources

Two `prisma migrate diff` runs (both with a fresh shadow DB):

1. `--from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma`
   → 258-line SQL script — the canonical drift between what migrations
   produce on a clean replay and what the schema model declares.
2. `--from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`
   → 261-line SQL script — drift between the live dev DB and the schema model.

The two scripts are essentially identical (off by a single `ADD COLUMN` for
`projects.required_qualifications`, which is the still-unapplied pending
migration `20260601150000_feat_project_required_qualifications`).
Diff (1) is the one we have to fix in migration history.

## Categorised drift

### Bucket (A) — forward additive / corrective (rolled into reconciliation migration)

**39 foreign-key constraints with refreshed `ON DELETE` semantics** across:
client_quotes (4), clients (1), compliance_alerts (1), contacts (1),
credit_applications (4), entity_insurances (2), entity_licences (2),
gantt_tasks (2), hazard_observations (3), quote_assumptions (2),
quote_cost_lines (1), quote_cost_options (1), quote_emails (2),
quote_exclusions (1), quote_provisional_lines (1), safety_incidents (3),
scope_cards (2), scope_of_works_items (1), subcontractor_documents (2),
subcontractor_suppliers (1), worker_qualifications (2).

Pattern: `DROP CONSTRAINT IF EXISTS … ; ADD CONSTRAINT … REFERENCES … ON DELETE
{Cascade|SetNull|Restrict} ON UPDATE CASCADE;` — bringing the FKs in line
with the relation cascade rules currently declared in `schema.prisma`.

**5 `ALTER COLUMN` corrections**:
- `document_links.module` — drop stale default
- `notification_trigger_configs.recipient_roles` / `recipient_user_ids` — drop stale defaults
- `scope_cards.created_at` / `updated_at` — `TIMESTAMP(6)` → `TIMESTAMP(3)` precision
- `scope_cards.updated_at` — drop stale default
- `subcontractor_suppliers.categories` — drop stale default

**1 index rename**:
- `estimate_cutting_rates_…_depth_mm_ke` (legacy Postgres 63-char
  truncation of `_mm_key`) → `…_depth_m_key` (Prisma's current auto-name).

### Bucket (B) — stale (in DB but not in schema)

- `workers.employmentType` — **camelCase orphan column** alongside the
  correctly mapped `employment_type`. The schema field
  `employmentType` maps to `employment_type` (snake_case), so the
  camelCase column has no readers/writers. Grep across `apps/api/src` and
  `apps/web/src` confirms all four code references resolve via Prisma to
  the snake_case column. Safe to drop.
- `tender_clients_contract_issued_idx` — orphan index. The schema declares
  only `@@index([clientId])` and `@@index([isAwarded])` on `TenderClient`;
  no index on `contractIssued`. No code references it (indexes aren't
  referenced from code anyway). Safe to drop.

### Bucket (C) — cosmetic

None worth deferring. The index-rename (A) is the only cosmetic-looking
item and it gets folded in because Prisma's diff treats it as drift and
will keep re-flagging until reconciled.

## Idempotency

Every statement in the reconciliation migration uses an `IF EXISTS` /
`IF NOT EXISTS` guard, or is wrapped in a `DO $$ … EXCEPTION … $$` block.
This lets the same SQL apply cleanly to:

- The drifted dev DB (which has the legacy FKs, orphan column, and
  orphan index already in place); AND
- A fresh `prisma migrate reset && prisma migrate deploy` run, where the
  orphan column and orphan index were never created by any prior
  migration.

## Verification

After applying the reconciliation migration, the canonical diff:

```
prisma migrate diff \
  --shadow-database-url … \
  --from-migrations apps/api/prisma/migrations \
  --to-schema-datamodel apps/api/prisma/schema.prisma \
  --script
```

returns the empty-migration comment, and a full `migrate reset && migrate
deploy` produces a DB whose `migrate diff --from-schema-datasource …
--to-schema-datamodel …` is also empty.

## Scope

- **No** existing migration files were modified (the prompt's rule about
  in-place edits is observed).
- **No** changes to `schema.prisma` (the schema is already the source of
  truth — the reconciliation only brings the migration history up to it).
- **No** changes to any `apps/*` source files, seed, or DTOs.
