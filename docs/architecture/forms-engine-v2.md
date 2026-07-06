# Forms Engine v2 — Design Document

> **Companion mockups (UX contract):** `docs/architecture/mockups/form-builder-mockup.html`
> and `docs/architecture/mockups/form-rules-builder-mockup.html` — versioned with
> this document. (Working copies also live at `docs/design/mockups/form-builder-mockup.html`
> and `docs/design/mockups/form-rules-builder-mockup.html`.)
>
> **Status:** Design / analysis only. This document changes no schema, service,
> migration, or route. It is the plan of record for the Forms program
> ("Forms Engine v2") — the builder, the field palette, the push-to-module
> engine, the rules engine, AI features, and output channels.
>
> **Status: all decisions locked 2026-07-03 — ready for doc PR.**
>
> **Decision date:** 2026-07-03 (Marco). All decisions in this document marked
> **LOCKED** were made by Marco on that date and are not reopened here. The
> section-10 open questions were answered the same evening — section 10 now
> records those decisions.
> **Scope owner:** WHS & Commercial Compliance.
>
> **Verified against:** the current local checkout of
> `apps/api/prisma/schema.prisma` (3,916 lines), the `forms` / `assets` /
> `maintenance` / `platform` / `email` / `pdf-rendering` / `personas` /
> `ai-providers` modules under `apps/api/src/modules/`, and
> `apps/web/src/pages/forms/`. All path:line citations below are from this tree.
>
> **Builds on, does not respec:** `docs/pr-prompts/pr-forms-authoring-v1-ready.md`
> (in flight) — authoring v1 delivers new/edit/duplicate/archive from the list
> page plus the missing template PATCH/archive/duplicate/delete endpoints. This
> document assumes that work lands first and starts from there.
>
> **Defers to:** `docs/architecture/job-project-consolidation.md` (B-P0a) and
> `docs/architecture/module-ownership-ia-map.md` (ownership rules). Nothing here
> re-decides Job/Project, Worker/WorkerProfile, or entity ownership.

---

## 1. Overview and the UX contract

### 1.1 What this program is

Today the platform can render and fill forms, run simple show/hide rules, and
create a handful of records when a form is submitted. What it cannot do is let
Marco *build* serious forms — the kind Initial Services runs its WHS and plant
operations on — without a developer. Forms Engine v2 closes that gap: a
drag-and-drop builder with construction-specific field types, a rules engine
that can warn, block, and alert based on both form answers and live system data
(asset readings, worker tickets, weather), a **push engine** that writes signed
form data back into the owning modules (the Plant Pre-Start hour reading landing
in Assets is the flagship case), AI assistance for importing and drafting forms,
and configurable output channels (SharePoint PDF, email, webhooks — Teams is
deferred as a documented future channel, section 10 Q1).

### 1.2 The UX contract (LOCKED)

Two approved mockups are **the contract** for what gets built. Where this
document and the mockups disagree, the mockups win:

- **`docs/design/mockups/form-builder-mockup.html`** — the builder. Key
  elements, all locked:
  - **Look:** "Cognito-clean skin, JotForm-deep engine" (title, L5; header L89).
    Light palette, white canvas, teal/orange brand tokens.
  - **New-form strip** (L92-97): four tiles — Start from scratch, **Import a
    form (AI)** (Word / PDF / Cognito export → draft template), **Describe it
    (AI)**, Duplicate a template (incl. the 7 system forms).
  - **Layout toggle** (L102): **Classic** and **Card** (one question at a
    time). Card is **automatic on phones/tablets** — the fill page switches to
    Card below the platform's 768px breakpoint — and the default is
    **overridable per form** in the builder (LOCKED, section 10 Q8).
  - **Palette** (L107-131) in three groups: *Site & WHS* (Photo, Signature,
    Worker, Asset, Location, Weather, Terms & acceptance), *Input* (Text, Long
    text, Number, Date/time, Dropdown, Choice, Multi, File, **Lookup — any
    system list**, **Calculation**, **Unique ID auto-number**), *Structure*
    (Section, Table, **Repeating section**, Divider, Page break).
  - **Push badges** on the canvas (`PUSHES → ASSETS`, L146; `CALCULATED`, L151)
    and the topbar chip `PUSHES DATA → ASSETS` (L101).
  - **Properties panel** on the right with per-type tabs — e.g. the hour-meter
    field shows General / Options / **Push** / Logic (L194), with the push card
    "Recorded as a new reading (full history kept), never an overwrite" (L196),
    the reject-below-last and meter-replaced-override toggles (L197-198), the
    apply-on-approval toggle (L199), and the usage-based servicing note
    ("every 500 h → reminder at 90% via notifications", L201).
  - **Output strip** at the form's foot (L179-185): ON SUBMIT → Assets, Teams
    channel, SharePoint PDF → job folder, Email, Webhook. (The Teams tile is
    the one mockup element deferred out of v1 — section 10 Q1.)
  - **Signature semantics** (L222-226): lock form after signing, capture signer
    + timestamp, "Push happens only after signature… No signature → no asset
    update."
- **`docs/design/mockups/form-rules-builder-mockup.html`** — the rules
  builder ("the Logic tab, full screen"). Ten worked example rules (L54-225)
  covering the full grammar, an **AI rule-drafting bar** at the top (L52), and
  the grammar summary legend (L229-234). Section 5 of this document turns that
  legend into the formal grammar tables.

### 1.3 Builder interaction model (LOCKED)

- Palette items support **both drag-to-place and click-to-add** (the current
  designer already does both — `FormDesignerPage.tsx:211` `addFieldToSection`
  and the dropzone at L528).
- Properties access is **hybrid**: inline label editing plus a hover toolbar
  (required / duplicate / delete / drag) on the canvas for frequent edits; a
  persistent, collapsible, **selection-following right panel** with per-type
  tabs (General / Options / Push / Logic) for deep configuration; section-level
  settings via a **cog popover** on the section header.

### 1.4 Other locked scope decisions

- **Offline capture: deferred** to the mobile-app phase. The `allowOffline`
  settings slot stays reserved (`forms-engine.service.ts:28`); the existing
  IndexedDB draft autosave in the fill page (`FormFillPage.tsx:180-182, 267,
  313` — 700 ms debounce to IndexedDB + server) is kept as-is, not extended.
