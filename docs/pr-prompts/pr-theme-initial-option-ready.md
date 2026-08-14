---
premise: '! test -f apps/web/src/components/ThemePicker.tsx'
premise_means: The shell only has the light/dark/system toggle (#668); there is no named-theme support and no "Initial" theme option.
scope:
  - apps/web/src/**
done_when: pnpm --filter @project-ops/web build && test -f apps/web/src/components/ThemePicker.tsx && grep -q "initial" apps/web/src/styles/tokens.css && grep -q "initial" apps/web/src/lib/theme.ts
size: 6
gate_allow: none
seed_only: false
escalates: false
rollback_strategy: ''
---

# Theme option: add the "Initial" named theme + turn the toggle into a picker

> Authored by PR Master with Marco 2026-08-14. Builds ON the existing theme system (#668:
> `apps/web/src/lib/theme.ts`, `apps/web/src/styles/tokens.css`, `ThemeToggle.tsx` — a
> `data-theme` attribute + localStorage). Extend it from a light/dark/system TOGGLE into a named-theme
> PICKER, and add a curated "Initial" theme that matches the approved CRM mock-up look. Architect so
> adding further curated themes is a one-block drop-in (a new `[data-theme="..."]` block + one registry entry).

## What to build
- **`apps/web/src/lib/theme.ts`**: widen `ThemePreference` from `"system" | "light" | "dark"` to include
  named curated themes (add `"initial"`; keep system/light/dark). Introduce a small `THEMES` registry
  (id + human label, e.g. System / Light / Dark / Initial) so new themes are declarative. `applyThemePreference`
  keeps setting `data-theme` (or removing it for `system`); persist the chosen id in `localStorage`
  (`THEME_STORAGE_KEY`). Keep the first-paint inline bootstrap in `index.html` in sync (it must recognise the
  new ids so tokens resolve on first paint — no flash).
- **`apps/web/src/styles/tokens.css`**: add a `[data-theme="initial"]` block defining the curated token set
  below. Reuse the existing token variable NAMES already in tokens.css (map these intents onto them); do not
  invent a parallel token vocabulary.
- **`apps/web/src/components/ThemePicker.tsx`**: a small dropdown/segmented picker listing the `THEMES`
  registry, replacing the binary `ThemeToggle` in the shell top bar (keep `ThemeToggle.tsx` or delete it if
  fully unused — do not leave a dead import). Shows the active theme; selecting one calls `setPreference`.

## "Initial" token intent (match the approved mock-up)
- Brand: primary/teal `#005B61`, accent/amber `#FEAA6D` (these are already the brand tokens).
- Surfaces: app background `#f4f6f8`, card/surface `#ffffff`, hairline/border `#e5e9ee`.
- Text: ink `#0f1720`, muted `#64748b`.
- Status: success `#16a34a`, danger `#dc2626`; badge fills — active `#d7efe9`/`#065f52`, prospect
  `#fde7cf`/`#8a4b09`, neutral `#eceff2`/`#5a6675`.
- Shape/rhythm: card radius ~12px, control radius ~8px; system font stack; type scale — page heading ~21px,
  section heading ~14px, body ~13px, table header ~11.5px uppercase. Generous card padding (14–16px),
  16–20px section gaps. This calm, high-contrast, rounded-card look is what makes "Initial" read better than
  the current shell.

## Do NOT
- Do NOT touch Azure/Entra/SharePoint or `/sot/`. Do NOT change any page's content/logic — this is theming only.
- Do NOT hardcode the palette in components — it lives in `tokens.css`; components consume token variables.
- Do NOT break the existing light/dark/system behaviour or the no-flash first paint.

## Guardrails
- `pnpm --filter @project-ops/web build` + lint must pass. Verify no theme-flash regression (bootstrap script
  recognises the new ids). `escalates: false` — auto-merges on green.
