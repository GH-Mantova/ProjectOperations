---
premise: '! grep -q "CRM_PARITY_INBOX_V1" apps/web/src/pages/crm/CommsInboxTriage.tsx'
premise_means: The Comms hub opens on every tab with a green "Inbox view" notice and a permanently expanded New-thread card before any content, the Inbox's Anchor and Channel filters are a native select and a row of outlined chips, Capture a lead is an indigo button under them, and the untriaged rows do not carry the artboard's lead / channel / age chips - so the screen a lead arrives on looks like a form, not an inbox.
scope:
  - apps/web/src/pages/crm/CommsPage.tsx
  - apps/web/src/pages/crm/CommsHubPage.tsx
  - apps/web/src/pages/crm/CommsInboxTriage.tsx
  - apps/web/src/pages/crm/AnchorPicker.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s7-comms-inbox.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_INBOX_V1" apps/web/src/pages/crm/CommsInboxTriage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/CommsInboxTriage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AnchorPicker.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 5
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 8
requires_on_main: 'apps/web/src/pages/crm/AccountLinkPreview.tsx :: CRM_PARITY_BULKLINK_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S7 - Comms hub · Inbox looks like artboard "Comms hub · Inbox"

**Slice 8 of 9** of `crmvis`. Presentation only. Artboard `Intake.dc.html` in
`Claude Design/proposed/crm-visual-parity/` is the standard; acceptance is the side-by-side PNG
for screen `comms-inbox`. This slice owns the **frame** every Comms tab shares (title row,
tabs, the New-thread strip, the Anchor filter) and the **Inbox** rows; S8 owns the Threads and
To-dos rows and the rail.

**Gate:** S6 on main (chain order only).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the six files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_INBOX_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen is rebuilt; Marco judges the side-by-side.
- Suites pinning these files: `crm-s10-inbox-triage.test.ts`, `comms-inbox.helpers.test.ts`,
  `LeadsTriageList.archive.test.tsx`, `crm-s9-anchor-picker.test.ts`, `crm-comms-rail.test.ts`,
  `crm-uifix-s1.test.ts` (the inbox tab is controlled from the shell, ~27-34). Every helper
  (`isIntakeLeadEmpty`, `leadRowActionSet`, `sortLeadsOldestFirst`, `buildCreateThreadBody`,
  `mapTypeToServer`…) and every verb (`Price it`, `Don't pursue`, `Archive`, `Delete`) keeps
  its behaviour; the suites stay green untouched.
