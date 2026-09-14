---
premise: '! grep -q "CRM_PARITY_THREADS_V1" apps/web/src/pages/crm/CommsHubPage.tsx'
premise_means: The Threads tab has the mock-up's two-column layout and to-do rail but not its look - a "Threads — page 1 of 1" card with plain rows, an "Add a to-do" card whose Assign-to and Due are a bare avatar chip and a native date input, no overdue chip on "My to-dos", and a To-dos tab that is one plain card - and every remaining hex literal on the page is indigo.
scope:
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s8-comms-threads.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_THREADS_V1" apps/web/src/pages/crm/CommsHubPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/CommsHubPage.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 4
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 9
requires_on_main: 'apps/web/src/pages/crm/CommsInboxTriage.tsx :: CRM_PARITY_INBOX_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S8 - Comms hub · Threads (and To-dos) looks like artboard "Comms hub · Threads"

**Slice 9 of 9** of `crmvis` - the last one. Presentation only. Artboard `Comms.dc.html` in
`Claude Design/proposed/crm-visual-parity/` is the standard; acceptance is the side-by-side PNG
for screen `comms-threads`. The To-dos tab has no artboard of its own; it is the rail's
`MY TO-DOS` rows at full width, so it rides along here.

**Gate:** S7 on main - it gave this page the title row, `CrmTabs`, the on-demand New-thread
strip and the `Anchor: All ▾` chip. This slice touches only the tab bodies and the rail.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_THREADS_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen is rebuilt; Marco judges the side-by-side.
- `crm-comms-rail.test.ts` pins `CRM_COMMS_RAIL_V1` (the layout contract ~121-160, incl.
  `GRID_TEMPLATE`, `GAP`, `DUE_SOON_DAYS`), `buildTodoRowView` (~249), `countOverdueTodos`
  (~276), `buildThreadRowView` (~328), `buildToggleTaskBody` (~342). Keep the constant's values
  and every builder; the suite stays green untouched. The palette derived at ~187-207 from
  `STATUS_COLOUR` is what goes - not the builders.
- **PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → comms-threads
  (artboard Comms)`. No threads in the seed data is not a FAIL.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette. Kit first (`s7-type-label`, `s7-card`,
`s7-badge` tones, `s7-btn` variants, `s7-input` / `s7-select`). Shapes the kit lacks go in
`crm.css` as `crm-*` classes with `var(--…)` colours only; S1-S7 provide `crm-tabs`,
`crm-page-head`, `crm-filter-chip`, `crm-avatar`, `crm-cell-sub`. Primary button = `s7-btn
s7-btn--primary crm-btn--primary` - Marco's ruling 2026-09-14: on the CRM screens the artboard
wins, so S1's `crm.css` carries the `crm-btn--primary` override (`--brand-primary` fill,
`--text-inverse` ink, `--brand-primary-dark` hover) and the kit's orange stays untouched
everywhere else; teal is also for tabs / links / active states. The artboard's orange dots and
amber foot strip are annotations, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `CommsHubPage.tsx`: `TodoRow` (~356, serves the rail and the To-dos tab ~349), `ThreadRow`
  (~409, anchor chip ~422), the rail's `Add a to-do` composer (~459-460, POST needs an anchor),
  `My to-dos` (~529), `openAnchoredView` (~551), rail state (~583). After S7 the page still
  has its 45 hex literals in these rows and the rail (`#6366f1`, `#3730a3`, `#e0e7ff`,
  `#eef2ff`).
- Today vs artboard (Marco's screenshots 2026-09-14): Threads = `Threads — page 1 of 1` card
  left, rail right with `Add a to-do` (`What needs doing?`, `Assign to` avatar chip `Me`,
  `Due dd/mm/yyyy`, indigo `Add`, the helper *Pick a record in the anchor picker above…*) and
  `My to-dos` card. To-dos tab = `My to-dos — page 1 of 1` single card. Artboard: left `s7-card`
  with the thread rows: `crm-avatar` initials, subject (600) + anchor chip (`s7-badge--active`
  `Tender T-2418` / `--warning` `Account · Hansen Yuncken` / `--neutral` `Job J-1187`), the
  last message line `R. Silva: …` with `@mentions` in teal 600, `4 messages · 6 days ago`
  muted; rail = `ADD A TO-DO` card (input, `Assign to` `s7-select` with the avatar inside, `Due`
  `s7-select`-styled date, `Add` `s7-btn--primary` right) above `MY TO-DOS` card with the
  `1 overdue` `s7-badge--danger` in the heading and rows = checkbox (danger ring when overdue)
  + title + `Overdue by 3 days · Hansen Yuncken` (danger) / `Due in 2 days · Tender T-2418`
  (muted).

## What to build

- Marker `export const CRM_PARITY_THREADS_V1 = "crmvis-s8"`.
- `ThreadRow` and `TodoRow` on `crm-thread-row` / `crm-todo-row` (add to `crm.css`: 16px
  padding, `--border-subtle` divider, hover `--surface-hover`); chips via `s7-badge`; the
  overdue / due-soon / on-track inks via `--status-danger` / `--status-warning` /
  `--text-muted` (`buildTodoRowView` already says which).
- Drop the `— page 1 of 1` from both card headings into a muted right-aligned `crm-cell-sub`
  (pagination stays functional); headings `THREADS` / `MY TO-DOS` as `s7-type-label`.
- Rail composer as the artboard block: the helper about the anchor picker stays but muted
  under the `Add` row, and reads *Pick a record from New thread above — a to-do hangs off an
  account, tender, job or contract.* only while no anchor is selected.
- To-dos tab: the same `TodoRow`s in one full-width `s7-card` headed `MY TO-DOS` with the
  overdue chip.
- Delete the `RAIL_INK` / `STATUS_COLOUR`-derived palette (~187-207) and every hex.
- Spec `crmvis-s8-comms-threads.test.ts`: `buildTodoRowView` and `countOverdueTodos`
  regression pins; `CRM_COMMS_RAIL_V1.GRID_TEMPLATE` unchanged; no 6-digit hex in the file.

## Do NOT

- Do NOT change what a thread row opens, what a to-do POSTs or the anchor requirement.
- Do NOT touch the frame S7 built, `CommsInboxTriage.tsx`, `AnchorPicker.tsx`, the anchored
  view, the API, `tokens.css` or `/sot/`.
- Do NOT alter `CRM_COMMS_RAIL_V1`'s values.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_THREADS_V1" apps/web/src/pages/crm/CommsHubPage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/CommsHubPage.tsx
grep -c 'var(--' apps/web/src/pages/crm/crm.css   # > 0
```

Open the PR titled `feat(crm): S8 - Threads, To-dos and the rail on the s7 kit (CRM_PARITY_THREADS_V1)`
and leave it UNMERGED.
