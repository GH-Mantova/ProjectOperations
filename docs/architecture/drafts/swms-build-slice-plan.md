# Interactive SWMS — Split-build slice plan (SLICE 0, plan only)

**Status.** Ordered build plan. No schema, no code, no seed touched by this slice.
Later slices will be armed one at a time under the size-10 cap.

---

## 1. Decision header

- **Split confirmed by Marco 2026-07-17: two independently-shippable tracks.**
  - **Track A — static SWMS wizard.** Ships without Track B. Consumes the control ↔ trigger
    mapping as *seeded* data.
  - **Track B — control-mapping tool.** Lets Compliance authors edit the mapping after Track A
    is live. Depends on Track A's data model; does not block Track A.
- **Module-home default (flag for Marco).** This plan assumes the SWMS wizard is a
  **standalone SWMS module surfaced under the Compliance area** (Compliance landing → "SWMS"
  card → SWMS module has its own list, wizard, mapping tool). Rationale: SWMS is a large,
  self-contained workflow (author → publish → worker acknowledgement) that will outgrow the
  existing Compliance dashboard; treating it as its own module keeps the Compliance page focused
  on the expiries dashboard. **Flag:** confirm before Track-A Slice A7 is armed — the alternative
  is to fold everything as new tabs *inside* `CompliancePage.tsx`, which is cheaper up front but
  worse for the render/acknowledge flow.
- **CP-24.** This plan lives under `docs/architecture/drafts/`. No `sot/` files touched.
- **Data-model regen rule.** Every slice that mutates `apps/api/prisma/schema.prisma` MUST run
  `node scripts/data-model/build-relationship-map.mjs` locally and pass the pre-commit
  `--check`. **The generated `docs/data-model/relationship-map.{md,json}` and
  `docs/data-model/metadata-catalog.json` are gitignored — do not commit them.** The slice
  declares `gate_allow: migrations`.

---

## 2. Source inventory (from the prototype, not guessed)

