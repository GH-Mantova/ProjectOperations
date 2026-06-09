# 13. Forms and Compliance

## Purpose

The forms engine — IS-INC (incident), IS-HAZ (hazard), pre-start
checklists, JSAs, SWMS templates, and Marco's compliance workflows.
Field workers submit; supervisors and Marco review and action. Includes
PWA offline support (drafts, sync, install prompt).

Marco's primary domain. Critical legal record.

## Surface area

**Routes (frontend):**
- `/forms` — `FormsListPage` (Templates + Submissions tabs)
- `/forms/designer/:templateId` — `FormDesignerPage` (3-pane:
  palette / canvas / settings; rules editor; preview modal)
- `/forms/submit/:templateId` — `FormSubmitPage` (distraction-free wizard
  with signature canvas + photo upload). **NOTE:** PHASE 6 dead-code
  cleanup — mounted but no nav links point to it; superseded by
  `/forms/fill/:templateId` (FormFillPage). Verify which is actually
  exposed.
- `/forms/fill/:templateId` — FormFillPage (mobile-first fill flow per
  PR #100)
- `/forms/submissions/:submissionId` — submission detail
- `/compliance` — compliance dashboard (under `pages/compliance/`)
- `/safety` — safety forms entry (under `pages/safety/`)

**API endpoints (key):**
- `GET/POST/PATCH/DELETE /api/v1/forms/templates`
- `GET/POST /api/v1/forms/submissions`
- `POST /api/v1/forms/submissions/:id/approve`
- `POST /api/v1/forms/submissions/:id/reject`
- `GET /api/v1/forms/rules-engine/evaluate` — preview rule evaluation

**DB entities:**
- `FormTemplate`, `FormSection`, `FormField`, `FormCondition`,
  `FormFieldAction`
- `FormSubmission`, `FormFieldValue`
- `FormApproval` (chain assignment)
- `FormTriggeredRecord` — records created by `on_submit` actions
- `FormSchedule` — recurring form requirement

## What should work (functional checklist)

### Templates list
- [ ] Templates card grid (Tab 1) — IS system templates seeded
      (PR #97): 8 templates idempotent
- [ ] Submissions table (Tab 2) — filterable

### Form Designer (3-pane)
- [ ] Field palette: 30+ field types organised by category (PHASE 5C
      pending — verify which are live today)
- [ ] Draggable field chips
- [ ] Property editor (right pane)
- [ ] Rules editor: condition builder with AND/OR nested groups and
      all 11 operators
- [ ] Preview modal: live rule evaluation, desktop + mobile view
- [ ] Publish flow: version increment, change summary

### Form Fill (mobile-first wizard)
- [ ] All 30+ field types render correctly (PHASE 5C may not be all)
- [ ] GPS auto-capture on form load (consent)
- [ ] Photo fields: camera capture, thumbnail grid
- [ ] Signature field: canvas draw area
- [ ] Offline fill: IndexedDB save every 30s; sync on reconnect (PR #111)
- [ ] Progress indicator: section N of M
- [ ] Conditional field show/hide in real-time
- [ ] Submit triggers: validate → gates → on_submit actions → triggered
      records → approval chain (PR #97 RulesEngineService)
- [ ] Asbestos compliance gate blocks submission on missing register

### Submission detail
- [ ] All values rendered with type-appropriate display
- [ ] Photos viewable
- [ ] Signatures rendered
- [ ] Approval chain timeline
- [ ] Status: draft, submitted, approved, rejected
- [ ] PDF export (full) — embedded photos, signatures, IS branding,
      QR code (PHASE 5C ⏸️ may be partial)

### Form drafts (PR #111)
- [ ] DraftBanner appears when local IndexedDB draft exists
- [ ] SaveDraftButton + auto-save on backgrounding
- [ ] useFormDraft hook wired on 6 user-facing forms (PR #111 Phase 1);
      remaining ~20 admin forms PHASE 6
- [ ] Field timesheet + pre-start saves are backend drafts, not IDB
      (PHASE 6 product decision)

### Safety / Compliance
- [ ] IS-INC + IS-HAZ form types live (PR #81)
- [ ] Mobile + desktop both work
- [ ] Notifications to Marco on submit
- [ ] Compliance dashboard: expiry alerts, blocked entities (PR #79)

## Recent PRs that shaped it (last ~100 merged)

- #21 — S7 forms foundation
- #81 — Safety forms (IS-INC, IS-HAZ) + safety widget — **functional**
- #97 — Forms Engine: rules engine, IS system templates, submission
  pipeline — **functional / big**
- #100 — Forms fill UI: 4-tab list, mobile-first fill page, submission
  detail — **functional**
- #102 — Polish (scope ID consistency etc)
- #105 — PDF watermark + register header on every page
- #111 — Form drafts: IndexedDB persistence + manual + auto-save on
  background — **functional**
- #131 — SSE error sanitisation, FormSubmitPage CodeQL false-positive
  suppress
- #298 — FormsService unit tests (test-only)

## What to watch for during sanity check

- **FormSubmitPage vs FormFillPage** — PHASE 6 dead-code item:
  `/forms/submit/:templateId` is mounted but unreferenced; superseded by
  FormFillPage. Verify which one is actually navigated to from Templates
  list, and flag if both routes exist with conflicting behaviour.
- **Form drafts (PR #111)** — only Phase 1 (6 forms) wired with
  `useFormDraft` hook. The other ~20 admin forms are PHASE 6 deferred.
  Don't expect every form to have drafts.
- **Offline submission** — turn off network, fill a form, submit, turn
  network back on; verify sync.
- **Asbestos compliance gate** — submit a form that references asbestos
  without an attached register; gate should block.
- **Approval chain** — verify multi-step chains route correctly.
- **PWA install prompt** — install on iPad, fill a form offline, sync.
- **PWA NetworkFirst 24h cache** — PHASE 6 known issue: stale data on
  shared devices. Cross-user device sharing is the risk.

## Edge cases worth probing

- **Submit form with 0 sections / fields** — should be impossible if
  Designer validates
- **Form with 100+ fields** — performance, virtualisation if any
- **Submit identical form twice in 1 minute** — dedupe? double-record?
- **Conditional field that depends on a hidden field** — rule engine
  consistency
- **Signature on landscape rotation** — canvas resize?
- **Photo upload with intermittent network** — retry, queue, dead-letter
  UX (PR #108)
- **Service worker stale cache after deploy** — user gets old form
  schema; sync fails on submit
- **Submission rejected with no comment** — should require a comment?
- **Mobile width** — primary surface; should be flawless on 375px
- **Permission-gated** — Field worker only sees own submissions;
  supervisor sees team; Marco sees all
