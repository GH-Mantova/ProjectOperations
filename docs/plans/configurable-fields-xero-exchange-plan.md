# Configurable client/vendor field engine + file-based Xero exchange (CFX)

**Status:** approved 2026-08-12 (Marco, PR-Master Phase 2 panel). Every audit finding below
was re-verified against origin/main HEAD on 2026-08-12 before this plan was written.
**Owner:** Marco / ProjectOperations desktop-shell.
**Rule:** every code slice chains behind this document (`requires_file_on_main`). Slices ship
independently, each ≤ 10 files, each CI-green.

The **dormant Xero API push** in `apps/api/src/modules/xero/xero.service.ts:262 (syncContact)`
is preserved untouched — Marco's Xero tenant is not connected. The practical path is a
file-based CSV exchange (Xero's stock contact import/export format) that works regardless of
whether Xero API credentials are configured.

---

## 1. Motivation and what this plan replaces

Verified state on origin/main HEAD 2026-08-12 (evidence pinned to files/lines):

1. **`Client` is already near-Xero-parity typed.**
   `apps/api/prisma/schema.prisma:672-752` — model `Client` (fields: name, code, status,
   email, phone, notes, tradingName, businessType, abn, acn, gstRegistered, legalName,
   country, paymentTermsDay/Type/Days, industry, website, physical+postal address blocks,
   postalSameAs, creditLimit, creditApproved, preferredPayment, **bankName, bankAccountName,
   bankBsb, bankAccountNumber**, xeroContactId, myobCardId, isActive, onHold, onHoldReason,
   internalNotes, claim reminders, win-rate rollups). These are typed columns real logic
   depends on — the auto-invoice path (`xero.service.ts:262`), credit checks, claim
   reminders, and reporting all read them.

2. **`SubcontractorSupplier` mirrors most of the same shape.**
   `apps/api/prisma/schema.prisma:4278-4347` — model `SubcontractorSupplier` (fields: name,
   tradingName, businessType, abn, acn, gstRegistered, legalName, country, paymentTermsDay/
   Type/Days, website, entityType, categories, prequalStatus/Notes/ReviewedAt/ReviewedBy,
   swmsOnFile/ReviewedAt, email, phone, physical+postal address blocks, creditLimit,
   creditApproved, preferredPayment, **bankName, bankAccountName, bankBsb,
   bankAccountNumber**, xeroContactId, myobCardId, isActive, onHold, performanceRating,
   compliance-block flags). Same story — real modules read these columns.

3. **A Xero API contact push already exists but is DORMANT.**
   `apps/api/src/modules/xero/xero.service.ts:262 (syncContact)` pushes a single client
   to Xero via the xero-node SDK, and `syncAllContacts` (L328) does a bulk sweep. This code
   IS wired up (`XeroService`, controller under `apps/api/src/modules/xero/xero.controller.ts`)
   but is not usable in Marco's environment because Xero API credentials are not connected.
   The dormant path is preserved — this plan adds a parallel FILE-based exchange that works
   without any Xero credentials.

4. **No custom/configurable-field engine exists.**
   `apps/api/prisma/schema.prisma` — `GlobalList` is the only "admin editable" surface today,
   and it is a managed-dropdown store (options for a list). There is no field-registry table,
   no per-record `Json` bag, and no way for the admin UI to reorder / rename / hide / add
   fields on a client or supplier record.

5. **Two Xero-parity fields are MISSING from both models.**
   Xero's contact CSV expects sales/purchase **account codes** and a **discount** percentage.
   Neither `Client` nor `SubcontractorSupplier` carries these columns today, so any file-based
   export we build cannot round-trip them. Add both as typed BUILTIN columns in CFX-1.

6. **Admin-controller convention is under `admin-settings` / `admin-users`.**
   `apps/api/src/modules/admin-settings/admin-settings.controller.ts` — new admin-only
   services in this program have consistently been mounted under
   `apps/api/src/modules/<name>`, so the field-definition service lives in a new module
   `apps/api/src/modules/field-definitions/`.

---

## 2. Decisions baked in — DO NOT re-open

These were locked at the 2026-08-12 PR-Master specialist panel. Each is grounded in the code
above; challenge one only if the ground truth in §1 has changed.

1. **Hybrid registry, NOT EAV.** Keep every existing typed column as a first-class field.
   Add a new `FieldDefinition` registry (`key`, `label`, `order`, `visibility`, `required`,
   `group`, `appliesTo: CLIENT | VENDOR | BOTH`, `source: BUILTIN | CUSTOM`) that *describes*
   the built-ins and *defines* new fields. Store custom-field values in ONE additive
   `customFields Json` column on each of `Client` and `SubcontractorSupplier`. This preserves
   every consumer of the typed columns and gains configurability. **No EAV table.**

2. **"Delete a built-in" = HIDE it (visibility off).** A built-in column is never dropped
   — hidden means the admin form and any dynamic surface stop rendering it, but the column
   stays and continues to feed the logic that reads it. Rename / reorder / require / hide
   works on **any** field. Add / remove works freely on CUSTOM fields only.

3. **Xero file export/import maps BUILTIN (parity) fields only.** Custom fields are
   ERP-only and never round-trip to Xero — Xero rejects unknown columns on import.

4. **Add the two missing parity fields as typed columns.**
   `salesAccountCode String? @map("sales_account_code")`,
   `purchaseAccountCode String? @map("purchase_account_code")`,
   `discount Decimal? @db.Decimal(5, 2)` on both `Client` and `SubcontractorSupplier`.
   Register them as BUILTIN in `FieldDefinition` seed.

5. **File exchange is manual-layout tolerant.** Import accepts a CSV or TXT the user has
   aligned (column headers user-editable → mapped to Xero fields at import time). **Every
   import runs dry-run first**, reports counts and diffs, then commits only on user confirm.
   ERP is source of truth — upsert with review, never blindly clobber a mastered value.

6. **Permissions.** Configuring field definitions is super-user + audit-logged. Export and
   import are permissioned and audited (export files carry BSB + account number, which are
   sensitive PII in AU). Import defaults to dry-run.

7. **Keep the daily form lean.** Custom fields are optional, grouped, and collapsed by
   default. The everyday create-client / create-vendor form is not buried by config.

---

## 3. Ground truth (exact lines on origin/main 2026-08-12)

| Artifact | Location | Key lines |
|---|---|---|
| `model Client` | `apps/api/prisma/schema.prisma` | L672–752 |
| `model SubcontractorSupplier` | `apps/api/prisma/schema.prisma` | L4278–4347 |
| `XeroService.syncContact` (dormant API push) | `apps/api/src/modules/xero/xero.service.ts` | L262 |
| `XeroService.syncAllContacts` | `apps/api/src/modules/xero/xero.service.ts` | L328 |
| Admin settings module (convention pattern) | `apps/api/src/modules/admin-settings/` | — |
| Directory module (client/supplier CRUD entry point) | `apps/api/src/modules/directory/directory.controller.ts` | L225+ |
| Master-data upsertClient (typed shape reference) | `apps/api/src/modules/master-data/master-data.service.ts` | L91–92 |
| AddClientModal (web) | `apps/web/src/pages/tendering/AddClientModal.tsx` | — |
| SubcontractorsPage (web) | `apps/web/src/pages/directory/SubcontractorsPage.tsx` | — |
| Admin nav shell | `apps/web/src/components/SettingsShell.tsx` | — |

---

## 4. Non-goals

- Do NOT touch `XeroService.syncContact` (the dormant API path). Keep it exactly as-is.
- Do NOT round-trip custom fields to Xero — Xero only accepts its known columns.
- Do NOT convert existing typed columns to EAV; do NOT drop any built-in column.
- Do NOT touch Azure / Entra / SharePoint.
- Do NOT touch `/sot/` (a sot-keeper reconcile is a separate future slice — file after CFX-5).
- No new API keys or OAuth flows; the file exchange is offline.
- No mobile / field-side navigation changes.

---

## 5. Slice list (ordered, independently shippable)

Each slice ≤ 10 files. Dependency edges expressed as `requires_file_on_main`. Every slice
is docs-and-code; no `/sot/` edits.

### SLICE 0 — this document + 5 slice prompts (docs-only) `size:8`

- **Files:** `docs/plans/configurable-fields-xero-exchange-plan.md` (this file) + 5 slice prompts.
- **Gate:** `pnpm lint` (docs-only PR still runs the standard gates).
- **Requires:** nothing.

### CFX-1 (S1) — field registry + customFields + missing parity fields `size:9`

**Dependency:** none (first in chain).

**What changes:**
- `apps/api/prisma/schema.prisma` — add `model FieldDefinition` (id, key, label, group,
  sortOrder, visible, required, appliesTo enum, source enum, createdAt, updatedAt,
  `@@unique([appliesTo, key])`); add `customFields Json?` to `Client` and to
  `SubcontractorSupplier`; add `salesAccountCode String?`, `purchaseAccountCode String?`,
  `discount Decimal? @db.Decimal(5, 2)` to BOTH models; add two enums
  `FieldAppliesTo { CLIENT VENDOR BOTH }` and `FieldSource { BUILTIN CUSTOM }`.
- `apps/api/prisma/migrations/**` — ONE additive migration: `CREATE TABLE field_definitions`;
  `ALTER TABLE clients ADD COLUMN custom_fields JSONB`, `ADD COLUMN sales_account_code TEXT`,
  `ADD COLUMN purchase_account_code TEXT`, `ADD COLUMN discount NUMERIC(5,2)`; same three
  ADDs on `subcontractor_suppliers`; create the two enums. All ADDs are nullable; NO
  `UPDATE … SET` — this migration is purely additive.
- `apps/api/prisma/seeds/**` — new seed `field-definitions-builtin.ts` that upserts one
  `FieldDefinition` row per typed BUILTIN column on `Client` and on `SubcontractorSupplier`
  (source=BUILTIN, visible=true, sortOrder from a stable list, group from a labelled group
  like "Identity", "Contact", "Address", "Payment", "Banking", "Compliance"). Wire it into
  the main seed entry.
- `apps/api/src/modules/field-definitions/field-definitions.service.ts` (new) — CRUD:
  `list(appliesTo)`, `get(id)`, `createCustom(dto)` (source=CUSTOM only), `update(id, dto)`
  (label/group/sortOrder/visible/required only; block key/source/appliesTo mutation),
  `remove(id)` (block if source=BUILTIN — return 400 with "built-ins can only be hidden").
- `apps/api/src/modules/field-definitions/field-definitions.module.ts` (new).
- `apps/api/src/modules/field-definitions/__tests__/field-definitions.service.spec.ts` (new)
  — unit tests for the four rules above (built-in cannot be deleted; custom can; key/source
  immutable; visible toggles cleanly).
- `docs/data-model/**` — regenerate + commit `relationship-map.json`, `relationship-map.md`,
  and `metadata-catalog.json` (CI drift check hard-fails a schema change without this).
- PR body carries `GATE-ALLOW: migrations` as a bare line at column 0.

**Rollback:** additive — new table `field_definitions`, nullable `custom_fields` JSON columns,
nullable typed columns. Safe to leave on `main` without the consuming code, safe to drop
(no data migration to unwind).

**GATE-ALLOW:** migrations. **`backfill: false`** (no `UPDATE … SET` in the migration).

**Files count:** 8 (schema, 1 migration, 1 seed, service, module, spec, 3 data-model
generated files → 9 with data-model, still ≤ 10).

**Verify:** `pnpm build && pnpm lint && grep -q "model FieldDefinition" apps/api/prisma/schema.prisma
&& node scripts/data-model/build-relationship-map.mjs --check`

### CFX-2 (S2) — admin field-config screen `size:6`

**Dependency:** `requires_file_on_main: apps/api/src/modules/field-definitions/field-definitions.service.ts`
(created by CFX-1).

**What changes:**
- `apps/api/src/modules/field-definitions/field-definitions.controller.ts` (new) — REST
  routes `GET/POST/PATCH/DELETE /field-definitions` gated on super-user (reuse the existing
  super-user guard used by admin-settings; DO NOT invent a new permission code).
- `apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx` (new) — table per `appliesTo`
  (CLIENT / VENDOR / BOTH) with columns: label, key, group, sort, visible, required, source.
  Row actions: reorder (drag or up/down), rename label, toggle visible, toggle required,
  edit group. "Add custom field" opens a modal (key kebab-slug, label, group, appliesTo,
  required). Built-in rows show a lock icon on key/source; "Remove" is disabled for
  BUILTIN with tooltip "Hide built-in fields instead of deleting them."
- `apps/web/src/App.tsx` — register route `/admin/field-definitions` → `FieldDefinitionAdminPage`
  gated on super-user.
- `apps/web/src/components/SettingsShell.tsx` — add nav entry "Field definitions" under
  Administration.
- `apps/web/src/pages/admin/__tests__/FieldDefinitionAdminPage.test.tsx` (new) — vitest
  covering: BUILTIN Remove is disabled; toggle visible calls PATCH with `visible:false`;
  add-custom modal round-trip.

**Rollback:** revert the new controller + page + route registration. No DB change.

**Files count:** 5.

**Verify:** `pnpm build && pnpm lint && grep -q "FieldDefinitionAdminPage" apps/web/src/App.tsx`

### CFX-3 (S3) — dynamic field rendering on client + vendor forms `size:8`

**Dependency:** `requires_file_on_main: apps/web/src/pages/admin/FieldDefinitionAdminPage.tsx`
(created by CFX-2).

**What changes:**
- `apps/web/src/components/DynamicFieldSection.tsx` (new) — renders BUILTIN + CUSTOM
  fields grouped by `group`, ordered by `sortOrder`, honouring `visible` + `required`.
  Built-ins bind to the typed field on the record; customs bind to `record.customFields[key]`.
- `apps/web/src/hooks/useFieldDefinitions.ts` (new) — cached fetch of `/field-definitions?appliesTo=`.
- `apps/web/src/pages/tendering/AddClientModal.tsx` — replace the hand-written field grid
  with `<DynamicFieldSection appliesTo="CLIENT" record={form} onChange={setForm} />`.
  Preserve every existing submit-time validation and the existing submit call shape.
- `apps/web/src/pages/tendering/ClientDetailDrawer.tsx` — swap the edit-panel fields for
  `DynamicFieldSection` (read + edit).
- `apps/web/src/pages/directory/SubcontractorsPage.tsx` — add/edit form uses
  `<DynamicFieldSection appliesTo="VENDOR" ... />`.
- `apps/api/src/modules/directory/directory.service.ts` — accept `customFields` in the
  update DTO for suppliers; validate keys against `FieldDefinition` (drop unknown keys).
- `apps/api/src/modules/master-data/master-data.service.ts` — same for `upsertClient`:
  accept `customFields`, validate keys against the registry.
- `apps/web/src/components/__tests__/DynamicFieldSection.test.tsx` (new) — vitest covering:
  hidden fields do not render; required fields block submit; custom field writes to
  `customFields[key]`.

**Rollback:** revert the web files + the two service update-DTO changes. No DB change.

**Files count:** 8.

**Verify:** `pnpm build && pnpm lint && grep -rq "DynamicFieldSection" apps/web/src/pages`

### CFX-4 (S4) — Xero-format file EXPORT `size:7`

**Dependency:** `requires_file_on_main: apps/web/src/components/DynamicFieldSection.tsx`
(created by CFX-3).

**What changes:**
- `apps/api/src/modules/xero/xero-contact-export.service.ts` (new) — pure builder that
  maps BUILTIN fields of `Client` (and, separately, `SubcontractorSupplier`) to Xero's
  contact-import CSV column set: ContactName, EmailAddress, FirstName, LastName,
  POAddressLine1..4/City/Region/PostalCode/Country, SAAddressLine1..4/City/Region/
  PostalCode/Country, PhoneNumber, MobileNumber, DirectDialNumber, FaxNumber, Website,
  TaxNumber (=ABN), AccountNumber (=code), BankAccountName, BankAccountNumber (BSB +
  Account joined per Xero's AU format), SalesAccount (=salesAccountCode),
  PurchasesAccount (=purchaseAccountCode), Discount, DefaultCurrency ("AUD"). Custom
  fields are NEVER included. Bank/BSB/account are only included when the caller passes
  `includeBankDetails: true`. Emits CSV bytes; no side effects.
- `apps/api/src/modules/xero/xero.controller.ts` — add `GET /xero/export/clients.csv` and
  `GET /xero/export/vendors.csv`, both permissioned (reuse existing xero-admin gate) and
  audited via `AuditService` (record: userId, entityCount, includeBankDetails flag).
  Set `Content-Type: text/csv` and `Content-Disposition: attachment; filename="xero-<type>-<yyyy-mm-dd>.csv"`.
- `apps/api/src/modules/xero/__tests__/xero-contact-export.service.spec.ts` (new) — unit
  tests: CSV column order matches Xero's spec; custom fields excluded; bank fields excluded
  when `includeBankDetails:false`; Decimal fields serialise to plain numbers; empty optionals
  serialise as empty strings (not "null").
- `apps/web/src/pages/admin/XeroExchangePage.tsx` (new) — admin surface with two "Download
  CSV" buttons (Clients / Vendors), a "Include bank details" checkbox (defaults off with a
  yellow warning), and a note that the file matches Xero's contact-import format.
- `apps/web/src/App.tsx` — register `/admin/xero-exchange` → `XeroExchangePage`, gated on
  the xero-admin permission.
- `apps/web/src/components/SettingsShell.tsx` — add nav entry "Xero file exchange" under
  Administration.
- `apps/web/src/pages/admin/__tests__/XeroExchangePage.test.tsx` (new) — vitest: the bank
  checkbox toggles the download URL; the warning text is visible when bank is on.

**Rollback:** revert the new controller routes + page + service. No DB change.

**Files count:** 7.

**Verify:** `pnpm build && pnpm lint && test -f apps/api/src/modules/xero/xero-contact-export.service.ts`

### CFX-5 (S5) — Xero-format file IMPORT (dry-run → confirm) `size:9`

**Dependency:** `requires_file_on_main: apps/api/src/modules/xero/xero-contact-export.service.ts`
(created by CFX-4).

**What changes:**
- `apps/api/src/modules/xero/xero-contact-import.service.ts` (new) — accepts uploaded CSV
  or TXT bytes + a caller-supplied column-map (`{ourField: userHeaderName}`), because
  Marco's on-hand files may have any column order. Two entry points:
  `previewImport({file, appliesTo, columnMap})` returns a DRY-RUN report:
  per-row { matchedByXeroContactId | matchedByName | new }, diffs of typed fields that
  would change, list of rejected rows with reasons (unmapped required column, invalid ABN
  checksum, invalid BSB format). No writes. `commitImport({previewId, actorUserId})` applies
  the preview using an upsert-per-row transaction. Custom fields are NEVER written from
  import (the file is a Xero file, and custom fields are ERP-only per decision 3). Bank
  fields are only written when the row is NEW; existing bank details are NEVER overwritten
  (ERP-mastered — surfaces a "would overwrite" warning in the preview instead).
- `apps/api/src/modules/xero/xero.controller.ts` — add `POST /xero/import/preview` (multipart
  upload) and `POST /xero/import/commit` (JSON body with previewId + confirmation). Both
  permissioned (xero-admin) and audited (record file hash, row counts, changed columns).
- `apps/api/src/modules/xero/__tests__/xero-contact-import.service.spec.ts` (new) — unit
  tests: dry-run returns diffs but does not write; commit applies only after preview;
  existing bank fields on a matched row are NOT overwritten (returns "would overwrite"
  warning); custom fields in the CSV are ignored; malformed rows are rejected with a reason
  string.
- `apps/web/src/pages/admin/XeroExchangePage.tsx` — add an "Import CSV" section: file
  input, appliesTo picker (CLIENT / VENDOR), column-mapping table that shows detected
  headers next to a dropdown of BUILTIN field keys, "Preview" button → results table with
  per-row action + diffs, "Confirm and import" button → commit.
- `apps/web/src/components/CsvColumnMapper.tsx` (new) — reusable header→field mapper.
- `apps/web/src/pages/admin/__tests__/XeroExchangePage.import.test.tsx` (new) — vitest
  covering: preview shows diffs; commit disabled until preview finishes; existing bank
  fields flagged as "would overwrite".
- `apps/api/src/modules/audit/audit.service.ts` — extend the audit event vocabulary to
  include `XERO_FILE_IMPORT_PREVIEW` and `XERO_FILE_IMPORT_COMMIT` if not already present
  (check first — add only if missing).

**Rollback:** revert the new controller routes + services + web additions. No DB change
because preview never writes, and commit writes only into existing typed columns.

**Files count:** 8 (auditing extension may or may not be needed; still ≤ 10).

**Verify:** `pnpm build && pnpm lint && test -f apps/api/src/modules/xero/xero-contact-import.service.ts`

---

## 6. Sequencing diagram

```
CFX-1 (schema + service) ──► CFX-2 (admin config UI) ──► CFX-3 (dynamic render)
                                                                  │
                                                                  ▼
                                                        CFX-4 (file export)
                                                                  │
                                                                  ▼
                                                        CFX-5 (file import: dry-run → commit)
```

Strict linear chain — CFX-5 depends on CFX-4's service file, CFX-4 on CFX-3's component,
CFX-3 on CFX-2's admin page, CFX-2 on CFX-1's service. Each `requires_file_on_main` gate
enforces the order at dequeue.

---

## 7. Risks

### 7.1 Schema drift: new columns must appear in the data-model map

`docs/data-model/relationship-map.json` is regenerated on every schema change and checked
by CI. CFX-1 must run `node scripts/data-model/build-relationship-map.mjs` and commit the
three regenerated files in the same PR. Missed on #593 (integration-keys) — do not repeat.

### 7.2 Prisma create/update spec assertions break when adding fields

Any existing `*.spec.ts` that does `toHaveBeenCalledWith(...)` on `prisma.client.create` /
`prisma.subcontractorSupplier.create` may need the three new BUILTIN columns
(`salesAccountCode`, `purchaseAccountCode`, `discount`) plus `customFields` in the expected
object. CFX-1 must grep for such specs and update them, or the API test job fails.

### 7.3 GATE-ALLOW marker format

CFX-1's PR body MUST contain `GATE-ALLOW: migrations` as a **bare line at column 0** (no
heading, no trailing period). CP-11's regex does not match `## GATE-ALLOW: migrations` and
does not match `GATE-ALLOW: migrations.` — this has burned 10 PRs. The pipeline writes
this automatically when `gate_allow: migrations` is in the front-matter; do not hand-write.

