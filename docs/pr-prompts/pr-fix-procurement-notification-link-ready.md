---
premise: grep -q "linkUrl: \`/procurement/" apps/api/src/modules/procurement/procurement.service.ts
premise_means: Procurement notifications still emit a per-reference deep link although no /procurement/:id route exists — clicking any procurement notification lands on the 404 page.
scope:
  - apps/api/src/modules/procurement/procurement.service.ts
  - apps/api/src/modules/procurement/*.spec.ts
done_when: pnpm build && pnpm lint && ! grep -q "linkUrl: \`/procurement/" apps/api/src/modules/procurement/procurement.service.ts
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# FIX: procurement notifications deep-link to a route that does not exist

## The defect (system audit 2026-07-31, verified on origin/main)

`apps/api/src/modules/procurement/procurement.service.ts:503` emits
`linkUrl: \`/procurement/${reference}\``. The web app has exactly one procurement route —
`/procurement` (`App.tsx:308`); there is no `/procurement/:id`. `NotificationsDropdown.tsx:123`
navigates to `linkUrl` blind, so every procurement notification click lands on `NotFoundPage`.

## What to build

1. Change the emitted `linkUrl` to `/procurement` (the register the user can actually act on).
   If the list page supports any existing query filter that narrows to the referenced item,
   ground it first and use it; do NOT invent a new query param the page doesn't read (that is
   exactly the ?highlight= anti-pattern this audit flagged app-wide).
2. Update any spec asserting the old URL.

## Do NOT

- Do NOT add a /procurement/:id route or page (feature work, separate decision).
- Do NOT touch other notification emitters.

## VERIFY

- `pnpm build && pnpm lint`
- `! grep -q "linkUrl: \`/procurement/" apps/api/src/modules/procurement/procurement.service.ts`
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
