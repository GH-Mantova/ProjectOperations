// SCOPE_SUB_TAB_V1 — "what work does this subcontract line cover?"
//
// scope-subcontracted slice 5. Slice 4 shipped `pricedBySubItemId`, the two
// endpoints that set and clear it, and the double-count guard that reads it
// (SUB_LINE_PRICES_LINKED_ITEM in scope-redesign.service.ts). Not one of them
// was reachable from the screen: there was no control anywhere in the web app
// that could write the field. This file is that control.
//
// THE TWO STATES OF A SUB LINE. A subcontract line either describes its own
// scope in words — "traffic management for the duration" — or it prices work
// that is already written down as WBS items on the DEM / CIV / ASB tabs. The
// second is the interesting one and the dangerous one: the moment a SUB line
// covers DEM1.2, DEM1.2's own labour and plant must stop counting, or the
// tender pays for the same demolition twice. Slice 4 made that true on the
// server. This picker is how an estimator says it.
//
// WHAT IS OFFERED. Every item on the SAME TENDER, grouped by discipline, each
// carrying its current price — because linking is a decision about money and
// the estimator is entitled to see what they are about to move before they
// move it. Items already linked to ANOTHER SUB line are not offered: they are
// spoken for, and offering them would invite a link that silently re-homes
// another line's work.
//
// PERSISTENCE. Nothing here is local. `onLink` and `onUnlink` are wired by
// ScopeQuantitiesTable to slice 4's own routes:
//   POST   /tenders/:tenderId/scope/items/:itemId/sub-link   { subItemId }
//   DELETE /tenders/:tenderId/scope/items/:itemId/sub-link
// No API route, service method, DTO or schema field is added, changed or
// removed by this slice — it is web-only.
//
// NO MONEY IS COMPUTED HERE. Every figure this file prints came off the wire
// as `lineTotalWithMarkup`; `subMoney` formats it and nothing multiplies.

import type { CSSProperties } from "react";
import { DISCIPLINE_CODES, DISCIPLINE_LABELS, subMoney } from "./utils/card-display";

/**
 * The shape this picker needs from a scope item. A deliberate subset of
 * `ScopeItem` plus the parent card's discipline, which the item read carries
 * on `card.discipline` and which ScopeQuantitiesTable flattens on the way in.
 * Declaring the subset rather than importing ScopeItem keeps the picker
 * renderable from a test with four fields instead of forty.
 */
export type SubLinkableItem = {
  id: string;
  wbsCode: string;
  description: string;
  discipline: string;
  status?: string;
  /** Server figure. Never recomputed here — only formatted. */
  lineTotalWithMarkup?: number | string | null;
  /** The SUB line that prices this item's work, or null. */
  pricedBySubItemId?: string | null;
};

/** The sentinel the "add a link" select sits on; it is never a real item id. */
export const NO_LINK_VALUE = "__none__";

/** Numbers arrive from the API as Decimal strings. */
function toAmount(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * The items a SUB line may be linked to.
 *
 * Three exclusions, each for its own reason:
 *
 *  1. SUB-discipline items. A subcontract line's price is its selected quote
 *     (slice 4, Rule B); pointing one at another would nest two quote-priced
 *     lines and mean nothing. The prompt's own words: "links it to WBS items
 *     on the OTHER tabs".
 *  2. Excluded items. They are out of the tender; covering them moves no money.
 *  3. Items that already carry a `pricedBySubItemId`. An item already linked —
 *     to this line or to any other — is spoken for. Offering one linked
 *     elsewhere would let a second SUB line silently take over the first's
 *     work; offering one linked HERE would duplicate what the linked list
 *     above the select already shows.
 */
export function linkCandidatesForSubLine(items: readonly SubLinkableItem[]): SubLinkableItem[] {
  return items.filter(
    (it) => it.discipline !== "SUB" && it.status !== "excluded" && it.pricedBySubItemId == null
  );
}

/** The items this SUB line already covers. */
export function linkedItemsForSubLine(
  items: readonly SubLinkableItem[],
  subLineId: string
): SubLinkableItem[] {
  return items.filter((it) => it.pricedBySubItemId === subLineId);
}

/**
 * Candidates folded into discipline groups, in the canonical discipline order
 * (DISCIPLINE_CODES — the same tuple the tabs are built from), so the select's
 * optgroups match the tab strip rather than whatever order the API returned.
 */
export function groupCandidatesByDiscipline(
  candidates: readonly SubLinkableItem[]
): Array<{ discipline: string; label: string; items: SubLinkableItem[] }> {
  const byDiscipline = new Map<string, SubLinkableItem[]>();
  for (const c of candidates) {
    const bucket = byDiscipline.get(c.discipline);
    if (bucket) bucket.push(c);
    else byDiscipline.set(c.discipline, [c]);
  }
  const ordered: Array<{ discipline: string; label: string; items: SubLinkableItem[] }> = [];
  for (const code of DISCIPLINE_CODES) {
    const items = byDiscipline.get(code);
    if (items && items.length > 0) {
      ordered.push({ discipline: code, label: DISCIPLINE_LABELS[code] ?? code, items });
      byDiscipline.delete(code);
    }
  }
  // Anything the canonical tuple does not name still gets offered rather than
  // silently dropped — a discipline added to the DB before the tuple catches up
  // must not make its items invisible to the picker.
  for (const [code, items] of byDiscipline) {
    ordered.push({ discipline: code, label: DISCIPLINE_LABELS[code] ?? code, items });
  }
  return ordered;
}

/**
 * One line of the offer: `DEM1.2 — Strip out internal walls · $12,400.00`.
 * The price is the point — it is what moves onto this SUB line.
 */
export function candidateOptionLabel(item: SubLinkableItem): string {
  return `${item.wbsCode} — ${item.description} · ${subMoney(toAmount(item.lineTotalWithMarkup))}`;
}

const rowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0
};

