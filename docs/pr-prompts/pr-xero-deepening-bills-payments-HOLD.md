---
premise: '! grep -rqi "pushBill\|syncPaymentStatus\|createXeroBill" apps/api/src/modules/xero 2>/dev/null'
premise_means: The Xero integration does not yet push bills or pull payment status (invoice-create only).
scope:
  - apps/api/src/modules/xero/**
  - apps/api/src/modules/expenses/**
  - apps/api/src/modules/procurement/**
  - apps/web/src/pages/**
done_when: pnpm build && pnpm lint && grep -rqi "pushBill\|syncPaymentStatus\|createXeroBill" apps/api/src/modules/xero
size: 9
gate_allow: none
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-expenses-slice1 AND pr-procurement-three-way-match MERGED (bill sources exist) -->
# HOLD — Xero deepening: push bills + pull payment status

STATUS: DRAFTED, STAGED, DO NOT ARM YET. The "integrate, don't build a ledger" workstream (Marco
decision 2026-07-15: Xero stays the system of record). **ARM ONLY** after `pr-expenses-slice1` and
`pr-procurement-three-way-match` merged (so there are approved expenses + matched vendor invoices to
push). Xero OAuth2 is already live (`apps/api/src/modules/xero/xero.service.ts`).

## What to build
Branch: `feat/xero-deepening-bills-payments`. Reviewer: `GH-Mantova`. No migration.
1. **Push bills to Xero**: create a Xero bill (ACCPAY) from an approved reimbursable **Expense** and
   from a 3-way-matched **VendorInvoice**, mapping supplier↔Xero contact, GL account/category, GST,
   and project tracking category. Idempotent (store the Xero id; never double-post).
2. **Pull payment status** back: sync paid/awaiting-payment status from Xero onto the local
   expense / vendor-invoice / progress-claim so the ERP shows what's actually been paid.
3. Extend the existing Xero service/module + add the trigger points; guard with the existing
   integration/finance permission. Graceful failure (queue + retry, never block the operational record).

## Do NOT
- Do NOT build a general ledger — Xero IS the ledger. Do NOT push payroll here (separate). Do NOT
  hardcode Xero account codes — make them mappable config. Do NOT touch Azure/Entra/SharePoint. Xero
  creds already configured by Marco; do not add or rotate them.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. If predecessors not on main, STOP `NO-OP: predecessor not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — leave the PR for Marco.
