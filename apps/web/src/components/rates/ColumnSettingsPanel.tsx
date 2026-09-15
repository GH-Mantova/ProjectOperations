/**
 * RATESCOL S2 -- ColumnSettingsPanel
 *
 * Opens anchored under the column header (like the HeaderDropdown in
 * FilterableRateGrid).  Five controls, in order:
 *   1. Name
 *   2. Role (What is this column for?)
 *   3. Data type (What goes in it?)
 *   4. Fourth slot: $ per what? / Which list? / Measured in (optional)
 *   5. Must be filled in
 *   (More options folded): Smallest allowed / Largest allowed
 *
 * Pre-checks rendered inline before Save:
 *   - Name clash (blocks Save)
 *   - Structure violation (blocks Save)
 *   - Rename used by a step (warns; Save reads "Save anyway")
 *   - Role change that shifts the charged-from mark (warns; never blocks)
 *
 * Cancel / Save sends ONLY what changed.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  columnNameClash,
  renameWarning,
  chargedFromChange,
  validateColumnStructure,
  stepsUsingField,
  type RateColumn,
  type RateColumnDataType,
  type RateColumnRole
} from "../../pages/admin/ratesListsHelpers";
import { markChargedFrom, type RateGridColumn } from "./rateGridModel";
import type { ChargeStep } from "../../lib/chargeStepTypes";

// -- vocabulary maps (plain language; never show stored enums to users) --

const DATA_TYPE_LABELS: Record<RateColumnDataType, string> = {
  TEXT: "Text",
  NUMBER: "Number",
  CURRENCY: "Money",
  DATE: "Date",
  BOOL: "Yes or no",
  LIST_REF: "Pick from a list"
};

const ROLE_LABELS: Record<RateColumnRole, string> = {
  KEY: "Look it up by this",
  VALUE: "This is a price",
  INFO: "Just information"
};

const BORDER = "var(--border-subtle, #E5E7EB)";
const MUTED = "var(--text-muted, #64748b)";

// -- types ----------------------------------------------------------------

export type ListSummaryForPanel = { id: string; name: string; slug: string };

export type ColumnSettingsPanelProps = {
  column: RateColumn;
  /** All columns in the table (including this one). */
  allColumns: RateColumn[];
  /** Available lists for the "Which list?" picker. */
  lists: ListSummaryForPanel[];
  /** Charge-step step list, for detecting rename-used-by-step. */
  chargeSteps?: readonly ChargeStep[];
  /** Number of open tenders that price against this table (for locked-count note). */
  openTenderCount?: number | null;
  /** Called with only the fields that changed. */
  onSave: (columnId: string, patch: Partial<RateColumnPatch>) => Promise<void>;
  onCancel: () => void;
};

export type RateColumnPatch = {
  name: string;
  dataType: RateColumnDataType;
  role: RateColumnRole;
  unit: string | null;
  listSlug: string | null;
  required: boolean;
  min: number | null;
  max: number | null;
};

// -- helpers --------------------------------------------------------------

/** True when the column's role would be the only VALUE column after a role change. */
function isOnlyPriceColumn(columns: RateColumn[], thisId: string): boolean {
  return columns.filter((c) => c.role === "VALUE").length === 1 &&
    columns.find((c) => c.id === thisId)?.role === "VALUE";
}

/** Build a grid-column snapshot from the columns array for chargedFromChange. */
function toGridSnap(
  columns: RateColumn[]
): RateGridColumn[] {
  const gridCols = columns.map((c): RateGridColumn => ({
    key: c.id,
    label: c.name,
    kind: "text" as const,
    role: (c.role === "KEY" ? "lookup" : c.role === "VALUE" ? "price" : "info") as RateGridColumn["role"],
    unit: c.unit
  }));
  return markChargedFrom(gridCols);
}

// -- component ------------------------------------------------------------