- **Drafts:** already exist — a submission is created as a draft and values are
  saved via `PATCH /forms-engine/submissions/:id/values`
  (`forms-engine.controller.ts:70`). No new work.
- **Approvals:** the existing approve / reject / resubmit endpoints
  (`forms-engine.controller.ts:120, 141, 164`) and the `approvalChain` settings
  slot (`forms-engine.service.ts:26, 266-268`) are the base. Rules may *modify*
  the chain (section 5); the approval machinery itself is not rebuilt.

---

## 2. Existing-engine inventory

What is already built, what is wired but orphaned, and what is merely reserved.
This is the honest starting line.

### 2.1 Data model (all built — `apps/api/prisma/schema.prisma`)

| Model | Lines | State |
|---|---|---|
| `FormTemplate` | 1334-1357 | Built. Has `status`, `category`, `isSystemTemplate`, and a `settings` Json blob documented as `{ requiresApproval, approvalChain[], geofenceEnabled, allowOffline, pdfExport, complianceGate{} }` (L1344-1345). `pdfExport` and `allowOffline` are **reserved slots** — typed in `forms-engine.service.ts:27-28` but never acted on. |
| `FormTemplateVersion` | 1359-1373 | Built and load-bearing: submissions bind to versions; edit-as-new-version is the pattern (confirmed by the authoring-v1 prompt, `pr-forms-authoring-v1-ready.md:15`). |
| `FormSection` | 1375-1392 | Built, **with repeat semantics already reserved**: `isRepeating`, `minRepeat`, `maxRepeat` (L1382-1384) and section `conditions` Json (L1385). Nothing reads the repeat fields — the fill page has zero references to repeating (grep of `FormFillPage.tsx` for `repeat`/`isRepeating`: no matches). Orphaned columns awaiting section 3.1. |
| `FormField` | 1394-1423 | Built with generic extension points: `config`, `conditions`, `validations`, `actions` Json columns (L1412-1415). `config` is documented for "min/max/step, formula, lookup spec, etc." (L1406) — the natural home for new field-type settings. |
| `FormRule` | 1425-1438 | Built but **primitive**: one source field, one target field, one operator, one comparison value, one effect (default `SHOW`). No groups, no system values, no actions beyond a single effect. This is the storage seed section 3.5 extends. |
| `FormSubmission` | 1440-1482 | Built: status lifecycle, association FKs (job/client/asset/worker/site/shift), `context` Json auto-fill blob, GPS lat/lng (L1470-1472), approvals + triggered records relations (L1473-1474). Note: `jobId` is re-pointed to Project by **B-P0a-7** (`job-project-consolidation.md` section 6) — forms slices must not touch that linkage. |
| `FormApproval` | 1486-1504 | Built: step number, assignee (user or role), status, due date. |
| `FormTriggeredRecord` | 1506-1517 | Built: the audit link between a submission and any record it caused (`recordType` + `recordId`). **This is the push engine's audit spine** — it already exists. |
| `FormSchedule` | 1519-1537 | Built in schema, **orphaned in product**: zero web references (confirmed in `module-ownership-ia-map.md` section 5.2) and no runner. Out of scope here except where rule 8 of the mockup ("schedule a re-inspection") finally gives it a consumer. |
| `FormSubmissionValue` | 1539-1560 | Built: typed value columns (text/number/datetime/json/boolean) + `filePath` (L1544-1552). **Has no per-entry index** — the gap repeating sections must fill (section 3.1). |
| `FormAttachment` / `FormSignature` | 1562-1586 | Built. `FormSignature` records signer name + timestamps only — **no role gating, no lock semantics, no seal** (section 3.6). |

### 2.2 API (built)

- `forms.controller.ts` — template list/get (`:29`, `:44`), template create
  (`:59`), new version (`:75`), submissions list/get (`:89`, `:104`), legacy
  direct submission create (`:121`). Guarded by `forms.view` / `forms.manage`.
- `forms-engine.controller.ts` — the fill pipeline: draft create (`:49`),
  PATCH values (`:70`), submit (`:96`), approve/reject/resubmit
  (`:120/:141/:164`), my-submissions (`:181`), pending-approvals (`:200`),
  analytics (`:216`).
- `forms-engine.service.ts` — context auto-fill from the filler's active
  timesheet (project, timesheet, allocation, PM, supervisor ids — L105-138);
  approval-chain creation from settings (L266-268); **on-submit triggered
  records** for three types: `safety_incident` (L594), `hazard_observation`
  (L617), `maintenance_job` (L641), each logged to `FormTriggeredRecord`
  (L564) with number sequences via a row-locking `nextSeq` helper (L851).
- `rules-engine.service.ts` — server-side evaluation with 11 operators
  (`equals`…`is_one_of`, L12-21, evaluated at L144-176) and typed actions
  including `show`/`hide`/`require`/`set_value`/`lock`/`send_notification`/
  `create_record`/`add_repeating_row` (L44-56); visibility resolution L211-230,
  required resolution L240-257. These live in `FormField.conditions`, **not**
  in `FormRule` — i.e. two parallel rule stores exist today (section 3.5
  unifies them).

### 2.3 Web (built / orphaned)

- `FormFillPage.tsx` (1,265 lines) — renders 20+ field types (`case` arms from
  L690: short_text, url, long_text, email, phone, number, currency,
  percentage, date, time, datetime, dropdown, multi_select, checkbox, radio,
  toggle, button_group, rating, system_field (L957), plus gps/signature/photo
  further down), and runs a **client-side copy of the rules evaluator**
  (operator cases L97-125) for live show/hide while filling. Autosaves drafts
  to IndexedDB + server every 700 ms (L180-182, L267, L313).
- `FormDesignerPage.tsx` (733 lines) — a working section/field designer with a
  9-type palette (`FIELD_TYPES`, L78-88: text, textarea, number, date,
  checkbox, multiple_choice, signature, image_capture, file), click-to-add
  (L211) and a dropzone (L528). Routed only at `/forms/designer/:templateId`
  (`App.tsx:210`). Being un-orphaned by **forms-authoring-v1** (in flight).
