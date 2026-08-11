# CRM — collapse Lead + Opportunity into one entity; reshape triage surface

**Status:** approved 2026-08-12 (Marco); every audit finding below was re-verified against
origin/main HEAD on 2026-08-12 before this plan was written.
**Owner:** Marco / ProjectOperations desktop-shell.
**Rule:** every code slice chains behind this document (`requires_file_on_main`). Slices ship
independently, each ≤ 10 files, each CI-green.

Nothing here changes the underlying Tender conversion flow unless a slice says so explicitly.
The `generateDraftTender` path (`crm.service.ts:272`) is preserved unbroken through every slice.

---

## 1. Motivation and what this plan replaces

Verified state on origin/main HEAD 2026-08-12 (evidence pinned to files/lines):

1. **Two parallel entity types for one business concept.**
   `apps/api/prisma/schema.prisma:6345` — `model Lead` (fields: title, status `LeadStatus`,
   source `OpportunitySource`, companyName, contactName, contactEmail, contactPhone, clientId,
   contactId, ownerId, notes, nextActionAt, nextActionNote, convertedOpportunityId).
   `apps/api/prisma/schema.prisma:6384` — `model Opportunity` (fields: title, description,
   stage `OpportunityStage`, probability, estimatedValue, source `OpportunitySource`, clientId,
   contactId, ownerId, expectedCloseDate, nextActionAt, nextActionNote, wonAt, lostAt,
   lostReason, sourceLead, convertedTenderId, convertedTender).
   A "lead" and an "opportunity" are the same object at different lifecycle stages in this
   domain. Keeping two tables forces a conversion event (`POST /crm/leads/:id/convert`) that
   splits a single business record across two rows.

2. **`LeadStatus` and `OpportunityStage` overlap.**
   `apps/api/prisma/schema.prisma:6320-6334`:
   `LeadStatus` = new | contacted | qualified | disqualified | converted.
   `OpportunityStage` = new | qualified | quoting | won | lost.
   "new" and "qualified" appear in both. The UI has no safe concept of which stage a record
   is in without knowing which table it came from.

3. **Kanban surface conflates two-stage pipelines in one view.**
   `apps/web/src/pages/crm/CrmBoardPage.tsx:61` — `const STAGES` drives a kanban with all
   `OpportunityStage` values (new / qualified / quoting / won / lost). Lead records surface
   separately via `showLead` (line 117) / `showCreate` (line 107) modals. The dual-modal
   pattern confuses the intake flow: a user creating a "lead" and a user creating an
   "opportunity" are trying to do the same thing.

4. **Free-text `lostReason` is not governed.**
   `apps/api/prisma/schema.prisma:6409` — `lostReason String?`. No managed list, no
   aggregation, no drop-down. Analytics on "why we don't pursue" is impossible without
   normalisation.

5. **CRM tab label does not match the surface.**
   `apps/web/src/pages/tendering/TenderingPage.tsx:895` — `{ key: "crm", label: "CRM" }`.
   The surface shows leads and opportunities; "CRM" is a system-architecture term, not a
   label users recognise.

6. **API has separate Lead and Opportunity CRUD routes.**
   `apps/api/src/modules/crm/crm.controller.ts:165-304`:
   `GET/POST /crm/leads`, `PATCH /crm/leads/:id`, `POST /crm/leads/:id/convert`,
   `POST /crm/leads/:id/generate-draft-tender`,
   `GET/POST /crm/opportunities`, `PATCH /crm/opportunities/:id`,
   `POST /crm/opportunities/:id/convert-to-tender`.
   After unification the leads routes become aliases or are removed; a single entity CRUD
   replaces both.

7. **`generateDraftTender` and spec.**
   `apps/api/src/modules/crm/crm.service.ts:272` — `async generateDraftTender(...)`.
   `apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts:39-178`.
   This is the marquee conversion action (Lead/Opportunity → Tender Draft). The spec must be
   updated to reflect any field renames on the consuming service mock.

---

## 2. Decisions baked in — DO NOT re-open

1. **Unify onto the existing `Opportunity` table.** Fold all `Lead` rows into `Opportunity`.
   Retire the `Lead` model and `leads` table. The UI still says "lead" for open/not-pursued
   records.
2. **Drop-reasons = admin-editable managed list (`DropReason` lookup table), seeded:**
   "Price / budget", "Didn't know we offer it", "Timing / capacity", "Out of service area",
   "Went cold", "Other". Free-text detail per drop. Replaces free-text `lostReason`.
3. **Tab label "Leads & opportunities"; URL `?tab=crm` → `?tab=leads-opportunities`**, with
   the old param redirecting. The `crm.view` permission gate is preserved under the new key.
