// CUTTING_ONE_SURFACE_V1 (scopecards-s6) — one concrete cutting section.
// CUTTING_IN_THE_FOLD_V1 (scopecards-s7b) — cutting joins the card fold on
// the same terms as every other section.
//
// Scopecards S6 collapses the two-surface situation (read-only take-off +
// editable Cutrite sheet) into a single editor that carries the mock-up's full
// column set. CuttingSection.tsx (the read-only take-off) is deleted; this
// file is the only cutting surface on the card.
//
// S7b upgrades the upward report from a single number at cost to the same
// { subtotal, withMarkup } pair used by every other section, and filters the
// price slice (PRICE or null destination only) before reporting upward.
// The visible section subtotal on the sheet continues to count ALL rows —
// the sheet is the estimator's cutting worksheet, and Internal-only rows
// must still appear in the total the estimator sees. Only what is reported
// upward to ScopeCardsTab.statsByCard is the price slice.
//
// The approved mock-up's column order:
//   Goes to | From | Type | Description | Equipment | Elevation | Material |
//   Depth | O | Qty | Method | Rate | Markup | Total | actions
//
// All three item types (saw-cut, core-hole, other-rate) render in one table.
// A cell a row type does not use is shown muted with an em-dash — never dropped
// — so the columns stay aligned. The three-tab UI is replaced by a single table.
//
// SHIFT / SHIFTLOADING are stored in the model, accepted by the DTO, and
// carried into the estimate export — but the mock-up has no shift column and no
// shift step. Night-shift and weekend cutting premiums are entered under
// "other rates", not as a shift loading on the cutting line (Marco standing rule).
// The input and column are removed here; the fields remain on the type and DTO
// and the estimate export keeps printing what old tenders stored.
//
// Goes to, From and Markup: S2b, S1 and S3 own those columns. S6 renders their
// values from the fields the earlier slices stored; no new logic is added here.
//
// Every figure comes from the server. No rate is computed in this file.
// The section reports its price-slice totals upward via onSectionTotalChange so
// the fold in ScopeCardsTab.statsByCard stays correct.

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { readApiErrorMessage } from "../../lib/api-errors";
import { useAuth } from "../../auth/AuthContext";
import { useAlert, useConfirm } from "../../hooks/useConfirm";
import { NotesField } from "../../components";
import { SectionMarkupOverride, computeWithMarkup } from "./SectionMarkupOverride";
import {
  QuoteDestinationSelect,
  DESTINATION_ROW_CLASS,
  type QuoteDestination
} from "./scope-cards/QuoteDestinationSelect";
import { LineMarkupCell } from "./scope-cards/LineMarkupCell";

// CUTTING_ONE_SURFACE_V1 — scopecards-s6 sentinel. Grep-able by the gate.
export const CUTTING_ONE_SURFACE_V1 = "scopecards-s6";

// CUTTING_IN_THE_FOLD_V1 — scopecards-s7b sentinel. Grep-able by the gate.
export const CUTTING_IN_THE_FOLD_V1 = "scopecards-s7b";

/** Minimal shape of a cutting row for the price-slice fold. */
export type CuttingRowForFold = {
  quoteDestination?: string | null;
  lineTotal: string | null;
  lineTotalWithMarkup?: number | null;
};

/** The price-slice totals: sum of PRICE (or null) rows' lineTotal and
 *  lineTotalWithMarkup. Exported for unit tests; the component calls this
 *  via its priceTotals useMemo. */
export function computeCuttingPriceTotals(
  rows: CuttingRowForFold[]
): { subtotal: number; withMarkup: number } {
  let subtotal = 0;
  let withMarkup = 0;
  for (const row of rows) {
    const dest = row.quoteDestination ?? "PRICE";
    if (dest !== "PRICE") continue;
    const lt = row.lineTotal ? Number(row.lineTotal) : 0;
    const ltm = (row.lineTotalWithMarkup != null && Number.isFinite(row.lineTotalWithMarkup))
      ? row.lineTotalWithMarkup
      : lt;
    subtotal += lt;
    withMarkup += ltm;
  }
  return { subtotal, withMarkup };
}

type ItemType = "saw-cut" | "core-hole" | "other-rate";

type OtherRate = {
  id: string;
  description: string;
  unit: string;
  rate: string;
  isActive: boolean;
  sortOrder: number;
};

