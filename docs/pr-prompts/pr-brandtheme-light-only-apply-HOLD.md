---
premise: '! grep -rq "BRAND_LIGHT_ONLY_V1" apps/web/src'
premise_means: >-
  Marco ruled on 2026-09-25 (D-1) that a company palette applies in LIGHT mode only, and dark keeps
  tokens.css. Nothing enforces that today. MEASURED 2026-10-02 at origin/main 7d9926ae:
  applyBrandScheme (apps/web/src/lib/brand-scheme.ts:104) writes every palette colour as an INLINE
  custom property on document.documentElement. An inline property beats every stylesheet rule,
  including tokens.css's two dark blocks (:root[data-theme="dark"] and the prefers-color-scheme:dark
  block), which redefine the same --surface-*, --text-* and --status-neutral properties.
  Harmless today, because the only active scheme ever used is Default, with two colours. The moment
  an admin activates Harbour or Graphite (S7a, PR #2193), or a user picks one (S7c), dark mode
  renders light surfaces for everyone. Neither S7a's nor S7c's scope includes brand-scheme.ts.
  POSITIVE CONTROL: grep -n "root.style.setProperty" apps/web/src/lib/brand-scheme.ts returns hits.
done_when: >-
  pnpm build && pnpm lint && pnpm --filter web test &&
  grep -q "BRAND_LIGHT_ONLY_V1" apps/web/src/lib/brand-scheme.ts &&
  ! grep -q "root.style.setProperty" apps/web/src/lib/brand-scheme.ts
scope:
  - apps/web/src/lib/brand-scheme.ts
  - apps/web/src/lib/__tests__/brand-scheme-light-only.test.ts
size: 2
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Web only. Reverting restores inline properties. No stored data changes; the palette rows and
  localStorage keys are read exactly as today.
escalates: false
module: branding
---

# Brand palette applies in light mode only, as ruled, and dark mode stays intact

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Why

This enforces Marco's D-1 ruling of 2026-09-25 in the one place every palette passes through. It
must land **before** S7a (the admin builder, #2193) or S7c (personal schemes) can activate a full
palette. Otherwise dark mode breaks for every user.

## What to build: `apps/web/src/lib/brand-scheme.ts`

Marker: `export const BRAND_LIGHT_ONLY_V1 = "brandtheme-light-only";`

- `applyBrandScheme` stops writing inline properties on `document.documentElement`.
- Instead it writes **one `<style id="brand-scheme">` element** in `<head>`, with the scheme's
  properties scoped to light mode only. Concretely:
  - `:root[data-theme="light"] { … }` covers an explicit light choice.
  - `@media (prefers-color-scheme: light) { :root:not([data-theme]) { … } }` covers "system" when the
    OS is light.
  - **No rule may match `[data-theme="dark"]`, or system-dark.**
- `clearBrandScheme` removes that element, and with it every scheme colour.
- Toggling light/dark (ThemeToggle, or an OS change while on "system") needs **no re-apply and no
  reload**. The cascade does it.
- Precedence is unchanged: per-user override, then company scheme, then tokens.css. The override and
  the company scheme use the same function, so both become light-only.
- Keep `isValidHex` per property. An invalid value skips that property only, as today. Values are
  validated hex before they go into the stylesheet text, so nothing else can be injected.
- Remove every `root.style.setProperty` / `removeProperty` for the managed properties.
  Density (`data-density`) and theme (`data-theme`) are separate attributes. Leave them alone.

## Tests: `__tests__/brand-scheme-light-only.test.ts`

1. After `applyBrandScheme(HARBOUR-like full palette)`:
   - `document.documentElement.style` has **no** managed custom property.
   - A `style#brand-scheme` exists.
2. The generated CSS text:
   - contains a `[data-theme="light"]` rule and a `prefers-color-scheme: light` block, each carrying
     every valid property;
   - contains **no** `data-theme="dark"` selector and **no** `prefers-color-scheme: dark` block.
3. `clearBrandScheme` removes the element.
4. An invalid hex in one field omits only that property from the CSS.
5. `clearUserBrandOverride` re-applies the cached company scheme into the same element. There is no
   reload, and the element is replaced, not duplicated.
6. The existing brand-scheme tests stay green. Where one asserted an inline property, update it to
   assert the stylesheet instead, and say so in the PR.
7. Tests 1, 2 and 5 **fail on `origin/main`**. Prove it once by reverting.

## DO NOT

- Do not change `tokens.css`, the API, the seeded presets, or the `/branding/active` payload.
- Do not touch `sot/` (CP-24).
- No new `#RRGGBB` literals in source. Values come from data.

## Screenshots

Harbour applied: light mode, then dark mode via ThemeToggle with no reload. Dark must look exactly
like today's dark theme.
