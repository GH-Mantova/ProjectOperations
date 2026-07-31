---
premise: grep -q "/workers?limit=200" apps/web/src/pages/field/FieldDocketPage.tsx
premise_means: The field docket form still fills its Driver select from the WorkerProfile endpoint whose ids do not satisfy Docket.workerId's FK to Worker — every submission fails.
scope:
  - apps/web/src/pages/field/FieldDocketPage.tsx
done_when: pnpm build && pnpm lint && ! grep -q "/workers?limit=200" apps/web/src/pages/field/FieldDocketPage.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIX: field docket capture selects the wrong worker entity — submissions cannot succeed

## The defect (system audit 2026-07-31, verified on origin/main)

`apps/web/src/pages/field/FieldDocketPage.tsx:79` fills the "Driver (Worker)" select from
`GET /workers?limit=200`, which serves **WorkerProfile** rows (`workers.service.ts:57`
`prisma.workerProfile`). But `Docket.workerId` FKs the **Worker** table
(`schema.prisma` Docket block) and `docket.service.ts:30-34` does `prisma.worker.findUnique` →
`NotFoundException("Worker not found")` on every submit. Compounding it: for a field-worker role
the fetches 403 and the errors are swallowed by an empty catch (`:96`), silently degrading to a
free-text "Worker ID" input that also cannot produce a valid id.

## What to build

1. Ground the endpoint that serves **Worker** (the `prisma.worker` table — the resources module
   is the likely owner; verify by reading the controller/service, positive control first). Point
   the Driver select at that endpoint so selected ids satisfy the FK.
2. Stop swallowing the lookup failures (`:96` empty catch): if the selects cannot load
   (permissions or network), show a readable inline notice; keep the manual-entry fallback but
   label it honestly.
3. Verify the fix end-to-end as far as the sandbox allows: unit-level check that the id shape
   used matches `docket.service.ts`'s lookup; note in the PR body what was and wasn't provable.

NOTE (out of scope, flagged for Marco): the seeded Field Worker role lacks the read permissions
these selects need (`resources.view`/`jobs.view`/`assets.view`) — granting them is an
authorization decision; do not change roles or seeds here.

## Do NOT

- Do NOT touch the API, schema, or seeds.
- Do NOT add the page to the field nav (orphan adoption is a separate Marco decision).

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "/workers?limit=200" apps/web/src/pages/field/FieldDocketPage.tsx`
- No empty catch remains around the select-loading fetches.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
