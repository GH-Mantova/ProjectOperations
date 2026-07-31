---
premise: '! grep -q "\"new\"" apps/web/src/pages/forms/CorrectiveActionDetailPage.tsx'
premise_means: The corrective-action detail page still has no create branch, so "+ New Action" 404s.
scope:
  - apps/web/src/pages/forms/CorrectiveActionsPage.tsx
  - apps/web/src/pages/forms/CorrectiveActionDetailPage.tsx
done_when: pnpm build && pnpm lint && grep -q "\"new\"" apps/web/src/pages/forms/CorrectiveActionDetailPage.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
---

# FIX: "+ New Action" on the corrective-actions register is a dead-end

## The defect (system audit 2026-07-31, verified on origin/main)

`apps/web/src/pages/forms/CorrectiveActionsPage.tsx:91` navigates to
`/forms/corrective-actions/new`, which matches the `:id` route;
`CorrectiveActionDetailPage.tsx` then fetches `GET /forms/corrective-actions/new` → 404 → error
screen. There is no `id === "new"` branch and no create form anywhere, although
`POST /forms/corrective-actions` exists server-side (`corrective-actions.controller.ts:74`,
`forms.manage`).

## What to build

1. Give the register a working create path. Preferred minimal shape: in
   `CorrectiveActionDetailPage`, branch on `id === "new"` → render a create form (title,
   description, assignee, due date — mirror the fields the POST DTO accepts; ground the DTO
   first), POST on save, then `navigate` to the created action's real id. If a lighter pattern
   already exists in this module (e.g. a create modal on a register page), mirror that instead —
   consistency beats invention.
2. Gate the create affordance on the same permission the POST requires (`forms.manage`), matching
   the existing in-page checks.
3. Failure honesty: a 403 on save shows a readable message, not a raw body dump.

## Do NOT

- Do NOT change the API, DTOs, or permissions.
- Do NOT add nav entries for the register (its orphan status is a separate Marco decision).
- Do NOT restyle the pages beyond the new form (re-skin is a separate program).

## VERIFY

- `pnpm build && pnpm lint`
- `grep -q "\"new\"" apps/web/src/pages/forms/CorrectiveActionDetailPage.tsx`

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