4. **Leads surface = open → priced (→ Tender Draft) or not-pursued (reason).**
   No qualified / quoting / won stages on the Leads surface — pricing lives in Tenders tab.
   Stage mapping on migrate: `new|contacted|qualified|quoting` → `open`; `won` → keep
   `convertedTenderId` FK, archive; `lost|disqualified` → `not_pursued`, carry `lostReason`
   text into `dropReasonDetail`.

---

## 3. Ground truth (exact lines on origin/main 2026-08-12)

| Artifact | Location | Key lines |
|---|---|---|
| `model Lead` | `apps/api/prisma/schema.prisma` | L6345–6382 |
| `model Opportunity` | `apps/api/prisma/schema.prisma` | L6384–6428 |
| `enum OpportunityStage` | `apps/api/prisma/schema.prisma` | L6328–6334 |
| `enum OpportunitySource` | `apps/api/prisma/schema.prisma` | L6336–6343 |
| `enum LeadStatus` | `apps/api/prisma/schema.prisma` | L6320–6326 |
| `lostReason` field | `apps/api/prisma/schema.prisma` | L6409 |
| `sourceLead` / `convertedTender` fields | `apps/api/prisma/schema.prisma` | L6412, L6416–6417 |
| `CrmService.generateDraftTender` | `apps/api/src/modules/crm/crm.service.ts` | L272 |
| `CrmController` routes | `apps/api/src/modules/crm/crm.controller.ts` | L160–304 |
| `generateDraftTender` spec | `apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts` | L39–178 |
| `CrmBoardPage` — STAGES const | `apps/web/src/pages/crm/CrmBoardPage.tsx` | L61 |
| `CrmBoardPage` — showLead/showCreate | `apps/web/src/pages/crm/CrmBoardPage.tsx` | L107, L117 |
| `CrmBoardPage` — forecast | `apps/web/src/pages/crm/CrmBoardPage.tsx` | L100, L141, L341–361 |
| `OpportunityDetailPage` | `apps/web/src/pages/crm/OpportunityDetailPage.tsx` | L1–426 |
| `TenderingPage` tab key "crm" | `apps/web/src/pages/tendering/TenderingPage.tsx` | L895 |
| `TenderingPage` `crm.view` gate | `apps/web/src/pages/tendering/TenderingPage.tsx` | L308–313 |

---

## 4. Non-goals

- No change to the Tender CRUD, Tender status flow, or `generateDraftTender` business logic.
- No new API keys, permissions (reuse `crm.view`), or Azure/Entra/SharePoint touches.
- No re-skin of `OpportunityDetailPage` beyond what the entity unification requires.
- No change to `/sot/` documents (the sot-keeper reconcile is a separate future slice not
  planned here — file a follow-up when all code slices merge).
- No mobile/field-side navigation changes.

---

## 5. Slice list (ordered, independently shippable)

Each slice ≤ 10 files. Dependency edges expressed as `requires_file_on_main`. Every slice is
docs-and-code; no `/sot/` edits.

### SLICE 0 — this document (docs-only) `size:7`

- **Files:** `docs/plans/crm-leads-collapse-plan.md` (this file) + 6 slice prompts.
- **Gate:** `pnpm lint`.
- **Requires:** nothing.

### SLICE 1 — migration: fold Lead → Opportunity; add DropReason lookup `size:9`

**Dependency:** none (first in chain).

**What changes:**
- `apps/api/prisma/schema.prisma` — add `DropReason` model; add new `OpportunityStage`
  values (`open`, `not_pursued`, `archived`); add `dropReasonId`, `dropReasonDetail`,
  `isLead` bool to `Opportunity`; remove `Lead` model; remove `LeadStatus` enum.
- `apps/api/prisma/migrations/**` — ONE additive migration that: (a) creates `drop_reasons`
  table; (b) adds new columns to `opportunities`; (c) `UPDATE opportunities SET stage='open'
  WHERE stage IN ('new','qualified','quoting')`, `stage='not_pursued' WHERE stage='lost'`,
  `stage='archived' WHERE stage='won'`, sets `is_lead=true` for rows whose id appeared in
  `leads.converted_opportunity_id`; (d) copies `leads` rows into `opportunities`; (e) drops
  `leads` table. Preserve every `converted_tender_id` FK.
- `apps/api/prisma/seeds/**` — seed `DropReason` defaults.
- `apps/api/src/modules/crm/crm.service.ts` — update Prisma calls to reference unified model.
- `apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts` — update
  mock expectations to match new field shape.
- `docs/data-model/**` — regenerated map (required by CI drift check).