- `FormsListPage.tsx`, `FormSubmissionDetailPage.tsx` — list/tabs and
  read-only submission view with the approval chain.

### 2.4 What v2 must build (the delta)

| Capability | Exists today? |
|---|---|
| Builder with Cognito skin, hybrid properties, Card layout | No — current designer is a plain two-pane editor with 9 types |
| Repeating sections (entries as arrays) | Schema flags only; no storage shape for entries, no UI |
| Lookup / Calculation / Unique ID / Terms / Table / Worker picker / Asset picker / Location / Weather / upgraded Photo & Signature | No (photo/signature/gps exist in basic form) |
| Push-to-module bindings | No — only the three hardcoded `create_record` triggers (2.2) |
| `AssetUsageReading` + usage-based maintenance | No — `Asset` has **no meter fields** (schema L672-702) and `AssetMaintenancePlan` is **days-only** (`intervalDays`/`warningDays`/`nextDueAt`, L1253-1257) |
| Rules grammar (groups, system values, warn/block, alerts, timing) | No — `FormRule` is single-condition; field `conditions` are richer but still form-local |
| AI import / describe / fill-assist / digests | No forms AI at all; provider + persona infra exists (section 6) |
| Output channels (SharePoint PDF / email / webhook; Teams = future channel only) | Partially: email + SharePoint adapters exist platform-wide; **no webhook infra anywhere in the API** (verified by search; the absent Teams surface no longer matters for v1 — deferred, section 10 Q1); `pdfExport` slot reserved but dead |

---

## 3. Data-model additions

House rules apply to every slice: migration folders use **full
`YYYYMMDDHHMMSS_` timestamps** (bare `YYYYMMDD_` folders sort ahead of
timestamped ones on the same day and reorder backfills —
`job-project-consolidation.md` risk R3), backfill data stays **inline** in the
migration, and every change follows **expand → backfill → switch reads →
switch writes → contract**. All additions below are pure *expand* steps
(nullable columns, new tables) unless flagged.

### 3.1 Repeating sections (LOCKED — v1)

`FormSection.isRepeating/minRepeat/maxRepeat` already exist (schema
L1382-1384). The missing piece is where an *entry's* answers live.

- **Add `entryIndex Int?` to `FormSubmissionValue`** (nullable; `null` means
  "not in a repeating section", preserving every existing row untouched).
  Values for entry N of a repeating section carry `entryIndex = N`.
- Adjust the read path so a submission's values group into entry arrays for
  repeating sections — the "entries as arrays" shape Marco locked.
- The existing index `@@index([submissionId])` (L1557) still serves; add
  `@@index([submissionId, fieldKey, entryIndex])` if profiling demands it.
- **Migration slice:** `YYYYMMDDHHMMSS_fv2_repeating_entry_index` — single
  nullable column, no backfill needed (existing rows are correctly `null`).
  Reversible: drop the column.
- Designer + fill UI ship in the same feature slice (F-3, section 8) so the
  column never sits half-wired the way `isRepeating` has.

### 3.2 Push bindings on fields (LOCKED — the centerpiece's storage)

