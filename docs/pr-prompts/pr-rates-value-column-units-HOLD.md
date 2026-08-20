---
premise: grep -q 'VALUE., sortOrder' apps/api/prisma/seed-initial-services.ts
premise_means: At least one seeded VALUE column still has no unit, so assertStructure refuses every column add/edit on its table.
scope:
  - apps/api/prisma/seed-initial-services.ts
  - apps/api/prisma/migrations/**
  - apps/api/test/canonical/CP-08-seed-idempotency.spec.ts
done_when: pnpm build && pnpm lint && bash -c "! grep -q 'VALUE., sortOrder' apps/api/prisma/seed-initial-services.ts"
size: 3
gate_allow: migrations
seed_only: false
escalates: true
cluster: rates-column-hygiene
cluster_order: 1
rollback_strategy: 'Migration only sets rate_columns.unit on the three VALUE columns named Rate in the plant/fuel/enclosure tables, matched by (rate_table_id via slug, name, role) and guarded on unit IS NULL OR unit = per the corrected SQL in step 2. To revert: the same statement with SET unit = NULL and the guard dropped. Nothing depends on the value, so leaving it applied is harmless if the run dies mid-flight.'
---

# Give the three unit-less VALUE columns a unit

## The problem, precisely

`RateValidationService.assertStructure` (`apps/api/src/modules/rates/rate-validation.service.ts`)
throws `VALUE column "<name>" requires a unit (e.g. hr, m, tonne)` when any VALUE column has a
null or blank unit. Both `RateTablesService.createColumn` and `updateColumn` call it against the
**merged** column set, so a single unit-less column makes **every column add and every column
edit on that table fail** — not just an edit of the offending column.

Three seeded tables are in that state. Every other seeded table sets units correctly, which is
what makes this a copy-paste omission rather than a design choice:

| slug | column | current | should be |
|---|---|---|---|
| `plant` | `Rate` | *(null)* | `day` |
| `fuel` | `Rate` | *(null)* | `day` |
| `enclosure` | `Rate` | *(null)* | `day` |

Re-verified on `origin/main` `6bf3614d` (2026-08-20): **16 VALUE columns declared in the seed, 13
with a unit, 3 without.** An earlier draft of this prompt said "3 without, 9 with" — that undercount
missed the four multi-line `rt-exc-prod` column specs (all four do carry units). The fix list below
is unaffected; only the tally was wrong. The premise
pattern is `VALUE., sortOrder` (the `.` stands in for the closing quote) — deliberately written
without a `: ` sequence, because a colon-space inside an unquoted YAML scalar breaks front-matter
parsing and the prompt would never reach the lint.

The web page surfaces this as a red "Structure issues" banner reading *"Fix these before adding
rows — the server will reject writes until the structure is valid."* **That banner overstates
it** — `createRow`/`updateRow` call `validateRow`, which never inspects units, so row edits work
fine today. Only column operations are blocked. Do not change the banner in this PR.

## Why `day` for all three

`plant` rows already carry the literal string `"day"` in their own INFO `Unit` cell (and
`"each way"` for the two Plant float rows). `labour` — the closest analogue — uses `unit: "day"`
on all three of its VALUE columns. `fuel` and `enclosure` are likewise per-day rates.

The INFO `Unit` column stays exactly as it is. It is per-row free text; the VALUE column's `unit`
is per-column metadata. They are different things and both are wanted.

## What to build

1. **`apps/api/prisma/seed-initial-services.ts`** — add `unit: "day"` to the three VALUE column
   specs, matching the shape `labour` already uses. They are the only three lines matching
   `role: "VALUE", sortOrder`:
   - the `plant` table's `{ key: "rate", name: "Rate", ... sortOrder: 4 }`
   - the `fuel` table's `{ key: "rate", name: "Rate", ... sortOrder: 3 }`
   - the `enclosure` table's `{ key: "rate", name: "Rate", ... sortOrder: 3 }`

2. **A new migration** under `apps/api/prisma/migrations/` — production runs
   `prisma migrate deploy` and **never runs the TypeScript seed** (CP-23; the same reasoning is
   written into `20260713140000_seed_baseline_rate_tables/migration.sql` and
   `20260804120000_grant_field_worker_expenses/migration.sql`). A seed-only change never reaches
   production. Set the unit on the three columns, guarded so a re-run is a no-op:

   **Do NOT key this migration on the literal column ids.** ⚠️ Corrected 2026-08-20 after a
   re-measure. The seed's upsert (`seed-initial-services.ts:3644`) matches on
   **`rateTableId_name`**, and sets `id: colId` **only in its `create` branch**
   (`:3641` `const colId = \`${spec.id}-c-${col.key}\`;`, used at `:3652`). So a `rate_columns` row
   created by any other path — the admin UI's `createColumn`, most obviously — carries a **cuid**
   under that same name, not `rt-plt-c-rate`. A migration keyed on the literal id would then
   silently update nothing and still exit 0, leaving the table's column operations broken with a
   green deploy. Confirming the ids *statically against the seed source* does not catch this,
   because the source is right and the row is different.

   Key on the same unique constraint the seed itself uses:

   ```sql
   UPDATE "rate_columns" c SET unit = 'day', updated_at = NOW()
   FROM "rate_tables" t
   WHERE c.rate_table_id = t.id
     AND t.slug IN ('plant', 'fuel', 'enclosure')
     AND c.name = 'Rate'
     AND c.role = 'VALUE'
     AND (c.unit IS NULL OR c.unit = '');
   ```

   Still idempotent, and correct whichever path created the row. **Assert the row count you
   updated** and fail the migration if it is zero — a no-op here means the assumption is wrong and
   you want to know at deploy time, not from a support ticket.

3. **`apps/api/test/canonical/CP-08-seed-idempotency.spec.ts`** — add an assertion that after
   seeding, **zero** RateColumn rows with `role = 'VALUE'` have a null or blank unit. Assert the
   invariant, not the three names, so the next table that forgets a unit is caught too.

   **The test name or its describe block MUST contain the literal token `VALUE_COLUMNS_HAVE_UNITS`.**
   This is not decoration: the next slice in this cluster gates on that exact string being present
   on `origin/main`, so it is the proof-of-landing marker. A marker that proves nothing is how a
   one-line stub once armed a destructive successor — this one is attached to a real assertion.

## Do NOT

- Do not touch the INFO `Unit` column on any table.
- Do not change the "Structure issues" banner text or `validateColumnStructure` in
  `apps/web/src/pages/admin/ratesListsHelpers.ts` — the client mirror is already correct.
- Do not add units to any other table; the other **thirteen** VALUE columns already have them.
- Do not rename, reorder, or re-type any column.
- Do not touch `/sot/`.

## PR body must contain

`GATE-ALLOW: migrations` as a **bare line at column 0** (CP-11 hard-fails an undeclared
migration; the `##` and trailing-period forms do not match its regex).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if you cannot proceed, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in this run.
- Read the job log before diagnosing any CI failure.
- `escalates: true` gates the MERGE, not the RUN. Open the PR; Marco removes `do-not-merge`.
