---
premise: grep -q "if (!required) return;" apps/api/src/modules/platform/timeline.controller.ts
premise_means: The timeline notes endpoint still fails OPEN for entity types missing from its VIEW_PERMISSIONS map.
scope:
  - apps/api/src/modules/platform/timeline.controller.ts
  - apps/api/src/modules/platform/*.spec.ts
done_when: pnpm build && pnpm lint && ! grep -q "if (!required) return;" apps/api/src/modules/platform/timeline.controller.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# SECURITY: timeline notes must fail CLOSED for unknown entity types

## The defect (system audit 2026-07-31, verified on origin/main)

`apps/api/src/modules/platform/timeline.controller.ts:78-85` — `ensureViewer` looks up the
required permission per entity type and at `:81` does `if (!required) return;` — any entity type
NOT in `VIEW_PERMISSIONS` passes with no permission at all. `POST :entityType/:entityId/notes`
(:64) writes through this. Fail-closed is the rule (sot/01 SECTION 6).

## What to build

1. Unknown entity type → throw `ForbiddenException` (fail closed), for both reads and the note
   write. Known types keep their existing mapped permission unchanged.
2. Spec: unknown entityType → 403; known types unchanged.

NOTE (out of scope, flagged for Marco): the note WRITE is authorised by the entity's VIEW
permission — write-via-read is a design question; do not change it here.

## Do NOT

- Do NOT add/remove entries in VIEW_PERMISSIONS.
- Do NOT change the write-requires-view behaviour for known types.
- Do NOT touch schema, seeds, frontend.

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "if (!required) return;" apps/api/src/modules/platform/timeline.controller.ts`
- API unit tests pass.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
