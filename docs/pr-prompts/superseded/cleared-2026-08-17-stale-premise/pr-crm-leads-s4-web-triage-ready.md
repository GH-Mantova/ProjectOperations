---
premise: '! test -f apps/web/src/pages/crm/DontPursueModal.tsx'
premise_means: The web triage surface (S4 — triage list + DontPursueModal) has not been built yet.
requires_file_on_main: apps/api/src/modules/crm/dto/dont-pursue.dto.ts
scope:
  - apps/web/src/pages/crm/**
  - apps/web/src/pages/crm/__tests__/**
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/crm/DontPursueModal.tsx && grep -rq "DontPursueModal" apps/web/src/pages/crm/CrmBoardPage.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
---

# feat(web): CRM S4 — triage list; merged "+ Add new" modal; "Don't pursue" reason modal

Implement **SLICE 4** of `docs/plans/crm-leads-collapse-plan.md`.

Read that plan in full before writing any code. S3 (`requires_file_on_main` gate) must be
on `main` first. This slice replaces the kanban board with a triage list and wires the
two primary user actions: "Price it" (→ Tender Draft) and "Don't pursue" (→ reason modal).

## STANDING AUTHORITY
**You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
**"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
approval before starting", and it does **not** mean "do the work then ask permission to push".
There is no human in this run. **Finishing the work and then asking for permission is
indistinguishable from failing** — the work is discarded either way.

## Guardrails
One attempt. Never exit silently — say `NO-OP: <reason>` if the work is already on main. Never ask
a question or "stand by" for approval. Read the CI job log before diagnosing any failure.

---

## Current state (ground on live build — verify before editing)

`apps/web/src/pages/crm/CrmBoardPage.tsx` (723 lines):
- Line 61: `const STAGES` — kanban column definitions for `OpportunityStage` values.
- Line 100: `forecast` state — weighted forecast summary.
- Line 107: `showCreate` — controls "add opportunity" modal.
- Line 117: `showLead` — controls separate "add lead" modal.
- Lines 341–361: forecast display block.
- Line 409: kanban column map (`STAGES.map`).
- Lines 525, 596: `showCreate` and `showLead` modal renders.

`apps/web/src/pages/crm/OpportunityDetailPage.tsx` (426 lines):
- Detail view for a single Opportunity. Read this file before editing CrmBoardPage
  to understand what data shapes are already in use.

## What to build

### 1. `apps/web/src/pages/crm/crm-api.ts` (new)

Typed fetch helpers for the unified API. Functions:
- `listEntries(authFetch, params?: { stage?: string; isLead?: boolean })` → `Promise<Entry[]>`
- `createEntry(authFetch, dto)` → `Promise<Entry>`
- `updateEntry(authFetch, id, dto)` → `Promise<Entry>`
- `dontPursue(authFetch, id, dto: { dropReasonId: string; detail?: string })` → `Promise<Entry>`
- `priceIt(authFetch, id, siteId: string)` → `Promise<{ tenderId: string }>`
  (calls `POST /crm/entries/:id/dont-pursue` for dontPursue; calls the existing
  `POST /crm/leads/:id/generate-draft-tender` or `/crm/opportunities/:id/convert-to-tender`
  for priceIt — check which endpoint the S3 slice left active and use it)
- `listDropReasons(authFetch)` → `Promise<DropReason[]>`

Define minimal `Entry` and `DropReason` TypeScript types in this file.

### 2. `apps/web/src/pages/crm/LeadsTriageList.tsx` (new)

A list component replacing the kanban. Props: `entries: Entry[]`, callbacks for
`onPriceIt(id)`, `onDontPursue(id)`, `onOpen(id)`. Displays:
- Entry title, source, estimated value (if set), owner.
- Two action buttons per row: "Price it" and "Don't pursue".
- A section header "Not pursued" showing closed entries (stage `not_pursued`) with their
  drop reason label. These rows have no action buttons.
- Do NOT show `archived` entries by default.

Keep the weighted-forecast summary block from the current `CrmBoardPage` — it remains
above the list.

### 3. `apps/web/src/pages/crm/DontPursueModal.tsx` (new)

A modal component. Props: `entryId: string`, `onClose()`, `onSaved()`. Behaviour:
- On mount, fetches `listDropReasons` and populates a `<select>` or DS-equivalent picker.
- Has a free-text `<textarea>` for optional detail.
- On submit, calls `dontPursue(authFetch, entryId, { dropReasonId, detail })`, then calls
  `onSaved()`.
- Shows an inline error if the API call fails.
- Uses the project DS (`@project-ops/ds`) components where available (look at how existing
  modals in the crm pages are built and match the pattern).

### 4. `apps/web/src/pages/crm/CrmBoardPage.tsx`

Replace the kanban:
- Remove `const STAGES` kanban column definitions.
- Remove the `STAGES.map` kanban render block (line 409 area).
- Remove the separate `showLead` / `showCreate` states and their modal renders.
- Add a single `showAddNew` state controlling one unified "+ Add new" modal (reuse or
  inline-replace the existing create modal, merging the lead and opportunity forms — a
  single `isLead` checkbox or toggle determines whether the new entry is a lead).
- Render `<LeadsTriageList entries={...} onPriceIt={...} onDontPursue={...} onOpen={...} />`.
- Add `showDontPursue` state and `dontPursueTargetId` state; wire `onDontPursue` to open
  `<DontPursueModal>`.
- Keep the forecast summary block.
- Add a "Why we don't pursue" roll-up section below the list: group `not_pursued` entries
  by `dropReason.label` and show counts. Fetch drop reasons alongside entries.

### 5. `apps/web/src/pages/crm/OpportunityDetailPage.tsx`

Add a read-only "Not pursued" block (conditionally rendered when
`entry.stage === 'not_pursued'`): show the drop reason label and the free-text detail.

## Do NOT

- Do NOT change the tab label or URL in this slice (that is S5).
- Do NOT build the admin reason-management screen (that is S6).
- Do NOT touch `schema.prisma`, migrations, `/sot/`, or Azure/Entra/SharePoint.
- Do NOT exceed 7 files (crm-api.ts, LeadsTriageList.tsx, DontPursueModal.tsx,
  CrmBoardPage.tsx, OpportunityDetailPage.tsx — 5 core files, leave 2 slots for any
  test file or helper you judge necessary).

Before opening the PR, search for any e2e specs asserting kanban column headings or the
old STAGES values, and update them. List the assertions you changed in the PR body.
