/**
 * RATE_S3_COLUMN_STRUCTURE — ColumnSettingsPanel
 *
 * A dropdown-anchored panel for editing a single column's metadata. Opened
 * from the header chevron "Column settings" item. Sends only changed fields
 * to `PATCH tables/:tableId/columns/:columnId`.
 *
 * Design ref: https://claude.ai/code/artifact/b589c915-c92a-491e-80a5-3fe9c55a3bb6
 * (states 5, 9, 14)
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  columnNameClash,
  renameWarning,
  stepsUsingField,
  validateColumnStructure,
  type RateColumn,
  type RateColumnDataType,
  type RateColumnRole
} from "../../pages/admin/ratesListsHelpers";
import { markChargedFrom, type RateGridColumn } from "./rateGridModel";
import type { ChargeStep } from "../../lib/chargeStepTypes";

const MUTED = "var(--text-muted, #64748b)";
const BORDER = "var(--border-subtle, #E5E7EB)";
const BRAND = "var(--brand-primary, #005B61)";
const DANGER = "var(--status-danger, #DC2626)";
const WARNING = "var(--status-warning, #D97706)";

// ── Plain-language vocabulary ─────────────────────────────────────────────

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

// ── Props ─────────────────────────────────────────────────────────────────

export type ColumnSettingsPanelList = { name: string; slug: string };

export type ColumnSettingsPanelProps = {
  /** The column being edited. */
  column: RateColumn;
  /** All columns on this table (including the one being edited). */
  allColumns: RateColumn[];
  /** Available lists for the "Which list?" picker. */
  lists: ColumnSettingsPanelList[];
  /** Charge steps on this table — needed for the rename warning. */
  chargeSteps?: readonly ChargeStep[];
  /**
   * Number of locked tenders. When undefined the second clause of the rename
   * warning is omitted — the caller does not know the count.
   */
  lockedTenderCount?: number;
  /** Called with the changed fields only. */
  onSave: (patch: Partial<Omit<RateColumn, "id" | "sortOrder">>) => Promise<void>;
  onCancel: () => void;
};

// ── Panel ─────────────────────────────────────────────────────────────────