A first-class table rather than another Json blob, because bindings are the
audit-critical part of the system and need to be queryable ("which forms write
to this asset?"):

```
model FormFieldPushBinding {
  id            String   @id @default(cuid())
  fieldId       String                       // -> FormField, Cascade
  targetModule  String                       // "assets" | "maintenance" | "safety" | ...
  targetAction  String                       // "record_usage_reading" | "create_defect" | ...
  applyOn       String   @default("submit")  // "submit" | "approval"  (per-binding toggle, LOCKED)
  config        Json     @default("{}")      // e.g. { unit:"hours", rejectBelowLast:true,
                                             //        allowMeterReplacedOverride:true,
                                             //        assetFromFieldKey:"machine" }
  isEnabled     Boolean  @default(true)
  createdAt / updatedAt
}
```

- One field may carry multiple bindings (a defect entry pushes a defect record
  *and* can flag maintenance).
- Bindings are copied when a template is duplicated and are version-scoped via
  the field they hang off (fields belong to sections belong to versions —
  schema L1387-1388, L1417).
- Execution audit stays on the existing `FormTriggeredRecord` (schema
  L1506-1517) — every successful push writes a row there, exactly as the three
  hardcoded triggers do today (`forms-engine.service.ts:564`).
- **Migration slice:** `YYYYMMDDHHMMSS_fv2_push_bindings` — new table only.
  Reversible: drop table.

### 3.3 `AssetUsageReading` + asset denormalised current readings (LOCKED)

The flagship push target. New table, owned by the **assets** module:

```
model AssetUsageReading {
  id                 String   @id @default(cuid())
  assetId            String                    // -> Asset, Cascade
  unit               String                    // "hours" | "km"
  reading            Decimal  @db.Decimal(12,1)
  previousReading    Decimal? @db.Decimal(12,1)  // snapshot at write time
  recordedAt         DateTime @default(now())
  recordedById       String?                   // -> User, SetNull
  sourceSubmissionId String?                   // -> FormSubmission, SetNull (provenance)
  isMeterReplacement Boolean  @default(false)  // "meter replaced" override (Asset Manager / Warehouse Manager)
  note               String?
  @@index([assetId, unit, recordedAt])
}
```

- **History, never overwrite** (LOCKED): readings are append-only. The assets
  service rejects a reading below the last recorded one for that asset+unit
  unless `isMeterReplacement` is set by a user holding the **Asset Manager or
  Warehouse Manager role** (LOCKED, section 10 Q3; the mockup's override
  toggle, `form-builder-mockup.html:197-198`).
- **Dual meters** (LOCKED, section 10 Q2): an asset structurally supports
  **both** an hours meter and a km meter — the `unit` column above carries
  either, so two independent reading histories can coexist on one asset. Each
  form shows/hides either meter via the meter field's settings
  (`FormField.config`). No current asset uses both, so the asset page and
  pre-start UI default to a single meter; the capability exists without UI
  clutter.
- **Denormalised current-reading fields on `Asset`** (which today has *no*
  meter fields at all — schema L672-702): `currentHoursReading Decimal?`,
  `currentKmReading Decimal?`, `lastReadingAt DateTime?`. Maintained solely by
  the assets service method that inserts readings — the same
  stored-counter-behind-one-service pattern Marco locked for Client counters
  (`module-ownership-ia-map.md` section 7, decision Q4).
- **Migration slices:** `YYYYMMDDHHMMSS_fv2_asset_usage_reading` (new table)
  then `YYYYMMDDHHMMSS_fv2_asset_current_reading_denorm` (nullable columns; no
  backfill — no historical readings exist). Both reversible by drop.

### 3.4 Maintenance usage intervals (LOCKED)

`AssetMaintenancePlan` today is calendar-only: `intervalDays`, `warningDays`,
`lastCompletedAt`, `nextDueAt` (schema L1253-1257). Expand (all nullable, so
existing plans behave identically):

- `intervalUsage Decimal?` + `usageUnit String?` ("hours" | "km") — "every N
  hours/km".
- `lastCompletedReading Decimal?` and `nextDueReading Decimal?` — set when a
  maintenance event completes / recomputed from the interval.
- `usageWarningPct Int @default(90)` — reminder at 90% (LOCKED), fired through
  the existing notification machinery (`platform/notifications.service.ts:79`
  creates notifications; email rides `email.service.ts:43`
  `sendNotificationEmail`). A plan may be days-based, usage-based, or both —
  whichever threshold trips first.
- **Migration slice:** `YYYYMMDDHHMMSS_fv2_maintenance_usage_intervals` —
  nullable columns + default. Reversible: drop columns.

### 3.5 Rule storage extension (LOCKED grammar; storage assessed here)

**Assessment of `FormRule` (schema L1425-1438) as the seed:** it holds exactly
one condition (source field + operator + value) and one effect string. It
cannot express ALL/ANY groups, nesting, multiple actions, system-value
conditions, timing, warn/block messages, or alert recipients. Meanwhile the
richer per-field `conditions`/`actions` Json (schema L1413-1415) that
`RulesEngineService` actually evaluates is form-local only. **Neither store can
carry the locked grammar; extend `FormRule` into the single store:**

- Add to `FormRule`: `name String?`, `isEnabled Boolean @default(true)`,
  `timing String @default("live")` ("live" | "on_submit" | "on_approval"),
  and `definition Json @default("{}")` — the full grammar tree (condition
  groups + actions, section 5). The legacy columns (`sourceFieldKey`,
  `operator`, `comparisonValue`, `effect`) become nullable and are backfilled
  into `definition` (a one-condition, one-action tree) by an inline data
  migration; they are dropped only in a later *contract* slice after both
  evaluators read `definition`.
- The server evaluator (`rules-engine.service.ts`) and the client evaluator
  (`FormFillPage.tsx:97-125`) are refactored to share one definition format so
  live and submit-time behaviour cannot drift.
- **Migration slices:** `YYYYMMDDHHMMSS_fv2_formrule_expand` (columns +
  inline backfill; reversible by nulling) … later
  `YYYYMMDDHHMMSS_fv2_formrule_contract` (drop legacy columns; gated on soak).

### 3.6 Unique-ID sequences, signature seal, Terms

- **`FormNumberSequence`** — per-template auto-numbering (e.g. `PPS-2026-0311`,
  mockup L136): `templateId`, `prefix`, `year Int`, `counter Int`, unique on
  `(templateId, year)`. **Counters reset yearly** (LOCKED, section 10 Q4):
  `PPS-2026-0311` … then `PPS-2027-0001` — the `(templateId, year)` uniqueness
  gives each year a fresh row. **Duplicate prefixes across templates are
  blocked** at template save (unique prefix per template, validated in the
  builder settings). Allocation copies the proven row-lock pattern already
  used three ways in this codebase: the forms module's own `nextSeq`
  (`forms-engine.service.ts:851`), job numbers
  (`jobs/job-number.service.ts:23-49`), and contract sequences
  (schema comment above `ContractStatus`, ~L2890: "IS-C### … via
  ContractNumberSequence row-lock"). Slice
  `YYYYMMDDHHMMSS_fv2_form_number_sequence`.
- **Signature seal** — `FormSignature` (schema L1575-1586) gains
  `signedById String?` (a real User FK, not just `signerName`),
  `requiredRole String?` (role-gated signing, LOCKED) and the submission gains
  a `sealedAt DateTime?`. A sealed submission rejects further value PATCHes and
  is the precondition for push execution (section 4). Slice
  `YYYYMMDDHHMMSS_fv2_signature_seal`.
- **Terms & acceptance** — no schema change: the terms text lives in
  `FormField.config` (the documented home for type-specific settings, schema
  L1406) and the acceptance lands as a boolean value + timestamp in
  `FormSubmissionValue.valueBoolean` (L1551).

### 3.7 Output-channel configuration + delivery log

- Per-form channel config extends the existing `FormTemplate.settings` blob
  (schema L1348) — no migration needed for the config itself; the settings
  surface (section 7) gives it a UI. Shape:
  `outputChannels: { sharepointPdf: {...}, email: {...}, webhooks: [...] }` —
  a `teams` key stays reserved for the deferred future channel (section 10 Q1)
  but is not read by anything in v1.
  The dead `pdfExport` boolean (L1345, `forms-engine.service.ts:27`) is
  superseded by `outputChannels.sharepointPdf` and honoured as a legacy alias.
- **`FormOutputDelivery`** — new table logging every channel attempt per
  submission (`submissionId`, `channel`, `status`, `detail Json`, `attempts`,
  timestamps) so failures are visible and retryable rather than silent. Slice
  `YYYYMMDDHHMMSS_fv2_output_delivery_log`.

---

## 4. The push engine

The centerpiece. Field-level bindings that write into other modules **on
signed submission** (or on approval, per-binding — LOCKED), always **through
the owning module's service**.

### 4.1 Single-writer compliance (binding rule)

The ownership map already codifies forms as a *sanctioned* multi-table writer
with a strict rule: "forms may **create** trigger targets, never update them;
owning modules handle lifecycle" (`module-ownership-ia-map.md` section 2.4, and
the SBD rows for `SafetyIncident`/`HazardObservation` at section 1 —
"creation allowed from the forms trigger (recorded in `FormTriggeredRecord`)"
— and `AssetBreakdown` — "same trigger rule as safety"). The push engine
generalises that rule instead of breaking it:

- Forms never touches `prisma.asset.*` or `prisma.assetUsageReading.*`
  directly. It calls **`AssetsService.recordUsageReading(...)`** — a new
  method on the assets module, which owns validation (reject-below-last,
  meter-replaced override), the append-only insert, and the denormalised
  current-reading update (section 3.3).
- The same shape for every target: defects call an assets/maintenance service
  method; hazards call the safety module (as the hardcoded trigger already
  does at `forms-engine.service.ts:617`); maintenance flags call the
  maintenance module. Note the ownership map flags `Asset` as a CONFLICT row
  ("`assets` is the writer of record; maintenance status writes go through an
  assets-service method", section 1) and schedules OWN-4 to fix it — the push
  engine must land **on the right side of that rule from day one**.
- Every successful push writes a `FormTriggeredRecord` (schema L1506) linking
  submission → created record. That table is the audit spine; nothing new is
  invented for audit.

### 4.2 Flow (text diagram)

```
Filler signs the form (signature field, role-gated)
        │  seal: submission.sealedAt set — values now immutable (3.6)
        ▼
POST /forms-engine/submissions/:id/submit        (forms-engine.controller.ts:96)
        │
        ├─ 1. Validate + run on-submit rules (warn/block already resolved live)
        ├─ 2. SAVE the submission — status SUBMITTED. This always succeeds
        │      independently of anything below. Compliance data is never
        │      hostage to a push.
        ├─ 3. For each enabled FormFieldPushBinding with applyOn = "submit":
        │       resolve target record (e.g. the asset picked in "Which machine?"
        │       via config.assetFromFieldKey)
        │       → call the OWNING MODULE's service method
        │           ├─ success → FormTriggeredRecord row (audit link)
        │           └─ rejection/failure → see 4.4
        ├─ 4. Create approval chain if settings.requiresApproval
        │      (forms-engine.service.ts:266-268)
        └─ 5. Queue output channels (section 7) — logged in FormOutputDelivery

On approval (forms-engine.controller.ts:120), step 3 repeats for bindings
with applyOn = "approval".
```

### 4.3 The flagship: Plant Pre-Start (LOCKED behaviours)

1. **Hour/km reading → `AssetUsageReading`.** New history row, never an
   overwrite. Readings below the last recorded are rejected *at the service*
   (and warned about *live* by rule 3 of the rules mockup,
   `form-rules-builder-mockup.html:93-105`, so the filler usually fixes it
   before submit). A holder of the **Asset Manager or Warehouse Manager role**
   (LOCKED, section 10 Q3) can pass the "meter replaced" override, which
   records `isMeterReplacement = true` rather than bending the rule silently.
2. **Reading → usage-based maintenance.** The assets service recomputes any
   usage-interval plans on that asset (section 3.4); crossing
   `usageWarningPct` (90%) raises a notification through the existing
   machinery ("CAT 320 is 50 h from service" — mockup L201).
3. **Defect entries (repeating section) → defect records.** Each entry pushes
   one record through the maintenance/assets boundary (today's nearest
   analogue is `AssetBreakdown`, schema L1303, already trigger-creatable per
   the ownership map). Severity **Major** additionally flags maintenance and
   can block the asset's "cleared" status — the status write again goes
   through the assets service (`AssetStatusHistory` exists to audit it, schema
   L1320-1332).
4. **Signature seals the push** (LOCKED): bindings execute only after the
   sealing signature. "No signature → no asset update"
   (`form-builder-mockup.html:226`).

### 4.4 Failure handling (LOCKED principle: submission survives)

- If an owning service **rejects** a push (e.g. reading below last, no
  override): the submission stays saved and sealed; the push is recorded as
  `FAILED` with the service's reason; the filler/supervisor sees the error
  surfaced on the submission detail page; a notification goes to the form
  owner. Nothing is silently dropped.
- If a push fails **transiently** (DB contention, downstream outage): the
  failure is **surfaced immediately** with the same visibility, plus a manual
  "retry push" button on the submission for users with `forms.manage`.
  **No silent scheduled auto-retry** — manual retry only (LOCKED, section 10
  Q7). Retried pushes are idempotent — the binding executor checks
  `FormTriggeredRecord` for an existing link before creating twice.
- Pushes are executed **after** the submission transaction commits, not inside
  it, precisely so a push failure can never roll back a WHS record.

---

## 5. Rules engine

Grammar per the rules mockup (all LOCKED — legend at
`form-rules-builder-mockup.html:229-234`, examples L54-225). The existing
evaluator (`rules-engine.service.ts`) is the implementation seed: its 11
operators (L12-21) cover most of the form-value comparisons already; what it
lacks is groups, system-value sources, warn/block actions, alerts, and timing.

### 5.1 Conditions

| Answer type | Operators |
|---|---|
| Choice / multi-choice | is · is not · contains any of · contains all of · contains none of · number selected ≥/≤ |
| Text | filled · empty · contains · doesn't contain |
| Number | = ≠ > < · between |
| Date | before · after · between · within (e.g. "within 30 days") |
| Tables & repeating sections | has any entry where… · has no entry where… · entry count · column total (rule 2, mockup L82) |
| **System values** | asset readings ("Asset → last recorded reading", rule 3, L99) · worker competencies + licences (rule 5, L135: "required licence for task → missing or expired") · site attributes · live weather (rule 7, L169) · timesheet history (rule 6, L153: "hours worked, last 7 days") · the filler's role |

Groups combine with **ALL** (and) / **ANY** (or) and are **nestable** (mockup
grammar line L231).

System-value resolvers and where they read from (all read-only for the rules
engine — no ownership impact):

- *Asset readings* — `AssetUsageReading` / `Asset.current*Reading` (section 3.3).
- *Worker competencies/licences* — `WorkerCompetency.expiresAt` (schema
  L704-718). **B-P0b caveat:** that model hangs off legacy `Worker`; the
  ownership map defers the Worker/WorkerProfile fold to B-P0b (section 1,
  "Deferred to B-P0b — do not add writers"). The resolver reads whichever side
  is canonical when its slice ships, behind one function so the B-P0b swap is
  a one-liner.
- *Timesheet history* — aggregate over `Timesheet` (schema L2280).
- *Weather* — the site-weather service that widgets **batch 3** introduces
  (`docs/pr-prompts/pr-widgets-batch3-weather-defaults-HOLD.md:1-11`: per-site
  conditions keyed off the Site, server-side ~30 min cache). Forms reuses that
  service rather than building a second fetcher (dependency noted in
  section 8).
- *Filler's role* — from the authenticated user, already available to the
  engine.

### 5.2 Actions

| Action | Notes |
|---|---|
| show / hide / require — field, section, or page | Extends existing `show`/`hide`/`require` (rules-engine.service.ts:44-46) |
| set value | Exists (`set_value`, L48) |
| filter another field's options | New |
| **WARN** | Soft stop: acknowledge-to-continue; **the acknowledgement is recorded** on the submission (rule 3, mockup L104) |
| **BLOCK** | Hard stop with a custom message (rule 1, mockup L67) |
| alert a named person or role | via in-app / email, message templated with live answers ("{worker} at {site} reported {hazards}…", mockup L68). Rides the notification machinery (`platform/notifications.service.ts:79`) + email (`email.service.ts:43`). Teams alerting arrives only if/when the deferred Teams channel ships (section 7 future channels) |
| change the approval chain | e.g. add the Director as mandatory approver (rule 9, mockup L206) — mutates the `FormApproval` rows the existing chain creator builds (forms-engine.service.ts:266-268) |
| push actions | flag asset, raise maintenance, log hazard, **start a deadline task** (rule 9, L208: "Notify WorkSafe QLD" with the statutory clock — the deadline task lives in the **compliance module**, LOCKED, section 10 Q6) — routed through the same push executor as section 4 |
| change the after-submit message | New |

### 5.3 Timing

Per rule: **live** (while filling) · **on submit** · **on approval** — stored
in `FormRule.timing` (section 3.5). Live rules run in the fill page's evaluator;
on-submit and on-approval rules run server-side. Both read the same
`definition` Json so behaviour cannot fork (the current codebase already has
this split — server L144-176 vs client `FormFillPage.tsx:97-125` — as two
hand-kept copies; v2 makes the shared format explicit).

**Performance note for live evaluation:** form-value conditions evaluate
locally and instantly. **System-value conditions cannot be fetched on every
keystroke** — the fill page loads a *system-context snapshot* once at
form-open (asset last readings for pickable assets, the filler's competency
expiries, site weather from the 30-minute-cached weather service, 7-day
timesheet hours) and live rules evaluate against that snapshot; the server
re-evaluates against fresh data at submit, so a stale snapshot can never let a
BLOCK through. Budget: the snapshot is one batched endpoint call, not N.

### 5.4 Trend rules — V2, not in scope

Cross-submission rules ("same hazard 3×/30 days/site", rule 10, mockup
L212-225) read history and ship **with the AI digest phase** (LOCKED). Nothing
in the v1 storage precludes them — they are evaluated by a scheduled job, not
the fill path.

---

## 6. AI features

All four are v1, **built in this order** (LOCKED), riding the existing
AI infrastructure: the provider abstraction with Anthropic + OpenAI providers
(`apps/api/src/modules/ai-providers/providers/anthropic.provider.ts`,
`openai.provider.ts`, plus the tool-handler registry under
`ai-providers/tools/`) and the personas framework
(`personas/persona-registry.ts:1-8` — currently registering a single
`tenderingPersona` from `personas/definitions/tendering.persona.ts`, with a
dispatcher, permission guard, and per-discipline definitions). Forms adds a
**forms persona** to that registry the same way tendering did; no new AI
plumbing.

1. **Import a form** — Word / PDF / Cognito export → draft template. The AI
   produces a *draft* `FormTemplate` + version (status DRAFT, exactly the shape
   the designer already edits); it is **always human-reviewed in the builder**
   before publish. Mirrors the tendering pattern where AI proposals become
   reviewable drafts rather than live data.
2. **Describe-to-generate** — "a working-at-heights permit with 2-stage
   sign-off" → draft template (new-form strip tile, builder mockup L95). Same
   draft-only guardrail.
3. **Fill-time assist** — hazard → control suggestions, notifiable-incident
   flagging. **Suggest-never-decide** (LOCKED): the AI proposes; the
   supervisor confirms; and the rule is *visible in the UI* (a labelled "AI
   suggestion" affordance, never a silent auto-fill). Nothing the AI says can
   trigger a BLOCK or a push by itself.
4. **Submission digests / trends** — periodic summaries across submissions,
   shipping together with the V2 trend rules (section 5.4).

Plus **AI rule-drafting** in the rules builder (LOCKED, the AI bar in the rules
mockup L52): describe a rule in plain words → a drafted condition/action tree
appears **for review** in the visual builder — it is never saved enabled
without a human clicking save.

Guardrails common to all four: drafts only, human confirmation, provider calls
through the existing sanitiser (`ai-providers/error-sanitiser.ts`) and BYOK
key handling already in place for personas.

---

## 7. Output channels

**V1 channels (LOCKED, section 10 Q1): SharePoint PDF, email, webhooks.**
Configured **per form** in a Settings surface styled like Cognito's left
settings nav (the builder gets a Settings area alongside Build/Rules). Every
send is logged in `FormOutputDelivery` (section 3.7).

| Channel | Rides on | Gap to close |
|---|---|---|
| **Submission PDF → job's SharePoint folder** | `pdf-rendering` module (`pdf-renderer.service.ts:35 renderHtmlToPdf`, `:91 renderTemplateToPdf` — today it has only a quote builder, `builders/quote-html.builder.ts`) + the SharePoint adapter (`platform/sharepoint.adapter.ts:53-87` — `ensureFolder`/`uploadFile` interface, `SHAREPOINT_ADAPTER` token, mock impl L118-128; live Graph impl `platform/graph-sharepoint.adapter.ts`; service wrapper `platform/sharepoint.service.ts:109`). The `pdfExport` settings slot has waited for this since PR #97 (schema L1345). | New `form-submission-html.builder.ts` in pdf-rendering + a delivery step that resolves the job folder and uploads |
| **Email copies** | Existing notification/email machinery: `platform/notifications.service.ts` (creates + routes, `:79`) and `email.service.ts:43 sendNotificationEmail` → `providers/outlook.provider.ts` (Graph mail) / `gmail.provider.ts`, configured by the `EmailProviderConfig` singleton | Per-form recipient config only |
| **Webhooks** | Nothing — **no outbound webhook infrastructure exists** (verified by search). | Small generic sender: POST JSON payload, secret header, timeouts, retries logged in `FormOutputDelivery`. The escape hatch for anything we haven't integrated |

Channel sends happen after submit (or after final approval if the form
requires approval — per-channel toggle), outside the submission transaction,
with per-channel failure visibility (section 4.4 semantics): failures surface
immediately with a manual retry button — no silent auto-retry (LOCKED,
section 10 Q7).

**Future channels (documented, not v1):** **Teams channel messages** are
DEFERRED entirely (LOCKED, section 10 Q1) — Teams is a future/backup channel.
For the record when it is picked up: **no Teams integration exists in the API
today** (verified: no Teams surface found under `apps/api/src`), though the
Graph credential foundation exists (the schema comment at
`EmailProviderConfig`, schema ~L2870: "SHAREPOINT_* doubles as Graph Mail
credentials in practice"), and the delivery mechanism (incoming webhooks vs
Graph app permissions) will be decided then. The `outputChannels.teams`
settings key stays reserved (section 3.7).

---

## 8. Phased slice plan (F-1 … F-13)

Sequencing constraints, checked against the in-flight programs:

- **After forms-authoring-v1** (`docs/pr-prompts/pr-forms-authoring-v1-ready.md`)
  — everything here builds on its PATCH/archive/duplicate endpoints and the
  un-orphaned designer.
- **Around B-P0a:** slice B-P0a-7 re-points `FormSubmission.jobId` → Project
  (`job-project-consolidation.md` section 6). No F-slice touches
  `FormSubmission`'s association FKs; F-slices that *read* the job linkage (PDF
  → job folder, F-11) use whatever linkage is current and are trivially
  re-pointed by B-P0a-7 itself.
- **Around the widget batches:** batch 1's asset widget is read-only
  ("Assets by status (donut)", `pr-widgets-batch1-quickwins-HOLD.md:14`);
  batches 1-2 are dashboards-module work — **no file collision** with forms or
  assets services. Batch 3 *creates the site-weather service*
  (`pr-widgets-batch3-weather-defaults-HOLD.md:8-11`); F-6's weather field
  **depends on** (does not collide with) that service. F-7/F-8 touch the
  assets/maintenance modules and `schema.prisma` — run the standard pre-work
  conflict check against whatever is armed at the time; nothing currently in
  flight writes those files.
- Forms module files themselves are an isolated domain (the authoring-v1
  prompt already relies on this: "Forms area only — zero collision with the
  in-flight dashboards chain", `pr-forms-authoring-v1-ready.md:21`).

| # | Slice (branch) | Scope | Schema? | Depends on |
|---|---|---|---|---|
| **F-1** | `feat/fv2-builder-shell` | Builder reskin to the mockup: Cognito skin, grouped palette (existing 9 types only), drag+click add, hybrid properties (hover toolbar + selection-following right panel + section cog popover), Classic/Card layout toggle (Card = one-question-per-page rendering in fill; fill auto-switches to Card below the 768px breakpoint, overridable per form — Q8). Web-heavy, API untouched. | No | authoring-v1 |
| **F-2** | `feat/fv2-rules-storage` | `FormRule` expand + inline backfill of legacy rows into `definition`; shared rule-definition format; server + client evaluators read it; rules full-screen builder UI (visual grammar, form-value conditions only); WARN/BLOCK actions + acknowledgement recording; timing field. | `fv2_formrule_expand` | F-1 |
| **F-3** | `feat/fv2-repeating-sections` | `entryIndex` column; designer support (repeat toggle, min/max, entry label); fill UI entry add/remove; repeating-section rule operators (has any entry where / count / column total). | `fv2_repeating_entry_index` | F-2 |
| **F-4** | `feat/fv2-fields-wave1` | Lookup (system lists incl. global lists, nested/dynamic-dropdown), Calculation (form fields + picker system values), Unique ID (+ `FormNumberSequence`), Terms & acceptance, Table. All config in `FormField.config`. | `fv2_form_number_sequence` | F-1 |
| **F-5** | `feat/fv2-fields-whs` | Worker picker (pre-fill from today's allocation, competency check), Asset picker (site-filtered, service warnings), Location stamp, Photo upgrades (min count, camera-only, location/time stamps, annotation flag), Signature v2 (role-gated, locks form, seals submission — `sealedAt`). | `fv2_signature_seal` | F-4 |
| **F-6** | `feat/fv2-weather-field` | Weather auto-capture field + weather system-value resolver, reusing batch 3's site-weather service. Small. | No | F-5, widgets batch 3 |
| **F-7** | `feat/fv2-asset-usage-readings` | **Assets-module slice, no forms code:** `AssetUsageReading` table, `Asset` denorm columns, `AssetsService.recordUsageReading` (reject-below-last, meter-replaced override), readings history UI on the asset page. | `fv2_asset_usage_reading`, `fv2_asset_current_reading_denorm` | — (parallel-safe) |
| **F-8** | `feat/fv2-maintenance-usage-intervals` | Maintenance-module slice: usage-interval columns, recompute on reading/completion, 90% reminder via notifications. | `fv2_maintenance_usage_intervals` | F-7 |
| **F-9** | `feat/fv2-push-engine` | `FormFieldPushBinding` table + executor (post-commit, idempotent, `FormTriggeredRecord` audit, failure surfacing + retry); Push tab in the properties panel; the Plant Pre-Start bindings end-to-end (reading, defects, Major-severity flag/block via assets service); apply-on-approval toggle. | `fv2_push_bindings` | F-5, F-7, F-8 |
| **F-10** | `feat/fv2-rules-system-values` | System-value conditions (asset readings, competencies, site attrs, weather, timesheet hours, role) + the fill-time system-context snapshot endpoint; alert actions (in-app/email w/ answer tokens); approval-chain modification; push actions from rules; deadline-task action (WorkSafe clock — compliance module, per Q6). | No | F-2, F-6, F-7, F-9 |
| **F-11** | `feat/fv2-output-channels` | Settings surface; SharePoint PDF (submission HTML builder + upload to job folder), email copies, webhooks; `FormOutputDelivery` log + immediate-surface manual retry (Q7). Teams sender dropped from scope — deferred per Q1. | `fv2_output_delivery_log` | F-9 (channels fire from the same post-submit pipeline) |
| **F-12** | `feat/fv2-ai-import` then `feat/fv2-ai-describe` | AI order 1 + 2: forms persona registration, import (Word/PDF/Cognito → draft), describe-to-generate, AI rule-drafting bar. Two PRs, this order (LOCKED). | No | F-2, F-4 |
| **F-13** | `feat/fv2-ai-fill-assist` then `feat/fv2-ai-digests` | AI order 3 + 4: fill-time suggest-never-decide assist; digests/trends + the V2 cross-submission trend rules and re-inspection scheduling (first real `FormSchedule` consumer). | No | F-10, F-12 |
| — | contract slice | `fv2_formrule_contract` — drop legacy `FormRule` columns after soak. | contract | F-2 soaked |

Every slice: single feature commit, full CLAUDE.md verification suite
(`pnpm build` / `lint` / `compliance:smoke`), migrations in the same commit as
schema changes, Swagger decorators on all new endpoints, reviewer GH-Mantova.

---

## 9. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Live-rule performance** — system-value conditions hitting the API on every answer change would make big forms unusable in the field. | Med | Med | Snapshot-at-open design (section 5.3): one batched context call, local evaluation, authoritative re-check at submit. Budget asserted in F-10 tests. |
| R2 | **Push failure mid-submission** loses WHS data or double-writes readings. | Med | High | Submission commits before any push; pushes are post-commit, idempotent (checked against `FormTriggeredRecord`), individually logged, retryable, and never silent (section 4.4). |
| R3 | **AI import quality** — a mangled import silently drops a critical question from a safety form. | Med | High | Imports are always DRAFT and human-reviewed in the builder (LOCKED); the import view shows a side-by-side of source pages vs drafted fields; publish stays a human action. |
| R4 | **Repeating-section migration** — retrofitting `entryIndex` interacts with existing submission values and the two rule stores. | Low | Med | Column is nullable with `null` = legacy meaning; no backfill needed; rule-store unification (F-2) lands *before* repeating rules (F-3) so there is one evaluator to teach. |
| R5 | **Two rule evaluators drift** (server vs fill page — already true today at `rules-engine.service.ts:144` vs `FormFillPage.tsx:97`). | Med | Med | F-2 makes the definition format shared and adds contract tests that run the same fixtures through both evaluators. |
| R6 | **Ownership regression** — a push binding written as raw prisma into another module's table would recreate exactly the CONFLICT pattern the ownership map is eliminating. | Low | High | Binding executor can only call registered owning-service methods (a typed registry, not arbitrary prisma); reviewed against `module-ownership-ia-map.md` section 1 rows per target. |
| R7 | **B-P0a / B-P0b moving parts** — `FormSubmission.jobId` re-points (B-P0a-7); competency data moves sides (B-P0b). | Med | Med | F-slices never touch submission association FKs; competency resolver isolated behind one function (section 5.1). |
| R8 | **Meter data integrity** — a wrong accepted reading poisons service scheduling. | Med | Med | Append-only history with `previousReading` snapshots; reject-below-last at the service; live warn rule; meter-replaced override is explicit, attributed, and audited. |
| R9 | **Migration ordering** — same-day folder sort hazard as B-P0a R3. | Low | High | Full 14-digit timestamps on every folder; inline backfills; `prisma migrate status` check before apply (house rule, `reference_prisma_migration_ordering`). |

---

## 10. Decisions locked (Marco, 2026-07-03 evening)

All eight open questions were answered by Marco on 2026-07-03. The decisions
are recorded here and propagated through sections 1, 2.4, 3, 4, 5, 7, and 8
above.

1. **Teams delivery — DEFERRED entirely (not v1).** Teams is a future/backup
   channel only. **V1 output channels are: SharePoint PDF, email, webhooks**
   (section 7). No v1 slice builds Teams (F-11 re-scoped accordingly); the
   webhook-vs-Graph mechanism choice is deferred with it and documented in
   section 7's future-channels note.
2. **Meters — both, structurally.** Assets support **both** an hours meter and
   a km meter in the data model (section 3.3); each form shows/hides either
   meter via the meter field's settings. No current asset uses both — the
   capability exists, the UI defaults to one meter.
3. **Meter-replaced override + asset-related approvals** route to the **Asset
   Manager and Warehouse Manager roles** (sections 3.3, 4.3). **NOTE recorded:**
   Marco flags that job roles and role names need a cleanup pass — the Job
   Roles register is currently empty. Cross-reference the IA map's users/roles
   slice (`module-ownership-ia-map.md`); the forms engine binds to roles by
   id, so the cleanup is **non-blocking** for this program.
4. **Unique IDs — yearly reset** (`PPS-2026-0311` → `PPS-2027-0001`), and
   **duplicate prefixes across templates are blocked** (section 3.6).
5. **Lookup v1 sources — confirmed:** lookup values + global lists + the
   entity lists sites, assets, workers, clients, subcontractors. Anything
   further is added on request, keeping the Lookup field bounded (F-4).
6. **WorkSafe deadline task lives in the compliance module** (alerts + cron
   already exist there) — F-10's deadline-task action specs against it
   (section 5.2).
7. **Push failure — surface immediately with a manual retry button; no silent
   auto-retry** (sections 4.4 and 7).
8. **Card layout — automatic on phones/tablets** (fill page switches to Card
   below the platform's 768px breakpoint), **overridable per form** in the
   builder (sections 1.2 and 8, F-1).

---

*Prepared 2026-07-03. Draft — lives in `docs/architecture/drafts/` until
ratified; the ratifying PR moves it up a level per house convention.*
