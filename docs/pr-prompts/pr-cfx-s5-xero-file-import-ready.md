---
premise: '! test -f apps/api/src/modules/xero/xero-contact-import.service.ts'
premise_means: The Xero-format contact-import service does not exist yet — CFX-5 has not run.
scope:
  - apps/api/src/modules/xero/xero-contact-import.service.ts
  - apps/api/src/modules/xero/xero.controller.ts
  - apps/api/src/modules/xero/__tests__/xero-contact-import.service.spec.ts
  - apps/web/src/pages/admin/XeroExchangePage.tsx
  - apps/web/src/components/CsvColumnMapper.tsx
  - apps/web/src/pages/admin/__tests__/XeroExchangePage.import.test.tsx
  - apps/api/src/modules/audit/audit.service.ts
requires_file_on_main: apps/api/src/modules/xero/xero-contact-export.service.ts
done_when: pnpm build && pnpm lint && test -f apps/api/src/modules/xero/xero-contact-import.service.ts && grep -q "previewImport" apps/api/src/modules/xero/xero-contact-import.service.ts
size: 9
gate_allow: none
seed_only: false
escalates: true
---

# feat(api+web): CFX-5 — Xero-format file IMPORT (dry-run → confirm; never overwrites bank details)

Implement **SLICE 5** (final slice) of `docs/plans/configurable-fields-xero-exchange-plan.md`.

Read that plan in full. §2 decisions 3, 5, and 6 are load-bearing:
- Custom fields NEVER round-trip from an imported file (Xero files carry only Xero columns).
- ERP is source of truth — the commit path is upsert-with-review, never a blind overwrite.
- Existing bank details on a matched row are NEVER overwritten silently — the preview
  surfaces "would overwrite" and the caller must explicitly confirm per row.
- Every import (preview + commit) is audited.

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

### 1. `apps/api/src/modules/xero/xero-contact-import.service.ts` (new)

```typescript
type ImportPreview = {
  previewId: string; // in-memory cache key (5-minute TTL)
  appliesTo: "CLIENT" | "VENDOR";
  rows: Array<{
    rowIndex: number;
    action: "matched-by-xero-id" | "matched-by-name" | "new" | "rejected";
    matchedRecordId?: string;
    diffs?: Array<{ field: string; from: unknown; to: unknown; wouldOverwriteBank?: boolean }>;
    reason?: string; // for rejected rows
  }>;
  fileSha256: string;
  createdAt: Date;
};

previewImport(input: {
  fileBytes: Buffer;
  appliesTo: "CLIENT" | "VENDOR";
  columnMap: Record<string, string>; // {ourFieldKey: userSuppliedHeaderName}
  actorUserId: string;
}): Promise<ImportPreview>;

commitImport(input: {
  previewId: string;
  actorUserId: string;
  confirmedOverwriteBankRecordIds?: string[]; // caller opts-in per record
}): Promise<{ inserted: number; updated: number; skipped: number }>;
```

Behaviour:
- Parse the CSV/TXT into rows using the same header-tolerant approach the export uses
  (RFC 4180; support user-added quoting).
- Column-mapping: only the user-mapped headers are read. If a required BUILTIN field
  (e.g. `name`) is unmapped, reject the whole file (`previewImport` throws BadRequest with
  a clear message).
- Row matching (in order): (1) exact match on `xeroContactId` if the column is mapped and
  non-empty on the row; (2) exact match on `name` (case-insensitive); (3) otherwise `new`.
- Diff calculation: for a matched row, compare every mapped BUILTIN field to the current
  DB value; add a `diffs[]` entry for each field that would change.
- **Bank fields (bankName, bankAccountName, bankBsb, bankAccountNumber):** if the matched
  row already has ANY of these set, the diff entry carries `wouldOverwriteBank: true` and
  the commit path SKIPS that field unless the record's id is in
  `confirmedOverwriteBankRecordIds`. New rows may set bank fields freely (the record did
  not exist before).
- **Custom fields:** any header not mapped to a BUILTIN key is ignored. `customFields` is
  never written from an import.
- Rejected-row reasons must be actionable: `"required column 'name' not mapped"`,
  `"ABN failed checksum"`, `"BSB must be 6 digits (got 'foo')"`.
- Preview cache: hold up to 20 previews in-memory keyed by `previewId`, 5-minute TTL;
  `commitImport` throws NotFound if the key expired.
