---
premise: '! grep -rq "documentElement.style.setProperty" apps/web/src'
premise_means: >-
  Nothing in the web app turns a saved brand colour scheme into CSS. Measured 2026-09-01 on
  origin/main at 43b6c743 - `grep -rn "setProperty" apps/web/src` returns ZERO hits and
  `grep -rn "documentElement.style" apps/web/src` returns ZERO hits. The only three references to
  activeColorScheme anywhere in apps/web are AdminCompanyPage.tsx:65, :66 and :882, all inside the
  admin form that EDITS the value. `grep -rln "primaryColorHex|secondaryColorHex" apps --include=*.ts
  --include=*.tsx` excluding dist/, modules/branding and modules/company-profile returns exactly two
  files: prisma/seed-company-profile.ts and AdminCompanyPage.tsx. No PDF renderer, no email
  template, no stylesheet reads them. The backend has shipped the whole feature since PR #616 -
  BrandColorScheme + BrandAsset models, full CRUD, audit logging - and the columns are write-only.
scope:
  - apps/api/src/modules/branding/branding.controller.ts
  - apps/api/src/modules/branding/branding.service.ts
  - apps/api/src/modules/branding/branding.module.ts
  - apps/api/src/modules/branding/__tests__/branding.service.spec.ts
  - apps/web/src/lib/brand-scheme.ts
  - apps/web/src/lib/__tests__/brand-scheme.test.ts
  - apps/web/src/App.tsx
done_when: >-
  grep -q "setProperty" apps/web/src/lib/brand-scheme.ts && grep -q "getActiveBrandingForViewer"
  apps/api/src/modules/branding/branding.service.ts && grep -q "BrandSchemeProvider"
  apps/web/src/App.tsx
size: 7
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Brand & theme S1: make "Primary color" actually change a colour

Marco approved `erp-theme-builder-mockup.pdf` (2026-09-01) and described the settings area as
"half baked into the system". For this feature that description is precise and this slice fixes
the precise thing.

## The defect, stated plainly

An administrator opens **Settings → Company → Branding**, types a hex into "Primary color (hex)",
and saves. The API validates it, writes it, and records an audit entry. **Nothing on any screen
changes, ever.** `apps/web/src/styles/tokens.css:2` hard-codes `--brand-primary: #005B61` and no
code path overwrites it. The field is decorative.

This is not a missing feature. It is a wired-up backend joined to a form by nothing at all.

## What is already right - do not rebuild it

MEASURED on origin/main at 43b6c743. Every item below exists and works:

- `BrandColorScheme` (`apps/api/prisma/schema.prisma:6222`) and `BrandAsset` (`:6245`) models,
  and `CompanyProfile.activeColorSchemeId` (`:6202`).
- `branding.service.ts` (255 lines): `getBranding()`, `listColorSchemes()`, `upsertColorScheme()`,
  `deleteColorScheme()`, asset handling, `assertHex()` validation, audit action
  `"branding.colorScheme.upsert"`, and the legacy-column mirror at `:141-150`.
- `branding.controller.ts`: `@Get()`, `@Get/@Post/@Delete("color-schemes")`,
  `@Put("active-color-scheme")`, `@Put("assets")`, `@Delete("assets/:kind")`.
- `BrandingSection` at `AdminCompanyPage.tsx:872` - the editing surface, including the
  "No active palette selected" fallback message.
- `apps/web/src/styles/tokens.css` - 379 lines, the ONLY file in the repo defining CSS custom
  properties, with a complete light block, a `:root[data-theme="dark"]` block and a
  `prefers-color-scheme` fallback.
- `apps/web/src/lib/theme.ts` - light/dark/system preference, `THEME_STORAGE_KEY =
  "projectops.theme"`, `applyThemePreference()` setting the `data-theme` attribute.

**Do not touch tokens.css in this slice.** Do not touch `theme.ts`. Do not touch
`AdminCompanyPage.tsx`. Do not touch `settings-nav-items.ts` (see CONFLICT below). The join is the
whole job.

## TRAP 1 - every branding route is admin-only, so the obvious fix 403s for everyone

MEASURED: `branding.controller.ts:40` is `@UseGuards(JwtAuthGuard, PermissionsGuard)` and EVERY
route carries `@RequirePermissions("platform.admin")`, including `@Get()`.

A first attempt that calls `GET /admin/branding` on app boot will work perfectly for Marco and
return **403 for every other user in the company**. It will look shipped in testing and be broken
in production. This is exactly the failure mode that produced the current state.

**The fix:** add ONE new read-only route on the existing controller:

    @Get("../branding/active")   // see routing note below
    @UseGuards(JwtAuthGuard)     // authenticated, NO permission requirement

