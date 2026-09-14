---
premise: '! grep -q "CRM_PARITY_FOLLOWUPS_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: Follow-ups has the mock-up's four KPI cards and eight toggles but in the wrong order and dress - cards first, then two labelled toggle rows, then the register's whole filter form, then the table - with outlined amber toggles where the artboard fills them, no colour stripe on the cards, and a "Tender" column where the artboard says "What".
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s5-followups.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_FOLLOWUPS_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/TendersRegisterPage.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 4
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 6
requires_on_main: 'apps/web/src/pages/crm/TendersRegisterPage.tsx :: CRM_PARITY_REGISTER_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S5 - Tenders · Follow-ups looks like artboard "Tenders · Follow-ups"

**Slice 6 of 9** of `crmvis`. Presentation only. Artboard `FollowUps.dc.html` in
`Claude Design/proposed/crm-visual-parity/` is the standard; acceptance is the side-by-side PNG
for screen `followups`.

**Gate:** S4 on main - it gave this page the title row, `CrmTabs`, the chip filter row and the
artboard's table cells. This slice adds only what the Follow-ups tab shows on top.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_FOLLOWUPS_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen is rebuilt; Marco judges the side-by-side.
- `crmui-register-s2.test.ts` pins the KPI figures and the two toggle groups' composition
  (`CRM_FOLLOWUPS_V2` ~718-721: a row passes when it matches a next-action toggle AND an
  entity-type toggle). The composition, defaults and figures do not change; the suite stays
  green untouched.
- **PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → followups
  (artboard FollowUps)`. Zero KPIs in the seed data are not a FAIL.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette. Kit first (`s7-card`, `s7-card-grid--kpi`,
`s7-type-label`, `s7-badge` tones, `s7-btn` variants). Shapes the kit lacks go in `crm.css` as
`crm-*` classes with `var(--…)` colours only; S1-S4 provide `crm-tabs`, `crm-kpi` (+ `--warning` /
`--danger` / `--primary` value ink), `crm-avatar`, `crm-cell-sub`, `crm-page-head`,
`crm-filter-chip`. Primary button = `s7-btn s7-btn--primary crm-btn--primary` - Marco's ruling
2026-09-14: on the CRM screens the artboard wins, so S1's `crm.css` carries the `crm-btn--primary`
override (`--brand-primary` fill, `--text-inverse` ink, `--brand-primary-dark` hover) and the
kit's orange stays untouched everywhere else; teal is also for tabs / links / active states and
**filled toggles**. The artboard's orange dots and amber foot strip are annotations, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `TendersRegisterPage.tsx`: `CRM_FOLLOWUPS_V2` (~15-18), the five status Sets (~117),
  `KpiCard` (~505), entity-type toggles default OFF (~537), the KPI block (~736, rendered ~934-
  950 on `s7-card-grid--kpi`), `Type:` row (~955-960), `Show:` row (~994-997), Follow-ups
  column set (~881), `Value at risk` (~17), `Won & lost` (~18), `Due this week` (~16).
- Today vs artboard (Marco's screenshot 2026-09-14): order = KPI cards → `Type:` row → `Show:`
  row → the register's labelled filter form → table. Toggles are outlined pills, amber outline
  when on. Cards have no left stripe, black values. Column `Tender`; Type chip `Won / lost`
  outlined. Artboard: order = title (`Tenders`, *Same list as the register, filtered to what is
  waiting on you.*), `Export CSV` / `Save this view`, tabs → **one `SHOW` row** holding all
  eight toggles (next-action four first, each with a status dot: red Overdue, amber Due soon,
  grey No next action, green On track; then Submitted tenders · Opportunities · Leads · Won &
  lost; then `Mine only` at the end) - a toggle that is on is **filled** `--brand-primary` with
  white text, off is outlined → **KPI cards** with a 3px left stripe and matching value ink
  (Overdue `--status-danger`, Due this week `--status-warning`, Never logged `--status-neutral`,
  Value at risk `--brand-primary`) → table with `What` as the first column and a tinted Type
  chip (`--active` Tender, `--warning` Opportunity, `--neutral` Lead).

## What to build

- Marker `export const CRM_PARITY_FOLLOWUPS_V1 = "crmvis-s5"`.
- Follow-ups subtitle becomes the artboard's; the title-row buttons on this tab are `Export
  CSV` + `Save this view` (the columns picker stays available on Register).
- Merge the `Type:` and `Show:` rows into one `crm-toggle-row` labelled `SHOW`
  (`s7-type-label`) in the artboard's order; `crm-toggle` / `crm-toggle--on` in `crm.css`
  (30px pill, filled `--brand-primary` when on), `crm-dot--danger/--warning/--neutral/--active`
  for the four status dots. `Mine only` joins the row as a toggle. Same state, same handlers,
  same composition - only the markup and the order change.
- KPI cards: `crm-kpi crm-kpi--stripe-danger` etc. (left stripe + value ink), on the existing
  `s7-card-grid--kpi`.
- Follow-ups column set: first header reads `What`; Type as a tinted `s7-badge`.
- Hide the S4 chip filter row on the Follow-ups tab **only if** the artboard's toggles cover
  the same state; the search box stays. If a filter (Client, Due, Estimator) has no toggle
  equivalent, keep the chip row - dropping a working filter is not parity.
- Spec `crmvis-s5-followups.test.ts`: the toggle row renders the eight labels in the
  artboard's order plus `Mine only`; the KPI card for Overdue carries the danger stripe class;
  no 6-digit hex in the page.

## Do NOT

- Do NOT change a toggle's default, its filter semantics or any KPI figure.
- Do NOT touch the Register tab's rows (S4), the API, `ShellLayout.tsx`, `tokens.css` or `/sot/`.
- Do NOT remove `Mine only` or the search box.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_FOLLOWUPS_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx
grep -q "Save this view" apps/web/src/pages/crm/TendersRegisterPage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/TendersRegisterPage.tsx
```

Open the PR titled `feat(crm): S5 - Follow-ups on the s7 kit, one SHOW row, striped KPI cards (CRM_PARITY_FOLLOWUPS_V1)`
and leave it UNMERGED.
