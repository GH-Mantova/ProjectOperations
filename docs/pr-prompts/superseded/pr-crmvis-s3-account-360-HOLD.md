---
premise: '! grep -q "CRM_PARITY_ACCOUNT360_V1" apps/web/src/pages/crm/AccountDetailPage.tsx'
premise_means: Account 360 has the mock-up's header actions, KPI row and Next-action card but stacks them in the wrong order and colours - an Account card and a Client identity card above the activity, the Activity tabs as indigo pills three cards down, a bare "← Back" link instead of the breadcrumb, an Archive button the artboard keeps behind Edit - so the merged feed the screen exists for is the last thing on it.
scope:
  - apps/web/src/pages/crm/AccountDetailPage.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s3-account-360.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_ACCOUNT360_V1" apps/web/src/pages/crm/AccountDetailPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AccountDetailPage.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 5
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 4
requires_on_main: 'apps/web/src/pages/crm/RelationshipsPage.tsx :: CRM_PARITY_RELATIONSHIPS_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S3 - Account 360 looks like artboard "Account 360"

**Slice 4 of 9** of `crmvis`. Presentation only. Artboard `Account360.dc.html` in
`Claude Design/proposed/crm-visual-parity/` is the standard; acceptance is the side-by-side PNG
for screen `account-360` (the review opens the first account in the list).

**Gate:** S2 on main (chain order only - this page shares nothing with Relationships).

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_ACCOUNT360_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen is rebuilt; Marco judges the side-by-side.
- `crmui-account360-s1.test.ts` and `crm-s5-account-verbs.test.ts` pin the pure helpers
  (`ACCOUNT360_ROLLUP_CAPS`, `formatCappedCount`, `deriveLastContactAt`, `formatRelativeAge`,
  `pickNextAction`, `initialsFor`) and the archive / unarchive verbs - every export, every
  handler and every fetch stays; the suites stay green untouched.
- **Nothing is removed from the screen.** Every field shown today is still shown after -
  moved, not dropped. The artboard is a layout, not a permission to lose data.
