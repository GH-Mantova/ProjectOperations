---
premise: '! test -f docs/plans/theme-system-plan.md'
premise_means: No theme-system slice plan exists yet; the app still has only the light/dark/system toggle from #668 and 3763 hard-coded colour literals.
scope:
  - docs/plans/**
done_when: pnpm lint && test -f docs/plans/theme-system-plan.md && grep -q "SLICE 17" docs/plans/theme-system-plan.md && grep -q "EXPOSE LAST" docs/plans/theme-system-plan.md
size: 1
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# SLICE 0 - Theme system: write the slice plan

> Authored by PR Master with Marco 2026-08-17 (briefs 1.2 / 1.2.1 / 1.2.2, decisions D5 + D24).
> This is a DOCS-ONLY planning PR. Write the plan; write no code. Every code slice chains behind it
> and is armed one at a time.

## Context the plan must be written against (all verified on origin/main b8ef1fb)

- A working token system already exists (#668): `apps/web/src/styles/tokens.css` (`:root` +
  `[data-theme="dark"]`), `apps/web/src/lib/theme.ts` (`ThemePreference = "system" | "light" | "dark"`),
  `apps/web/src/components/ThemeToggle.tsx`, and a first-paint bootstrap in `apps/web/index.html`.
  This work EXTENDS that system. Do not invent a parallel one.
- `tokens.css` duplicates the entire `[data-theme="dark"]` block verbatim inside an
  `@media (prefers-color-scheme: dark)` fallback. Every new token must currently be added twice.
- A branding module already exists on the API (#616): `BrandColorScheme` (name + primary/secondary
  hex, full CRUD), `BrandAsset`, and `CompanyProfile.activeColorSchemeId`. The web app consumes NONE
  of it. No migration is required for a company default.
- Hard-coded colour literals on origin/main: 3763 app-wide. By area - tendering 372 in 34 files,
  crm 267 in 10, shared components 219 in 28, field 199 in 11, workers 90 in 6, projects 74 in 5,
  jobs 7 in 2, scheduler 6 in 2, dashboard 0.
- `sot/01` SECTION 5 declares the brand palette permanent and already states "Always use CSS
  variables - never hardcode colour values". The codebase violates that rule 3763 times. The plan
  RECOMMENDS a `sot/01` doc-reconcile PR; it must not edit `sot/` itself (CP-24).

## Marco's decisions this plan must encode

1. Four named colour schemes, each working in BOTH light and dark. Dark remains its own toggle.
2. A SEPARATE compact/comfortable density control, expressed as tokens (not a class), that composes
   with every scheme.
3. Company sets the default; a user may override it for themselves. Reuse the existing branding API.
4. App screens ONLY. Generated PDFs and emails keep fixed company branding (D8). The login page is
   pre-authentication and is out of scope.
5. The four options differ in colour, typography, spacing, radius and component styling. They do NOT
   change layout, navigation structure, menu positions, or nav labels. The approved CRM mock-up is
   the reference for the "Initial" scheme's visual language ONLY - its nav grouping, per-item
   annotations and new components belong to other briefs and are explicitly OUT of scope.
6. Build the picker FIRST, EXPOSE IT LAST - no user sees a picker until the token cleanup for the
   agreed areas has landed.

## The plan file: docs/plans/theme-system-plan.md

Write it with these sections:

1. Goal + non-goals - non-goals must name, explicitly: no layout change, no nav/menu-position
   change, no PDF/email theming, no login-page theming, no new brand-hue decision without Marco.
2. Current state - the verified facts above, with file paths and the per-area literal counts.
3. Slice list, in dependency order, each with: id, one-line goal, expected files, an executable
   premise, and its `requires_merged` predecessor. Use exactly these slices:
   - SLICE 1 - token foundation: collapse the duplicated dark block so each token is declared once;
     add density tokens (spacing, row height, control height). Zero visual change.
   - SLICE 2 - named-theme registry + `ThemePicker.tsx`, built but NOT mounted in the shell; widen
     `ThemePreference`; keep the first-paint bootstrap in sync so no scheme flashes on reload.
   - SLICE 3 - the `[data-theme="initial"]` block: colours, type scale, spacing rhythm, radii.
   - SLICE 4 - density preference + compact/comfortable control, built but NOT mounted.
   - SLICES 5-7 - token cleanup, shared components (28 files, three slices of 10 or fewer).
   - SLICES 8-11 - token cleanup, tendering (34 files, four slices of 10 or fewer).
   - SLICE 12 - token cleanup, crm (10 files).
   - SLICE 13 - token cleanup, projects + jobs + scheduler (9 files).
   - SLICES 14-15 - token cleanup, field (11 files, two slices). MARK AS CONDITIONAL: include only
     if Marco confirms field screens are in scope.
   - SLICE 16 - schemes three and four, added as two `[data-theme]` blocks. GATED on Marco choosing
     from mock-ups; the plan must say the mock-up round happens before this slice is armed.
   - SLICE 17 - EXPOSE LAST: mount the picker and the density control in the shell top bar, and wire
     the company default from the existing branding API with a personal override.
4. Per-slice acceptance - every cleanup slice states its own grep premise
   (`grep -rE "#[0-9a-fA-F]{3,8}" <area>` returns matches before, none after) and REQUIRES
   before/after screenshots of the busiest screen in that area, in light and dark, in the PR body.
   A build that passes is not evidence that the screen still looks right.
5. Sequencing rule - state in the plan, in bold, that SLICE 17 must not be armed until every
   non-conditional cleanup slice has merged.
6. Open decisions - a short list naming: field screens in or out; which two candidate schemes Marco
   picks; and the recommended `sot/01` SECTION 5 doc-reconcile.

## DO NOT

- Do NOT write any code, touch `apps/web/**`, or create the tokens/registry/picker in this PR.
- Do NOT edit anything under `sot/` - recommend the doc-reconcile in the plan instead (CP-24 hard-fails).
- Do NOT change nav structure, menu order, labels, or any layout in this plan's slices.
- Do NOT add a migration, dependency or env var.
- Do NOT arm any of SLICES 1-17. Arming is Marco's call, one slice at a time.

## VERIFY

```
pnpm lint
test -f docs/plans/theme-system-plan.md
grep -q "SLICE 17" docs/plans/theme-system-plan.md
grep -q "EXPOSE LAST" docs/plans/theme-system-plan.md
```

## STANDING AUTHORITY

You have full authority to read any file in the repo, run read-only git and grep commands, and open
the PR for this docs-only change. You do NOT have authority to write code, edit `sot/`, merge, or arm
any downstream prompt. If the premise is already false when you boot - the plan file exists - exit
with a NO-OP report saying so; do not invent adjacent work.
