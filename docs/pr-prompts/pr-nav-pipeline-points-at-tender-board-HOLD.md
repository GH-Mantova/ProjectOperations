---
premise: '! grep -q "NAV_PIPELINE_IS_TENDER_BOARD" apps/web/src/components/ShellLayout.tsx'
premise_means: The "Pipeline" item in the Tendering nav group still opens /crm/pipeline — a read-only CRM opportunity dashboard — instead of the tender submission board it is named after.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/App.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.tsx
done_when: pnpm build && pnpm lint && grep -q "NAV_PIPELINE_IS_TENDER_BOARD" apps/web/src/components/ShellLayout.tsx
size: 3
gate_allow: none
seed_only: false
escalates: false
cluster: tendering-board-fix
cluster_order: 2
requires_on_main: apps/web/src/pages/tendering/tenderingPage.helpers.ts :: COUNT_ONLY_STAGES
---

# "Pipeline" under Tendering opens the wrong page

## The defect

`ShellLayout.tsx:195-202`, inside the **Tendering** nav group:

```ts
{
  // CRM pipeline dashboard (crm.view — same gate as accounts/comms).
  to: "/crm/pipeline",
  label: "Pipeline",
  icon: ICON_AUDIT,
  match: (path) => path.startsWith("/crm/pipeline"),
  requiresPermission: "crm.view"
}
```

`/crm/pipeline` is `PipelineDashboardPage.tsx`, which describes itself at `:6-7` as *"Read-only
surface over TenderOutcome (win/loss capture) and Opportunity/Account roll-ups. **No mutation happens
here.**"* It is a CRM dashboard. It is not the tender board.

Marco's brief named Pipeline as the **"driving force"** of the Tendering funnel
(`crm-tendering-nav-remodel-plan.md:24-25`): *"Leads & opportunities → Tenders (draft + pricing) →
Pipeline (driving force)"*. The actual tender board is reachable **only** by landing on `/tenders`
and using the Pipeline/Register toggle (`TenderingPage.tsx:722-741`). Nothing in the nav points at it.

Two consequences, both live today: the item under Tendering is gated on `crm.view`, so a user with
full tender permissions and no CRM access sees no Pipeline item at all; and the board Marco calls the
driving force of the funnel has no nav entry anywhere in the app.

## What to build

1. **Give the tender board a real route.** `App.tsx:349` currently has
   `/tenders/pipeline` → `<Navigate to="/tenders" replace />`. Stop redirecting it: make
   `/tenders/pipeline` render `TenderingPage` **with the board view selected**. `TenderingPage.tsx:189`
   already models this (`type View = "pipeline" | "register"`, default `"pipeline"` at `:325`) — drive
   that initial state from the route rather than adding a second component.

   Keep `/tenders` working exactly as it does now, toggle and all. This adds a way in; it removes
   nothing. Also keep the other two legacy redirects at `:350-351` untouched.

2. **Repoint the Tendering nav item** to `/tenders/pipeline`, change its permission gate from
   `crm.view` to **`tenders.view`** (it is a tender surface, and the group's other items already use
   that), fix its `match` predicate, and mark it with the literal token
   **`NAV_PIPELINE_IS_TENDER_BOARD`** in a comment — that is this prompt's proof-of-landing marker.

   ⚠️ **Check the sibling `match` predicates when you do this.** The "Tenders" item just above
   (`:186-193`) matches on `/tenders` with a list of `!path.startsWith(...)` exclusions. Adding a new
   `/tenders/*` route without adding it to that exclusion list will light up **two** nav items at
   once. Verify by reading `:186-193`, not by assuming.

3. **Rename the CRM group's dashboard entry** so two items are not both called "Pipeline". It lives
   under the CRM group and is a win/loss dashboard — name it for what it is
   (e.g. *"Pipeline & win/loss"*), keep it on `/crm/pipeline` and on `crm.view`. Do **not** delete
   it; it is a real page Marco uses.

## Tests

`ShellLayout.nav.test.tsx` (follow the existing tests in that folder):

1. The Tendering group's Pipeline item links to `/tenders/pipeline`, not `/crm/pipeline`.
2. It renders for a user with `tenders.view` and **without** `crm.view` — the regression this fixes.
3. **Only one nav item is active on `/tenders/pipeline`.** This is the one that catches the
   exclusion-list mistake in step 2.
4. The CRM group still has its own dashboard entry, under its new name, still on `crm.view`.

## Do NOT

- Do NOT delete `/crm/pipeline` or `PipelineDashboardPage`. Renaming a nav label is the whole change.
- Do NOT move the Pipeline item out of the Tendering group. Marco's decision 3 puts it there.
- Do NOT touch `TenderingPage`'s board internals — that is slice 1 of this cluster, which this
  prompt is gated behind.
- Do NOT change the Register toggle or remove anything from `/tenders`.
- Do NOT touch `docs/` or `sot/`.

## Guardrails

- One attempt. If `NAV_PIPELINE_IS_TENDER_BOARD` already exists, say `NO-OP: <reason>`.
- `pnpm build`, `pnpm lint` and the nav test must pass.
- Three files. If the e2e suite asserts the old nav target, fix that assertion and name it in the PR
  body rather than leaving CI to discover it.