- **PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → account-360
  (artboard Account360)`. A thin seed account (no notes, no contracts) is not a FAIL.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette. Kit first (`s7-type-page-title`,
`s7-type-label`, `s7-card`, `s7-badge` tones, `s7-btn` variants, `s7-select`,
`s7-card-grid--kpi`). Shapes the kit lacks go in `crm.css` as `crm-*` classes with `var(--…)`
colours only; S1 and S2 already provide `crm-tabs`/`crm-tab`, `crm-kpi`, `crm-avatar`,
`crm-cell-sub`, `crm-page-head`. Primary button = `s7-btn s7-btn--primary crm-btn--primary` -
Marco's ruling 2026-09-14: on the CRM screens the artboard wins, so S1's `crm.css` carries the
`crm-btn--primary` override (`--brand-primary` fill, `--text-inverse` ink, `--brand-primary-dark`
hover) and the kit's orange stays untouched everywhere else; teal is also for tabs / links /
active states. The artboard's orange dots and amber foot strip are annotations, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `AccountDetailPage.tsx` (1439 lines): `CRM_ACCOUNT360_V2` helpers (~149-238), styles `s`
  (`backBtn` ~291, main column + 320px rail ~322, `archivedBanner` ~349), tones derived from
  those styles (~360-381 - `A360_ACCENT = s.backBtn.color` is where the indigo comes from),
  `KpiTile` (~392), `NextActionCard` (~415), page ~461, header actions `Log contact` /
  `New thread` / `Edit account` (~647-664), `Archive` verb (~9-12 imports). 66 hex literals, 0
  `var(--` reads, 80 inline `style` props. The "Email capture is pending M365 provisioning"
  notice and the `Client identity` card (legal name, outcomes, wins, win rate, last tender)
  are content the artboard does not draw as separate cards.
- Today vs artboard (Marco's screenshot 2026-09-14): `← Back` link + avatar + name + solid
  indigo lifecycle pill, sub-line `Client`; five KPI tiles (no `Value`); then **Account card**
  (Type / Source / Owner / Created, an outlined `Archive` button) and **Client identity card**
  stacked in the main column with the Next action card alone in the rail; Activity tabs as
  indigo pills in a third card at the bottom. Artboard: header, six KPI tiles, then **left**
  = the tabbed Activity card with the merged feed, **right** = `ACCOUNT` facts card
  (Lifecycle / Type / Owner as inline selects, Source, Linked client ›) above `NEXT ACTION`.

## What to build

- Marker `export const CRM_PARITY_ACCOUNT360_V1 = "crmvis-s3"`; `import "./crm.css"`.
- **Header** (`crm-page-head` variant): 44px `crm-avatar--lg` initials, name as
  `s7-type-page-title`, lifecycle `s7-badge` (`--active` Active, `--warning` Prospect,
  `--neutral` Past) then *Type · ABN* muted on the second line. Right: `Log contact`
  (`s7-btn--secondary`), `New thread` (`s7-btn--secondary`), `Edit account` (`s7-btn--primary`).
  Drop the `← Back` button - the shell breadcrumb (`Project Ops / Accounts / <name>`) is the way
  back; keep any `navigate(-1)` handler only if something else calls it.
- **KPI row**: `s7-card-grid--kpi` variant with six columns (`crm-kpi-grid--6` in `crm.css`)
  when a `Value` figure exists, else the five tiles today. **Do not invent `Value`** - if no
  summed tender value reaches this page today, render five and say so in the PR body
  (residual content gap, not this slice's).
- **Main column** = one `s7-card`: `CrmTabs`-styled tab strip (Activity · Contacts n ·
  Tenders n · Jobs n · Contracts n · Opportunities n - `formatCappedCount` as today), heading
  `NOTES, THREADS AND EMAILS, MERGED` (`s7-type-label`), then the feed rows: `crm-avatar` or a
  kind icon, first line `<who> logged a call with <contact> · <age>` / `Thread — <subject> ·
  <age> · n messages` / `Email from … · <age>`, second line the body. The M365 notice becomes
  the muted `crm-note` strip under the feed (*Email entries appear once M365 capture is
  switched on. Everything else is live today.* - keep the shipped wording if the suite pins it).
- **Rail (320px)**: `ACCOUNT` card - Lifecycle / Type / Owner as `s7-select` (they already
  patch the account from the Edit flow; if inline editing does not exist today, render them as
  read-only values in the same slots and say so - no new PATCH in this slice), Source, Linked
  client as a link with `›`, then **the Client identity facts** (Legal name, outcomes, wins, last
  tender) as a second labelled group inside the same card, and the `Archive` verb as a
  `s7-btn--ghost` at the card foot with the archived banner unchanged. `NEXT ACTION` card
  below it, due chip `s7-badge--warning` / `--danger`, assignee muted.
- Delete the `A360_*` tone derivation and every hex; `archivedBanner` uses `--status-warning`.
- Spec `crmvis-s3-account-360.test.ts`: no 6-digit hex in the file; `pickNextAction` and
  `formatRelativeAge` regression pins; the rendered header contains the three action labels.

## Do NOT

- Do NOT drop a field, verb or notice - relocate it. Do NOT add a fetch or a PATCH.
- Do NOT touch the API, `App.tsx`, `tokens.css` or `/sot/`.
- Do NOT restyle the `Log contact` / `New thread` modals beyond `s7-*` inputs and buttons.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_ACCOUNT360_V1" apps/web/src/pages/crm/AccountDetailPage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/AccountDetailPage.tsx
```

Open the PR titled `feat(crm): S3 - Account 360 on the s7 kit, feed left, facts rail right (CRM_PARITY_ACCOUNT360_V1)`
and leave it UNMERGED.
