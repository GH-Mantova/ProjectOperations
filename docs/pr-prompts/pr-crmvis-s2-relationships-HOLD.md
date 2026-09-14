---
premise: '! grep -q "CRM_PARITY_RELATIONSHIPS_V1" apps/web/src/pages/crm/RelationshipsPage.tsx'
premise_means: Relationships has the mock-up's four panels but not its look - a 1040px column floating in the middle of the page under a detached tab card, plain-text panel headings, an indigo "Add note" where the artboard says "Save note", helper text above the form instead of beside the button, no bars and no day chips.
scope:
  - apps/web/src/pages/crm/RelationshipsPage.tsx
  - apps/web/src/pages/crm/crm.css
  - apps/web/src/pages/crm/__tests__/crmvis-s2-relationships.test.ts
done_when: pnpm build && pnpm lint && pnpm --filter @project-ops/web test && grep -q "CRM_PARITY_RELATIONSHIPS_V1" apps/web/src/pages/crm/RelationshipsPage.tsx && ! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/RelationshipsPage.tsx && ! grep -qE '#[0-9a-fA-F]{3,6}\b' apps/web/src/pages/crm/crm.css
size: 3
gate_allow: none
seed_only: false
escalates: true
module: crm
cluster: crmvis
cluster_order: 3
requires_on_main: 'apps/web/src/pages/crm/AccountsListPage.tsx :: CRM_PARITY_ACCOUNTS_V1'
design_ref: https://claude.ai/code/artifact/3372e3ff-b041-47cd-a47e-d5897f06a62c
---

# CRM visual parity S2 - Accounts · Relationships looks like artboard "Accounts · Relationships"

**Slice 3 of 9** of `crmvis`. Presentation only. Artboard `Relationships.dc.html` in
`Claude Design/proposed/crm-visual-parity/` is the standard; acceptance is the side-by-side PNG
for screen `relationships`.

**Gate:** S1 on main - it created `CrmTabs.tsx` and `crm.css`, and made `AccountsPage.tsx` pass
`tabs` + `activeTab` into this page. Reuse both; do not build a second tab strip.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** — the work is discarded either way.

Scope discipline still applies: do not widen beyond the three files in `scope`.

## Guardrails

- One attempt. If `CRM_PARITY_RELATIONSHIPS_V1` is already on main, say `NO-OP: <reason>`.
- Never ask a question or "stand by" for approval. There is no human in a headless run.
- `escalates: true` - a used screen is rebuilt; Marco judges the side-by-side.
- `crm-relationships-panels.test.ts` asserts on this page's pure builders
  (`buildCreateNoteBody`, `formatColdDuration`, `buildGoingColdCard`, `buildRepeatBusinessBars`,
  `GOING_COLD_THRESHOLD_OPTIONS`) and on the four-panel layout contract - keep every export and
  the 2x2 grid; it must stay green untouched.
- **PR body declares** `Visual acceptance: scripts/pipeline/screens/crm.json → relationships
  (artboard Relationships)`. Empty panels in the seed data are not a FAIL.

## House rules (from S1 - the cluster's standard)

Tokens, not hex - `tokens.css` is the artboard palette (`--brand-primary #005B61`,
`--brand-accent`, `--surface-*`, `--text-*`, `--border-*`, `--status-*`, `--radius-*`,
`--shadow-card`). Kit first (`s7-type-page-title`, `s7-type-label` for uppercase headings,
`s7-card`, `s7-badge` tones, `s7-btn` variants, `s7-input` / `s7-select` / `s7-textarea`). Shapes
the kit lacks go in `crm.css` as `crm-*` classes with `var(--…)` colours only. Primary button =
`s7-btn s7-btn--primary crm-btn--primary` - Marco's ruling 2026-09-14: on the CRM screens the
artboard wins, so S1's `crm.css` carries the `crm-btn--primary` override (`--brand-primary` fill,
`--text-inverse` ink, `--brand-primary-dark` hover) and the kit's orange stays untouched
everywhere else; teal is also for tabs / links / active states. The artboard's orange dots and
amber foot strip are annotations, not UI.

