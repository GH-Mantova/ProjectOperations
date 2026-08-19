---
premise: 'grep -lqE "(throw new Error\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\)|setError\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\))" apps/web/src/pages/crm/AccountDetailPage.tsx apps/web/src/pages/crm/AccountsListPage.tsx apps/web/src/pages/crm/CommsHubPage.tsx apps/web/src/pages/crm/DropReasonAdminPage.tsx apps/web/src/pages/crm/OpportunityDetailPage.tsx apps/web/src/pages/crm/RelationshipsPage.tsx apps/web/src/pages/crm/crm-api.ts apps/web/src/pages/directory/ContactsPage.tsx apps/web/src/pages/directory/SubcontractorRatesTab.tsx apps/web/src/pages/directory/SubcontractorsPage.tsx'
premise_means: >-
  These 10 web files still feed a raw HTTP response body straight into an error
  message, so the user sees the JSON envelope instead of the message inside it.
scope:
  - apps/web/src/pages/crm/**
  - apps/web/src/pages/directory/**
done_when: >-
  pnpm build && pnpm lint && ! grep -lqE "(throw new Error\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\)|setError\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\))" apps/web/src/pages/crm/AccountDetailPage.tsx apps/web/src/pages/crm/AccountsListPage.tsx apps/web/src/pages/crm/CommsHubPage.tsx apps/web/src/pages/crm/DropReasonAdminPage.tsx apps/web/src/pages/crm/OpportunityDetailPage.tsx apps/web/src/pages/crm/RelationshipsPage.tsx apps/web/src/pages/crm/crm-api.ts apps/web/src/pages/directory/ContactsPage.tsx apps/web/src/pages/directory/SubcontractorRatesTab.tsx apps/web/src/pages/directory/SubcontractorsPage.tsx
size: 10
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Humane API errors — CRM and directory

Slice 4 of 10 in the raw-error-envelope migration, plus a final CI-gate slice.
Mechanical: swap a raw body read for the existing helper. **No behaviour design, no redesign.**

## The defect

```ts
if (!res.ok) throw new Error(await res.text());   // user sees {"statusCode":400,"message":"..."}
```

The helper already exists at `apps/web/src/lib/api-errors.ts`:
`readApiErrorMessage` (:90) and `throwIfApiError` (:119). **Read it first** and use whichever
fits each call site — do not write a new one and do not change the helper.

## Files in this slice (10 files, 23 occurrences measured on origin/main 15d9b1d3)

- `apps/web/src/pages/crm/AccountDetailPage.tsx`  (1)
- `apps/web/src/pages/crm/AccountsListPage.tsx`  (1)
- `apps/web/src/pages/crm/CommsHubPage.tsx`  (6)
- `apps/web/src/pages/crm/DropReasonAdminPage.tsx`  (3)
- `apps/web/src/pages/crm/OpportunityDetailPage.tsx`  (3)
- `apps/web/src/pages/crm/RelationshipsPage.tsx`  (2)
- `apps/web/src/pages/crm/crm-api.ts`  (1)
- `apps/web/src/pages/directory/ContactsPage.tsx`  (1)
- `apps/web/src/pages/directory/SubcontractorRatesTab.tsx`  (1)
- `apps/web/src/pages/directory/SubcontractorsPage.tsx`  (4)

## Do

1. In each file above, replace every raw-body error read with the helper. The response variable is
   **not always called `res`** — this codebase uses `response`, `r`, `resp` and about forty
   one-off names. Match on the shape, not the name.
2. Both shapes count: `throw new Error(await X.text())` **and** `setError(await X.text())`.
3. Keep each call site's existing control flow exactly as it is. Only the message changes.
4. Some of these files already import the helper and use it elsewhere — finish them, do not
   duplicate the import.

## Do NOT

- Do NOT touch any file not listed above. Other slices own them.
- Do NOT modify `apps/web/src/lib/api-errors.ts`.
- Do NOT add the CI gate — that is the final slice, and it can only pass once all 82 files are done.
- Do NOT "improve" the surrounding error handling, retries, or toasts.
- Do NOT touch `apps/api/**`, `/sot/`, or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint` green; web tests green.
- State the before/after occurrence count for this slice in the PR body.
- If a call site genuinely should NOT use the helper (for example the body is not an API error
  envelope), say so explicitly in the PR body and leave it — but then this slice's `done_when`
  will not go green, so raise it rather than forcing it.

## STANDING AUTHORITY

Mechanical migration only. Stop and report rather than widening scope.