- Wrap the commit in a Prisma transaction; on error, throw and let the transaction
  roll back — no partial writes.
- Audit both entry points (log fields: userId, entityType, rowCount, fileSha256, action=preview|commit).

### 2. `apps/api/src/modules/xero/xero.controller.ts`

Add two routes (both permissioned with the xero-admin guard; both audited):

- `POST /xero/import/preview` — multipart upload: `file` (CSV), `appliesTo`, `columnMap`
  (JSON body). Returns `ImportPreview`.
- `POST /xero/import/commit` — JSON: `{ previewId, confirmedOverwriteBankRecordIds? }`.
  Returns `{ inserted, updated, skipped }`.

Do NOT touch the existing export routes from CFX-4 or any existing method on the controller.

### 3. `apps/api/src/modules/xero/__tests__/xero-contact-import.service.spec.ts` (new)

Vitest / jest cases:
- Dry-run returns diffs without writing (no Prisma create/update calls).
- Commit without a matching previewId throws NotFound.
- Commit applies inserts + updates for a valid preview.
- A matched row with existing bank details has `wouldOverwriteBank: true` in diffs, and
  the commit path SKIPS those bank fields (verify the update payload does NOT include
  bank fields for that record).
- The same commit DOES write bank fields when the record's id is in
  `confirmedOverwriteBankRecordIds`.
- A CSV column whose header is not in `columnMap` is ignored (custom fields cannot be
  written from an import).
- A row missing the `name` mapping fails with a clear reason string.
- ABN checksum validation rejects a malformed ABN.

### 4. `apps/web/src/pages/admin/XeroExchangePage.tsx`

Add an "Import" section beneath the existing export section from CFX-4:
- File input.
- `appliesTo` picker (CLIENT / VENDOR).
- Column-mapping table (uses `<CsvColumnMapper>` below): shows detected file headers on
  the left, a dropdown of BUILTIN field keys on the right. Auto-suggest exact
  case-insensitive name matches.
- "Preview" button → calls `POST /xero/import/preview`; renders the returned rows in a
  table with columns Row / Action / Matched record / Diffs / Warnings. "Would overwrite
  bank details" rows have a red flag and a per-row checkbox "Overwrite bank details for
  this record".
- "Confirm and import" button — disabled until a preview is loaded. On click, calls
  `POST /xero/import/commit` with the checked record IDs.

Preserve every existing export button from CFX-4.

### 5. `apps/web/src/components/CsvColumnMapper.tsx` (new)

Reusable: given `detectedHeaders: string[]` and `availableFields: {key,label,required}[]`,
render a table where each detected header has a dropdown to pick a BUILTIN field. Emits
`onChange(columnMap: Record<string, string>)`. Highlight unmapped required fields.

### 6. `apps/web/src/pages/admin/__tests__/XeroExchangePage.import.test.tsx` (new)

Vitest cases:
- "Confirm and import" is disabled before a preview is loaded.
- After a preview arrives, rows with `wouldOverwriteBank` render a red flag and a checkbox.
- Checking the overwrite checkbox includes that record's id in the commit payload.
- Unchecked overwrite = the commit payload's `confirmedOverwriteBankRecordIds` does not
  include that record.

### 7. `apps/api/src/modules/audit/audit.service.ts`

Extend the audit-event vocabulary only if needed: add `XERO_FILE_IMPORT_PREVIEW` and
`XERO_FILE_IMPORT_COMMIT` to the event enum / union. **Check first** — if the audit
service accepts arbitrary strings, no code change is needed here; drop the file from scope.

## Do NOT

- Do NOT touch `apps/api/src/modules/xero/xero.service.ts` (the dormant API path).
- Do NOT let the commit path overwrite bank fields on a matched record without explicit
  per-record confirmation.
- Do NOT write `customFields` from an import, ever — Xero files do not carry them.
- Do NOT let a preview persist to the DB.
- Do NOT auto-run commit after preview — the two calls are separate on purpose.
- Do NOT add a new permission code.
- Do NOT touch `/sot/`, Azure/Entra/SharePoint.
- Do NOT exceed 10 files.

## Escalation

`escalates: true` (set 2026-08-17, Marco's pre-restart queue review). This slice writes an
IMPORT path into the Xero integration and the audit service. Xero is the ledger boundary - a
wrong import is a finance problem, not a UI problem. It still RUNS; only the merge waits.
Label the resulting PR `do-not-merge` for Marco.
