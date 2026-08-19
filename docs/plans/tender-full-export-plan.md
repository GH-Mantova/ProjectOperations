# Full-Tender Export — Build Plan (SLICE 0)

**Status:** plan only — no code. Written 2026-08-19.
**Scope this doc:** decide manifest, envelope, doc-index contract, scale limits, redaction,
slice breakdown. Downstream slices implement from this doc.
**Nature of feature:** portability / audit snapshot. **Not** a backup or recovery path — the
real recovery control is Azure PostgreSQL point-in-time restore.

---

## Binding decisions (do not re-litigate)

| Ref  | Decision |
|------|----------|
| D52  | **Permission = SUPER-USER ONLY** via `SuperUserGuard` (`apps/api/src/common/auth/super-user.guard.ts`). Not the archive `jobs.view` precedent — this is information disclosure, not a status export. Ship restricted; widen later if a business case appears. |
| D53  | **Scope = BULK over the filtered register only.** One entry point, mirroring `buildRegisterCsv` (`apps/web/src/pages/tendering/TenderingPage.tsx:114,617`) — respects the filter chips, ignores selection. **No single-tender button on `TenderDetailPage`.** One code path, one guard check. |
| run5 | **JSON snapshot first.** Renderer (PDF/HTML) is a follow-on, out of scope until snapshot ships. |
| run5 | **ALL tender surfaces**, including **both** Correspondence **and** Activity/Follow-ups (they are distinct panels). |
| run5 | **Documents are an INDEX ONLY** — names, categories, links, metadata. Never file bytes. |

Endpoint shape mirrors the archive precedent (`apps/api/src/modules/archive/archive.controller.ts:85`)
but the guard is `SuperUserGuard`, not `@RequirePermissions("jobs.view")`. No new permission code
is added.

---

## Relation manifest — all 39 relations on `model Tender` (`apps/api/prisma/schema.prisma:1222-1315`)

Legend:
- **IN(full)** — nested rows serialised in full (all scalar columns).
- **IN(ref)** — id + minimal display fields only (name/label/number); no nested traversal.
- **OUT** — omitted. Reason given.

### Belongs-to (4)

| # | Relation | Target | Decision | Reason |
|---|----------|--------|----------|--------|
| 1 | `estimator` | User | IN(ref) | Actor identity for audit; PII minimised — see §Redaction. |
| 2 | `assignedEstimator` | User | IN(ref) | Same as (1). |
| 3 | `site` | Site | IN(full) | Site details are core tender context, not user PII. |
| 4 | `tenant` | Tenant | envelope-only | `tenantId` lives on envelope; do not nest the whole tenant record. |

### One-to-one dependents (7)

| # | Relation | Target | Decision | Depth | Reason |
|---|----------|--------|----------|-------|--------|
| 5 | `sourceJob` | Job | IN(ref) | id + jobNumber only | Downstream lifecycle entity — has its own export story. |
| 6 | `jobConversion` | JobConversion | IN(full) | flat | Audit of if/when/why the tender became a job — tender-scoped. |
| 7 | `estimate` | TenderEstimate | IN(full) | +1 (children if any) | Estimate IS a tender surface. |
| 8 | `scopeHeader` | ScopeOfWorksHeader | IN(full) | flat | Scope surface. |
| 9 | `tandC` | TenderTandC | IN(full) | flat | Terms surface. |
| 10 | `rateSet` | TenderRateSet | IN(full) | +1 (locked rate rows) | Tender-time pricing basis; needed to make export self-explanatory. |
| 11 | `opportunity` | Opportunity | IN(ref) | id + name | CRM upstream — has its own export story. |

### Collections (28)

