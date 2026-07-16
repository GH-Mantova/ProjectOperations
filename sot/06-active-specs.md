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
> **Defers to:** `sot/04-data-model.md` (B-P0a) and
> `sot/04-data-model.md` (ownership rules). Nothing here
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
| `FormSubmission` | 1440-1482 | Built: status lifecycle, association FKs (job/client/asset/worker/site/shift), `context` Json auto-fill blob, GPS lat/lng (L1470-1472), approvals + triggered records relations (L1473-1474). Note: `jobId` is re-pointed to Project by **B-P0a-7** (`sot/04-data-model.md` section 6) — forms slices must not touch that linkage. |
| `FormApproval` | 1486-1504 | Built: step number, assignee (user or role), status, due date. |
| `FormTriggeredRecord` | 1506-1517 | Built: the audit link between a submission and any record it caused (`recordType` + `recordId`). **This is the push engine's audit spine** — it already exists. |
| `FormSchedule` | 1519-1537 | Built in schema, **orphaned in product**: zero web references (confirmed in `sot/04-data-model.md` section 5.2) and no runner. Out of scope here except where rule 8 of the mockup ("schedule a re-inspection") finally gives it a consumer. |
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
`sot/04-data-model.md` risk R3), backfill data stays **inline** in the
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
  (`sot/04-data-model.md` section 7, decision Q4).
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
owning modules handle lifecycle" (`sot/04-data-model.md` section 2.4, and
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
  (`sot/04-data-model.md` section 6). No F-slice touches
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
| R6 | **Ownership regression** — a push binding written as raw prisma into another module's table would recreate exactly the CONFLICT pattern the ownership map is eliminating. | Low | High | Binding executor can only call registered owning-service methods (a typed registry, not arbitrary prisma); reviewed against `sot/04-data-model.md` section 1 rows per target. |
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
   slice (`sot/04-data-model.md`); the forms engine binds to roles by
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


---

<!-- ============================================================
     MERGED SOURCES  (sot-consolidation, 2026-07-08)
     Primary (above): docs/architecture/forms-engine-v2.md
     Merged below VERBATIM (distinct-topic build specs; no de-dup
     against the forms primary was needed) from:
       - docs/specs/consolidated-build-spec-tender-comms-procurement.md
       - docs/specs/rates-lists-tidyup-spec.md
       - docs/design/widget-candidates-catalogue.md
       - docs/Designs/scope-of-works-redesign.md
       - docs/security/permission-matrix.md
     ============================================================ -->


---

<!-- ═══ sot/06 merged spec — source: docs/specs/consolidated-build-spec-tender-comms-procurement.md ═══ -->

# Consolidated Build Spec — Tender Wizard · Internal Comms & Approvals · Procurement

**Status:** Draft for review · **Date:** 2026-07-06 · **Owner:** Marco (WHS & Commercial Compliance)
**Source policies:** POL 1.2.14 Procurement Policy, PRO 23 Procurement Procedure
**Verified against:** `main` @ `apps/api/prisma/schema.prisma` (line refs below were confirmed live, not assumed)

---

## 0. Guiding principles

1. **Build on existing seams — never rebuild what ships today.** Section 1 is the authoritative "already exists" ledger; every feature section states explicitly what is reused vs. net-new.
2. **Authority is a configuration layer, not code.** Every spend limit, approval threshold and escalation target is Director-configurable data. Ceilings stay **open by default** so features are fully usable now; a future compliance pass dials them in. All authority decisions route through **one central authorization seam** so that pass is a config walk, not a code hunt.
3. **Policy divergences are flagged, not silently coded.** Where the agreed behaviour differs from the signed POL 1.2.14, it is listed in Section 8 for Sean to re-issue the controlled document.

---

## 1. Sanity-check ledger — what already exists (do NOT rebuild)

| Capability | Status | Existing artifact (verified) | Action |
|---|---|---|---|
| Tender create flow | EXISTS | `POST /tenders` `tendering.controller.ts:174`; slide-over `TenderingPage.tsx` | Wrap in wizard UX; do not rebuild endpoint |
| Tender draft status | EXISTS | `Tender.status @default("DRAFT")` `schema.prisma:736` | Reuse |
| Multiple clients per tender | EXISTS | `TenderClient` join `schema.prisma:802` (`clientId`, `contactId`, `isAwarded`, `contractIssued`, `notes`) | Extend (add fields) |
| Tender document upload | EXISTS | `TenderDocumentLink` `schema.prisma:920`; `TenderDocumentsPanel.tsx` | Reuse |
| Rate snapshot | EXISTS | `Tender.ratesSnapshotAt`; `TenderPricingSnapshot` `schema.prisma:853` | Reuse; add explicit "lock" semantics |
| SharePoint folder on tender create | EXISTS | auto-provision `1. Operations/1. Tenders/{tenderNumber}/{category}` `tendering.service.ts:110` | Reuse; extend tree |
| Record-anchored message threads | EXISTS | `CorrespondenceThread`/`CorrespondenceMessage` `schema.prisma:3789/3819` (polymorphic client/tender/job) | Build on top |
| Notifications | EXISTS | `Notification` `schema.prisma:342`; `NotificationTriggerConfig:2853`; `NotificationsPage.tsx` | Reuse for alert fan-out |
| Outbound Outlook email | EXISTS (send only) | `OutlookEmailProvider` (real Graph `sendMail`), `AZURE_MAIL_*` | Reuse for mirrored alerts |
| Supplier / subcontractor records | EXISTS | `SubcontractorSupplier` `schema.prisma:3190` (+ `CreditApplication:3308`, `SupplierCreditEntry:3343`); `SubcontractorsPage.tsx` | Extend, do not recreate |
| Asset register + maintenance | EXISTS | `Asset:672`, `AssetCategory:557`; `assets` + `maintenance` modules | Reuse; add stock layer |
| RBAC permissions | EXISTS | `common/permissions/permission-registry.ts`; `permissions.decorator.ts`/`guard.ts`; `modules/permissions` | Wrap with authority seam |

### Net-new (confirmed absent on `main`)

| Capability | Evidence of absence |
|---|---|
| Package / trade taxonomy (asbestos, demolition, …) | zero `package` matches in schema; `Scope*` models are scope-of-works line items, not discipline selection |
| Per-client packages + per-client submission date | `TenderClient` has no `submissionDate` / package relation |
| Pricing basis (documents / request / risk) | no such field |
| Approval steps / overrule inside threads | zero approval/escalate matches in `correspondence` module |
| Mailbox / inbox UI | correspondence is per-record panels only; `NotificationsPage` is a feed, not an inbox |
| Procurement request → PO → issue flow | no procurement/PO/requisition module, entity, or page anywhere |
| Sourcing thresholds ($5k/$20k) | no spend-limit / threshold logic exists |
| Inventory / stock / stocktake / check-in-out | zero matches in schema + web |
| Org reporting hierarchy (user→user) | `User:19` has `createdBy`, per-job `managedJobs`/`supervisedJobs`, but no `managerId`/`reportsTo` |
| Job allowance / handover budget | `Job:941` has no budget field; budget lives on `Project:1961` (`budget`, `contractValue`, `actualCost`) |
| Central authority / approval seam | RBAC is static per-module `@RequirePermissions`; no shared approval/authority service |

---

## 2. Phase 0 — Foundations (small, high-leverage, unlock Phases 2 & 4)

### 2.1 Org reporting hierarchy
- **Net-new:** add self-relation `managerId` (→ `manager`/`directReports`) on `User` (`schema.prisma:19`).
- Provides the subtree used by comms visibility ("Ops Manager sees everyone below") and procurement escalation.
- Migration + seed of current reporting lines. No behaviour change until consumed.

### 2.2 Central authorization / approval seam
- **Net-new** `authorization` service that wraps the existing RBAC registry and adds a **configurable authority layer**: per user/role/department spend limits, approval thresholds, escalation targets — all data, defaulting to **open ceiling**.
- Every authority decision (comms approvals, procurement routing) calls this one seam. Maintains a **registry of authorization points** so the future compliance pass configures them without code changes.
- Reuse `permission-registry.ts` + `permissions.guard.ts`; do not replace RBAC — layer authority on top.

---

## 3. Feature 1 — New Tender Wizard (Phase 1, quick win: mostly frontend)

**Reuses:** tender create endpoint, draft status, `TenderClient`, `TenderDocumentLink`, `TenderPricingSnapshot`, SharePoint provisioning (all EXISTS).

### Net-new data
- `TenderClient`: add `submissionDate DateTime?`, and a package selection relation (below). Add "details incomplete" derived flag → fires a `Notification` (reuse) to the creator.
- **Package taxonomy (net-new):** `TenderPackage` (per-tender discipline: asbestos, demolition, concrete cutting, civil, …) + `TenderClientPackage` join (which client prices which package) — the builder×package matrix. *Confirm whether this should extend the existing tender `category` concept used in the SharePoint path rather than a parallel taxonomy.*
- **Pricing basis (net-new):** on each selected package, `basis` enum = `DOCUMENTS | CLIENT_REQUEST | IDENTIFIED_RISK` + optional `note` (carries through as bid qualification). A package is always valid without documents.

### Behaviour
- Draft created on step 1 (reuse DRAFT); SharePoint folder provisioned early (reuse) so uploads land live.
- Document step: **single deduplicated upload set** driven by the union of all selected packages; buckets = union, not per-client. Shared "General set" applies to all; per-package overrides optional.
- Rate step: **snapshot = lock** (reuse `TenderPricingSnapshot` + `ratesSnapshotAt`); make the lock explicit at wizard completion.
- Every step skippable + resumable (needs a "resume incomplete tenders" surface + draft list). Cancel discards only if no files uploaded; else converts to "save & finish later."
- AI scope draft = **deferred hook** (greyed "coming soon"); no build in Phase 1.

### Out of scope (already shipped) — do not touch
Create endpoint, draft status, multi-client structure, document link model, snapshot model, SharePoint-on-create.

---

## 4. Feature 2 — Internal Comms + Approvals (Phase 2)

**Reuses:** `CorrespondenceThread`/`CorrespondenceMessage` (polymorphic client/tender/job), `Notification`/`NotificationTriggerConfig`, `OutlookEmailProvider` (send).

### Net-new
- **Structured approval steps inside threads:** an `Approval` object attached to a thread with states, approver (from the authority seam), reason-required override, immutable audit entry. Overrule notifies the whole chain.
- **Mailbox / inbox surface:** aggregates threads + an "awaiting my approval" queue + DMs into one familiar view (today only per-record panels exist). Record-anchored underneath, mailbox on top, DMs allowed = the agreed "mix."
- **Visibility on two axes:** hierarchy subtree (from 2.1) + lateral role (Compliance cross-cutting). Compliance access = open item for Sean (Section 8).
- **Alert fan-out:** in-app `Notification` **mirrored** to Outlook email (reuse send path). First two producers: tender-awarded (→ Admin, cc Compliance) and procurement events.

### Adapter note
`CORRESPONDENCE_MODE=mock`; the **live inbound adapter throws "not implemented."** Internal threads work in mock; live inbound Outlook sync is a separate enablement, not a blocker for internal use.

---

## 5. Phase 3 — Inventory / Stock layer (the "replace Asset Tiger" work)

**Reuses:** `Asset`/`AssetCategory`, maintenance/inspection models (EXISTS).

### Net-new
- Stock / inventory model (consumables + quantities on hand), **stocktake**, **check-in/out**, assignment-to-person, photo-on-delivery, reserve/issue.
- This is the register the procurement "check in-house first" gate reads, and where receipts land.
- Item master carries a **`type` classification (consumable / equipment / asset)** — this is the field that resolves the asset-vs-equipment routing question in Section 6, turning a judgement call into data.

---

## 6. Feature 3 — Procurement (Phase 4, most prerequisites)

**Reuses:** `SubcontractorSupplier` (+ credit ledger) — extend, don't recreate. Authority seam (2.2), inventory (Ph3), hierarchy (2.1), Outlook send, correspondence threads.

### Net-new module — request → approval → PO/subcontract → receipt → reconcile → audit
Workflow (from POL 1.2.14 / PRO 23):
1. Identify need, tie to project budget line; Site Supervisor = request-only (via PM external / LM in-house).
2. **Check in-house first** against the ERP stock/asset register (reserve/issue existing → stop).
3. **Sourcing by value (config):** <$5k none · ≥$5k 3 quotes · >$20k RFQ + 3 bids — enforced as a submission gate.
4. **Approval routing (config, via seam):** ≤$500 & in budget → proceed; **>$500 → Ops Manager (single approver)**; Director = discretionary escalation (thread or verbal), not a mandatory gate; ceiling open (Director sets per-user later).
5. ERP issues PO / subcontract to supplier/subcontractor (written, audit trail; reuse Outlook send).
6. Receive · inspect · register in ERP asset/stock register (Ph3).
7. Finance record/reconcile, allocate to project; PM approves vendor claim.
8. Project-close audit.

### Hard dependency
The out-of-allowance check needs a **job-level budget**, which currently lives on `Project`, gated by the **Job/Project consolidation** (see `project_job_project_worker_splits`). Procurement's budget check cannot be correct until that resolves.

---

## 7. Dependencies & sequencing

```
Phase 0  Foundations        managerId on User  +  authority seam (config-open)
Phase 1  Tender wizard      frontend on existing backend  + package taxonomy + pricing basis
Phase 2  Comms approvals    approvals/overrule + mailbox   (needs Ph0 seam + hierarchy)
Phase 3  Inventory/stock    extends Asset register         (Asset Tiger replacement)
Phase 4  Procurement        PO flow                        (needs Ph0 + Ph3 + job budget)
```

**Cross-cutting enablements (separate tickets, not blockers for internal use):**
- SharePoint live (`SHAREPOINT_MODE=mock` → live) — unblocks real tender folders.
- Outlook inbound / live correspondence adapter ("not implemented") — unblocks live thread sync; send already works.
- Job/Project consolidation — gates Phase 4 budget check.

---

## 8. Policy divergences & open items for Sean

1. **>$500 approver = Ops Manager**, not Director (POL 1.2.14 says Director for equipment >$500 and reserves exceptions to Director). ERP will diverge from the signed policy until POL 1.2.14 is re-issued.
2. **Open ceiling for Ops Manager** — no upper bound above $500 for now; Director configures per-user authority later. An unbounded single approver may draw ISO/IMS audit questions; conscious decision.
3. **Compliance access model** (comms lateral axis): read-only observer on all threads vs. notified-on-events; can they flag / approve / overrule; do they see DMs. Needs Sean's answer.
4. **Asset vs equipment definition** — now resolved as the item-master `type` field (Ph3), not a dollar rule. Confirm the classification list.

---

## 9. Duplication guardrails (explicit "do not build" list)

- Do **not** build a tender create endpoint, draft status, multi-client join, tender-doc model, rate snapshot model, or SharePoint-on-create — all ship.
- Do **not** rebuild correspondence threads, the panel, notifications, or the Outlook send path.
- Do **not** recreate supplier/subcontractor records or the credit ledger — extend `SubcontractorSupplier`.
- Do **not** rebuild the asset register or maintenance — only add the stock/stocktake/check-in-out layer.
- No open PR, branch, or staged `docs/pr-prompts/` prompt overlaps any of the three ideas (swept 2026-07-06) — nothing in-flight to collide with.


---

<!-- ═══ sot/06 merged spec — source: docs/specs/rates-lists-tidyup-spec.md ═══ -->

# Rates & Lists Tidy-up — Consolidated Spec

**Status:** Draft for review · **Date:** 2026-07-06 · **Owner:** Marco (with Sean for rate authorship)
**Verified against:** `main` @ `apps/api/prisma/schema.prisma` and the estimates/tendering modules (line refs are live, not assumed)

> **Safe-staging note.** This is a design document only. It introduces **no** schema change, migration, code, or PR-prompt, and does **not** touch `roadmap.md` / `progress.md` (owned by the doc-reconcile PR). It lives in `docs/specs/` as additive documentation, so it cannot block or be blocked by any existing or future PR. Nothing here fires the PR-watcher (it is not a `*-ready.md` in `docs/pr-prompts/`). Build work is only queued later, phase by phase, as separate reviewed prompts.

---

## 0. Goal

Separate **Lists** (no $) from **Rates** ($), make rate structures **data-defined** (Sean can add tables/columns/rows without a developer), and guarantee **one source of truth** — change a rate once and every live consumer reflects it, while locked tenders keep their snapshot. Do this **without a big-bang rewrite** of the existing pricing paths.

---

## 1. Current state (verified)

### Lists — already good
- `GlobalList` (`schema.prisma:2647`) + `GlobalListItem` (`:2664`): `slug`, `type` (`GlobalListType`), `sourceModule`, `isSystem`; items carry `value`, `label`, `metadata Json`, `sortOrder`, `isArchived`; unique `(listId, value)`. UI: `GlobalListsSection.tsx`, consumed by `ScopeListDropdown.tsx`.
- `LookupValue` (`:720`) — an older, narrower lookup mechanism. Candidate for consolidation into `GlobalList` (out of critical path; assess late).

### Rates — rigid
- Eight hardcoded, fixed-column tables: `EstimateLabourRate` (`:1588`), `EstimatePlantRate` (`:1602`), `EstimateWasteRate` (`:1617` — keyed `wasteType+facility`, `tonRate`/`loadRate`), `EstimateCuttingRate` (`:1634` — keyed `equipment+elevation+material+depthMm`, `ratePerM`), `EstimateCoreHoleRate` (`:1650`), `EstimateFuelRate` (`:1661`), `EstimateEnclosureRate` (`:1674`), `CuttingOtherRate` (`:2792`).
- CRUD via `estimates.service.ts` (per-table, audit-logged). UI: `EstimateRatesAdminPage.tsx`, `estimateRatesCommit.ts`.
- All are **Initial Services** rates. There is **no** subcontractor-rate concept and no way to add a column/table without a schema migration + code.

### Propagation is already solved (this is the key finding)
Consumers look rates up **live by key match** (e.g. waste keyed on `wasteType+facility`), and tenders **snapshot** rates at lock time (`TenderPricingSnapshot` `:853`, `Tender.ratesSnapshotAt` `:756`; resolver in `scope-item-pricing.ts`). So "change once → flows to live work, locked tenders frozen" **already exists**. The problem is **rigidity**, not propagation.

---

## 2. Target architecture

**Separation rule (enforced):** a table with **no VALUE ($) column is a List** → belongs in `GlobalList`. A table with a VALUE column **is a Rate** → belongs in the new `RateTable` system. Validation rejects a "rate" with no $ and a "list" with a $.

**Flexible RateTable:** `RateTable → typed Columns → Rows`. Rows unlimited; columns unlimited but each declares a **type** and a **role**:
- **Role KEY** — identifies/matches a row (the lookup dimensions).
- **Role VALUE** — a `$` figure (carries a unit). A table needs ≥1.
- **Role INFO** — notes/reference, never used for matching or pricing.

**Two categories:**
- **Initial Services** — labour, plant, consumables, fuel, enclosure, waste, cutting…
- **Subcontractor / Supplier** — grouped by subcontractor **type** (concrete cutters, hygienists, plant hire…), each rate card linked to a `SubcontractorSupplier` (`:3190`).