type CuttingItem = {
  id: string;
  tenderId: string;
  wbsRef: string;
  description: string | null;
  itemType: ItemType;
  equipment: string | null;
  elevation: string | null;
  material: string | null;
  depthMm: number | null;
  diameterMm: number | null;
  quantityLm: string | null;
  quantityEach: number | null;
  ratePerM: string | null;
  ratePerHole: string | null;
  lineTotal: string | null;
  lineTotalWithMarkup?: number | null;
  effectiveMarkup?: number | null;
  markupOverride?: number | null;
  quoteDestination?: QuoteDestination | null;
  // S1 source glyph — wbsRef of the scope item this row was copied from.
  // null for manually-added rows.
  sourceWbsRef?: string | null;
  method: string | null;
  otherRateId: string | null;
  otherRate: OtherRate | null;
  notes: string | null;
  sortOrder: number;
  // PR B4b — distinguishes rows created by Copy from above (regenerable)
  // from manually-added rows (preserved across regenerations).
  autoCopied: boolean;
  // DEPRECATED (scopecards-s6): shift and shiftLoading are stored in the
  // model and printed by the estimate export for legacy tenders, but the
  // mock-up has no shift column. Night-shift and weekend premiums are entered
  // under "other rates" per Marco's standing rule. Do not add new UI for these.
  shift?: string | null;
  shiftLoading?: string | null;
};

// Server-enforced per-equipment elevation and method allowlists.
// The options the dropdown offers are built from the priced API rows where
// available (section 3 of the S6 spec); these constants serve as the
// fallback for the add-item POST and for the equipment-change reset.
const SAW_EQUIPMENT = ["Roadsaw", "Demosaw", "Ringsaw", "Flush-cut", "Tracksaw"];
const ELEVATIONS = ["Floor", "Wall", "Inverted"];
// Roadsaw is Floor-only; Inverted only applies to core holes.
const ELEVATIONS_FOR_EQUIPMENT: Record<string, string[]> = {
  Roadsaw: ["Floor"],
  Demosaw: ["Floor", "Wall"],
  Ringsaw: ["Floor", "Wall"],
  "Flush-cut": ["Floor", "Wall"],
  Tracksaw: ["Floor", "Wall"]
};
const METHODS_BY_EQUIPMENT: Record<string, string[]> = {
  Roadsaw: ["Fuel", "Low-emission"],
  Demosaw: ["High-Freq", "Fuel"],
  Ringsaw: ["High-Freq", "Fuel"],
  "Flush-cut": ["High-Freq", "Fuel"],
  Tracksaw: ["Fuel"]
};
// Three categorical materials match the rate library's material column.
const SAW_MATERIALS = ["Asphalt", "Concrete", "Masonry"];
const CORE_DIAMETERS = [32, 50, 75, 100, 150, 200, 250, 300, 400, 500, 650];
const CORE_ELEVATIONS = ["Floor", "Wall", "Inverted"];

const EM_DASH = "—";

function fmt(n: string | number | null | undefined): string {
  if (n === null || n === undefined) return EM_DASH;
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v)) return EM_DASH;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(v);
}

function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined) return EM_DASH;
  if (!Number.isFinite(n)) return EM_DASH;
  return new Intl.NumberFormat("en-AU", { maximumFractionDigits: 2 }).format(n);
}

const mutedStyle: CSSProperties = { color: "var(--text-muted)" };
const cellPad: CSSProperties = { padding: "4px 6px", verticalAlign: "middle" };
const mutedCell: CSSProperties = { ...cellPad, ...mutedStyle };

