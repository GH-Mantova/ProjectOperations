# Claude Code prompt — Investigate & resolve PilotFeedback schema drift

Branch: `fix/pilot-feedback-schema-drift` (only if a fix is confirmed needed)
Reviewer: `GH-Mantova`

## Context

The data-model map generator flagged a dangling relation: in
`apps/api/prisma/schema.prisma`, the `User` model has

```
pilotFeedback  PilotFeedback[]  @relation("PilotFeedbackUser")
```

but there is **no `model PilotFeedback` block** anywhere in the schema. Meanwhile
these exist:

- Migration `apps/api/prisma/migrations/20260616120000_pilot_feedback/migration.sql`
- Module `apps/api/src/modules/pilot-feedback/` (controller, service, module, tests)

A relation to an undefined model makes `prisma generate` / `prisma validate`
fail, so either the model block was dropped by a bad merge/rebase, or the working
tree is in a partial state.

## Steps (in order — diagnose before changing anything)

1. `git fetch origin`. On a clean `origin/main` checkout, confirm the exact state:
   - `grep -n "model PilotFeedback" apps/api/prisma/schema.prisma`
   - `npx prisma validate --schema apps/api/prisma/schema.prisma`
   Report what you find. If `prisma validate` PASSES and the model exists on
   `main`, then the drift was only in a local working tree — STOP and report
   "no fix needed on main".

2. If the model is genuinely missing on `main`, reconstruct the intended
   `model PilotFeedback` from the authoritative sources, in this priority order:
   a. The migration SQL (`20260616120000_pilot_feedback/migration.sql`) — the
      table name, columns, types, nullability, defaults, and FK to `users`.
   b. The Prisma types the module code expects (`prisma.pilotFeedback.*` calls in
      `apps/api/src/modules/pilot-feedback/`), for field names and relations.
   Build the model block to match the migration exactly (column `@map` names,
   `@relation("PilotFeedbackUser", fields: [...], references: [id])` back to User,
   `@@map("pilot_feedback")`). Do NOT invent fields the migration doesn't have.

3. Create the branch `fix/pilot-feedback-schema-drift`, add the model block to
   `schema.prisma`. Do not create a new migration if the table already exists via
   `20260616120000_pilot_feedback` — the schema must simply describe the existing
   table. Verify with `npx prisma validate` then `npx prisma generate`.

4. Regenerate the data-model map so it reflects the restored model:
   `node scripts/data-model/build-relationship-map.mjs`
   (This step assumes `chore/data-model-map` has merged; if not, skip and note it.)

5. Run the checks: `pnpm --filter @project-ops/api lint`,
   `pnpm --filter @project-ops/api test` (at least the pilot-feedback specs),
   `pnpm build`, and `pnpm compliance:smoke`. All must pass. Confirm
   `pnpm seed` still runs idempotently.

6. Commit (schema change only; migration already exists) and open the PR with a
   **Data-model impact** section: model restored, FK edge User -> PilotFeedback,
   root cause (dropped block), and how validate/generate now pass.

## Do NOT

- Do not delete the migration or the module to "resolve" the dangling relation —
  the table and code are real; the schema is what's missing.
- Do not edit `roadmap.md` / `progress.md` / `project_instructions.md`.
- If diagnosis in step 1 shows `main` is fine, do not open a PR — just report.
