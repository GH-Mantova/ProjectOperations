---
premise: '! grep -q "s7-btn--danger" apps/web/src/styles/tokens.css'
premise_means: >-
  Five confirm dialogs render their destructive action with class s7-btn--danger, and no CSS rule for
  that class exists anywhere, so "Delete" shows as bare text beside a bordered "Cancel". MEASURED
  2026-10-02 at origin/main 7d9926ae: git grep 's7-btn--danger' -- '*.css' '*.scss' returns nothing.
  Usages: ConfirmDialog.tsx:111, allocation/RejectModal.tsx:58, dashboards/DashboardCanvas.tsx:428,
  dashboards/DashboardSwitcher.tsx:270, dashboards/DeleteDashboardModal.tsx:29.
  POSITIVE CONTROL: git grep -l 's7-btn' -- '*.css' returns tokens.css, where .s7-btn--primary,
  --secondary and --ghost are defined (tokens.css:273-302).
design_ref: Claude Design/proposed/qf-danger-button/danger-button-mockup.html
done_when: >-
  pnpm build && pnpm lint && pnpm --filter web test &&
  grep -q "s7-btn--danger" apps/web/src/styles/tokens.css &&
  node scripts/pipeline/check-hex-ratchet.mjs
scope:
  - apps/web/src/styles/tokens.css
  - apps/web/src/styles/__tests__/s7-button-variants.test.ts
size: 1
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  CSS only. Reverting removes the two rules and the test; no data, route or behaviour changes.
escalates: false
module: branding
---

# Style the danger button, and stop a button variant from ever shipping without a rule again

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to the mock-up at the `design_ref`. Use the **"Proposed"** panels, not the alternative.

## What to build

### `apps/web/src/styles/tokens.css`

Add, directly after `.s7-btn--ghost:hover`:

```css
/* Danger: the token mixed toward black so white text passes WCAG AA (~5.3:1).
   Text is the keyword white, not --text-inverse, which turns near-black in dark mode. */
.s7-btn--danger {
  background: color-mix(in srgb, var(--status-danger) 82%, black);
  border-color: color-mix(in srgb, var(--status-danger) 82%, black);
  color: white;
}
.s7-btn--danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--status-danger) 70%, black);
  border-color: color-mix(in srgb, var(--status-danger) 70%, black);
}
```

**Zero new `#RRGGBB` literals.** `check-hex-ratchet.mjs` counts `tokens.css` too. The existing
`.s7-btn:disabled` rule already covers the disabled state.

### `apps/web/src/styles/__tests__/s7-button-variants.test.ts`

This is the guard that makes the fix complete, not just this one instance:

- Read `tokens.css` as text and collect every `.s7-btn--<name>` selector it defines.
- Walk `apps/web/src/**/*.tsx`, excluding `__tests__`, and collect every `s7-btn--<name>` used in a
  `className`.
- **Fail with the list** of any variant used and never defined.
- Positive control in the same test: `primary` is both used and defined. Assert it, so an empty
  scan can't pass by accident.

## DO NOT

- Do not edit the five components. They already use the right class.
- Do not add a token, change `--status-danger`, or touch the danger badge.
- Do not touch `sot/` (CP-24).

## Screenshots required

ConfirmDialog with `variant="danger"`, in light and in dark, plus one small (`s7-btn--sm`) instance
from the dashboard switcher.
