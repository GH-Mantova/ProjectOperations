---
premise: '! grep -q "CRM_PARITY_REGISTER_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx'
premise_means: The tenders register has the mock-up's columns but wears a labelled filter form, a detached tab card, a page title the artboard renamed, status as plain text, a bare tender code link over a second title line, and a Next action column that can only say a dash where the artboard says "None set" and "Stalled".
scope:
  - apps/web/src/pages/crm/TendersRegisterPage.tsx
  - apps/web/src/pages/crm/TendersPage.tsx
  - apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s4-register.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_REGISTER_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx && grep -q "None set" apps/web/src/pages/crm/TendersRegisterPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/TendersRegisterPage.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 5
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 5
requires_on_main: 'apps/web/src/pages/crm/AccountDetailPage.tsx :: CRM_PARITY_ACCOUNT360_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S4 - Tenders · Register looks like artboard "Tenders · Register"

**Slice 5 of 9** of `crmvis`. Presentation, plus one display rule the artboard draws and the
page cannot: *None set* / *Stalled* in the Next action column. Artboard `Register.dc.html` in
`Claude Design/proposed/crm-visual-parity/` is the standard; acceptance is the side-by-side PNG
for screen `register`. The Follow-ups tab of the same page is S5 - this slice touches only what
both tabs share (shell, title row, filter row, table cells).

