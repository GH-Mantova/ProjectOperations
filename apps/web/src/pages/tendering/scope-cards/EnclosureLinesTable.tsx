// EnclosureLinesTable.tsx
//
// ASB_ENCLOSURE_LINES_UI_V1 — "Enclosure, monitoring & clearance" table for
// ASB scope items.
//
// Rendered ONLY inside WbsAcmBlock (which is already gated to isAsbestos &&
// openBlocks.acm). This component never appears on non-ASB cards.
//
// All money comes from the API response — the component never multiplies
// qty × rate. See tests for the source assertion that enforces this.
//
// Endpoints (scope-enclosure.controller.ts):
//   GET    /tenders/:tenderId/scope/items/:itemId/enclosure-lines
//   POST   /tenders/:tenderId/scope/items/:itemId/enclosure-lines
//   PATCH  /tenders/:tenderId/scope/items/:itemId/enclosure-lines/:lineId
//   DELETE /tenders/:tenderId/scope/items/:itemId/enclosure-lines/:lineId
//
// Type list: GET /estimate-rates/enclosure — existing endpoint, active rows
// only. No new server routes are added by this slice.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";
import { readApiErrorMessage } from "../../../lib/api-errors";
import {
  listEnclosureLines,
  createEnclosureLine,
  patchEnclosureLine,
  deleteEnclosureLine,
  listEnclosureRateTypes,
  type EnclosureLine,
  type EnclosureRateType
} from "../../../lib/enclosure-lines-api";

/**
 * ASB_ENCLOSURE_LINES_UI_V1 — marker that the enclosure, monitoring and
 * clearance table exists in the web. S2 of ASB_ENCLOSURE_LINES_V1 (S1 is the
 * API; see scope-enclosure.service.ts). The pipeline gates on this string being
 * present in the diff.
 */
export const ASB_ENCLOSURE_LINES_UI_V1 = "asb-enclosure-s2";

// ── Money formatting ────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(n);
}

// ── Subtotals (server figures only) ────────────────────────────────────────

/**
 * Sum the server-computed lineTotalWithMarkup fields from all lines.
 *
 * NEVER multiplies qty × rate — the browser only adds what the server returned.
 */
export function enclosureSubtotalWithMarkup(lines: EnclosureLine[]): number {
  let sum = 0;
  for (const l of lines) {
    if (typeof l.lineTotalWithMarkup === "number" && Number.isFinite(l.lineTotalWithMarkup)) {
      sum += l.lineTotalWithMarkup;
    }
  }
  return sum;
}

/**
 * Count of priced enclosure lines — used by acmFactCount() to include lines
 * in the fact counter on the "Enclosure & monitoring" action button.
 */
export function enclosureLineCount(lines: EnclosureLine[]): number {
  return lines.length;
}

// ── Label style, shared with WbsAcmBlock ───────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-muted)",
  marginBottom: 2
};

// ── Rate cell: placeholder shows snapshot rate; typing becomes override ──────
//
// Clearing (empty string) PATCHes { rateOverride: null } — server reverts to
// snapshotted rate.

type RateCellProps = {
  line: EnclosureLine;
  disabled: boolean;
  onPatch: (lineId: string, patch: { rateOverride: number | null }) => void;
};

function RateCell({ line, disabled, onPatch }: RateCellProps) {
  const snapshotRate = Number(line.rate);
  const currentOverride =
    line.rateOverride !== null && line.rateOverride !== undefined
      ? String(line.rateOverride)
      : "";

  const [localValue, setLocalValue] = useState(currentOverride);

  // Keep local in sync when the line is refreshed from the server.
  useEffect(() => {
    setLocalValue(
      line.rateOverride !== null && line.rateOverride !== undefined
        ? String(line.rateOverride)
        : ""
    );
  }, [line.rateOverride]);

  const handleBlur = useCallback(() => {
    const trimmed = localValue.trim();
    if (trimmed === "") {
      // Clearing: PATCH rateOverride: null — restore snapshot rate.
      onPatch(line.id, { rateOverride: null });
    } else {
      const parsed = parseFloat(trimmed);
      if (Number.isFinite(parsed) && parsed >= 0) {
        onPatch(line.id, { rateOverride: parsed });
      } else {
        // Invalid: revert local display to stored state.
        setLocalValue(currentOverride);
      }
    }
  }, [localValue, currentOverride, line.id, onPatch]);

  return (
    <input
      type="number"
      min={0}
      step="0.01"
      data-testid={`enclosure-rate-${line.id}`}
      value={localValue}
      placeholder={Number.isFinite(snapshotRate) ? String(snapshotRate) : ""}
      disabled={disabled}
      aria-label={`Rate override for ${line.enclosureType}`}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      style={{
        width: 90,
        textAlign: "right",
        fontSize: 12.5,
        height: 28,
        border: "1px solid var(--border-default)",
        borderRadius: 5,
        padding: "0 6px",
        background: "var(--surface-base)",
        color: localValue.trim() !== "" ? "var(--text-default)" : "var(--text-muted)"
      }}
    />
  );
}