export function ScopeCuttingSheet({
  tenderId,
  wbsRefs,
  canManage,
  cuttingNotes,
  onCuttingNotesChange,
  cardId,
  tenderMarkup,
  sectionMarkupOverride,
  onSectionMarkupChange,
  onSectionTotalChange
}: {
  tenderId: string;
  wbsRefs: string[];
  canManage: boolean;
  // PR B1.7 — shared notes block at the bottom of the table.
  // Persists to ScopeCard.cuttingNotes via PATCH /scope/cards/:cardId.
  cuttingNotes?: string | null;
  onCuttingNotesChange?: (value: string | null) => Promise<void> | void;
  // PR B4b — when supplied, the list is scoped server-side to this card
  // and the Copy-from-above button appears. Falls back to whole-tender +
  // client-side WBS filtering for legacy callers with no card in scope.
  cardId?: string;
  // Per-section markup override for this card's cutting subtable.
  // Independent cost stream from the scope-card markup.
  tenderMarkup?: number;
  sectionMarkupOverride?: number | null;
  onSectionMarkupChange?: (next: number | null) => Promise<void> | void;
  // CUTTING_IN_THE_FOLD_V1 (scopecards-s7b) — reports the price-slice of the
  // server's per-row totals upward so ScopeCardsTab.statsByCard stays correct.
  // Only PRICE or null destination rows are included in the reported figures;
  // the visible sheet subtotal still counts all rows (see file-top comment).
  // Shape matches operational-costs for consistency. Must be referentially stable.
  onSectionTotalChange?: (cardId: string, totals: { subtotal: number; withMarkup: number }) => void;
}) {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const alert = useAlert();
  const [items, setItems] = useState<CuttingItem[]>([]);
  const [otherRates, setOtherRates] = useState<OtherRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Force a reload when wbsRefs identity changes.
  const wbsKey = wbsRefs.join("|");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // PR B4b — per-card scoping.
      const itemsUrl = cardId
        ? `/tenders/${tenderId}/scope/cutting-items?cardId=${encodeURIComponent(cardId)}`
        : `/tenders/${tenderId}/scope/cutting-items`;
      const [itemsRes, ratesRes] = await Promise.all([
        authFetch(itemsUrl),
        authFetch(`/estimate-rates/other-rates`)
      ]);
      if (!itemsRes.ok) throw new Error(await readApiErrorMessage(itemsRes));
      setItems((await itemsRes.json()) as CuttingItem[]);
      if (ratesRes.ok) {
        const rates = (await ratesRes.json()) as OtherRate[];
        setOtherRates(rates.filter((r) => r.isActive));
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, cardId]);

  useEffect(() => {
    void load();
    // wbsKey intentionally re-triggers load so WBS changes from the parent
    // scope table propagate through any server-side cleanup.
  }, [load, wbsKey]);

  // Discipline inferred from the first WBS ref (e.g. ["DEM1","DEM2"] -> "DEM").
  const discipline = useMemo(() => {
    const first = wbsRefs[0];
    if (!first) return null;
    const match = /^[A-Za-z]+/.exec(first);
    return match ? match[0] : null;
  }, [wbsRefs]);

  const disciplineItems = useMemo(() => {
    if (!discipline) return items;
    return items.filter((i) => {
      const m = /^[A-Za-z]+/.exec(i.wbsRef);
      return m !== null && m[0] === discipline;
    });
  }, [items, discipline]);

  // Visible section subtotal: sum of ALL rows' line totals (all destinations).
  // This is what the estimator sees on the cutting worksheet — Internal-only
  // rows must still appear in the total the estimator reads. Only what is
  // reported upward to ScopeCardsTab is filtered to the price slice.
  // No arithmetic on rates — only a fold of server-computed figures.
  const subtotal = useMemo(
    () => disciplineItems.reduce((sum, i) => sum + (i.lineTotal ? Number(i.lineTotal) : 0), 0),
    [disciplineItems]
  );

  // Price-slice totals reported upward to ScopeCardsTab.statsByCard.
  // Only PRICE (or null, which means PRICE) destination rows are included.
  // withMarkup uses the server's lineTotalWithMarkup when present, falling
  // back to lineTotal (same pattern as OtherOperationalCosts).
  // Uses the exported computeCuttingPriceTotals helper — single implementation.
  const priceTotals = useMemo(
    () => computeCuttingPriceTotals(disciplineItems),
    [disciplineItems]
  );

  // Report the price slice upward so ScopeCardsTab.statsByCard stays correct.
  useEffect(() => {
    if (cardId && onSectionTotalChange) {
      onSectionTotalChange(cardId, priceTotals);
    }
  }, [cardId, priceTotals, onSectionTotalChange]);

  const addItem = async (type: ItemType) => {
    if (!canManage) return;
    if (!cardId) {
      setError("Cannot add a cutting item without a scope card in context.");
      return;
    }
    const wbsRef = wbsRefs[0] ?? "SO1";
    const body: Record<string, unknown> = {
      wbsRef,
      itemType: type,
      cardId
    };
    if (type === "other-rate" && otherRates[0]) {
      body.otherRateId = otherRates[0].id;
      body.quantityEach = 1;
    }
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  // PR B4b — "Copy from above" aggregator trigger.
  const copyFromAbove = async () => {
    if (!canManage || !cardId) return;
    const ok = await confirm({
      title: "Copy from above",
      message:
        "Replace auto-copied saw-cut rows with current scope items? Manually-added rows will be preserved.",
      confirmLabel: "Replace",
      variant: "danger"
    });
    if (!ok) return;
    const response = await authFetch(
      `/tenders/${tenderId}/scope/cards/${cardId}/cutting/copy-from-above`,
      { method: "POST" }
    );
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    type CopyResult = { replaced: number; created: number; warnings?: string[] };
    const result = (await response.json()) as CopyResult;
    const parts: string[] = [
      `Copy from above: replaced ${result.replaced}, created ${result.created}.`
    ];
    if (result.warnings && result.warnings.length > 0) {
      parts.push(`Warnings:\n- ${result.warnings.join("\n- ")}`);
    }
    await alert({ title: "Copy from above", message: parts.join("\n\n") });
    await load();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: "Delete cutting item",
      message: "Delete this cutting item?",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await readApiErrorMessage(response));
      return;
    }
    await load();
  };

  return (
    <section className="s7-card" style={{ marginTop: 16 }} data-testid="scope-cutting-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Concrete cutting
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({disciplineItems.length} item{disciplineItems.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          {onSectionMarkupChange && tenderMarkup !== undefined ? (
            <SectionMarkupOverride
              label="Cutting markup:"
              value={sectionMarkupOverride}
              tenderMarkup={tenderMarkup}
              onSave={onSectionMarkupChange}
              disabled={!canManage}
            />
          ) : null}
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Subtotal: <strong style={{ color: "var(--text)" }} data-testid="cutting-section-total">{fmt(subtotal)}</strong>
            {tenderMarkup !== undefined ? (
              <>
                <span> · </span>
                with markup:{" "}
                <strong style={{ color: "var(--text)" }}>
                  {fmt(computeWithMarkup(subtotal, sectionMarkupOverride, tenderMarkup))}
                </strong>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {discipline ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 8px" }}>
          Showing items linked to {discipline} scope. Switch discipline above to see others.
        </p>
      ) : null}

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ ...mutedStyle, fontSize: 13 }}>Loading{"…"}</p>
      ) : disciplineItems.length === 0 ? (
        <p style={{ ...mutedStyle, fontSize: 13 }} data-testid="cutting-section-empty">
          {/* "Cutting take-off" sub-label: keeps the phrase the estimator learned
              (from the now-deleted CuttingSection take-off section) on the one
              surface that survives. The mock-up's own empty-state copy: */}
          <em style={{ fontStyle: "normal", color: "var(--text-muted)" }}>Cutting take-off</em>{" — "}
          No cutting yet. Copy from above builds saw-cut lines from every measurement ticked for
          cutting{"—"}length becomes the cut metres and depth becomes the blade depth.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <CutTables
            items={disciplineItems}
            wbsRefs={wbsRefs}
            canManage={canManage}
            otherRates={otherRates}
            patch={patch}
            remove={remove}
          />
        </div>
      )}

      {canManage ? (
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void addItem("saw-cut")}
          >
            + Add saw cut
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--secondary"
            onClick={() => void addItem("core-hole")}
          >
            + Add core hole
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--secondary"
            onClick={() => void addItem("other-rate")}
            disabled={otherRates.length === 0}
            title={otherRates.length === 0 ? "No active other-rates in catalogue" : undefined}
          >
            + Add other-rate line
          </button>
          {/* PR B4b — Copy from above: requires the card scope so the
              aggregator can target the right rows. */}
          {cardId ? (
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              onClick={() => void copyFromAbove()}
              title="Create saw-cut rows from scope items where 'Cutting?' is ticked. Manual rows are preserved."
            >
              {"↓"} Copy from above
            </button>
          ) : null}
        </div>
      ) : null}

      {onCuttingNotesChange ? (
        <div style={{ marginTop: 16 }}>
          <NotesField
            label="Cutting notes"
            value={cuttingNotes ?? null}
            onSave={(v) => onCuttingNotesChange(v)}
            disabled={!canManage}
            placeholder="Shared notes for this card's cutting rows (visible across all row types)…"
          />
        </div>
      ) : null}
    </section>
  );
}

