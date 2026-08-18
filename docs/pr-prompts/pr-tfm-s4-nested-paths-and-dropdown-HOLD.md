---
premise: '! grep -q "ensureTenderQuoteClientFolder" apps/api/src/modules/platform/sharepoint.service.ts'
premise_means: ensureTenderCategoryFolder still assumes a single flat segment; no per-client Quotes/{Client}/ nested folder support exists and the upload dropdown is a flat list rather than a tree.
scope:
  - apps/api/src/modules/platform/sharepoint.service.ts
  - apps/api/src/modules/platform/sharepoint.service.spec.ts
  - apps/api/src/modules/tender-documents/tender-documents.service.ts
  - apps/api/src/modules/tender-documents/tender-documents.service.spec.ts
  - apps/web/src/pages/tendering/UploadCategoryPicker.tsx
  - apps/web/src/pages/tendering/__tests__/UploadCategoryPicker.test.tsx
done_when: pnpm build && pnpm lint && grep -q "ensureTenderQuoteClientFolder" apps/api/src/modules/platform/sharepoint.service.ts && grep -q "TENDER_FOLDER_STRUCTURE" apps/web/src/pages/tendering/UploadCategoryPicker.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_on_main: apps/api/src/modules/tender-documents/tender-document-categories.ts :: TENDER_FOLDER_STRUCTURE
cluster: tender-folder-model
---

# TFM-S4: Nested paths + per-client Quotes folders

**Binding plan:** `docs/plans/tender-folder-model-plan.md` (section 4 for the target model,
section 6 TFM-S4). Gated on TFM-S3 (`TENDER_FOLDER_STRUCTURE` on `origin/main`).

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `sharepoint.service.ts:253 ensureTenderCategoryFolder` currently expects the category
  argument to name one direct child of the tender folder. It walks one segment. This slice
  teaches it to walk arbitrary nested paths like
  `1. Plans, Scopes & Specs/01. Drawings`.
- `Tender.tenderClients` is the source of truth for which clients get a `Quotes/{Client}/`
  subfolder. Client names must be sanitised the same way tender folder names are (S2 helper).
- The web upload widget currently renders a flat `<select>` populated from
  `DOCUMENT_CATEGORIES`. It must become a tree/hierarchical picker sourced from
  `TENDER_FOLDER_STRUCTURE`, with the `Quotes/` node expanding into the tender's own
  clients.

## What to build

### 1. `ensureTenderCategoryFolder` walks nested paths

In `sharepoint.service.ts`, change `ensureTenderCategoryFolder` so its `category` argument
accepts a slash-separated path (`"1. Plans, Scopes & Specs/01. Drawings"`), split it, and
create/ensure each segment in order under the tender's root. A single-segment call must keep
working unchanged.

### 2. `ensureTenderQuoteClientFolder`

Add a sibling method:

```typescript
async ensureTenderQuoteClientFolder(
  tenderId: string,
  clientName: string,
): Promise<{ folderId: string; folderPath: string }>
```

Creates `.../Quotes/{sanitisedClientName}/` and returns the resulting folderId/path. Reuse
the S2 sanitisation helper for the client name segment. Called from `ensureTenderFolderStructure`
once per row in `tender.tenderClients`.

### 3. Wire the per-client folders on provisioning

In `ensureTenderFolderStructure`, after the base structure is walked, iterate
`tender.tenderClients` and call `ensureTenderQuoteClientFolder(tender.id, tc.client.name)`
for each. If `tenderClients` is empty, still create the parent `Quotes/` folder (so an
uploader can drop a file into a fresh client-less tender).

### 4. Route uploads through the nested path

In `tender-documents.service.ts`, when a document's resolved category is a nested path,
call the updated `ensureTenderCategoryFolder` with the full path string. When the resolved
category is `Quotes/{Client}`, call `ensureTenderQuoteClientFolder` instead. A legacy
category value that no longer resolves cleanly must render under `7. Other`, never blank.

### 5. Tree upload picker — `UploadCategoryPicker.tsx`

New web component that renders `TENDER_FOLDER_STRUCTURE` as a hierarchical picker. The
`Quotes/` node lazily expands into `Tender.tenderClients` entries fetched from the current
tender context. Emits the full slash-separated path as its selected value.

Replace the old flat dropdown at every call site (grep for the current picker; there is one
canonical usage in the document upload dialog).

### 6. Tests

- `sharepoint.service.spec.ts`: `ensureTenderCategoryFolder` walks a two-segment path and
  creates both segments; `ensureTenderQuoteClientFolder` sanitises client names the same
  way S2 sanitises tender folder names.
- `tender-documents.service.spec.ts`: routing with a legacy category still works
  (`Drawings` → `1. Plans, Scopes & Specs/01. Drawings`), routing with a `Quotes/{Client}`
  path targets the client subfolder.
- `UploadCategoryPicker.test.tsx`: renders the tree, expanding `Quotes` reveals the
  tender's clients, selecting a leaf emits the full path.

## Do NOT

- Do NOT change the persisted `TenderDocumentLink.category` column shape — it already stores
  string paths; the S3 remap adjusted the values.
- Do NOT touch `TENDER_FOLDER_STRUCTURE` — S3 owns it.
- Do NOT surface provisioning status here — TFM-S5 is that slice.
- Do NOT touch the legacy copy service — TFM-S6/S7 own it.
- Do NOT edit `/sot/`.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not
> ask.**

## Guardrails

- One attempt. If `ensureTenderQuoteClientFolder` already exists on main, say
  `NO-OP: nested paths already shipped` and stop.
- `pnpm build` and `pnpm lint` must both pass before pushing.
