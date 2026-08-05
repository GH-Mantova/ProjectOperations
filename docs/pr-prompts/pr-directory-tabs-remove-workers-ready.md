---
premise: grep -q "Workers live in the Workers workspace" apps/web/src/pages/directory/DirectoryPage.tsx
premise_means: DirectoryPage.tsx still renders a hardcoded "Workers" tab (navigate to /workers) that belongs in the HR/Workers module, and its dual tab<->URL effects make the Subcontractors/Contacts tabs flicker and snap back to Clients.
scope:
  - apps/web/src/pages/directory/DirectoryPage.tsx
  - apps/web/src/pages/directory/__tests__/**
done_when: pnpm --filter @project-ops/web lint && pnpm --filter @project-ops/web test && ! grep -q "Workers live in the Workers workspace" apps/web/src/pages/directory/DirectoryPage.tsx
size: 2
gate_allow: none
seed_only: false
escalates: false
---

# fix(web): Directory — remove Workers tab; fix tab flicker (#2)

## What exists on main
- `apps/web/src/pages/directory/DirectoryPage.tsx` renders three real tabs (`clients` / `subcontractors` / `contacts`) PLUS a hardcoded fourth **"Workers"** button whose only action is `navigate("/workers")`. Workers belongs to the HR/Workers module, not Directory.
- Two `useEffect`s sync `tab` <-> the `?tab=` URL param. Clicking Subcontractors & Suppliers or Contacts flickers and snaps back to Clients (competing effects / unstable active-tab source of truth).

## What to build
1. **Remove the "Workers" tab button entirely** (and the now-unused `useNavigate` import if nothing else uses it).
2. **Make the active tab stable** — one source of truth. Simplest: derive `tab` from the URL via `resolveTab(searchParams.get("tab"))` on render, and have the click handler write the param with `setSearchParams(..., {replace:true})` — collapse the two competing effects so a selected tab STAYS selected. Deep-link `?tab=` and browser back/forward must keep working.
3. **Test:** add/extend a Directory tab test asserting exactly three tabs, NO "Workers", and that selecting Subcontractors and Contacts keeps them active (no snap-back).

## Do NOT
- Do NOT change the child tab components (`ClientsTab` / `SubcontractorsPage` / `ContactsPage`) or any API.
- Do NOT touch the Workers/HR module or routes.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does not mean wait-before-starting
> or do-then-ask. There is no human in this run — finishing then asking is indistinguishable from failing.

## Guardrails
- One attempt; `NO-OP: <reason>` if genuinely impossible.
- `pnpm --filter @project-ops/web lint` and `...test` must pass before opening the PR.
- Never ask for or wait on approval.
