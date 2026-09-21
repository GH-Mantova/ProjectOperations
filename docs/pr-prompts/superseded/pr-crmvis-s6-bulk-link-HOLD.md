---
premise: '! grep -q "CRM_PARITY_BULKLINK_V1" apps/web/src/pages/crm/AccountLinkPreview.tsx'
premise_means: The Review-and-link preview does the mock-up's job - counts, an editable proposed lifecycle per client, nothing written until Create - but not in its shape - a padded page-style overlay with three plain count tiles labelled in parentheses, no "How the match works" panel, no rule line under the table, and Cancel / Create not pinned to a footer.
scope:
  - apps/web/src/pages/crm/AccountLinkPreview.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s6-bulk-link.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_BULKLINK_V1" apps/web/src/pages/crm/AccountLinkPreview.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AccountLinkPreview.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 3
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 7
requires_on_main: 'apps/web/src/pages/crm/TendersRegisterPage.tsx :: CRM_PARITY_FOLLOWUPS_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S6 - Review and link looks like artboard "Review and link — preview"

**Slice 7 of 9** of `crmvis`. Presentation only. Artboard `BulkLink.dc.html` (1100x900, a
dialog over a dimmed page) in `Claude Design/proposed/crm-visual-parity/` is the standard;
acceptance is the side-by-side PNG for screen `bulk-link` - an **optional** screen, captured
only while the seed data has unlinked clients. If the review cannot capture it, the PR body
carries a local screenshot instead and says so.

**Gate:** S5 on main (chain order only).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_BULKLINK_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - this screen writes 200+ rows on Create; Marco judges the side-by-side.
- `accountLinkPreview.helpers.test.ts` pins the helpers and the `ambiguousCount === 0` stop
  (~12, ~97, ~144). Every export, the commit loop (~143-170), `setRowOverride` (~111),
  `bulkSet` (~119) and `bulkSetNoHistory` (~131) keep their behaviour; the suite stays green.
- The **"Ambiguous must be 0"** block (~284-300) is a safety stop, not decoration - it stays,
  restyled as `crm-alert--danger`.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette. Kit first (`s7-type-label`, `s7-card`,
`s7-badge` tones, `s7-btn` variants, `s7-select`, `s7-table`). Shapes the kit lacks go in
`crm.css` as `crm-*` classes with `var(--…)` colours only; S1-S5 provide `crm-kpi`,
`crm-alert--warning`, `crm-cell-sub`, `crm-page-head`. Primary button = `s7-btn s7-btn--primary
crm-btn--primary` - Marco's ruling 2026-09-14: on the CRM screens the artboard wins, so S1's
`crm.css` carries the `crm-btn--primary` override (`--brand-primary` fill, `--text-inverse` ink,
`--brand-primary-dark` hover) and the kit's orange stays untouched everywhere else; teal is also
for links / active states / the numbered step discs. The artboard's orange dots and amber foot
strip are annotations, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `AccountLinkPreview.tsx` (648 lines): `AccountLinkPreview({ onDone })` (~60), rendered by
  `AccountsListPage.tsx` as an overlay (~657-675) from the banner's `Review and link →` (~806);
  fetch `/crm/accounts/link-preview` (~598 on the list page). `CountTile`s labelled `Exact
  matches (1:1)` / `Ambiguous` / `Already linked (skipped)` (~278-280), h1 in `--font-heading`
  (~249), intro paragraph (~252-253 *This is a one-time catch-up screen…*), table with a
  per-row lifecycle select, bulk-set from the header. 60 hex literals (`#374151`, `#57534e`,
  `#4f46e5`, `#6366f1`…), 5 `var(--` reads.
- Artboard: a 940px dialog - header `Link 205 clients to accounts` + *Nothing is written until
  you press Create. This preview is safe to close.*; three tiles `EXACT 1:1 MATCH 205 / every
  client without an account`, `AMBIGUOUS 0 / no name matching involved`, `ALREADY LINKED 9 /
  skipped, never touched`; a `--brand-primary-light` panel `HOW THE MATCH WORKS` with three
  numbered points (teal discs); `PROPOSED LIFECYCLE — EDITABLE` + `Showing 4 of 205` right;
  table Client / Tenders / Last tender / Won / Proposed lifecycle (a tinted `s7-badge` with a
  `▾` - the select); rule line *Rule used: won a tender → Active…* muted; footer with
  *This is a one-time catch-up…* left and `Cancel` / `Create 205 accounts` right.

## What to build

- Marker `export const CRM_PARITY_BULKLINK_V1 = "crmvis-s6"`; `import "./crm.css"`.
- `crm-dialog` (in `crm.css`): centred, max-width 940px, `--surface-card`, `--radius-xl`,
  `--shadow-dropdown`, header / body / footer regions, body scrolls, backdrop
  `rgba(0,0,0,.45)` via a `--overlay` alias you define **in `crm.css` from tokens**
  (`color-mix(in srgb, var(--brand-dark) 45%, transparent)`).
- Compose the artboard top to bottom with the page's existing state: the three tiles as
  `crm-kpi` (labels and sub-lines **exactly the artboard's words**; the `(1:1)` / `(skipped)`
  parentheticals move into the sub-lines), the How-the-match-works panel (the three points are
  the artboard's sentences - they describe what the code does: unique `clientId`, lifecycle
  proposed not applied, additive and reversible), the table on `s7-table` with the lifecycle
  select styled as a tinted badge (`--active` Active, `--warning` Prospect, `--neutral` Past)
  wrapping the real `<select>`, `Showing N of M` when the list is longer than the rows shown,
  the rule line, and the pinned footer (`Cancel` `s7-btn--secondary`, `Create N accounts`
  `s7-btn--primary`, disabled while ambiguous > 0 or committing, as today).
- Bulk-set from the header stays where it is today (the artboard's rule line names it).
- Spec `crmvis-s6-bulk-link.test.ts`: the three tile labels match the artboard; Create is
  disabled when `ambiguousCount > 0` (existing guard, pinned); no 6-digit hex in the file.

## Do NOT

- Do NOT change what is fetched, proposed, overridden or posted; do NOT touch the commit loop.
- Do NOT touch `AccountsListPage.tsx` (S1), the API, `tokens.css` or `/sot/`.
- Do NOT remove the ambiguous-count stop.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_BULKLINK_V1" apps/web/src/pages/crm/AccountLinkPreview.tsx
grep -q "How the match works" -i apps/web/src/pages/crm/AccountLinkPreview.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AccountLinkPreview.tsx
```

Open the PR titled `feat(crm): S6 - Review-and-link preview as the artboard's dialog on the s7 kit (CRM_PARITY_BULKLINK_V1)`
and leave it UNMERGED.