// ── Qty cell ────────────────────────────────────────────────────────────────

type QtyCellProps = {
  line: EnclosureLine;
  disabled: boolean;
  onPatch: (lineId: string, patch: { qty: number }) => void;
};

function QtyCell({ line, disabled, onPatch }: QtyCellProps) {
  const [localValue, setLocalValue] = useState(String(Number(line.qty)));

  useEffect(() => {
    setLocalValue(String(Number(line.qty)));
  }, [line.qty]);

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(localValue.trim());
    if (Number.isFinite(parsed) && parsed >= 0) {
      onPatch(line.id, { qty: parsed });
    } else {
      setLocalValue(String(Number(line.qty)));
    }
  }, [localValue, line.id, line.qty, onPatch]);

  return (
    <input
      type="number"
      min={0}
      step="1"
      data-testid={`enclosure-qty-${line.id}`}
      value={localValue}
      disabled={disabled}
      aria-label={`Quantity for ${line.enclosureType}`}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      style={{
        width: 70,
        textAlign: "right",
        fontSize: 12.5,
        height: 28,
        border: "1px solid var(--border-default)",
        borderRadius: 5,
        padding: "0 6px",
        background: "var(--surface-base)"
      }}
    />
  );
}

// ── Type select ─────────────────────────────────────────────────────────────

type TypeSelectProps = {
  line: EnclosureLine;
  typeOptions: EnclosureRateType[];
  disabled: boolean;
};

function TypeSelect({ line, typeOptions, disabled }: TypeSelectProps) {
  // The type on a line is read-only after creation (changing the type requires
  // delete + re-add). We render it as a disabled select showing the type label.
  // If the type is no longer in the active list, it still shows correctly.
  const options = useMemo(() => {
    const active = typeOptions.filter((o) => o.isActive);
    // Ensure the current type is always present (may be inactive or deleted).
    const hasCurrentType = active.some((o) => o.enclosureType === line.enclosureType);
    if (!hasCurrentType) {
      return [
        ...active,
        {
          id: `__current__${line.id}`,
          enclosureType: line.enclosureType,
          unit: line.unit,
          rate: line.rate,
          isActive: false,
          sortOrder: 9999
        }
      ];
    }
    return active;
  }, [typeOptions, line.enclosureType, line.id, line.unit, line.rate]);

  return (
    <select
      value={line.enclosureType}
      disabled
      aria-label={`Type for line ${line.id}`}
      data-testid={`enclosure-type-${line.id}`}
      style={{
        fontSize: 12.5,
        height: 28,
        border: "1px solid var(--border-default)",
        borderRadius: 5,
        padding: "0 6px",
        background: "var(--surface-base)",
        minWidth: 180,
        maxWidth: 260
      }}
    >
      {options.map((o) => (
        <option key={o.enclosureType} value={o.enclosureType}>
          {o.enclosureType}
        </option>
      ))}
    </select>
  );
}

// ── Add-row type select (for new lines) ─────────────────────────────────────

type AddTypeSelectProps = {
  typeOptions: EnclosureRateType[];
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
};

