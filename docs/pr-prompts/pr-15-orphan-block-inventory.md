# PR-15 Phase 1 — Orphan Quote-Preview Block Inventory

Generated 2026-05-29.

Reality vs the PR-15 prompt: PR #254 already removed more of the orphan
preview block than the prompt assumed. The target file is no longer ~320
lines (it is 2,381 lines), the secondary tab strip and the "Recalculate"
button are already gone from source, and only one orphan artifact in the
prompt's description still exists. This note records what's there now and
the minimal cleanup plan.

## Files touched by this work

- `apps/web/src/pages/tendering/QuoteTab.tsx` — hosts the duplicate Edit
  button and Save/Cancel/Generate-Quote button bar.
- `apps/web/src/pages/tendering/ClientQuotesPanel.tsx` — holds the
  canonical Edit button on the version row and the canonical `QuoteEditor`
  with its single tab strip.
- `apps/web/src/pages/tendering/TenderDetailPage.tsx` — parent route, has
  its own outer "Overview / Scope of Works / Quote" tab strip; not in
  scope.

## Inventory of the three artifacts called out by the owner

### 1. Floating "Edit" button (orphan) — STILL PRESENT

- **File**: `apps/web/src/pages/tendering/QuoteTab.tsx`
- **Lines**: 73-112 (button bar wrapped in `{canManage && (...)}`),
  with the Edit button itself at lines 94-100.
- **Behaviour**: clicking it calls `setIsEditing(true)`, which hides the
  entire `ClientQuotesPanel` (via the `!isEditing` gate at line 65) and
  reveals Save/Cancel in its place. Save/Cancel then both just call
  `setIsEditing(false)` — no data flows through them.
- **Why this is orphan**: the canonical edit flow lives inside
  `ClientQuotesPanel.ClientRow` at lines 460-466 of
  `ClientQuotesPanel.tsx`. Clicking that Edit sets `selectedId`, which
  mounts `QuoteEditor` (with its own Cancel/Save and full tab strip)
  beneath the version row. The QuoteTab-level button bar is left over
  from a previous design where editing was a tab-level mode rather than a
  per-quote selection — it now sits next to the canonical Edit and does
  nothing useful.
- **Canonical Edit reference**: `ClientQuotesPanel.tsx` lines 460-466
  (inside `ClientRow`), and Save/Cancel buttons inside `QuoteEditor` are
  passed via `onSave` / `onCancel` props (lines 367-368 of
  `ClientQuotesPanel.tsx`).

### 2. "Recalculate" button — ALREADY GONE

- `Grep` for `Recalculate` / `recalculate` across `apps/web/src/` returns
  no matches. The only hits across the repo are inside `docs/` and
  `progress.md` / `roadmap.md`. PR #255 (which made the cost summary
  auto-recompute on input) appears to have removed the button at the
  same time it removed the manual trigger.
- **No source change required for Phase 3.** Will document the no-op and
  move on.

### 3. Secondary tab strip (Cost Summary | Assumptions | Exclusions | T&C | Generate Quote) — ALREADY GONE

- The only `tabs.map(...)` call in `ClientQuotesPanel.tsx` is the
  canonical one at line 699 (inside `QuoteEditor`). It iterates the
  canonical 8-entry `tabs` array defined at lines 662-671: Cost Summary,
  Scope items, Provisional Sums, Cost Options, Assumptions, Exclusions,
  Terms & Conditions, Preview.
- No `<nav>` wrapper or secondary tab buttons remain in
  `ClientQuotesPanel.tsx` or `QuoteTab.tsx`.
- The "Generate Quote" affordance now lives as a header button in
  `QuoteTab.tsx` (lines 101-108) and as the dedicated
  `GenerateQuoteSection` (lines 295-444) that toggles via
  `setShowGenerate`. No tab.
- **No source change required for Phase 4 or for the "delete the
  secondary tab strip" half of Phase 5.** Will document the no-op.

## Removal plan per phase

| Phase | Artifact | Action |
|---|---|---|
| 2 | Floating Edit button in `QuoteTab.tsx` (lines 73-112) | Delete the whole `{canManage && (...)}` button bar. Move the "Generate Quote" button into the canonical version-row group (or keep it standalone but without the orphan Edit). Drop `isEditing` state + the Save/Cancel arm. |
| 3 | "Recalculate" button | No-op — already removed by PR #255. Will record this in the phase-3 commit. |
| 4 | Hide secondary preview block during edit mode | No-op — no secondary preview block remains in source. `QuoteEditor` is itself the single editor and only mounts when `selectedId !== null`. Will record this in the phase-4 commit. |
| 5 | Consolidate view-mode tab strip onto canonical | No-op for "delete secondary strip". The canonical strip already includes T&C (added in PR #252). One real cleanup: the QuoteTab `isEditing` state needs to disappear with Phase 2, and ClientQuotesPanel's `onEditingChange` prop becomes dead (currently QuoteTab does not pass it anyway). Will tidy these in Phase 5. |

## Notes for execution

1. The Generate Quote button in QuoteTab.tsx (lines 101-108) is real and
   used — keep it. Currently it sits inside the same `<div>` as the
   orphan Edit/Save/Cancel buttons. Phase 2 will pull it into its own
   small bar so the orphan Edit can go.
2. The `useState<boolean>('isEditing')` hook at line 55 of QuoteTab.tsx
   exists only to drive the orphan button bar's Save/Cancel arm and the
   `!isEditing` gate at line 65 that hides ClientQuotesPanel. Since
   ClientQuotesPanel manages its own selection via `selectedId`, the
   `isEditing` gate is also vestigial — removing it lets the version row
   stay visible while the editor is open beneath it, which is what the
   canonical design wants.
3. `ClientQuotesPanel`'s `onEditingChange?: (editing: boolean) => void`
   prop (declared line 132, fired in the effect at lines 189-191) is
   currently passed `undefined` by QuoteTab. Remove the prop in Phase 5
   along with the effect.
