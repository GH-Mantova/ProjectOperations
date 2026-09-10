---
premise: '! grep -rq -- "--density-" apps/web/src'
premise_means: >-
  Density does not exist anywhere in the web app. MEASURED 2026-09-08 over apps/web/src -
  `grep -ril -- "--density-"` returns 0 files, `grep -ril DensityControl` returns 0, and
  `grep -ril comfortable` returns 0. POSITIVE CONTROL on the same command shape:
  `grep -ril -- "--brand-primary"` returns 33 files, so the search is working and the zeros are real
  absences rather than a broken query. tokens.css declares radius and shadow tokens but no spacing,
  row-height or control-height token of any kind.
requires_on_main: 'apps/web/src/styles/tokens.css :: --dark-surface-page'
module: settings
design_ref: https://claude.ai/code/artifact/330c3e98-e1ae-4120-899b-66960785a112?org=6662b30d-93fe-4547-a980-49cefee195e7
scope:
  - apps/web/src/styles/tokens.css
  - apps/web/src/lib/density.ts
  - apps/web/src/lib/__tests__/density.test.ts
  - apps/web/src/components/DensityControl.tsx
  - apps/web/src/components/__tests__/DensityControl.test.tsx
done_when: >-
  grep -q -- "--density-row-height" apps/web/src/styles/tokens.css && grep -q "applyDensity"
  apps/web/src/lib/density.ts && grep -q "DensityControl" apps/web/src/components/DensityControl.tsx
  && pnpm --filter web build && pnpm --filter web test
size: 5
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Brand & theme S5: compact and comfortable, as tokens and a control

`theme-system-plan.md` SECTION 7: **S5 - density (compact / comfortable) as tokens plus a control.
Schema: no. Gate: SLICE 1.** That gate is `pr-brandtheme-s0-token-foundation-HOLD.md`, and this
prompt is gated on the constant it introduces.

## Why this waits on S0

S0 collapses the duplicated dark palette so each value is declared once. Until it lands, every token
this slice adds to `tokens.css` would have to be written into `:root[data-theme="dark"]` at :42 AND
into the `prefers-color-scheme` fallback at :60, by hand, with nothing checking they match. The gate
is not ceremony - it is the difference between adding four tokens and adding eight.

## This slice owns density end to end

SECTION 3's SLICE 1 text mentions "add density tokens" as part of the token foundation. S0
deliberately does NOT do that, so that one slice owns the tokens, the applier and the control rather
than splitting one feature across two prompts editing the same region of the same file. If you find
density tokens already present when you start, the gate has misfired - stop and say so.

## What to build

**1. Tokens.** Add a density group to `:root` with the comfortable (default) values, and a
`:root[data-density="compact"]` block that overrides them. Name them for what they control, not for
the mode: `--density-row-height`, `--density-control-height`, `--density-space-y`,
`--density-space-x`. Comfortable is what the app looks like today - measure the current row and
control heights from a real screen and use those, so "comfortable" is genuinely a no-op for every
existing user.

**2. `apps/web/src/lib/density.ts`** - mirror `theme.ts` exactly. It already solves this problem for
light/dark and its shape is the one to copy:
- `DENSITY_STORAGE_KEY = "projectops.density"` - a NEW key. Do **not** reuse `THEME_STORAGE_KEY`;
  a stale density value must never be able to corrupt the light/dark preference.
- `applyDensity(mode)` - sets `data-density` on `document.documentElement`, or removes the attribute
  for comfortable so the `:root` defaults stand.
- Wrap every `localStorage` read and write in try/catch. A browser with site data blocked must
  render comfortable, not throw during boot.

**3. `DensityControl.tsx`** - the control from the mockup. Two options, current one indicated,
applies immediately on change.

## TRAP 1 - the tokens must actually be consumed or this ships as a no-op

Adding `--density-row-height` changes nothing until something reads it. A slice that adds four
tokens, a lib and a control, and leaves every table row at its hard-coded height, passes CI
completely and does nothing at all - which is exactly the failure mode that left `primaryColorHex`
write-only for months and produced this whole chain.

Wire at least one real, visible surface to the tokens in this slice and name it in the PR body. If
the honest answer is that the row heights live in component-level styles you would have to touch
files outside this scope, **say that in the PR body as a finding** and scope a follow-up - do not
quietly ship four unread tokens and call the slice done.

## TRAP 2 - first-paint flash

`apps/web/index.html` already carries a first-paint bootstrap script for light/dark, precisely
because a preference applied after React mounts repaints visibly. Density changes row heights across
the whole shell; applied after mount it is a visible reflow on every load.

`index.html` is **not in this slice's scope** and adding it would take the file count to six and put
this prompt into a file the theme bootstrap already owns. Apply density synchronously on module load
in `density.ts` - the same trick `brand-scheme.ts` uses for the cached palette - and record in the
PR body whether a flash is still visible. If it is, that is a finding for a follow-up slice that
owns `index.html`, not something to fix by widening this one.

## TRAP 3 - `data-density` must not collide with `data-theme`

`theme.ts` sets `data-theme` on the same element and `tokens.css` selects on
`:root[data-theme="dark"]` and `:root:not([data-theme="light"])`. Use a SEPARATE attribute, and
write the compact selector so it composes with both theme states - `:root[data-density="compact"]`
on its own line, never folded into a theme selector. Test the four combinations: light/comfortable,
light/compact, dark/comfortable, dark/compact.

## TRAP 4 - the hex ratchet is live and it rejects an increase

`scripts/pipeline/check-hex-ratchet.mjs` runs in CI (`ci.yml:354` self-test, `:370` enforcement) and
**requires new files to start at zero**. `DensityControl.tsx` and `density.ts` are new files: they
must contain **no hex literals at all**. Style the control with existing tokens
(`--surface-card`, `--border-default`, `--text-primary`, `--brand-primary`). This is not a
suggestion - a single `#RRGGBB` in a new file fails the gate.

## Tests

**`density.test.ts`** - `applyDensity("compact")` sets the attribute; `applyDensity("comfortable")`
removes it; a localStorage accessor that throws does not prevent either from working; an unknown
stored value falls back to comfortable rather than being written through to the DOM.

**`DensityControl.test.tsx`** - renders both options, marks the current one, and calls the applier on
change. Note this file is under `components/__tests__/`, which is NOT covered by the design_ref
no-screen exemption - that is why this prompt carries a `design_ref`, and it is correct that it does.

## Not in scope

- `apps/web/index.html` - see TRAP 2.
- Any `BrandColorScheme` column. Density is not a colour and does not belong in the palette table;
  S6 stores the per-user override in `localStorage`, per SECTION 7's explicit note that there is no
  general per-user preference store in the schema.
- `theme.ts` - not one line.

## Findings for Marco - report, do not act

1. **Density has no persistence beyond this browser.** `localStorage` only, per SECTION 7. A user on
   two machines gets two densities. That is the plan's stated decision, not an oversight, but it is
   worth him confirming once it is visible.
2. **Whether density is per-user or per-company is undecided.** This slice makes it per-user-per-
   browser because that is the cheapest correct thing. If the mockup shows it in company settings,
   say so and stop rather than guessing.

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