// ── The unified table ────────────────────────────────────────────────────────
//
// Mock-up header order (15 columns + actions):
//   Goes to | From | Type | Description | Equipment | Elevation | Material |
//   Depth | O | Qty | Method | Rate | Markup | Total | actions
//
// A cell a row type does not use is shown muted with an em-dash — never dropped.
// Money columns: the server's figures, read and formatted, never computed here.

type TableProps = {
  items: CuttingItem[];
  wbsRefs: string[];
  canManage: boolean;
  otherRates: OtherRate[];
  patch: (id: string, body: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? null : n;
}

function WbsCell({ item, wbsRefs, canManage, patch }: {
  item: CuttingItem;
  wbsRefs: string[];
  canManage: boolean;
  patch: (id: string, body: Record<string, unknown>) => Promise<void>;
}) {
  return (
    <select
      className="s7-input"
      value={item.wbsRef}
      disabled={!canManage}
      onChange={(e) => void patch(item.id, { wbsRef: e.target.value })}
      style={{ width: 80 }}
    >
      {!wbsRefs.includes(item.wbsRef) ? <option value={item.wbsRef}>{item.wbsRef}</option> : null}
      {wbsRefs.map((r) => (
        <option key={r} value={r}>{r}</option>
      ))}
    </select>
  );
}

function CutTables({ items, wbsRefs, canManage, otherRates, patch, remove }: TableProps) {
  // Column headers — mock-up order:
  // Goes to | From | Type | Description | Equipment | Elevation | Material |
  // Depth | O | Qty | Method | Rate | Markup | Total | (actions)
  const headers = [
    "Goes to", "From", "Type", "Description", "Equipment", "Elevation",
    "Material", "Depth", "Ø", "Qty", "Method", "Rate", "Markup", "Total", ""
  ];

  return (
    <table
      className="s7-table"
      aria-label="Cutting rows"
      style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}
    >
      <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              style={{
                padding: "8px 6px",
                textAlign: h === "Rate" || h === "Total" ? "right" : "left",
                fontWeight: 600,
                whiteSpace: "nowrap"
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <CutRow
            key={item.id}
            item={item}
            wbsRefs={wbsRefs}
            canManage={canManage}
            otherRates={otherRates}
            patch={patch}
            remove={remove}
          />
        ))}
      </tbody>
    </table>
  );
}

