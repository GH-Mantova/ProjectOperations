---
premise: '! grep -rq "BRAND_THEME_BUILDER_V1" apps/web/src'
premise_means: >-
  The user-facing brand builder does not exist. MEASURED 2026-09-25 at origin/main 73d0c85b:
  BrandingSection (AdminCompanyPage.tsx:940) renders six plain text inputs and the line
  "No active palette selected - showing legacy string fields", and writes every field through
  PATCH /admin/company/profile. The pieces it should be built from all shipped and are reachable
  by nothing: ThemeBuilderPreview.tsx and DensityControl.tsx are each referenced only by their own
  test file, and setUserBrandOverride has no caller outside brand-scheme.ts. POSITIVE CONTROL:
  grep -rl "contrastRatio" apps/web/src returns 3 files, so the zeros above are real.
requires_on_main: 'apps/web/src/components/ThemeBuilderPreview.tsx :: ThemeBuilderPreview'
design_ref: Claude Design/proposed/s7a-brand-theme/s7a-brand-theme-builder-mockup.html
scope:
  - apps/web/src/pages/admin/BrandThemeSection.tsx
  - apps/web/src/pages/admin/__tests__/brand-theme-section.test.tsx
  - apps/web/src/lib/branding-api.ts
  - apps/web/src/lib/__tests__/branding-api.test.ts
  - apps/web/src/pages/admin/AdminCompanyPage.tsx
done_when: >-
  pnpm build && pnpm lint && pnpm --filter web test && grep -q "BRAND_THEME_BUILDER_V1"
  apps/web/src/pages/admin/BrandThemeSection.tsx && ! grep -q "No active palette selected"
  apps/web/src/pages/admin/AdminCompanyPage.tsx
size: 6
gate_allow: none
backfill: false
rollback_strategy: >-
  Front-end only. No migration, no schema, no seed, no env var. Reverting the commit restores the
  previous BrandingSection exactly; every branding route it calls already existed and is untouched,
  so no stored data changes shape and nothing needs unwinding.
seed_only: false
escalates: true
module: admin
cluster: brandtheme
cluster_order: 7
---

<!-- watcher: do-not-arm -->

**MARCO GATE.** The mock-up at the `design_ref` was sent to Marco on 2026-09-25 and he has not
approved it yet. The marker line directly above is what holds this prompt; only Marco deletes it,
and deleting it is his approval of that mock-up. Both instruments enforce it in the bare form:
`lint-prompt.mjs` reports `HUMAN_GATE_PRESENT`, and `arm-prompt.ps1` refuses to rename the file.

# Brand & theme S7a: the builder screen, in light mode, with nothing pretending to be finished

Replaces `BrandingSection` (`AdminCompanyPage.tsx:940`) with the screen the branding module never
got. **Front end only.** The API is complete and correct; this slice consumes it.

STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.

## Marco's decisions, confirmed 2026-09-25 - build to these, do not re-open them

1. **The company palette applies in LIGHT MODE ONLY.** Dark mode keeps `tokens.css`.
2. **Personal controls are NOT on this screen.** Density and the per-user override belong in
   Personal settings; they are a later slice and must not appear here.
3. **Deleting the active scheme is refused.** `Default` is never deletable.

Two decisions are still OPEN and **this slice does not close either**:

- **Brand files are links, not uploads.** There is no upload infrastructure in the API - measured:
  `git grep -l 'FileInterceptor|multer|@UploadedFile' apps/api/src` returns nothing.
- **A preset sets colours only.** No per-scheme radius, type scale or spacing exists in the schema.

Both must be visible to the user and stated in the PR body. See "What this must say about itself".

## Grounded on origin/main 73d0c85b - re-verify before you edit

- `BrandingController` (`apps/api/src/modules/branding/branding.controller.ts`) exposes
  `GET /admin/branding`, `GET /admin/branding/color-schemes`, `POST /admin/branding/color-schemes`,
  `DELETE /admin/branding/color-schemes/:id`, `PUT /admin/branding/active-color-scheme`.
  Every route requires `company.manage`; **every write also calls `assertSuperUser`**
  (`branding.service.ts:387`), which throws `ForbiddenException` on a non-super-user.
- `UpsertColorSchemeDto` carries fifteen colours: `name`, `primaryColorHex`, `secondaryColorHex`
  plus thirteen optional S3 columns. **An omitted optional field leaves the stored value unchanged;
  an explicit null means "fall back to tokens.css".** Send the whole edited scheme, not a diff.
- `ThemeBuilderPreview` (`apps/web/src/components/ThemeBuilderPreview.tsx`) takes a `BrandScheme`
  and paints only itself. **Its isolation contract is load-bearing: it must not call
  `applyBrandScheme()` and must not touch `document.documentElement`.** Extend nothing; use it.
- `lib/contrast.ts` exports `contrastRatio`, `contrastLevel`, `CONTRAST_SENTINEL` (-1 = unknown).
- `lib/brand-scheme.ts` holds the fifteen-field `BrandScheme` type and the S3 property map. Reuse
  the type; do not redeclare it.
