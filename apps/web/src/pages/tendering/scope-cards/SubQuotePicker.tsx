// SCOPE_SUB_TAB_V1 — the quotes received against one subcontract line.
//
// scope-subcontracted slice 5. Slice 4 shipped the `SubLineQuote` table, the
// partial unique index that allows exactly one selected quote per line, and
// the five routes below; none of it had a screen. This is the screen.
//
// WHY LOSING QUOTES ARE KEPT. A subcontract line does not have "a price", it
// has a market: three quotes for the same demolition, one of which the
// estimator carries into the tender. Deleting the other two would throw away
// the only evidence of what the chosen one is worth — so every quote stays,
// and every unselected row states its DELTA against the selected one
// (`+$4,200`, `-$1,150`). The reason to keep losing quotes is to see the
// spread; a table of three absolute figures makes the reader do the
// subtraction, which is the one thing a screen is for.
//
// SELECTION IS THE PRICE. Slice 4, Rule B: a SUB line prices at the amount of
// the quote where `isSelected`, and at zero when none is selected. That zero
// is not "free", it is "not decided yet", so a line holding quotes with none
// chosen says so in words — the same way CuttingSection says a row still
// needs a rig picked before the server can price it. No new alert pattern.
//
// THE SUPPLIER PICKER IS NOT NEW. It is `RateLibraryItemPicker`, imported from
// OtherOperationalCosts.tsx, which pr-cardui-s6 built as a standalone named
// export with no operational-cost vocabulary in its props precisely so that
// this file could use it. The approved mock-up's own comment: "One picker,
// used by both Other operational costs and a subcontract quote." A second
// picker here is a picker that can drift from that one, so there is not one.
// The consumer names its own rows through `ariaLabelPrefix`, and the prefix
// this file passes — "Item for subcontract quote row N" — is the string
// other-operational-costs.test.tsx already pins.
//
// PERSISTENCE. Every field is a column on `sub_line_quotes` behind slice 4's
// routes, wired by ScopeQuantitiesTable:
//   GET    /tenders/:tenderId/scope/items/:itemId/quotes
//   POST   /tenders/:tenderId/scope/items/:itemId/quotes
//   PATCH  /tenders/:tenderId/scope/quotes/:quoteId
//   DELETE /tenders/:tenderId/scope/quotes/:quoteId
//   POST   /tenders/:tenderId/scope/quotes/:quoteId/select
// No API route, service method, DTO or schema field is added, changed or
// removed by this slice — it is web-only.
//
// NO UPLOAD CONTROL. The magnifier attaches an EXISTING TenderDocumentLink,
// picked from the tender's own documents. Uploading belongs to
// TenderDocumentsPanel and stays there.

import { useState } from "react";
import type { CSSProperties } from "react";
import { RateLibraryItemPicker, type RateLibraryItem } from "./OtherOperationalCosts";
import { subMoney } from "./utils/card-display";

/** One row of `sub_line_quotes`, exactly as slice 4's routes return it. */
export type SubLineQuote = {
  id: string;
  scopeItemId: string;
  subcontractorSupplierId: string | null;
  supplierNameFallback: string | null;
  /** Decimal(12,2) — arrives over the wire as a string. */
  amount: string | number;
  isSelected: boolean;
  receivedAt: string | null;
  notes: string | null;
  tenderDocumentLinkId: string | null;
};

/** Mirrors UpdateSubLineQuoteDto. Nothing here is a field the DTO does not take. */
export type SubLineQuotePatch = {
  subcontractorSupplierId?: string | null;
  supplierNameFallback?: string | null;
  amount?: number;
  receivedAt?: string | null;
  notes?: string | null;
  tenderDocumentLinkId?: string | null;
};

/** One of the tender's existing documents, offered by the magnifier. */
export type QuoteDocumentOption = {
  id: string;
  title: string;
};

/** The magnifier's "no document" sentinel; never a real TenderDocumentLink id. */
export const NO_DOCUMENT_VALUE = "__no_document__";

// ── Pure helpers (the numeric claims of this slice live here) ───────────

/** Decimal-string tolerant. */
export function quoteAmount(quote: Pick<SubLineQuote, "amount">): number {
  const n = typeof quote.amount === "number" ? quote.amount : Number(quote.amount);
  return Number.isFinite(n) ? n : 0;
}

/** The one quote carrying the line's price, or null when nobody has chosen. */
export function selectedSubLineQuote(quotes: readonly SubLineQuote[]): SubLineQuote | null {
  return quotes.find((q) => q.isSelected) ?? null;
}

/**
 * What this quote costs ABOVE (or below) the one the tender is carrying.
 *
 * `null` for the selected row itself — it is the baseline, and a baseline has
 * no delta — and `null` for every row while nothing is selected, because
 * "cheaper than what?" has no answer yet. Re-basing is automatic: the delta is
 * a function of the current selection, so choosing a different quote re-bases
 * every other row in the same render.
 */
