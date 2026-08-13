---
premise: '! test -f apps/web/src/pages/tendering/TendersAttentionWorklist.tsx'
premise_means: No "needs attention" worklist UI exists on the Tenders page — estimators have no consolidated urgency-sorted surface for dismissing, snoozing, or actioning tender reminders.
scope:
  - apps/web/src/pages/tendering/TendersAttentionWorklist.tsx
  - apps/web/src/pages/tendering/useTendersAttention.ts
  - apps/web/src/pages/tendering/TenderingPage.tsx
  - apps/web/src/pages/tendering-page-helpers.ts
  - apps/web/src/pages/tendering/__tests__/TendersAttentionWorklist.test.tsx
  - apps/api/src/modules/tendering/tendering.controller.ts
done_when: pnpm build && pnpm lint && test -f apps/web/src/pages/tendering/TendersAttentionWorklist.tsx && grep -q "useTendersAttention" apps/web/src/pages/tendering/TendersAttentionWorklist.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
requires_file_on_main: apps/api/src/modules/tendering/tender-reminder-escalation.service.ts
---

# TR-4: "Needs attention" worklist UI on the Tenders page

**Binding plan:** `docs/plans/tender-reminders-plan.md` (read sections 2, 4, and 7 in full before
starting). This is the fourth and final slice of the tender reminders cluster.

**Gate:** TR-3 (manager escalation) must be on main. Verify that
`apps/api/src/modules/tendering/tender-reminder-escalation.service.ts` exists before starting.

## Context — grounded against origin/main (REUSE — do NOT rebuild)

- `apps/web/src/pages/tendering-page-helpers.ts` exports `getTenderingAttentionSummary()` which
  returns `attentionState` ("healthy" / "watch" / "rotting") and `needsAttention: boolean`. The
  function signature was extended in TR-1 to accept optional `idleThresholds`. Reuse this — do NOT
  recompute attention state in a second place.
- `apps/api/src/modules/tendering/tender-entries.service.ts` — `TenderEntry` types `follow_up`,
  `self_reminder`, `task` are the mechanism for snooze (create a self_reminder with a future
  dueDate), dismiss (update status to 'done' on an existing follow_up), and set manual follow-up
  (create a follow_up). Reuse the existing REST endpoints — do NOT add new API endpoints for these
  actions.
- `apps/web/src/pages/tendering/` — check the existing page structure (there are already components
  like `NeedsOutcomePanel.tsx`, `ClientDetailDrawer.tsx`, etc.) to understand the correct
  import/wiring conventions before writing new components.
- The existing tenders list API already returns follow-up and clarification data that feeds
  `getTenderingAttentionSummary()`. Do NOT re-fetch data in a second place.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.

## What to build

### 1. `apps/web/src/pages/tendering/useTendersAttention.ts` (new hook)

A custom hook that:
- Accepts the full tender list data (already fetched by the parent page — do NOT duplicate the API
  call) and the current `now` date.
- Runs `getTenderingAttentionSummary()` for each tender, filtering to `needsAttention === true`.
- Sorts the result by urgency: overdue quote dueDate > overdue TenderEntry followUps > rotting >
  watch. Within each band, sort by the nearest `nextActionAt` date ascending.
- Returns `{ attentionItems: AttentionItem[], totalCount: number }`.

`AttentionItem` shape:
```typescript
type AttentionItem = {
  tender: TenderListRow;       // whatever the existing list item type is
  summary: TenderingAttentionSummary;
  urgencyBand: "overdue_due" | "overdue_followup" | "rotting" | "watch";
};
```

### 2. `apps/web/src/pages/tendering/TendersAttentionWorklist.tsx` (new)

A React component that renders the attention worklist. It accepts `attentionItems` from the hook
and renders a compact list (not a full table — a card or list-row style matching existing Tenders
page UI conventions).

Per-row actions:
- **Snooze** — creates a `TenderEntry` of type `self_reminder` with a future `dueDate` (e.g. 3
  days from now by default, or a date the user picks). Calls the existing
  `POST /tenders/:id/entries` endpoint with `{ type: "self_reminder", body: "Snoozed", dueDate }`.
- **Mark actioned** — creates a `TenderEntry` of type `follow_up` with status `done`:
  `POST /tenders/:id/entries` with `{ type: "follow_up", body: "Marked actioned", dueDate: today, status: "done" }`.
  This is the "dismiss" action — it creates a dated log entry so the cron doesn't keep re-firing.
- **Set follow-up date** — opens a small date-picker popover and creates a `TenderEntry` of type
  `follow_up` with the chosen date: `POST /tenders/:id/entries` with
  `{ type: "follow_up", body: "Manual follow-up set", dueDate: chosenDate }`.

After any action, refetch the tender list (trigger the parent page's existing reload/refetch). Do
not optimistically mutate local state — let the refetch drive the UI update.

Show an empty-state message when `totalCount === 0` ("All tenders are up to date").

### 3. Wire into `apps/web/src/pages/tendering/TenderingPage.tsx` (or the main Tenders page)

Locate the correct parent page file — it is likely `TenderingPage.tsx` or a file in
`apps/web/src/pages/tendering/`. Check the existing file structure before editing.

Wire `TendersAttentionWorklist` as a collapsible panel or tab at the top of the Tenders page,
above or alongside the existing list. Show a badge on the panel header with `totalCount` when
non-zero. Follow the existing UI conventions (no new UI library components — reuse whatever
component primitives are already in the codebase).

### 4. Extend `apps/api/src/modules/tendering/tendering.controller.ts` if needed

If the existing tenders list endpoint does not already return `followUps` (with `status` and
`dueAt`) and `clarifications` (with `status` and `dueDate`) on each tender row, add those
relations to the Prisma `include` in the controller or service. Do not add a new endpoint — extend
the existing list query minimally.

Check the existing endpoint first — if the data is already there, skip this step.

### 5. Unit/vitest test — `apps/web/src/pages/tendering/__tests__/TendersAttentionWorklist.test.tsx` (new)

Use the existing vitest + React Testing Library setup (check how other web tests are structured
before writing — look at other `__tests__/*.test.tsx` files in the web package).

Key assertions:
- A tender with `attentionState = "rotting"` appears in the list; a tender with `attentionState =
  "healthy"` does not.
- Tenders are sorted: overdue-due-date band appears before watch band.
- Clicking "Mark actioned" calls the entries POST endpoint with the correct payload.
- `totalCount === 0` renders the empty-state message.

## Do NOT

- Do NOT recompute `attentionState` in a second place — call `getTenderingAttentionSummary()`.
- Do NOT add new API endpoints for snooze/dismiss/set-follow-up — reuse the existing entries API.
- Do NOT extend the deprecated `TenderFollowUp` endpoint.
- Do NOT build a new notification channel — notifications are TR-2/TR-3's job.
- Do NOT touch Azure / Entra / SharePoint or `/sot/`.
- Do NOT add a new UI component library dependency.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

## Guardrails

- One attempt. Never exit silently — if `TendersAttentionWorklist.tsx` already exists on main, say
  `NO-OP: <reason>` and stop.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- Read the CI job log before diagnosing any failure.
- `pnpm build` and `pnpm lint` must both pass before pushing.
- Before starting, verify `tender-reminder-escalation.service.ts` exists on main (`test -f` it).
