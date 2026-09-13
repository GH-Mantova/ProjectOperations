---
premise: '! grep -rq "contrastRatio" apps/web/src'
premise_means: >-
  The builder surface from the approved mockup does not exist. MEASURED 2026-09-08 over apps/web/src
  - `grep -ril contrast-ratio` returns 0 files and `grep -ril contrastRatio` returns 0. The editing
  surface that does exist, `BrandingSection` at AdminCompanyPage.tsx:872, is a plain form over two
  hex fields with no preview, no contrast feedback and no per-user override. POSITIVE CONTROL:
  `grep -ril -- "--brand-primary"` returns 33 files on the same command shape, so the zeros are real.
requires_file_on_main: apps/web/src/components/DensityControl.tsx
module: settings
design_ref: https://claude.ai/code/artifact/330c3e98-e1ae-4120-899b-66960785a112?org=6662b30d-93fe-4547-a980-49cefee195e7
scope:
  - apps/web/src/lib/contrast.ts
  - apps/web/src/lib/__tests__/contrast.test.ts
  - apps/web/src/lib/brand-scheme.ts
  - apps/web/src/lib/__tests__/brand-scheme.test.ts
  - apps/web/src/components/ThemeBuilderPreview.tsx
  - apps/web/src/components/__tests__/ThemeBuilderPreview.test.tsx
done_when: >-
  grep -q "contrastRatio" apps/web/src/lib/contrast.ts && grep -q "ThemeBuilderPreview"
  apps/web/src/components/ThemeBuilderPreview.tsx && grep -q "projectops.brand-override"
  apps/web/src/lib/brand-scheme.ts && pnpm --filter web build && pnpm --filter web test
size: 6
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Brand & theme S6: see it before you save it, and know whether anyone can read it

`theme-system-plan.md` SECTION 7: **S6 - live preview, contrast-ratio badges, per-user override in
`localStorage`. Schema: no. Gate: S3, S5.**

This prompt's machine gate names S5's artifact (`DensityControl.tsx`). **S3 is the other half of the
gate and the linter is not checking it** - only one file gate is expressed here. Before you start,
confirm by hand that `grep -q sidebarBgHex apps/api/prisma/schema.prisma` exits 0 on `origin/main`.
If it does not, S3 has not landed, there is no full palette to preview, and this slice cannot be
built as written: **stop and say so** rather than previewing two colours and calling it done.

## The three things, and why they are one slice

They are one slice because they are one screen. Splitting them gives a preview nobody can judge, a
badge attached to nothing, and an override with no surface to set it from.

**1. Live preview.** `ThemeBuilderPreview.tsx` - a small, self-contained render of the shell
(sidebar, a card, body text, the five status chips) that takes a palette as a prop and paints
itself from it. Not the real shell, and it must NOT call `applyBrandScheme` - see TRAP 1.

**2. Contrast badges.** `contrast.ts` exporting `contrastRatio(hexA, hexB)` implementing WCAG 2.x
relative luminance, and a helper that maps a ratio to a level (`AAA` / `AA` / `AA Large` / `Fail`).
Badge the pairs that matter and only those: sidebar text on sidebar background, primary text on page,
primary text on card, and each status colour on card. A badge on a pair nobody reads is noise.

**3. Per-user override.** Stored in `localStorage` under a NEW key `projectops.brand-override`,
alongside the existing `projectops.theme` and `projectops.brand-scheme`. SECTION 7 is explicit about
why there is no table: *"there is no general per-user preference store in the schema today
(`NotificationPreference` is the only per-user preference model, and it is channel-specific)."*
Do not add one here.

## TRAP 1 - a live preview that applies to the live document is not a preview

The obvious implementation calls `applyBrandScheme()` on every keystroke so the real shell updates.
That is not a preview, it is an unsaved mutation of the running app: navigate away mid-edit and the
user is left in a brand they never saved, with no way back except reload.

Scope the preview to its own subtree. Set the custom properties on the preview element's `style`
attribute, not on `document.documentElement`. `applyBrandScheme` keeps its current job - applying
the SAVED scheme at boot - and the preview never touches it.

## TRAP 2 - the override must lose to nothing except the user

Three sources now want to set the same variables: the company's saved scheme (from
`/branding/active`), the per-user override, and the tokens.css defaults. State the precedence once,
in `brand-scheme.ts`, and test it:

    per-user override  >  company active scheme  >  tokens.css default

The override is per-user-per-browser and must survive a company scheme change - that is its whole
purpose. It must also be clearable: a "reset to company theme" action that removes the key and
re-applies the fetched scheme without a reload.

