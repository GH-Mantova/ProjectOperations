---
premise: 'grep -lqE "(throw new Error\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\)|setError\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\))" apps/web/src/pages/AdminSettingsPage.tsx apps/web/src/pages/AgreedRecordCapturePage.tsx apps/web/src/pages/JobSorAttachWizardPage.tsx apps/web/src/pages/MasterDataPage.tsx apps/web/src/pages/PlatformPage.tsx apps/web/src/pages/ScheduleOfRatesAdminPage.tsx apps/web/src/pages/VariationPricingPage.tsx apps/web/src/pages/account/DefaultDashboardSection.tsx apps/web/src/pages/account/GlobalListsSection.tsx'
premise_means: >-
  These 9 web files still feed a raw HTTP response body straight into an error
  message, so the user sees the JSON envelope instead of the message inside it.
scope:
  - apps/web/src/pages/**
  - apps/web/src/pages/account/**
done_when: >-
  pnpm build && pnpm lint && ! grep -lqE "(throw new Error\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\)|setError\(await [A-Za-z_][A-Za-z0-9_]*\.text\(\)\))" apps/web/src/pages/AdminSettingsPage.tsx apps/web/src/pages/AgreedRecordCapturePage.tsx apps/web/src/pages/JobSorAttachWizardPage.tsx apps/web/src/pages/MasterDataPage.tsx apps/web/src/pages/PlatformPage.tsx apps/web/src/pages/ScheduleOfRatesAdminPage.tsx apps/web/src/pages/VariationPricingPage.tsx apps/web/src/pages/account/DefaultDashboardSection.tsx apps/web/src/pages/account/GlobalListsSection.tsx
size: 9
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Humane API errors — Top-level pages and account sections

Slice 5 of 10 in the raw-error-envelope migration, plus a final CI-gate slice.
Mechanical: swap a raw body read for the existing helper. **No behaviour design, no redesign.**

## The defect

```ts
if (!res.ok) throw new Error(await res.text());   // user sees {"statusCode":400,"message":"..."}
```

The helper already exists at `apps/web/src/lib/api-errors.ts`:
`readApiErrorMessage` (:90) and `throwIfApiError` (:119). **Read it first** and use whichever
fits each call site — do not write a new one and do not change the helper.

## Files in this slice (9 files, 47 occurrences measured on origin/main 15d9b1d3)

- `apps/web/src/pages/AdminSettingsPage.tsx`  (11)
- `apps/web/src/pages/AgreedRecordCapturePage.tsx`  (6)
- `apps/web/src/pages/JobSorAttachWizardPage.tsx`  (1)
- `apps/web/src/pages/MasterDataPage.tsx`  (1)
- `apps/web/src/pages/PlatformPage.tsx`  (5)
- `apps/web/src/pages/ScheduleOfRatesAdminPage.tsx`  (14)
- `apps/web/src/pages/VariationPricingPage.tsx`  (4)
- `apps/web/src/pages/account/DefaultDashboardSection.tsx`  (3)
- `apps/web/src/pages/account/GlobalListsSection.tsx`  (2)

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