**Rollback:** The Lead→Opportunity migration is destructive (drops `leads` table). Run a
DB backup before applying. If aborted mid-flight, the migration file records the full SQL;
re-run or roll back using the Prisma migration history (`prisma migrate resolve --rolled-back`).
New columns on `opportunities` are nullable; safe to leave on main without the code landing,
but the dropped `leads` table is not recoverable without restore. **Do a full DB backup
immediately before running this slice.**

**GATE-ALLOW:** migrations.

**Files count:** 8 (schema, 1 migration, 1 seed, service, spec, 3 data-model generated files).

**Verify:** `pnpm build && pnpm lint && node scripts/data-model/build-relationship-map.mjs --check`

### SLICE 2 — reason-list API: CRUD for DropReason + seed defaults `size:7`

**Dependency:** `requires_file_on_main: apps/api/prisma/seeds/crm-drop-reasons.ts`
(created by S1).

**What changes:**
- `apps/api/src/modules/crm/crm.controller.ts` — add `GET/POST/PATCH/DELETE /crm/drop-reasons`.
- `apps/api/src/modules/crm/crm.service.ts` — add `listDropReasons`, `createDropReason`,
  `updateDropReason`, `deleteDropReason` (guard: cannot delete if any Opportunity references it).
- `apps/api/src/modules/crm/dto/` — `CreateDropReasonDto`, `UpdateDropReasonDto`.
- `apps/api/src/modules/crm/__tests__/crm.service.drop-reason.spec.ts` — unit tests.

**Rollback:** purely additive API routes; revert the service/controller additions and redeploy.

**Files count:** 6 (controller, service, 2 DTOs, spec, possibly crm.module.ts if import update needed).

**Verify:** `pnpm build && pnpm lint && grep -rq "listDropReasons" apps/api/src/modules/crm`

### SLICE 3 — unified API: single-entity CRUD; "Price it" + "Don't pursue" actions `size:10`

**Dependency:** `requires_file_on_main: apps/api/src/modules/crm/dto/create-drop-reason.dto.ts`
(created by S2).

**What changes:**
- `apps/api/src/modules/crm/crm.controller.ts` — collapse lead routes into unified
  `/crm/entries` (or retain `/crm/opportunities` and redirect `/crm/leads` aliases); wire
  "Price it" → `generateDraftTender`; add `POST /crm/entries/:id/dont-pursue` writing
  `{dropReasonId, dropReasonDetail}`.
- `apps/api/src/modules/crm/crm.service.ts` — `createEntry`, `updateEntry`,
  `dontPursue(id, reasonId, detail)`.
- `apps/api/src/modules/crm/dto/` — `CreateEntryDto`, `UpdateEntryDto`, `DontPursueDto`.
- `apps/api/src/modules/crm/__tests__/crm.service.unified.spec.ts` — unit tests.
- `apps/api/src/modules/crm/__tests__/crm.service.generate-draft-tender.spec.ts` — keep
  passing (may need field updates).

**Rollback:** revert service/controller additions; the DB shape from S1 remains safe.

**Verify:** `pnpm build && pnpm lint && grep -rq "dontPursue" apps/api/src/modules/crm`

### SLICE 4 — web triage: replace kanban with triage list; merged modal; reason modal `size:10`

**Dependency:** `requires_file_on_main: apps/api/src/modules/crm/dto/dont-pursue.dto.ts`
(created by S3).

**What changes:**
- `apps/web/src/pages/crm/CrmBoardPage.tsx` — replace kanban with triage list (open
  records: "Price it" CTA → calls `generateDraftTender`; "Don't pursue" CTA → opens reason
  modal); merge `showLead`/`showCreate` into a single "+ Add new" modal; add
  "Why we don't pursue" roll-up (grouped count by reason).
- `apps/web/src/pages/crm/DontPursueModal.tsx` (new) — reason picker from managed list +
  free-text detail field.
- `apps/web/src/pages/crm/LeadsTriageList.tsx` (new) — list component.
- `apps/web/src/pages/crm/OpportunityDetailPage.tsx` — surface `dropReasonId` / detail if
  `stage === 'not_pursued'`.
- `apps/web/src/pages/crm/crm-api.ts` (new or existing) — typed fetch helpers for unified
  API (`listEntries`, `createEntry`, `dontPursue`, `priceIt`).

**Rollback:** revert the web files; backend remains stable (S3 routes still work, just not
called from the new UI).

**Verify:** `pnpm build && pnpm lint && grep -rq "DontPursueModal" apps/web/src`

### SLICE 5 — rename + route: tab label, URL, redirect, gate preserved `size:5`