export function ColumnSettingsPanel({
  column,
  allColumns,
  lists,
  chargeSteps,
  lockedTenderCount,
  onSave,
  onCancel
}: ColumnSettingsPanelProps) {
  const ref = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState(column.name);
  const [role, setRole] = useState<RateColumnRole>(column.role);
  const [dataType, setDataType] = useState<RateColumnDataType>(column.dataType);
  const [unit, setUnit] = useState(column.unit ?? "");
  const [listSlug, setListSlug] = useState(column.listSlug ?? "");
  const [required, setRequired] = useState(column.required);
  const [min, setMin] = useState<string>(column.min !== null ? String(column.min) : "");
  const [max, setMax] = useState<string>(column.max !== null ? String(column.max) : "");
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onCancel();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onCancel]);

  // ── Derived validation ──────────────────────────────────────────────────

  const nameChanged = name.trim() !== column.name;

  /** Name clash against other columns (case-insensitive, ignores self). */
  const clashName = columnNameClash(allColumns, name.trim(), column.id);
  const hasNameClash = Boolean(clashName);

  /**
   * Structure check: replace this column in the set with its proposed values
   * and validate the resulting set.
   */
  const structureErrors: string[] = (() => {
    const proposed = allColumns.map((c) =>
      c.id === column.id
        ? {
            id: c.id,
            name: name.trim(),
            dataType,
            role,
            unit: dataType === "CURRENCY" || dataType === "NUMBER" ? unit.trim() || null : null,
            listSlug: dataType === "LIST_REF" ? listSlug.trim() || null : null,
            required,
            min: null,
            max: null,
            sortOrder: c.sortOrder
          }
        : c
    );
    return validateColumnStructure(proposed);
  })();

  /**
   * Steps naming the CURRENT column name — relevant only if the name changes.
   */
  const stepsNamingThis = stepsUsingField(chargeSteps, column.name);
  const renameWarn =
    nameChanged && stepsNamingThis.length > 0
      ? renameWarning(column.name, stepsNamingThis, lockedTenderCount)
      : null;

  /**
   * RATE_S1_CHARGED_FROM — does the role change move the charged-from mark?
   * If so, surface a warning. We compute before/after using markChargedFrom.
   */
  const chargedFromWarn: string | null = (() => {
    if (role === column.role) return null;
    // Convert allColumns to RateGridColumn shape for markChargedFrom
    const toGrid = (c: RateColumn, overrideRole?: RateColumnRole): RateGridColumn => ({
      key: c.id,
      label: c.name,
      kind: c.dataType === "CURRENCY" ? "currency" : c.dataType === "NUMBER" ? "number" : "text",
      role: (overrideRole ?? c.role) === "VALUE" ? "price" : (overrideRole ?? c.role) === "KEY" ? "lookup" : "info"
    });
    const before = markChargedFrom(allColumns.map((c) => toGrid(c)));
    const after = markChargedFrom(allColumns.map((c) => toGrid(c, c.id === column.id ? role : undefined)));
    const beforeCharged = before.find((c) => c.chargedFrom);
    const afterCharged = after.find((c) => c.chargedFrom);
    if (!beforeCharged || !afterCharged) return null;
    if (beforeCharged.label === afterCharged.label) return null;
    return (
      `This change moves the charged-from mark from "${beforeCharged.label}" to "${afterCharged.label}". ` +
      `New estimates will price at ${afterCharged.label} instead.`
    );
  })();

  /** There is only one price column (so the "only price" sub-line applies). */
  const isOnlyPrice =
    role === "VALUE" &&
    allColumns.filter((c) => c.id === column.id ? role === "VALUE" : c.role === "VALUE").length === 1;

  const hasBlocker = hasNameClash || structureErrors.length > 0;
  const hasSaveAnyway = !hasBlocker && Boolean(renameWarn || chargedFromWarn);

  const canSave = !busy && !hasBlocker && name.trim().length > 0;

  // ── Submit ──────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const patch: Partial<Omit<RateColumn, "id" | "sortOrder">> = {};
    const trimmedName = name.trim();
    if (trimmedName !== column.name) patch.name = trimmedName;
    if (role !== column.role) patch.role = role;
    if (dataType !== column.dataType) patch.dataType = dataType;

    const newUnit =
      dataType === "CURRENCY" || dataType === "NUMBER" ? unit.trim() || null :
      dataType === "LIST_REF" ? null :
      unit.trim() || null;
    if (newUnit !== column.unit) patch.unit = newUnit ?? undefined;

    const newListSlug = dataType === "LIST_REF" ? listSlug.trim() || null : null;
    if (newListSlug !== column.listSlug) patch.listSlug = newListSlug ?? undefined;

    if (required !== column.required) patch.required = required;

    const newMin = min.trim() !== "" ? Number(min.trim()) : null;
    const newMax = max.trim() !== "" ? Number(max.trim()) : null;
    if (newMin !== column.min) patch.min = newMin ?? undefined;
    if (newMax !== column.max) patch.max = newMax ?? undefined;

    if (Object.keys(patch).length === 0) {
      onCancel();
      return;
    }

    setBusy(true);
    try {
      await onSave(patch);
    } finally {
      setBusy(false);
    }
  };

  // ── The "conditional fourth slot" ─────────────────────────────────────

  const showPriceUnit = dataType === "CURRENCY" || dataType === "NUMBER";
  const showListPicker = dataType === "LIST_REF";
  const showMeasuredIn = !showPriceUnit && !showListPicker;

  // ── Styles ──────────────────────────────────────────────────────────────

  const panelStyle: CSSProperties = {
    position: "absolute",
    top: "100%",
    left: 0,
    marginTop: 4,
    zIndex: 20,
    background: "var(--text-inverse)",
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    boxShadow: "0 4px 16px rgba(15,23,42,0.14)",
    padding: 12,
    minWidth: 280,
    maxWidth: 340,
    fontSize: 13,
    fontWeight: 400,
    textAlign: "left"
  };

  const labelStyle: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    marginBottom: 10
  };

  const labelTextStyle: CSSProperties = {
    fontSize: 11,
    color: MUTED,
    fontWeight: 500
  };

  const errorStyle: CSSProperties = {
    fontSize: 11,
    color: DANGER,
    marginTop: 2
  };

  const warnStyle: CSSProperties = {
    fontSize: 11,
    color: WARNING,
    marginTop: 4,
    lineHeight: 1.4
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
          data-testid="col-settings-name"
        />
        {hasNameClash ? (
          <span style={errorStyle}>
            This table already has a column called &ldquo;{clashName}&rdquo;. Pick another name.
          </span>
        ) : null}
      </label>

      {/* 2. Role */}
      <div style={labelStyle}>
        <span style={labelTextStyle}>What is this column for?</span>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {(["KEY", "VALUE", "INFO"] as RateColumnRole[]).map((r) => (
            <label key={r} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 12 }}>
              <input
                type="radio"
                name="col-settings-role"
                value={r}
                checked={role === r}
                onChange={() => setRole(r)}
                style={{ marginTop: 2 }}
              />
              <span>
                {ROLE_LABELS[r]}
                {r === "VALUE" && isOnlyPrice ? (
                  <span style={{ display: "block", fontSize: 11, color: MUTED }}>
                    This table&rsquo;s only price - so it is the one estimates use
                  </span>
                ) : null}
              </span>
            </label>
          ))}
        </div>
        {chargedFromWarn ? (
          <span style={warnStyle}>{chargedFromWarn}</span>
        ) : null}
      </div>

      {/* 3. Data type */}
      <div style={labelStyle}>
        <span style={labelTextStyle}>What goes in it?</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {(["TEXT", "NUMBER", "CURRENCY", "DATE", "BOOL", "LIST_REF"] as RateColumnDataType[]).map(
            (t) => (
              <label key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                <input
                  type="radio"
                  name="col-settings-dtype"
                  value={t}
                  checked={dataType === t}
                  onChange={() => setDataType(t)}
                />
                {DATA_TYPE_LABELS[t]}
              </label>
            )
          )}
        </div>
      </div>

      {/* 4. Conditional fourth slot */}
      {showPriceUnit ? (
        <label style={labelStyle}>
          <span style={labelTextStyle}>$ per what?</span>
          <input
            className="s7-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="m / hr / tonne / day / hole"
            data-testid="col-settings-unit"
          />
        </label>
      ) : showListPicker ? (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Which list?</span>
          {lists.length > 0 ? (
            <select
              className="s7-select"
              value={listSlug}
              onChange={(e) => setListSlug(e.target.value)}
              data-testid="col-settings-listslug"
            >
              <option value="">Select a list…</option>
              {lists.map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              className="s7-input"
              value={listSlug}
              onChange={(e) => setListSlug(e.target.value)}
              placeholder="list-slug"
              data-testid="col-settings-listslug"
            />
          )}
        </label>
      ) : showMeasuredIn ? (
        <label style={labelStyle}>
          <span style={labelTextStyle}>Measured in (optional)</span>
          <input
            className="s7-input"
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="e.g. mm, kg"
            data-testid="col-settings-unit"
          />
        </label>
      ) : null}

      {/* 5. Required */}
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          data-testid="col-settings-required"
        />
        Must be filled in
      </label>

      {/* 6. More options */}
      <div style={{ marginBottom: 10 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => setMoreOpen((v) => !v)}
          style={{ justifyContent: "flex-start", minHeight: 28, fontSize: 12 }}
          data-testid="col-settings-more"
          aria-expanded={moreOpen}
        >
          {moreOpen ? "▾" : "▸"} More options
        </button>
        {moreOpen ? (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Smallest allowed</span>
              <input
                type="number"
                className="s7-input"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder="no minimum"
                data-testid="col-settings-min"
              />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Largest allowed</span>
              <input
                type="number"
                className="s7-input"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder="no maximum"
                data-testid="col-settings-max"
              />
            </label>
          </div>
        ) : null}
      </div>

      {/* Structure errors */}
      {structureErrors.length > 0 ? (
        <div style={{ ...errorStyle, marginBottom: 8 }}>
          {structureErrors.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      ) : null}

      {/* Rename warning (warn, not block) */}
      {renameWarn ? (
        <div style={{ ...warnStyle, marginBottom: 8 }}>{renameWarn}</div>
      ) : null}

      {/* Action row */}
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={onCancel}
          style={{ minHeight: 32 }}
        >
          Cancel
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled={!canSave}
          onClick={() => void handleSave()}
          style={{ minHeight: 32, borderColor: BRAND }}
          data-testid="col-settings-save"
        >
          {busy ? "Saving…" : hasSaveAnyway ? "Save anyway" : "Save"}
        </button>
      </div>
    </div>
  );
}
