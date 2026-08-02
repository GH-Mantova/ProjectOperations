---
premise: '! test -f docs/plans/assets-equipment-tabs-plan.md'
premise_means: No plan exists yet to consolidate Assets, Inventory, Maintenance, and Procurement into one tabbed page; today Assets & Equipment is a collapsible nav dropdown and Procurement is a separate nav item.
scope:
  - docs/plans/**
done_when: pnpm build && pnpm lint && test -f docs/plans/assets-equipment-tabs-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
---

# SLICE-0 plan: one Assets page with tabs (Assets · Inventory · Maintenance · Procurement)

Author `docs/plans/assets-equipment-tabs-plan.md` (house style of docs/plans/settings-restructure-plan.md).
Plan document only.

Marco's ask: he is not a fan of the "Assets & Equipment" nav dropdown. He wants a single page where
**Assets, Inventory, Maintenance, and Procurement become tabs** within it.

## Ground first (cite file:line)
- Nav: `apps/web/src/components/ShellLayout.tsx` (~247, "Assets & Equipment" collapsible group;
  Procurement is a separate Operations item per ShellLayout.nav.test) — the exact current structure.
- The four surfaces: the Assets, Inventory, Maintenance, and Procurement pages/routes in
  `apps/web/src/App.tsx` and their page components — their permissions, sub-routes, and detail pages.
- The Settings restructure plan (docs/plans/settings-restructure-plan.md, #840) as the proven pattern
  for a tabbed workspace with per-tab permission gating and redirects from old routes.
- sot/01 SECTION 9 (sidebar navigation, "definitive — do not deviate") — the plan must schedule a
  sot/01 §9 doc-reconcile slice for the nav change, not edit sot inline.

## The plan must decide/cover
1. **IA:** one route (e.g. `/assets` with tabs) vs keeping deep-linkable sub-routes
   (`/assets/inventory`, …); how detail pages (AssetDetailPage, etc.) fit; query-preserving redirects
   from the old routes so no link dies.
2. **Procurement:** confirm folding Procurement in is wanted (it is currently a first-class Operations
   item) — call it out as a decision, since it changes that module's home.
3. **Permissions:** each tab gated on its API's view permission (mirror the settings-restructure rule).
4. **Ordered slices** (each ≤ ~10 files, `requires_merged` edges, rollback notes) + the sot/01 §9
   doc-reconcile slice, + a risks section (dead links, permission regressions).

## Do NOT
- Do NOT write code in this slice — plan document only (`scope` is `docs/plans/**`).
- Do NOT edit `/sot/` — the §9 nav change lands via a doc-reconcile slice.
- Do NOT delete the four modules' functionality; this is IA consolidation, not removal.

## VERIFY
- `pnpm build && pnpm lint`
- `test -f docs/plans/assets-equipment-tabs-plan.md`

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the plan already exists on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