Prototype: `C:\ProjectOperations-Reference\Interactive SWMS\`. Zero SWMS artifacts on `main` today
(the only hits for "SWMS" are reference docs and PR prompts, no schema/UI).

| Artifact | Location | What it holds |
|---|---|---|
| `swms-rev5-model.json` / `.js` | prototype root | Full Rev 5 template model — 7 sections, 102 merged controls, 410 control rows |
| `rev5-sections.js` | prototype root | Ordered section headers (1 Emergency & Rescue → 7 Soil/Excavation) |
| `control-library.js` / `.json` | prototype root | The 31 SOP-SWMS Part-B controls (angle grinder, jackhammer, LPG, MEWP, manual handling, …) |
| `control-triggers.js` | prototype root | Control ↔ trigger map. Trigger vocab is 4 categories: **Activities (HRCW)** (15), **Activity description** (6), **Plant** (7), **Tools & equipment** (17). ~49 rows default to `ALWAYS`; Sections 1–2 default `ALWAYS`; Sections 3–7 fire only on trigger overlap. |
| `08.SoPs/*.docx` | prototype `08.SoPs/` | 31 SOP-SWMS source docs (verified: `ls \| wc -l` = 31) |
| `07. SWMS/*.jpg` | prototype `07. SWMS/` | Rev 5 template page scans (reference only) |
| `SWMS-Office-Wizard.html` | prototype root | Static prototype of the 8-step office authoring wizard |
| `SWMS-Control-Mapping.html` | prototype root | Static prototype of the control-mapping editor |
| `SWMS-PR-prompts.md` | prototype root | Earlier "static HTML under `public/`" staging plan — **superseded** by this plan (we go straight to React + DB, not another static drop) |

Data shape the prototype models (informal, before A1 formalises it):
- `Section { id, order, title }` × 7
- `Control { id, sectionId, order, headingLabel, subLabel }` × 102
- `ControlRow { id, controlId, order, hazard, riskBefore, controls, riskAfter, ppe }` × 410
- `Trigger { id (e.g. "act:asbestos"), category, label }` × 45
- `ControlTriggerLink { controlId, triggerId | ALWAYS }` — the mapping Track B edits
- `Sop { id, title, docRef }` × 31

---

## 3. Track A — static SWMS wizard (ordered slices)

Track A ships end-to-end with the mapping **read-only** (seeded). Slices are strictly ordered
because A2–A11 all depend on A1's tables and A2's seeded ids.

### A1 — Data model: SWMS template catalog tables

- **Files (≈6):** `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/<ts>_swms_template_catalog/migration.sql`, plus generated Prisma client (not committed).
- **Adds:** `SwmsTemplate`, `SwmsTemplateSection`, `SwmsTemplateControl`, `SwmsTemplateControlRow`. Natural keys: `template.code`, `section.number`, `control.code`, `row.code` — never rely on autoincrement for seed idempotency.
- **Not in this slice:** triggers, SOP catalog, document instances, any UI or API.
- `size: 3` · `gate_allow: migrations` · `seed_only: false` · `escalates: false`

### A2 — Seed the Rev 5 backbone (7 sections + 102 controls + 410 rows)

- **Files (≈5):** `apps/api/prisma/seed-swms-rev5.ts` (new), `apps/api/prisma/data/swms-rev5-template.json` (extracted from prototype `swms-rev5-model.json`), `apps/api/prisma/seed.ts` (register new step), `apps/api/prisma/seed-reference.ts` (register), plus a small spec asserting counts (7/102/410).
- **Rules:** upsert on natural keys; run twice must be a no-op; extractor script kept beside the JSON so we can re-derive from a future Rev 6.
- `size: 3` · `gate_allow: seed` · `seed_only: true` · `escalates: false` (reference data, not prod rows)

### A3 — Data model + seed: trigger vocabulary and SOP-SWMS catalog

- **Files (≈8):** `apps/api/prisma/schema.prisma` (add `SwmsTriggerCategory`, `SwmsTrigger`, `SopSwms`), migration, `apps/api/prisma/seed-swms-triggers.ts`, `apps/api/prisma/seed-sop-swms.ts`, two JSON data files, `seed.ts` wiring.
- **Vocab is data, not enums** — Marco will add HRCW categories/triggers over time; must be editable without a migration.
- `size: 4` · `gate_allow: migrations, seed` · `seed_only: true` · `escalates: false`

### A4 — Data model: SWMS document instance

- **Files (≈5):** `apps/api/prisma/schema.prisma` (add `SwmsDocument`, `SwmsDocumentActivityTrigger`, `SwmsDocumentControlSelection`, `SwmsDocumentSopAttachment`, `SwmsDocumentRevision`), migration.
- Document instance carries: project ref, chosen triggers (activity/plant/tools), per-control include/exclude override, SOP attachments, revision history.
- `size: 3` · `gate_allow: migrations` · `seed_only: false` · `escalates: false`

### A5 — API: template + catalog read endpoints

- **Files (≈7):** `apps/api/src/modules/swms/swms-template.controller.ts`, `.service.ts`, `.module.ts`, DTOs, spec, `AppModule` registration.
- Endpoints: `GET /swms/templates`, `GET /swms/templates/:code` (with sections + controls + rows), `GET /swms/triggers`, `GET /swms/sops`.
- Trigger-resolver helper lives here as a pure function: `(selectedTriggerIds) => Set<controlCode>` using the seeded mapping (ALWAYS ∪ overlap).
- `size: 4` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### A6 — API: SWMS document CRUD

- **Files (≈9):** `swms-document.controller.ts`, `.service.ts`, DTOs, permission guards, spec, module wiring.
- Endpoints: create draft, patch triggers/overrides, publish revision, list by project, get for worker view.
- Uses A5's resolver server-side so client + server agree on the applicable control set.
- `size: 5` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### A7 — Web: SWMS module shell + wizard steps 1–2

- **Depends on the module-home decision.** Assumes standalone module under Compliance.
- **Files (≈9):** `apps/web/src/pages/compliance/swms/SwmsModulePage.tsx` (landing), `SwmsListPage.tsx`, `SwmsWizardPage.tsx` (shell), `steps/StepProjectMeta.tsx`, `steps/StepTriggers.tsx`, `swmsClient.ts`, `swmsStore.ts` (Zustand), route registration in `App.tsx`, nav entry in `ShellLayout.tsx`.
- Steps 1–2: project metadata (name, address, principal contractor, revision), then trigger selection (HRCW activities + activity description + plant + tools).
- `size: 5` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### A8 — Web: wizard steps for Sections 1–4 (control selection)

- **Files (≈6):** `steps/StepSection1Emergency.tsx`, `StepSection2GeneralWork.tsx`, `StepSection3PoweredTools.tsx`, `StepSection4MobilePlant.tsx`, shared `ControlRowList.tsx`, `useApplicableControls.ts` (client-side resolver mirror of A5).
- Default-checked rows come from the resolver; user can uncheck (recorded as override).
- `size: 4` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### A9 — Web: wizard steps for Sections 5–7 (asbestos, friable, soil)

- **Files (≈5):** `StepSection5BondedAsbestos.tsx`, `StepSection6FriableAsbestos.tsx`, `StepSection7Soil.tsx`, plus a small "SOP-SWMS attach" panel driven by tool/plant triggers.
- **Risk flag (see §5):** Section 7 (soil) — the prototype's Rev 5 view vs Rev 4 has a known open question. This slice ships the Rev 5 rows as seeded and adds a TODO issue.
- `size: 4` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### A10 — Web: preview + export

- **Files (≈7):** `SwmsPreviewPage.tsx` (PDF-template layout, React print CSS), `SwmsWorkerViewPage.tsx` (mobile ack view), a print-only stylesheet, `swms-export.service.ts` on the API side for server-rendered PDF (optional — client-side print may suffice initially).
- **Decision knob** inside the slice: pick server-side PDF (Puppeteer) vs browser print, based on file-count budget. Default: browser print for slice A10; server PDF becomes a follow-up if needed.
- `size: 5` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### A11 — Web: SWMS list + landing polish + acknowledgement

- **Files (≈7):** Landing card copy, list filters (draft/published/superseded), "Acknowledge" flow on worker view, API endpoint for ack, permission wiring.
- `size: 4` · `gate_allow: none` · `seed_only: false` · `escalates: false`

**Track A total:** 11 slices. Track A is shippable at every slice boundary (A5 gives a read-only catalog API; A7 gives a working draft; A11 closes the loop).

---

## 4. Track B — control-mapping tool (ordered slices)

Track B **cannot start until A3 has merged** (needs `SwmsTemplateControl` + `SwmsTrigger` tables).
It can otherwise proceed in parallel to A4+.

### B1 — Data model: control ↔ trigger link table

- **Files (≈4):** `apps/api/prisma/schema.prisma` (add `SwmsControlTriggerLink` with an `always: boolean` column and a nullable `triggerId` FK), migration.
- Replaces the seeded map from A3's `control-triggers` JSON with an editable table; A3's seed becomes the initial-population step for this table.
- `size: 2` · `gate_allow: migrations` · `seed_only: false` · `escalates: false`

### B2 — Seed: populate the 410-row mapping (49 ALWAYS + trigger overlaps)

- **Files (≈4):** `apps/api/prisma/seed-swms-control-triggers.ts` (upsert from JSON), `apps/api/prisma/data/swms-control-triggers.json` (extracted from prototype `control-triggers.js`), `seed.ts` wiring, spec asserting row counts.
- **Idempotency:** upsert on `(controlCode, triggerId | 'ALWAYS')`; re-runs must not duplicate.
- `size: 2` · `gate_allow: seed` · `seed_only: true` · `escalates: false`

### B3 — API: mapping read/write endpoints

- **Files (≈7):** `swms-mapping.controller.ts`, `.service.ts`, DTOs, permission guard (`compliance:swms:map`), spec, module wiring.
- Endpoints: list mapping (grouped by control), toggle ALWAYS, add/remove trigger link, bulk import (for future Rev 6).
- A5's trigger resolver now reads from this table (via a small refactor inside A5's service — declared here so the slice is honest).
- `size: 4` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### B4 — Web: mapping editor UI

- **Files (≈6):** `SwmsMappingPage.tsx` (controls-as-rows × triggers-as-columns matrix), inline toggle cells, per-control ALWAYS switch, save-per-row (optimistic UI), route + nav entry (admin-only).
- Route: `/compliance/swms/mapping` (module-home decision applies).
- `size: 4` · `gate_allow: none` · `seed_only: false` · `escalates: false`

### B5 — Web + API: export mapping snapshot and wizard-alignment test

- **Files (≈5):** `swms-mapping-export.service.ts` (dump current table to JSON for audit), CLI script `scripts/swms/export-mapping.mjs`, an e2e test that drives the wizard against the live mapping table and asserts the applicable-control set matches the resolver.
- `size: 3` · `gate_allow: none` · `seed_only: false` · `escalates: false`

**Track B total:** 5 slices. Track B is shippable at B4 (Compliance authors can edit the map);
B5 is polish + regression guard.

---

## 5. Sequencing, risks, dependencies

**Hard order.** Within a track, slices are strictly sequential. Across tracks:

```
A1 ─ A2 ─ A3 ─ A4 ─ A5 ─ A6 ─ A7 ─ A8 ─ A9 ─ A10 ─ A11
              │
              └─────► B1 ─ B2 ─ B3 ─ B4 ─ B5
```

- **A1 → A2 → A3** must land before **B1** (B1 needs `SwmsTemplateControl` + `SwmsTrigger`).
- **B3** requires a small refactor inside A5's resolver to read from the mapping table. If B3 is
  in flight while A5 is being edited, coordinate on the branch — otherwise treat A5 → B3 as
  strictly sequential to avoid conflict.
- **Data-model slices (A1, A3, A4, B1)** each: run `node scripts/data-model/build-relationship-map.mjs`
  locally, ensure `--check` passes in pre-commit, **do not commit** the generated files (they are
  gitignored — the SoT is the schema).

**Risks flagged for Marco (all cheap to resolve before the affected slice arms):**

1. **Module-home question** — flagged in §1. Default: standalone SWMS module under Compliance.
   Alternative: tabs inside existing `CompliancePage.tsx`. Decide before A7 arms.
2. **Section 7 (soil) — Rev 5 vs Rev 4 divergence.** Prototype notes list this as an open item.
   A9 ships whatever the seed says; open a follow-up issue at A2 time to reconcile.
3. **Seed idempotency of the 410 mapping rows.** B2 must upsert on `(controlCode, triggerId | ALWAYS)`;
   if the natural key isn't stable across Rev revisions, B2 becomes an escalates-worthy prod-data
   slice. Verify at B2 arm time — if the answer is "no", flag B2 as `escalates: true` and route
   through Marco.
4. **PDF export choice at A10.** Browser-print keeps A10 within budget; server-side Puppeteer
   pushes it over 10 files and needs its own slice. Decide at A10 arm time.
5. **Prototype static-HTML PRs (`SWMS-PR-prompts.md`) are superseded.** Do not run those; they
   would land un-wired static files under `apps/web/public/compliance/swms/` and then need to be
   ripped out when A7 arrives. Delete or archive that prompt file when A7 lands.

**Slices summary table.**

| Slice | Size | gate_allow | seed_only | escalates |
|---|---|---|---|---|
| A1 SWMS template tables | 3 | migrations | false | false |
| A2 Seed Rev 5 backbone | 3 | seed | true | false |
| A3 Triggers + SOP catalog | 4 | migrations, seed | true | false |
| A4 Document instance tables | 3 | migrations | false | false |
| A5 Template + catalog API | 4 | none | false | false |
| A6 Document CRUD API | 5 | none | false | false |
| A7 Wizard shell + steps 1–2 | 5 | none | false | false |
| A8 Wizard sections 1–4 | 4 | none | false | false |
| A9 Wizard sections 5–7 | 4 | none | false | false |
| A10 Preview + export | 5 | none | false | false |
| A11 List + ack | 4 | none | false | false |
| B1 Mapping link table | 2 | migrations | false | false |
| B2 Seed 410 mapping rows | 2 | seed | true | false (verify at arm — see risk 3) |
| B3 Mapping API | 4 | none | false | false |
| B4 Mapping editor UI | 4 | none | false | false |
| B5 Export + alignment test | 3 | none | false | false |

Every slice above stays inside the size-10 cap and is independently reviewable.