| # | Relation | Target | Decision | Depth | Reason |
|---|----------|--------|----------|-------|--------|
| 12 | `tenderClients` | TenderClient | IN(full) | flat | Who the tender is for. |
| 13 | `tenderNotes` | TenderNote | IN(full) | flat | Internal notes surface. |
| 14 | `clarifications` | TenderClarification | IN(full) | +1 (`clarificationNotes` fold in here) | Clarifications surface. |
| 15 | `pricingSnapshots` | TenderPricingSnapshot | IN(full) | flat | Historical pricing — audit-critical. |
| 16 | `followUps` | TenderFollowUp | IN(full) | flat | Activity/Follow-ups surface (per run5). |
| 17 | `outcomes` | TenderOutcome | IN(full) | flat | Won/lost/withdrawn history. |
| 18 | `tenderDocuments` | TenderDocumentLink | IN(index) | **index only** | See §Document index contract — never file bytes. |
| 19 | `clientNotes` | TenderClientNote | **⚠ special** | flat if kept | See §Retirement dependency. |
| 20 | `scopeRevisions` | TenderScopeRevision | IN(full) | flat | Scope surface. |
| 21 | `scopeItems` | ScopeOfWorksItem | IN(full) | flat | Scope surface. |
| 22 | `scopeCards` | ScopeCard | IN(full) | flat | Scope surface. |
| 23 | `estimateExports` | EstimateExport | IN(full) | flat | Audit of prior exports. |
| 24 | `projects` | Project | IN(ref) | id + name | Downstream lifecycle entity. |
| 25 | `clarificationNotes` | TenderClarificationNote | folded into (14) | — | Avoid two copies of the same rows. |
| 26 | `entries` | TenderEntry | IN(full) | flat | Line-item surface. |
| 27 | `cuttingSheetItems` | CuttingSheetItem | IN(full) | flat | Fabrication scope surface. |
| 28 | `scopeViewConfigs` | ScopeViewConfig | **OUT** | — | Per-user UI preferences, not tender data. OPEN — Marco: confirm. |
| 29 | `withdrawalReviews` | TenderWithdrawalReview | IN(full) | flat | Withdrawn-review lane audit. |
| 30 | `assumptions` | TenderAssumption | IN(full) | flat | Assumptions surface. |
| 31 | `exclusions` | TenderExclusion | IN(full) | flat | Exclusions surface. |
| 32 | `clientQuotes` | ClientQuote | IN(full) | **+1** (all seven children, see §ClientQuote fan-out) | Quote surface — meaningless without children. |
| 33 | `packages` | TenderPackage | IN(full) | flat | Package surface. |
| 34 | `wasteItems` | ScopeWasteItem | IN(full) | flat | Waste-scope surface. |
| 35 | `safetyIncidents` | SafetyIncident | IN(full) | flat | Safety surface. |
| 36 | `hazardObservations` | HazardObservation | IN(full) | flat | Safety surface. |
| 37 | `correspondences` | CorrespondenceThread | IN(full) | +1 (messages within a thread) | Correspondence surface (distinct from Activity per run5). |
| 38 | `handovers` | Handover | IN(ref) | id + status | Downstream lifecycle entity. |
| 39 | `sorSnapshots` | JobSorSnapshot | IN(full) | +1 (locked rows) | Tender-time locked rate book — audit-critical. |

