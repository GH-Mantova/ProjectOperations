---
premise: '! grep -rEqi "TipFinderDrawer|findTip" apps/web/src/pages/tendering'
premise_means: The tender waste row cannot launch the tip finder when choosing a facility.
scope:
  - apps/web/src/pages/tendering/**
  - apps/web/src/components/**
  - apps/api/src/modules/map-locations/**
done_when: pnpm build && pnpm lint && grep -rEqi "TipFinderDrawer|findTip" apps/web/src/pages/tendering
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main:
  - apps/api/src/modules/map-locations/tip-recommendations.service.ts
---

# HOLD — Launch the tip finder from the tender waste row

STATUS: DRAFTED, STAGED, **DO NOT ARM YET**. Marco 2026-07-20: the register + finder live in
Settings, but choosing a facility on a waste row should be able to *ask* for the best tip.

**ARM ONLY** after `pr-ops-m2-tip-finder` has merged. Verify on `main`:
`grep -q "model TipRecommendationLog" apps/api/prisma/schema.prisma`.
ORDERING: the `requires_file_on_main` key above names m2's service file, so once
`pr-watcher-frontmatter-dependencies` has merged the watcher will DEFER this prompt until that file
is on main and release it automatically. Until that lands the key is inert — so if this is armed
early, whoever arms it must check the predecessor by hand.

## What to build (when armed)

Branch: `feat/ops-m3-waste-row-tip-finder`. Reviewer: `GH-Mantova`. No migration.

1. In `apps/web/src/pages/tendering/ScopeWasteTab.tsx`, add a "Find a tip" action beside the
   FACILITY control on each waste row. It opens the m2 finder in a drawer — **reuse the m2
   component and its `POST /waste/recommendations` endpoint; do NOT re-implement ranking or costing.**
2. **Pre-fill from the row and the tender — the user should not retype anything:**
   - waste type = that row's TYPE
   - tonnes = that row's TONNES (if blank, derive from M3 x density where available; else leave empty)
   - "coming from" = the **tender's Site**. Tender `siteId` is NOT NULL as of #646, so a site always
     exists; use its coordinates. Only fall back to the office `OperationsSettings` coords if that
     site has no lat/lng.
3. On "use this facility": write that `MapLocation.facility` string into the row's FACILITY field,
   close the drawer, and `POST /waste/recommendations/accept` so the `TipRecommendationLog` records
   the choice with the tender/project context.
4. **Do NOT write any price into the row.** The rate resolver already prices facility x waste type
   (r3-t1 owns the cost engine); setting the facility is enough for the row to reprice itself.
5. Graceful edges: if the row has no waste type or tonnes, open the finder with those fields empty
   and let the user fill them — never block. If the tender's site has no coordinates, show a short
   hint pointing at Settings > Map locations instead of erroring.

## Do NOT
- Do NOT re-implement the ranking/costing logic — m2 owns it.
- Do NOT auto-populate `$/unit`, `$/load` or any rate value.
- Do NOT create a top-level `/ops-map` route. Do NOT add a geocoding key. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` -> `NO-OP: <reason>`. Never stand by for approval.
- If `model TipRecommendationLog` is not on `main`, STOP with `NO-OP: predecessor m2 not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge - open the PR and leave it for Marco.