**One rate-resolver seam:** every module calls a single service — `resolveRate(tableSlug, keys) → { rowId, value, unit }` — and never queries rate tables directly. This is the mechanism for "change once, not every module." Consumers store a **stable `rowId` reference**, not the key text, so renaming a key label never breaks a link. Tender snapshotting stays exactly as-is (the resolver's output is what gets snapshotted at lock).

**Lists integration:** a rate column of type `LIST_REF` pulls its allowed values from a `GlobalList` (e.g. the "Material" column pulls the "Cutting materials" list) — one place to manage the vocabulary, reused across rates and dropdowns.

---

## 3. New data model (proposed)

- `RateTable`: `id`, `name`, `slug` (unique), `category` enum(`INITIAL_SERVICES` | `SUBCONTRACTOR`), `subcontractorType String?` (for SUBCONTRACTOR — itself a `GlobalList`), `supplierId String?` (→ `SubcontractorSupplier`), `description`, `isSystem`, timestamps, created/updated-by.
- `RateColumn`: `id`, `rateTableId`, `name`, `dataType` enum(`TEXT`|`NUMBER`|`CURRENCY`|`DATE`|`BOOL`|`LIST_REF`), `role` enum(`KEY`|`VALUE`|`INFO`), `unit String?` (required when role=VALUE), `listSlug String?` (required when dataType=LIST_REF), `required Boolean`, `min`/`max Decimal?` (optional bounds), `sortOrder`. Unique `(rateTableId, name)`.
- `RateRow`: `id`, `rateTableId`, `cells Json` (columnId → typed value), `isActive Boolean @default(true)` (soft-delete), `effectiveFrom`/`effectiveTo DateTime?` (optional dating), `sortOrder`, timestamps, created/updated-by.
- A **computed unique constraint** on the KEY-column tuple per table (enforced in the service since keys are dynamic — see validation).

Snapshotting: extend `TenderPricingSnapshot` to record `{ rateTableSlug, rowId, value, unit }` for the rates a tender consumed, so a locked tender is fully reconstructable even if the rate later changes or is deactivated.

---

## 4. Validation rules (four layers)

**Structure (column definitions)**
- Every table: ≥1 `KEY` column and ≥1 `VALUE` column. Zero VALUE → not a rate (reject; suggest it's a List).
- `VALUE` columns must have a `unit`. `LIST_REF` columns must name a live `listSlug`.

**Data (row entry)**
- The `KEY`-column tuple must be **unique** across active rows — no duplicate/ambiguous rates.
- `CURRENCY`/`NUMBER` cells must parse as numbers; `VALUE` must be ≥ 0 (plus optional per-column `min`/`max`).
- `LIST_REF` cells must equal a **live (non-archived)** item in the referenced list.
- `required` cells non-empty; `DATE` cells valid; if effective-dating is used, no overlapping ranges for the same key.

**Import (Excel) — staged, never partial**
- Import into a **staging** area; run full validation; show a **dry-run report** of every failing row before anything commits.
- Commit is **all-or-nothing**. No silent partial writes.
- **Impact preview**: list which *unlocked* tenders/jobs reference the rows being changed, so the author sees blast radius before committing. (Locked tenders are unaffected — snapshot.)

**Referential (edit/delete)**
- Rows are **soft-deleted** (`isActive=false`), never hard-deleted, so snapshots and audit survive.
- Warn before changing/deactivating a rate that live (unlocked) work depends on.
- Because consumers reference `rowId`, renaming a KEY label is safe (no broken links) but still surfaces in the audit log.

---

## 5. Excel / Access + in-ERP grid (locked decisions)

- **In-ERP spreadsheet-style grid** to build/edit any rate table (feels like Excel), **plus Excel import/export** for bulk entry — the ERP is the source of truth. **Not** a live external Excel/Access link (no validation gate, no audit, breaks on moved files, concurrency risk).
- **Typed columns with roles** (KEY/VALUE/INFO), **not** freeform cells — this is what enables every validation rule above and reliable module matching.

---

## 6. Migration plan — phased, behind the seam (no big-bang)

| Phase | Scope | Risk control |
|---|---|---|
| **R0** | Add `RateTable`/`RateColumn`/`RateRow` models + the `resolveRate` seam + in-ERP grid + validation + Excel import/export. Resolver reads **legacy tables by default** via an adapter. | Purely additive; no consumer touched; nothing changes behaviourally. |
| **R1** | Route existing consumers (estimates, `scope-item-pricing`, waste, cutting) **through** `resolveRate` while it still reads the legacy tables. | Pure refactor; snapshot/parity tests prove identical pricing. |
| **R2…Rn** | Migrate **one** legacy rate table at a time into a `RateTable` (e.g. plant → labour → waste → cutting → core-hole → fuel → enclosure), flip the resolver's source for that rate only, verify pricing parity, then retire the legacy table. | One table per PR; parity-gated; reversible until the legacy table is dropped. |
| **R-sub** | Add the **Subcontractor/Supplier** rate category + `LIST_REF` columns; wire subcontractor-type grouping. | New surface, no legacy coupling. |
| **R-lists** | Tidy the Lists side: ensure the UI cleanly separates a **Lists** tab from a **Rates** tab; assess folding `LookupValue` into `GlobalList` if duplicative. | Low-risk; UI + optional data migration. |

Each phase is its own reviewed PR prompt, queued only when its predecessor has merged — the same discipline used for the tender/comms/procurement program.

---

## 7. Sanity / dedup ledger (do NOT rebuild)

- **Do NOT rebuild the Lists engine** — `GlobalList`/`GlobalListItem` already does push/pull dropdowns; extend it (add `LIST_REF` consumption from rates), don't replace it.
- **Do NOT rebuild snapshotting** — `TenderPricingSnapshot` + `ratesSnapshotAt` already freeze locked tenders; extend the payload, keep the mechanism.
- **Do NOT rip out the 8 rate tables up front** — they stay as the resolver's data source until each is migrated and parity-verified.
- Before any phase is queued, run the standard sweep (GitHub PRs/branches, `main`, `docs/pr-prompts/`) to confirm nothing overlaps — the estimates/rates area has had active work.

---

## 8. Risks & open items

- **Parity risk:** the flexible resolver must produce byte-identical pricing to the legacy tables during R1–Rn. Mitigation: golden-master/snapshot tests captured before R1, re-run after each migration.
- **Dynamic-key uniqueness:** enforced in the service (keys are data, not columns), so it needs solid tests — duplicate-key is the highest-value validation.
- **`LookupValue` vs `GlobalList`:** confirm whether `LookupValue` is still consumed anywhere before folding it in (assess in R-lists, not before).
- **Authorship access:** who besides Sean and Marco may create/edit rate tables — routes through the authority seam (see `project_authorization_config_layer`), config-open for now.
- **Effective-dating:** optional in the model; decide whether v1 needs time-boxed rates or just current values (recommend current-only for v1, dating later).

---

## 9. Recommended first move

Queue **R0 only** (models + resolver seam + grid + validation + Excel import, all additive, legacy still the data source). It unblocks everything else and changes zero existing behaviour, so it is the safest possible entry point. R1 (route consumers through the seam) follows once R0 merges.

---

## Appendix A — Lists: governing rule + approved set (audit 2026-07-06)

### Governing rule — descriptive-only
Make a value set a configurable **List** only when it is **purely descriptive reference data**: human-facing labels the system merely displays, stores, or filters on, where adding, renaming, reordering, or archiving an entry can never change how the software behaves. Keep it a **typed enum** when the values **drive behaviour** — workflow state machines, conditional logic, permissions, or calculations that code branches on; those are contracts, not vocabulary, and change only by deliberate migration. **Test:** "If someone renames or adds a value here, could a calculation, workflow, or code path break?" Yes → enum. No → List. **Rate lookup-keys are neither** — they live in the flexible rate tables (§3) so they stay in sync with the rates that consume them.

### Already Lists (keep) — seeded in `seed-reference.ts`
`measurement-units`, `materials`, `row-types`, `subcontractor-categories`, plus dynamic `equipment` and `plant` (assets-sourced).

### Approved new Lists to create (~14, deduped)
**Tendering / Estimating:** `saw-equipment` (Roadsaw, Demosaw, Ringsaw, Flush-cut, Tracksaw) · `saw-cutting-methods` (Fuel, Low-emission, High-Freq, Diamond blade, Concrete, Multi-blade) · `cutting-elevations` (Floor, Wall, Inverted) · `document-categories` (Tender Documents, Drawings, Specifications, BoQ, Sub/Supplier Quotes, Submissions, Correspondence, Compliance & WHS, Asbestos, Site Photos, Other) · `tender-note-types` (note, call, email, meeting, response).
**Directory / Subcontractors:** `business-types` (company, sole trader, partnership, trust, private person) · `entity-types` (subcontractor, supplier, both) · `prequalification-statuses` (approved, pending, suspended, rejected) · `compliance-document-types` (licence, insurance, qualification — consolidates 3 duplicate hardcoded copies).
**Workers / HR / Field Safety:** `leave-types` (annual, sick, personal, long service, unpaid, other) · `qualification-types` (14: white card, asbestos A/B, forklift, EWP, confined space, scaffolding, rigging, dogging, rigging supervisor, work at heights, hazmat, traffic control, safety watch) · `incident-types` (near miss, first aid, medical treatment, lost time, dangerous occurrence, property damage) · `hazard-types` (physical, chemical, biological, ergonomic, electrical, fire, environmental, other) · `risk-levels` (low, medium, high, extreme).

### Stay enums (drive logic — do NOT listify)
Workflow statuses: project, contract, tender, variation, claim; maintenance status, asset status, inspection result (PASS/FAIL). Form field types.

### Deferred / skipped
`core-diameters` → owned by the cutting **rate** table, not a standalone list. Skipped as low-value: `days-of-week`, `feedback-categories`, `archive-statuses`.

### List CRUD & governance (Marco 2026-07-06)
- **Create / edit lists and items** — open to users (permission `lists.manage`, config-open per [the authority seam]). Add, rename, reorder, archive items freely; this is the point of Lists.
- **Delete a whole list** — **restricted to Sean and Marco.** Routed through the authority seam (seeded to those two now, Director-configurable later — do not hardcode the names as a permanent check).
- **Warn-on-delete with usage** — before a list can be deleted, show exactly what still uses it: every module/dropdown bound to it, any records referencing its items, and any rate-table `LIST_REF` columns pointing at it. If it is in use, block the hard delete and steer to **archive** instead.
- **Prefer archive over hard-delete** — items already support `isArchived`; extend the same soft-delete to whole lists so historical references and tender snapshots never orphan. A true hard delete is only offered (to Sean/Marco) once usage is zero.

### List builder & management — JotForm-style tabs (Marco 2026-07-06)
A list opens as a simple table (its items) with **setting tabs inside the same list**:
- **Items** — the table builder (add/rename/reorder/archive items; value + label + optional metadata).
- **Linked to** — where-used + binding management (see registry below): every dropdown/column/field this list feeds, with add ("Link to a table or field") and remove ("Unlink"). This is also the delete-safety surface — deletion is blocked while bindings exist.
- **Merge** — fold another list into this one (see below).
- **Settings** — rename, slug, archive; **Delete** (restricted to Sean/Marco).

**Binding registry (the enabler for all three asks).** Add a `ListBinding` record: `listId` ↔ a consumer descriptor (`consumerType` = `RATE_COLUMN` | `FORM_FIELD` | `MODULE_DROPDOWN`, `consumerRef` = the column/field/dropdown id or slug, `label`). Bindings are explicit data, which is what powers where-used, add/remove-link, and safe merge. Converting the ~14 hardcoded dropdowns to list-bound also registers their bindings, so where-used is complete.

**Merge lists.** Merge B → A: (1) **union items** with a collision step (for values in both, choose keep-A or map-B-value→an-A-item); (2) **repoint every `ListBinding`** from B to A; (3) **remap stored record values** — because some records persist the item as free text, run a guided old-value → surviving-item map with a preview of affected records before commit; (4) **archive B**. Merge is destructive → **restricted to Sean/Marco**, all-or-nothing commit, fully previewed.

**Reference-by-id going forward.** New consumers should store the list **item id** (stable) rather than the label text, so future renames/merges are transparent and need no remap. Existing text-stored values are handled by the merge remap step until they age out.

---

## Appendix B — Approved enhancements (2026-07-06)

Fold these into the phase plan **after** the R0/R1 core (resolver seam + grid + validation + bindings) lands — they build on it, none block it.

### Rates
- **Subcontractor rate comparison.** A view that lines up the same KEY tuple (e.g. equipment/material/depth) across every subcontractor rate table of a type, plus the Initial Services rate, showing each price and the spread / cheapest. Estimator + procurement decision aid. Pure read over the flexible model.
- **Bulk uplift + versioning / effective dating.** One action to apply a % change to a whole table or a filtered set of rows (e.g. "+4% CPI, effective 1 July"), with a preview and an all-or-nothing commit. Backed by **rate-change history** (every value change keeps its prior value + effective date), so any past quote is reconstructable and future increases can be scheduled. Extends the optional effective-dating in §3.
- **Import a supplier's rate card.** Import a subcontractor/supplier's emailed price list straight into *their* rate table via the same staged→validated→commit Excel importer (§4), linked to the `SubcontractorSupplier` record. Closes the loop between the directory and rates.
- **Buy-vs-charge → a commercial dashboard data source (NOT a stored sell column).** Do **not** add a separate sell/charge column (it would double-count the section markup). Instead expose a **filterable rate dataset** — per row: cost (buy), applicable markup, computed sell + margin, category, subcontractor, unit, effective date, freshness — as a registered dashboard **data source** so Sean can build his own commercial widgets (margin by trade, cheapest sub, rate spread, stale rates). Rides the existing custom-widget / `DATA_SOURCES` framework. This is Sean's commercial-decision surface, built from data we already have rather than new data entry.

### Lists / cross-cutting
- **Cascading / dependent lists.** Formalise "this list's options depend on that selection" as configuration (generalising the existing `row-types`-by-discipline metadata and the waste group→type→facility cascade), replacing bespoke cascade code. A binding/list can declare a parent list + the metadata key it filters on.
- **Rich list-item attributes.** Let an item carry structured typed fields beyond value/label (using the existing `metadata Json`) — e.g. a waste-facility item holding address, EPA licence #, accepted waste types — so a dropdown can surface detail on select and those attributes can feed rates/reports.
- **Rate/line provenance ("explain this number").** From any tender/quote line, trace back to the exact rate table + row + version (+ snapshot at lock) it resolved from. Cheap given the resolver seam; big audit/trust win.
- **Rate freshness / review-due flags.** Flag rate rows (or whole tables) not reviewed in N months, surfaced in the Rates UI and as a dashboard metric, so quotes never run on stale prices. Fits the compliance posture; pairs naturally with the versioning history above.

---

## Appendix C — Commercial Margin Analysis (the "buy-vs-charge" capability)

**Not a list, not a stored field — a computed analytical capability.** It derives cost / charge / margin from data the system already holds and exposes it as filterable dashboard data. It never re-enters or duplicates a rate; it reads and computes. Sean's commercial-decision surface.

### Three lenses (all computed, all from existing data)
Tender-to-execution often drifts hard, so margin is reported at three reference points and the **deltas between them are first-class**:
1. **As-quoted** — from the tender's locked pricing snapshot (`TenderPricingSnapshot` / `ratesSnapshotAt`). What we bid/won at.
2. **Live** — the same scope re-priced at *today's* rates via the resolver. "Where would this land now."
3. **As-executed** — actual delivery cost from job actuals (`Project.actualCost`, contract variations, procurement once built, timesheets). What it really cost.

Cross-lens variances are the headline metric: **quoted → live** (rate movement since bid) and **quoted → as-executed** (delivery drift: variations, overruns, waste, productivity).

### Metrics (per line, rolled up)
buy (cost), applicable markup %, charge (sell), margin $, margin %, and the cross-lens deltas above. Roll-up levels: line → section (scope/waste/cutting) → tender/job → client → portfolio.

### Dimensions / filters
trade or discipline · subcontractor (and Initial-Services-vs-sub) · rate table · tender / job / client · section type · estimator / PM · period & effective date · lens (as-quoted / live / as-executed).

### Delivery
Registered as dashboard **data source(s)** in the existing custom-widget / `DATA_SOURCES` framework, so Sean builds his own widgets (margin by trade, quoted-vs-actual by job, subs undercutting in-house, lines under X% margin, margin-erosion leaderboard) rather than us hardcoding reports — consistent with the config-not-code line held throughout.

### Data availability (light up progressively)
Live (rates) and As-quoted (tender snapshots) are available **now**. As-executed sharpens as job-costing sources land — `Project.actualCost` exists today; contract variations partially; **procurement is net-new** (its own spec). Design the capability to accept all three lenses and simply show "actuals pending" where a source isn't wired yet.

### Guardrails
Read-only / derived — it must never write back to rates, tenders, or jobs. As-quoted always reads the frozen snapshot (never recomputed); Live always recomputes on read; As-executed reflects posted actuals only. Access scoped to commercial/Director via the authority seam (config-open).


---

<!-- ═══ sot/06 merged spec — source: docs/design/widget-candidates-catalogue.md ═══ -->

# Dashboard Widget Candidates — Catalogue

**Date:** 2026-07-03 · **Audience:** Marco (widget shopping list — pick what you want, effort is pre-estimated)
**Status:** Survey / analysis only. Nothing here is built. Read-only survey of the repo at this date.

How to read this document:

- **Section 1** — what's already on the shelf (don't ask for these, they exist).
- **Section 2** — what's already ordered (planned/held PR prompts — excluded from proposals).
- **Sections 3–7** — the new candidates, grouped by domain, best value-for-effort first within each table.
- **Section 8** — the Top 10 quick wins if you only pick a handful.

**Effort key:** **S** = just a new registry entry over an endpoint that already exists · **M** = also needs one thin new API read endpoint · **L** = needs real new aggregation logic or joins.

**Prod-data reality check (today):** production has tenders, jobs, compliance, maintenance, safety and forms data, but **zero Project and zero Contract rows** until the B-P0a shells deploy. Any widget marked "Projects/Contracts" will render an empty state in prod until then — that's flagged per row.

---

## 1. What already exists (42 registered widget types)

Registry: `apps/web/src/dashboards/widgetRegistry.ts` · components in `apps/web/src/dashboards/widgets/` · gallery logic `apps/web/src/dashboards/widgetGallery.ts`. Most widgets fetch existing list endpoints and aggregate client-side (`apps/web/src/dashboards/hooks.ts`); a few use dedicated dashboard endpoints (`/compliance/dashboard`, `/safety/dashboard`, `/projects-timeline`).

| Category | Existing widgets |
|---|---|
| Operations | Active jobs, Active projects, Timesheets pending, Tender pipeline value, Active contracts, Open issues, Upcoming maintenance, Jobs by status (donut), Tender pipeline by stage (donut), Monthly revenue (line), Form submissions by week (bar), Upcoming maintenance by asset (bar), Project timeline (bars over 90 days) |
| Tendering | Active pipeline, Submitted MTD, Win rate YTD, Avg lead time, Due this week, Follow-up queue, Win rate last 6 months, Pipeline by estimator, Recent wins, Win rate by client, Loss reasons |
| Jobs | Active jobs count, Completion rate, Open issues, Jobs by stage |
| Maintenance | Overdue maintenance, Upcoming maintenance (bar), Open breakdowns |
| Forms | Form submissions count, Submissions by template |
| Compliance | Expiring items, Expired items, Blocked subcontractors, Expiry alerts (full list), Compliance alerts (compact) |
| Safety | Open incidents, Open hazards, Overdue hazards, Recent incidents, Safety summary |
| Custom | Custom widget builder — user picks data source (Tenders / Jobs / Projects / Form submissions / Maintenance plans — `apps/web/src/dashboards/customWidget.ts`), metric, chart type |

> Rule of thumb: anything that is "count/donut/bar of tenders, jobs, maintenance plans or form submissions by status" can already be built **by you, today, with zero dev work** via the Custom widget. Candidates below deliberately avoid that overlap.

---

## 2. Coming already — do not re-request

| Item | Where it stands |
|---|---|
| **Widget gallery** (two-step add-widget picker with visual-kind rail, thumbnails, live preview, placement mode) | **Shipped** — PR #473 (`widgetGallery.ts` + `WidgetGalleryModal.tsx` are in main) |
| **Program (Gantt) snapshot widget** — compact read-only Gantt of active projects, next 4 weeks | **Held prompt**, `docs/pr-prompts/pr-dashboard-gantt-heatmap-widgets-HOLD.md` — gated behind #473 (now met) and dashboards-PR serialization |
| **Worker availability heatmap widget** — workers × next 14 days, free / partial / full | Same held prompt; respects the locked multi-role rule (one worker-day even with two roles) |
| Dashboard rename / copy-from | `docs/pr-prompts/pr-dashboard-rename-copyfrom-HOLD.md` — dashboard management, not a widget, but it holds the serialization lock |

---

## 3. Commercial

| # | Widget idea | Visual kind | Data source | Value note | Effort | Caveats |
|---|---|---|---|---|---|---|
| C1 | **Quotes drafted, not sent** — client quotes sitting in DRAFT, oldest first | KPI + mini-list | `ClientQuote.status` (schema.prisma:3047), `client-quotes` module; per-tender endpoints exist, needs one thin cross-tender "quotes by status" read | A drafted quote earning dust is money on the table — this makes the pile visible each morning | M | Prod has tender/quote data today. `client-quotes` is the sole owner of quote rows; the AI-proposal write bypass (ownership map §1) doesn't affect reads |
| C2 | **Credit applications in progress** — draft/submitted credit apps for clients and subbies, with age | mini-list | `CreditApplication.status` (schema.prisma:3309), `directory` module — needs thin "open credit apps" endpoint | New client can't be invoiced and new subbie can't be engaged until credit is sorted — this shows what's stuck | M | Directory data exists in prod. Single writer (directory) — clean |
| C3 | **Correspondence awaiting reply** — threads where the last message is inbound and older than N days | mini-list | `CorrespondenceThread.lastMessageAt` (schema.prisma:3790), `correspondence` module; endpoint is per-owner (`GET correspondence/:ownerKind/:ownerId`) — needs a thin "stale threads" aggregate | Unanswered client email on a live tender is how work is lost quietly | M | Thread owner is polymorphic client/tender/**job** — B-P0a will re-point job threads to Project; build against the ownerKind abstraction, not the Job FK |
| C4 | **Tender clarifications outstanding** — open clarification questions on live tenders | KPI + mini-list | `TenderClarification` (schema.prisma:838) + `TenderClarificationNote`, `tender-clarifications` module list endpoints | Unanswered clarifications block pricing; estimators forget them under deadline | M | Two modules write clarification notes (ownership map §1 — merge slice OWN-5 pending). Read-only widget is safe either way |
| C5 | **Progress claims this month** — claims due/submitted/paid for the current claim month | mini-table | `ProgressClaim.claimMonth/status/totalClaimed` (schema.prisma:2985 area), `contracts` module (14 endpoints incl. claim lifecycle, contracts.controller.ts) | Miss a claim cut-off, wait a month to be paid — the classic construction cash-flow wound | S–M | **Empty in prod until B-P0a contract shells deploy** (zero Contract rows — ownership map §4.2). Build after shells land |
| C6 | **Variations awaiting client approval** — priced/submitted variations and their $ value | KPI + mini-list | `Variation.status/pricedAmount` (schema.prisma:2935), `contracts` module | Unapproved variation work done anyway = free work | S–M | Same empty-until-B-P0a caveat. Also note `JobVariation` (schema.prisma:1058) duplicates `Variation` — B-P0a-6 merges them; build on `Variation` only |
| C7 | **Supplier credit exposure** — current balance vs credit limit per supplier, nearest-to-limit first | bar / mini-table | `SupplierCreditEntry` + `SubcontractorSupplier.creditLimit` (schema.prisma:3344, 3191), `directory` module — needs a balance rollup | Stops a supplier account blowing its limit mid-job | L | Balance must be summed from the entry ledger (comment at schema.prisma:3337) — genuine new aggregation |

Not proposed (already covered): pipeline value/stage, win rates, monthly revenue, follow-ups, recent wins, loss reasons — all exist (§1). "Win rate by client" reads the stored `Client` counters that have a live 4-writer conflict (ownership map §1, resolution OWN-3) — an existing-widget data-quality caveat worth knowing, not a new build.

---

## 4. Delivery

| # | Widget idea | Visual kind | Data source | Value note | Effort | Caveats |
|---|---|---|---|---|---|---|
| D1 | **Milestones due / overdue** — project milestones planned in the next 14 days or past-due without an actual date | mini-list | `ProjectMilestone.plannedDate/actualDate/status` (schema.prisma:2035), `projects` module — thin "upcoming milestones" endpoint | The morning "what's landing this fortnight" board every ops meeting starts with | M | **Empty in prod until B-P0a** (zero Project rows). Projects is the surviving spine — safe to build on |
| D2 | **Quiet jobs** — active jobs with no activity/progress entry in N days | mini-list | `JobActivity` (schema.prisma:1014) / `JobProgressEntry` (:1078), `jobs` module — needs a "last activity per job" aggregate | A silent job is usually a stalled job; surfaces problems before the client rings | L | Jobs data exists in prod today. `JobActivity` moves to Project under B-P0a-5 — build query behind a service method so re-pointing is one change. Note `platform` also mutates JobActivity (ownership map §1 — ambiguous, read-only here is fine) |
| D3 | **Closeout laggards** — jobs marked COMPLETE whose closeout checklist isn't done | KPI + mini-list | `JobCloseout` (schema.prisma:1112) vs `Job.status`, `jobs` module | Warranty docs, final claims and handover packs slip exactly here | M | Jobs data in prod. Whole Job cluster folds into Project (B-P0a) — same service-method insulation as D2 |
| D4 | **Documents added this week** — latest files linked across tenders/jobs | mini-list | `DocumentLink.createdAt` (schema.prisma:276), `documents`/`platform` modules | Quick "what paperwork moved" scan without opening every job | M | DocumentLink is a platform primitive with raw-prisma writes from jobs/tender-documents pending refactor OWN-6 — reads unaffected |
| D5 | **Portal invites pending** — client portal invites sent but not accepted | KPI | `PortalInvite` (schema.prisma:3599), `portal` module | Tells you which clients never actually got into their portal | M | Portal module has zero API tests (ownership map §5.3) — pair the endpoint with its first test |

Not proposed: project timeline (exists), Gantt snapshot (planned, §2), jobs by status/stage (exist + custom builder), open issues (exists). Scheduling-conflict widgets over the `Shift` cluster are deliberately excluded — that cluster is frozen for retirement (ownership map §1, B-P0a-9).

---

## 5. Workforce & Plant

| # | Widget idea | Visual kind | Data source | Value note | Effort | Caveats |
|---|---|---|---|---|---|---|
| W1 | **Who's away this week** — approved leave + unavailability windows touching the next 7 days | mini-list | `WorkerLeave` / `WorkerUnavailability` (schema.prisma:3504, 3526); **endpoints exist**: `GET /workers/leaves`, `GET /workers/unavailability` (workers/availability.controller.ts:64, 139) | First question every Monday scheduling conversation: who have we actually got? | S | Single writer (`workers`), WorkerProfile is canonical (B-P0b) — clean |
| W2 | **Leave requests pending approval** — PENDING leave, oldest first | KPI + mini-list | Same source, filter `status=PENDING` on the existing endpoint | Unactioned leave requests poison rosters silently | S | As W1 |
| W3 | **Hours by project this week** — approved timesheet hours split by project | bar | **Endpoint exists**: `GET /field/timesheets/summary` — "total approved hours, counts by status, byWorker/byProject breakdowns, oldest pending date" (field.controller.ts:159) | Where the labour actually went vs where you thought it went | S | Requires `field.manage` permission — widget hides for workers without it. byProject keys off Project — thin in prod until B-P0a data volume grows |
| W4 | **Assets by status** — donut of AVAILABLE / IN_USE / DOWN etc. | donut | `Asset.status` (schema.prisma:672, indexed), `assets` module list endpoint | One glance: how much plant is actually workable today | S | Asset has two CRUD paths (assets vs master-data — ownership map CONFLICT, fix OWN-4 pending). Read-only widget unaffected, but note counts could shift if the dup path writes odd statuses |
| W5 | **Failed / overdue inspections** — asset inspections with status FAIL in last 30 days | mini-list | `AssetInspection.status/inspectedAt` (schema.prisma:1288), `assets` module — thin filtered endpoint | A failed inspection that nobody chased is tomorrow's breakdown (or WHS incident) | M | Maintenance data exists in prod. No overdue-schedule concept on inspections — "overdue" needs the maintenance plan join (that half is L) |
| W6 | **Free workers today** — count of workers with no schedule allocation today | KPI | `ScheduleAllocation` (schema.prisma:2152) vs `WorkerProfile`, `scheduler` module — availability-report endpoint exists (`GET /scheduler/availability-report`, availability-report.controller.ts:31) | The number behind "can we take that call-out job?" | S–M | Largely a KPI-sized sibling of the **planned availability heatmap** (§2) — build it in that PR or skip. Must respect the locked multi-role day rule. Dual allocation models until B-P0c (ownership map §2.3): count from ScheduleAllocation only |
| W7 | **Timesheet chasers** — workers allocated yesterday with no submitted timesheet | mini-list | Join `ScheduleAllocation`/`ProjectAllocation` vs `Timesheet` (schema.prisma:2281), `field` + `scheduler` modules | Ends the Friday payroll scramble | L | The join spans the two-allocation-model interim state (B-P0c) — timesheets FK to ProjectAllocation, roster truth is ScheduleAllocation. Recommend **waiting for B-P0c** or accepting range-grain accuracy |
| W8 | **Upcoming public holidays** — next QLD holidays in the roster window | mini-list | `PublicHoliday` (schema.prisma:3906), `public-holidays` module endpoints | Stops scheduling a crew onto Ekka Wednesday | S | Tiny but genuinely used; data is reference data, always present |

Not proposed: worker qualification expiries — **already covered** by the Compliance expiring/expired/expiry-list widgets, which include worker qualifications alongside licences and insurance (`apps/web/src/dashboards/widgets/compliance.tsx`, `/compliance/dashboard`).

---

## 6. HSEQ

| # | Widget idea | Visual kind | Data source | Value note | Effort | Caveats |
|---|---|---|---|---|---|---|
| H1 | **Days since last incident** — the classic site-board counter, optionally split by severity | KPI (number + trend) | `SafetyIncident.occurredAt` via existing `GET /safety/incidents?limit=…&sort=-occurredAt` (already used by the Recent-incidents widget) | The single most glanced-at safety number in construction; costs almost nothing | S | Safety data exists in prod. Decide the reset rule (all incidents vs recordable-severity only) before build |
| H2 | **Pre-starts today** — completed vs expected pre-start checklists across today's allocations | progress ring | `PreStartChecklist.status/date` (schema.prisma:2232, indexed on status and projectId+date), `field` module (`GET /field/pre-starts`) — thin "today across all projects" aggregate | Direct WHS compliance pulse: who started work without a signed pre-start? | M | "Expected" = allocations for today — touches the dual allocation model (B-P0c); counting submitted pre-starts alone is M, the expected denominator is the hard half |
| H3 | **Fit-for-work exceptions** — submitted pre-starts where fit-for-work was NOT declared, or hazards were flagged | mini-list | `PreStartChecklist.fitForWork/hazardNotes` (schema.prisma:2273 area), `field` module | The one pre-start answer that must never be skimmed past | M | Same source as H2 — build together. Sensitive data: respect existing field permissions on the endpoint |
| H4 | **Form approvals waiting** — pending approval steps, with due date and assignee | KPI + mini-list | `FormApproval.status="pending"/dueAt` (schema.prisma:1486, status indexed), `forms` module — thin "pending approvals" endpoint | Forms people filled in are stuck waiting on a signature; this names the bottleneck | M | Forms data exists in prod. Single writer — clean |
| H5 | **Scheduled forms due** — form schedules whose nextRunAt falls in the coming week | mini-list | `FormSchedule.nextRunAt` (schema.prisma:1519, indexed), `forms` module | Recurring inspections/toolbox talks stop relying on someone's memory | M | `FormSchedule` currently has **zero web UI at all** (ownership map §5.2) — this widget would be its first surface; sanity-check prod rows exist before building |
| H6 | **Forms → records conversion** — count of incidents/hazards/breakdowns auto-created from form submissions this month | KPI | `FormTriggeredRecord.recordType/createdAt` (schema.prisma:1506), `forms` module | Shows the field-reporting pipeline is actually alive (Marco's favourite audit evidence) | M | Trigger-create is the documented SBD pattern (ownership map §2.4) — read-only, clean |

Not proposed: open incidents/hazards/overdue hazards/recent incidents/safety summary, compliance expiring/expired/blocked-subbies/expiry list — all exist (§1).

---

## 7. Platform / Admin

| # | Widget idea | Visual kind | Data source | Value note | Effort | Caveats |
|---|---|---|---|---|---|---|
| P1 | **Xero sync health** — connection status + last sync result/time | KPI (status badge) | **Endpoints exist**: `GET /xero/status`, `GET /xero/sync-logs` (xero.controller.ts:85, 136) | "Is accounting data current?" answered without asking IT | S | Xero writes back to Client rows (part of the 4-writer conflict, OWN-3) — status read itself is clean |
| P2 | **Recent activity** — latest audit-log entries (who did what) | mini-list | **Endpoint exists**: `GET /audit-logs` (audit.controller.ts:31), `AuditLog` (schema.prisma:209, append-only SBD) | Lightweight "what happened overnight" feed for admins | S | Admin-permission gated; keep row count small |
| P3 | **Pilot feedback open** — unresolved feedback items from pilot users | KPI + mini-list | `PilotFeedback` (schema.prisma:3885), `pilot-feedback` module endpoints | Keeps the pilot punch-list in front of whoever owns it | S–M | Only valuable during the pilot phase — mark as retirable |
| P4 | **Active users this week** — distinct users acting in the last 7 days | KPI | `AuditLog.userId/createdAt` aggregate, `audit` module | Adoption pulse for the rollout — is the team actually using the system? | M | Approximate (only audited actions count); good enough for a pulse |

---

## 8. Top 10 quick wins

Ranked by glance-value ÷ effort, restricted to S/M where **prod has data today** (tenders, jobs, compliance, maintenance, safety, forms, workers/field — not Projects/Contracts):

1. **Days since last incident** (H1, S) — biggest bang of the whole list; data + endpoint already there.
2. **Who's away this week** (W1, S) — `GET /workers/leaves` exists; registry entry + rendering only.
3. **Leave requests pending approval** (W2, S) — same endpoint, one filter.
4. **Hours by project this week** (W3, S) — `/field/timesheets/summary` already returns exactly this shape.
5. **Assets by status donut** (W4, S) — indexed status field, list endpoint exists.
6. **Xero sync health** (P1, S) — `/xero/status` exists; one badge widget.
7. **Form approvals waiting** (H4, M) — one thin endpoint over an indexed status column; unblocks real bottlenecks.
8. **Quotes drafted, not sent** (C1, M) — direct money-on-the-table visibility.
9. **Pre-starts today + fit-for-work exceptions** (H2+H3, M as a pair) — Marco's own WHS morning check; ship the submitted-count version first, add the expected denominator after B-P0c.
10. **Recent activity feed** (P2, S) — audit endpoint exists; cheap admin comfort.

**Hold for B-P0a/B-P0c (good ideas, wrong week):** Progress claims this month (C5) and Variations awaiting approval (C6) — zero Contract rows in prod until the shells deploy; Milestones due (D1) — zero Projects; Timesheet chasers (W7) and the full pre-start denominator — both straddle the dual allocation model that B-P0c collapses.

**Surprises found during the survey** (for whoever builds next):

- `/field/timesheets/summary` is a ready-made widget backend (byWorker, byProject, status counts, oldest pending) that nothing on the dashboard uses yet.
- `FormSchedule`, `TenderScopeRevision`, `EstimateExport` and `WorkerLocationLog` have **no web surface at all** (ownership map §5.2) — FormSchedule is the only one of those worth a widget.
- The existing **Win rate by client** widget reads the stored `Client` counters that are the documented 4-writer conflict (ownership map §1/OWN-3) — its numbers can silently drift until OWN-3 lands.
- The Custom widget builder already covers a lot of "count-by-status" asks for tenders/jobs/projects/forms/maintenance — the cheapest "new widget" is sometimes adding a **new data source key** to `customWidget.ts` (e.g. assets, leave) rather than a bespoke widget.

---

## Market benchchmark — what similar systems do (researched 2026-07-03)

Quick scan of how six comparable construction / field-ops platforms do dashboards and widgets, to sanity-check the catalogue above. Sources are the vendors' own help docs where possible.

### What the market does

| System | Notable widget types | Builder / customisation UX | Worth stealing |
|---|---|---|---|
| **Procore** | Project Home page acts as a per-project dashboard: weather forecast for the site address, Open Items, Recent Activity, today's Schedule, Milestones ([Project Home](https://support.procore.com/products/online/user-guide/project-level/home/tutorials/about-the-project-home-page), [weather widget](https://v2.support.procore.com/product-manuals/home-project/tutorials/view-project-weather-on-the-home-page)). Company side: 100+ prebuilt Analytics dashboards, custom "360 Reporting" visuals combined from multiple datasets ([Procore Analytics](https://support.procore.com/integrations/procore-analytics)) | Prebuilt report/dashboard library first, custom visuals second. Weather is a simple show/hide toggle per project | The **per-project "home page" convention** — one auto-built dashboard per project, not just company-wide boards. And site weather |
| **Buildertrend** | Mobile Summary screen widgets; Daily Logs feed with **auto-attached weather** (pulled from Aeris by the job's postcode, auto-updates per date) and site photos ([Daily Logs](https://helpcenter.buildertrend.net/en/articles/3525591-daily-logs)) | Widgets on a fixed summary screen; daily-log templates you pre-structure | Weather stamped onto site records automatically, and a **recent-photos feed** as a first-class dashboard element |
| **Simpro** (closest peer — AU trades/field ops) | BI Reporting dashboards = collections of saved "questions" (charts) ([managing dashboards](https://helpguide.simprogroup.com/Content/Service-and-Enterprise/Dashboards-BI-Reporting.htm)) | Drag-and-resize cards; **preset dashboards by function** (Operations, Quality Assurance, Sales) as starting points; **dashboard subscriptions** — scheduled email delivery of a dashboard to a list of people; guidance to keep ≤10 cards per dashboard for load time | Preset per-function dashboards + **email subscriptions** — both directly copyable |
| **monday.com** | 50+ widgets: Battery (completion breakdown), Workload (per-person load vs capacity), Gantt, Numbers, Calendar, Time-tracking ([dashboards support](https://support.monday.com/hc/en-us/sections/360000754119-Dashboards), [Gantt widget](https://support.monday.com/hc/en-us/articles/360015643840-The-Gantt-Chart-View-and-Widget)) | Everything is a widget over one or more boards; add/drag/resize | The **Workload widget** (per-person bar vs capacity) — our planned availability heatmap covers most of this; the "Battery" completion bar is a nice compact visual kind |
| **Smartsheet** | Metric (single cell), Chart, Report, **Rich text / Title** (annotation), **Image**, **Web-content embed** (external URLs, forms, videos), Timeline; AI chart widget builds a chart from a natural-language ask ([widget types](https://help.smartsheet.com/articles/518558-widget-types-for-smartsheet-dashboards)) | Two-tier sharing: dashboard **Viewers see the dashboard without needing access to the underlying sheets** ([sharing](https://help.smartsheet.com/articles/2482496-sharing-and-widgets-in-the-pro-plan)) | Static text/title/image widgets (dashboards that explain themselves) and the embed widget |
| **Jobber / ServiceM8** (field services) | Home dashboard = workflow funnel: jobs and $ value **sitting at each stage**, plus "recommended actions" nudges ([Jobber dashboard](https://www.getjobber.com/features/dashboard/)); ServiceM8 ships fixed KPI reports (jobs completed, revenue, top clients, feedback) ([ServiceM8 reports](https://support.servicem8.com/questions/jobs/does-servicem8-provide-kpi-dashboards-or-business-performance-reports)) | Mostly fixed, opinionated dashboards rather than builders | The **"$ value stuck at each workflow stage" funnel** framing, and action nudges attached to numbers |

Power BI construction templates confirm the genre conventions: days-without-incident, RFI/submittal aging, subcontractor scorecards (response times, punch-list items), and executive roll-ups across jobs ([example](https://sitemate.com/resources/articles/commercial/power-bi-construction-project-dashboard/), [example](https://www.alphabold.com/power-bi-for-construction-management-consolidate-project-analytics-reporting/)). Our catalogue already covers days-since-incident (H1) and most aging lists; the gaps are below.

### Ideas our catalogue missed

- **Site weather widget** — today + next few days for each active job/project site (Procore and Buildertrend both treat this as table stakes). *Feasibility:* no weather data in our model; needs a free external API (e.g. Open-Meteo/BOM) keyed off the Site/Job address or postcode — Sites exist in master data, so it's a new small integration, not a schema change. Effort L (first external-API widget), but zero DB work.
- **Recent site photos feed** — latest photos across active jobs, Buildertrend-style. *Feasibility:* we have `DocumentLink` rows (§4 D4); filter to image mime types and render thumbnails instead of a filename list. Effectively D4 with pictures — M.
- **"My day" personal widget** — the logged-in user's own allocations today, pending approvals, forms due (Procore Home's "today's schedule" idea, made personal). *Feasibility:* all reads exist per-module (`ScheduleAllocation`, `FormApproval`, pre-starts); the new bit is filtering by the current user and composing one card — M, respects the same B-P0c allocation caveats as W6/H2.
- **Static text / heading / image widgets** — Smartsheet-style annotation widgets so a dashboard can carry instructions ("ring Marco if this is red"), section headings, or a logo. *Feasibility:* no data source at all — config-only registry entries. S, and cheap polish for shared dashboards.
- **Embed widget** — a card that frames an external URL (a SharePoint page, a Power BI report). *Feasibility:* S–M technically (config + iframe), but needs an allow-list of domains for safety; worth holding until a real use case shows up.
- **Workflow-stage $ funnel** — Jobber's "how much money is sitting at each stage" across tender → job → claim. *Feasibility:* tender-stage $ exists today (pipeline widgets); the full funnel needs Contract/claim rows, so post-B-P0a. L.
- **Subcontractor scorecard** — per-subbie compliance status + response/turnaround stats (Power BI template convention). *Feasibility:* compliance half exists (blocked-subbies widget); turnaround stats need new aggregation over correspondence/documents — L, park it.

### UX patterns worth adopting

- **Role-based default dashboards** — Simpro ships preset Operations/QA/Sales dashboards; Procore ships 100+ prebuilt. We already have dashboards + a gallery: seed one default layout per role (ops, estimator, WHS, admin) so new users never start from a blank board. S–M, seed/config work only.
- **Scheduled email digest of a dashboard** — Simpro's "dashboard subscriptions" email a dashboard snapshot on a schedule. We have the Azure mail plumbing (`AZURE_MAIL_*`); needs a scheduled job + a server-rendered summary (numbers as text/table beats trying to screenshot charts). M–L, genuinely high value for the Monday-morning crowd.
- **Shareable dashboards with view-only access** — Smartsheet viewers see a dashboard without access to underlying sheets. For us the layout-sharing half is easy (dashboards are already stored per user); the hard half is that our widgets call permission-gated endpoints, so a viewer without `field.manage` etc. would see holes. Adopt as "share layout, data still respects permissions" — M — and skip Smartsheet's bypass semantics.
- **Keep-it-small guidance** — Simpro's "≤10 cards per dashboard" performance advice is worth writing into our dashboard help text verbatim. Free.
- *(Later, if the custom builder grows)* **Natural-language chart builder** — Smartsheet's AI chart widget is the upmarket version of our custom widget. Not now; noted so nobody thinks it's novel.


---

<!-- ═══ sot/06 merged spec — source: docs/Designs/scope-of-works-redesign.md ═══ -->

\# Scope of Works + Quote Arrangement — Design



\*\*Status:\*\* approved 2026-05-16, MVP (PRs A1-B3) targets next-week Sean+Raj demo; full arrangement screen (PRs C1-D1) ships post-demo.

\*\*Authority:\*\* Marco (MAIN, 2026-05-16). Decisions captured in this doc are canonical — code conforms to this, not to legacy patterns.

\*\*Predecessor PRs:\*\* Scope of Works module shipped with fixed SO/Str/Asb/Civ/Prv discipline cards (Phase 1 — PR chain pre-#80). Tendering persona system prompts (PR #142, #148, #149, #152, #161) referenced those discipline codes throughout.



\---



\## TL;DR



Replace the fixed 5-discipline scope-of-works layout (SO/Str/Asb/Civ/Prv cards) with user-named scope cards (tabbed UI), each containing a flexible scope-items table plus per-card concrete cutting and waste summary subtables. Add a separate Quote Arrangement screen (post-demo) that lets the user rearrange items into client-facing groupings without modifying the underlying Calculation Sheet. Simplify disciplines from 5 codes to 4 (DEM/CIV/ASB/Other).



\---



\## Motivation



\*\*Current state (pre-redesign):\*\*

\- Scope of Works tab has 5 hard-coded discipline cards (SO/Str/Asb/Civ/Prv). User can't add, remove, rename, or restructure them.

\- All concrete cutting work lives in one global table on the tender, not scoped to specific scope items.

\- All waste lives in a similar global table.

\- Quote PDF generation is tightly coupled to the discipline structure — high-level summarising and per-client customisation are limited.



\*\*Problems Raj and Sean have surfaced:\*\*

1\. Real tenders don't fit cleanly into 5 disciplines. Estimators want to group work the way they think about it (e.g., "Level 1 strip-outs", "Block A demolition", "External works").

2\. Concrete cutting belongs WITH the scope item it serves, not as a global afterthought.

3\. Different clients should be able to receive the same scope as different quote presentations — one client gets a high-level total, another gets full line-item detail.

4\. The fixed discipline labels (SO/Str — strip-outs vs structural) don't match how IS actually thinks about work. Demolition is the umbrella; provisional/cost-options/adjustments don't deserve their own discipline.



\*\*This redesign addresses all four.\*\*



\---



\## Architecture overview



Two layers, cleanly separated:



```

┌─────────────────────────────────────────────────────────────────┐

│ Layer 1: Calculation Sheet (Scope of Works tab)                 │

│ Source of truth. One per tender. Shared across all clients.     │

│                                                                  │

│ Cards (user-named, tabbed) ─┬─ Scope items table                │

│                             ├─ Concrete cutting subtable        │

│                             └─ Waste summary subtable           │

└─────────────────────────────────────────────────────────────────┘

&#x20;                             │

&#x20;                             ▼ (read-only feed)

┌─────────────────────────────────────────────────────────────────┐

│ Layer 2: Quote Arrangement (per quote, per client)              │

│ Presentation layer. Multiple per tender (one per client/rev).   │

│ Drag/drop/group/hide/rename, autosaves.                         │

│ Renames push back to Layer 1 via explicit button only.          │

└─────────────────────────────────────────────────────────────────┘

&#x20;                             │

&#x20;                             ▼ (render)

┌─────────────────────────────────────────────────────────────────┐

│ Layer 3: Quote PDF (per quote arrangement)                      │

│ Reflects arrangement state at PDF generation time.              │

└─────────────────────────────────────────────────────────────────┘

```



\*\*Key invariant:\*\* The Calculation Sheet is shared. Each client's quote arrangement is independent and never affects the Calculation Sheet except through the explicit "Change Quote details" button (renames only).



\---



\## Disciplines



\*\*Old (5):\*\* SO (Strip-outs), Str (Structural), Asb (Asbestos), Civ (Civil), Prv (Provisional)



\*\*New (4):\*\* DEM (Demolition), CIV (Civil), ASB (Asbestos), Other



\*\*Migration mapping:\*\*



| Old | New |

|---|---|

| SO  | DEM |

| Str | DEM |

| Asb | ASB |

| Civ | CIV |

| Prv | Other |



Both Strip-outs and Structural collapse into Demolition (DEM). Other catches Provisional, cost options, adjustments, and anything that doesn't fit DEM/CIV/ASB.



\*\*System-wide implications:\*\*

\- Database enum migration with data remap

\- All persona system prompts that reference IS scope codes (`apps/api/src/modules/personas/definitions/tendering.persona.ts`, `apps/api/src/modules/personas/definitions/shared-prompts.ts`, `apps/api/src/modules/tendering/tender-scope-drafting.service.ts`) need updating to use the new 4-code system

\- Tender reports / dashboards that filter by discipline get new options

\- Seed data needs new codes

\- Existing tender records get their discipline tags remapped via migration



\---



\## Calculation Sheet (Scope of Works tab) — detailed design



\### Cards as tabs



Cards render as a horizontal tab strip across the top of the Scope of Works content area.



\*\*Tab content (per card):\*\*

\- Drag handle (left) — drag to reorder

\- Card name (editable — double-click to rename inline)

\- Discipline badge (DEM/CIV/ASB/Other — colour-coded)

\- Card `$` total (auto-calculated)

\- Delete `×` (with confirmation)



\*\*Tab behaviour:\*\*

\- Click tab → switch active card

\- Double-click tab name → rename inline

\- Drag tab → reorder (within the Calculation Sheet — this is entry order)

\- `×` → delete card with confirmation

\- Horizontal scroll when tabs overflow



\*\*Active tab visual:\*\* underline + darker text (matches the existing Overview/Scope of Works/Quote tab styling).



\*\*`+ Add new scope item`\*\* button stays in the page section header (top-right), not in the tab strip. It creates a new card and switches focus to it.



\*\*Discipline badge colours (proposal):\*\*

\- DEM — neutral grey

\- CIV — neutral grey

\- ASB — warning amber (asbestos is high-attention work — visual flag matches existing convention)

\- Other — neutral grey



\### Active card body — three always-visible subtables



When a tab is active, the card body renders three subtables stacked vertically:



1\. \*\*Scope items table\*\* (top)

2\. \*\*Concrete cutting subtable\*\* (middle — Cutting / Coring / Other tabs preserved)

3\. \*\*Waste summary subtable\*\* (bottom)



All three are \*\*always visible\*\*. New cards show all three with their column headers and an `+ Add row` button — no opt-in click required. Empty subtables just show their headers + the add-row button.



Rationale: simpler UX (always-predictable layout), removes a click, makes the structure self-documenting.



\### Scope items table — columns



| Column | Type | Notes |

|---|---|---|

| Description | text | Free text describing the line item |

| Men | number | Number of workers |

| Days | number | Number of days |

| Plant 1 | dropdown | From IS plant list. `+` button beside header adds Plant 2, Plant 3, etc. (whole-table columns). `×` button removes the column. |

| Waste group | dropdown | From existing waste groups table |

| Waste item | dropdown | From existing waste items table (filtered by waste group) |

| Unit | dropdown | m², m³, t, ea — for waste calc only |

| Value | number | Quantity in the chosen unit |

| Waste? | checkbox | Per-row. When ticked, this row contributes to the auto-generated waste summary below. |

| Notes | text | Free-text per-row notes |

| Delete | button | Per-row delete |



`+ Add row` button is always visible at the bottom of the table as the last row, adds a blank row to the table.



\*\*Plant column expansion:\*\* clicking `+ Plant` on the column header adds a new Plant N column visible on all rows in the table. Existing rows get a blank dropdown for the new column. Empty cells in Plant 2+ are acceptable (no auto-collapse). User can remove a Plant column via `×` on its header.



\*\*Unit column:\*\* drives the waste summary calculation only. Doesn't affect the card's $ total (which comes from the rate engine via Men/Days/Plant). Possible units: m², m³, t, ea. Tonnage and m³ are most useful since tips charge by either. Smaller list keeps the dropdown focused.



\### Concrete cutting subtable



Same structure as today's global concrete cutting table, but scoped per-card.



\- Three tabs: Cutting / Coring / Other

\- Existing row structure preserved (equipment, elevation, material, depth, length, etc.)

\- `+ Add row` button always visible as the last row of each tab

\- The card's $ total includes all cutting line costs



\### Waste summary subtable



Two row sources:



1\. \*\*Auto-generated rows\*\* (badge: `auto`):

&#x20;  - One row per (waste group + waste item) combination present in the scope items table where the `Waste?` checkbox is ticked

&#x20;  - Calculates tonnage and m³ from the Unit column values, aggregating duplicates

&#x20;  - Refreshes when underlying scope rows change

&#x20;  - User can edit auto-generated rows (overrides the calculation for that row — flag remains visible but the value is now user-driven)



2\. \*\*Manual rows\*\* (badge: `manual`):

&#x20;  - User-added via `+ Add manual row` button

&#x20;  - For waste that doesn't tie to a specific scope item (e.g., dust + debris from the work itself)



\*\*Columns:\*\*

\- Waste group (dropdown from existing waste groups)

\- Waste item (dropdown from existing waste items, filtered by group)

\- Tonnage (number)

\- m³ (number)

\- Source (`auto` or `manual` badge)

\- Delete (button)



`+ Add manual row` button always visible at the bottom.



\### Card $ total



Auto-calculated, displayed top-right of active card and on each tab.



Calculation = sum of all costs across all subtables (scope items + concrete cutting + waste summary), using the existing rate engine. Calculated at input time (rates fetched live as fields change).



A line with 0 Men, 0 Days, 0 Plant, 0 cutting still counts toward the total if it has waste with a tip cost. Empty rows contribute $0.



\### System-generated IDs



Every line item across every subtable (scope items, cutting, coring, other-cutting, waste-auto, waste-manual) gets a system-generated UUID at creation time. UUIDs are:



\- Persistent — survive page reload, scope edits, anything except explicit row delete

\- Referenced by the Quote Arrangement layer to track which item is which

\- Never displayed to the user (internal only)

\- Used by the database as the primary key of the line-item record



Necessary for the arrangement screen to maintain stable references across reloads.



\---



\## Quote Arrangement (post-MVP)



\*\*Not in the demo MVP. Post-demo.\*\* Sketched here so PRs A1-B3 don't accidentally close off design space we need later.



\### Trigger



User opens the Quote tab. At the top: a Client selector dropdown (Option A). Below it: a quote selector (per-client quotes with revisions). Selecting a quote opens its arrangement.



\### Arrangement screen layout



Pivot-style table populated by reading the current Calculation Sheet via the system-generated UUIDs. Renders as a hierarchical list of headers and rows.



\*\*Initial state (first open or after "Reset to original"):\*\*

\- One header per Calculation Sheet card, in the same order

\- All headers expanded showing all their line items

\- All items visible (none hidden)



\*\*User actions:\*\*



| Action | Scope |

|---|---|

| Click header collapse/expand chevron | Header level — show name+total only vs. name+total+all lines |

| Click line collapse/expand | Line level — within an expanded header, can collapse individual lines |

| Drag handle on header | Reorder headers |

| Drag handle on line | Move line to a different header, or reorder within current header |

| `+ New header` button | Creates a new presentation-only header (default discipline: Other). User can drag lines into it. Does NOT create a new Calculation Sheet card. |

| Rename header inline | Renames presentation-only OR (if it maps to a Calc Sheet card) marks the rename as "pending push back to Calc Sheet" |

| Rename line description inline | Same as header rename — pending push back |

| `×` (hide) on header | Excludes from quote PDF entirely. Card $ total excludes hidden lines (P6: hide = exclude from totals). |

| `×` (hide) on line | Same as above, line-level. |

| Delete line | Hides from THIS arrangement only. Calculation Sheet is unaffected. The line can be restored via "Reset to original". |



\### Buttons at the bottom



| Button | Behaviour |

|---|---|

| \*\*Autosave indicator\*\* | Visible status — saved/unsaved/saving |

| \*\*Reset to original\*\* | Wipes arrangement, regenerates from current Calculation Sheet state. All renames, regroupings, hides discarded. Confirmation required. |

| \*\*Change Quote details\*\* | Pushes the rename changes (and ONLY renames) back to the Calculation Sheet. Updates the card names and line descriptions on the underlying scope cards. Order, grouping, hide, new-header decisions stay on this arrangement only. |

| \*\*Generate PDF\*\* | Renders the PDF using the current arrangement state. |



\### Per-client / per-quote arrangement



The arrangement is \*\*per quote\*\*, not per tender. Each client has their own quote(s) for the same tender. Each quote has its own arrangement state.



Example:

\- Tender T260512-BRIS-Rev1 has Calculation Sheet with 4 cards (DEM/DEM/ASB/Other)

\- Client A receives Quote #1 — arrangement collapses all cards to summary-only, no line items shown

\- Client B receives Quote #1 — arrangement shows all detail

\- Both quotes generate different PDFs from the same source-of-truth Calculation Sheet



\### Cross-card pull-out



User can pull lines from any card into a new header. Use case: pulling all concrete cutting lines from all cards into a single "Concrete cutting" header at the bottom of the PDF, so the client sees cutting work consolidated.



This is presentation-only. The underlying Calculation Sheet keeps cutting lines inside their parent cards.



\---



\## Persona implications



The Tendering Assistant persona (system prompts, tool definitions, scope items) needs to understand:



1\. \*\*Disciplines have changed:\*\* DEM/CIV/ASB/Other instead of SO/Str/Asb/Civ/Prv. All prompts that name disciplines need updating.

2\. \*\*Cards are user-named:\*\* the persona can no longer assume a fixed discipline-named card exists. It must work with whatever cards the user has created (or create new ones if proposing scope items).

3\. \*\*Concrete cutting is per-card:\*\* `lookup\_rate` and cutting-related tools need to know which card they're operating in.

4\. \*\*Waste summary is per-card:\*\* auto-aggregation depends on what's in the parent card's scope items.

5\. \*\*Calculation Sheet vs arrangement:\*\* the persona always works on the Calculation Sheet (source of truth). It does not modify the arrangement.



\*\*Affected files (initial scan):\*\*

\- `apps/api/src/modules/personas/definitions/tendering.persona.ts` — persona description, sub-mode descriptions

\- `apps/api/src/modules/personas/definitions/shared-prompts.ts` — `GLOBAL\_RATE\_FABRICATION\_PROHIBITION` (no discipline mentions, no change needed)

\- `apps/api/src/modules/tendering/tender-scope-drafting.service.ts` — has its own `SYSTEM\_PROMPT` const, references IS scope codes — needs DEM/CIV/ASB/Other

\- `propose\_scope\_items` tool input schema — discipline enum

\- `lookup\_rate` tool — needs awareness of which card we're in (parameter addition)

\- Regression test specs (`tendering-assistant.system-prompt.regression.spec.ts`, `rate-lookup-policy.prompt.spec.ts`) — assert content about old disciplines, need updating



\*\*Untouched persona scope (defer to post-MVP):\*\*

\- Drawing tools (`list\_tender\_drawings`, `extract\_drawing\_titleblock`, `read\_tender\_drawing`) — don't reference scope structure, unaffected

\- Persona registry / multi-turn loop / tool dispatcher — structurally unaffected



\---



\## PR breakdown



\### MVP (target: Sean+Raj demo next week)



\*\*PR A1 — Discipline migration\*\*

\- Database enum migration: SO/Str/Asb/Civ/Prv → DEM/CIV/ASB/Other

\- Data remap on existing tender records

\- Update all persona system prompts that name disciplines

\- Update tool schemas (`propose\_scope\_items` discipline enum)

\- Update regression test assertions

\- No UI changes yet



\*\*PR A2 — Database schema for new line-item structure\*\*

\- New `ScopeCard` table (user-named cards, replaces fixed disciplines)

\- `ScopeItem`, `ConcreteCuttingLine`, `WasteLine` tables with UUIDs as primary keys

\- Foreign-key relationships

\- Migration to convert existing global cutting/waste tables into per-card structure

\- Decision needed: how to map old data — probably one Card per current discipline, all cutting in one card, all waste in one card. To be confirmed in PR spec.



\*\*PR B1 — New Scope of Works UI: cards as tabs + scope items table\*\*

\- Replace fixed 5-card layout with horizontal tab strip

\- `+ Add new scope item` button creates a new card

\- Tab interactions: click, drag, rename, delete

\- Scope items table with all columns (Description, Men, Days, Plant 1+, Waste group, Waste item, Unit, Value, Waste?, Notes)

\- `+ Plant` column expansion

\- `+ Add row` always visible

\- Card $ total at top-right of active card and on each tab



\*\*PR B2 — Per-card concrete cutting subtable\*\*

\- Move global concrete cutting table to per-card subtable

\- Three tabs preserved (Cutting / Coring / Other)

\- `+ Add row` always visible on each tab

\- Card $ total now includes cutting line costs

\- Migration of existing concrete cutting data into the new per-card structure



\*\*PR B3 — Per-card waste summary subtable\*\*

\- Auto-generated rows from scope items where `Waste?` is ticked

\- Manual rows via `+ Add manual row`

\- Tonnage + m³ columns

\- Auto/manual badges

\- Auto rows are editable (overriding the calculation)

\- Card $ total includes waste line costs (tip charges)



\### Post-MVP (after demo)



\*\*PR C1 — Quote Arrangement screen base\*\*

\- Client picker dropdown on Quote tab

\- Quote selector below client picker

\- Arrangement screen layout — read Calculation Sheet, render pivot

\- Autosave infrastructure



\*\*PR C2 — Drag-and-drop + grouping\*\*

\- Drag headers to reorder

\- Drag lines between/within headers

\- `+ New header` button creates presentation-only header



\*\*PR C3 — Collapse / expand / hide\*\*

\- Per-header collapse/expand chevrons

\- Per-line collapse/expand

\- Hide actions for both

\- Hidden items excluded from totals (P6 decision)



\*\*PR C4 — Change Quote details + Reset to original\*\*

\- "Change Quote details" pushes rename changes back to Calculation Sheet

\- "Reset to original" regenerates from current Calculation Sheet

\- Confirmation dialogs for both



\*\*PR D1 — Quote PDF respects arrangement\*\*

\- PDF generation reads from arrangement state, not directly from Calculation Sheet

\- Per-arrangement client-facing output

\- Existing PDFKit logic adapted (or migrated to HTML→PDF if 5A.2 has progressed)



\### Total scope



9 PRs (4 MVP + 5 post-demo). Demo-readiness is achieved at PR B3 with the existing Quote PDF generator continuing to work via a compatibility layer (Calculation Sheet → existing quote pipeline). Arrangement screen is purely additive.



\---



\## Open questions deferred to PR specs



These don't block design approval but need answers when drafting each PR:



1\. \*\*A2:\*\* How exactly do existing tender records map to the new card structure? One card per old discipline? Per-tender custom?

2\. \*\*B2:\*\* Existing concrete cutting tables — do they get split by inferring which scope item they relate to, or all get lumped into one card?

3\. \*\*B3:\*\* When the user toggles `Waste?` checkbox on a scope row, does the corresponding auto waste row appear immediately, or only when the user moves focus / saves? (Probably immediately — live calculation.)

4\. \*\*C1:\*\* Where do client-facing quote names come from? Client.name? Or a per-quote name field?

5\. \*\*D1:\*\* If 5A.2 (HTML→PDF migration) hasn't shipped by demo, do we ship PDF generation through the existing PDFKit pipeline as a stopgap, or block on 5A.2 first?



\---



\## Non-goals (explicitly out of scope)



\- Estimate module changes (separate Phase 6 deferred item)

\- Variation / Schedule of Rates / Contract PDF changes (5A.2 territory)

\- Field worker module changes (separate phase)

\- AI persona tool expansion beyond what's needed for the new structure

\- Client portal updates (separate JWT subsystem, separate phase)

\- Multi-tender batch operations

\- Bulk import / export of scope items

\- Rate library changes (existing rate engine wired in as-is)



\---



\## Migration risks



1\. \*\*Data loss on discipline remap\*\* — existing tender records have SO/Str/Asb/Civ/Prv strings in various columns. Migration must remap every column. Audit needed.

2\. \*\*Persona system prompts on production drift\*\* — once persona prompts mention DEM but production data still has Str records, the AI gives wrong advice. PR A1 must ship the prompt change + data migration together.

3\. \*\*Cutting/waste table consolidation\*\* — collapsing global cutting/waste tables into per-card structure requires deciding which card each historical line belongs to. Options: (a) attach all to a single "Migrated cutting" / "Migrated waste" card per tender, (b) attempt heuristic matching, (c) require manual remap. Option (a) is safest, cheapest.

4\. \*\*Demo time pressure\*\* — if MVP slips past demo, fallback is showing the existing UI. Don't promise the new UI to Sean+Raj until PR B3 is shipped + smoke-tested.



\---



\## Approval



This design is the canonical reference. Any deviation in any PR spec must update this doc first, then the spec, then code.



— end of doc —

## C-chain — Phase 0 discovery findings (2026-05-18)

**Status:** investigation complete, no code written. C1 implementation
prompt to be written by MAIN in a follow-up session based on findings
below.

**Base SHA at investigation time:** `f755f70181355625b3ff958a50d7b316dcd534f0` (chore #192, post docs/discipline #191)
**Tests at investigation time:** API 599 pass / 6 skip; web 148

### 1. Codebase inventory

#### 1.1 Quote-related schema (from `apps/api/prisma/schema.prisma`)

The Quote layer is **substantially built** already. C-chain will
restructure and add presentation state, not start from scratch.

| Model | Table | Key fields | Scoped by |
|---|---|---|---|
| `Client` (line 401) | `clients` | name, abn, address, payment terms, bank details | (root) |
| `TenderClient` (line 739) | `tender_clients` | `isAwarded`, `contractIssued`, `relationshipType`, FK contactId | `tenderId` |
| `ClientQuote` (line 2828) | `client_quotes` | `quoteRef` (unique), `revision`, `status`, `adjustmentPct/Amt`, `assumptionMode`, **6× show* flags** (`showProvisional`, `showCostOptions`, `showScopeTable`, `showAssumptions`, `showExclusions`, `showReferencedDrawings`), `detailLevel`, `sentAt`, `generatedPdfPath` | `tenderId + clientId` |
| `QuoteCostLine` (line 2870) | `quote_cost_lines` | label, description, price, **sortOrder**, **isVisible** | `quoteId` |
| `QuoteProvisionalLine` (line 2885) | `quote_provisional_lines` | description, price, notes, **sortOrder** | `quoteId` |
| `QuoteCostOption` (line 2898) | `quote_cost_options` | label, description, price, notes, **sortOrder** | `quoteId` |
| `QuoteAssumption` (line 2912) | `quote_assumptions` | text, **sortOrder**, optional FK to `QuoteCostLine` (linked-vs-free mode) | `quoteId` |
| `QuoteExclusion` (line 2926) | `quote_exclusions` | text, **sortOrder** | `quoteId` |
| `QuoteEmail` (line 2937) | `quote_emails` | sentTo[], subject, bodyPreview, sentAt, sentById | `quoteId` |
| `QuoteScopeItem` (line 2381) | `quote_scope_items` | `sourceItemId`/`sourceItemType` (provenance), label, description, qty, unit, notes, **sortOrder**, **isVisible** | `quoteId` |

**Key finding:** every sub-table already has `sortOrder` + most have
`isVisible`. The "Arrangement screen" largely DRIVES existing
fields rather than introducing new ones. `QuoteScopeItem` already
carries provenance back to a source scope item — exactly the
"calc-sheet → arrangement" link the C-chain needs.

**`ClientQuote.showXxx` flags** are presentation toggles already
shipped — C3's "collapse / expand / hide" semantics may map
cleanly onto these for whole-section visibility, with finer-grain
per-row visibility via `isVisible` on the sub-tables.

**No `cardId` FK** on any quote model — quotes are tender-scoped,
not card-scoped (correct: cards are an estimating-side concept; the
arrangement pivots cards into a client-facing view).

#### 1.2 Quote-related backend routes

| Controller file | Route prefix | Surface area |
|---|---|---|
| `client-quotes.controller.ts` | `tenders/:tenderId/quotes` | Full CRUD on quote + cost-lines / provisional-lines / cost-options / assumptions (with reorder + copy-from-tender) / exclusions / summary |
| `quote-scope-items.controller.ts` | `tenders/:tenderId/quotes/:quoteId/scope-items` | CRUD + **reorder + reset + push-from-scope** — the primitive of "regenerate arrangement from Calc Sheet" already exists in basic form |
| `quote.controller.ts` | `tenders/:tenderId` | T&Cs, tender-level assumptions / exclusions (the per-tender pool that copy-from-tender pulls from), exports |
| `tender-clients.controller.ts` | `tenders/:tenderId/clients` + `tendering/clients/search` | Client picker primitives + tender-client linking |

**Key finding:** `push-from-scope` (POST `/scope-items/push-from-scope`)
on quote-scope-items is the C-chain's "regenerate from Calc Sheet"
primitive in embryonic form. C1 should review what it currently
does and decide whether to extend or replace it.

#### 1.3 Quote-related frontend

| File | LOC | Summary |
|---|---|---|
| `ClientQuotesPanel.tsx` | 2122 | Per-client quote editor. Contains: `ClientRow`, `QuoteContentsPanel`, `QuoteEditor`, and tab components `CostTab` / `ProvisionalTab` / `OptionsTab` / `AssumptionsTab` (free + linked variants) / `ExclusionsTab` / `PreviewTab`. **Drag-and-drop already wired via `@dnd-kit/core` + `@dnd-kit/sortable`**; `SortableQuoteRow` + `StaticQuoteRow` co-exist. |
| `QuoteTab.tsx` | 816 | Outer tab on the tender detail page; renders the per-discipline scope summary + mounts `ClientQuotesPanel`. Already uses 4-code discipline labels (`DEM/CIV/ASB/Other`). |
| `SendQuoteModal.tsx` | 269 | Send-quote UI — recipient picker, body preview, send action. |

**Key finding:** the "Arrangement screen" the design doc envisions
is **partially built already as `ClientQuotesPanel`**. The C-chain
work is more "extend / restructure / add per-quote pivot view"
than "build from scratch". `dnd-kit` is the existing dnd library —
C2's drag-and-drop should reuse it.

**No discrete pivot-table component exists.** The C-chain's
arrangement-screen pivot (cards as columns, quotes as rows, or vice
versa) is genuinely new UI on top of the existing data layer.

#### 1.4 Quote PDF pipeline (current state)

- File: `apps/api/src/modules/estimate-export/pdf/quote-pdf.builder.ts` (1173 LOC)
- Stack: **PDFKit** (per file header: "Server-side PDF builder using PDFKit primitives only. No headless browser, no HTML rendering — intentional for stability.")
- Reads from: `fetchTenderForExport` — `ScopeOfWorksItem + CuttingSheetItem + TenderTandC + TenderAssumption + TenderExclusion`
- **Reads directly from scope tables**, not from `QuoteScopeItem`. D1's job is to rewire this to honour per-quote arrangement.
- 5A.2 HTML→PDF migration: **not shipped**. Q5 status: OPEN.

#### 1.5 Persona implications (current state)

- `disciplines.ts` exports `IS_DISCIPLINE_CODES = ["DEM", "CIV", "ASB", "Other"]` — canonical 4-code confirmed.
- `tendering.persona.ts` has a `QUOTE_SUBMODE_PROMPT` block (persona is already aware of quote workflow).
- **No mentions of "arrangement", "Calculation Sheet", or "arrangement screen"** in the persona prompts. C-chain implementation should include a persona update introducing the **Calc-Sheet-as-source-of-truth invariant** ("the persona always works on the Calculation Sheet, never on the Arrangement; the Arrangement is a client-facing presentation layer derived from the Calc Sheet").

### 2. Data shape probes (dev DB, 2026-05-18)

#### 2.1 Quote inventory by tender

```
            id             |                         title                         | quote_count
---------------------------+-------------------------------------------------------+-------------
 cmonoidox00rlubccg27ce18n | Brisbane Grammar School — Science Block refurbishment |           1
 cmonv7yz50004ub601c0knolv | Compliance Tender 1777697548014                       |           0
 (… 18 more tenders, all with quote_count = 0)
```

Only T260512-BRIS-Rev1 has a quote. 19 of 20 sampled tenders have zero
quotes (typical for early-stage tenders). C-chain demo data
generation may want to seed quotes against more tenders to
showcase the arrangement UI populated.

#### 2.2 Client inventory

8 clients total. 5 seed clients (`client-001` … `client-005`) +
3 cuid-style additions (Brisbane Grammar School is the one with an
ABN — that's T260512-BRIS-Rev1's tender client).

#### 2.3 TenderClient inventory

85 tender-client links across the dev DB. Per-tender many-to-many
between clients and tenders works as expected. Sample:

```
         tender_id         |         client_id         | is_awarded
---------------------------+---------------------------+------------
 cmoo6vij90004ubo8ghmj2lyl | client-003                | t
 cmoo6vij90004ubo8ghmj2lyl | cmonoidla00p0ubccu7898lnw | f
```

Multiple clients per tender (one awarded, others not) — the
arrangement screen will need to handle this when picking which
client's quote to view/build.

#### 2.4 Quote sub-table counts (dev)

```
      source       | count
-------------------+-------
 cost_lines        |     3
 scope_items       |     0
 provisional_lines |     1
 cost_options      |     0
 assumptions       |     4
 exclusions        |     7
```

`quote_scope_items` is empty — the "push from scope" primitive
exists but hasn't been used in dev yet. C1 will populate this on
quote creation.

#### 2.5 T260512-BRIS-Rev1 scope state

```
 cards
-------
     4
```

| card_id | items |
|---|---|
| `…-card-ASB` | 2 |
| `…-card-CIV` | 1 |
| `…-card-DEM` | 4 |
| `…-card-Other` | 1 |

Eight scope items total across 4 cards. The C-chain pivot will
have a tractable demo dataset.

### 3. Design-doc open questions — status

**Q1 (PR A2 / B-chain): How exactly do existing tender records map to the new card structure?**
- **Status:** RESOLVED
- **Finding:** Shipped via A2 + B-chain. Cards exist per tender × discipline; existing scope items migrated to their natural cards.

**Q2 (PR B2 / B4b): How do existing concrete cutting tables get split by inferring which scope item they relate to?**
- **Status:** RESOLVED
- **Finding:** B4b shipped Copy-from-above with material auto-inference + cardId FK. B-followup deleted the 2 pre-card-scoping cutting orphans and made `card_id` NOT NULL on both cutting + waste tables.

**Q3 (PR B3): Does waste auto-row appear immediately when Waste? checkbox toggles?**
- **Status:** RESOLVED (verified from shipped behaviour)
- **Finding:** No — the `Waste?` toggle in `ScopeQuantitiesTable.tsx` fires `onPatch({ wasteIncluded: ... })` immediately, but only persists the flag. The waste summary row only appears when the user explicitly clicks "Sum from above" on the waste subtable. Matches B3's stated design (user-driven regeneration; manual rows survive).

**Q4 (PR C1): Where do client-facing quote names come from? Client.name? Per-quote name field?**
- **Status:** OPEN — central C1 decision
- **Finding:** `ClientQuote` has `quoteRef` (unique, machine-style) and `revision` (Int) but **NO** human-friendly `name` / `title` / `displayName` column. `Client.name` exists. The natural display name today is `${Client.name} — Rev ${revision}` (e.g. "Brisbane Grammar School — Rev 1") or `${quoteRef}`.
- **Recommendation:** Start with `Client.name + revision` as the displayed name (zero schema work). If estimators ask for per-quote labels later (e.g. two parallel quote variants for the same client), promote to a nullable `displayName` column on `ClientQuote` in a follow-up. This keeps C1 small while preserving the upgrade path.

**Q5 (PR D1): If 5A.2 (HTML→PDF migration) hasn't shipped by demo, stopgap on PDFKit or block on 5A.2?**
- **Status:** OPEN
- **Finding:** 5A.2 has **not** shipped. `quote-pdf.builder.ts` is still PDFKit (its file header explicitly notes "intentional for stability"). HTML→PDF is not in the dependency graph (`puppeteer` / `playwright PDF` search returned nothing).
- **Recommendation:** **Stopgap on PDFKit.** D1's job is to make the PDF respect arrangement; that's a "what to render" change, not a "how to render" change. PDFKit can read from `QuoteScopeItem` + the `ClientQuote.show*` flags + per-line `isVisible` + per-line `sortOrder` exactly as well as HTML would. Coupling C-chain to 5A.2 would block the demo on a sibling migration that has its own scope; the stability argument in the file header still applies.

### 4. Refined C-chain PR breakdown

Post-discovery, the C-chain is **smaller than the design doc
sketched** because so much plumbing already exists. Re-scoping:

**PR C0 — NOT NEEDED.** Discovery did not surface any pre-work
required. Existing Quote tab can be progressively replaced.

**PR C1 — Quote Arrangement screen base** — complexity: **M**
- **Scope:**
  - New "Arrangement" view inside the Quote tab (alongside or
    replacing the current `ClientQuotesPanel`'s editor — TBD)
  - Client picker (reuse `tendering/clients/search` endpoint)
  - Create / select a quote per `(tender, client)` pair
  - Populate `QuoteScopeItem` from the Calc Sheet on quote
    creation (extend existing `push-from-scope` if needed)
  - Display quote-scope-items as a flat list with the existing
    `sortOrder` driving order
  - Use `Client.name + Rev ${revision}` as displayed quote name (Q4 recommendation)
- **Out:** drag-and-drop, hide/collapse, grouping (those are C2 / C3)
- **Files touched:** mostly `ClientQuotesPanel.tsx` + 1-2 new backend handlers; no schema changes if Q4 recommendation accepted
- **Tests:** ~6-10 specs around the push-from-scope extension + client picker

**PR C2 — Drag-and-drop + grouping** — complexity: **M**
- **Scope:**
  - Reuse existing `@dnd-kit` wiring on `QuoteScopeItem` rows
  - Group-by-source-card pivot (rows grouped by their `sourceItemId`'s card)
  - Update `sortOrder` on drag-end via existing reorder endpoint
- **Schema:** likely none; existing `sortOrder` does the work. May need a `groupId` or similar if grouping needs to persist independently of card boundaries — defer decision to C2's discovery
- **Files touched:** mostly `ClientQuotesPanel.tsx`
- **Tests:** ~4-6 specs around reorder semantics + group integrity

**PR C3 — Collapse / expand / hide** — complexity: **S**
- **Scope:**
  - Per-row hide via existing `QuoteScopeItem.isVisible`
  - Per-section collapse/expand for the 6 `ClientQuote.showXxx` flags
  - Optional: per-row "collapsed" state if rows need to fold (likely just CSS)
- **Schema:** none — existing flags + `isVisible` suffice
- **Files touched:** mostly frontend
- **Tests:** ~3-4 specs

**PR C4 — Change Quote details + Reset to original** — complexity: **S/M**
- **Scope:**
  - Edit `Client.name` displayed override (the Q4 follow-up if estimators ask) OR per-quote labels via a new `displayName` column
  - "Reset to original" = re-run `push-from-scope` (already exists) + clear `isVisible` / `sortOrder` overrides
  - "Reset this row" = revert one `QuoteScopeItem` to its source
- **Schema:** possibly `+ClientQuote.displayName String?` if Q4 follow-up is in scope
- **Tests:** ~5-7 specs around reset semantics + override behaviour

**PR D1 — Quote PDF respects arrangement** — complexity: **M**
- **Scope:**
  - Modify `quote-pdf.builder.ts` to read from `QuoteScopeItem` instead of (or in addition to) raw scope items
  - Honour `isVisible`, `sortOrder`, `ClientQuote.show*` flags
  - Per-section heading from group-by-source-card pivot (matches C2)
  - Stopgap on PDFKit (Q5 recommendation accepted)
- **Schema:** none
- **Files touched:** `quote-pdf.builder.ts` + `estimate-export.service.ts` (the upstream fetch)
- **Tests:** ~4-6 PDF-builder specs against a fixture quote

### 5. Recommendations for MAIN before writing the C1 prompt

1. **Confirm Q4 answer** (per-quote name vs Client.name fallback). Recommended: Client.name + revision in C1; promote to per-quote `displayName` in C4 only if requested.
2. **Confirm Q5 answer** (PDFKit stopgap vs block on 5A.2). Recommended: stopgap on PDFKit — D1 is a "what to render" change, decoupled from HTML migration's "how to render".
3. **Decide on `push-from-scope` extension vs replacement.** The endpoint already exists at POST `/tenders/:tenderId/quotes/:quoteId/scope-items/push-from-scope`. C1 should either (a) extend it to handle the full Calc-Sheet → Arrangement materialisation, or (b) ship a new endpoint and deprecate this one. Discovery didn't open the handler — C1's implementation prompt should include a Phase 0 reading of what it currently does so the decision is informed.
4. **Decide the C1 frontend boundary**: extend `ClientQuotesPanel.tsx` (currently 2122 LOC, already organised into per-quote tabs) vs build a new arrangement-screen component. Recommended: extend in place. The existing structure (ClientRow → QuoteContentsPanel → QuoteEditor → tab components) is the right place to add an "Arrangement" tab alongside Cost / Provisional / Options / Assumptions / Exclusions / Preview.
5. **Persona update**: C1 (or any C-chain PR) should add the Calc-Sheet-as-source-of-truth invariant to `tendering.persona.ts`'s QUOTE_SUBMODE_PROMPT. Discovery confirmed this rule is not yet in the persona prompt.

### 6. Out-of-scope notes captured during discovery

- **Demo data thin on the Quote side.** Only T260512-BRIS-Rev1 has a quote; only 3 cost lines + 1 provisional line + 7 exclusions + 4 assumptions across the whole dev DB. C1's demo prep may want a seed-data PR adding 2-3 more quotes to populate the arrangement screen visually.
- **TenderClient model is rich** — has `isAwarded`, `contractIssued`, `relationshipType`, etc. The arrangement screen's client picker may want to surface "awarded" / "primary" status to help estimators distinguish the awarded client from also-rans. Not in scope for C1 but worth a UX note.
- **`assumptionMode` on `ClientQuote`** has values `"free"` and (presumably) `"linked"`. The current `QuoteAssumption` model supports both modes (optional FK to `QuoteCostLine`). C3's "collapse / hide" UI should respect this — linked assumptions probably auto-hide when their cost line is hidden, which is a non-trivial UX detail to confirm with estimators.
- **`generatedPdfPath` on `ClientQuote`** suggests PDFs are cached. D1 should think about cache invalidation when arrangement changes.

— end of C-chain Phase 0 discovery —

## Fix Map (2026-05-18)

**Status:** 4 of 8 shipped (B01, B01.1, B02, B05 — see PR refs in
summary table); 1 verification-pending (B04); 3 still open
(B03, B06, B07, B08). Updated 2026-05-24 post-B05.

**Base SHA at triage time:** `78c7b049947e486941dac285bf456650962c2f03` (post chore #194)
**Tests at triage time:** API 599 pass / 6 skip; web 148

### Summary table

| ID | Status | Title | Severity | Suspected cause | Fix complexity | Blocks/Blocked-by |
|---|---|---|---|---|---|---|
| B01 | ✅ Shipped (PR #199) | Job detail blank page (/jobs/job-001) | BLOCKER | Surgical ErrorBoundary added (correct defence-in-depth) but did NOT resolve the user-visible symptom — root cause was line 207 precedence bug fixed in B01.1 | M | — |
| B01.1 | ✅ Shipped (PR #203) | JobDetailPage line 207 precedence bug (real cause of blank page) | BLOCKER | `job?.activities.length` parsed as `job?.(activities.length)`; truthy job + undefined activities (API nests inside stages) threw at render, React 18 unmounted the route — verified by Marco 2026-05-18 | S | — |
| B02 | ✅ Shipped (PR #197) | POST /api/v1/jobs returns "Cannot POST" | BLOCKER | `JobsController` had no `@Post()` handler; frontend called one that didn't exist. Codex P2 race-fix (findUnique-then-create) deferred and folded into B05's future PR | S | — |
| B03 | Open | No project → job transition | BLOCKER | Architectural gap: existing `convertFromTender` creates Project; existing `tender-conversion/:id/convert-to-job` creates Job — both off tender; no Project→Job path exists | L (sub-discovery candidate) | — |
| B04 | ⏳ Verification-pending | KPI card overlap (Chat1 #1) | COSMETIC | JobDetailPage cards visually clean post-B01.1; original Chat1 report cited JobsListPage cards — needs fresh screenshot before closing | S (TBD) | B01 dependency resolved |
| B05 | ✅ Shipped (PR #210) | Job ID format inconsistency (Chat1 #2) | FUNCTIONAL | 3 prefix formats coexist: `J-YYYY-NNN` (seed), `JOB-YYYY-NNN` (runtime), `JOB-COMP-<epoch>` (compliance harness). Will absorb Codex P2 race-fix from B02 | S | — |
| B06 | Open | Scheduler weekend clip (Chat1 #4) | COSMETIC | Unverified; no `--weekend` variant in `.sched-week__*` CSS — likely a narrow-column rendering issue | S (TBD) | — |
| B07 | Open | "Due this week" mislabel (Chat1 #6) | COSMETIC | Widget filter is "due in next `daysAhead` days" (default 7); title says "this week" → off-by-cutoff at end of week | S | — |
| B08 | Open | Client win 300% | FUNCTIONAL | `bumpWinCount` re-fires winCount increment without re-checking tenderCount; copy-tender flow or re-award triggers it | S (data fix + idempotency guard) | — |

### Per-bug detail

#### B01 — Job detail blank page

- **Status:** ✅ Shipped 2026-05-17 in PR #199. Surgical
  ErrorBoundary added around each tab section in JobDetailPage +
  dev-mode `console.error` in the fetch catch. This was the right
  defence-in-depth but did NOT resolve the user-visible blank
  page — the actual throw happens in the parent component above
  any boundary's mount point. Real cause was fixed in **B01.1**
  (PR #203, line 207 precedence bug). See
  `docs/diagnostics/2026-05-18-b01-blank-page/REPORT.md` for the
  diagnostic that surfaced the real cause.
- **Where it lives:** `apps/web/src/App.tsx:188` (route registration `/jobs/:id` → `JobDetailPage`), `apps/web/src/pages/jobs/JobDetailPage.tsx` (570 LOC).
- **Evidence:** Marco screenshot showed `/jobs/job-001` URL with blank white viewport. Route handler responded (URL changed; not a 404) but no UI rendered.
- **Backend + data confirmed OK:**
  - `GET /jobs/:id` exists at `JobsController:45` (`getById(@Param('id') id)` → `service.getById`).
  - `jobs.service.ts:332` (`getById`) wraps `requireJob(id)` (line 1251) which uses the rich `jobInclude` (line 92) — includes `stages`, `issues`, `variations`, `progressEntries`, `statusHistory`, etc. Shape matches the `JobDetail` type in the component.
  - DB has `job-001` (`SELECT id, job_number, name, status FROM jobs WHERE id='job-001'` → exists, `J260315-QUEE-001 / Ipswich Motorway Stage 4 — Earthworks / ACTIVE`).
- **Hypotheses:**
  - **H1** (most likely): a render-time exception inside one of the nested sections (`StageSection` / `ActivitySection` / etc.) crashes the React tree silently. No error boundary above `JobDetailPage`, so the whole route renders blank. Likely a nested field — e.g. `activity.owner` is null and code dereferences `.firstName`.
  - **H2**: `authFetch` returns a 401 (expired token) → `response.ok=false` → throws → `setError("Job not found.")` → renders `EmptyState`. But Marco said BLANK, not "Job not found", so H2 is unlikely unless the EmptyState component itself crashes (it doesn't — used everywhere).
  - **H3**: `setExpandedStages(new Set(data.stages.map(s => s.id)))` on line 168 throws if `data.stages` is undefined. Catch block sets error AND `job` was already set on line 166 → render proceeds with truthy `job` but undefined nested arrays → JSX access throws → blank tree.
- **Recommended hypothesis to test first:** H1 / H3 (closely related). Add an error boundary at the `<Route>` level OR wrap each tab section. Cheapest first-cut: log to console.error in the catch on line 170 to surface the underlying error to Marco.
- **Fix sketch:**
  1. Add an error boundary component (`<ErrorBoundary fallback={<EmptyState heading="Could not render job"/>}>`) around `JobDetailPage`'s nested sections.
  2. Audit nested optional fields in the render path (`owner`, `lead`, `approvedBy`, `reportedBy`) for unguarded `.firstName` dereferences.
  3. Re-throw `error` to the browser console in dev mode so the actual stack reaches Marco.
- **Smoke test (after fix):**
  1. Login as admin
  2. Navigate to `/jobs`
  3. Click the "Ipswich Motorway Stage 4 — Earthworks" card
  4. Expected: job detail renders with stages, issues, variations sections. NOT blank, NOT "Job not found".
  5. Open browser console; expect zero errors.
- **Open questions for MAIN:** is there a global error boundary on the React tree that Marco could check, or do we need one? Memory hints that `EmptyState`/`Skeleton` are from `@project-ops/ui` but I didn't find any app-level error boundary. **Answer (post-ship):** No app-level boundary existed. P-platform1 in the Design Map captures that future work.
- **Dependencies:** Was blocking B04 (KPI card overlap on the same page) — resolved post-ship.

#### B01.1 — JobDetailPage line 207 precedence bug (blank-page root cause)

- **Status:** ✅ Shipped 2026-05-18 in PR #203. Visually verified
  by Marco in browser same day (Ctrl+Shift+R required to flush
  stale SW bundle — that friction is captured as **P-platform3**
  in the Design Map).
- **Where it lives:** `apps/web/src/pages/jobs/JobDetailPage.tsx:207` (pre-fix).
- **Evidence:** Marco's DevTools console showed
  `Uncaught TypeError: Cannot read properties of undefined (reading 'length')`
  with the `MessagePort.M` frame at the bottom of the stack —
  classic signature of a render-phase throw via React 18's
  scheduler. Triple-confirmed: Cowork source analysis
  (`docs/diagnostics/2026-05-18-b01-blank-page/REPORT.md` §6) +
  symptom shape (blank, no fallback, no EmptyState) + runtime
  trace.
- **Root cause:** `job?.activities.length ?? 0` parses as
  `job?.(activities.length)`. The optional chain only short-
  circuits when `job` itself is nullish. When `job` is truthy
  and `job.activities` is undefined (which it always is — the
  API nests activities inside `stages[].activities` and never
  sends a top-level `activities` key), `undefined.length` throws
  at render-phase, React 18 unmounts the route subtree → blank
  page. Line 208 immediately next door used the safe pattern
  `(job?.activities ?? []).length` — the asymmetry between 207
  and 208 was the actual defect.
- **Fix shape (FE-only):**
  1. Type-lie removed: `activities: JobActivity[]` dropped from
     the `JobDetail` type; `activities?: JobActivity[]` added to
     `JobStage` where the API include actually puts them.
  2. New `flattenActivities` helper (exported, pure) derives a
     flat list from `stages[].activities` with safe-defaults at
     every hop. Component uses it via `useMemo`.
  3. `toggleActivity`'s optimistic update now walks nested
     stages; stage rendering uses `stage.activities` directly.
  4. Same precedence antipattern on line 202
     (`job?.issues.filter(...)`) fixed defensively (not a live
     bug because the API always sends issues, but identical
     trap).
  5. `if (!job) return null` replaced with EmptyState +
     back-link so future null-state bugs never produce blank
     pages again.
  6. ErrorBoundary gained a JSDoc clarifying it catches errors
     thrown by its CHILDREN, not the parent above the JSX
     return (the trap that made B01's boundary look broken).
- **Tests added:** 3 vitest specs in
  `apps/web/src/pages/jobs/__tests__/JobDetailPage.b01-1.test.tsx`
  against `flattenActivities` (regression, derivation, null
  safety). Pure-logic — web workspace has no testing-library/jsdom.
- **Follow-ups (not in this PR's scope):** P-platform2 (API/FE
  type contract enforcement) and P-platform3 (SW update strategy)
  captured in Design Map.
- **Dependencies:** None.

#### B02 — POST /api/v1/jobs returns "Cannot POST"

- **Status:** ✅ Shipped 2026-05-18 in PR #197. `@Post()` handler
  + `CreateJobDto` + `JobsService.createJob` (mirrors
  `convertTenderToJob` shape — caller-supplied jobNumber, no
  auto-generator). Audit via `auditService.write({action: 'jobs.create'})`.
  **Codex P2 race-fix shipped:** the `findUnique`-then-`create`
  race on jobNumber uniqueness shipped in PR #210 as B02.1,
  bundled with the B05 canonicalisation work. P2002 unique-violation
  now translates to a 409 `ConflictException` on both job-create
  paths (`createJob` + `convertTenderToJob`).
- **Where it lives:** `apps/api/src/modules/jobs/jobs.controller.ts:26` (`@Controller("jobs")` — no `@Post()` at root); `apps/web/src/pages/jobs/JobsListPage.tsx:449` (frontend POSTs to `/jobs`).
- **Evidence:** Modal "Cannot POST /api/v1/jobs" after submitting job-creation form. Confirmed: controller has only `@Get`, `@Patch`, and `@Post(":id/<sub-resource>")` handlers — nothing at the controller root.
- **Hypotheses:**
  - **H1** (confirmed): `@Post()` handler simply doesn't exist. Frontend calls `authFetch("/jobs", { method: "POST" })`; Nest responds 404 "Cannot POST /api/v1/jobs".
- **Recommended hypothesis to test first:** H1.
- **Fix sketch:**
  1. Add `@Post() create(@Body() dto: CreateJobDto, @CurrentUser() actor) { return this.service.createJob(dto, actor.sub); }` to `JobsController`.
  2. Add `createJob(dto, actorId)` to `JobsService`. Look at the existing `convertFromTender` / `reuseArchivedJobConversion` paths for the pattern. A minimal manual-create is `prisma.job.create({ data: { ... } })` + writing a status-history row + audit log.
  3. Add `CreateJobDto` (or reuse fields from `UpdateJobDto` made required). The frontend body (line 449-451) sends `name`, optional `description`, optional `siteId` — match those.
- **Smoke test (after fix):**
  1. Navigate to `/jobs`
  2. Click "New job"
  3. Enter name "Test Job 1", leave description + site blank, submit
  4. Expected: modal closes; new card appears in the list with name "Test Job 1" and a `JOB-2026-NNN` number; clicking it navigates to its detail page (after B01 is also fixed).
- **Open questions for MAIN:** what's the policy on manual jobs (without a tender source)? The schema allows `sourceTenderId = null` but a quick scan of the conversion paths suggests all production jobs come from tenders. If manual jobs shouldn't exist, the fix is "hide/disable the New Job button when not converting" rather than "wire up POST /jobs".
- **Dependencies:** None.

#### B03 — No project → job transition

- **Where it lives:**
  - Tender→Project conversion: `apps/api/src/modules/projects/projects.service.ts:390` (`convertFromTender`) + `apps/api/src/modules/tendering/tender-convert.controller.ts:18` (`POST /tenders/:id/convert`).
  - Tender→Job conversion (parallel, separate): `apps/api/src/modules/jobs/tender-conversion.controller.ts:45` (`POST /tender-conversion/:tenderId/convert-to-job`) + `JobsService.reuseArchivedJobConversion`.
  - Project status UI: `apps/web/src/pages/projects/AdvanceStatusModal.tsx` — status flow is `MOBILISING → ACTIVE → PRACTICAL_COMPLETION → DEFECTS → CLOSED` (all within Project).
- **Evidence:** Marco: "When I go to tenders and change the status to awarded, it shows under project, but I can't move from project to jobs". The status flow in `AdvanceStatusModal.tsx` confirms no Project→Job transition exists. Schema has `Job.sourceTender` (line ~1860) but no `Job.sourceProjectId`.
- **Hypotheses:**
  - **H1**: Project→Job is genuinely unimplemented; needs new schema FK + endpoint + UI button + design decision on what "becoming a Job" means (does the Project close? Is the Job a child of the Project? Do scope items duplicate?).
  - **H2**: Project and Job were conceptually meant to be the same entity at different lifecycle stages; the schema already has overlap (both have client, scope, team, contractValue, etc.). Fix is to collapse them, NOT add a transition.
- **Recommended hypothesis to test first:** H1 with a sub-discovery PR that nails down (a) what Marco's workflow expects ("Project IS the delivery phase" vs "Project precedes Job") and (b) what data needs to move/duplicate/freeze on transition.
- **Fix sketch:** **L complexity.** This isn't a single fix — it's a design decision. Recommend MAIN run a separate sub-discovery pass before writing any implementation prompt. Possible scopes:
  - **Scope A** (minimal): add a `MOBILISING → ACTIVE → … → CLOSED` step labelled "Convert to Job" that creates a Job record off the Project + sets Project.status=ARCHIVED. Adds `Job.sourceProjectId` FK.
  - **Scope B** (collapse): merge Project + Job into a single Project entity, deprecate the Job model. Multi-PR migration.
- **Smoke test (after fix):** depends on the chosen scope.
- **Open questions for MAIN:** see Hypotheses + Fix sketch above. This is the architectural decision that has to come first.
- **Dependencies:** None to other bugs; but enlarges B01 scope if H2 is chosen (we'd be deprecating the entire Jobs module).

#### B04 — KPI card overlap (Chat1 #1)

- **Status:** ⏳ Verification-pending. JobDetailPage KPI cards
  rendered cleanly after B01.1 restored page rendering
  (2026-05-18) — no overlap observed in Marco's post-fix browser
  check. **But:** the original Chat1 report cited JobsListPage
  cards, not JobDetailPage, and JobsListPage hasn't been
  re-screenshotted. Cannot close until JobsListPage is visually
  verified at narrow widths.
- **Where it lives:** `apps/web/src/styles.css:3972` (`.tendering-stat-card`) + `apps/web/src/pages/JobsPage.tsx:1201, 1205, 1209, 1217` (4 stat cards: source tender / estimated value / win confidence / carried documents).
- **Evidence:** Chat1 observation, never visually verified by Marco. CSS structurally fine (display:grid with 4px gap).
- **Hypotheses:**
  - **H1**: Cards overlap horizontally at narrow widths because the parent container doesn't wrap (or wraps badly).
  - **H2**: Value-string overflow (long currency / long tender number) breaks the layout.
  - **H3**: Already-resolved since Chat1's observation; no current bug.
- **Recommended hypothesis to test first:** H3 first — fresh screenshot of JobsListPage from Marco (B01 / B01.1 no longer block visual access).
- **Fix sketch:** TBD pending re-screenshot. If H1: wrap parent in `flex-wrap: wrap` or set `min-width: 0` on child. If H2: `text-overflow: ellipsis`.
- **Smoke test (after fix):** Resize browser from 1920px down to 768px on `/jobs` (the list page); cards must stack cleanly, no overlap, no value clipping.
- **Open questions for MAIN:** request a current JobsListPage screenshot before allocating a fix PR.
- **Dependencies:** Was blocked by B01 (resolved post-B01.1 ship); now self-sufficient pending visual verification.

#### B05 — Job ID format inconsistency (Chat1 #2)

- **Status:** ✅ Shipped 2026-05-19 in PR #210 (bundled with the
  B02.1 race-fix). Canonical job-number format is **`J-YYYY-NNN`** —
  not the `JOB-YYYY-NNN` this triage fix-sketch proposed. PR #210
  added a `JobNumberService` + per-year `JobNumberSequence` table
  (Brisbane TZ) that generates job numbers when the caller omits one
  and validates/rejects (400) legacy formats. Contrary to the
  fix-sketch below, a migration WAS required —
  `20260519_feat_job_number_canonicalisation` normalised existing
  rows in place (2× `JOB-YYYY-NNN`, 36× `JOB-COMP-*` → canonical).
  The fix-sketch and open questions below are kept for historical
  context but are superseded by what shipped.
- **Where it lives:** `apps/api/prisma/seed-initial-services.ts` (seed uses `J-2025-NNN`) + compliance smoke harness (uses `JOB-COMP-<epoch>`) + runtime job-number generator (uses `JOB-YYYY-NNN`). The runtime generator is in `JobsService.generateJobNumber` or similar — wasn't located explicitly but inferred from `JOB-2026-001` data and `ProjectNumberSequence` schema model precedent (`apps/api/prisma/schema.prisma:1847`).
- **Evidence:** DB probe (38 rows) confirmed three coexisting formats:
  - `J260315-QUEE-001`, `J260328-BRIS-001` — 2 seed records
  - `JOB-2025-099` — 1 seed record
  - `JOB-2026-001` — 1 runtime-created (the most recent non-compliance row)
  - `JOB-COMP-<epoch>` — 33 compliance-smoke records
- **Hypotheses:**
  - **H1** (confirmed): seed and runtime generator use different prefix formats.
- **Recommended hypothesis to test first:** H1.
- **Fix sketch:** Update seed to use `JOB-YYYY-NNN` to match runtime. Compliance harness can keep `JOB-COMP-<epoch>` (it's disposable test data) OR also switch — Marco's call. No migration needed because seed runs idempotently against ID = `job-001`, `job-002`, etc. Just change the displayed `jobNumber` literals.
- **Smoke test (after fix):**
  1. Reset DB + reseed
  2. Navigate to `/jobs`
  3. All non-compliance job cards display `JOB-YYYY-NNN` format. No `J-2025-NNN` anywhere.
- **Open questions for MAIN:** keep `JOB-COMP-<epoch>` for compliance smoke or also normalize? Recommendation: keep the COMP- prefix so they're visually distinguishable in the audit table; just don't display them in the user-facing list.
- **Dependencies:** None.

#### B06 — Scheduler weekend clipping (Chat1 #4)

- **Where it lives:** `apps/web/src/pages/scheduler/SchedulerWorkspacePage.tsx:436` (week-header `["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]`) + `apps/web/src/styles.css:2343` (`.sched-week__col`) + `.sched-month__cell` (line 2488+).
- **Evidence:** Chat1 observation, never visually verified. CSS has no `--weekend` variant — all 7 columns share the same styling.
- **Hypotheses:**
  - **H1**: All 7 columns are equal width but the parent grid has a max-width that compresses Saturday/Sunday columns differently from weekdays at narrow widths.
  - **H2**: A specific shift / event renders only on weekends and overflows because of a hardcoded width.
  - **H3**: Already-resolved.
- **Recommended hypothesis to test first:** H3 — re-screenshot from Marco. Without a specific repro, root cause speculation is unproductive.
- **Fix sketch:** TBD pending repro.
- **Smoke test (after fix):** Navigate to `/scheduler`; load a week with weekend shifts; verify Sat + Sun columns render at the same width as Mon-Fri with no content clipping.
- **Open questions for MAIN:** request a fresh screenshot, ideally with a weekend-shift visible.
- **Dependencies:** None.

#### B07 — "Due this week" mislabel (Chat1 #6)

- **Where it lives:** `apps/web/src/dashboards/widgets/tendering.tsx:242` (`DueThisWeekPanel`) + `apps/web/src/dashboards/widgetRegistry.ts:283` (widget metadata `name: "Due this week"`).
- **Evidence:** Confirmed via code read: widget filter is `daysUntil(t.dueDate) <= daysAhead` where `daysAhead` defaults to 7 (configurable). Title says "Due this week" but the actual semantic is "due in the next N days" (default 7 = rolling 7-day window from today). At end of week, results spill into next week.
- **Hypotheses:**
  - **H1** (confirmed): label / semantic mismatch. Title implies "this week" (Mon-Sun current week) but logic is rolling 7-day.
- **Recommended hypothesis to test first:** H1.
- **Fix sketch:** Two options:
  - **(a) Rename label** to "Due in next 7 days" or "Due soon" — preserves current 7-day rolling behaviour, fixes label. 1-line change in `widgetRegistry.ts:283`.
  - **(b) Change semantic** to literal current-week (Mon-Sun of `new Date()`'s ISO week). Adjust the filter in `DueThisWeekPanel` line 250.
  Recommendation: (a) — the 7-day rolling window is a more useful default for tenders (estimators don't suddenly stop caring on Sunday night).
- **Smoke test (after fix):** Open `/tendering/dashboard`; verify widget title matches its content.
- **Open questions for MAIN:** decide (a) vs (b). The `daysAhead` config field already exists — letting estimators set it to 14 to mean "next two weeks" is the strongest argument for (a).
- **Dependencies:** None.

#### B08 — Client win 300%

- **Where it lives:** `apps/api/src/modules/tendering/tendering.service.ts:1026` (`bumpWinCount`) + `apps/api/src/modules/tendering/tendering.service.ts:1009` (the win-rate computation in another path).
- **Evidence:** DB probe confirmed Brisbane Grammar School has `win_count=3, tender_count=1, win_rate=300.00` — `winCount > tenderCount` is mathematically impossible for a probability. `winRate` is stored as a percentage on `clients.win_rate`; no `win_probability` column exists anywhere.
- **Hypotheses:**
  - **H1** (most likely): `bumpWinCount` (`tendering.service.ts:1026`) increments `winCount` without checking idempotency. If a tender is awarded → bumpWinCount runs (winCount=1). Tender duplicated via "Copy" flow → if the copy retains the AWARDED status, bumpWinCount fires again on the COPY (winCount=2, tenderCount still 1 because Copy didn't increment tenderCount). Status edit re-award → bumpWinCount #3 (winCount=3).
  - **H2**: A backfill / migration ran `bumpWinCount` more than once over the same set.
- **Recommended hypothesis to test first:** H1 via the Copy-tender flow.
- **Fix sketch:**
  1. **Data fix:** one-shot SQL to clamp `winCount = LEAST(winCount, tenderCount)` and recompute `winRate = winCount/tenderCount*100`. Migration `XXXX_clamp_client_win_counters.sql`.
  2. **Idempotency guard:** in `bumpWinCount`, before incrementing, check whether this `(clientId, tenderId)` win has already been counted. Simplest approach: add a `wonAt` timestamp on `TenderClient`; if already set, skip. (Schema add: nullable `won_at TIMESTAMPTZ` on `tender_clients`. Migration + code change.)
  3. **Copy-tender flow:** when duplicating a tender, reset `is_awarded=false` on the copy's `TenderClient` rows so the next award fires fresh — OR explicitly do NOT re-run bumpWinCount during copy.
- **Smoke test (after fix):**
  1. Reset Brisbane Grammar School: `UPDATE clients SET win_count=1, win_rate=100 WHERE id='cmonoidor00riubccwps0j96a';`
  2. Re-trigger the bug: duplicate T260512-BRIS-Rev1 (the AWARDED parent)
  3. Verify the new T260512-BRIS-Rev1-COPY-2 does NOT bump winCount again; client still shows `win_count=1, tender_count=2, win_rate=50`.
  4. Award T260512-BRIS-Rev1-COPY-2 explicitly → winCount=2, tenderCount=2, winRate=100. Correct.
- **Open questions for MAIN:** does the Copy-tender flow today preserve AWARDED status on the copy, or reset it? If it preserves, fix step 3 is mandatory; if it resets, step 3 is moot.
- **Dependencies:** None.

— end of Fix Map —

## Design Map (2026-05-18)

**Status:** triage complete, no implementation shipped. Implementation
prompts to be written by MAIN per-feature as priorities are set.

**Scope:** 11 features — 5 in C-chain (Quote Arrangement, post-MVP)
and 6 in P-chain (Projects module redesign, described by Marco
2026-05-18).

### Summary table

| ID | Chain | Feature | Complexity | Cross-cutting concerns | Status |
|---|---|---|---|---|---|
| C1 | C-chain | Quote Arrangement screen base | M | extends push-from-scope | discovered, ready for impl prompt |
| C2 | C-chain | Drag-and-drop + grouping | M | reuses @dnd-kit; pivots on source card | discovered |
| C3 | C-chain | Collapse/expand/hide | S | reuses isVisible + show* flags | discovered |
| C4 | C-chain | Reset to original / displayName | S/M | re-runs push-from-scope | discovered |
| D1 | C-chain | Quote PDF respects arrangement | M | PDFKit stopgap (Q5 locked) | discovered |
| P-tab1 | P-chain | Project Overview restructure | S | depends on user list catalog | new |
| P-tab2 | P-chain | Project Documents with type dropdown | M | extensible doc-type catalog | new |
| P-tab3 | P-chain | Project Scope with "pull from quote" + log | L | overlaps with C2/C3 UX; needs change-log model | new |
| P-tab4 | P-chain | Project Schedule from project scope + WBS Gantt | M | depends on P-tab3; Gantt explode/collapse | new |
| P-tab5 | P-chain | Project Team as calendar with cascading allocation | L | scheduler module shares logic; worker→ticket→asset relations | new |
| P-tab6 | P-chain | Project Activity = change-log | S | depends on P-tab3 log model | new |

### C-chain features

See the existing "C-chain — Phase 0 discovery findings (2026-05-18)"
section above. No deltas; nothing has shipped on C-chain since that
discovery, so all open questions (Q4 Client.name vs displayName,
Q5 PDFKit stopgap, push-from-scope extension boundary) remain
locked as recommendations awaiting MAIN's final answer.

### P-chain features

#### P-tab1 — Project Overview restructure

**Purpose:** Make the Project Overview tab the single landing screen
for a delivery-phase project — Manager / Supervisor (only one
authoritative role label) + key dates + financials, no clutter.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:217` (`OverviewTab`)
- Currently renders 3 sections: Financials (4 stats), Team (4 PersonCards — Project Manager / Supervisor / Estimator / WHS Officer), Key dates (4 dates)
- Backend: `Project` schema (`apps/api/prisma/schema.prisma:1854`) has `projectManagerId`, `supervisorId`, and FK relations. `whsOfficer` is part of the `project` payload from `jobInclude`-equivalent in `projects.service.ts`. Estimator comes from the source tender.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Project Overview should not surface Supervisor and WHS Officer as
> primary identity — just one role. The list of PMs is Beau Murphy,
> Colin Hanlon, Sean Lattin, Marco Mantovaninni."

**Restructured intent (MAIN's interpretation):**
- Drop Supervisor + WHS Officer from OverviewTab's Team section (still keep the fields in the underlying schema so reports / dashboards can use them; just hide the UI surface).
- Promote Project Manager to a more prominent slot (currently same size as the other 3 roles).
- Replace the PM picker with a dropdown sourced from the 4 named users (Beau / Colin / Sean / Marco — all confirmed to exist in dev DB as `user-pm-001`, `user-pm-002`, `user-admin`, `user-supervisor-001` respectively).

**Open questions:**
- **Is Supervisor / WHS Officer used elsewhere?** Probe-confirmed they're FK columns on the Project row; UI display in OverviewTab is the primary consumer. Other consumers (reports, dashboard widgets) may exist — would need a grep before deletion. **Recommendation:** hide in UI; do not drop the column.
- **PM dropdown source:** the 4 names align with `user-pm-001`, `user-pm-002`, `user-admin`, `user-supervisor-001`. Should the dropdown filter by a role/permission ("users with `projects.manage`"), or hardcode the 4 user IDs, or query a saved "PM candidates" catalog?
  - **Recommendation:** filter by permission `projects.manage` — most extensible.

**Cross-cutting concerns:**
- Other tabs (Team, Activity) display PM data — restructure shouldn't break those.

**Suggested PR breakdown:**
- Single PR (S complexity). Frontend-only changes to OverviewTab; backend schema unchanged.

#### P-tab2 — Project Documents with type dropdown

**Purpose:** Add a typed-category dropdown (drawings / SWMS / ARCP / DMP / contract / Form65 / etc) to the upload UI so documents can be filtered and the tab becomes a structured catalogue rather than a flat list.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:501` (`DocumentsTab`)
- Backend: `DocumentLink` model (`apps/api/prisma/schema.prisma:262`) already has a `category: String` field (free-form string, not enum) — extensible by design. Seed data shows existing categories: "Contract", "Programme", "Environmental", "SWMS", "Geotechnical".
- Tender-vs-project provenance already tracked via `secondaryEntity` metadata (per seed). Image 9 shows current "tender · 05/05/2026" / "tender · 04/05/2026" labels.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Documents — need a dropdown when uploading: drawings, SWMS, ARCP,
> DMP, contract, Form65… this list may change and/or grow in the future."

**Restructured intent (MAIN's interpretation):**
- Add a dropdown to the upload UI that lets the user pick from a curated category list.
- Store the picked value in the existing `DocumentLink.category` field.
- Provide an admin UI to manage the available category list (since "this list may change and/or grow in the future").

**Open questions:**
- **Extensibility: ENUM, admin catalog, or frontend constant?** Three options:
  - **(a)** Postgres ENUM on `category` — type-safe but every new value needs a migration.
  - **(b)** Admin-managed catalog table (`DocumentCategory` with `name`, `module`, `isActive`, `sortOrder`) — most flexible.
  - **(c)** Frontend constant list — fastest now, painful later.
  - **Recommendation:** **(b)**. The string column already exists; we just add the catalog table + admin UI. Existing values continue to work without migration; new values are admin-added without code change.
- **Should categories be module-scoped?** "Form65" is a project document; "Quote PDF" is a tendering artifact. The catalog table should have a `module` filter so the UI dropdown only shows project-relevant categories.

**Cross-cutting concerns:**
- The same dropdown will eventually appear on Tender Documents (uploading there has its own category needs). Catalog table should be module-aware from day one.
- Document uploads in other modules (Forms, Maintenance) already use `DocumentLink` — consistency check.

**Suggested PR breakdown:**
- **P-tab2a** — Schema + admin catalog (DocumentCategory model + migration + admin CRUD endpoints + admin UI). S/M.
- **P-tab2b** — Wire the dropdown into the Project Documents upload UI. S.

#### P-tab3 — Project Scope with "pull from quote" + change-log

**Purpose:** The Project Scope tab is the frozen-at-conversion view of what's been promised to the client. It should let estimators / PMs see the scope at WBS granularity (DEM1.1, DEM1.2 …) with collapsible groupings, pull the most recent quote arrangement as the starting point, and keep an audit trail of any post-conversion edits.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:292` (`ScopeTab`)
- Currently shows "Scope and rates are frozen at conversion — <timestamp>" + grouped by `scopeCode`. IS-P001 shows "No scope items / No line items were snapshotted from the source tender" — the snapshot at conversion appears not to have populated for that project, which is its own gap to address inside this work.
- Backend has `QuoteScopeItem` (per C-chain discovery) with `sourceItemId`/`sourceItemType` provenance and per-row `sortOrder` + `isVisible`. WBS numbering lives on `ScopeOfWorksItem.wbsCode` (e.g. `DEM1.1`).

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Project Scope — should pull from the quote (preserving discipline
> numbering like DEM1.1, DEM1.2); also needs the same collapse/explode
> rules as the generated quote; needs a change-log for any
> post-conversion edits."

**Restructured intent (MAIN's interpretation):**
- Change the snapshot source: instead of (or in addition to) `ScopeOfWorksItem`, materialise from the **awarded quote's** `QuoteScopeItem` rows — preserves the arrangement the client actually accepted.
- Add a UI mode that mirrors C2/C3's collapse/explode/hide semantics (group by source card, show/hide per row, collapse group).
- Add a change-log: every post-conversion edit (description tweaked, quantity changed, row added) creates a `ProjectActivityLog` entry with `action='SCOPE_EDITED'` (new enum value) and `details` containing before/after.

**Open questions:**
- **Conversion snapshot vs awarded-quote snapshot:** today `convertFromTender` populates a "flat scope". Should it instead read from the awarded `ClientQuote`'s `QuoteScopeItem` rows? If yes, what if no client has been marked AWARDED before conversion? **Recommendation:** prefer awarded-quote source; fall back to tender's raw scope if no awarded quote exists.
- **Collapse/explode UX: build now or wait for C-chain?** P-tab3 depends on the same dnd-kit + grouping work as C2/C3. If C2/C3 ships first, P-tab3 reuses; if P-tab3 ships first, it ships standalone.
  - **Recommendation:** sequence C2/C3 first so P-tab3 reuses the work.
- **Change-log granularity:** per-field, per-line, or per-card? **Recommendation:** per-line (one log entry per scope-row edit, with a diff in `details`). Matches what the existing ProjectActivityLog supports.

**Cross-cutting concerns:**
- Depends on C-chain (C2/C3 ideally precede; D1 also wants this data layer to be quote-arrangement-aware).
- The "pull from quote" semantic means the existing `convertFromTender` snapshot needs an overhaul.

**Suggested PR breakdown:**
- **P-tab3a** — Backend: change snapshot source to awarded quote; fallback path; new ProjectActivityAction enum value. M.
- **P-tab3b** — Frontend: collapse/explode/hide UI (reusing C-chain dnd-kit work if it's shipped). S/M.
- **P-tab3c** — Change-log read+write integration (writes from edits in 3b; reads displayed in P-tab6's Activity tab). S.

#### P-tab4 — Project Schedule from project scope + WBS Gantt

**Purpose:** The Schedule tab's Gantt chart should reflect the WBS used in the project's frozen scope (collapsible / explodable like the scope view), and must read from the project's snapshot — not the tender's raw scope as it does today.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:348` (`ScheduleTab`)
- "Generate from scope" button at line 373 calls `POST /projects/:id/gantt/generate`. The confirmation prompt confirms Marco's complaint: "Generate Gantt tasks from the source tender's scope disciplines?" — explicitly reads from tender, not project.
- Backend service handles this — needs to be located in `projects.service.ts`.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "The Gantt chart should reflect the WBS implemented on scope as well,
> allowing the user to explode or collapse the gantt chart as required.
> Also, it must be the scope on the project, not the one from the
> tender/quote (which is what it is doing right now)."

**Restructured intent (MAIN's interpretation):**
- Change the Gantt-generation read source from tender → project scope snapshot (the new P-tab3a output).
- Add tree-mode to the Gantt: each discipline node (DEM, CIV, etc) can explode to per-WBS-row tasks (DEM1.1, DEM1.2 …) and collapse back to a single discipline-summary bar.
- Default view: collapsed at discipline level; click to expand.

**Open questions:**
- **Gantt library tree-mode:** what library is `GanttChart.tsx:447` using? Custom or third-party? Need to check whether tree-mode is supported natively, requires a fork, or means switching libraries.
- **Source-of-truth ordering:** when the user reorders scope rows via the project scope tab (P-tab3), should the Gantt re-flow automatically, or does it need a manual "regenerate"?
  - **Recommendation:** auto-reflow when scope changes; gives a coherent project view.

**Cross-cutting concerns:**
- Depends on P-tab3a (the project scope snapshot has to be the new source).
- Gantt tree-mode UX may overlap with C2/C3 collapse/explode pattern.

**Suggested PR breakdown:**
- **P-tab4a** — Switch Gantt source from tender → project snapshot. S/M.
- **P-tab4b** — Tree-mode Gantt (explode/collapse). M (depends on library capability).

#### P-tab5 — Project Team as calendar with cascading allocation

**Purpose:** Replace the current "list of workers + list of assets" view with a calendar where managers can click-and-drag to allocate workers and plant to specific dates / activities, with cascading dropdowns (resource type → discipline → eligible worker / asset, filtered by qualifying ticket for plant operators).

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:573` (`TeamTab`)
- Currently fetches `/projects/:id/allocations` + shows two empty sections ("Workers" / "Plant & equipment"). Add-worker / Add-asset modals exist but the UI is list-based, not calendar-based.
- Backend: `WorkerQualification`, `Asset`, `ShiftAssetAssignment`, `AllocationTargetType` enum (`WORKER | ASSET`) all exist in schema. `worker_qualifications` table confirmed (probe at `Phase 2` returned 9 tables matching `%qualif% / %ticket% / %asset%`).

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Project Team — calendar view, click-and-drag allocation, cascading
> dropdowns (labour/plant → discipline → workers, with optional
> qualifying ticket check for plant operators). The logic for the 5th
> tab will be replicated on the scheduler once we reach that stage of
> development. If this needs to be done now, to ensure compatibility
> between modules, then do it."

**Restructured intent (MAIN's interpretation):**
- Replace the list view with a week-view calendar (similar to `SchedulerWorkspacePage.tsx`'s sched-week structure).
- Allocation by click-and-drag on a date range, opens a cascading picker (Resource type → Discipline → eligible Worker/Asset).
- For plant: filter eligible workers by `WorkerQualification` matching the asset's required ticket type. Schema-confirmed: `worker_qualifications` table exists.
- Build with Scheduler-compatible primitives so the same logic can be reused when the standalone Scheduler module ships.

**Open questions:**
- **Build shared logic now (extract calendar component) or duplicate then refactor?**
  - **Recommendation:** extract a `<CalendarAllocator>` component in a shared `apps/web/src/components/calendar/` folder from day one. Marco's brief explicitly said "do it" if compat matters; it does.
- **Worker → ticket → asset relationship in schema:** `WorkerQualification` exists but its FK shape to `Asset` (whether direct or via a ticket-type lookup table) wasn't deeply verified. Sub-discovery needed before implementation prompt.
- **Calendar library choice:** roll our own with date-fns + CSS Grid (consistent with existing `sched-week` styling), or pull in `react-big-calendar` / `fullcalendar`? Recommendation: roll our own — bundle size and styling consistency win out.

**Cross-cutting concerns:**
- Heavy overlap with the future Scheduler module. Architectural decision required up-front.
- Depends on accurate `WorkerQualification` data (currently dev-DB has migration drift on this table — confirm dataset is queryable before building UI).

**Suggested PR breakdown:**
- **P-tab5a** — Sub-discovery pass on worker→ticket→asset schema + scheduler-shared-component boundary. (Read-only pass like this current PR.) S.
- **P-tab5b** — `<CalendarAllocator>` shared component built generically. M.
- **P-tab5c** — Wire P-tab5 to use `<CalendarAllocator>` + cascading dropdown UX. M.

#### P-tab6 — Project Activity = change-log

**Purpose:** Make the Activity tab the unified view of every state change, scope edit, document upload/removal, and team allocation event on the project — a single audit trail.

**Current state:**
- File: `apps/web/src/pages/projects/ProjectDetailPage.tsx:1214` (`ActivityTab`)
- Backend: `ProjectActivityLog` model exists (`apps/api/prisma/schema.prisma:1936`) with `action: ProjectActivityAction` enum (line 1827) — already supports `PROJECT_CREATED`, `STATUS_CHANGED`, `TEAM_CHANGED`, `CONTRACT_VALUE_CHANGED`, `BUDGET_CHANGED`, `DOCUMENT_ADDED`, `DOCUMENT_REMOVED`, `WORKER_ALLOCATED`, `ASSET_ALLOCATED`, `TIMESHEET_SUBMITTED`, `TIMESHEET_REJECTED`, `PRESTART_SUBMITTED`.
- Image 11/12 confirms current UI is exactly this — generic event log with click-to-expand JSON details.
- Marco's note "this is the log I was talking about" effectively confirms the existing tab matches the intent.

**Proposed change (Marco's brief, verbatim where ambiguous):**
> "Activity tab — this is the log I was talking about (referencing
> the change-log requirement from tab 3)."

**Restructured intent (MAIN's interpretation):**
- The existing tab already does what Marco wants for status / team / financial / document / allocation events.
- The gap is **scope edits** — `ProjectActivityAction` doesn't have `SCOPE_EDITED` yet. That's the cross-link to P-tab3.

**Open questions:**
- **Granularity of the new SCOPE_EDITED action:** per-line, per-card, per-field? **Recommendation:** per-line with a diff payload in `details` (mirrors what P-tab3 surfaces).

**Cross-cutting concerns:**
- P-tab3 must add the `SCOPE_EDITED` enum value + the write-path. P-tab6 just gets a new icon / label for that action.

**Suggested PR breakdown:**
- **P-tab6a** — Add `SCOPE_EDITED` rendering to ActivityTab + icon/label for the new event type. Bundled with P-tab3a or shipped together. S.

#### P-platform1 — App-wide error boundary infrastructure

**Purpose:** Generalise the surgical error-boundary pattern landed
on JobDetailPage (PR fix/B01) into a platform-wide capability so
every routed page wraps its sections in a defensive boundary, and
the top-level router shell catches anything that escapes a page
boundary.

**Current state:**
- File: `apps/web/src/components/ErrorBoundary.tsx` — small class
  component with `sectionName` + optional `fallback` + `onReset`,
  dev-mode `console.error` via `import.meta.env.DEV`, default
  fallback styled by `.error-boundary-fallback` in `styles.css`.
- Only consumer: `apps/web/src/pages/jobs/JobDetailPage.tsx` —
  seven tab sections each wrapped, one boundary per section.
- No router-level boundary; an exception in any non-job page or
  in the layout itself still blanks the app.

**Proposed change:**
- Audit every routed page under `apps/web/src/pages/` (jobs,
  projects, tendering, scheduler, forms, archive, etc) and wrap
  each tab / panel / list surface in `<ErrorBoundary sectionName=…>`.
- Add a top-level `<ErrorBoundary sectionName="App">` in
  `apps/web/src/main.tsx` (or the equivalent shell) around the
  `<RouterProvider>` to catch anything that escapes a page.
- Promote `ErrorBoundary` from `apps/web/src/components/` to
  `packages/ui/src/` so non-web workspaces (e.g. a future native
  shell) can reuse it. Re-export from `@project-ops/ui`.
- Add a Sentry / telemetry hook on `componentDidCatch` (gated by
  env var) so production crashes are observable, not just the dev
  console log.

**Open questions:**
- **Telemetry sink:** Sentry, Application Insights (Azure-native),
  or a custom audit-log POST? Recommendation: Application
  Insights — Azure stack alignment, no extra vendor.
- **Boundary granularity per page:** one boundary per route, or
  one per panel (the JobDetailPage pattern)? Recommendation:
  per-panel where panels are independently mounted (tabs,
  modals, side rails); one per route is the minimum.
- **Fallback styling consistency:** today's fallback is one CSS
  block. As we add boundaries everywhere we'll want a shared
  `<SectionErrorFallback />` UI primitive in `@project-ops/ui`.

**Cross-cutting concerns:**
- Touches every page in `apps/web/src/pages/` — large surface area
  but each wrap is mechanical.
- Telemetry integration adds an env-var contract (S4-adjacent).
- The promote-to-`@project-ops/ui` step affects the import path
  on the one existing consumer (JobDetailPage) — trivial edit.

**Suggested PR breakdown:**
- **P-platform1a** — Promote `ErrorBoundary` to `packages/ui`;
  update the JobDetailPage import; add a `<SectionErrorFallback />`
  primitive. S.
- **P-platform1b** — Wrap every routed page's panel surfaces.
  M (mechanical but wide).
- **P-platform1c** — Top-level shell boundary in `main.tsx`. S.
- **P-platform1d** — Application Insights wiring + env-var
  contract documented in `environment-reference.md`. S/M.

#### P-platform2 — API/FE type contract enforcement

**Status:** Future work
**Complexity:** L
**Source:** Surfaced by B01.1 root-cause analysis (2026-05-18)
**Depends on:** none

The B01.1 bug existed because the FE TypeScript type for a job
declared a top-level `activities` field that the API never
sends. TypeScript couldn't catch this because API responses
are effectively `any` at the fetch boundary. Two systemic
approaches to fix this class of bug:

**Approach A — OpenAPI codegen:**
- API exposes OpenAPI spec (NestJS has built-in support)
- FE codegens types from the spec
- Build-time guarantee that FE and API shapes match
- One-shot setup; ongoing type drift detection in CI

**Approach B — Runtime validation (Zod):**
- Define Zod schemas for each API response
- authFetch (or a wrapper) runs `schema.parse()` on incoming JSON
- Runtime errors at the boundary with clear messages
- More flexible than codegen, slightly slower at runtime

**Recommendation when this is picked up:** Hybrid.
- Zod schemas as the source of truth
- TS types derived via `z.infer<>`
- Optional: codegen API DTOs from the same schemas (e.g. via
  ts-rest or tRPC) for end-to-end consistency

**Estimated PRs:** 3–4
- **P-platform2a** — choose tool, set up Zod + first schema (POC
  on `/jobs/:id` since we already know its shape from B01.1)
- **P-platform2b** — migrate hot-path endpoints (`/jobs`,
  `/tenders`, `/projects`, `/clients`)
- **P-platform2c** — migrate remaining endpoints + remove `any`
  casts at fetch boundary
- **P-platform2d** (optional) — codegen API DTOs from the same
  schemas

**Why not now:** Out of scope for B01.1 (one-line render-phase
fix shouldn't drag a 3–4 PR platform change behind it).
Captured here so the architectural debt isn't lost.

#### P-platform3 — Service Worker update strategy

**Status:** Future work
**Complexity:** S
**Source:** Surfaced by B01.1 deployment (2026-05-18) — Claude
Code flagged that the PWA service worker may cache the broken
bundle and require hard-refresh / "Update on reload" to see
fixes
**Depends on:** none

The PWA's current service worker setup is offline-first
(correct for the field worker use case) but creates "code
shipped, user still sees broken version" friction for office
users on each release. After B01.1 merged, Marco needed to
Ctrl+Shift+R to flush the cached bundle before the fix was
visible.

**Approach A — Skip-waiting + automatic update prompt:**
- Service worker calls `self.skipWaiting()` on new install
- Client posts message to user: "Update available. Reload?"
- User clicks → page reloads with fresh bundle
- Standard Workbox pattern

**Approach B — Versioned cache busting:**
- Cache name includes a build hash (e.g. `app-cache-v{hash}`)
- Old caches deleted on activation
- Less UX friction but no user notification of new version
- Requires build-time injection of hash

**Recommendation when this is picked up:** Approach A with a
non-blocking toast notification. Office users get notified
and can update at a natural break; field users on offline
workflows are unaffected because the toast only fires when
actually online.

**Estimated PRs:** 1–2
- **P-platform3a** — skip-waiting wiring + update toast component
- **P-platform3b** (optional) — telemetry on SW version skew
  events (Application Insights, if P-platform1d has shipped)

**Why not now:** Office users can hard-refresh after each
release. The friction is real but not blocking. Captured here
so it isn't forgotten when the user base grows beyond Sean
and Raj.

### Cross-cutting decisions (must be locked before implementation)

1. **Worker dropdown source-of-truth** — `User` table, `WorkerProfile` table, or hybrid? Recommendation: `User` table filtered by `permissions.includes('projects.manage')` for PM dropdown; `WorkerProfile` for field-worker allocation. The two models have different audiences.
2. **Document type extensibility** — ENUM, admin catalog, or frontend constant? **Recommendation: admin catalog (`DocumentCategory` table with `module` scoping).** No migration per category change.
3. **Scheduler shared logic** — build P-tab5 calendar logic now with Scheduler in mind, or build standalone then refactor when Scheduler ships? **Recommendation: build shared `<CalendarAllocator>` from day one.** Marco explicitly said "do it" if compat matters.
4. **Project scope change-log granularity** — per-field, per-line, per-card? **Recommendation: per-line.** Matches the granularity of the existing ProjectActivityLog `details: Json` payload.
5. **C-chain vs P-chain priority** — both depend on each other partially (P-tab3 reuses C2/C3 UX patterns; P-tab5 is independent of either). **Recommendation:** C-chain first (C1→C2→C3 at minimum) so P-tab3 / P-tab4 can reuse the collapse/explode/hide infrastructure. P-tab1, P-tab2, P-tab5, P-tab6 can ship in parallel with the C-chain since they don't share UX patterns.

— end of Design Map —



---

<!-- ═══ sot/06 merged spec — source: docs/security/permission-matrix.md ═══ -->

# API permission matrix — route × role expected authorization

Generated from controller source (`@Controller`, `@UseGuards`, `@RequirePermissions` decorators) on the
`test/permission-matrix` branch. This is the **expected** behaviour contract; the serial suite
`apps/api/src/common/auth/__tests__/permission-matrix.spec.ts` asserts the high-value route groups live
against a seeded database. F1 (global-list creation) and F4 (worker leave / unavailability writes) from
`docs/pr-prompts/needs-marco/pr-188-authz-findings.md` were tightened in PR-188b — F1 is now gated by
`masterdata.manage` and F4 by `resources.manage`. The matrix below reflects the post-PR-188b state.

## Roles used

| Column | User | Grants |
|---|---|---|
| Admin | `admin@projectops.local` (Admin role) | Every permission in the registry |
| Viewer | `viewer@projectops.local` (Viewer role) | Exactly 17 `.view` codes (narrowed by `seed-initial-services.ts`): users, roles, permissions, dashboards, masterdata, resources, assets, maintenance, forms, documents, tenders, tenderdocuments, jobs, scheduler, search, notifications, directory. **Not** granted: audit, estimates, projects, compliance, safety, finance, field, sharepoint `.view` codes |
| Anon | no Authorization header | — |

## Cell legend

- **200** — request passes both guards (actual status may be 2xx/400/404 depending on payload/ids; never 401/403)
- **403** — `PermissionsGuard` (or service-level tier check) rejects
- **401** — `JwtAuthGuard` rejects (missing/invalid token)
- **public** — no auth required
- **portal** — separate portal identity pool (`PortalJwtGuard`); staff JWTs are rejected there and portal JWTs are rejected on staff routes
- ✎ — write verb intentionally gated by a `.view` permission (per-user/self-service semantics)

## Enforcement conventions

- Guards are **not global**: every protected controller opts in with class-level
  `@UseGuards(JwtAuthGuard, PermissionsGuard)` plus per-route `@RequirePermissions("...")`.
- `PermissionsGuard` lets SuperUsers bypass all permission checks.
- `admin/users` and `personas/global-settings` enforce tiers in the service/handler instead of decorators.
- A route with guards but **no** `@RequirePermissions` metadata is auth-only (any valid staff JWT passes).

## Matrix

### `health/health.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/health` | — | public | public | public |  |

### `modules/admin-settings/admin-settings.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/settings/notifications` | `platform.admin` | 200 | 403 | 401 |  |
| PATCH | `/admin/settings/notifications/:trigger` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/admin/settings/email` | `platform.admin` | 200 | 403 | 401 |  |
| PATCH | `/admin/settings/email` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/admin/settings/email/test` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/admin/settings/users` | `platform.admin` | 200 | 403 | 401 |  |

### `modules/admin-users/admin-users.controller.ts` — guards: JwtAuthGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/users` | — | 200 | 403 | 401 | Tier-based in service: SuperUser/Admin only; everyone else 403. |
| POST | `/admin/users` | — | 200 | 403 | 401 | Tier-based in service (Admin+); Admins cannot create Admins/SuperUsers. |
| PATCH | `/admin/users/:userId` | — | 200 | 403 | 401 | Tier-based in service (Admin+). |
| DELETE | `/admin/users/:userId` | — | 200 | 403 | 401 | Tier-based in service (Admin+). |
| POST | `/admin/users/:userId/reset-password` | — | 200 | 403 | 401 | Tier-based in service (Admin+). |

### `modules/ai-settings/ai-settings.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/ai-settings/company/keys` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/ai-settings/company/keys/:provider` | `platform.admin` | 200 | 403 | 401 |  |
| DELETE | `/ai-settings/company/keys/:provider` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/ai-settings/me/keys` | `ai.persona.tendering` | 200 | 403 | 401 |  |
| POST | `/ai-settings/me/keys/:provider` | `ai.persona.tendering` | 200 | 403 | 401 |  |
| DELETE | `/ai-settings/me/keys/:provider` | `ai.persona.tendering` | 200 | 403 | 401 |  |

### `modules/allocations/allocations.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects/:projectId/allocations` | `projects.view` | 200 | 403 | 401 |  |
| POST | `/projects/:projectId/allocations` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/projects/:projectId/allocations/:allocId` | `resources.manage` | 200 | 403 | 401 |  |
| DELETE | `/projects/:projectId/allocations/:allocId` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/archive/archive.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/archive` | `jobs.view` | 200 | 200 | 401 |  |
| GET | `/archive/:jobId/export` | `jobs.view` | 200 | 200 | 401 |  |

### `modules/assets/assets.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/assets/categories` | `assets.view` | 200 | 200 | 401 |  |
| POST | `/assets/categories` | `assets.manage` | 200 | 403 | 401 |  |
| PATCH | `/assets/categories/:id` | `assets.manage` | 200 | 403 | 401 |  |
| GET | `/assets` | `assets.view` | 200 | 200 | 401 |  |
| GET | `/assets/:id` | `assets.view` | 200 | 200 | 401 |  |
| POST | `/assets` | `assets.manage` | 200 | 403 | 401 |  |
| PATCH | `/assets/:id` | `assets.manage` | 200 | 403 | 401 |  |

### `modules/audit/audit.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/audit-logs` | `audit.view` | 200 | 403 | 401 |  |

### `modules/auth/auth.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/auth/login` | — | public | public | public |  |
| POST | `/auth/entra` | — | public | public | public |  |
| POST | `/auth/sso` | — | public | public | public |  |
| POST | `/auth/refresh` | — | public | public | public |  |
| POST | `/auth/reset-password` | — | public | public | public |  |
| GET | `/auth/config` | — | public | public | public |  |
| GET | `/auth/me` | — | 200 | 200 | 401 | Auth-only; returns the JWT principal. |

### `modules/client-quotes/client-quotes.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/quotes` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId` | `tenders.view` | 200 | 200 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/summary` | `tenders.view` | 200 | 200 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/cost-lines` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/cost-lines` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/cost-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/cost-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/cost-lines/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/provisional-lines` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/provisional-lines` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/provisional-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/provisional-lines/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/cost-options` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/cost-options` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/cost-options/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/cost-options/:lineId` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/assumptions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/assumptions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/assumptions/copy-from-tender` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/exclusions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/exclusions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/exclusions/copy-from-tender` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/quotes/client-suggestion/:clientId` | `tenders.view` | 200 | 200 | 401 |  |
| GET | `/tenders/:tenderId/quotes/:quoteId/pdf` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/send` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/client-quotes/quote-scope-items.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/quotes/:quoteId/scope-items` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/quotes/:quoteId/scope-items/:itemId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/quotes/:quoteId/scope-items/:itemId` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items/reset` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/quotes/:quoteId/scope-items/push-from-scope` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/compliance/compliance.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/compliance/dashboard` | `compliance.view` | 200 | 403 | 401 |  |
| GET | `/compliance/expiring` | `compliance.view` | 200 | 403 | 401 |  |
| GET | `/compliance/blocked-subcontractors` | `compliance.view` | 200 | 403 | 401 |  |
| GET | `/compliance/workers/:workerProfileId/qualifications` | `compliance.view` | 200 | 403 | 401 |  |
| POST | `/compliance/workers/:workerProfileId/qualifications` | `compliance.manage` | 200 | 403 | 401 |  |
| PATCH | `/compliance/workers/:workerProfileId/qualifications/:qualId` | `compliance.manage` | 200 | 403 | 401 |  |
| DELETE | `/compliance/workers/:workerProfileId/qualifications/:qualId` | `compliance.manage` | 200 | 403 | 401 |  |
| GET | `/compliance/workers/:workerId/competency-check` | `compliance.view` | 200 | 403 | 401 |  |
| POST | `/compliance/alerts/send-now` | `compliance.admin` | 200 | 403 | 401 |  |
| PATCH | `/compliance/subcontractors/:id/block` | `compliance.admin` | 200 | 403 | 401 |  |

### `modules/contacts/contacts.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/contacts` | `directory.view` | 200 | 200 | 401 |  |
| GET | `/contacts/:id` | `directory.view` | 200 | 200 | 401 |  |
| POST | `/contacts` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/contacts/:id` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/contacts/:id` | `directory.manage` | 200 | 403 | 401 |  |

### `modules/contracts/contracts.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/contracts` | `finance.view` | 200 | 403 | 401 |  |
| GET | `/contracts/:id` | `finance.view` | 200 | 403 | 401 |  |
| POST | `/contracts` | `finance.manage` | 200 | 403 | 401 |  |
| PATCH | `/contracts/:id` | `finance.manage` | 200 | 403 | 401 |  |
| GET | `/contracts/:id/variations` | `finance.view` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/variations` | `finance.manage` | 200 | 403 | 401 |  |
| PATCH | `/contracts/:id/variations/:variationId` | `finance.manage` | 200 | 403 | 401 |  |
| GET | `/contracts/:id/claims` | `finance.view` | 200 | 403 | 401 |  |
| GET | `/contracts/:id/claims/:claimId` | `finance.view` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims` | `finance.manage` | 200 | 403 | 401 |  |
| PATCH | `/contracts/:id/claims/:claimId/items/:itemId` | `finance.manage` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims/:claimId/submit` | `finance.manage` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims/:claimId/approve` | `finance.admin` | 200 | 403 | 401 |  |
| POST | `/contracts/:id/claims/:claimId/pay` | `finance.admin` | 200 | 403 | 401 |  |

### `modules/directory/directory.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/directory` | `directory.view` | 200 | 200 | 401 |  |
| GET | `/directory/expiry-alerts` | `directory.view` | 200 | 200 | 401 |  |
| GET | `/directory/:id` | `directory.view` | 200 | 200 | 401 |  |
| POST | `/directory` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id` | `directory.admin` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/prequal` | `directory.admin` | 200 | 403 | 401 |  |
| POST | `/directory/:id/contacts` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/contacts/:contactId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/contacts/:contactId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/licences` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/insurances` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/credit-applications` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/credit-applications/:appId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/directory/:id/documents` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/directory/:id/documents/:docId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/directory/:id/documents/:docId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/clients/:clientId/licences` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/clients/:clientId/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/clients/:clientId/licences/:licenceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/clients/:clientId/insurances` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/clients/:clientId/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| DELETE | `/clients/:clientId/insurances/:insuranceId` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/clients/:clientId/credit-applications` | `directory.manage` | 200 | 403 | 401 |  |
| PATCH | `/clients/:clientId/credit-applications/:appId` | `directory.manage` | 200 | 403 | 401 |  |

### `modules/documents/documents.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/documents` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/entity/:linkedEntityType/:linkedEntityId` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/sites/:siteId/documents` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/:id` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/:id/open-link` | `documents.view` | 200 | 200 | 401 |  |
| GET | `/documents/:id/download` | `documents.view` | 200 | 200 | 401 |  |
| POST | `/documents` | `documents.manage` | 200 | 403 | 401 |  |
| POST | `/documents/:id/versions` | `documents.manage` | 200 | 403 | 401 |  |

### `modules/estimate-export/estimate-export.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:id/export/pdf` | `tenders.view` | 200 | 200 | 401 |  |
| GET | `/tenders/:id/export/excel` | `tenders.view` | 200 | 200 | 401 |  |

### `modules/estimates/estimates.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/estimate-rates/labour` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/labour` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/labour/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/labour/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/plant` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/plant` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/plant/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/plant/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/waste` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/waste` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/waste/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/waste/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/cutting` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/cutting` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/cutting/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/cutting/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/core-holes` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/core-holes` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/core-holes/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/core-holes/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/fuel` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/fuel` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/fuel/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/fuel/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/enclosure` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/enclosure` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/enclosure/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/enclosure/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/other-rates` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/other-rates` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/other-rates/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/other-rates/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/estimate-rates/material-densities` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/estimate-rates/material-densities` | `estimates.admin` | 200 | 403 | 401 |  |
| PATCH | `/estimate-rates/material-densities/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| DELETE | `/estimate-rates/material-densities/:id` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/estimate` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/lock` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/unlock` | `estimates.admin` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/estimate/summary` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/labour` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/labour/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/labour/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/plant` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/plant/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/plant/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/equip` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/equip/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/equip/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/waste` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/waste/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/waste/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/cutting` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/cutting/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/cutting/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/estimate/items/:itemId/assumptions` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/estimate/items/:itemId/assumptions/:lineId` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/field/field.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/field/my-allocations` | `field.view` | 200 | 403 | 401 |  |
| GET | `/field/my-allocations/:allocationId/documents` | `field.view` | 200 | 403 | 401 |  |
| GET | `/field/pre-starts` | `field.view` | 200 | 403 | 401 |  |
| POST | `/field/pre-starts` | `field.view` | 200 | 403 ✎ | 401 |  |
| GET | `/field/pre-starts/:id` | `field.view` | 200 | 403 | 401 |  |
| PATCH | `/field/pre-starts/:id` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/pre-starts/:id/submit` | `field.view` | 200 | 403 ✎ | 401 |  |
| GET | `/field/timesheets` | `field.view` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/pending` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/all` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/payroll-export.csv` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/timesheets/summary` | `field.manage` | 200 | 403 | 401 |  |
| POST | `/field/timesheets/bulk-approve` | `field.manage` | 200 | 403 | 401 |  |
| GET | `/field/location-consent` | `field.view` | 200 | 403 | 401 |  |
| POST | `/field/location-consent` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/timesheets` | `field.view` | 200 | 403 ✎ | 401 |  |
| PATCH | `/field/timesheets/:id` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/timesheets/:id/submit` | `field.view` | 200 | 403 ✎ | 401 |  |
| POST | `/field/timesheets/:id/approve` | `field.manage` | 200 | 403 | 401 |  |
| POST | `/field/timesheets/:id/reject` | `field.manage` | 200 | 403 | 401 |  |

### `modules/forms/forms-engine.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/forms/submissions` | `forms.submit` | 200 | 403 | 401 |  |
| PATCH | `/forms/submissions/:id/values` | `forms.submit` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/submit` | `forms.submit` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/approve` | `forms.approve` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/reject` | `forms.approve` | 200 | 403 | 401 |  |
| POST | `/forms/submissions/:id/resubmit` | `forms.submit` | 200 | 403 | 401 |  |
| GET | `/forms/my-submissions` | `forms.submit` | 200 | 403 | 401 |  |
| GET | `/forms/pending-approvals` | `forms.approve` | 200 | 403 | 401 |  |
| GET | `/forms/analytics` | `forms.manage` | 200 | 403 | 401 |  |

### `modules/forms/forms.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/forms/templates` | `forms.view` | 200 | 200 | 401 |  |
| GET | `/forms/templates/:id` | `forms.view` | 200 | 200 | 401 |  |
| POST | `/forms/templates` | `forms.manage` | 200 | 403 | 401 |  |
| POST | `/forms/templates/:id/versions` | `forms.manage` | 200 | 403 | 401 |  |
| GET | `/forms/submissions` | `forms.view` | 200 | 200 | 401 |  |
| GET | `/forms/submissions/:id` | `forms.view` | 200 | 200 | 401 |  |
| POST | `/forms/versions/:versionId/submissions` | `forms.manage` | 200 | 403 | 401 |  |

### `modules/global-lists/global-lists.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/lists` | — | 200 | 200 | 401 |  |
| GET | `/lists/:slug` | — | 200 | 200 | 401 |  |
| GET | `/lists/:slug/items` | — | 200 | 200 | 401 |  |
| POST | `/lists` | `masterdata.manage` | 200 | 403 | 401 | PR-188b F1: gated by `masterdata.manage`. Viewer does not hold this code. |
| POST | `/lists/:slug/items` | `masterdata.manage` | 200 | 403 | 401 | PR-188b F1: gated by `masterdata.manage`. Viewer does not hold this code. |
| PATCH | `/lists/:slug/items/:itemId` | — | 200 | 200 | 401 | Creator-or-admin enforced in service. |
| DELETE | `/lists/:slug/items/:itemId` | — | 200 | 200 | 401 | Creator-or-admin enforced in service. |
| POST | `/lists/:slug/items/reorder` | — | 200 | 200 | 401 | System lists require platform.admin (service check); user lists free-for-all. |

### `modules/inventory/inventory.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/inventory/categories` | `inventory.view` | 200 | 200 | 401 |  |
| POST | `/inventory/categories` | `inventory.manage` | 200 | 403 | 401 |  |
| PATCH | `/inventory/categories/:id` | `inventory.manage` | 200 | 403 | 401 |  |
| GET | `/inventory/items` | `inventory.view` | 200 | 200 | 401 |  |
| GET | `/inventory/items/:id` | `inventory.view` | 200 | 200 | 401 |  |
| POST | `/inventory/items` | `inventory.manage` | 200 | 403 | 401 |  |
| PATCH | `/inventory/items/:id` | `inventory.manage` | 200 | 403 | 401 |  |
| POST | `/inventory/items/:id/movements` | `inventory.manage` | 200 | 403 | 401 |  |
| GET | `/inventory/items/:id/movements` | `inventory.view` | 200 | 200 | 401 |  |
| POST | `/inventory/stocktakes` | `inventory.manage` | 200 | 403 | 401 |  |
| GET | `/inventory/stocktakes` | `inventory.view` | 200 | 200 | 401 |  |
| GET | `/inventory/stocktakes/:id` | `inventory.view` | 200 | 200 | 401 |  |
| POST | `/inventory/stocktakes/:id/counts` | `inventory.manage` | 200 | 403 | 401 |  |
| POST | `/inventory/stocktakes/:id/commit` | `inventory.manage` | 200 | 403 | 401 |  |
| POST | `/inventory/stocktakes/:id/cancel` | `inventory.manage` | 200 | 403 | 401 |  |

### `modules/jobs/jobs.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/jobs` | `jobs.view` | 200 | 200 | 401 |  |
| GET | `/jobs/archive` | `jobs.view` | 200 | 200 | 401 |  |
| POST | `/jobs` | `jobs.manage` | 200 | 403 | 401 |  |
| GET | `/jobs/:id` | `jobs.view` | 200 | 200 | 401 |  |
| PATCH | `/jobs/:id` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/status` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/stages` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/stages/:stageId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/activities` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/activities/:activityId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/issues` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/issues/:issueId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/variations` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/variations/:variationId` | `jobs.manage` | 200 | 403 | 401 |  |
| POST | `/jobs/:id/progress-entries` | `jobs.manage` | 200 | 403 | 401 |  |
| PATCH | `/jobs/:id/closeout` | `jobs.manage` | 200 | 403 | 401 |  |

### `modules/jobs/tender-conversion.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| PATCH | `/tenders/:tenderId/award` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/contract` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/convert-to-job` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/convert-to-job/reuse-archived` | `tenderconversion.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/rollback-lifecycle` | `tenderconversion.manage` | 200 | 403 | 401 |  |

### `modules/maintenance/maintenance.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/maintenance/assets` | `maintenance.view` | 200 | 200 | 401 |  |
| GET | `/maintenance/assets/utilisation` | `maintenance.view` | 200 | 200 | 401 |  |
| GET | `/maintenance/assets/:assetId` | `maintenance.view` | 200 | 200 | 401 |  |
| GET | `/maintenance/plans` | `maintenance.view` | 200 | 200 | 401 |  |
| POST | `/maintenance/plans` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/plans/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| POST | `/maintenance/events` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/events/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| POST | `/maintenance/inspections` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/inspections/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| POST | `/maintenance/breakdowns` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/breakdowns/:id` | `maintenance.manage` | 200 | 403 | 401 |  |
| PATCH | `/maintenance/assets/:assetId/status` | `maintenance.manage` | 200 | 403 | 401 |  |

### `modules/master-data/master-data.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/master-data/clients` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/clients` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/clients/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/contacts` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/contacts` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/contacts/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/sites` | `masterdata.view` | 200 | 200 | 401 |  |
| GET | `/master-data/sites/:id` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/sites` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/sites/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| DELETE | `/master-data/sites/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/resource-types` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/resource-types` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/resource-types/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/competencies` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/competencies` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/competencies/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/workers` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/workers` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/workers/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/crews` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/crews` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/crews/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/assets` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/assets` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/assets/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/worker-competencies` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/worker-competencies` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/worker-competencies/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/lookup-values` | `masterdata.view` | 200 | 200 | 401 |  |
| POST | `/master-data/lookup-values` | `masterdata.manage` | 200 | 403 | 401 |  |
| PATCH | `/master-data/lookup-values/:id` | `masterdata.manage` | 200 | 403 | 401 |  |
| GET | `/master-data/references` | `masterdata.view` | 200 | 200 | 401 |  |

### `modules/permissions/permissions.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/permissions` | `permissions.view` | 200 | 200 | 401 |  |

### `modules/personas/personas.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/personas/global-settings` | — | 200 | 200 | 401 | isSuperUser enforced in handler. |
| PUT | `/personas/global-settings` | — | 200 | 200 | 401 | isSuperUser enforced in handler. |
| GET | `/personas` | — | 200 | 200 | 401 |  |
| GET | `/personas/active-for-route` | — | 200 | 200 | 401 |  |
| GET | `/personas/:slug` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| PUT | `/personas/:slug/company-instruction` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| GET | `/personas/:slug/my-settings` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| PUT | `/personas/:slug/my-settings` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| POST | `/personas/:slug/chat` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| GET | `/personas/:slug/conversations` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| GET | `/personas/:slug/conversations/:id` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| POST | `/personas/:slug/conversations/new` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |
| DELETE | `/personas/:slug/conversations/:id` | — | 200 | 200 | 401 | PersonaPermissionGuard (method-level) — requires the persona's own permission (e.g. `ai.persona.tendering`). |

### `modules/platform/dashboards.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/dashboards` | `dashboards.view` | 200 | 200 | 401 |  |
| GET | `/dashboards/:id/render` | `dashboards.view` | 200 | 200 | 401 |  |
| POST | `/dashboards` | `dashboards.manage` | 200 | 403 | 401 |  |
| PATCH | `/dashboards/:id` | `dashboards.manage` | 200 | 403 | 401 |  |

### `modules/platform/notifications.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/notifications/me` | `notifications.view` | 200 | 200 | 401 |  |
| POST | `/notifications` | `notifications.manage` | 200 | 403 | 401 |  |
| POST | `/notifications/follow-ups/manual` | `notifications.manage` | 200 | 403 | 401 |  |
| GET | `/notifications/follow-ups/shared` | `notifications.view` | 200 | 200 | 401 |  |
| POST | `/notifications/follow-ups/sync` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/triage` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/assign` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/resolve` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/accept-handoff` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/follow-ups/:id/accept-escalation` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/:id/read` | `notifications.manage` | 200 | 403 | 401 |  |
| PATCH | `/notifications/read-all` | `notifications.manage` | 200 | 403 | 401 |  |

### `modules/platform/platform-config.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/platform-config` | `platform.admin` | 200 | 403 | 401 |  |
| PATCH | `/admin/platform-config` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-anthropic` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-gemini` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-groq` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/admin/platform-config/test-openai` | `platform.admin` | 200 | 403 | 401 |  |

### `modules/platform/platform-config.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/admin/ai-providers/:provider/models` | `platform.admin` | 200 | 403 | 401 |  |

### `modules/platform/platform.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/platform/config` | `sharepoint.view` | 200 | 403 | 401 |  |

### `modules/platform/search.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/search` | `search.view` | 200 | 200 | 401 |  |
| POST | `/search/entries` | `search.view` | 200 | 200 ✎ | 401 |  |

### `modules/platform/sharepoint.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/sharepoint/folders` | `sharepoint.view` | 200 | 403 | 401 |  |
| POST | `/sharepoint/folders/ensure` | `sharepoint.manage` | 200 | 403 | 401 |  |
| GET | `/sharepoint/test` | `sharepoint.manage` | 200 | 403 | 401 |  |

### `modules/platform/user-dashboards.controller.ts` — guards: JwtAuthGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/user-dashboards` | — | 200 | 200 | 401 |  |
| POST | `/user-dashboards` | — | 200 | 200 | 401 |  |
| GET | `/user-dashboards/:id` | — | 200 | 200 | 401 |  |
| PATCH | `/user-dashboards/:id` | — | 200 | 200 | 401 |  |
| DELETE | `/user-dashboards/:id` | — | 200 | 200 | 401 |  |
| POST | `/user-dashboards/:id/default` | — | 200 | 200 | 401 |  |

### `modules/portal/portal-auth.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/portal/auth/login` | — | public | public | public |  |
| POST | `/portal/auth/refresh` | — | public | public | public |  |
| POST | `/portal/auth/logout` | — | public | public | public |  |
| POST | `/portal/auth/accept-invite` | — | public | public | public |  |
| POST | `/portal/auth/request-reset` | — | public | public | public |  |
| POST | `/portal/auth/reset-password` | — | public | public | public |  |
| GET | `/portal/auth/me` | — | 200 | 200 | 401 | Portal token endpoint (separate identity pool). |
| POST | `/portal/invites` | — | portal | portal | 401 | PortalJwtGuard + portal.invite (method-level). |

### `modules/portal/portal-client.controller.ts` — guards: PortalJwtGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/portal/client/dashboard` | — | portal | portal | 401 |  |
| GET | `/portal/client/projects` | — | portal | portal | 401 |  |
| GET | `/portal/client/projects/:id` | — | portal | portal | 401 |  |
| GET | `/portal/client/jobs` | — | portal | portal | 401 |  |
| GET | `/portal/client/quotes` | — | portal | portal | 401 |  |
| GET | `/portal/client/documents` | — | portal | portal | 401 |  |
| GET | `/portal/client/account` | — | portal | portal | 401 |  |

### `modules/projects/gantt.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects/:projectId/gantt` | `projects.view` | 200 | 403 | 401 |  |
| POST | `/projects/:projectId/gantt` | `projects.manage` | 200 | 403 | 401 |  |
| PATCH | `/projects/:projectId/gantt/:taskId` | `projects.manage` | 200 | 403 | 401 |  |
| DELETE | `/projects/:projectId/gantt/:taskId` | `projects.manage` | 200 | 403 | 401 |  |
| POST | `/projects/:projectId/gantt/generate` | `projects.manage` | 200 | 403 | 401 |  |

### `modules/projects/projects-timeline.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects-timeline` | `projects.view` | 200 | 403 | 401 |  |

### `modules/projects/projects.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/projects/next-number` | — | 200 | 200 | 401 | Auth-only — no permission metadata. See findings doc. |
| GET | `/projects` | `projects.view` | 200 | 403 | 401 |  |
| GET | `/projects/:id` | `projects.view` | 200 | 403 | 401 |  |
| POST | `/projects` | `projects.admin` | 200 | 403 | 401 |  |
| PATCH | `/projects/:id` | `projects.manage` | 200 | 403 | 401 |  |
| POST | `/projects/:id/status` | `projects.manage` | 200 | 403 | 401 |  |
| GET | `/projects/:id/activity` | `projects.view` | 200 | 403 | 401 |  |
| GET | `/projects/:id/revert-to-tender/preflight` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/projects/:id/revert-to-tender` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/quote/quote.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/tandc` | `tenders.view` | 200 | 200 | 401 |  |
| PATCH | `/tenders/:tenderId/tandc` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/tandc/reset` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/tandc/reset/:clauseNumber` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/assumptions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/assumptions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/assumptions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/assumptions/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/exclusions` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/exclusions` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/exclusions/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/exclusions/reorder` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/exports` | `tenders.view` | 200 | 200 | 401 |  |

### `modules/resources/resources.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/resources/workers` | `resources.view` | 200 | 200 | 401 |  |
| GET | `/resources/workers/:id` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/resources/availability-windows` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/resources/availability-windows/:id` | `resources.manage` | 200 | 403 | 401 |  |
| POST | `/resources/role-suitabilities` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/resources/role-suitabilities/:id` | `resources.manage` | 200 | 403 | 401 |  |
| GET | `/resources/shifts/:shiftId/requirements` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/resources/shifts/:shiftId/requirements` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/resources/shifts/:shiftId/requirements/:id` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/roles/roles.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/roles` | `roles.view` | 200 | 200 | 401 |  |
| POST | `/roles` | `roles.create` | 200 | 403 | 401 |  |
| PATCH | `/roles/:id` | `roles.update` | 200 | 403 | 401 |  |

### `modules/safety/safety.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/safety/dashboard` | `safety.view` | 200 | 403 | 401 |  |
| GET | `/safety/incidents` | `safety.view` | 200 | 403 | 401 |  |
| GET | `/safety/incidents/:id` | `safety.view` | 200 | 403 | 401 |  |
| POST | `/safety/incidents` | `safety.manage` | 200 | 403 | 401 |  |
| PATCH | `/safety/incidents/:id` | `safety.manage` | 200 | 403 | 401 |  |
| POST | `/safety/incidents/:id/close` | `safety.admin` | 200 | 403 | 401 |  |
| GET | `/safety/hazards` | `safety.view` | 200 | 403 | 401 |  |
| GET | `/safety/hazards/:id` | `safety.view` | 200 | 403 | 401 |  |
| POST | `/safety/hazards` | `safety.manage` | 200 | 403 | 401 |  |
| PATCH | `/safety/hazards/:id` | `safety.manage` | 200 | 403 | 401 |  |
| POST | `/safety/hazards/:id/close` | `safety.admin` | 200 | 403 | 401 |  |

### `modules/scheduler/scheduler.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/scheduler/workspace` | `scheduler.view` | 200 | 200 | 401 |  |
| POST | `/scheduler/shifts` | `scheduler.manage` | 200 | 403 | 401 |  |
| PATCH | `/scheduler/shifts/:shiftId` | `scheduler.manage` | 200 | 403 | 401 |  |
| POST | `/scheduler/shifts/:shiftId/workers` | `scheduler.manage` | 200 | 403 | 401 |  |
| DELETE | `/scheduler/shifts/:shiftId/workers/:workerId` | `scheduler.manage` | 200 | 403 | 401 |  |
| POST | `/scheduler/shifts/:shiftId/assets` | `scheduler.manage` | 200 | 403 | 401 |  |
| DELETE | `/scheduler/shifts/:shiftId/assets/:assetId` | `scheduler.manage` | 200 | 403 | 401 |  |

### `modules/tender-clarifications/tender-clarifications.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/clarification-notes` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/clarification-notes` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/clarification-notes/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/clarification-notes/:id` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tender-clients/tender-clients.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/clients` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/clients` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/clients/:clientId` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tender-clients/tender-clients.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tendering/clients/search` | `tenders.view` | 200 | 200 | 401 |  |

### `modules/tender-documents/tender-documents.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/documents` | `tenderdocuments.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/documents` | `tenderdocuments.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/documents/:documentId` | `tenderdocuments.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-of-works.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/scope/header` | `estimates.view` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/header` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/items` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/reorder` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/:itemId/confirm` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/:itemId/exclude` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/items/confirm-all` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/cards` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cards` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/cards/:cardId` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/cards/:cardId/summary` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/markup/reset-all` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/cards/:cardId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cards/reorder` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cards/:cardId/items` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-redesign.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/scope/columns` | `estimates.view` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/view-config` | `estimates.view` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/view-config` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/cutting-items` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/cutting-items` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/cutting-items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/cutting-items/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:tenderId/scope/summary` | `estimates.view` | 200 | 403 | 401 |  |

### `modules/tendering/scope-redesign.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/tenders/:tenderId/scope/cards/:cardId/cutting/copy-from-above` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-waste.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/scope/waste` | `estimates.view` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/waste` | `estimates.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/scope/waste/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/scope/waste/:itemId` | `estimates.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:tenderId/scope/waste/reorder` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope-waste.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/tenders/:tenderId/scope/cards/:cardId/waste/sum-from-above` | `estimates.manage` | 200 | 403 | 401 |  |

### `modules/tendering/scope/clarification-proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/clarification-proposals/:messageId/accept` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/clarification-proposals/:messageId/reject` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/clarification-proposals/:messageId/accept-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/clarification-proposals/:messageId/reject-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |

### `modules/tendering/scope/estimate-proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/estimate-proposals/:messageId/accept` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/estimate-proposals/:messageId/reject` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/estimate-proposals/:messageId/accept-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/estimate-proposals/:messageId/reject-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |

### `modules/tendering/scope/proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/proposals/:messageId/accept` | — | 200 | 200 | 401 |  |
| POST | `/personas/tendering/proposals/:messageId/reject` | — | 200 | 200 | 401 |  |
| POST | `/personas/tendering/proposals/:messageId/accept-all` | — | 200 | 200 | 401 |  |
| POST | `/personas/tendering/proposals/:messageId/reject-all` | — | 200 | 200 | 401 |  |

### `modules/tendering/scope/quote-proposals.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/personas/tendering/quote-proposals/:messageId/accept` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/quote-proposals/:messageId/reject` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/quote-proposals/:messageId/accept-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |
| POST | `/personas/tendering/quote-proposals/:messageId/reject-all` | — | 200 | 200 | 401 | Conversation-ownership scoped in service (404 for non-owners). |

### `modules/tendering/tender-client-notes.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/clients/:clientId/notes` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/clients/:clientId/notes` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/clients/:clientId/notes/:noteId` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tendering/tender-convert.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| POST | `/tenders/:id/convert` | `tenderconversion.manage` | 200 | 403 | 401 |  |

### `modules/tendering/tender-entries.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders/:tenderId/entries` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:tenderId/entries` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:tenderId/entries/:entryId` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:tenderId/entries/:entryId` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/tendering/tendering.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/tenders` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/bulk-status` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/filter-presets` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/filter-presets` | `tenders.view` | 200 | 200 ✎ | 401 |  |
| PATCH | `/tenders/filter-presets/:id` | `tenders.view` | 200 | 200 ✎ | 401 |  |
| DELETE | `/tenders/filter-presets/:id` | `tenders.view` | 200 | 200 ✎ | 401 |  |
| POST | `/tenders` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/notes` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/clarifications` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/follow-ups` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:id/activities` | `tenders.view` | 200 | 200 | 401 |  |
| POST | `/tenders/:id/activities` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/activities/:activityId` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/import/preview` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/import/commit` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:id` | `tenders.view` | 200 | 200 | 401 |  |
| PATCH | `/tenders/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| GET | `/tenders/:id/delete-preflight` | `tenders.manage` | 200 | 403 | 401 |  |
| DELETE | `/tenders/:id` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/bump-revision` | `tenders.manage` | 200 | 403 | 401 |  |
| POST | `/tenders/:id/duplicate` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/status` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/probability` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/assigned-estimator` | `tenders.manage` | 200 | 403 | 401 |  |
| PATCH | `/tenders/:id/quick-edit` | `tenders.manage` | 200 | 403 | 401 |  |

### `modules/users/users.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/users` | `users.view` | 200 | 200 | 401 |  |
| POST | `/users` | `users.create` | 200 | 403 | 401 |  |
| PATCH | `/users/:id` | `users.update` | 200 | 403 | 401 |  |

### `modules/workers/availability.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/workers/availability/overlay` | `scheduler.view` | 200 | 200 | 401 |  |
| GET | `/workers/leaves` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers/leaves` | `resources.manage` | 200 | 403 | 401 | PR-188b F4: tightened from `resources.view` to `resources.manage` so a read-only Viewer cannot lodge leave. |
| PATCH | `/workers/leaves/:id/status` | `resources.manage` | 200 | 403 | 401 |  |
| DELETE | `/workers/leaves/:id` | `resources.manage` | 200 | 403 | 401 |  |
| GET | `/workers/unavailability` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers/unavailability` | `resources.manage` | 200 | 403 | 401 | PR-188b F4: tightened from `resources.view` to `resources.manage` so a read-only Viewer cannot lodge unavailability. |
| DELETE | `/workers/unavailability/:id` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/workers/workers.controller.ts` — guards: JwtAuthGuard, PermissionsGuard

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/workers` | `resources.view` | 200 | 200 | 401 |  |
| GET | `/workers/:id` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers` | `resources.manage` | 200 | 403 | 401 |  |
| PATCH | `/workers/:id` | `resources.manage` | 200 | 403 | 401 |  |
| DELETE | `/workers/:id` | `resources.manage` | 200 | 403 | 401 |  |
| GET | `/workers/:id/allocations` | `resources.view` | 200 | 200 | 401 |  |
| POST | `/workers/:id/provision-mobile-access` | `resources.manage` | 200 | 403 | 401 |  |

### `modules/xero/xero.controller.ts` — guards: (none at class level)

| Method | Path | Required permission | Admin | Viewer | Anon | Notes |
|---|---|---|---|---|---|---|
| GET | `/xero/connect` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/xero/callback` | — | public | public | public | OAuth redirect callback (public by necessity). |
| POST | `/xero/callback` | `platform.admin` | 200 | 403 | 401 |  |
| GET | `/xero/status` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/xero/disconnect` | `platform.admin` | 200 | 403 | 401 |  |
| POST | `/xero/contacts/:clientId/sync` | `directory.manage` | 200 | 403 | 401 |  |
| POST | `/xero/contacts/sync-all` | `directory.admin` | 200 | 403 | 401 |  |
| POST | `/xero/invoices/from-progress-claim/:claimId` | `finance.admin` | 200 | 403 | 401 |  |
| GET | `/xero/sync-logs` | `platform.admin` | 200 | 403 | 401 |  |

## Live assertion coverage (`permission-matrix.spec.ts`)

| Route group | Rows asserted | Roles asserted |
|---|---|---|
| Tenders CRUD | 5 | admin (pass), viewer (200/403), anon (401) |
| Client quotes | 4 | admin, viewer, anon |
| Users admin (`/users` + `/admin/users`) | 5 | admin, viewer, anon |
| Roles / permissions admin | 4 | admin, viewer, anon |
| Master data writes | 4 | admin, viewer, anon |
| Archive | 2 | admin, viewer, anon |
| Long tail (one row per module × 20+) | 20+ | viewer (403/200), anon (401) |
| PR-188b F1 (global list creation) | 2 | viewer (403), anon (401) — gated by `masterdata.manage` |
| PR-188b F4 (worker leave / unavailability writes) | 2 | viewer (403), anon (401) — gated by `resources.manage` |

Admin write assertions never mutate seeded data: POST rows send empty bodies (DTO validation rejects with 400
after the guards pass — all four top-level create DTOs have required fields), PATCH/DELETE rows target
non-existent ids (404 after the guards pass).


# UI Acceptance Review (visual verification in the pipeline) - Design

Status: proposed 2026-07-16 (Marco). Adds a soft, vision-based "does the rendered UI match intent"
check to the pipeline, on top of the deterministic gates.

## Problem

The deterministic gates (build, lint, e2e assertions, grep-for-named-artifact, CI conclusion) prove
that named DOM nodes and artifacts EXIST. They do not prove a rendered screen LOOKS and BEHAVES
right: layout, field sizing, controls on the correct row, delete affordances present. UI/UX
regressions ship green (e.g. the multi-material waste controls rendered once at the bottom instead
of inline per material). Marco catches these by eye today.

## Governing principle - this is a SOFT check, not a deterministic gate

DOCTRINE section 7 is "the exit code decides, not your opinion of it." A vision judgment is an
opinion, not an exit code, so it must never HARD-block a merge on taste. Therefore:

- HARD-FAIL only on an OBJECTIVE miss - a control the prompt explicitly required is provably absent
  from the captured screenshot. This blocks like a red required check.
- ESCALATE taste / layout / "feels cramped" concerns to Marco as an advisory comment; never block on
  them, never silently pass them.
- Never let a UI opinion silently block or silently pass (mirrors never-exit-silently).

## What already exists - REUSE, do not rebuild

- `scripts/pipeline/smoke-pr.ps1` boots API+web on a seeded DB in a real browser and already sets
  `PWTEST_SCREENSHOT_DIR` = `<worktree>/smoke-artifacts`. `playwright.config.ts` currently captures
  `screenshot: only-on-failure`; `playwright.reuse.config.ts` reuses a running server for speed.
- Stations run headless `claude --print` on vision-capable models (opus / sonnet / haiku); the
  `Read` tool ingests PNGs.
- `.claude/agents/pr-fix-reviewer.md` already reviews a PR against its originating prompt and returns
  a fixed VERDICT block; it never merges and never edits the branch.
- `.claude/agents/00-supervisor.md` dispatches exactly one specialist per work type via the Agent
  tool.

## Design - three small additions

1. Prompt schema (optional, non-breaking). Add two optional fields to `docs/pr-prompts/PROMPT-SCHEMA.md`
   and `scripts/pipeline/lint-prompt.mjs`:
   - `ui_shots:` - a list of `{ route, name }` screenshots to capture on the seeded app.
   - `ui_intent:` - a plain-language checklist of what "correct" looks like (e.g. "waste controls
     inline on each material row, delete on rows 2+ only, one row wide").
   Prompts that touch `apps/web/**` SHOULD declare them; absence means no UI review (full back-compat).

2. Capture. A dedicated acceptance-shot step (or the code-writer, following the convention) navigates
   each `ui_shots` route on the already-seeded app and writes a named PNG to `PWTEST_SCREENSHOT_DIR`.
   Deterministic; reuses the running-server config. No new renderer.

3. Judge. A `ui-reviewer` agent (vision-capable; a sibling of `pr-fix-reviewer`, model sonnet or
   haiku), dispatched by `00-supervisor` whenever a PR touches `apps/web/**` AND declares `ui_intent`.
   It `Read`s the captured shots plus `ui_intent` and returns a UI-VERDICT block:
   - PASS - every declared control / behaviour is visibly present and placed as described.
   - CONCERN - a taste / layout issue for a human to judge. Advisory only; escalates to Marco.
   - FAIL - an objective miss (a required control is absent from the shot). Blocks like a red check.
   Same guardrails as `pr-fix-reviewer`: never merges, never edits the branch.

## Merge interaction

- FAIL -> treated as a failed required check: do not merge; fix-forward or re-fire the prompt.
- CONCERN -> advisory PR comment + escalate to Marco; does NOT block the supervisor's auto-merge
  unless Marco holds it.
- PASS or no `ui_intent` -> no effect; the existing deterministic gates decide the merge.

## Non-goals

- No pixel-diff visual-regression baselines (brittle, needs goldens, cannot judge intent).
- The reviewer does not gate on subjective quality - only objective presence / placement.

## Phasing (each independently shippable, <= 10 files)

- Phase 1 (plumbing): `ui_shots` / `ui_intent` schema fields + lint support + the capture convention
  wired to `smoke-artifacts`.
- Phase 2 (judgment): the `ui-reviewer` agent + `00-supervisor` dispatch rule + the FAIL/CONCERN
  merge interaction.

## Open confirmation before Phase 2

Confirm the headless `claude --print` invocation in this environment actually passes a PNG through to
the model (vision enabled for these agents). The models are vision-capable; the CLI/tool path must be
verified end-to-end with one real screenshot before the reviewer is trusted.
