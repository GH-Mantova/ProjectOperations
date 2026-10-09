---
premise: '! grep -rq "PERSONAL_THEME_PREFS_V1" apps/web/src'
premise_means: >-
  Density and a personal colour scheme are built and mounted nowhere. MEASURED 2026-10-02 at
  origin/main 7d9926ae:
  - DensityControl (apps/web/src/components/DensityControl.tsx) is referenced only by its own test.
  - setUserBrandOverride / clearUserBrandOverride (lib/brand-scheme.ts) have no caller outside that
    file.
  - My account (pages/account/UserProfilePage.tsx) has no Appearance section.
  This slice mounts both, persists them to the account through S7c-1's route, and keeps a shared
  site tablet clean at sign-out.
  POSITIVE CONTROL: grep -rn "export function DensityControl" apps/web/src returns a hit.
design_ref: Claude Design/proposed/s7c-personal-appearance/s7c-personal-appearance-mockup.html
requires_on_main: 'apps/api/src/modules/appearance-preferences/appearance-preferences.service.ts :: APPEARANCE_PREFERENCES_V1'
requires_file_on_main: apps/web/src/lib/__tests__/brand-scheme-light-only.test.ts
done_when: >-
  pnpm build && pnpm lint && pnpm --filter web test && node scripts/pipeline/check-hex-ratchet.mjs &&
  grep -q "PERSONAL_THEME_PREFS_V1" apps/web/src/pages/account/AppearanceSection.tsx &&
  grep -q "AppearanceSection" apps/web/src/pages/account/UserProfilePage.tsx
scope:
  - apps/web/src/pages/account/AppearanceSection.tsx
  - apps/web/src/pages/account/UserProfilePage.tsx
  - apps/web/src/lib/appearance-api.ts
  - apps/web/src/lib/brand-scheme.ts
  - apps/web/src/lib/density.ts
  - apps/web/src/pages/account/__tests__/appearance-section.test.tsx
  - apps/web/src/lib/__tests__/appearance-sign-in-out.test.ts
size: 5
gate_allow: none
backfill: false
seed_only: false
rollback_strategy: >-
  Web only. Reverting removes the card and the sign-in apply. Saved preference rows stay in the
  table, unused, and nothing breaks.
escalates: false
module: account
---

# Brand & theme S7c-2: the Appearance card on My account, saved to the account

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

Build to the mock-up at the `design_ref`, approved by Marco on 2026-10-02. Waits for S7c-1 (the
API) and for the light-only apply slice. Both gates are in the front matter.

## Marco's decisions — build to these

- **Saved to the account**, not the browser (2026-10-02).
- **Company schemes only**: the list comes from `GET /branding/schemes`, and there is no colour
  editing (2026-10-02).
- **Light mode only** for colour (2026-09-25). This is already enforced by `applyBrandScheme` after
  the light-only slice. Do not re-implement it.
- **Lives in Personal settings** (My account), not the admin Company page (2026-09-25).

## What to build

### `lib/appearance-api.ts`

`getMyAppearance()`, `saveMyAppearance({ density?, colourSchemeId? })` and `listSchemes()`. Each
throws with the API's message via `readApiErrorMessage`.

### `pages/account/AppearanceSection.tsx`

Marker: `export const PERSONAL_THEME_PREFS_V1 = "brandtheme-s7c-2";`

- **Density:** mount the existing `DensityControl` (do not rebuild it). A change applies immediately
  and saves to the account.
- **Colour scheme:**
  - Show one card for "Company theme", marked Default, carrying the company's current swatches.
  - Then show one card per scheme from `listSchemes()`, each with its name and four swatches
    (primary, accent, sidebar, page). Do not hard-code Harbour or Graphite.
  - Picking a scheme calls `setUserBrandOverride(palette)` and saves `colourSchemeId`.
  - Picking Company theme calls `clearUserBrandOverride()` and saves `null`.
  - Neither reloads the page.
- **"Return to the company theme"** appears only when a personal scheme is set.
- **On-screen copy, from the mock-up:**
  - "Colour schemes apply in light mode. Dark mode keeps the standard dark theme. A scheme changes
    colours only, not corner shape, type size or spacing."
  - "How ProjectOperations looks for you. Nobody else is affected."
- **Failure:** if the save fails, revert the visual change and show the API's message. The screen
  must never show a choice the account did not keep.

### `UserProfilePage.tsx`

Insert the section **first**, above Default dashboard. Leave everything else unchanged.

### Sign-in and sign-out: `lib/brand-scheme.ts`, `lib/density.ts`

- **Sign-in.** After `BrandSchemeProvider` fetches `/branding/active`, also fetch `getMyAppearance()`:
  - apply its density;
  - if `colourScheme` is non-null, call `setUserBrandOverride(colourScheme)`;
  - if the account has no scheme, clear any override left in the browser.
- **Sign-out.** The override is already removed on the `user === null` path. **Also** remove
  `projectops.density` and reset `data-density` on that path, so a shared site tablet never shows
  the last person's density.
- The account is the source of truth. localStorage stays a cache that prevents a flash of the wrong
  look on load.

## Tests

1. The section renders one card per scheme from the API response plus Company theme. A test fails
   if any scheme name is a literal in the component.
2. Picking a scheme calls `setUserBrandOverride` with that palette and PUTs `colourSchemeId`.
   Picking Company theme calls `clearUserBrandOverride` and PUTs `null`.
3. A density change calls `applyDensity` and PUTs `density`.
4. A failed PUT reverts the override or density and shows the error.
5. Sign-in:
   - With a saved scheme and compact density, the override is set and `data-density="compact"`.
   - With no row, no override is left from a previous browser session.
6. Sign-out removes both `projectops.brand-override` and `projectops.density`, and clears
   `data-density`.
7. "Return to the company theme" is absent when no personal scheme is set and present when one is.
8. Tests 2, 5 and 6 **fail on `origin/main`**. Prove it once.

## DO NOT

- Do not change the API, the schema or `tokens.css`. Do not add free colour editing.
- Do not mount these controls on the admin Company page or in the top bar.
- No new `#RRGGBB` literals; swatches render colours that come from data.
- Do not touch `sot/` (CP-24).

## Screenshots

- My account with the Appearance card: Company theme selected, then Harbour selected.
- The Tenders page in Harbour light, then dark via ThemeToggle (must be the standard dark theme).
- Compact density on a table page.
- Narrow (≤420 px) My account.