type RowProps = {
  item: CuttingItem;
  wbsRefs: string[];
  canManage: boolean;
  otherRates: OtherRate[];
  patch: (id: string, body: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

function CutRow({ item, wbsRefs, canManage, otherRates, patch, remove }: RowProps) {
  const isSaw = item.itemType === "saw-cut";
  const isCoreHole = item.itemType === "core-hole";
  const isOther = item.itemType === "other-rate";

  const equipment = item.equipment ?? "";
  const allowedElevations = equipment ? (ELEVATIONS_FOR_EQUIPMENT[equipment] ?? ELEVATIONS) : ELEVATIONS;
  const allowedMethods = equipment ? (METHODS_BY_EQUIPMENT[equipment] ?? []) : [];

  const diameter = item.diameterMm ?? 0;
  const isStandardDiameter = CORE_DIAMETERS.includes(diameter);
  const isPOA = isCoreHole && diameter > 650;

  const dest: QuoteDestination = item.quoteDestination ?? "PRICE";
  const rowClass = DESTINATION_ROW_CLASS[dest];
  const effectiveMarkup = item.effectiveMarkup ?? 0;
  const selected = item.otherRate;

  return (
    <Fragment>
      <tr
        data-testid="cutting-row"
        data-item-type={item.itemType}
        className={rowClass}
        style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}
      >
        {/* Goes to — S2b destination column */}
        <td style={cellPad} data-testid="cutting-dest-cell">
          <QuoteDestinationSelect
            value={dest}
            onChange={(next) => void patch(item.id, { quoteDestination: next })}
          />
        </td>

        {/* From — S1 source glyph. Shows the WBS ref the row was copied from,
            muted for manual rows (no source). */}
        <td style={cellPad}>
          {item.sourceWbsRef ? (
            <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
              {item.sourceWbsRef}
            </span>
          ) : (
            <span style={mutedStyle}>{EM_DASH}</span>
          )}
        </td>

        {/* Type */}
        <td style={cellPad}>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {item.itemType}
          </span>
        </td>

        {/* Description */}
        <td style={cellPad}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {item.autoCopied ? (
              <span
                title="Auto-copied from scope items above — replaced when you press Copy from above"
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  background: "#FEAA6D",
                  color: "#fff",
                  borderRadius: 999,
                  fontWeight: 700,
                  whiteSpace: "nowrap"
                }}
              >
                AUTO
              </span>
            ) : null}
            <input
              className="s7-input"
              defaultValue={item.description ?? ""}
              disabled={!canManage}
              onBlur={(e) => void patch(item.id, { description: e.target.value })}
            />
          </div>
        </td>

        {/* Equipment — saw-cut and core-hole use it; other-rate does not */}
        <td style={cellPad}>
          {isOther ? (
            <span style={mutedStyle}>{EM_DASH}</span>
          ) : isSaw ? (
            <select
              className="s7-input"
              value={item.equipment ?? ""}
              disabled={!canManage}
              onChange={(e) => {
                const next = e.target.value || null;
                const nextElevations = next ? ELEVATIONS_FOR_EQUIPMENT[next] ?? ELEVATIONS : ELEVATIONS;
                const nextMethods = next ? METHODS_BY_EQUIPMENT[next] ?? [] : [];
                const patchBody: Record<string, unknown> = { equipment: next };
                if (item.elevation && !nextElevations.includes(item.elevation)) {
                  patchBody.elevation = nextElevations[0] ?? null;
                }
                if (item.method && !nextMethods.includes(item.method)) {
                  patchBody.method = null;
                }
                void patch(item.id, patchBody);
              }}
            >
              <option value="">{EM_DASH}</option>
              {SAW_EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
            </select>
          ) : (
            /* core-hole — no equipment select */
            <span style={mutedStyle}>{EM_DASH}</span>
          )}
        </td>

        {/* Elevation — saw-cut (gated by equipment) and core-hole; muted for other-rate */}
        <td style={cellPad}>
          {isOther ? (
            <span style={mutedStyle}>{EM_DASH}</span>
          ) : isSaw ? (
            equipment === "Roadsaw" ? (
              <span style={mutedStyle}>Floor</span>
            ) : (
              <select
                className="s7-input"
                value={item.elevation ?? ""}
                disabled={!canManage || !equipment}
                onChange={(e) => void patch(item.id, { elevation: e.target.value || null })}
              >
                <option value="">{EM_DASH}</option>
                {allowedElevations.map((el) => <option key={el} value={el}>{el}</option>)}
              </select>
            )
          ) : (
            /* core-hole */
            <select
              className="s7-input"
              value={item.elevation ?? "Floor"}
              disabled={!canManage}
              onChange={(e) => void patch(item.id, { elevation: e.target.value || null })}
            >
              {CORE_ELEVATIONS.map((el) => <option key={el} value={el}>{el}</option>)}
            </select>
          )}
        </td>

        {/* Material — saw-cut only; muted for core-hole and other-rate */}
        <td style={cellPad}>
          {isSaw ? (
            <select
              className="s7-input"
              value={item.material ?? ""}
              disabled={!canManage}
              onChange={(e) => void patch(item.id, { material: e.target.value || null })}
              title={
                item.autoCopied && !item.material
                  ? "Couldn't auto-detect material from the scope item — please pick one."
                  : undefined
              }
              style={
                item.autoCopied && !item.material
                  ? { border: "2px solid #FEAA6D", borderRadius: 4 }
                  : undefined
              }
            >
              <option value="">{EM_DASH}</option>
              {SAW_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <span style={mutedStyle} data-testid="material-muted">{EM_DASH}</span>
          )}
        </td>

        {/* Depth — saw-cut and core-hole; muted for other-rate */}
        <td style={cellPad}>
          {isOther ? (
            <span style={mutedStyle}>{EM_DASH}</span>
          ) : (
            <input
              className="s7-input"
              type="number"
              defaultValue={item.depthMm ?? ""}
              disabled={!canManage}
              style={{ width: 72 }}
              onBlur={(e) => void patch(item.id, { depthMm: numOrNull(e.target.value) })}
            />
          )}
        </td>

        {/* O (diameterMm) — core-hole only; muted for saw-cut and other-rate */}
        <td style={cellPad}>
          {isCoreHole ? (
            isStandardDiameter || diameter === 0 ? (
              <select
                className="s7-input"
                value={diameter || ""}
                disabled={!canManage}
                onChange={(e) =>
                  void patch(item.id, {
                    diameterMm: e.target.value === "custom" ? null : numOrNull(e.target.value)
                  })
                }
                style={{ width: 90 }}
              >
                <option value="">{EM_DASH}</option>
                {CORE_DIAMETERS.map((d) => <option key={d} value={d}>{d}</option>)}
                <option value="custom">Custom{"…"}</option>
              </select>
            ) : (
              <input
                className="s7-input"
                type="number"
                defaultValue={diameter}
                disabled={!canManage}
                style={{ width: 90 }}
                onBlur={(e) => void patch(item.id, { diameterMm: numOrNull(e.target.value) })}
              />
            )
          ) : (
            <span style={mutedStyle} data-testid="diameter-muted">{EM_DASH}</span>
          )}
        </td>

        {/* Qty — quantityLm for saw-cut; quantityEach for core-hole and other-rate */}
        <td style={cellPad}>
          {isOther ? (
            <input
              className="s7-input"
              type="number"
              step="0.01"
              defaultValue={item.quantityEach ?? ""}
              disabled={!canManage}
              style={{ width: 72 }}
              onBlur={(e) => void patch(item.id, { quantityEach: numOrNull(e.target.value) })}
            />
          ) : isSaw ? (
            <input
              className="s7-input"
              type="number"
              step="0.01"
              defaultValue={item.quantityLm ?? ""}
              disabled={!canManage}
              style={{ width: 72 }}
              onBlur={(e) => void patch(item.id, { quantityLm: numOrNull(e.target.value) })}
            />
          ) : (
            /* core-hole */
            <input
              className="s7-input"
              type="number"
              defaultValue={item.quantityEach ?? ""}
              disabled={!canManage}
              style={{ width: 72 }}
              onBlur={(e) => void patch(item.id, { quantityEach: numOrNull(e.target.value) })}
            />
          )}
        </td>

        {/* Method — saw-cut only; muted for core-hole and other-rate */}
        <td style={cellPad}>
          {isSaw ? (
            <select
              className="s7-input"
              value={item.method ?? ""}
              disabled={!canManage || !equipment}
              style={{ width: 100 }}
              onChange={(e) => void patch(item.id, { method: e.target.value || null })}
            >
              <option value="">N/A</option>
              {allowedMethods.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          ) : (
            <span style={mutedStyle}>{EM_DASH}</span>
          )}
        </td>

        {/* Rate — server's figure. No arithmetic. */}
        <td style={{ ...cellPad, textAlign: "right", whiteSpace: "nowrap" }}>
          {isPOA ? (
            <span style={{ color: "#B45309", fontWeight: 600 }}>POA</span>
          ) : isSaw ? (
            <span style={mutedStyle}>{fmt(item.ratePerM)}</span>
          ) : isCoreHole ? (
            <span style={mutedStyle}>{fmt(item.ratePerHole)}</span>
          ) : (
            /* other-rate: the catalogue rate */
            <span style={mutedStyle}>{selected ? fmt(selected.rate) : EM_DASH}</span>
          )}
        </td>

        {/* Markup — S3 per-line markup column */}
        <td style={cellPad}>
          <LineMarkupCell
            markupOverride={item.markupOverride ?? null}
            effectiveMarkup={effectiveMarkup}
            inheritedPhrase="the card's cutting markup"
            onPatch={(p) => void patch(item.id, p as Record<string, unknown>)}
            disabled={!canManage || dest === "INTERNAL"}
          />
        </td>

        {/* Total — server's figure. No arithmetic. */}
        <td style={{ ...cellPad, textAlign: "right", whiteSpace: "nowrap", fontWeight: 600 }}>
          {isPOA ? (
            <span style={{ color: "#B45309" }}>{EM_DASH}</span>
          ) : (
            fmt(item.lineTotalWithMarkup ?? item.lineTotal)
          )}
        </td>

        {/* Actions */}
        <td style={cellPad}>
          {canManage ? (
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => void remove(item.id)}
            >
              {"×"}
            </button>
          ) : null}
        </td>
      </tr>
      {/* other-rate: show the item name and unit as a sub-row to save column space */}
      {isOther && selected ? (
        <tr style={{ borderTop: "none" }}>
          <td colSpan={3} />
          <td
            colSpan={9}
            style={{ padding: "2px 6px 6px", fontSize: 11, color: "var(--text-muted)" }}
          >
            {selected.description}{" "}
            <span style={{ fontStyle: "italic" }}>{selected.unit}</span>
          </td>
          <td colSpan={3} />
        </tr>
      ) : null}
    </Fragment>
  );
}