**Gate:** S3 on main (chain order only).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the five files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_REGISTER_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen is rebuilt; Marco judges the side-by-side.
- Suites that pin this page: `crmui-register-s1/s2.test.ts`, `crm-s8-register-helpers.test.ts`,
  `tenders-register-interaction.test.ts`, and `ShellLayout.crm-chrome.test.ts` (the Tenders
  badge reuses this page's overdue classification via `tendersRegisterPage.helpers.ts`). Every
  helper export keeps its name and behaviour; the suites stay green untouched.
- **Filters are restyled, not added.** The artboard draws `Status · Client · Owner · Logged by ·
  Value · Due` chips; the page filters by Search, Status, Client, Due from/to, Estimator ID and
  Mine only. Restyle **those**; a chip for a filter the API does not take is a lie - say in the
  PR body which artboard chips are not built (residual, needs its own slice).
- **PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → register
  (artboard Register)`.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette. Kit first (`s7-type-page-title`,
`s7-type-label`, `s7-card`, `s7-badge` tones, `s7-btn` variants, `s7-input` / `s7-select`,
`s7-table`). Shapes the kit lacks go in `crm.css` as `crm-*` classes with `var(--…)` colours only;
S1-S3 provide `crm-tabs`, `crm-kpi`, `crm-avatar`, `crm-cell-sub`, `crm-page-head`,
`crm-filter-chip`. Primary button = `s7-btn s7-btn--primary crm-btn--primary` - Marco's ruling
2026-09-14: on the CRM screens the artboard wins, so S1's `crm.css` carries the `crm-btn--primary`
override (`--brand-primary` fill, `--text-inverse` ink, `--brand-primary-dark` hover) and the
kit's orange stays untouched everywhere else; teal is also for tabs / links / active states. The
artboard's orange dots and amber foot strip are annotations, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `TendersPage.tsx` (150 lines) is the `?tab=` shell (~3-4) with its own tab card
  (`tabBarStyle`, `role="tablist"` ~128-134) above `<TendersRegisterPage activeTab=…/>` (~147).
- `TendersRegisterPage.tsx` (1528 lines): `CRM_REGISTER_V3` (~7), `CRM_FOLLOWUPS_V2` (~15),
  saved views (~152-172 - `Save view` exists on both tabs), columns picker (~174-200, button
  ~1176), `LogModal` (~209), cell styles (~399), page title `Tenders register` already on
  `s7-type-page-title` (~919 - one of only 5 `s7-*` uses), filter form `Search / Status /
  Client / Due from / Due to / Estimator ID / Mine only` (~1103-1145), `Export CSV` (~1174),
  `Never logged` (~16). 50 hex literals, 19 `var(--` reads, 44 inline `style` props. The
  strings `None set`, `Stalled` and `Owner` do not appear in the file.
- `tendersRegisterPage.helpers.ts` holds the overdue classification the sidebar badge shares
  (`ShellLayout.tsx` ~521-531 comment).
- Today vs artboard (Marco's screenshot 2026-09-14): title `Tenders register` + *All tenders
  across all statuses.*; tab card above; a labelled six-field form with native date inputs;
  `535 shown · Export CSV · Columns · Save view` on a second row; Tender cell = underlined
  code link, a second `T1645 — title` line, `Submitted 2 Nov`; Status as text; Next action `—`.
  Artboard: title **`Tenders`** + *Every tender and opportunity, and what we owe each one
  next.*, `Export CSV` / `Columns ▾` in the title row, tabs, then **one row**: search box +
  filter chips; Tender cell = `T-2418 · Northshore demolition` (600) over `Submitted 12 Aug`
  (`crm-cell-sub`); Status `s7-badge` (`--info` Submitted, `--active` Won, `--warning`
  Qualified, `--neutral` Lost); Last interaction = `Phone — 4 days ago` over the note; Logged
  by = `crm-avatar` + name; Next action = text over a due chip, or *None set* + `Stalled`.

## What to build

1. **`TendersPage.tsx`** stops rendering the tab card; passes `tabs` + `activeTab` into
   `TendersRegisterPage` (same shape S1 gave `AccountsPage.tsx`). `?tab=` parsing unchanged.
2. **`TendersRegisterPage.tsx`** - marker `export const CRM_PARITY_REGISTER_V1 = "crmvis-s4"`;
   `import "./crm.css"`.
   - `crm-page-head`: title **`Tenders`**, subtitle per tab (Register: the artboard's; Follow-ups
     keeps *Tenders requiring follow-up action.* until S5), right: `Export CSV` and `Columns ▾`
     (`s7-btn--secondary`), and the existing `Save view` renamed **`Save this view`** (the
     artboard draws it on Follow-ups only; keeping it on Register is not a FAIL - say so).
   - `CrmTabs` (Register n · Follow-ups n with the amber badge).
   - **Filter row** (one line, wraps): `s7-input` search, then `crm-filter-chip` controls for
     Status, Client, Due (one chip opening the from/to pair), Estimator (the ID field, labelled
     `Owner` only if it filters by owner - read the query it sends), and `Mine only` as a
     toggle chip. `N shown` muted at the row's end.
   - **Table** on `s7-table`, headers `s7-type-label`, cells as the artboard block above; `Log`
     as `s7-btn--secondary s7-btn--sm`; row height from the kit's density tokens, not a literal.
   - **Next action display rule** (the one non-cosmetic item): when a row has no open task,
     render *None set* (muted italic) and, when it also has no interaction in the last
     `STALLED_AFTER_DAYS = 30` days or was never logged, a `Stalled` `s7-badge--neutral`
     beneath. Put `isStalled(row, nowMs)` and the constant in `tendersRegisterPage.helpers.ts`
     (pure, exported). This changes no filter, count or badge.
   - Delete the cell-style hex; the `LogModal` moves onto `s7-*` inputs and buttons.
3. **Spec** `crmvis-s4-register.test.ts`: `isStalled` - never logged -> true; logged 31 days ago,
   no task -> true; logged 3 days ago, no task -> false; open task -> false. No 6-digit hex in
   the page. The overdue classification helper still returns the S2 results (pin).

## Do NOT

- Do NOT add a filter the API does not take; do NOT change any query string the page sends.
- Do NOT touch the Follow-ups KPI cards or toggle rows (S5), the API, `ShellLayout.tsx`,
  `tokens.css` or `/sot/`.
- Do NOT change the overdue classification the sidebar badge shares.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_REGISTER_V1" apps/web/src/pages/crm/TendersRegisterPage.tsx
grep -q "None set" apps/web/src/pages/crm/TendersRegisterPage.tsx
grep -q "isStalled" apps/web/src/pages/crm/tendersRegisterPage.helpers.ts
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/TendersRegisterPage.tsx
```

Open the PR titled `feat(crm): S4 - Tenders register on the s7 kit, chip filters, None set / Stalled (CRM_PARITY_REGISTER_V1)`
and leave it UNMERGED.