**ClientQuote fan-out (relation #32).** A ClientQuote carries `QuoteScopeItem`, `QuoteCostLine`,
`QuoteProvisionalLine`, `QuoteCostOption`, `QuoteAssumption`, `QuoteExclusion`, `QuoteEmail`. All
seven are IN(full) at depth +1; the traversal stops there (no grandchildren).

---

## ⚠ Retirement dependency — `clientNotes` / `TenderClientNote`

`docs/pr-prompts/pr-retire-tenderclientnote-s2-HOLD.md` (`escalates: true`) is queued to remove
this table. This plan does **not** silently enshrine a retiring table.

**OPEN — Marco:** pick one:
- **(a) Exclude now.** Manifest row 19 becomes OUT with reason "retirement pending". No slice
  serialises it. If retirement is later cancelled, add it back in a follow-on slice.
- **(b) Include, then remove.** Serialise it in the slice that owns notes (SLICE 3 below), and
  the retirement PR is responsible for deleting the corresponding serialiser code + schema
  version bump.

Default recommendation: **(a) Exclude now.** Simpler; avoids coupling this feature to another
in-flight retirement.

---

## Envelope shape

```jsonc
{
  "$schema": "tender-full-export/v1",         // schema version — see §Versioning
  "generatedAt": "2026-08-19T15:02:11.482Z",  // ISO 8601 UTC
  "generatedBy": {                            // audit trail of who ran the export
    "userId": "usr_...",
    "displayName": "Marco Neri",
    "isSuperUser": true
  },
  "tenantId": "tnt_...",                      // envelope-level, not nested
  "filterSummary": {                          // provenance of a BULK export
    "chipsApplied": { /* echo of RegisterFilters */ },
    "requestedCount": 42,
    "returnedCount": 42,
    "truncated": false
  },
  "tenders": [
    {
      "identity": {
        "id": "tnd_...",
        "tenderNumber": "T260819-ACME-Rev2",
        "revisionNumber": 2,
        "clientSlugSnapshot": "acme",
        "title": "..."
      },
      // ...all IN(full) scalar columns of Tender...
      "relations": {
        "estimator": { "id": "...", "displayName": "..." },
        "site": { /* full */ },
        "estimate": { /* full */ },
        // ...one key per manifest row that is IN, in manifest order...
        "documents": [ /* index only — see §Document index */ ]
      }
    }
  ]
}
```

**Identity rules.** A consumer diffing two exports of the same tender must be able to (a)
match them by `identity.id`, (b) order them by `generatedAt`, and (c) tell revisions apart via
`identity.revisionNumber`. `tenderNumber` alone is not sufficient because it changes on
revision.

**Versioning.** `$schema: "tender-full-export/v1"`. Breaking changes to any IN(full) shape or
the addition/removal of a manifest row bump to v2. Reordering keys within an object does not.

---

## Document index contract (relation #18, `TenderDocumentLink`)

**Emitted per row (from `apps/api/prisma/schema.prisma:1556-1575`):** `id`, `category`,
`title`, `description`, `createdAt`, `updatedAt`, `folderLink` (nested: `id`, provider URL if
present), `fileLink` (nested: `id`, provider URL if present, filename, mimeType, sizeBytes if
already stored as metadata).

**Never emitted:** file bytes; contents of any linked SharePoint object; anything requiring an
egress call to SharePoint at export time. The index is generated from data already in Postgres.
If a field is not already in Postgres, it is not in the export.

---

## Scale limits

- **Row cap:** hard cap at the same **5,000-tender ceiling the register CSV uses**
  (`TenderingPage.tsx:610`). If the register was truncated, the export is truncated the same
  way and `filterSummary.truncated` is true. Same `window.confirm` warning pattern.
- **Warning threshold:** at **100 tenders** the frontend shows an advisory confirm (this is a
  materially larger payload than a CSV — 28 collections × N tenders). OPEN — Marco: 100 vs 250?
- **Streaming vs in-memory:** stream tenders one at a time from the server as a JSON array
  using a chunked response. Each tender's relations are loaded in a single Prisma `findUnique`
  with a bounded `include` tree; do not build the whole payload in RAM. OPEN — Marco: confirm
  streaming; alternative is one query per tender with async iteration.
- **Filename:** mirror the register CSV.
  `IS_TenderFullExport_${YYYY-MM-DD}${truncated ? '_${N}of${total}' : ''}.json`.
- **Content-Type:** `application/json; charset=utf-8`, `Content-Disposition: attachment`.

---

## Redaction

Super-user default is **"sees everything on this tenant"**, with three explicit exceptions:

1. **Cross-tenant reachable rows** — a shared relation (e.g. a shared `Site` referenced from
   another tenant's tender) must be filtered to the exporting tenant's `tenantId`. **No
   cross-tenant data may leak, even to a super user.** This is a security boundary, not a
   preference.
2. **Soft-deleted rows** — INCLUDE, with a `deletedAt` field visible. A super-user audit
   export that hides deletions is misleading. OPEN — Marco: confirm include-with-flag.
3. **User PII on `estimator` / `assignedEstimator` / note authors** — emit `{ id, displayName }`
   only. Do not emit email, phone, or other User columns. Displayname is already visible on
   every Tender surface, so this is not new disclosure.

Everything else (internal notes, prices, margins, incident narratives, exclusion wording) is
IN by design — this is a super-user audit snapshot.

---

## Slice breakdown

Every slice below is `size ≤ 10` files including tests. Each slice's chain gate is a
**content needle** the predecessor introduces — `requires_on_main: <path> :: <needle>` — not a
bare file check against a file that already exists on main. That anti-pattern is live in the
queue (`pr-ew-s2-alloc-engine-HOLD.md` uses `requires_on_main: apps/api/prisma/schema.prisma
:: model EstimatorCapacity`, but `model EstimatorCapacity` is already on main, so the gate is
satisfied before the predecessor lands and the slice dispatches alongside its own dependency).
The gates below name symbols that **do not exist on main today** and are introduced by the
named predecessor.

### SLICE 1 — Envelope + super-user-guarded endpoint (scalars only)

Files (≈7):
- `apps/api/src/modules/tendering/tender-export.service.ts` — introduces
  `export function buildTenderFullExport(...)`, envelope v1, scalar fields only.
- `apps/api/src/modules/tendering/tender-export.controller.ts` — `@Get("full-export")`
  guarded by `SuperUserGuard`, filter query params matching register filters.
- `apps/api/src/modules/tendering/tendering.module.ts` — wire.
- `apps/api/src/modules/tendering/__tests__/tender-export.service.spec.ts`.
- `apps/api/src/modules/tendering/__tests__/tender-export.controller.spec.ts` — including
  a 403 test for a non-super-user caller (the whole point of D52).
- Types file for the envelope.
- No web changes yet.

Premise: `! grep -q "buildTenderFullExport" apps/api/src/modules/tendering/*.ts`
Done-when: unit + e2e green; 403 for non-super-user asserted.
Gate: none (this is the first slice).

### SLICE 2 — 1:1 dependents (estimate, scopeHeader, tandC, rateSet, opportunity-ref, jobConversion, sourceJob-ref)

Adds `relations.estimate`, `.scopeHeader`, `.tandC`, `.rateSet`, `.opportunity`,
`.jobConversion`, `.sourceJob` to the envelope. ~6 files.
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: buildTenderFullExport`

### SLICE 3 — Notes surfaces (tenderNotes, clarifications+clarificationNotes folded, follow-ups)

Adds `.tenderNotes`, `.clarifications` (with `notes` nested), `.followUps`.
Handles the retirement decision on `clientNotes` per §⚠ (default: exclude).
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.estimate`

### SLICE 4 — Scope surfaces (scopeRevisions, scopeItems, scopeCards, entries, cuttingSheetItems)

`scopeViewConfigs` is OUT per manifest row 28.
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.tenderNotes`

### SLICE 5 — ClientQuotes + seven children

Dedicated slice — ClientQuote fan-out (§ClientQuote fan-out) is the largest single unit.
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.scopeRevisions`

### SLICE 6 — Snapshots & outcomes (pricingSnapshots, outcomes, sorSnapshots, withdrawalReviews, estimateExports)

Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.clientQuotes`

### SLICE 7 — Assumptions / exclusions / packages / waste

`tenderClients` folded in here too.
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.pricingSnapshots`

### SLICE 8 — Safety (safetyIncidents, hazardObservations) + downstream refs (projects, handovers)

Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.assumptions`

### SLICE 9 — Correspondence (threads + messages)

Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.safetyIncidents`

### SLICE 10 — Document INDEX

Per §Document index contract — names/categories/links/metadata only. Never bytes.
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.correspondences`

### SLICE 11 — Frontend wire-up on TenderingPage

Adds the "Export full JSON" action next to `exportRegisterCsv` at
`apps/web/src/pages/tendering/TenderingPage.tsx:601-631`. Gated in the UI on super-user (hide,
not disable, per existing pattern). Reuses the truncation confirm and filename convention.
Chain gate: `requires_on_main: apps/api/src/modules/tendering/tender-export.service.ts :: relations.documents`

### SLICE 12 — (deferred) Renderer

Out of scope until Slice 11 lands and Marco confirms the snapshot shape.

---

## Open items — Marco decides before SLICE 1 dispatches

1. **`clientNotes` retirement dependency** — (a) exclude now vs (b) include-then-remove. Default: (a).
2. **`scopeViewConfigs`** — confirm OUT (per-user preference).
3. **Warn threshold** — 100 vs 250 tenders before the frontend confirms.
4. **Streaming vs in-memory** — confirm chunked JSON stream.
5. **Soft-deleted rows** — confirm include-with-`deletedAt`-flag.

---

## Do-NOT list carried into every downstream slice

- No code touches `/sot/` or `schema.prisma`.
- No single-tender export path (D53).
- No new permission code (D52 — reuse `SuperUserGuard`).
- No file bytes in the document index.
- No description of the feature as a backup or safety net anywhere in code, tests, PR bodies,
  or UI copy.
