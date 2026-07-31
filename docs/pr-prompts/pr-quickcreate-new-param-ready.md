---
premise: '! grep -rq "get(\"new\")" apps/web/src/pages'
premise_means: No list page reads the ?new=1 param QuickCreate emits — the global "+ Create" menu is entirely decorative.
scope:
  - apps/web/src/components/QuickCreate.tsx
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/jobs/JobsListPage.tsx
  - apps/web/src/pages/master-data/MasterDataWorkspacePage.tsx
  - apps/web/src/pages/directory/DirectoryPage.tsx
  - apps/web/src/pages/assets/AssetsListPage.tsx
  - apps/web/src/pages/forms/FormsListPage.tsx
done_when: pnpm build && pnpm lint && grep -rq "get(\"new\")" apps/web/src/pages
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# FIX: make QuickCreate actually create — wire ?new=1 on its six targets

## The defect (system audit 2026-07-31, verified on origin/main)

`components/QuickCreate.tsx` (the topbar "+" menu) navigates to six list URLs with `?new=1`
(:22,:34,:47,:59,:71,:82). Repo-wide, ZERO pages read the `new` param — every Quick Create item
is a plain list navigation. The user picks "New tender" and lands on the tender list with
nothing opened.

## What to build

For each QuickCreate target, on mount (and on param change) read `searchParams.get("new")`; when
`"1"`, open that page's EXISTING create affordance, then strip the param from the URL (replace)
so refresh/back doesn't re-trigger:

1. `/tenders?new=1` → open `NewTenderWizard` (TenderingPage already has `setNewOpen`).
2. `/jobs?new=1` → the Jobs list's existing create affordance. Ground it first: if JobsListPage
   has NO create affordance, do not build one — remove the Jobs item from QuickCreate instead
   and say so in the PR body.
3. `/master-data?tab=clients&new=1` → the Clients tab's add-client affordance (same grounding
   rule).
4. `/directory/contacts?new=1` → after the redirect (query now preserved by the route-hygiene
   PR — if that hasn't merged, ALSO retarget QuickCreate directly at
   `/directory?tab=contacts&new=1`) → the Contacts tab's add-contact affordance.
5. `/assets?new=1` → the asset create affordance.
6. `/forms?new=1` → the new-template/new-submission affordance the page owner intends (ground:
   pick the page's primary "+ New" button).

Honesty rule per target: wire to something that EXISTS; where nothing exists, remove the
QuickCreate entry and record it in the PR body — never ship a param nothing reads.

## Do NOT

- Do NOT build new create forms/modals — wire existing ones only.
- Do NOT implement `?highlight=` (separate, larger decision).
- Do NOT touch permissions or the API.

## VERIFY

- `pnpm build && pnpm lint`
- `grep -rq "get(\"new\")" apps/web/src/pages`
- Every remaining QuickCreate item's target page consumes the param (list the mapping in the PR
  body).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. Read the CI job log before diagnosing a failure.
