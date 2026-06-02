# PR-13 Tab Merge Inventory

## Problem

`QuoteTab.tsx` renders a sub-tab strip (`QUOTE_SUB_TABS`) that is always visible alongside
`ClientQuotesPanel.tsx`'s editor tabs. This creates a duplicate tab experience for the user.

## Existing tab list (canonical — in `ClientQuotesPanel.tsx`)

- **Variable**: `tabs` array (line ~661) of type `EditorTab`
- **State**: `editorTab` / `setEditorTab` (line 140, passed down as `onTabChange`)
- **Render**: lines 689–719 — `<div>` with map over `tabs`
- **EditorTab type**: `"cost" | "scope" | "provisional" | "options" | "assumptions" | "exclusions" | "tandc" | "preview"`

| Tab key | Label | Content render line |
|---------|-------|---------------------|
| cost | Cost Summary | 721–730 (`CostTab`) |
| scope | Scope items | 733–741 (`QuoteScopeTab`) |
| provisional | Provisional Sums | 743–752 (`ProvisionalTab`) |
| options | Cost Options | 754–763 (`OptionsTab`) |
| assumptions | Assumptions | 765–775 (`AssumptionsTab`) |
| exclusions | Exclusions | 777–786 (`ExclusionsTab`) |
| preview | Preview | 788–796 (`PreviewTab`) |

Note: `"tandc"` exists in `EditorTab` type but is NOT in the `tabs` array — it was never wired up.

## Duplicate tab strip (in `QuoteTab.tsx`)

- **Variable**: `QUOTE_SUB_TABS` array (line 76) — `["Cost Summary", "Assumptions", "Exclusions", "Terms & Conditions", "Generate Quote"]`
- **State**: `activeSubTab` / `setActiveSubTab` (line 99)
- **Render**: lines 186–211 — `<nav role="tablist">`

| Tab | Content render | Component |
|-----|----------------|-----------|
| Cost Summary | line 213–220 | `CostSummarySection` (local, read-only summary view) |
| Assumptions | line 222–230 | `TextListSection` (kind="assumptions") |
| Exclusions | line 232–240 | `TextListSection` (kind="exclusions") |
| Terms & Conditions | line 242–244 | `TandCSection` |
| Generate Quote | line 246–253 | `GenerateQuoteSection` |

## Merge plan

The `QuoteTab.tsx` sub-tabs are a **read-only overview** layer that should NOT co-exist with the
per-quote editor tabs in `ClientQuotesPanel.tsx`. The fix:

1. **Cost Summary** (QuoteTab): read-only tender-level summary. Keep as-is — it doesn't conflict
   because it shows TENDER scope totals, while the editor `CostTab` shows per-QUOTE cost lines.
   However, the duplicate visual appearance confuses users. → **Hide the QuoteTab sub-tab strip
   when a quote is selected for editing** (i.e., when `ClientQuotesPanel` has an active editor open).

2. **Assumptions** (QuoteTab): `TextListSection` — this is a TENDER-level assumptions list, different
   from the per-quote `AssumptionsTab` in the editor. Same visual confusion. → Hide when editing.

3. **Exclusions** (QuoteTab): Same as Assumptions. → Hide when editing.

4. **Terms & Conditions** (QuoteTab): `TandCSection` — tender-level T&C. The editor already has the
   `"tandc"` key in its type but never rendered it. → Add `Terms & Conditions` to the editor's
   `tabs` array and wire it to the existing `TandCSection` or similar component. Then hide the
   QuoteTab strip when editing.

5. **Generate Quote** (QuoteTab): PDF/Excel generation. → Move to a button in the
   `ClientQuotesPanel` header area (visible when a quote is selected but not necessarily editing).

## Simplified approach

Since the `QuoteTab.tsx` sub-tabs are a tender-level view and `ClientQuotesPanel` is a per-quote
editor, the simplest fix is:

- **Hide the `QuoteTab.tsx` sub-tab strip when `ClientQuotesPanel` has a quote open for editing.**
- **Add "Terms & Conditions" to the editor tabs array** (it's already in the type).
- **Move "Generate Quote" into the quote card actions** or a button in the editor header.

This avoids complex content merging — the two tab strips serve different purposes (tender-level vs
quote-level) and shouldn't be visible simultaneously.