Nest cannot express a sibling path from inside `@Controller("admin/branding")`. Declare a second,
small controller class in the same file:

    @ApiTags("Branding")
    @Controller("branding")
    @UseGuards(JwtAuthGuard)        // NOTE: no PermissionsGuard, no @RequirePermissions
    export class BrandingViewerController { ... }

and register it in `branding.module.ts` -> `controllers: [BrandingController,
BrandingViewerController]`. That module file is in scope; it is a one-line change and the only one
it needs.

Do not add `PermissionsGuard` to the new class "to be safe". Adding it without a
`@RequirePermissions` decorator is the subtle version of this same bug - check how
`PermissionsGuard` behaves with no required permission before assuming it is a no-op, and if it
denies by default, say so in the PR body rather than working around it.

## TRAP 2 - the unprivileged route must not leak the palette list

`getBranding()` returns the active scheme, **all schemes**, all assets and the legacy fallbacks. An
unprivileged viewer needs four values and must not receive the rest.

Add a narrow method - name it `getActiveBrandingForViewer()` - returning exactly:

    { primaryColorHex, secondaryColorHex, logoLightUrl, logoDarkUrl }

resolved with the same precedence `BrandingSection` already uses: active scheme first, legacy
CompanyProfile column as fallback. Do **not** return scheme ids, scheme names, the scheme list,
the favicon or the PDF letterhead. Do not call `getBranding()` and delete fields from its result -
build the narrow object from its own query, so a later widening of `getBranding()` cannot silently
widen this route.

## TRAP 3 - the schema stores TWO colours, the mockup shows a full palette

MEASURED at `schema.prisma:6222-6233`: `BrandColorScheme` has exactly `primaryColorHex` and
`secondaryColorHex`. `tokens.css` declares roughly forty custom properties, and the approved
mockup shows palette rows for sidebar, cards, text and a whole "Advanced - status colours"
section.

**Two colours is all the data model can store.** This slice therefore applies exactly two
overrides and no more:

    --brand-primary  <- primaryColorHex
    --brand-accent   <- secondaryColorHex

Do NOT invent derived tokens (`--brand-primary-light`, `--brand-primary-dark`, `--status-active`,
sidebar or card colours) by computing tints from the two stored values. A derived tint that nobody
chose and nobody can see before it ships is a new class of visual bug. `--brand-primary-dark` and
`--brand-primary-light` keep their tokens.css values in this slice.

The gap between "two stored colours" and "the mockup's full palette" is real, and Marco has
DECIDED it closes: on 2026-09-01 he confirmed he wants the whole mockup built. That work is slice
S3, which adds the columns behind a migration Marco arms and merges himself. **Do not pre-empt it
here** - migrations are vetoed by the watcher's file policy and would route this PR to a human
anyway.

What that means for the copy you write: this slice governs `--brand-primary` and `--brand-accent`
TODAY, and the page must say so plainly, but do NOT write copy that presents two colours as a
permanent limit of the system ("the ERP supports a primary and an accent colour"). Word it as the
current state - "primary and accent are applied across the app today" - so S3 widens it without
having to retract a claim.

## TRAP 4 - flash of the wrong brand on every reload

`apps/web/index.html` already carries a first-paint bootstrap script for light/dark, precisely
because a preference applied after React mounts repaints visibly. A scheme fetched over the
network after mount has the same problem, and worse: the repaint is a brand colour change across
the whole shell.

Mirror the pattern `theme.ts` already established. Cache the last-known pair in localStorage under
a NEW key - `projectops.brand-scheme` - apply it synchronously on module load, then revalidate
from the network and re-apply if it differs. Do **not** reuse `THEME_STORAGE_KEY`; a stale brand
value must never be able to corrupt the light/dark preference.

Wrap every `localStorage` read and write in try/catch. A browser with site data blocked must render
the tokens.css defaults, not throw during boot.

## TRAP 5 - validate the hex before writing it into CSS

`assertHex()` guards the WRITE path. This slice adds a READ path that injects a stored string into
`document.documentElement.style`, and the localStorage cache adds a second source that no server
ever validated.

Validate in `brand-scheme.ts` before every `setProperty` call: `/^#[0-9a-fA-F]{6}$/` (the stored
column is `@MaxLength(9)`, so also accept 8-digit `#RRGGBBAA` if you accept anything beyond six).
On a value that fails, skip that one property and leave the tokens.css default standing. Never
`setProperty` an unvalidated string.

## What to build

1. **API** - `getActiveBrandingForViewer()` on the service, plus a `@Controller("branding")` class
   with a single `@Get("active")` guarded by `JwtAuthGuard` only. Four fields out, nothing more.