**Dependency:** `requires_file_on_main: apps/web/src/pages/crm/DontPursueModal.tsx`
(created by S4).

**What changes:**
- `apps/web/src/pages/tendering/TenderingPage.tsx` — change tab key from `"crm"` to
  `"leads-opportunities"` and label to `"Leads & opportunities"`; add `?tab=crm` →
  `?tab=leads-opportunities` redirect; preserve `crm.view` gate on `canViewCrm` (line 311).
- `apps/web/src/pages/crm/CrmBoardPage.tsx` — update any internal references to the tab key.
- `tests/e2e/pr-acceptance/` — update any assertion that matches the `"CRM"` tab label or
  `?tab=crm` URL string.

**Rollback:** revert the tab key/label change; the `?tab=crm` redirect ensures old bookmarks
keep working even if the new key is reverted.

**Verify:** `pnpm build && pnpm lint && grep -q "leads-opportunities" apps/web/src/pages/tendering/TenderingPage.tsx`

### SLICE 6 — reason-admin settings: admin screen for DropReason list `size:6`

**Dependency:** `requires_file_on_main: apps/web/src/pages/crm/DontPursueModal.tsx`
(created by S4; confirms the reason list is live and used before adding admin UI).

**What changes:**
- `apps/web/src/pages/crm/DropReasonAdminPage.tsx` (new) — CRUD list for `DropReason`
  (label + active flag); reuses the `/crm/drop-reasons` API from S2.
- `apps/web/src/App.tsx` — register route `/settings/crm/drop-reasons` → `DropReasonAdminPage`
  (gated `crm.manage` or equivalent admin permission; check registry before inventing a new code).
- `apps/web/src/components/SettingsShell.tsx` — add "CRM drop reasons" nav entry under
  Company or Administration (Marco to choose at merge time; default: Administration).
- `apps/web/src/pages/crm/__tests__/DropReasonAdminPage.test.ts` (new) — unit test for
  list/add/edit/disable flows.

**Rollback:** revert the new page + route registration; no DB change.

**Verify:** `pnpm build && pnpm lint && grep -rq "DropReasonAdminPage" apps/web/src`

---

## 6. Sequencing diagram

```
S1 (migration) ──► S2 (reason-list API) ──► S3 (unified API) ──► S4 (web triage)
                                                                        │
                                                                        ├──► S5 (rename + route)
                                                                        └──► S6 (reason-admin)
```

S5 and S6 can ship concurrently after S4 merges.

---

## 7. Risks

### 7.1 S1 migration is destructive — `leads` table is dropped

The migration deletes the `leads` table. A full database backup MUST be taken immediately
before applying S1 on any environment. The prompt body requires the agent to declare this.
If S1 aborts mid-migration, use `prisma migrate resolve --rolled-back` to reset migration
state, then restore from backup.

### 7.2 `convertedTenderId` FK must survive

Every `Opportunity` row whose `convertedTenderId` is non-null represents a "won" deal
linked to a Tender. The migration must not nullify these. Verified: `convertedTender` uses
`onDelete: SetNull` on the Tender side (schema.prisma:L6417), meaning the FK is cleared
only when the Tender is deleted. The migration must not touch that column.

### 7.3 `generateDraftTender` spec will break if mock shape changes

`crm.service.generate-draft-tender.spec.ts` mocks Prisma `create`/`update` calls with
`toHaveBeenCalledWith(...)`. Adding `isLead`, `dropReasonId` etc. to the model will cause
those assertions to fail unless S1 includes spec updates. The S1 prompt explicitly requires
this.

### 7.4 `OpportunityStage` enum extension breaks existing callers

Any TypeScript or runtime code that switches exhaustively on `OpportunityStage` will need
an update when `open`, `not_pursued`, `archived` are added. The S3 prompt must grep for
exhaustive-switch patterns and update them.

### 7.5 e2e specs asserting kanban columns

Any e2e spec asserting the kanban column structure (STAGES array) will fail after S4.
The S4 prompt must search and update these.

### 7.6 `crm.view` gate URL change (S5)

Changing `?tab=crm` to `?tab=leads-opportunities` will break any hardcoded link (emails,
bookmarks, external integrations). The redirect added in S5 covers browser bookmarks; any
server-rendered link generation must be found and updated.

---

## 8. Verification of this document

- [x] `test -f docs/plans/crm-leads-collapse-plan.md`
- [x] Every entity/field cited in §3 is pinned to a file:line verified on origin/main 2026-08-12.
- [x] `ls docs/pr-prompts | grep -q "pr-crm-leads-s1"`
- [ ] `pnpm lint` (run at PR-open time).
