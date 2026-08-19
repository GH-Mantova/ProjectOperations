---
premise: 'grep -q "<TipFinderPanel />" apps/web/src/pages/admin/MapLocationsTab.tsx'
premise_means: >-
  The Tip Finder is rendered as a standalone panel on the Settings > Map locations admin screen, in
  addition to the drawer on the tender waste card. Two entry points, and only the tender one has
  the context the tool needs.
scope:
  - apps/web/src/pages/admin/MapLocationsTab.tsx
done_when: >-
  pnpm build && pnpm lint && ! grep -q "TipFinderPanel"
  apps/web/src/pages/admin/MapLocationsTab.tsx && grep -q "TipFinderPanel"
  apps/web/src/components/TipFinderDrawer.tsx
size: 1
gate_allow: none
seed_only: false
escalates: false
backfill: false
---

# Tip Finder belongs on the tender waste card only — remove the Settings copy

**Marco's call, 2026-08-19:** the Tip Finder should be reachable from a tender's waste card and
nowhere else. It is currently in two places.

## Grounding (measured on origin/main e8aae713)

`TipFinderPanel` is rendered twice:

| where | how |
|---|---|
| `pages/admin/MapLocationsTab.tsx:719` | `<TipFinderPanel />` — **no props**. This is the one to remove. |
| `components/TipFinderDrawer.tsx:140` | with `initialWasteType`, `initialLoadTonnes`, `initialOriginType`, `initialTenderId`, `onFacilityChosen` |

The drawer is already wired into the tender waste card at
`pages/tendering/ScopeWasteTab.tsx:1142`, opened by the "Find a tip" button next to FACILITY
(`:680`, `:720`). **The tender path already works — nothing needs building.**

Why the Settings copy is the wrong one to keep: it is mounted with **no props at all**, so it has
no tender, no waste type and no origin. That is why it shows "Coming from: Office" with no way to
change it, and why it cannot cost a return trip from the job site. It is not a smaller version of
the tender tool; it is one that cannot work correctly by construction.

## Do

Exactly two deletions in `apps/web/src/pages/admin/MapLocationsTab.tsx`:

1. Line 7 — `import { TipFinderPanel } from "./TipFinderPanel";`
2. Lines 718-719 — the `{/* Tip Finder panel ... */}` comment and `<TipFinderPanel />`, leaving the
   surrounding `</section>` intact.

That is the whole change.

## Do NOT

- **Do NOT delete `TipFinderPanel.tsx`.** `TipFinderDrawer` still renders it — deleting it breaks
  the tender waste card, which is the surface Marco wants kept.
- Do NOT touch `TipFinderDrawer.tsx` or `ScopeWasteTab.tsx`.
- Do NOT move `TipFinderPanel.tsx` out of `pages/admin/`. After this change its only consumer is a
  component, so the file arguably belongs in `components/` — that is a **separate** tidy-up and
  moving it here would turn a two-line deletion into a rename across files. Note it in the PR body
  and leave it.
- Do NOT remove the panel's standalone/no-tender fallback branches. Some may become unreachable
  once this render is gone, but proving that needs a proper read of the props' optionality. Flag
  any you suspect are now dead in the PR body; delete none.
- Do NOT touch `apps/api/**`, `/sot/`, or Azure/Entra/SharePoint.

## Verify

- `pnpm build && pnpm lint` green.
- Confirm in the PR body that the **tender** path still renders: `ScopeWasteTab` → "Find a tip"
  next to FACILITY → drawer opens with the Tip Finder inside.
- Confirm Settings › Map locations still shows the locations table and the map, with the Tip Finder
  section gone and no empty container or stray heading left behind.

## Note for Marco, not part of this slice

Every result in the current Tip Finder shows *"Travel rate not configured — set in Operations
Settings."* That is configuration, not code — the per-kilometre travel rate has never been set, so
the tool cannot compute the travel half of the cost on **either** surface. Removing this panel does
not fix that, and it will still be true on the tender drawer.

## STANDING AUTHORITY

Two-line deletion. Stop and report rather than widening scope.