- Three rows exist on a seeded database: `Default` (two colours), `Graphite` and `Harbour` (all
  fifteen, `seed-company-profile.ts:134,154`). **Do not hard-code them.**

## What to build

### 1. `lib/branding-api.ts` - one typed client

`getBranding()`, `listColorSchemes()`, `upsertColorScheme()`, `deleteColorScheme()`,
`setActiveColorScheme()`. Each returns the parsed body or throws with the API's message via the
existing `readApiErrorMessage` helper. No component calls `authFetch` for branding directly.

### 2. `BrandThemeSection.tsx` - the screen

Marker `export const BRAND_THEME_BUILDER_V1 = "brandtheme-s7a";`

- **Scheme list** - one card per row from the API, with its swatches, its name, whether it is the
  company default, and whether it carries the full palette or only two colours.
- **Palette editor** - all fifteen fields, grouped Brand / Sidebar / Surfaces and text / Status, each
  editable by swatch and by hex text, both writing the same value. An invalid hex marks the field and
  blocks save; it never reaches the API.
- **Save scheme** and **Set as company default** are two separate actions. Editing never activates;
  activating never saves a half-finished edit. Unsaved changes are shown, and leaving with unsaved
  changes warns.
- **Preview** - `ThemeBuilderPreview` fed the DRAFT palette, so the estimator sees the edit before it
  is saved.
- **Contrast** - ratio and WCAG level for the pairings a person actually decides on: sidebar text on
  sidebar, body text on page, body text on card, and each status colour on card. `CONTRAST_SENTINEL`
  renders as "unknown", never as a number. A failing pair warns; it does not block saving.
- **No-scheme state** - when `activeColorSchemeId` is null, say plainly that no company palette is set
  and the built-in theme is in use, show what that looks like, and offer to create or activate one.
  **The six legacy inputs and the "legacy string fields" line are deleted, not hidden.**
- **Read-only state** - `company.manage` without `isSuperUser`: everything visible, every control
  disabled, one line saying brand changes need a super-user account. No request is issued. This is the
  `RatesListsAdminPage` lesson already cited in `branding.service.ts:384`.
- **Delete** - offered only for a scheme that is not the company default, behind a confirmation naming
  the consequence. `Default` is never deletable. The active scheme must be replaced first.

### 3. `AdminCompanyPage.tsx`

Swap the section. **Keep the `branding` tab id** so deep links and settings-search are unaffected.

## What this must say about itself

On screen, in the user's words, not a comment:

- The palette **applies in light mode**; dark keeps the built-in theme.
- Brand files are set **by pasting a link** - the tiles must not imply upload.
- A preset **sets colours, and only colours** - selecting Graphite will not change corner radius,
  type or spacing.

And in the PR body, a section headed **"What this does not yet do"** naming both open decisions in the
mock-ups' own terms: drag-and-drop asset upload, and per-scheme radius, type scale and density.
**Neither is closed by this slice.** A PR body that omits them fails review.

## Tests - `__tests__/brand-theme-section.test.tsx`

1. The scheme list renders from the API response, not from a constant.
2. An invalid hex blocks save and issues no request.
3. Save posts the whole edited scheme; activate calls the active-color-scheme route; neither does the
   other's job.
4. **Light-only:** no dark-mode custom property is written by this screen, and the preview's isolation
   holds - `document.documentElement.style` is byte-identical before and after render.
5. Read-only: with `isSuperUser: false` every control is disabled and no write request is issued.
6. No-scheme: with `activeColorSchemeId: null` the legacy strings are absent and the built-in-theme
   wording is present.
7. Delete is unavailable for the active scheme and for `Default`, and available otherwise.

## Traps

- **Hex ratchet.** A new file must contain **zero** `#RRGGBB` literals - `check-hex-ratchet.mjs`
  treats a file absent from the baseline as required-clean. Use the token names in
  `apps/web/src/styles/tokens.css`. Swatches render a colour that comes from DATA, which is not a
  literal; any styling colour must be a token. S9's admin panel failed exactly here.
- **The PR title's scope must match `module: admin`.** The linter derives the module from `scope`
  (`apps/web/src/pages/admin/...` resolves to `admin`), and `check-pr-title.mjs` fails a required
  check on a title whose scope is invented. `feat(admin): ...` is the shape.
- **Do not widen a shared type.** `BrandScheme` already has the fifteen fields.
- **Do not mount `DensityControl` or call `setUserBrandOverride`.** They belong to the Personal slice.
- **Do not touch `sot/`** - CP-24 hard-fails a PR that mixes code and `sot/`.

## Screenshots required in the PR body

Light mode only, since that is the decision: the builder with a full palette; the builder with
`Default` (two colours); the no-scheme state; the read-only state; and one showing a failing contrast
pair with its badge. Five images. A green build is not evidence the screen looks right.