const mutedStyle: CSSProperties = {
  fontSize: 12,
  color: "var(--text-muted)"
};

const linkedChipStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "3px 8px",
  borderRadius: "var(--radius-sm)",
  background: "var(--surface-subtle)",
  border: "1px solid var(--border-default)",
  fontSize: 12,
  color: "var(--text-secondary)",
  maxWidth: "100%"
};

const codeStyle: CSSProperties = {
  fontFamily: "ui-monospace, monospace",
  fontWeight: 600,
  whiteSpace: "nowrap"
};

const descStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  minWidth: 0
};

const moneyStyle: CSSProperties = {
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap"
};

/**
 * SCOPE_SUB_TAB_V1 — the link control for one SUB line.
 *
 * Presentational and auth-free, so the suite can render it directly with
 * renderToStaticMarkup (the workspace has no jsdom); every write goes back up
 * through `onLink` / `onUnlink` to ScopeQuantitiesTable, which owns authFetch.
 */
export function SubLinkPicker({
  subLineId,
  subLineWbsCode,
  items,
  disabled = false,
  onLink,
  onUnlink
}: {
  subLineId: string;
  /** e.g. "SUB1.1" — named in the empty state so the control says whose it is. */
  subLineWbsCode: string;
  /** Every item on the tender. Filtering is this file's job, not the caller's. */
  items: readonly SubLinkableItem[];
  disabled?: boolean;
  onLink: (itemId: string) => void;
  onUnlink: (itemId: string) => void;
}) {
  const linked = linkedItemsForSubLine(items, subLineId);
  const groups = groupCandidatesByDiscipline(linkCandidatesForSubLine(items));

  return (
    <div
      data-testid="sub-link-picker"
      data-sub-line={subLineWbsCode}
      style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
    >
      <span className="s7-type-label" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}>
        Work this line covers
      </span>

      {linked.length === 0 ? (
        <p style={{ ...mutedStyle, margin: 0 }} data-testid="sub-link-own-scope">
          {subLineWbsCode} describes its own scope. Link a WBS item below and its labour and
          plant stop counting on its own tab — the quote covers them here instead.
        </p>
      ) : (
        <div style={rowStyle} data-testid="sub-link-linked-list">
          {linked.map((it) => (
            <span key={it.id} style={linkedChipStyle} data-testid="sub-link-linked-item">
              <span style={codeStyle}>{it.wbsCode}</span>
              <span style={descStyle} title={it.description}>
                {it.description}
              </span>
              <span style={moneyStyle}>{subMoney(toAmount(it.lineTotalWithMarkup))}</span>
              <button
                type="button"
                className="s7-btn s7-btn--ghost s7-btn--sm"
                disabled={disabled}
                aria-label={`Unlink ${it.wbsCode} from ${subLineWbsCode}`}
                title={`${it.wbsCode} goes back to pricing its own labour and plant`}
                onClick={() => onUnlink(it.id)}
                style={{ fontSize: 11, padding: "1px 5px" }}
              >
                Unlink
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={rowStyle}>
        <select
          className="s7-input"
          value={NO_LINK_VALUE}
          disabled={disabled || groups.length === 0}
          aria-label={`Link a WBS item to ${subLineWbsCode}`}
          title="Every item on this tender that no subcontract line is already pricing"
          style={{ height: 28, minWidth: 260, maxWidth: "100%" }}
          onChange={(e) => {
            const value = e.target.value;
            if (value === NO_LINK_VALUE) return;
            onLink(value);
          }}
        >
          <option value={NO_LINK_VALUE}>
            {groups.length === 0 ? "No unlinked items on this tender" : "+ Link a WBS item…"}
          </option>
          {groups.map((group) => (
            <optgroup key={group.discipline} label={`${group.discipline} — ${group.label}`}>
              {group.items.map((it) => (
                <option key={it.id} value={it.id}>
                  {candidateOptionLabel(it)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    </div>
  );
}
