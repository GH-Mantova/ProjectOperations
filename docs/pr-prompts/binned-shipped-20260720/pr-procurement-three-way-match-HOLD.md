---
premise: '! grep -rqi "threeWayMatch\|three-way" apps/api/src/modules/procurement 2>/dev/null'
premise_means: There is no 3-way match (PO vs receipt vs vendor invoice) yet.
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/procurement/**
  - apps/web/src/pages/procurement/**
  - docs/data-model/**
done_when: pnpm build && pnpm lint && grep -rqi "threeWayMatch\|three-way" apps/api/src/modules/procurement
size: 10
gate_allow: migrations
seed_only: false
escalates: false
---
<!-- watcher: arm-eligible | procurement requisition→PO (issuePurchaseOrder) + goods-receipt (/receive) ALREADY on main; only 3-way match remains | verified 2026-07-15 -->
# HOLD — Procurement slice 3: 3-way match + reconcile

STATUS: DRAFTED, STAGED, arm-eligible. Tier 2. VERIFIED 2026-07-15: requisition→PO
(`issuePurchaseOrder`) and goods receipt (`/requests/:id/receive`) are ALREADY built and on main —
this adds the missing piece: a `VendorInvoice` + the 3-way match/reconcile. Read `sot/06` Phase-4
procurement spec and the existing `procurement.service.ts` first.

## What to build
Branch: `feat/procurement-three-way-match`. Reviewer: `GH-Mantova`. Migration: YES. `GATE-ALLOW: migrations`.
1. A `VendorInvoice` (+ lines) record against a `PurchaseOrder`, and a **3-way match**: compare PO
   (ordered) vs GoodsReceipt (received) vs VendorInvoice (billed) per line; flag variances (price /
   qty) over a configurable tolerance; block/approve accordingly (variance approval via the
   `AuthorityService` seam). Mark matched invoices ready-to-pay; record a reconcile/close-audit trail
   per PO for the project-close audit the spec calls for.
2. API in `procurement`, guarded `procurement.manage` / `.approve`.
3. Web: a match screen on the PO/invoice — three columns (ordered/received/billed) with variance
   highlighting and an approve/hold action.

## Schema change → REGENERATE the data-model map (MANDATORY)
Run `node scripts/data-model/build-relationship-map.mjs` and COMMIT `docs/data-model/relationship-map.json`
+ `relationship-map.md` + `metadata-catalog.json`. The CI data-model drift check FAILS otherwise (#593).

## Do NOT
- Do NOT push the matched bill to Xero here (that is the Xero-deepening slice). Do NOT auto-pay.
  Do NOT hardcode tolerances/approval limits (config + AuthorityService). Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. If predecessor not on main, STOP `NO-OP: predecessor not merged`.
- If size would exceed 10 files, split and say so. Read the CI job log before diagnosing failures.
- `pnpm build` + `pnpm lint` must pass. Do NOT auto-merge — leave the PR for Marco.
