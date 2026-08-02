---
premise: '! grep -q "\"/dockets\"" apps/web/src/components/ShellLayout.tsx'
premise_means: The desktop Dockets register still has no sidebar entry (nor does Expenses), so two fully-built back-office surfaces are URL-only.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
done_when: pnpm lint && grep -q "\"/dockets\"" apps/web/src/components/ShellLayout.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# Adopt /dockets and /expenses into the sidebar (Marco-approved 2026-08-03)

Audit finding: `/dockets` (DocketsRegisterPage, well-guarded on field.view/field.manage) and
`/expenses` (ExpensesPage, expenses.*) are complete desktop registers with zero nav entries,
zero inbound links; /dockets also breadcrumbs to "Workspace".

## What to build

1. `ShellLayout.tsx`: add "Dockets" to the HR group (it is the back-office half of field
   dockets; sits naturally beside Timesheet Approval) with
   `requiresPermission: "field.view"`; add "Expenses" to the HR group with
   `requiresPermission: "expenses.view"`. Mirror the exact API permissions — verify each
   against its controller before writing (per the now-standard nav-gate rule).
2. BREADCRUMBS: add `"/dockets": "Dockets"` (missing); `/expenses` already has one.
3. Update `ShellLayout.nav.test.ts` HR-group assertions; run it (`npx vitest run` on the
   file) and paste the pass in the PR body (CI wiring may not have merged yet).

## Do NOT
- Do NOT touch the pages themselves, the field nav, or any route.

## VERIFY
- `pnpm build && pnpm lint`; nav test green; both entries carry requiresPermission.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