function AddTypeSelect({ typeOptions, value, onChange, disabled }: AddTypeSelectProps) {
  const active = typeOptions.filter((o) => o.isActive);
  return (
    <select
      value={value}
      disabled={disabled}
      aria-label="Select type for new enclosure line"
      data-testid="enclosure-new-type"
      onChange={(e) => onChange(e.target.value)}
      style={{
        fontSize: 12.5,
        height: 28,
        border: "1px solid var(--border-default)",
        borderRadius: 5,
        padding: "0 6px",
        background: "var(--surface-base)",
        minWidth: 180,
        maxWidth: 260
      }}
    >
      <option value="">-- select type --</option>
      {active.map((o) => (
        <option key={o.enclosureType} value={o.enclosureType}>
          {o.enclosureType}
        </option>
      ))}
    </select>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export type EnclosureLinesTableProps = {
  tenderId: string;
  itemId: string;
  /** Read-only when true — matches the ACM block's isAi prop. */
  isReadOnly: boolean;
  /** Called after any write so the parent can refresh the item total. */
  onLinesChanged?: (lines: EnclosureLine[]) => void;
};

/**
 * ASB_ENCLOSURE_LINES_UI_V1 — enclosure, monitoring and clearance lines table.
 *
 * Rendered inside WbsAcmBlock below the ACM type/material/tick fields.
 * Only visible on ASB items; the caller (ScopeQuantitiesTable) already gates
 * on `isAsbestos && openBlocks.acm` before rendering WbsAcmBlock.
 */
export function EnclosureLinesTable({
  tenderId,
  itemId,
  isReadOnly,
  onLinesChanged
}: EnclosureLinesTableProps) {
  const { authFetch } = useAuth();

  const [lines, setLines] = useState<EnclosureLine[]>([]);
  const [typeOptions, setTypeOptions] = useState<EnclosureRateType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── New-line form state ────────────────────────────────────────────────
  const [newType, setNewType] = useState("");
  const [newQty, setNewQty] = useState("1");
  const [adding, setAdding] = useState(false);

  // ── Load lines ─────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await listEnclosureLines(authFetch, tenderId, itemId);
      setLines(loaded);
      onLinesChanged?.(loaded);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, itemId, onLinesChanged]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Load type list (from existing estimate-rates/enclosure endpoint) ───
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const types = await listEnclosureRateTypes(authFetch);
        if (!cancelled) setTypeOptions(types);
      } catch {
        // Non-fatal: type select renders empty; adding is blocked.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // ── Patch a line (qty or rateOverride) ────────────────────────────────
  const handlePatch = useCallback(
    async (lineId: string, patch: { qty?: number; rateOverride?: number | null }) => {
      setError(null);
      try {
        const updated = await patchEnclosureLine(authFetch, tenderId, itemId, lineId, patch);
        setLines((prev) => {
          const next = prev.map((l) => (l.id === lineId ? updated : l));
          onLinesChanged?.(next);
          return next;
        });
      } catch (err) {
        setError((err as Error).message);
        // Revert to server state.
        void load();
      }
    },
    [authFetch, tenderId, itemId, onLinesChanged, load]
  );

  // ── Delete a line ──────────────────────────────────────────────────────
  const handleDelete = useCallback(
    async (lineId: string) => {
      setError(null);
      try {
        await deleteEnclosureLine(authFetch, tenderId, itemId, lineId);
        setLines((prev) => {
          const next = prev.filter((l) => l.id !== lineId);
          onLinesChanged?.(next);
          return next;
        });
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch, tenderId, itemId, onLinesChanged]
  );

  // ── Add a line ─────────────────────────────────────────────────────────
  const handleAdd = useCallback(async () => {
    if (!newType || adding) return;
    const parsedQty = parseFloat(newQty.trim());
    if (!Number.isFinite(parsedQty) || parsedQty < 0) return;

    setAdding(true);
    setError(null);
    try {
      const created = await createEnclosureLine(authFetch, tenderId, itemId, {
        enclosureType: newType,
        qty: parsedQty
      });
      setLines((prev) => {
        const next = [...prev, created];
        onLinesChanged?.(next);
        return next;
      });
      setNewType("");
      setNewQty("1");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAdding(false);
    }
  }, [authFetch, tenderId, itemId, newType, newQty, adding, onLinesChanged]);

  // ── Subtotal (server figures only) ────────────────────────────────────
  const subtotal = useMemo(() => enclosureSubtotalWithMarkup(lines), [lines]);

  // ── Table header style ─────────────────────────────────────────────────
  const thStyle: React.CSSProperties = {
    background: "var(--surface-subtle)",
    textAlign: "left",
    fontSize: 10.5,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    padding: "7px 9px",
    whiteSpace: "nowrap"
  };

  const thRightStyle: React.CSSProperties = { ...thStyle, textAlign: "right" };

  const tdStyle: React.CSSProperties = {
    padding: "6px 9px",
    borderTop: "1px solid var(--surface-subtle)",
    whiteSpace: "nowrap",
    verticalAlign: "middle"
  };

  const tdRightStyle: React.CSSProperties = {
    ...tdStyle,
    textAlign: "right",
    fontVariantNumeric: "tabular-nums"
  };

  return (
    <div
      data-testid="enclosure-lines-table"
      style={{
        marginTop: 12,
        border: "1px solid var(--border-accent)",
        borderRadius: 8,
        background: "var(--surface-accent-subtle)",
        padding: "10px 12px"
      }}
    >
      {/* Heading row */}
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          flexWrap: "wrap",
          marginBottom: 8
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-accent)"
          }}
        >
          Enclosure, monitoring &amp; clearance
        </span>
        <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
          priced from the enclosure rate table &middot; added on top of the labour above
        </span>
        <span style={{ flex: 1 }} />
        {!isReadOnly ? (
          <button
            data-testid="enclosure-add-another"
            onClick={() => void handleAdd()}
            disabled={adding || !newType}
            style={{
              font: "inherit",
              fontSize: 11.5,
              border: "1px solid var(--border-accent)",
              color: "var(--text-accent)",
              background: "var(--surface-base)",
              borderRadius: 5,
              padding: "2px 8px",
              cursor: adding || !newType ? "default" : "pointer",
              opacity: adding || !newType ? 0.5 : 1
            }}
          >
            + add another
          </button>
        ) : null}
      </div>

      {/* Narrow-scroll wrapper */}
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--border-default)",
          borderRadius: 8
        }}
      >
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            fontSize: 12.5,
            minWidth: 480
          }}
        >
          <thead>
            <tr>
              <th style={thStyle}>Item</th>
              <th style={thRightStyle}>Qty</th>
              <th style={thStyle}>Unit</th>
              <th style={thRightStyle}>Rate</th>
              <th style={thRightStyle}>Total</th>
              <th style={thStyle} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, color: "var(--text-muted)", textAlign: "center" }}>
                  Loading&hellip;
                </td>
              </tr>
            ) : lines.length === 0 && isReadOnly ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, color: "var(--text-muted)", textAlign: "center" }}>
                  No enclosure lines.
                </td>
              </tr>
            ) : null}

            {lines.map((line) => (
              <tr key={line.id} data-testid={`enclosure-line-${line.id}`}>
                <td style={tdStyle}>
                  <TypeSelect
                    line={line}
                    typeOptions={typeOptions}
                    disabled
                  />
                </td>
                <td style={tdRightStyle}>
                  <QtyCell
                    line={line}
                    disabled={isReadOnly}
                    onPatch={(lineId, patch) => void handlePatch(lineId, patch)}
                  />
                </td>
                <td style={{ ...tdStyle, fontSize: 12, color: "var(--text-muted)" }}>
                  {line.unit}
                </td>
                <td style={tdRightStyle}>
                  <RateCell
                    line={line}
                    disabled={isReadOnly}
                    onPatch={(lineId, patch) => void handlePatch(lineId, patch)}
                  />
                </td>
                <td
                  style={tdRightStyle}
                  data-testid={`enclosure-total-${line.id}`}
                  data-line-total={line.lineTotalWithMarkup}
                >
                  {fmtMoney(line.lineTotalWithMarkup)}
                </td>
                <td style={tdStyle}>
                  {!isReadOnly ? (
                    <button
                      data-testid={`enclosure-remove-${line.id}`}
                      onClick={() => void handleDelete(line.id)}
                      aria-label={`Remove ${line.enclosureType}`}
                      style={{
                        border: 0,
                        background: "none",
                        color: "var(--text-muted)",
                        fontSize: 15,
                        cursor: "pointer",
                        padding: "0 4px"
                      }}
                    >
                      &times;
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}

            {/* New-line input row (edit mode only, when not read-only) */}
            {!isReadOnly ? (
              <tr data-testid="enclosure-new-row">
                <td style={tdStyle}>
                  <AddTypeSelect
                    typeOptions={typeOptions}
                    value={newType}
                    onChange={setNewType}
                    disabled={adding}
                  />
                </td>
                <td style={tdRightStyle}>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    data-testid="enclosure-new-qty"
                    value={newQty}
                    disabled={adding}
                    aria-label="Quantity for new enclosure line"
                    onChange={(e) => setNewQty(e.target.value)}
                    style={{
                      width: 70,
                      textAlign: "right",
                      fontSize: 12.5,
                      height: 28,
                      border: "1px solid var(--border-default)",
                      borderRadius: 5,
                      padding: "0 6px",
                      background: "var(--surface-base)"
                    }}
                  />
                </td>
                <td style={{ ...tdStyle, color: "var(--text-muted)", fontSize: 12 }}>
                  {newType
                    ? (typeOptions.find((o) => o.enclosureType === newType)?.unit ?? "")
                    : ""}
                </td>
                <td style={{ ...tdRightStyle, color: "var(--text-muted)" }}>
                  {newType
                    ? (typeOptions.find((o) => o.enclosureType === newType)?.rate ?? "")
                    : ""}
                </td>
                <td style={tdRightStyle} />
                <td style={tdStyle} />
              </tr>
            ) : null}

            {/* Subtotal row */}
            {lines.length > 0 ? (
              <tr
                data-testid="enclosure-subtotal-row"
                style={{ borderTop: "1.5px solid var(--border-accent)" }}
              >
                <td
                  colSpan={4}
                  style={{
                    ...tdStyle,
                    fontWeight: 700,
                    background: "var(--surface-subtle)"
                  }}
                >
                  Enclosure, monitoring &amp; clearance
                </td>
                <td
                  style={{
                    ...tdRightStyle,
                    fontWeight: 700,
                    background: "var(--surface-subtle)"
                  }}
                  data-testid="enclosure-subtotal"
                  data-subtotal={subtotal}
                >
                  {fmtMoney(subtotal)}
                </td>
                <td style={{ ...tdStyle, background: "var(--surface-subtle)" }} />
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {error ? (
        <p
          role="alert"
          style={{ color: "var(--status-danger)", fontSize: 12, marginTop: 6 }}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
