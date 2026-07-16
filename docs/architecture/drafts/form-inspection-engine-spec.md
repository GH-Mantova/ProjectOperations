# ERP Form & Inspection Engine — forensic teardown + best-in-class build spec

**Author:** Cowork (Claude) · **Date:** 2026-07-15 · **Status:** DRAFT for Marco
**Companion to:** `jotform-forms-gap-analysis.md`, `d365-m365-gap-analysis-v2.md`.
**Goal (Marco's brief):** do NOT recreate the forms. Forensically dissect *how* Initial Services
builds and uses forms today, benchmark the tools we measure ourselves against (Jotform, D365 Field
Service, Assignar, HammerTech, Procore, SiteDocs, SafetyCulture/iAuditor, Intuit TSheets), then
**specify a form + inspection engine for the ERP that lets our users build these forms themselves —
and out-build every one of those systems.** Nothing here is staged; it is a design for sign-off.

---

## Part 1 — Forensic teardown: how we build and use forms today

### 1.1 The inventory in one view
20 Jotform assets, two business lines (Initial Services internal + sister **Redcliffe Skips /
Redcliffe Waste Pty Ltd**). Full inventory is in `jotform-forms-gap-analysis.md`; this doc dissects
the *mechanics*.

### 1.2 Field & widget types actually in use (the observed taxonomy)
From dissecting the forms, the account leans on:

- **Static content blocks / headings** — used *heavily*: the 14-Day Credit form is **246 questions**,
  most of which are pasted HTML (5-page T&Cs + 6-page credit terms + privacy policy). Content, not fields.
- **Standard inputs** — short/long text, dropdown, radio, checkbox, name, email, address, phone, number.
- **Date / Appointment (scheduling)** — delivery/pickup dates; an Appointment widget in the scratch template.
- **Signature (e-signature)** — key checkout, all credit apps (Director + Guarantor signatures).
- **File upload** — licences, damage photos, photo-ID, signed onboarding docs, skip-placement photos.
- **Product list / payment** — "My Products" picker on booking/order forms; EFT/COD capture.
- **Calculation widget** — pricing (booking zone fees, GST, weight caps).
- **Configurable List (repeatable rows)** — present in the scratch template; the pattern Raj's SoW
  multi-material rows also need.
- **Input tables / matrix**, **hidden fields**, **page breaks** (multi-page wizards).

The generic "Form" asset (created 2026-07-03) is effectively a **capability sandbox** — Heading, Name,
Email, Address, Phone, Date, Appointment, Signature, My Products, Calculation, Configurable List — i.e.
someone testing which widgets exist. Worth noting: that curiosity is exactly the demand signal for an
in-house builder.

### 1.3 Logic, rules & settings in use
- **Conditional branching** — Action Request reveals one of five workflow sections based on "What is
  your request regarding?"; "same as billing/business address" and "Guarantor same as Director" toggles.
- **Skip logic / page routing**, **required fields**, **calculations** (booking pricing).
- **Confirmation/thank-you messaging** — e.g. "submitting this form does not confirm your booking."
- **Payments / T&C acceptance / e-sign audit**; **Jotform Apps** (the New Employee App bundles
  onboarding forms into a mobile portal); **disabled/superseded** forms (old 120-field Booking Form);
  **clones/variants** (RS Employee Credentials + Clone; 7-day / 14-day / prepaid / extension credit).

### 1.4 Reach (how much each is really used)
Action Request **455** (73% warehouse/logistics, sampled), Booking Request **221**, old Booking Form
**142** (disabled), Employee Credentials **51**, Key Checkout **11**, credit apps **~9 each**; and a
long tail of **0-submission** drafts, templates, clones, and PDF/scratch forms.

### 1.5 What the teardown reveals we have MISSED or overlooked
This is the point of the exercise — the gaps are structural, not cosmetic:

1. **Flat data, no relational binding.** Every submission is an island. Nothing links to Job, Worker,
   Asset, Client, Site, or Tender. All downstream use is manual re-keying.
2. **No reusable content library → legal text maintained 4-5 times.** The Guarantee/Indemnity/Charge,
   T&Cs, and Privacy Policy are pasted inline into each credit variant. One clause change = editing
   four 200-question forms. This is the single clearest "overlooked capability."
3. **Overloaded forms.** Action Request is 5 workflows in one; Booking Form reached 120 fields; credit
   forms 246. No sub-form includes, no composition — so forms bloat instead of compose.
4. **Credentials captured, not registered.** Employee Credentials holds ticket **expiry dates** as flat
   submissions. Nothing watches them. For asbestos/demolition work an expired supervisor ticket is a
   live compliance exposure — and today it is invisible.
5. **No inspection-grade features used.** No scoring/pass-fail, no response-conditional evidence
   ("Fail ⇒ force a photo + raise a fix"), no corrective-action loop. A tool damage report is a dead
   PDF, not a tracked repair. (Partly because Jotform itself is weak here.)
6. **No scheduling/recurrence.** Nothing pushes a daily prestart, a periodic test&tag, or a
   toolbox-talk on a cadence.
7. **No offline strategy, no GPS/geostamp.** Field capture depends on connectivity; submissions carry
   no location/time proof.
8. **No governance / versioning.** Clones, variants, 0-sub drafts, and a scratch "Form" accumulate with
   no owner, naming, or version history.
9. **PII / retention risk.** Credit apps collect DOB, photo-ID, and credit-check consent; that sensitive
   data lives in Jotform, outside a governed store with retention rules and field-level access.

---

## Part 2 — The benchmark capability ceiling

Synthesised from the rival builders (SafetyCulture/iAuditor, Assignar, HammerTech, SiteDocs, Jotform,
Procore, Intuit TSheets) and D365 Field Service Inspections.

### 2.1 Table-stakes — needed just to be credible
No-code drag-drop builder; full field library (text/number/choice/date/time/dropdown/rating/
file+image/matrix/hidden/section/page); advanced widgets (repeatable list, cascading dropdowns,
calculation, signature, camera, geolocation, progress, countdown, email-verify); **conditional logic**
(show/hide, enable/require/mask, calculate, skip-page, conditional email); calculations/formula engine;
multi-page + **save-and-continue**; **prefill** (URL + from-record + returning-user); **e-signature**
with timestamp/IP audit; **payments** (multi-gateway); **PDF in/out** (import PDF → fillable form;
submission → branded PDF); **submissions datastore** (live table, filter, views); notifications +
autoresponders; **integrations + webhooks + REST API**; report builder + CSV/Excel; **security/access**
(encryption, role/team assignment, access control, submission limits, GDPR/Privacy-Act, SSO); **visual
approval workflow** (sequential + parallel/branching); **multi-form App / kiosk** mode.

### 2.2 Differentiators — where a best-in-class construction engine wins
1. **Offline-first field capture** with robust sync (not just a companion app).
2. **Closed-loop corrective/preventive actions** — deficient response auto-raises an action with
   assignee, due date, notification, and tracked close-out with evidence.
3. **Response-driven evidence enforcement** — a specific answer conditionally *forces* a photo, a note,
   a signature, or a corrective action.
4. **Scored inspections + reusable custom response sets** (Pass/Fail/N-A + org-defined), with
   **template inheritance** (company template → project/site override, auto-distributed).
5. **System-of-record relational binding** — every submission linked to Job/Asset/Worker/Client/Site
   in a relational model; answers feed **registers**, not a flat sheet.
6. **GPS / geofence + time-stamped, approval-gated, cost/payroll-linked capture** (TSheets pattern).
7. **Distribution + scheduling + recurrence** with pending/overdue/missing tracking and reminders.
8. **Competency-gated dispatch** (Assignar's moat) — don't just *alert* on an expired ticket; **warn or
   block** assigning that worker/plant to a task, and push the right form to the right person/asset on
   allocation.
9. **Integrated permit-to-work engine** (HammerTech) wired to prestart/finish checklists by permit type.
10. **Event-triggered forms** — fire from an incident, a sensor/asset service-due date, a QR scan, or a
    schedule change — not only manual/recurring.
11. **QR / kiosk / public-link** capture (site sign-in, muster, visitor/subcontractor self-service).
12. **Unified data spine** — orientations → JHAs → permits → inspections → incidents → actions share one
    worker/asset/site spine so evidence + audit assemble automatically.
13. **Acknowledgement/read-receipt broadcast** ("Heads Up" style) tied to submissions.
14. **BI-grade analytics** — leading/lagging safety indicators, filterable registers, scheduled report
    emails (e.g. expiring-cert digest), warehouse/BI connectors.
15. **AI assist** — build a form from an uploaded PDF/paper (D365 & SafetyCulture do this), photo→hazard
    suggestion, auto-summarised trends, natural-language action updates.

### 2.3 Who is best at what — and what each LACKS
| System | Best at | Notably lacks |
|---|---|---|
| **SafetyCulture / iAuditor** | Builder depth (nested logic, smart/calc fields, image markup), 100k-template library, analytics/API, sensors | Workforce/asset dispatch, licence-gated who-can-work; it's an inspection engine, not an ops system |
| **Assignar** | Compliance-gated dispatch of workers **and** plant; dockets + timesheets in one ops engine; Xero/QB export | Builder sophistication (logic/scoring/photo markup), template library, BI depth |
| **HammerTech** | Integrated permit-to-work + orientations + inspections + incidents on one spine; QR site access | General-purpose builder flexibility; self-serve template library; heavy enterprise-GC config |
| **SiteDocs** | Ease of use, rock-solid offline, GPS-stamped signatures, simple cert-expiry | Advanced logic/scoring, smart fields, big template library, deep integrations/BI, any dispatch |
| **Jotform** | Widest field/widget set, no-code logic + calc, payments, Smart-PDF, fast approvals, Tables/Apps/Kiosk | Relational system-of-record; offline *builder*; closed-loop corrective actions; weak access/DB model — needs webhook/API glue to feed an ERP |
| **Procore** | Construction inspections tied to projects/drawings, observations (corrective loop), offline | Custom forms are rigid **PDF** (often need Procore's team); no rich widget library, no payments, weak public/kiosk capture |
| **TSheets / QB Time** | GPS/geofenced labour time, job-costed hours, payroll flow | Not a form builder — custom fields are thin metadata; no logic/inspection/e-sign |
| **D365 Field Service Inspections** | Drag-drop inspections bound to work order + asset, offline, versioned, Dataverse-stored, Copilot-from-PDF | Requires the whole Dynamics/Dataverse/Entra stack; heavy; not tuned to a 7-person contractor |

**The white space (how we win):** *no single system* combines SafetyCulture's builder + library +
analytics, Assignar's compliance-gated dispatch, HammerTech's permit/inspection/incident spine, and
SiteDocs' offline simplicity — on top of a **relational ERP** that already holds the Jobs, Assets,
Workers, Clients, Rates, and Waste-types. That last part is our unfair advantage: our forms can *read
and write the system of record*, which every standalone form tool can only bolt on via API.

---

## Part 3 — The ERP Form & Inspection Engine (build spec)

A single no-code engine that lets our users build, publish, distribute, and analyse forms and
inspections — reusing the ERP's existing spines. This is the concrete form of the "work-order +
inspection engine" (Tier A1 in `d365-m365-gap-analysis-v2.md`), and it generalises the
already-planned **Interactive SWMS module** and **Workflow Review tool** (both are specific instances
of this engine).

### 3.1 Field-type registry (extensible)
A registry so new field types are config, not code. Ship: text/number/date/time, single/multi-choice
with **reusable response sets**, dropdown (+ cascading/dependent), rating/scale, address, name, phone,
email, **file/photo upload with on-device annotation + sketch**, **signature (timestamp + IP + GPS)**,
**geolocation/geostamp**, calculation/formula, repeatable **group/list**, matrix, hidden, **static
content block**, **T&C acceptance**, product/payment, and ERP **lookup fields** (asset-picker,
worker-picker, client-picker, rate/waste-type lookup, GlobalList).

### 3.2 Reusable content & template library  *(fixes finding #2 and #3)*
- **Content snippets** — Guarantee/Indemnity, T&Cs, Privacy Policy authored **once**, referenced by
  many forms. Change once, propagate everywhere.
- **Sub-form includes / composition** — build a big form from parts instead of 246-field monoliths.
- **Template inheritance** — org template → project/site variant override; auto-distribute updates.
- **Template library** — ship WHS/construction starters: SWMS/JSA, daily prestart plant/vehicle,
  toolbox talk, site induction, hazard/incident report, Take-5, permit-to-work, test&tag.

### 3.3 Rules / logic engine
Show/hide, enable/require/mask, calculate/update, skip-page, conditional email/route; **scoring +
pass/fail thresholds** with colour-coded results; **response-driven evidence enforcement** (answer ⇒
force photo/note/signature/**raise corrective action**); cross-field validation; required-field gates.

### 3.4 Relational binding  *(the differentiator — fixes finding #1)*
Every form and submission is linkable to **Job/Project, Worker, Asset, Client, Site, Tender**. Answers
persist as **structured, queryable data** feeding registers (hazard, incident, plant, credential),
never as an orphan PDF. Lookup fields resolve against existing ERP registers (assets from the #595
module, rates, waste-types, workers, GlobalLists) — no re-keying, cross-form reuse.

### 3.5 Distribution, scheduling & triggers
Assign to worker/crew/site/asset; **recurring/scheduled** (daily prestart, periodic test&tag,
toolbox-talk cadence) with pending/overdue/missing tracking + reminders; **event-triggered** (incident
raised, asset service-due, allocation created, QR scanned); **public link + kiosk + QR** for site
sign-in / muster / visitor & subcontractor self-service; **offline-first PWA** capture with sync (the
field PWA already exists — extend it).

### 3.6 Workflow, approvals & corrective actions
Visual approval routing (sequential + parallel) through the existing **AuthorityService** seam;
**corrective/preventive action** objects (assignee, due date, priority, close-out with evidence);
escalations; e-sign with full audit; acknowledgement/read-receipt broadcast.

### 3.7 Competency-gated dispatch  *(the Assignar moat + more — fixes finding #4)*
A **worker ticket/licence/competency register with expiry alerting** (turns Employee Credentials into
live data). Tie it to assignment: **warn or block** dispatching a worker/plant whose ticket is missing
or expired to a task or form, and push the right form to the right person/asset on allocation. This is
safety-critical for asbestos/demolition and is the piece none of the pure form tools do well.

### 3.8 Notifications, submission store, registers & reporting
Email/push/**Teams** notifications + autoresponders; live **Tables/registers** with filters and views;
dashboards, trend analysis, **scheduled report emails** (expiring-cert digest); CSV/Excel export;
**branded PDF / evidence-pack** render (reuse the quote-PDF engine); BI feed (into the staged BI layer,
tagged by financial dimension).

### 3.9 Permissions, PII & retention  *(fixes finding #9)*
Role-based + field-level security; PII tagging + retention policy (credit-app DOB/ID); full audit via
the existing **AuditLog**; Australian Privacy Act / GDPR alignment; sensitive-field encryption.

### 3.10 AI assist
**Build-a-form-from-PDF** (as D365 Field Service and SafetyCulture do — upload the paper SWMS/checklist,
get a draft form); photo→hazard suggestion; auto-summarised inspection trends; smart prefill.

### 3.11 External portal surface
The same engine renders **customer/subcontractor-facing** forms (Redcliffe booking, credit application,
document upload) through the external portal (Tier B3 in the v2 gap doc), so internal and external
capture share one builder.

### 3.12 How it beats each benchmark (one line each)
- **vs Jotform:** same builder breadth, but submissions are relational ERP records, offline-first, with
  a real corrective-action loop and access model — no webhook glue to reach the system of record.
- **vs SafetyCulture:** matches builder depth + templates, adds compliance-gated dispatch and ERP binding it lacks.
- **vs Assignar:** keeps compliance-gated dispatch, adds the far deeper builder + scoring + analytics it lacks.
- **vs HammerTech:** keeps permit/inspection/incident spine, adds self-serve builder + template library.
- **vs SiteDocs:** matches offline + GPS-signature simplicity, adds logic/scoring/registers/dispatch.
- **vs Procore:** flexible no-code forms (not rigid PDF), self-serve, cheaper, on our own data.
- **vs TSheets:** GPS/approval-gated capture too, but as full forms feeding job-costing, not thin fields.
- **vs D365 Field Service:** the same inspection power, tuned to a 7-person contractor, without the
  Dynamics/Dataverse/Entra weight.

---

## Part 4 — Buildable slicing (deploy → see → iterate)

Each slice is visible on its own; every one reuses spines already in flight.

1. **Slice 1 — the spine.** Field-type registry + no-code builder + submission store + **relational
   binding** to Job/Worker/Asset/Client + basic logic + PDF render. *Outcome: in-app forms with real data.*
2. **Slice 2 — inspection loop.** Template library + **reusable content snippets** + scoring/pass-fail +
   response-driven evidence + **corrective-action** close-out. *Beats SiteDocs/Procore's loop.*
3. **Slice 3 — field-first.** Scheduling/recurrence + distribution + **offline PWA** + GPS/e-sign geostamp
   + QR/kiosk. *Beats the field apps on capture.*
4. **Slice 4 — compliance.** **Worker ticket/competency register + expiry alerts + competency-gated
   dispatch.** *Beats Assignar; closes the safety gap.*
5. **Slice 5 — workflow & intelligence.** Approvals/workflow + Teams/notifications + registers + BI feed +
   **AI build-from-PDF**.
6. **Slice 6 — external.** Customer/subcontractor portal forms (booking, credit app, doc upload).

**Dependencies already present or in flight:** assets module (#595), worker register, AuthorityService,
AuditLog, PDF engine, integration-keys settings, field PWA, staged BI layer. This engine is not a
green-field bet — it is the connective spine those pieces were already pointing at.

---

## Part 5 — Where this plugs into existing plans
- **Absorbs** Tier A1 (work-order + inspection engine) of `d365-m365-gap-analysis-v2.md`.
- **Generalises** the planned **Interactive SWMS module** and **Workflow Review tool** — both become
  templates/instances of this engine rather than one-offs.
- **Feeds** the staged HR-leave, cases, and customer-voice work (all are forms) and the BI layer.
- **Turns off** the Jotform dependency in stages, starting with internal ops forms, ending with the
  external customer portal — while a near-term Jotform→ERP ingestion webhook (see the forms gap doc)
  bridges the gap until Slice 6.

Nothing here is staged. This is the design to argue with; once you're happy, I can slice it into PR
prompts against the schema.

---

## Part 6 — IMPLEMENTATION STATUS (forensic code check, 2026-07-15)

Before staging anything I dissected the actual codebase. **Most of this engine already exists (PR #97)** —
staging a green-field build would have been the classic stale-prompt mistake. What's already live:

- **Builder + versioning:** `FormTemplate` (code, category safety/asbestos/plant/induction/environmental/
  permits/quality/daily/custom, `isSystemTemplate`, `settings` blob), `FormTemplateVersion`,
  `FormSection` (with **repeating** sections + section-level `conditions`), `FormField` (with
  `config`/`conditions`/`validations`/`actions` JSON), plus a web builder (`FormDesignerPage`,
  `formDesignerState`, `FormFillPage`, `FormsListPage`, `FormSubmissionDetailPage`).
- **Rules engine:** `FormRule` + `rules-engine.service.ts` (show/hide/require/calc effects).
- **Relational binding (the differentiator):** `FormSubmission` already links Job / Client / Asset /
  Worker / Site / **Shift**, plus `context` blob, `gpsLat`/`gpsLng`, `geolocation`.
- **Values / evidence:** `FormSubmissionValue` (text/number/datetime/json/boolean/filePath),
  `FormAttachment`, `FormSignature`.
- **Workflow:** `FormApproval` (multi-step, assignee/role, `dueAt`), `approvals-waiting` tests.
- **Triggered records:** `FormTriggeredRecord` (submit-time record creation).
- **Scheduling & triggers:** `FormSchedule` (cron + `eventTrigger` + assign-to-role/user + `nextRunAt`),
  `pre-starts-today` tests — recurrence + event-triggered forms exist.
- **Offline:** web `FormDraftStore` / `useFormDraft`; settings blob carries `allowOffline`.
- **Seeded template library:** `seed-form-templates.ts`.
- **Competency-gated dispatch ALREADY WIRED:** `Competency` + `WorkerCompetency.expiresAt` +
  `JobRoleRequirement` (mandatory, effective-dated) + `schedule-allocation.service.ts` competency-gate
  paths + `compliance/competency-gate.ts`. Assignar's moat is already in the scheduler.

### The genuine residual gaps (verified zero-hit in the forms module)
1. **Reusable content library / snippets + template clone-inherit** (`snippet`/`library`/`inherit` = 0)
   — the pasted-T&C problem (Part 1, finding #2) is **not** solved. *← highest value, staged.*
2. **Inspection scoring + pass/fail response sets + thresholds** (`score`/`scoring` = 0). *Staged.*
3. **Corrective-action / CAPA close-out loop** (`corrective`/`escalat` = 0) — a failed/flagged response
   should raise a tracked action (assignee/due/close-out) on top of `FormTriggeredRecord`/
   `HazardObservation`. *Staged.*
4. **Public / kiosk / QR capture** (`kiosk`/`qr`/`publicToken`/`external` = 0). *Staged.*
5. **Submission → branded PDF / evidence pack** (`pdfExport` is a settings *flag* only; no renderer wired
   in forms) — reuse the `pdf-rendering` module. *Staged.*
6. **AI build-a-form-from-PDF** (`fromPdf`/`ocr` = 0) — needs a doc-AI key via integration-keys. *Staged HOLD (gated).*
7. **Verify (not yet staged):** proactive competency-**expiry alerting/digest** (data + gating exist;
   proactive notifications may be missing) and **geofence enforcement** (`geofenceEnabled` declared in
   settings but `geofence` = 0 hits in code — flag-only?). Confirm before staging.

Bottom line: we don't need to build the engine — we need to **finish six edges of it.** The staged
prompts target exactly those. Everything else in Parts 1-5 is already shipped and should be documented,
not rebuilt.