2. **Web** - `apps/web/src/lib/brand-scheme.ts` exporting:
   - `applyBrandScheme(scheme)` - validates each hex, calls
     `document.documentElement.style.setProperty("--brand-primary", ...)` and the same for
     `--brand-accent`. Skips invalid values.
   - `clearBrandScheme()` - `removeProperty` for both, so logout returns to tokens.css defaults.
   - `BrandSchemeProvider` - a component that applies the cached value on mount, fetches
     `/branding/active`, caches and re-applies. It must render children unconditionally: a failed
     fetch degrades to tokens.css defaults and must never blank the app.

3. **Mount** - in `App.tsx`, inside `AuthProvider` (it needs the token) and wrapping the
   authenticated routes. `AuthProvider` opens at `App.tsx:245`.

4. **Logout** - `clearBrandScheme()` on logout, or the next user at a shared terminal inherits the
   previous company's brand from localStorage. If the logout path lives in `AuthContext.tsx` that
   is a seventh file: instead have `BrandSchemeProvider` clear on unmount and on a null user, which
   keeps the change inside the files already in scope.

## Tests - both required

**`apps/web/src/lib/__tests__/brand-scheme.test.ts`**
- `applyBrandScheme` with a valid pair sets both custom properties.
- An invalid hex (`"red"`, `"#12"`, `"'; DROP"`, `""`) sets NOTHING for that property and does not
  throw. This is the positive control for TRAP 5 - assert the property is ABSENT, not merely that
  no exception was raised.
- `clearBrandScheme` removes both.
- A localStorage accessor that throws does not prevent `applyBrandScheme` from working.

**`apps/api/src/modules/branding/__tests__/branding.service.spec.ts`** (the branding module has NO
tests today - MEASURED, the directory holds only controller, module and service)
- `getActiveBrandingForViewer()` returns the active scheme's colours when one is set.
- It falls back to the legacy CompanyProfile columns when `activeColorSchemeId` is null.
- Its returned object has **exactly four keys**. Assert the key set, not just the presence of the
  four - this is the regression guard for TRAP 2, and a test that only checks presence will pass
  the day someone widens the projection.

## Verify by looking, not by a green build

The acceptance evidence for this PR is a screenshot. Set the active scheme to something obviously
wrong - `#FF00FF` - reload, and capture the shell. If nothing turns magenta, this slice did not
work, however green CI is. A build passes whether or not a colour reached the screen; that is how
the feature reached this state.

## Do not touch

- `apps/web/src/styles/tokens.css` - not one line. The defaults are the fallback this slice
  depends on.
- `apps/web/src/pages/settings/settings-search.ts` - already correct.
- `apps/web/src/components/settings-nav-items.ts` - **CONFLICT**: in scope for
  `pr-settings-home-s1-cards-tabs-counts-HOLD.md`, staged on PR #1489. The mockup renames the
  Branding tab to "Brand & theme"; that rename is deferred to a later slice so the two never touch
  the same file. Leave the label reading "Branding".
- `apps/api/prisma/` - no schema change, no migration. The watcher's merge policy vetoes any PR
  touching `migrations/`.
- The mojibake in `schema.prisma:6190` and `:6218` (`Ã¢â€â‚¬` where an em-dash belongs) is a
  pre-existing double-encoding artefact. Do not repair it here - editing those lines risks
  re-encoding the file. It is out of scope.

## Findings for Marco - do not act on these, report them

1. **The mockup's palette exceeds the data model, and Marco has said build all of it.**
   `BrandColorScheme` stores two hexes; the mockup shows sidebar, card, text and five status
   colours. Marco confirmed on 2026-09-01 that he wants the full mockup. That is slice S3 - new
   columns, a migration, armed and merged by Marco. S1 is the prerequisite either way: the join
   from a stored value to a CSS variable is needed whether the palette is two colours or twenty.

2. **The mockup's presets and density controls do not exist.** MEASURED: `Harbour` 0 hits,
   `Graphite` 0 hits, `Comfortable` 0 hits, `contrast` 0 hits across apps/web/src. They are
   SLICES 2 and 4 of `docs/plans/theme-system-plan.md`, neither of which has shipped.

3. **`docs/plans/theme-system-plan.md` has shipped nothing in fifteen days.** Its own premises
   still hold verbatim: `grep -c "prefers-color-scheme: dark" tokens.css` returns 2 (SLICE 1's
   duplication), `ThemePicker.tsx` does not exist (SLICE 2), `data-theme="initial"` is absent
   (SLICE 3), `DensityControl.tsx` does not exist (SLICE 4), and there are no density tokens. The
   plan is REGISTERED as decision **D24** in `sot/05`. See the companion slice S2 for why its
   migration campaign cannot be run as written, and why that needs Marco's amendment rather than a
   sub-agent's.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting", and it does **not** mean "do the work then ask permission to push".
> There is no human in this run. **Finishing the work and then asking for permission is
> indistinguishable from failing** - the work is discarded either way.