### 7.4 Custom fields must be validated on write

`DynamicFieldSection` writes to `record.customFields[key]`. The API-side update must
validate the keys against `FieldDefinition` and drop any unknown key — otherwise the
client can shove arbitrary JSON into the DB. CFX-3 covers this in
`directory.service.ts` and `master-data.service.ts`.

### 7.5 Bank details in the export CSV are sensitive

`bankAccountName`, `bankBsb`, `bankAccountNumber` are AU banking PII. The export defaults
`includeBankDetails: false`, and the admin UI shows a warning before toggling on. Every
export is audited with the flag value. This is a policy decision, not a technical one —
do not remove the warning.

### 7.6 Import must not overwrite ERP-mastered bank details

CFX-5's `commitImport` is upsert-with-review. If a matched row already has bank details
set, the imported values are NEVER written silently — the preview surfaces "would
overwrite" and the caller must explicitly confirm per row. This is the "ERP is source
of truth" rule (decision 5). A blind overwrite would let a stale Xero file wipe correct
banking details.

### 7.7 Column-map mismatch on import

Marco's on-hand files may have any header layout. The `CsvColumnMapper` component surfaces
detected headers so the caller pairs them to BUILTIN keys manually. If a required column
is unmapped, the preview refuses to run (returns a clear error).

### 7.8 Do NOT re-add existing typed fields

The registry seed for BUILTIN rows must reference the columns that already exist. Adding a
duplicate typed column (e.g., a second `phone` field) breaks reporting. CFX-1 authors: list
the existing columns from §3 first, then generate the seed rows from that list.

---

## 8. Verification of this document

- [x] `test -f docs/plans/configurable-fields-xero-exchange-plan.md`
- [x] Every entity/field cited in §3 is pinned to a file:line verified on origin/main 2026-08-12.
- [x] Five slice prompts (`pr-cfx-s1..s5-*-ready.md`) chain via `requires_file_on_main`.
- [ ] `pnpm build && pnpm lint` (run at PR-open time).
- [ ] `node scripts/pipeline/lint-prompt.mjs` on each slice prompt exits 0.
