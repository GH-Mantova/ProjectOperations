---
premise: '! grep -q "TENDER_FOLDER_STRUCTURE" apps/api/src/modules/tender-documents/tender-document-categories.ts'
premise_means: The flat 11-entry DOCUMENT_CATEGORIES list still doubles as both the folder tree and the upload dropdown; no unified nested TENDER_FOLDER_STRUCTURE exists that maps every legacy category value to a home under the new template.
scope:
  - apps/api/src/modules/tender-documents/tender-document-categories.ts
  - apps/api/src/modules/platform/sharepoint.service.ts
  - apps/api/src/modules/tender-documents/tender-documents.service.ts
  - apps/api/prisma/migrations/20260819130000_remap_tender_document_category/migration.sql
  - apps/api/src/modules/tender-documents/__tests__/tender-document-categories.spec.ts
  - apps/api/src/modules/tender-documents/tender-documents.service.spec.ts
done_when: pnpm build && pnpm lint && grep -q "TENDER_FOLDER_STRUCTURE" apps/api/src/modules/tender-documents/tender-document-categories.ts && grep -q "normaliseDocumentCategory" apps/api/src/modules/tender-documents/tender-document-categories.ts
size: 6
gate_allow: migrations
seed_only: false
escalates: true
rollback_strategy: Data-only migration — UPDATEs rewrite existing TenderDocumentLink.category strings from the flat 11-entry vocabulary to the nested TENDER_FOLDER_STRUCTURE paths (e.g. `Drawings` → `1. Plans, Scopes & Specs/01. Drawings`). If the run dies mid-flight, re-running the migration is idempotent (every UPDATE is keyed to a legacy value that will no longer exist after the first pass). To fully revert, run the inverse UPDATE map manually (each new path maps back to exactly one legacy value) and drop the migration.
requires_on_main: apps/api/prisma/schema.prisma :: projectName
cluster: tender-folder-model
---

# TFM-S3: Template + unified category list (data remap)

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 4 for the target model,
section 6 TFM-S3 for the scope). This slice is gated on TFM-S2 (`projectName` field on
`origin/main`).

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `apps/api/src/modules/tender-documents/tender-document-categories.ts` currently holds a
  flat 11-entry `DOCUMENT_CATEGORIES` used BOTH by `sharepoint.service.ts` to build the
  folder tree AND by the upload dropdown. The two must not diverge.
- `TenderDocumentLink.category` on the DB stores one of the 11 legacy string values. A data
  remap over these rows is required so every existing document renders under a valid new
  home after S4.
- `normaliseDocumentCategory` already accepts alias inputs. **Extend the alias map, never
  replace it** — every string the system has ever accepted must continue to resolve.

## What to build

### 1. Unified `TENDER_FOLDER_STRUCTURE`

In `tender-document-categories.ts`, add and export a nested tree:

```typescript
export const TENDER_FOLDER_STRUCTURE = [
  { name: "1. Plans, Scopes & Specs", children: [
    { name: "01. Drawings" },
    { name: "02. Specifications" },
    { name: "03. Registers & BoQ" },
    { name: "04. As Builts" },
  ]},
  { name: "2. Photos" },
  { name: "3. Estimates & Calcs", children: [{ name: "Superseded" }] },
  { name: "4. Suppliers" },
  { name: "5. Compliance, WHS & Asbestos" },
  { name: "6. Correspondence" },
  { name: "7. Other" },
  { name: "Quotes" },                       // per-client children added by S4
] as const;
```

Add helper `flattenFolderPaths(tree)` that produces the leaf path list
(`"1. Plans, Scopes & Specs/01. Drawings"`, ...) for use by `sharepoint.service.ts`.

### 2. Legacy → new mapping (extend, do not replace)

Extend `normaliseDocumentCategory` so every one of the 11 legacy values resolves to a leaf
in `TENDER_FOLDER_STRUCTURE`. Required mappings:

| Legacy value        | New path                             |
|---------------------|--------------------------------------|
| `Tender Documents`  | `1. Plans, Scopes & Specs`           |
| `Drawings`          | `1. Plans, Scopes & Specs/01. Drawings` |
| `Specifications`    | `1. Plans, Scopes & Specs/02. Specifications` |
| `BoQ`               | `1. Plans, Scopes & Specs/03. Registers & BoQ` |
| `Photos`            | `2. Photos`                          |
| `Estimates`         | `3. Estimates & Calcs`               |
| `Submissions`       | `3. Estimates & Calcs`               |
| `Supplier Quotes`   | `4. Suppliers`                       |
| `Compliance`        | `5. Compliance, WHS & Asbestos`      |
| `Correspondence`    | `6. Correspondence`                  |
| `Other`             | `7. Other`                           |

If your inventory of legacy values differs, ground it against
`apps/api/src/modules/tender-documents/tender-document-categories.ts` and map every one you
find. **Zero orphans.** The category spec (below) enumerates the list explicitly so the test
fails loudly if any value falls through.

### 3. Data remap migration

`apps/api/prisma/migrations/20260819130000_remap_tender_document_category/migration.sql`:

```sql
-- Remap legacy TenderDocumentLink.category values to the unified TENDER_FOLDER_STRUCTURE.
-- Every existing value is preserved as a routable path; nothing is dropped or nullified.
UPDATE "tender_document_links" SET "category" = '1. Plans, Scopes & Specs' WHERE "category" = 'Tender Documents';
UPDATE "tender_document_links" SET "category" = '1. Plans, Scopes & Specs/01. Drawings' WHERE "category" = 'Drawings';
-- ... one UPDATE per legacy value from the mapping above
```

No schema change; the `category` column stays a `TEXT`. No default alteration, no constraint
change.

### 4. Point provisioning at the new structure

In `sharepoint.service.ts`, replace the flat iteration over `DOCUMENT_CATEGORIES` with a
walk over `flattenFolderPaths(TENDER_FOLDER_STRUCTURE)`. Do NOT add the per-client
`Quotes/{Client}/` subfolders here — that is TFM-S4.

### 5. Route uploads by the unified list

In `tender-documents.service.ts`, wherever the upload path is composed, resolve the caller's
category string through `normaliseDocumentCategory` and use the returned path. A document
carrying an unrecognised category must render under `7. Other`, never blank.

### 6. Tests

- `__tests__/tender-document-categories.spec.ts` (new): assert every one of the 11 legacy
  values maps to a non-empty leaf path in `TENDER_FOLDER_STRUCTURE` — this is the
  zero-orphan guarantee.
- Extend `tender-documents.service.spec.ts`: upload with each legacy category, assert the
  resolved SharePoint path is the mapped one.

## Do NOT

- Do NOT replace `normaliseDocumentCategory` — extend its alias map. Every string the system
  has ever accepted must still resolve.
- Do NOT add the per-client `Quotes/{Client}/` subfolders — TFM-S4.
- Do NOT change the folder-naming logic or `projectName` behaviour — TFM-S2 already shipped.
- Do NOT drop or nullify any `TenderDocumentLink.category` row — every row is remapped in
  place.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.** This slice sets `escalates: true` because it rewrites production-shape data
> — the PR opens and stays open for Marco to review before the merge queue processes it.

## Guardrails

- One attempt. If `TENDER_FOLDER_STRUCTURE` already exists on main, say
  `NO-OP: unified structure already shipped` and stop.
- Ground the legacy category inventory against
  `tender-document-categories.ts` before writing the UPDATE statements — if a legacy value
  is missing from the mapping above, add it; do not omit it.
- `pnpm build` and `pnpm lint` must both pass before pushing.

GATE-ALLOW: migrations