export function ColumnSettingsPanel({
  column,
  allColumns,
  lists,
  chargeSteps,
  openTenderCount,
  onSave,
  onCancel
}: ColumnSettingsPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  // local draft state
  const [name, setName] = useState(column.name);
  const [role, setRole] = useState<RateColumnRole>(column.role);
  const [dataType, setDataType] = useState<RateColumnDataType>(column.dataType);
  const [unit, setUnit] = useState(column.unit ?? "");
  const [listSlug, setListSlug] = useState(column.listSlug ?? "");
  const [required, setRequired] = useState(column.required);
  const [moreOpen, setMoreOpen] = useState(false);
  const [minVal, setMinVal] = useState(column.min !== null ? String(column.min) : "");
  const [maxVal, setMaxVal] = useState(column.max !== null ? String(column.max) : "");
  const [busy, setBusy] = useState(false);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  // -- validation ----------------------------------------------------------

  const nameClash = useMemo(
    () => columnNameClash(allColumns, name, column.id),
    [allColumns, name, column.id]
  );

  const proposedColumns = useMemo(
    () =>
      allColumns.map((c) =>
        c.id === column.id
          ? { ...c, name: name.trim() || c.name, dataType, role, unit: unit || null, listSlug: listSlug || null }
          : c
      ),
    [allColumns, column.id, name, dataType, role, unit, listSlug]
  );

  const structureErrors = useMemo(
    () => validateColumnStructure(proposedColumns),
    [proposedColumns]
  );

  // Rename warning: only when the name actually changed
  const stepsUsingThisColumn = useMemo(
    () => stepsUsingField(chargeSteps as Parameters<typeof stepsUsingField>[0], column.name),
    [chargeSteps, column.name]
  );
  const nameChanged = name.trim() !== "" && name.trim() !== column.name;
  const renameWarn = useMemo(
    () =>
      nameChanged && stepsUsingThisColumn.length > 0
        ? renameWarning(column.name, stepsUsingThisColumn, openTenderCount ?? undefined)
        : null,
    [nameChanged, stepsUsingThisColumn, column.name, openTenderCount]
  );

  // Charged-from shift warning: role change that moves the mark
  const chargedShiftWarn = useMemo(() => {
    const beforeSnap = toGridSnap(allColumns);
    const afterSnap = toGridSnap(proposedColumns);
    const change = chargedFromChange(beforeSnap, afterSnap);
    if (!change) return null;
    const beforeLabel = allColumns.find((c) => c.id === change.beforeId)?.name ?? "the old column";
    const afterLabel = allColumns.find((c) => c.id === change.afterId)?.name ?? "the new column";
    return (
      `Changing this column's role moves the charged-from mark from "${beforeLabel}" ` +
      `to "${afterLabel}". New estimates will price at ${afterLabel}. ` +
      `A change applies to new lines only; tenders with locked rates keep their snapshot.`
    );
  }, [allColumns, proposedColumns]);

  // -- Only-price note (on the role control) --------------------------------
  const onlyPrice = isOnlyPriceColumn(allColumns, column.id) && role === "VALUE";

  // -- Save decision -------------------------------------------------------
  const isBlocked = nameClash || structureErrors.length > 0;
  const hasWarn = Boolean(renameWarn) || Boolean(chargedShiftWarn);

  const handleSave = async () => {
    if (isBlocked) return;
    setBusy(true);
    try {
      const patch: Partial<RateColumnPatch> = {};
      const trimName = name.trim();
      if (trimName && trimName !== column.name) patch.name = trimName;
      if (dataType !== column.dataType) patch.dataType = dataType;
      if (role !== column.role) patch.role = role;
      const u = unit.trim() || null;
      if (u !== (column.unit ?? null)) patch.unit = u;
      const ls = listSlug.trim() || null;
      if (ls !== (column.listSlug ?? null)) patch.listSlug = ls;
      if (required !== column.required) patch.required = required;
      const mn = minVal.trim() !== "" ? Number(minVal) : null;
      const mx = maxVal.trim() !== "" ? Number(maxVal) : null;
      if (mn !== column.min) patch.min = mn;
      if (mx !== column.max) patch.max = mx;
      await onSave(column.id, patch);
    } finally {
      setBusy(false);
    }
  };

  // -- styles --------------------------------------------------------------

  const panelStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    marginTop: 4,
    left: 0,
    zIndex: 20,
    background: "var(--text-inverse, #fff)",
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    boxShadow: "0 4px 16px rgba(15,23,42,0.14)",
    padding: 16,
    minWidth: 320,
    maxWidth: 380,
    fontSize: 13,
    fontWeight: 400,
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: 12
  };

  const labelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 4
  };

  const labelTextStyle: CSSProperties = {
    fontSize: 12,
    color: MUTED,
    fontWeight: 500
  };

  const warnStyle: CSSProperties = {
    fontSize: 12,
    color: "var(--status-warning, #b45309)",
    background: "rgba(251,191,36,0.08)",
    borderLeft: "3px solid var(--status-warning, #b45309)",
    padding: "6px 8px",
    borderRadius: 4
  };

  const errorStyle: CSSProperties = {
    fontSize: 12,
    color: "var(--status-danger, #ef4444)",
    background: "rgba(239,68,68,0.08)",
    borderLeft: "3px solid var(--status-danger, #ef4444)",
    padding: "6px 8px",
    borderRadius: 4
  };

  return (
    <div
      ref={ref}
      style={panelStyle}
      role="dialog"
      aria-label={`Settings for ${column.name}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Name */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>What do you want to call it?</span>
        <input
          className="s7-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        {nameClash ? (
          <span style={errorStyle}>
            This table already has a column called &ldquo;{name.trim()}&rdquo;. Pick another name.
          </span>
        ) : null}
        {renameWarn && !nameClash ? (
          <span style={warnStyle}>{renameWarn}</span>
        ) : null}
      </label>

      {/* 2. Role */}
      <div style={labelStyle}>
        <span style={labelTextStyle}>What is this column for?</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(["KEY", "VALUE", "INFO"] as RateColumnRole[]).map((r) => (
            <label key={r} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input
                type="radio"
                name="role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
              />
              <span>{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </div>
        {onlyPrice ? (
          <span style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>
            This table&apos;s only price &mdash; so it is the one estimates use.
          </span>
        ) : null}
        {chargedShiftWarn ? (
          <span style={warnStyle}>{chargedShiftWarn}</span>
        ) : null}
      </div>

      {/* 3. Data type */}
      <label style={labelStyle}>
        <span style={labelTextStyle}>What goes in it?</span>
        <select
          className="s7-select"
          value={dataType}
          onChange={(e) => setDataType(e.target.value as RateColumnDataType)}
        >
          {(Object.keys(DATA_TYPE_LABELS) as RateColumnDataType[]).map((dt) => (
            <option key={dt} value={dt}>
              {DATA_TYPE_LABELS[dt]}
            </option>
          ))}
        </select>
      </label>

      {/* 4. Fourth slot -- conditional on type */}
      {dataType === "CURRENCY" || (dataType === "NUMBER" && role === "VALUE") ? (
        <label style={labelStyle}>
          <span style={labelTextStyle}>$ per what?</span>
          <input
            className="s7-input"
            placeholder="e.g. m / hr / tonne / day / hole"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
          {structureErrors.some((e) => e.includes(name.trim() || column.name)) ? (
            <span style={errorStyle}>
              {structureErrors.find((e) => e.includes(name.trim() || column.name))}
            </span>
          ) : null}
        </label>
      ) : dataType === "LIST_REF" ? (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Which list?</span>
          <select
            className="s7-select"
            value={listSlug}
            onChange={(e) => setListSlug(e.target.value)}
          >
            <option value="">-- pick a list --</option>
            {lists.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
          {structureErrors.some((e) => e.includes(name.trim() || column.name)) ? (
            <span style={errorStyle}>
              {structureErrors.find((e) => e.includes(name.trim() || column.name))}
            </span>
          ) : null}
        </label>
      ) : (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Measured in (optional)</span>
          <input
            className="s7-input"
            placeholder="e.g. km, days, kg"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
          />
        </label>
      )}

      {/* Show any structure error not already shown in the fourth slot */}
      {structureErrors.filter((e) => !e.includes(name.trim() || column.name)).map((e, i) => (
        <span key={i} style={errorStyle}>{e}</span>
      ))}

      {/* 5. Required */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        <span>Must be filled in</span>
      </label>

      {/* More options (folded) */}
      <div>
        <button
          type="button"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: MUTED,
            fontSize: 12,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
          onClick={() => setMoreOpen((v) => !v)}
        >
          <span>{moreOpen ? "▾" : "▸"}</span>
          More options
        </button>
        {moreOpen ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Smallest allowed</span>
              <input
                type="number"
                className="s7-input"
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
              />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Largest allowed</span>
              <input
                type="number"
                className="s7-input"
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
              />
            </label>
            <span style={{ fontSize: 11, color: MUTED }}>
              These are checked when a row is saved.
            </span>
          </div>
        ) : null}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          onClick={() => void handleSave()}
          disabled={busy || isBlocked}
        >
          {hasWarn && !isBlocked ? "Save anyway" : "Save"}
        </button>
      </div>
    </div>
  );
}
