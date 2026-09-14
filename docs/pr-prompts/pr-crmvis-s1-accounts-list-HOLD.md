---
premise: '! grep -q "CRM_PARITY_ACCOUNTS_V1" apps/web/src/pages/crm/AccountsListPage.tsx'
premise_means: The Accounts list carries every element of the approved mock-up in the wrong clothes - indigo buttons and solid indigo lifecycle pills from hard-coded hex, a tab card floating above the page title, four narrow tiles adrift on the left, no ABN under the account name - so a screen that is content-complete still looks nothing like the artboard it cites.
scope:
  - apps/web/src/pages/crm/AccountsListPage.tsx
  - apps/web/src/pages/crm/AccountsPage.tsx
  - apps/web/src/pages/crm/CrmTabs.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s1-accounts-list.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_ACCOUNTS_V1" apps/web/src/pages/crm/AccountsListPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AccountsListPage.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 5
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 2
requires_on_main: 'scripts/pipeline/visual-smoke.mjs :: entry.actions'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S1 - Accounts · List looks like artboard "Accounts · List"

**Slice 2 of 9** of `crmvis`. Presentation only: no fetch, no route, no DTO, no behaviour
changes. The artboard `Main.dc.html` in `Claude Design/proposed/crm-visual-parity/` (rendered by
`render-artboards.mjs`, S0) is the standard; the acceptance is the side-by-side PNG the vision
review composes for screen `accounts-list`. This slice also lays down the two shared pieces the
next seven reuse: `CrmTabs.tsx` and `crm.css`.

**Gate:** S0 on main (`entry.actions` in `visual-smoke.mjs`) so the review can capture this screen.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the five files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_ACCOUNTS_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - it rewrites how a used screen is built; Marco judges the side-by-side.
- Every existing suite stays green untouched: `crmui-accounts-list-s1/s2.test.ts`,
  `AccountsListPage.test.ts`, `crm-uifix-s1.test.ts` (one tab bar), `ShellLayout.crm-chrome.test.ts`.
  They import pure helpers (`computeContactState`, `buildGoingColdTile`, `CRM_COLD_V3`) - keep
  every export and its behaviour.
- **The PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → accounts-list
  (artboard Main)`. The review captures, composes `accounts-list.compare.png`, and a visual FAIL
  is a smoke FAIL. The seed data will show few or empty rows - that is not a FAIL; structure,
  hierarchy and colour are what is judged.

## House rules (apply to every crmvis screen slice)

1. **Tokens, not hex.** `apps/web/src/styles/tokens.css` already *is* the artboard palette:
   `--brand-primary #005B61`, `--brand-primary-light`, `--brand-accent #FEAA6D`, `--surface-page
   #F6F6F6`, `--surface-card`, `--text-primary/secondary/muted`, `--border-default/subtle`,
   `--status-active/warning/danger/info/neutral`, `--radius-md/lg`, `--shadow-card` (~2-34), with
   dark-theme overrides (~45-99). The indigo the screen wears today is `#6366f1` / `#4f46e5`
   typed into inline style objects - 83 hex literals on this page alone, 5 `var(--` reads.
   `done_when` asserts zero 6-digit hex in the page and none at all in `crm.css`.
