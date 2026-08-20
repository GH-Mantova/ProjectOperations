---
premise: '! grep -q "PIPELINE_FOLDED" apps/web/src/components/ShellLayout.tsx'
premise_means: There are still two Pipelines — the tender board reachable only via a toggle on /tenders, and a separate CRM dashboard at /crm/pipeline that the Tendering nav item confusingly points at.
scope:
  - apps/web/src/components/ShellLayout.tsx
  - apps/web/src/App.tsx
  - apps/web/src/pages/tendering/PipelinePage.tsx
  - apps/web/src/pages/crm/PipelineDashboardPage.tsx
  - apps/web/src/pages/tendering/__tests__/PipelinePage.test.tsx
  - apps/web/src/components/__tests__/ShellLayout.nav.test.tsx
done_when: pnpm build && pnpm lint && grep -q "PIPELINE_FOLDED" apps/web/src/components/ShellLayout.tsx && test -f apps/web/src/pages/tendering/PipelinePage.tsx
size: 6
gate_allow: none
seed_only: false
escalates: false
cluster: pipeline-fold
cluster_order: 2
requires_on_main: apps/api/src/common/auth/permissions.decorator.ts :: ANY_PERMISSIONS_KEY
---

# Fold the CRM pipeline into the Tendering pipeline — one page, two tabs

**Marco, 2026-08-20:** *"the pipeline on crm.view is supposed to fold on the pipeline on tenders.view
with the best of both worlds combined."* Layout chosen from a mock-up: **two tabs**.

## The state today

Two separate Pipelines, and the nav points at the wrong one:

- **The tender board** — the kanban. Reachable **only** by landing on `/tenders` and using the
  Pipeline/Register toggle (`TenderingPage.tsx:722-741`). It has no nav entry anywhere.
- **`/crm/pipeline`** — `PipelineDashboardPage.tsx`, four read-only panels: open pipeline by stage
  (weighted forecast), win rate, stalled opportunities, relationship coverage.
- **The "Pipeline" item in the Tendering nav group** (`ShellLayout.tsx:195-202`) points at
  `/crm/pipeline`, **not** the board — and is gated on `crm.view`, so a user with full tender
  permissions and no CRM access sees no Pipeline item at all.

Marco's brief called Pipeline *"the driving force"* of the Tendering funnel. Right now it is a
read-only CRM dashboard that some tender staff cannot open.

## What to build

**One page at `/tenders/pipeline`, two tabs: `Board` and `Insights`.**

1. **`PipelinePage.tsx`** — new, under `pages/tendering/`. Owns the page title, the tab strip, and
   nothing else of substance. Tab state in the URL (`?tab=board` / `?tab=insights`, defaulting to
   board) so a tab is linkable and survives a refresh. Do not put it in component state only.

2. **Board tab** — renders the existing kanban. **Reuse, do not reimplement.** The board lives inside
   `TenderingPage.tsx` today; extract the minimum needed and leave `/tenders` working exactly as it
   does now, toggle included. If extraction turns out to be more than a lift-and-shift, stop and say
   so in the PR body rather than rewriting the board.

3. **Insights tab** — renders the four panels from `PipelineDashboardPage`. Extract its body into a
   component both routes can render; keep the data fetch (`/crm/pipeline/dashboard`) and the
   `stalledDays` control exactly as they are. **No panel is dropped and no panel is redesigned.**

4. **Nav.** Repoint the Tendering group's "Pipeline" item to `/tenders/pipeline`, change its gate
   from `crm.view` to **`tenders.view`**, fix its `match` predicate, and mark it with the literal
   token **`PIPELINE_FOLDED`** in a comment — this prompt's proof-of-landing marker.
   **Remove the CRM group's Pipeline entry** — that is what "fold" means here. One Pipeline, one
   place, under Tendering.

   ⚠️ **Check the sibling `match` predicates.** The "Tenders" item above (`:186-193`) matches
   `/tenders` with a list of `!path.startsWith(...)` exclusions. Add `/tenders/pipeline` to that list
   or **two nav items light up at once**. Read `:186-193`; do not assume.

5. **Routes.** `App.tsx:349` currently redirects `/tenders/pipeline` → `/tenders`. Stop redirecting
   it; render `PipelinePage`. Then point **`/crm/pipeline` at `/tenders/pipeline`** with a
   `<Navigate replace>` so existing bookmarks and links keep working. Leave the other legacy
   redirects at `:350-351` alone.

## Why the API slice comes first

This prompt is gated on `ANY_PERMISSIONS_KEY` (slice 1 of this cluster). Until that lands, the
dashboard endpoints require `crm.view`, so the Insights tab would 403 for exactly the tender staff
this fold exists to serve. **Do not work around it in the UI** — no try/catch that swallows a 403,
no hiding the tab on permission. If the gate has somehow opened without the API change, stop and say
so.

## Tests

**`PipelinePage.test.tsx`**
1. Both tabs render; Board is the default.
2. `?tab=insights` opens Insights directly; switching tabs updates the URL.
3. The Board tab renders kanban columns; the Insights tab renders the four panel headings.
4. **Negative control:** `/tenders` still renders its own Pipeline/Register toggle unchanged. This
   fold adds a page — it must not quietly gut the existing one.

**`ShellLayout.nav.test.tsx`**
5. The Tendering "Pipeline" item links to `/tenders/pipeline` and renders for a user with
   `tenders.view` and **without** `crm.view` — the regression this fixes.
6. The CRM group no longer has a Pipeline entry.
7. **Only one nav item is active on `/tenders/pipeline`** — this catches the exclusion-list mistake.

## Do NOT

- Do NOT delete `PipelineDashboardPage`'s panels, data fetch, or `stalledDays` control. Fold means
  combine, not trim.
- Do NOT remove the Register from `/tenders`, or change the Pipeline/Register toggle there. Marco was
  explicit: *"We are NOT deleting the tender from the tendering, it will remain there."*
- Do NOT change board behaviour, columns or drag-drop — that is slice 1 of this cluster.
- Do NOT change any permission gate other than the one nav item. The API side is slice 2.
- Do NOT touch `docs/` or `sot/`.

## Guardrails

- One attempt. If `PIPELINE_FOLDED` already exists, say `NO-OP: <reason>`.
- `pnpm build`, `pnpm lint` and both test files must pass.
- Six files. If the e2e suite asserts the old nav target or the `/crm/pipeline` page, fix those
  assertions and name them in the PR body rather than leaving CI to find them.
