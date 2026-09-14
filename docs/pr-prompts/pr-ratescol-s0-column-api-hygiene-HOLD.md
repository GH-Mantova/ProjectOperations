---
premise: '! grep -q "Pick another name" apps/api/src/modules/rates/rate-tables.service.ts'
premise_means: Renaming a rate column onto a name the table already uses still answers HTTP 500, and the delete-column refusal still tells the user to deactivate rows, which cannot make the delete succeed.
scope:
  - apps/api/src/modules/rates/rate-tables.service.ts
  - apps/api/src/modules/rates/__tests__/rate-tables.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "Pick another name" apps/api/src/modules/rates/rate-tables.service.ts && grep -q "Remove the rows first" apps/api/src/modules/rates/rate-tables.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
module: rates
cluster: ratescol
cluster_order: 1
design_ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
---

# Rates columns S0 - two server answers the column editor cannot work around

**Slice 1 of 5** of the grid-first rates-column cluster (`ratescol`). The mock-up in `design_ref`
(states 8 and 9, and the "Still true, still unresolved" panel) found two server defects while
drawing the column editor. The web slices that follow pre-check both on the client, but the API
answers are wrong for every caller and are two lines each to put right. This slice is those two
lines and their tests. No route, DTO, schema or behaviour change beyond the two messages and the
one status code.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the two files in `scope`.

## Guardrails

- One attempt. If `Pick another name` is already in `rate-tables.service.ts` on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing a failure. `pnpm build` and `pnpm lint` must pass.

## Grounded on main (read first; cite line numbers in the PR body)

- `createColumn` catches the unique-name violation and answers politely - it uses the module's
  `isP2002` helper (`rate-tables.service.ts` ~707-709) and throws a `ConflictException`
  (~170-173). **`updateColumn` (~178-200) has no such catch**: the same P2002 from
  `@@unique([rateTableId, name])` (`schema.prisma` ~6017) reaches `ApiExceptionFilter` and the
  caller gets `500 "An unexpected error occurred."` for a rename onto an existing name.
- `deleteColumn` (~219-228) counts **every** row - `rateRow.count({ where: { rateTableId } })`
  at ~224, no `isActive` filter - and its 409 (~226-228) reads *"Cannot delete column while the
  table has N row(s) — cell keys reference the column and would be orphaned. Deactivate rows
  first."* The refusal is correct (every row's `cells` JSON is keyed on the column id, so the
  column cannot go while rows exist); the advice is not - deactivating rows does not change that
  count, so following it changes nothing. It also says "cell keys" and "orphaned" to an estimator.
- Specs for this service live in `__tests__/rate-tables.service.spec.ts` and mock Prisma with
  `jest.fn()` objects; extend that file, do not create a second one.

## What to build

1. **`updateColumn`** - wrap the `rateColumn.update` in the same `try/catch` shape `createColumn`
   uses. On `isP2002(err)` throw
   `new ConflictException(\`This table already has a column called "${name}". Pick another name.\`)`
   where `name` is the name being saved. Everything else about the method is unchanged.

2. **`deleteColumn`** - keep the count exactly as it is (total rows - the keys reference the
   column whether or not a row is active) and replace only the message:
   `Cannot delete "${existing.name}" while the table has ${rowCount} row(s) — every row stores a value under it. Remove the rows first, or leave the column where it is.`
   Same `ConflictException`, same 409.

3. **Spec** - two new cases in `rate-tables.service.spec.ts`: a P2002 from `rateColumn.update`
   becomes a 409 whose message contains `Pick another name`; a delete on a table with rows
   answers 409 with a message that contains the row count and `Remove the rows first` and does
   **not** contain `Deactivate`.

## Do NOT

- Do NOT change what either method does - only the two messages and the one status code.
- Do NOT add an `isActive` filter to the delete count. The keys are the reason, and inactive
  rows carry keys too.
- Do NOT touch the controller, the DTOs, `rate-validation.service.ts`, the seed or `schema.prisma`.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint.

## VERIFY

```
pnpm build && pnpm lint
grep -q "Pick another name" apps/api/src/modules/rates/rate-tables.service.ts
grep -q "Remove the rows first" apps/api/src/modules/rates/rate-tables.service.ts
pnpm --filter @project-ops/api test -- rate-tables
```

Open the PR titled `fix(rates): S0 - rename clash answers 409 not 500; delete-column refusal drops advice that cannot work`
and leave it UNMERGED.