**And it must clear on logout.** S1 already established that `BrandSchemeProvider` clears on unmount
and on a null user, so the next person at a shared terminal does not inherit the previous user's
brand. An override that survives logout is the same bug with a new key.

## TRAP 3 - validate every hex again, here

`contrast.ts` parses hex into channels. `ThemeBuilderPreview` writes hex into inline styles. The
override reads hex out of `localStorage`, which no server ever validated. Every one of those is an
unvalidated-string path.

Reuse the `/^#[0-9a-fA-F]{6}$/` guard `brand-scheme.ts` already applies. `contrastRatio` must return
a sentinel (not throw, not `NaN`) on an unparseable input, and the badge must render "unknown"
rather than a number computed from garbage. **A contrast badge that lies is worse than no badge** -
it is a green tick on unreadable text.

## TRAP 4 - the hex ratchet rejects any hex literal in a new file

`scripts/pipeline/check-hex-ratchet.mjs` runs in CI (`ci.yml:354`, `:370`) and **new files must
start at zero**. `contrast.ts`, `ThemeBuilderPreview.tsx` and both test files are new.

This one is genuinely awkward and you must plan for it: `contrast.test.ts` naturally wants literal
hexes as fixtures. **Build them from string parts** (`"#" + "000000"`), or drive the tests from
channel triples and a tiny local formatter, so no `#RRGGBB` literal appears in the file. Say in the
PR body which technique you used. Do not edit `docs/qa/hex-baseline.json` - that file is not in
scope and hand-editing a ratchet baseline to admit your own file defeats the gate.

## TRAP 5 - `brand-scheme.ts` is shared with S3

S3 widened `applyBrandScheme` to fifteen properties and widened its test. You are widening the same
two files again, for the override. Read them as they stand on `origin/main` first; do not write from
this prompt's description of them, which was authored before S3 landed.

## Not in scope

- `AdminCompanyPage.tsx`. The preview and badges are components; mounting them into the Branding
  section is a seventh and eighth file and belongs to a follow-up slice that owns that page. **Build
  them mountable and say in the PR body that they are not yet mounted** - do not quietly widen scope,
  and do not pretend the feature is user-visible when it is not.
- `apps/web/src/styles/tokens.css` - S0 and S5 own it.
- Any schema change. S3 already added the columns.

## Tests

**`contrast.test.ts`** - known WCAG pairs at their documented ratios (black on white is 21:1, and a
mid-grey pair at a value you can cite); the level mapping at each boundary; an unparseable input
returns the sentinel and does not throw. No hex literals - see TRAP 4.

**`ThemeBuilderPreview.test.tsx`** - renders from a palette prop and does NOT write to
`document.documentElement`. Assert the absence directly: read `documentElement.style` before and
after render and assert it is unchanged. That is the regression guard for TRAP 1 and the single most
valuable assertion in this slice.

**`brand-scheme.test.ts`** - the three-way precedence, and that clearing the override restores the
company scheme without a reload.

## Findings for Marco - report, do not act

1. **Nothing is mounted at the end of this slice.** The preview and badges exist, are tested, and are
   not on any screen until a follow-up mounts them into `BrandingSection`. That is deliberate scope
   control, and it means S6 is not the slice that makes the builder usable - there is one more.
2. **A per-user override means two people at the same company can see different brands.** That is
   what SECTION 7 specifies, and it is probably right for a preference. It is worth him confirming
   once he can see it, because it interacts with screenshots, support and anything printed.

## A note on `module: settings` - it is the nearest true home, not an exact one

MEASURED 2026-09-08: `lint-prompt.mjs` builds its module vocabulary from the directory names under
`apps/api/src/modules/` and `apps/web/src/pages/`, plus the fixed pipeline destinations
(`prisma`, `watcher`, `pipeline`, `ci`, `e2e`, `sot`, `board`, `docs`). **Nothing maps
`apps/web/src/styles/`, `apps/web/src/lib/` or `apps/web/src/components/` to a module**, so a web
slice that touches only those paths derives nothing and REJECTs `MODULE_AMBIGUOUS`.

`settings` is used here because the theme builder and the density control live in Settings, which
makes it the most truthful label the vocabulary offers - not because this slice edits a settings
page. Do not "fix" this by widening `scope` to a settings directory the slice does not touch.

## STANDING AUTHORITY

> **You have STANDING AUTHORITY to finish the work, commit, push, and OPEN THE PR. Do not ask.**
> **"Do NOT auto-merge" means: open the PR and LEAVE IT UNMERGED.** It does **not** mean "wait for
> approval before starting". There is no human in this run. **Finishing the work and then asking for
> permission is indistinguishable from failing** - the work is discarded either way.
