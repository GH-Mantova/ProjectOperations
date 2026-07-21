---
premise: '! grep -rqi "vendorInvoiceOcr\|invoiceScan" apps/api/src/modules/procurement 2>/dev/null'
premise_means: Supplier invoices are not OCR-extracted into a bill for matching yet.
scope:
  - apps/api/src/modules/procurement/**
  - packages/config/src/**
  - apps/web/src/pages/procurement/**
done_when: pnpm build && pnpm lint && grep -rqi "vendorInvoiceOcr\|invoiceScan" apps/api/src/modules/procurement
size: 6
gate_allow: env-vars
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-procurement-three-way-match AND pr-integration-keys-settings MERGED, and Marco has entered a doc-AI key in Integration settings -->
# HOLD — Vendor-invoice OCR intake

STATUS: DRAFTED, STAGED, DO NOT ARM YET - but the CODE gates are now CLEARED. Re-verified against
origin/main 285e779 on 2026-07-20: `model VendorInvoice` IS on main (three-way-match shipped) and
`resolveIntegrationKey` IS on main (integration-keys shipped). **The ONLY thing still missing is a
document-AI key entered in Integration settings by Marco.** Arm the moment he confirms the key is in.
`GATE-ALLOW: env-vars`. No migration.

PROVIDER: **Azure Document Intelligence** (prebuilt-invoice model) - chosen 2026-07-20 because the
tenant is already Microsoft (Entra, SharePoint, Graph managed identity), so it adds no new vendor
relationship. Build against its prebuilt-invoice response shape.

**HARD STOP - AZURE.** You may write the client code, the config plumbing and the runbook. You must
NOT create the Azure resource, register anything in Entra, set any App Service setting, or run any
`az` / `Connect-MgGraph` command that writes. Marco does all of that himself. Resolve the key
ONLY through `resolveIntegrationKey('doc-ai')` (DB-first, env fallback) at runtime.

## What to build
Branch: `feat/vendor-invoice-ocr`. Reviewer: `GH-Mantova`.
Server-side doc-AI extraction of an uploaded supplier invoice (PDF/image) → a pre-filled `VendorInvoice`
draft (supplier, invoice #, date, lines, amounts, GST) linked to the referenced PO, ready for the
3-way match to run. Resolve the key via `resolveIntegrationKey('doc-ai')` (DB-first, env fallback),
server-side only. A human confirms before the invoice is committed. Graceful fallback to manual entry.
Web: an "Upload invoice" affordance that shows the parsed draft for confirmation.

## Do NOT
- Do NOT auto-commit or auto-match without human confirmation. Do NOT call the provider from the
  browser or hardcode the key. Do NOT push to Xero here. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. If predecessors not on main, STOP `NO-OP: predecessor not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — leave the PR for Marco.