## Grounded on main (read first; cite line numbers in the PR body)

- `RelationshipsPage.tsx` (845 lines): `CRM_RELATIONSHIPS_V2` (~1, ~20-28 the 2x2 contract),
  `LogContactPanel` (~426, heading ~508, submit label `"Add note"` ~573), `RecentNotesPanel`
  (~582), `GoingColdPanel` (~624, threshold select, empty state ~687), `RepeatBusinessPanel`
  (~711; the bar fill is "the ONE colour value" ~208), layout styles `x` (~216), page ~764.
  16 hex literals, 1 `var(--` read, 2 inline `style` props - the lightest of the eight pages.
- Today vs artboard (Marco's screenshot 2026-09-14): tab card above the page; content boxed to
  ~1040px and centred; headings sentence-case 15px; helper line *Logging a contact advances Last
  contact on the account.* sits **above** the form (artboard: below the textarea, left of the
  button); button reads `Add note` (artboard: **`Save note`**); the Note field has no label
  (artboard: `Note`); Going cold rows carry no amber day chip; Repeat business has no bars.

## What to build

- Marker `export const CRM_PARITY_RELATIONSHIPS_V1 = "crmvis-s2"`; `import "./crm.css"`.
- Accept the `tabs` / `activeTab` props S1's `AccountsPage.tsx` passes and render
  `crm-page-head` (`Accounts`, subtitle *Who we've spoken to, who's drifting, and who keeps
  coming back.*) then `CrmTabs` - full width, no centring column.
- The 2x2 grid stays (`crm-relationships-grid`: two columns 1fr 1fr, 16px gap - add to
  `crm.css`). Each panel is an `s7-card` with an uppercase `s7-type-label` heading.
- **Log a contact:** `Account *` and `Contact optional` selects side by side (`s7-select`),
  label `Note` over an `s7-textarea`, then a footer row: helper text left (muted, *Last
  contact* in 600), **`Save note`** `s7-btn--primary` right. Rename the label only - the
  handler, the body builder and the disabled/`Saving…` states are unchanged.
- **Recent notes:** each row `crm-avatar` initials + `<Account> · <Contact> · <age>` (account
  600, rest muted) + the note line. Count chip in the heading stays.
- **Going cold:** heading row with the threshold `s7-select` right; rows = name (600) +
  `crm-cell-sub` (*18% win rate · 3 tenders*) + amber duration chip (`s7-badge--warning`,
  `formatColdDuration`) right.
- **Repeat business:** rows = name (600), `crm-bar` track (`--border-subtle`) with fill
  (`--brand-primary`) sized by `buildRepeatBusinessBars`, `N won` muted right. Add `crm-bar`
  to `crm.css`; the "ONE colour" comment at ~208 now points at the token.
- Empty states (`No accounts going cold right now.` etc.) keep their text, muted, centred.
- Spec `crmvis-s2-relationships.test.ts`: the submit label is `Save note`; the file has no
  6-digit hex; the four builders still return what `crm-relationships-panels.test.ts` expects
  for one fixture each (regression pin).

## Do NOT

- Do NOT touch `AccountsListPage.tsx`, `AccountsPage.tsx`, `CrmTabs.tsx` (S1 owns them), the
  API or `/sot/`.
- Do NOT edit `tokens.css`; do NOT change what any panel fetches or posts.
- Do NOT centre or cap the page width - the artboard fills the content area.

## VERIFY

```
pnpm build && pnpm lint && pnpm --filter @project-ops/web test
grep -q "CRM_PARITY_RELATIONSHIPS_V1" apps/web/src/pages/crm/RelationshipsPage.tsx
grep -q "Save note" apps/web/src/pages/crm/RelationshipsPage.tsx
! grep -qE '#[0-9a-fA-F]{6}\b' apps/web/src/pages/crm/RelationshipsPage.tsx
```

Open the PR titled `feat(crm): S2 - Relationships on the s7 kit, full width, Save note (CRM_PARITY_RELATIONSHIPS_V1)`
and leave it UNMERGED.