export function quoteDeltaAgainstSelected(
  quote: SubLineQuote,
  quotes: readonly SubLineQuote[]
): number | null {
  const selected = selectedSubLineQuote(quotes);
  if (!selected) return null;
  if (selected.id === quote.id) return null;
  return quoteAmount(quote) - quoteAmount(selected);
}

/**
 * `+$4,200` / `-$1,150`. Whole dollars and an explicit sign, because the
 * figure is a comparison and its direction is the whole message. An exact tie
 * reads `same`, which is a statement; `+$0` is not.
 */
export function formatQuoteDelta(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return "—";
  if (Math.round(delta) === 0) return "same";
  const magnitude = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(Math.abs(delta));
  return `${delta > 0 ? "+" : "-"}${magnitude}`;
}

/**
 * The incomplete state: quotes have been received and none has been chosen.
 *
 * Slice 4 prices this line at zero. A bare zero in a money column reads as
 * "this work is free"; it is not free, it is undecided, and the difference is
 * a tender that goes out under-priced.
 */
export function subLineHasUnselectedQuotes(quotes: readonly SubLineQuote[]): boolean {
  return quotes.length > 0 && selectedSubLineQuote(quotes) === null;
}

/** The words that say it. Read by the section note and pinned by the suite. */
export function subLineIncompleteNote(quotes: readonly SubLineQuote[]): string {
  const n = quotes.length;
  return (
    `${n} quote${n === 1 ? "" : "s"} received and none selected — this line prices at ` +
    `${subMoney(0)} until one is chosen. Pick the quote the tender carries.`
  );
}

/**
 * The subcontractor directory, in the shape the SHARED picker takes.
 *
 * `RateLibraryItemPicker` speaks of an id, a label and a category and knows
 * nothing about what a row is; that is exactly why it can serve both this and
 * Other operational costs. Suppliers map straight onto it: the directory id is
 * the id, the vendor name is the label, and the vendor's first category groups
 * the list. `unit` and `rate` are carried because the type declares them; the
 * picker reports them back through `onPick` and this file ignores both — a
 * supplier has no unit and no day rate, and inventing one would be money.
 */
export function supplierPickerOptions(
  suppliers: readonly {
    id: string;
    name: string;
    categories?: string[] | null;
    isActive?: boolean;
  }[]
): RateLibraryItem[] {
  return suppliers.map((s) => ({
    id: s.id,
    item: s.name,
    unit: "",
    rate: 0,
    isActive: s.isActive,
    category: s.categories && s.categories.length > 0 ? s.categories[0] : "Subcontractors"
  }));
}

/** `2026-03-14T00:00:00.000Z` → `2026-03-14`, for `<input type="date">`. */
export function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const at = iso.indexOf("T");
  return at === -1 ? iso : iso.slice(0, at);
}

// ── Presentation ───────────────────────────────────────────────────────

const tableStyle: CSSProperties = {
  width: "100%",
  tableLayout: "auto",
  borderCollapse: "collapse",
  fontSize: 12
};

const headStyle: CSSProperties = {
  padding: "4px 6px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border-default)",
  whiteSpace: "nowrap",
  width: "1%"
};

/** Notes take the slack; everything else fits its contents (Marco's rule). */
const headWideStyle: CSSProperties = { ...headStyle, width: "auto" };

const cellStyle: CSSProperties = {
  padding: "4px 6px",
  borderTop: "1px solid var(--border-default)",
  verticalAlign: "top"
};

const fitCellStyle: CSSProperties = { ...cellStyle, width: "1%", whiteSpace: "nowrap" };

/**
 * The money columns get a floor so the table does not twitch sideways as
 * quotes are added and the widest figure changes — the same standing layout
 * rule the WBS table follows. Never a fixed width: a long figure must still
 * grow its column rather than spill out of it.
 */
const moneyCellStyle: CSSProperties = {
  ...fitCellStyle,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
  minWidth: 96
};

const deltaCellStyle: CSSProperties = { ...moneyCellStyle, minWidth: 84 };

const mutedStyle: CSSProperties = { color: "var(--text-muted)" };

/**
 * One quote. Split out so the magnifier can hold its own open/shut state
 * without the whole section re-rendering, and so the suite can render a single
 * row.
 */
