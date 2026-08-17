---
premise: '! test -f apps/api/src/modules/xero/xero-contact-export.service.ts'
premise_means: The Xero-format contact-export builder does not exist yet — CFX-4 has not run.
scope:
  - apps/api/src/modules/xero/xero-contact-export.service.ts
  - apps/api/src/modules/xero/xero.controller.ts
  - apps/api/src/modules/xero/__tests__/xero-contact-export.service.spec.ts
  - apps/web/src/pages/admin/XeroExchangePage.tsx
  - apps/web/src/App.tsx
  - apps/web/src/components/SettingsShell.tsx
  - apps/web/src/pages/admin/__tests__/XeroExchangePage.test.tsx
requires_file_on_main: apps/web/src/components/DynamicFieldSection.tsx
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/xero/xero-contact-export.service.ts && grep -q "XeroExchangePage" apps/web/src/App.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# feat(api+web): CFX-4 — Xero contact-CSV EXPORT (BUILTIN parity fields only)

Implement **SLICE 4** of `docs/plans/configurable-fields-xero-exchange-plan.md`.

Read that plan in full. §2 decisions 3 and 5 are load-bearing: **custom fields NEVER
round-trip to Xero** (Xero rejects unknown columns); bank details are sensitive AU PII
and default OFF with a warning + audit. The dormant API push in `xero.service.ts:262`
(`syncContact`) stays untouched — this slice is the parallel FILE path.

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.
`pnpm build` and `pnpm lint` must pass.

---

## What to build

### 1. `apps/api/src/modules/xero/xero-contact-export.service.ts` (new)

Pure builder — no HTTP, no Xero SDK, no auth. Maps BUILTIN fields of `Client` (and,
separately, `SubcontractorSupplier`) to Xero's contact-import CSV column set:

```
*ContactName, EmailAddress, FirstName, LastName,
POAddressLine1, POAddressLine2, POAddressLine3, POAddressLine4, POCity, PORegion, POPostalCode, POCountry,
SAAddressLine1, SAAddressLine2, SAAddressLine3, SAAddressLine4, SACity, SARegion, SAPostalCode, SACountry,
PhoneNumber, MobileNumber, DirectDialNumber, FaxNumber,
Website, TaxNumber, AccountNumber,
BankAccountName, BankAccountNumber,
SalesAccount, PurchasesAccount, Discount, DefaultCurrency
```

Rules:
- Column order MUST match Xero's spec exactly (their importer is strict).
- `*ContactName` = `name`; `TaxNumber` = `abn`; `AccountNumber` = `code`.
- `POAddress*` from postal fields, `SAAddress*` from physical fields (POAddress =
  postal, SAAddress = street/physical in Xero's schema).
- `SalesAccount` = `salesAccountCode`, `PurchasesAccount` = `purchaseAccountCode`,
  `Discount` = `discount` (Decimal → plain number string; blank if null).
- `BankAccountNumber` = `bankBsb + "-" + bankAccountNumber` (AU Xero convention —
  BSB and account joined with a hyphen).
- `DefaultCurrency` = `"AUD"` for every row.
- Custom fields are NEVER included, whatever the caller passes.

Signature:
```typescript
buildClientsCsv(clients: Client[], opts: { includeBankDetails: boolean }): string
buildVendorsCsv(vendors: SubcontractorSupplier[], opts: { includeBankDetails: boolean }): string
```

When `includeBankDetails: false`, emit empty strings for `BankAccountName` and
`BankAccountNumber` regardless of the underlying data.

CSV encoding: RFC 4180 (double-quoted fields containing commas/quotes/newlines; empty
optionals as empty strings, NOT the text `"null"`). Use a small hand-written encoder or
the standard-lib pattern already used elsewhere in the repo — do NOT add a new dep.

### 2. `apps/api/src/modules/xero/xero.controller.ts`

Add two GET routes (both permissioned with the existing xero-admin guard used by the
current controller — find it first, do NOT invent a new permission code):

- `GET /xero/export/clients.csv?includeBankDetails=true|false` — load all active clients
  via `prisma.client.findMany({ where: { isActive: true } })`, pipe through
  `buildClientsCsv`, set `Content-Type: text/csv` and
  `Content-Disposition: attachment; filename="xero-clients-<YYYY-MM-DD>.csv"`.
- `GET /xero/export/vendors.csv?includeBankDetails=true|false` — same for
  `prisma.subcontractorSupplier.findMany({ where: { isActive: true } })`.

Both routes audit the export via `AuditService` (find the existing service; log fields:
userId, entityType=`"CLIENT"|"VENDOR"`, rowCount, includeBankDetails).

Do NOT touch any existing method on this controller.

### 3. `apps/api/src/modules/xero/__tests__/xero-contact-export.service.spec.ts` (new)

Vitest / jest (match the pattern used by
`apps/api/src/modules/xero/__tests__/xero.service.spec.ts` if it exists — grep first).
Cases:
- Column order matches the Xero spec (compare header row exactly).
- Custom fields on the input record are NOT in the CSV output.
- `includeBankDetails: false` → BankAccountName + BankAccountNumber columns are empty
  strings even when the input has values.
- `includeBankDetails: true` → BankAccountNumber is `"<BSB>-<Account>"`.
- Decimal `discount` serialises as a plain number, never as `"[object Object]"`.
- Empty optional fields serialise as `""`, never as `"null"` or `"undefined"`.

### 4. `apps/web/src/pages/admin/XeroExchangePage.tsx` (new)

Admin surface with:
- Two "Download CSV" buttons — Clients and Vendors.
- One checkbox "Include bank details (BSB + Account #)" — defaults OFF.
- A visible warning shown when the checkbox is on:
  `"Bank details are sensitive PII. Every export is audited by user + timestamp."`
- Short note under the buttons: `"File matches Xero's contact-import format. Custom fields are not included."`

Downloads use a plain `<a href="/api/xero/export/clients.csv?includeBankDetails=...">`
(no fetch/blob dance needed) so the browser handles the file save.

### 5. `apps/web/src/App.tsx`

Register `/admin/xero-exchange` → `XeroExchangePage`, gated on the xero-admin permission
(mirror the guard used by other xero-admin routes in the same file).

### 6. `apps/web/src/components/SettingsShell.tsx`

Add nav entry **"Xero file exchange"** under Administration.

### 7. `apps/web/src/pages/admin/__tests__/XeroExchangePage.test.tsx` (new)

Vitest cases:
- Toggling the bank checkbox updates the `includeBankDetails` query param in the
  download URL.
- The PII warning renders when the checkbox is on; hidden when off.
- Both Download buttons render with the correct href paths.

## Do NOT

- Do NOT touch `apps/api/src/modules/xero/xero.service.ts` (the dormant API path).
- Do NOT include custom fields in either export CSV, ever.
- Do NOT default `includeBankDetails` to true.
- Do NOT write to the DB from this slice — export is read-only.
- Do NOT add a new permission code.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint.
- Do NOT exceed 10 files.