- **The intake/comms boundary stands** (`design_ref` canvas note "ONE PLACE I DIDN'T FOLLOW
  YOU"): triage verbs stay in `CommsInboxTriage.tsx`; `CommsHubPage.tsx` imports nothing from
  Tender or Job. Do not move code across that line to make a picture match.
- **PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → comms-inbox
  (artboard Intake)`. An empty inbox in the seed data is not a FAIL.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette. Kit first (`s7-type-page-title`,
`s7-type-label`, `s7-card`, `s7-badge` tones, `s7-btn` variants, `s7-select`). Shapes the kit
lacks go in `crm.css` as `crm-*` classes with `var(--…)` colours only; S1-S6 provide `crm-tabs`,
`crm-page-head`, `crm-filter-chip`, `crm-avatar`, `crm-cell-sub`, `crm-alert--*`, `crm-dialog`.
Primary button = `s7-btn s7-btn--primary crm-btn--primary` - Marco's ruling 2026-09-14: on the CRM
screens the artboard wins, so S1's `crm.css` carries the `crm-btn--primary` override
(`--brand-primary` fill, `--text-inverse` ink, `--brand-primary-dark` hover) and the kit's orange
stays untouched everywhere else; teal is also for tabs / links / active states. The artboard's
orange dots and amber foot strip are annotations, not UI - the `ARCHIVE — NEEDS A REASON / DELETE
— ONLY WHEN EMPTY` panel at the artboard's foot is that strip's explanation of verbs that
**already shipped** (#1614); do not build a panel.

## Grounded on main (read first; cite line numbers in the PR body)

- `CommsPage.tsx` (147 lines): `?tab=` shell (~3-5), tab card above the page (~126-132),
  `<CommsHubPage activeInnerTab=…/>` (~144).
- `CommsHubPage.tsx` (1242 lines): `CommsInboxPage` (~441) renders, on every tab, the `Inbox
  view — showing threads across all records…` notice and the `New thread` composer built on
  `AnchorPicker` (~449-453), then the tab body; `CRM_COMMS_RAIL_V1` layout (~121-160). 45 hex
  literals, 0 `var(--` reads, 57 inline `style` props.
- `CommsInboxTriage.tsx` (750 lines): `Capture a lead` (~344), `Untriaged · oldest first`
  (~148-158), `Channel` select (~34), `accountChip` with `#e0e7ff` / `#3730a3` (~105-118), the
  two dialogs (~178, ~243). 56 hex literals, 0 `var(--`.
- `AnchorPicker.tsx` (269 lines): the six type chips (~11), indigo `#6366f1` / `#eef2ff`.
- Today vs artboard (Marco's screenshots 2026-09-14): tab card above; title `Comms hub` +
  `All records`; green notice; open composer card (six outlined type chips, *Pick a record type
  to anchor this thread.*, Subject, indigo `Start`); `All channels` native select + `0 leads`;
  indigo `+ Capture a lead`; card `Untriaged · oldest first  page 1 of 1`. Artboard: title +
  *Everything coming in — leads not yet triaged, live conversations, and what you owe people.*;
  tabs `Inbox 15 (red badge) · Threads 12 · To-dos 18`; one control row: `Anchor: All ▾` chip
  with the muted legend `Lead · Tender · Job · Account · Other` beside it, right `Channel: All ▾`
  chip + `Capture a lead` primary; one card `UNTRIAGED · OLDEST FIRST` whose rows are: title
  (600) + `Lead` `s7-badge--neutral` + channel `s7-badge--info` (`Email`) / `--active`
  (`Phone`) + age muted (amber when old), the quoted note line, `Account: <link>`; right:
  `Archive` / `Don't pursue` (`s7-btn--secondary`) + `Price it` (`s7-btn--primary`), or the
  single outlined-danger `Delete` for an empty lead.

## What to build

1. **`CommsPage.tsx`** stops rendering the tab card; passes `tabs` + `activeInnerTab` down.
2. **`CommsHubPage.tsx` frame** (unanchored mode only; anchored mode ~45-52 is untouched):
   `crm-page-head` (title, subtitle per tab: Inbox's above; Threads/To-dos get *Internal
   threads and to-dos, anchored to an account, tender, job or contract.*), right `Anchor: All ▾`
   `crm-filter-chip` + `+ New thread` `s7-btn--primary`; `CrmTabs` under it. **Remove the green
   notice.** The composer becomes the artboard's `NEW THREAD — ANCHOR TO` strip (`s7-card`,
   label + type `s7-select` + record `s7-select` + subject `s7-input` + `Start`), **hidden until
   `+ New thread` is pressed** and closed on Start / Escape; it is the same `AnchorPicker`
   state and `buildCreateThreadBody` call as today. The `Anchor: All ▾` chip filters the tab
   lists by type where the tab already supports it; where it does not, it is the legend only.
3. **`AnchorPicker.tsx`**: the type chips become `s7-badge`-styled toggles (selected =
   `--brand-primary` fill); no hex.
4. **`CommsInboxTriage.tsx`** - marker `export const CRM_PARITY_INBOX_V1 = "crmvis-s7"`;
   `import "./crm.css"`. The control row and card as the artboard block above; `Channel` as a
   `crm-filter-chip` select; `Capture a lead` moves into the control row; rows as described;
   the two dialogs on `s7-*` inputs and buttons (`Don't pursue` confirm stays `--status-danger`).
5. **Spec** `crmvis-s7-comms-inbox.test.ts`: the composer is not rendered until the New-thread
   state is on; `leadRowActionSet` regression pin; no 6-digit hex in the two files.

## Do NOT

- Do NOT change any fetch, POST body, verb or the intake/comms import boundary.
- Do NOT touch the Threads / To-dos rows or the rail (S8), the anchored view, the API,
  `tokens.css` or `/sot/`.
- Do NOT keep the notice "for safety" - the tab strip and the breadcrumb already say where you are.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_INBOX_V1" apps/web/src/pages/crm/CommsInboxTriage.tsx
! grep -q "Inbox view" apps/web/src/pages/crm/CommsHubPage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/CommsInboxTriage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AnchorPicker.tsx
```

Open the PR titled `feat(crm): S7 - Comms hub frame and Inbox on the s7 kit, New thread on demand (CRM_PARITY_INBOX_V1)`
and leave it UNMERGED.
