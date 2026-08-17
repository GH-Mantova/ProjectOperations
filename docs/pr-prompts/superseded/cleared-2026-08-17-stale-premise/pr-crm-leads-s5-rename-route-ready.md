---
premise: '! grep -q "leads-opportunities" apps/web/src/pages/tendering/TenderingPage.tsx'
premise_means: The CRM tab has not been renamed to "Leads & opportunities" yet (S5 not done).
requires_file_on_main: apps/web/src/pages/crm/DontPursueModal.tsx
scope:
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/crm/CrmBoardPage.tsx
  - tests/e2e/**
done_when: pnpm build && pnpm lint && grep -q "leads-opportunities" apps/web/src/pages/tendering/TenderingPage.tsx
size: 4
gate_allow: none
seed_only: false
escalates: false
---

# feat(web): CRM S5 — rename tab to "Leads & opportunities"; URL ?tab=crm redirect

Implement **SLICE 5** of `docs/plans/crm-leads-collapse-plan.md`.

Read that plan in full before writing any code. S4 (`requires_file_on_main` gate) must be
on `main` first. This slice is purely a rename and redirect — no logic changes.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.

---

## Current state (ground on live build — verify before editing)

`apps/web/src/pages/tendering/TenderingPage.tsx`:
- Line 308–313: `canViewCrm = can(user, "crm.view")` and `tab === "crm"` check.
- Line 316: sets `nextParams.set("tab", "crm")` when navigating to CRM tab.
- Line 895: `{ key: "crm", label: "CRM" }` in the tabs array.

## What to build

### 1. `apps/web/src/pages/tendering/TenderingPage.tsx`

- Change the tab key from `"crm"` to `"leads-opportunities"` and label from `"CRM"` to
  `"Leads & opportunities"` at line 895 (verify exact line before editing).
- Update the `tab === "crm"` comparison at lines 308–313 to `tab === "leads-opportunities"`.
- Update `nextParams.set("tab", "crm")` at line 316 to
  `nextParams.set("tab", "leads-opportunities")`.
- Add a redirect: when `searchParams.get("tab") === "crm"` and `canViewCrm` is true,
  replace the URL with `?tab=leads-opportunities` via `useNavigate` + `replace: true`.
  This ensures old bookmarks and links continue to work.
- Preserve `crm.view` as the permission code — do NOT change the gate to a different code.

### 2. `apps/web/src/pages/crm/CrmBoardPage.tsx`

Grep for any internal reference to the tab key string `"crm"` and update to
`"leads-opportunities"` where needed. If none exist, no edit is required here.

### 3. `tests/e2e/**`

Search for any e2e assertion that matches the string `"CRM"` (as a tab label) or
`?tab=crm` (as a URL). Update each to `"Leads & opportunities"` / `?tab=leads-opportunities`.
List every file and assertion you changed in the PR body.

## Do NOT

- Do NOT change the `crm.view` permission code.
- Do NOT touch the tab rendering logic or forecast block.
- Do NOT touch `schema.prisma`, migrations, `/sot/`, or Azure/Entra/SharePoint.
- Do NOT exceed 4 files (TenderingPage.tsx, optionally CrmBoardPage.tsx, up to 2 e2e spec files).