2. **Kit first.** `s7-type-page-title` (~116), `s7-type-label` (~141, uppercase 12px - the
   artboard's tile labels, column headers and card headings), `s7-card` (~150), `s7-badge` +
   tones (~159-193: tinted background, matching ink - exactly the artboard's chips),
   `s7-table` (~195-238), `s7-btn` + `--primary/--secondary/--ghost/--sm` (~240-303), `s7-input`
   / `s7-select` (~305-333), `s7-card-grid--kpi` (~389, four equal columns).
3. **`crm.css` for the shapes the kit lacks** - imported by the page, classes prefixed `crm-`,
   every colour a `var(--…)`: `crm-tabs` / `crm-tab` / `crm-tab--on` (13.5px, 2px underline in
   `--brand-primary`, count in `--text-muted`), `crm-kpi` (label = `s7-type-label`, value 24px
   600, optional `crm-kpi--warning` / `--danger` / `--primary` value ink, sub-line 12px muted),
   `crm-avatar` (28px circle, `--brand-primary-light` fill, `--brand-primary` initials 11px 700),
   `crm-cell-sub` (12px `--text-muted` line under a cell's main text), `crm-filter-chip`
   (a `s7-btn s7-btn--secondary s7-btn--sm` with a trailing `▾`), `crm-page-head` (title +
   subtitle left, actions right, 24px gap below), `crm-alert--warning` (the amber banner:
   `--status-warning` at 10% fill, 1px border, `--radius-lg`).
4. **Primary button = `s7-btn s7-btn--primary crm-btn--primary`.** Marco's ruling 2026-09-14: the
   kit's `s7-btn--primary` is orange (`--brand-accent`, ~273) but on the CRM screens **the artboard
   wins** - this slice adds `crm-btn--primary` to `crm.css` (`--brand-primary` fill, `--text-inverse`
   ink, `--brand-primary-dark` hover, same height/radius as the kit) and every later slice reuses
   it. `tokens.css` and the kit's orange stay untouched everywhere else. Teal (`--brand-primary`) is
   also for tabs, links, active states and filled toggles.
5. **Ignore the artboard's annotations** - orange dots and the amber strip at the foot are the
   designer's notes, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `AccountsPage.tsx` (105 lines) is the `?tab=` shell: renders its own tab card (`tabBarStyle`,
  `role="tablist"` ~85-91) *above* the inner page, then `AccountsListPage` or `RelationshipsPage`
  unchanged (~3-6). The artboard puts **title → subtitle → tabs** inside the page, tabs under the
  title with the count on the active one (`List 214`).
- `AccountsListPage.tsx` (1085 lines): `CRM_ACCOUNTS_LIST_V2` (~1), `computeContactState` (~63),
  `buildGoingColdTile` (~93), `LIFECYCLE_LABEL` / `LIFECYCLE_COLOUR` (~345-357 - the solid indigo
  pill), `StatTile` (~378), `LogContactModal` (~412), `NewAccountModal` (~135), CSV export (~543),
  the unlinked banner with "Review and link →" (~765-806), search + `Lifecycle: All` /
  `Owner: All` selects (~817), the table (~541 header), row `Log contact` (~459).
  `AccountSummaryRow` already carries `abn` and `owner` (#1609).
- Today vs artboard (Marco's screenshot 2026-09-14): tab card above the title; no subtitle;
  four boxed tiles left-aligned with dead space right; search row outside the table card; solid
  indigo `Prospect` pills; account name as a bare underlined link with no ABN line; bold
  sentence-case column headers; indigo `+ New account`.

## What to build

1. **`CrmTabs.tsx`** - `CrmTabs({ tabs: {id,label,to,count?,badge?}[], activeId, ariaLabel })`
   rendering `nav.crm-tabs > Link.crm-tab[.crm-tab--on]` with `role="tablist"/"tab"`,
   `aria-selected`, count muted, `badge` as `s7-badge s7-badge--warning|danger`. Pure props.
2. **`AccountsPage.tsx`** stops rendering the tab card. It still parses `?tab=` and passes
   `tabs` + `activeTab` down to the inner page (both inner pages accept the props; Relationships
   renders them in S2 - until then it keeps rendering nothing extra, so the shell remains the one
   place the tab logic lives and `crm-uifix-s1.test.ts` stays true).
3. **`AccountsListPage.tsx`** - marker constant `export const CRM_PARITY_ACCOUNTS_V1 = "crmvis-s1"`;
   `import "./crm.css"`. Compose exactly the artboard, top to bottom:
   - `crm-page-head`: `Accounts` (`s7-type-page-title`), subtitle *Every organisation you
     tender to, subcontract under, or have worked for.* (`--text-secondary`), right: `Export`
     (`s7-btn--secondary`) and `+ New account` (`s7-btn--primary`).
   - `CrmTabs` (List with count · Relationships).
   - `s7-card-grid s7-card-grid--kpi` of four `s7-card crm-kpi`: Accounts · Open opportunities ·
     Going cold (value `crm-kpi--warning`, sub-line from `buildGoingColdTile`) · Unlinked clients
     (value `crm-kpi--danger`, *no account row yet*). Full width, equal columns.
   - The unlinked banner as `crm-alert--warning` with the `Review and link…` `s7-btn--secondary`
     on the right (only when unlinked > 0, as today).
   - One `s7-card` holding the search (`s7-input`, full width) with `Lifecycle: All ▾` and
     `Owner: All ▾` as `crm-filter-chip` selects on the right, then the `s7-table`: headers via
     `s7-type-label`; Account cell = name (600) + `crm-cell-sub` ABN; Lifecycle = `s7-badge`
     (`--active` Active, `--warning` Prospect, `--neutral` Past); Owner (`Unassigned` muted);
     Open opps; Win rate; Last contact with the `GOING COLD` `s7-badge--warning` and the
     `Never contacted` `s7-badge--neutral` states exactly where they render today; `Log contact`
     as `s7-btn--secondary s7-btn--sm` right-aligned.
   - Delete `LIFECYCLE_COLOUR`, `StatTile`'s inline palette and every other hex; the two modals
     move onto `s7-input` / `s7-select` / `s7-btn` too (they are in the file; `done_when` counts).
4. **Spec** `crmvis-s1-accounts-list.test.ts`: (a) `CrmTabs` marks exactly one tab
   `aria-selected`; (b) the page source contains no 6-digit hex (read the file, regex) and
   references `crm.css`; (c) `buildGoingColdTile` still returns the S2 strings (regression pin).

## Do NOT

- Do NOT change any fetch, query key, handler, export or route; do NOT touch `RelationshipsPage.tsx`
  (S2), the API or `/sot/`.
- Do NOT edit `tokens.css` - it is Marco's kit. Shapes the kit lacks go in `crm.css`.
- Do NOT reintroduce a colour as a literal anywhere in this page or in `crm.css`.
- Do NOT print `PROSPECT` / `ACTIVE` / `PAST` raw - `LIFECYCLE_LABEL` stays the source of the words.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_ACCOUNTS_V1" apps/web/src/pages/crm/AccountsListPage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AccountsListPage.tsx
! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
```

Open the PR titled `feat(crm): S1 - Accounts list on the s7 kit and tokens, tabs under the title (CRM_PARITY_ACCOUNTS_V1)`
and leave it UNMERGED.
