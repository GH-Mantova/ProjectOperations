---
premise: 'grep -q "@@unique(\[name\])" apps/api/prisma/schema.prisma'
premise_means: Site @@unique([name]) is still present in schema.prisma — MIG-1 has not shipped.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - docs/data-model/**
  - docs/data-model/tender-migration/MIG-1-DONE.md
done_when: pnpm build && pnpm lint && ! grep -q "@@unique(\[name\])" apps/api/prisma/schema.prisma && test -f docs/data-model/tender-migration/MIG-1-DONE.md
size: 6
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: additive/reversible — re-adding @@unique([name]) on Site and generating the inverse migration restores prior state; no data transformation performed, so no data loss on rollback.
---

GATE-ALLOW: migrations

# MIG-1 — Drop `Site @@unique([name])`

**Binding plan:** `docs/plans/tender-tracker-migration-plan.md` (read it in full before starting).
This is **MIG-1**, the first slice of the legacy estimating-tracker migration program. It removes
a unique constraint that would block MIG-2 from creating stub Sites for imported tenders (D4 in
the plan). No product code, no service, no controller in this slice — schema + migration + map
regen + landed marker.

**Why:** the ERP has always had one project per Site, so `@@unique([name])` on `Site` has held.
Once MIG-2 imports 540 tenders and creates a name-only stub Site per tender (per D4), the
constraint will conflict with real-world duplicate project names and multiple stub sites sharing
a client. Sites are not unique in reality — Marco: *"sites/addresses are NOT unique — the auto
ID is the key; you revisit addresses over years."*

## STANDING AUTHORITY

**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails

One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never
ask a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
`pnpm build` and `pnpm lint` must pass.

---

## Grounded state on main (verified 2026-08-12)

- `apps/api/prisma/schema.prisma` — `model Site` at ~line 829, declares `@@unique([name])` at
  ~line 857.
- Data-model map generator at `scripts/data-model/build-relationship-map.mjs` produces the three
  artifacts under `docs/data-model/` (`relationship-map.json`, `relationship-map.md`,
  `metadata-catalog.json`). CI runs `build-relationship-map.mjs --check` and hard-fails on stale
  maps (sank #593). Regenerate + commit in the same PR.

## What to build

### 1. Schema — remove the unique constraint

In `apps/api/prisma/schema.prisma`, `model Site` (around line 829): delete the
`@@unique([name])` line. Leave the `@@index([clientId])` and `@@map("sites")` lines intact.

Do NOT touch any other model. Do NOT remove `Site.name`'s `String` type (name stays required —
we are only dropping the uniqueness constraint, not the column).

### 2. Migration

Create a new Prisma migration folder (Prisma's `migrate dev` convention — timestamp prefix):
`apps/api/prisma/migrations/<YYYYMMDDHHMMSS>_drop_site_name_unique/migration.sql`.

The SQL body drops the index. The exact index name is emitted by Prisma as
`sites_name_key` (Postgres convention: `<table>_<column>_key`). Verify by grepping any prior
Site migration or by inspecting current CREATE UNIQUE INDEX statements. Use:

```sql
DROP INDEX IF EXISTS "sites_name_key";
```

`IF EXISTS` makes the migration safe on any environment where the index has already been
manually dropped. No data transformation, no backfill.

### 3. Regenerate + commit the data-model map

Run:

```
node scripts/data-model/build-relationship-map.mjs
```

Commit the three regenerated artifacts:

- `docs/data-model/relationship-map.json`
- `docs/data-model/relationship-map.md`
- `docs/data-model/metadata-catalog.json`

If the CI drift check (`build-relationship-map.mjs --check`) does not pass locally after the
regen, DO NOT hand-edit the artifacts. Re-run the generator.

### 4. Landed marker

Create `docs/data-model/tender-migration/MIG-1-DONE.md` — a one-page note recording:

- What shipped: dropped `Site @@unique([name])`.
- Migration name (timestamp + slug).
- Rationale (link to D4 in `docs/plans/tender-tracker-migration-plan.md`).
- Downstream: MIG-2 (`docs/pr-prompts/pr-mig-s2-tender-import-ready.md`) chains on this file
  via `requires_file_on_main`.

This file is the anchor MIG-2 chains on. **It MUST exist by end of PR** or MIG-2 will never
dequeue.

### 5. Gate marker

Include `GATE-ALLOW: migrations` as a bare line at column 0 of the PR body (CP-11). The
front-matter already declares `gate_allow: migrations`; the PR-body marker is a separate
requirement (per PROMPT-SCHEMA §"IF A PROMPT TOUCHES schema.prisma"). Do NOT prefix it with
`##` or add a trailing period.

## Do NOT

- Do NOT rename `Site.name` or change its type. This slice only drops the unique constraint.
- Do NOT touch any other model, any service, any controller, or any test. This is a
  schema-only slice.
- Do NOT add a data backfill — the migration is additive/reversible and has `backfill: false`.
- Do NOT hand-edit the generated `docs/data-model/*.json` / `*.md` — re-run the generator.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint, seed data, or any file outside declared scope.
- Do NOT use `requires_merged` — future slices chain via `requires_file_on_main`.
