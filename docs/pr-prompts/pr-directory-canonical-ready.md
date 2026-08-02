---
premise: grep -q "to: \"/master-data\"" apps/web/src/components/ShellLayout.tsx
premise_means: The sidebar Directory entry still opens /master-data, hiding the unified /directory (Subcontractors and Contacts are menu-invisible).
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.ts
  - apps/web/src/App.tsx
  - apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
  - apps/web/src/pages/master-data/ClientsGridPage.tsx
  - tests/e2e/pr-acceptance/**
done_when: pnpm build && pnpm lint && ! grep -q "to: \"/master-data\"" apps/web/src/components/ShellLayout.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# Directory becomes canonical: nav -> /directory; /master-data folds in; clients-grid dies

Marco's ruling 2026-08-03. Audit findings: sidebar "Directory" -> /master-data (Clients+Sites,
2 tabs, breadcrumb says "Master Data") while the real unified /directory
(Clients/Subcontractors/Contacts) has NO nav entry; /master-data/clients-grid is a
self-described "reference implementation" demo — the third clients list.

## What to build

1. `ShellLayout.tsx`: Directory nav entry -> `/directory` (match rule covers /directory/*);
   `requiresPermission` mirroring the directory API's view code (verify in the controller).
   Breadcrumbs: "/directory": "Directory"; remove or retarget the "/master-data" entry.
2. `App.tsx`: `/master-data` becomes a query-preserving redirect to `/directory?tab=clients`.
   BUT ground first: /master-data also hosts the Sites tab — Sites has its own home
   (/sites, Projects group), so verify the Sites tab content is reachable at /sites and note
   any gap in the PR body; if the master-data Sites tab has features /sites lacks, keep
   /master-data reachable (redirect only the default view) and list the gap as follow-up.
3. Delete `/master-data/clients-grid` route + `ClientsGridPage.tsx` (zero inbound links).
4. Sweep references: `grep -rn "/master-data" apps/web/src` — retarget QuickCreate
   (`?tab=clients&new=1` -> the /directory equivalent, param preserved), CommandPalette,
   search service URL emitters (apps/api search.service if it emits /master-data), links.
5. e2e: `grep -rn "master-data\|clients-grid" tests/e2e` — retarget specs (batch5-clients
   asserts master-data workspace; align with the redirect reality). Positive end states.

## Do NOT
- Do NOT delete MasterDataWorkspacePage itself if the Sites-tab gap (step 2) requires it —
  honesty over tidiness; say what you did.
- Do NOT touch /directory internals, Subcontractors/Contacts tabs, or the Sites pages.

## VERIFY
- `pnpm build && pnpm lint`; nav test green; `! test -f apps/web/src/pages/master-data/ClientsGridPage.tsx`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
