---
premise: '! grep -q "sidebarBgHex" apps/api/prisma/schema.prisma'
premise_means: >-
  BrandColorScheme still stores only two colours, so the approved theme builder cannot be built.
  MEASURED 2026-09-08 on origin/main - `model BrandColorScheme` opens at schema.prisma:6430 and
  declares exactly `id`, `name`, `primaryColorHex`, `secondaryColorHex`, `createdAt`, `updatedAt`
  and the `activeOn CompanyProfile[]` back-relation. `CompanyProfile.activeColorSchemeId` is at
  :6410. `grep -c sidebarBgHex` over the whole schema returns 0. tokens.css meanwhile declares the
  sidebar, card, text and five status tokens this slice makes configurable, so the targets exist and
  only the storage is missing.
requires_on_main: 'apps/web/src/lib/brand-scheme.ts :: applyBrandScheme'
design_ref: https://claude.ai/code/artifact/330c3e98-e1ae-4120-899b-66960785a112?org=6662b30d-93fe-4547-a980-49cefee195e7
scope:
  - apps/api/prisma/schema.prisma
  - apps/api/prisma/migrations/**
  - apps/api/src/modules/branding/branding.service.ts
  - apps/api/src/modules/branding/branding.controller.ts
  - apps/api/src/modules/branding/__tests__/branding.service.spec.ts
  - apps/web/src/lib/brand-scheme.ts
  - apps/web/src/lib/__tests__/brand-scheme.test.ts
  - docs/data-model/**
done_when: >-
  grep -q "sidebarBgHex" apps/api/prisma/schema.prisma && grep -q "statusDangerHex"
  apps/web/src/lib/brand-scheme.ts && node scripts/data-model/build-relationship-map.mjs --check &&
  pnpm --filter api test
size: 8
gate_allow: migrations
seed_only: false
escalates: true
backfill: false
rollback_strategy: >-
  Additive only - thirteen NULLABLE columns with no defaults and no backfill. Every existing row
  keeps working because NULL means "fall back to the tokens.css value", which is the behaviour on
  main today. Safe to leave applied on main if the run dies mid-flight: the columns are simply
  unread until the consuming code lands. To revert, drop the migration directory and re-run; nothing
  reads the columns until this PR's own web change ships.
module: branding
---

# Brand & theme S3: widen BrandColorScheme to the palette Marco approved

Marco approved `erp-theme-builder-mockup.pdf` on 2026-09-01 and confirmed he wants all of it built.
`theme-system-plan.md` SECTION 7 records this as **S3 - widen `BrandColorScheme` to the mockup's
full palette - sidebar, cards, text, five status colours**, the only slice in the chain that carries
a migration, and the one Marco merges himself.

## What exists, measured - do not rebuild it

MEASURED on origin/main 2026-09-08:

- `BrandColorScheme` at `schema.prisma:6430`: `id`, `name @unique`, `primaryColorHex`,
  `secondaryColorHex`, `createdAt`, `updatedAt`, `activeOn CompanyProfile[]`, `@@map("brand_color_scheme")`.
- `CompanyProfile.activeColorSchemeId` at `:6410`, relation at `:6411`, `onDelete: SetNull`.
- `branding.service.ts` - `getBranding()`, `listColorSchemes()`, `upsertColorScheme()`,
  `deleteColorScheme()`, `assertHex()`, audit action `branding.colorScheme.upsert`, and the legacy
  CompanyProfile mirror.
- `branding.controller.ts` - the admin surface, every route `@RequirePermissions("platform.admin")`.
- S1 of this chain has landed (this prompt is gated on it): `apps/web/src/lib/brand-scheme.ts`
  exports `applyBrandScheme`, and `BrandingViewerController` serves `GET /branding/active` to any
  authenticated user with a four-field projection.

## The thirteen columns, and why these thirteen

They are not invented. Each one maps to a token `tokens.css` already declares, so every column has a
visible destination on day one and none of them needs a new CSS variable:

| column | token it overrides |
|---|---|
| `sidebarBgHex` | `--surface-sidebar` |
| `sidebarTextHex` | `--sidebar-text` |
| `sidebarTextActiveHex` | `--sidebar-text-active` |
| `surfacePageHex` | `--surface-page` |
| `surfaceCardHex` | `--surface-card` |
| `textPrimaryHex` | `--text-primary` |
| `textSecondaryHex` | `--text-secondary` |
| `textMutedHex` | `--text-muted` |
| `statusActiveHex` | `--status-active` |
| `statusWarningHex` | `--status-warning` |
| `statusDangerHex` | `--status-danger` |
| `statusInfoHex` | `--status-info` |
| `statusNeutralHex` | `--status-neutral` |

All thirteen are `String?` - **nullable, no default, no backfill**. NULL means "use the tokens.css
value", which is exactly what every row does today, so the migration cannot change how any existing
installation looks. Do not give them defaults "to be tidy": a default writes a colour nobody chose
onto every existing scheme, and that is a visual change smuggled in behind a schema change.

Follow the file's own convention: `@map("sidebar_bg_hex")` snake_case for every column.

## TRAP 1 - a schema change that leaves the data-model map stale hard-fails CI

`schema.prisma` is in scope, so `docs/data-model/**` MUST be in scope too and the map MUST be
regenerated in this same PR:

    node scripts/data-model/build-relationship-map.mjs

Commit the regenerated `relationship-map.json`, `relationship-map.md` and `metadata-catalog.json`.
The **data-model drift check** (`build-relationship-map.mjs --check`) hard-fails a schema change
that leaves the map stale - it sank #593. You open the PR and exit before CI runs, so you will never
see that red check and cannot fix-forward from it. Regenerate up front.

## TRAP 2 - `GATE-ALLOW: migrations` must be BARE at column 0 of the PR body

CP-11 hard-fails an undeclared migration. The marker must appear as its own line, at column zero,
with no heading marker and no trailing punctuation:

    GATE-ALLOW: migrations

`## GATE-ALLOW: migrations` does not match. `GATE-ALLOW: migrations.` does not match. Ten PRs have
failed on exactly this.

## TRAP 3 - the viewer projection has a test asserting it returns EXACTLY four keys

S1 deliberately shipped `getActiveBrandingForViewer()` with a spec asserting the returned object has
exactly four keys, as the regression guard against widening the unprivileged route by accident. This
slice widens it ON PURPOSE. **Update that assertion to the new key set and say in the PR body that
you did** - do not delete the assertion, and do not loosen it to a presence check. The guard is
still wanted; it is the number that changes.

Widen to the seventeen fields (the four existing plus the thirteen new). Do not return scheme ids,
scheme names, the scheme list, the favicon or the PDF letterhead. Build the object from its own
query as S1 did, so a later widening of `getBranding()` cannot silently widen this route.

## TRAP 4 - validate on the way in AND on the way out

`assertHex()` already guards the write path; extend it to the thirteen new columns in
`upsertColorScheme()`. But the read path matters more here than it did in S1: thirteen more strings
now travel to `document.documentElement.style.setProperty`. `brand-scheme.ts` already validates
`/^#[0-9a-fA-F]{6}$/` before every call and skips on failure, leaving the tokens.css default
standing. Extend the same treatment to all thirteen. A value that fails validation must skip THAT
property only - never abandon the whole apply, or one bad column blanks the brand.

## TRAP 5 - do not touch tokens.css

Not one line. The tokens this slice overrides already exist and their tokens.css values are the
fallback for every NULL column. Editing them here would collide with S0
(`pr-brandtheme-s0-token-foundation-HOLD.md`), which owns that file.

## Also not in scope

- `AdminCompanyPage.tsx` - the editing UI for the new columns is **S6**, not this slice. S3 makes
  the columns exist, storable and applied; a builder surface for them is a separate screen and a
  separate design review.
- Seeded presets (Harbour, Graphite) - that is **S4**, gated on this slice.
- The mojibake at `schema.prisma:6427` (`Ã¢â‚¬` where an em-dash belongs) is a pre-existing
  double-encoding artefact near the block you are editing. **Do not repair it** - touching those
  bytes risks re-encoding the file. Out of scope, and `check-sot-bytes` does not cover
  `schema.prisma`.

## Tests - both required

**`apps/api/src/modules/branding/__tests__/branding.service.spec.ts`**
- `upsertColorScheme()` rejects an invalid hex in each of the thirteen new columns (parameterise;
  one case per column, not one case total).
- `getActiveBrandingForViewer()` returns exactly seventeen keys - assert the key SET.
- A scheme with all thirteen NULL still returns successfully, with those keys present and null.

**`apps/web/src/lib/__tests__/brand-scheme.test.ts`**
- A valid full palette sets all fifteen custom properties (`--brand-primary`, `--brand-accent`, and
  the thirteen).
- One invalid value among thirteen valid ones sets the twelve valid siblings and leaves ONLY the bad
  one at its tokens.css default. Assert the bad property is ABSENT, not merely that nothing threw.

## Verify by looking, not by a green build

Set every one of the thirteen to something obviously wrong, reload, and screenshot. A build passes
whether or not a colour reached the screen - that is precisely how the two original columns spent
months being write-only.

## Findings for Marco - report, do not act

1. **This slice makes the unprivileged `/branding/active` route return seventeen fields.** That is
   still a projection, not `getBranding()`, but it is a real widening of what any authenticated user
   can read about the company's branding. Worth a sentence in the PR body confirming it is intended.
2. **`assertHex()` is `@MaxLength(9)`**, so 8-digit `#RRGGBBAA` is storable. Say in the PR body
   whether you accepted alpha on the new columns or restricted them to six digits, and match
   `brand-scheme.ts` to whatever you chose.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** - the work is discarded either way.
