---
premise: '! grep -q "XERO_EXPENSE_ACCOUNT_CODE" .env.example'
premise_means: The Xero account-code and tracking-category override env vars read by xero.config.ts are not yet documented in .env.example.
scope:
  - .env.example
done_when: grep -q "XERO_EXPENSE_ACCOUNT_CODE" .env.example && grep -q "XERO_VENDOR_INVOICE_ACCOUNT_CODE" .env.example && grep -q "XERO_TRACKING_CATEGORY_NAME" .env.example
size: 1
gate_allow: env-vars
seed_only: false
escalates: false
---

# Document the three Xero override env vars in `.env.example`

## The defect (Part 0 sub-check (f), env drift — found 2026-07-21 by 04-scanner)

`apps/api/src/config/xero.config.ts` reads three environment variables that are **absent from
`.env.example`**, so a deployer has no way to discover them:

- `XERO_EXPENSE_ACCOUNT_CODE`  (xero.config.ts:18, default `"420"`) — Xero account code for ACCPAY
  bills pushed from Expense records.
- `XERO_VENDOR_INVOICE_ACCOUNT_CODE` (xero.config.ts:22, default `"310"`) — account code for ACCPAY
  bills pushed from vendor invoices (3-way match).
- `XERO_TRACKING_CATEGORY_NAME` (xero.config.ts:27, default `""`) — Xero tracking category name for
  project allocation (optional).

`.env.example` already has a Xero section (lines 149–158) documenting `XERO_CLIENT_ID`,
`XERO_CLIENT_SECRET`, `XERO_REDIRECT_URI`, and `XERO_SCOPES` — these three overrides were simply
never added. Each has a graceful code default, so this is a low-severity discoverability gap, not a
runtime failure; but a deployment whose real Xero chart uses different account codes would post bills
to the wrong account (420/310) with no signal, which is exactly what documenting the override makes
visible.

## What to build

In `.env.example`, immediately after the existing Xero block (after the `XERO_SCOPES=` line, ~line
158), add the three keys with a short comment for each, mirroring the code comments in
`xero.config.ts`. Keep the values equal to the code defaults so the example matches shipped behaviour:

```
# Xero account code for ACCPAY bills pushed from Expense records.
# Default 420 = typical "Employee Reimbursements" in the Xero starter chart.
XERO_EXPENSE_ACCOUNT_CODE=420
# Xero account code for ACCPAY bills pushed from vendor invoices (3-way match).
# Default 310 = typical "Purchases" account code in the Xero starter chart.
XERO_VENDOR_INVOICE_ACCOUNT_CODE=310
# Xero tracking category name for project allocation (optional). When set, each
# pushed bill carries a tracking option equal to the project number.
XERO_TRACKING_CATEGORY_NAME=
```

Match the surrounding comment/formatting style of the file. This is the whole change — one file.

## Do NOT

- Do NOT touch `apps/api/src/config/xero.config.ts` or any other source file — the code is correct;
  only the example env template is missing entries.
- Do NOT add, rename, or reorder any other env keys.
- Do NOT change the existing Xero keys or their placeholder values.
- Do NOT touch Azure/Entra/SharePoint config, secrets, or any real credential values.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. If the premise is already satisfied on `main`, say `NO-OP: <reason>` and exit.
- Never exit silently and never "stand by" for approval — there is no human in a headless run.
- If CI fails, read the job log (`gh run view <run-id> --job <job-id> --log`) before diagnosing —
  never reason a CI failure out of the diff.
- The PR body must carry the bare `GATE-ALLOW: env-vars` marker at column 0 (the pipeline writes it
  from the `gate_allow` front-matter).
