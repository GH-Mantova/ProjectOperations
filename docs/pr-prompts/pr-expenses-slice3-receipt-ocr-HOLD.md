---
premise: '! grep -rqi "ocr\|receiptScan\|docAi" apps/api/src/modules/expenses 2>/dev/null'
premise_means: Expense receipts are not OCR-extracted yet.
scope:
  - apps/api/src/modules/expenses/**
  - packages/config/src/**
  - apps/web/src/pages/expenses/**
done_when: pnpm build && pnpm lint && grep -rqi "ocr\|receiptScan\|docAi" apps/api/src/modules/expenses
size: 6
gate_allow: env-vars
seed_only: false
escalates: false
---
<!-- watcher: do-not-arm | GATED: arm after pr-expenses-slice1 AND pr-integration-keys-settings MERGED, and Marco has entered a doc-AI key in the ERP Integration settings -->
# HOLD — Expenses slice 3: receipt OCR pre-fill

STATUS: DRAFTED, STAGED, DO NOT ARM YET. Tier 1. **ARM ONLY** after `pr-expenses-slice1` (Expense
model) AND `pr-integration-keys-settings` (the encrypted key store + `resolveIntegrationKey`) merged,
and Marco has entered a document-AI provider key in the ERP Integration settings.

## What to build
Branch: `feat/expenses-receipt-ocr`. Reviewer: `GH-Mantova`. No migration. `GATE-ALLOW: env-vars`.
Server-side: given a receipt image/PDF (the `receiptDocumentId` attachment), call a document-AI/OCR
provider to extract amount, GST, date, supplier, and pre-fill a draft Expense for the user to confirm
(never auto-submit). Resolve the provider key via `resolveIntegrationKey('doc-ai')` (DB-first, env
fallback) — never `process.env` directly, never in the browser. Graceful fallback: if OCR fails or no
key, the user just fills the expense manually. Web: a "Scan receipt" affordance on the expense form.

## Do NOT
- Do NOT auto-submit or auto-approve from OCR — always a human confirms the parsed values.
- Do NOT call the provider from the browser or hardcode the key. Do NOT touch Azure/prod.

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails
- One attempt. Already on `main` → `NO-OP`. If predecessors not on main, STOP `NO-OP: predecessor not merged`.
- Read the CI job log before diagnosing failures. `pnpm build` + `pnpm lint` must pass.
- Do NOT auto-merge — leave the PR for Marco.