export function SubQuoteRow({
  quote,
  quotes,
  rowIndex,
  supplierOptions,
  documentOptions,
  disabled = false,
  onPatch,
  onSelect,
  onRemove
}: {
  quote: SubLineQuote;
  /** The whole set — the delta is a statement about the row's neighbours. */
  quotes: readonly SubLineQuote[];
  /** 1-based, and it is what names this row to assistive tech. */
  rowIndex: number;
  supplierOptions: readonly RateLibraryItem[];
  documentOptions: readonly QuoteDocumentOption[];
  disabled?: boolean;
  onPatch: (quoteId: string, patch: SubLineQuotePatch) => void;
  onSelect: (quoteId: string) => void;
  onRemove: (quoteId: string) => void;
}) {
  const [documentPickerOpen, setDocumentPickerOpen] = useState(false);
  const delta = quoteDeltaAgainstSelected(quote, quotes);
  const attached = documentOptions.find((d) => d.id === quote.tenderDocumentLinkId) ?? null;
  // The prefix pr-cardui-s6 pinned. Changing it breaks the contract test that
  // guards the shared picker against a second implementation growing here.
  const ariaLabelPrefix = `Item for subcontract quote row ${rowIndex}`;

  return (
    <tr
      data-testid="sub-quote-row"
      data-quote-id={quote.id}
      data-selected={quote.isSelected ? "true" : "false"}
      style={quote.isSelected ? { background: "var(--surface-subtle)" } : undefined}
    >
      <td style={fitCellStyle}>
        <input
          type="radio"
          name={`sub-quote-selected-${quote.scopeItemId}`}
          checked={quote.isSelected}
          disabled={disabled}
          aria-label={`Carry quote row ${rowIndex} into the tender`}
          title="The tender carries the selected quote. Exactly one per subcontract line."
          onChange={() => onSelect(quote.id)}
        />
      </td>

      <td style={cellStyle}>
        {/* THE SHARED PICKER. Not forked, not re-implemented — imported. */}
        <RateLibraryItemPicker
          selectedId={quote.subcontractorSupplierId}
          description={quote.supplierNameFallback ?? ""}
          options={supplierOptions}
          disabled={disabled}
          ariaLabelPrefix={ariaLabelPrefix}
          onPick={(picked) =>
            onPatch(
              quote.id,
              picked
                ? // A directory vendor supersedes any name typed while it was
                  // missing; leaving the fallback behind would give the row two
                  // names and no way to tell which one the quote came from.
                  { subcontractorSupplierId: picked.plantRateId, supplierNameFallback: null }
                : { subcontractorSupplierId: null }
            )
          }
          onDescriptionChange={(description) =>
            onPatch(quote.id, { supplierNameFallback: description })
          }
        />
      </td>

      <td style={moneyCellStyle}>
        <input
          className="s7-input"
          type="number"
          min={0}
          step="0.01"
          defaultValue={quoteAmount(quote)}
          disabled={disabled}
          aria-label={`Amount for subcontract quote row ${rowIndex}`}
          style={{ width: 96, textAlign: "right", padding: "2px 6px" }}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next) || next === quoteAmount(quote)) return;
            onPatch(quote.id, { amount: next });
          }}
        />
      </td>

      {/* The spread. `—` on the selected row: it IS the baseline. */}
      <td style={deltaCellStyle} data-testid="sub-quote-delta">
        <span
          style={
            delta === null || Math.round(delta) === 0
              ? mutedStyle
              : { color: delta > 0 ? "var(--status-danger)" : "var(--status-active)" }
          }
          title={
            delta === null
              ? "Select a quote and every other row states its difference against it"
              : `Against the selected quote`
          }
        >
          {formatQuoteDelta(delta)}
        </span>
      </td>

      <td style={fitCellStyle}>
        <input
          className="s7-input"
          type="date"
          defaultValue={toDateInputValue(quote.receivedAt)}
          disabled={disabled}
          aria-label={`Date received for subcontract quote row ${rowIndex}`}
          style={{ padding: "2px 6px" }}
          onBlur={(e) => {
            const v = e.target.value;
            onPatch(quote.id, { receivedAt: v === "" ? null : v });
          }}
        />
      </td>

      <td style={cellStyle}>
        <input
          className="s7-input"
          type="text"
          defaultValue={quote.notes ?? ""}
          disabled={disabled}
          maxLength={2000}
          placeholder="Notes"
          aria-label={`Notes for subcontract quote row ${rowIndex}`}
          style={{ width: "100%", minWidth: 140, padding: "2px 6px" }}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v === (quote.notes ?? "")) return;
            onPatch(quote.id, { notes: v === "" ? null : v });
          }}
        />
      </td>

      {/* The magnifier. Attaches an EXISTING tender document; never uploads. */}
      <td style={fitCellStyle}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={disabled}
            aria-expanded={documentPickerOpen}
            aria-label={`Attach a tender document to subcontract quote row ${rowIndex}`}
            title="Attach one of this tender's documents as the quote file"
            onClick={() => setDocumentPickerOpen((open) => !open)}
            style={{ fontSize: 12, padding: "2px 6px" }}
          >
            🔍
          </button>
          {attached ? (
            <span
              style={{ fontSize: 11, color: "var(--text-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              title={attached.title}
              data-testid="sub-quote-attached-document"
            >
              {attached.title}
            </span>
          ) : null}
          {documentPickerOpen ? (
            <select
              className="s7-input"
              value={quote.tenderDocumentLinkId ?? NO_DOCUMENT_VALUE}
              disabled={disabled}
              aria-label={`Tender document for subcontract quote row ${rowIndex}`}
              style={{ height: 26, maxWidth: 200 }}
              onChange={(e) => {
                const value = e.target.value;
                onPatch(quote.id, {
                  tenderDocumentLinkId: value === NO_DOCUMENT_VALUE ? null : value
                });
                setDocumentPickerOpen(false);
              }}
            >
              <option value={NO_DOCUMENT_VALUE}>No document attached</option>
              {documentOptions.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.title}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </td>

      <td style={fitCellStyle}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={disabled}
          aria-label={`Remove subcontract quote row ${rowIndex}`}
          title="Delete this quote"
          onClick={() => onRemove(quote.id)}
          style={{ color: "var(--status-danger)", fontSize: 11, padding: "2px 4px" }}
        >
          Remove
        </button>
      </td>
    </tr>
  );
}

/**
 * SCOPE_SUB_TAB_V1 — the quote table for one SUB line.
 *
 * Presentational and auth-free (the workspace has no jsdom, so the suite
 * renders it with renderToStaticMarkup); every write goes back up to
 * ScopeQuantitiesTable, which owns authFetch and slice 4's routes.
 */
export function SubQuotePicker({
  subLineWbsCode,
  quotes,
  supplierOptions,
  documentOptions,
  disabled = false,
  loading = false,
  error = null,
  onPatch,
  onSelect,
  onRemove,
  onAdd
}: {
  subLineWbsCode: string;
  quotes: readonly SubLineQuote[];
  supplierOptions: readonly RateLibraryItem[];
  documentOptions: readonly QuoteDocumentOption[];
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  onPatch: (quoteId: string, patch: SubLineQuotePatch) => void;
  onSelect: (quoteId: string) => void;
  onRemove: (quoteId: string) => void;
  onAdd: () => void;
}) {
  const incomplete = subLineHasUnselectedQuotes(quotes);

  return (
    <div
      data-testid="sub-quote-picker"
      data-sub-line={subLineWbsCode}
      data-incomplete={incomplete ? "true" : "false"}
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <span
        className="s7-type-label"
        style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}
      >
        Quotes received
      </span>

      {error ? (
        <p style={{ fontSize: 12, color: "var(--status-danger)", margin: 0 }}>{error}</p>
      ) : null}

      {loading ? (
        <p style={{ fontSize: 12, ...mutedStyle, margin: 0 }}>Loading quotes…</p>
      ) : quotes.length === 0 ? (
        <p style={{ fontSize: 12, ...mutedStyle, margin: 0 }} data-testid="sub-quote-empty">
          No quotes recorded against {subLineWbsCode} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto", maxWidth: "100%" }}>
          <table style={tableStyle} aria-label={`Quotes for ${subLineWbsCode}`}>
            <thead>
              <tr>
                <th style={headStyle} title="The tender carries the selected quote">
                  Use
                </th>
                <th style={headStyle}>Supplier</th>
                <th style={{ ...headStyle, textAlign: "right" }}>Amount</th>
                <th style={{ ...headStyle, textAlign: "right" }} title="Difference against the selected quote">
                  vs selected
                </th>
                <th style={headStyle}>Received</th>
                <th style={headWideStyle}>Notes</th>
                <th style={headStyle}>Quote file</th>
                <th style={headStyle} />
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote, index) => (
                <SubQuoteRow
                  key={quote.id}
                  quote={quote}
                  quotes={quotes}
                  rowIndex={index + 1}
                  supplierOptions={supplierOptions}
                  documentOptions={documentOptions}
                  disabled={disabled}
                  onPatch={onPatch}
                  onSelect={onSelect}
                  onRemove={onRemove}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* The incomplete state, in the section's own words rather than a new
          alert pattern — CuttingSection says "still needs a rig picked" the
          same way, in the same place, in the same muted type. */}
      {incomplete ? (
        <p
          style={{ fontSize: 12, ...mutedStyle, margin: 0 }}
          data-testid="sub-quote-incomplete-note"
        >
          {subLineIncompleteNote(quotes)}
        </p>
      ) : null}

      <div>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={disabled}
          onClick={onAdd}
          style={{ fontSize: 11, padding: "2px 8px" }}
        >
          + Add quote
        </button>
      </div>
    </div>
  );
}
