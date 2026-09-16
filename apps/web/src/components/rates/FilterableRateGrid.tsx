import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject
} from "react";
import {
  compareRows,
  distinctValues,
  groupRows,
  matchesQuery,
  passesColumnFilters,
  passesNumberRange,
  type NumberRange,
  type RateGridColumn,
  type RateGridColumnRole,
  type RateGridRow,
  type RateGridRowValue
} from "./rateGridModel";
import type { RateColumn } from "../../pages/admin/ratesListsHelpers";

/**
 * RATE_S3_COLUMN_STRUCTURE — admin-only structure controls.
 *
 * When present: the header dropdown gains a divider and four structure items
 * (Column settings, Move left, Move right, Delete column). When absent (e.g.
 * the tender RatesTab) the dropdown is exactly what it is today.
 *
 * `renderSettings` is called from inside the header cell when the column
 * settings panel is open for that column. It returns the ReactNode to render
 * anchored under the header (same position as the dropdown). The parent owns
 * the panel state via `onOpenSettings`.
 */
export type StructureEditing = {
  onOpenSettings(col: RateGridColumn): void;
  onMove(col: RateGridColumn, dir: -1 | 1): void;
  onDelete(col: RateGridColumn): void;
  canMoveLeft(col: RateGridColumn): boolean;
  canMoveRight(col: RateGridColumn): boolean;
  /** Returns a refusal string when delete is not allowed, null when it is. */
  deleteRefusal(col: RateGridColumn): string | null;
  /** Key of the column whose settings panel is currently open. Null = none. */
  openSettingsKey: string | null;
  /** Renders the settings panel for the given column. */
  renderSettings(col: RateGridColumn): ReactNode;
};

/**
 * RATE_S3_STRUCTURE_ADDING — admin-only add-column and add-row controls.
 *
 * When present:
 *   - A `+` cell appears at the end of the header row. Clicking it starts
 *     the add-column flow: an editable header cell whose text becomes the new
 *     column name, then the S2 `ColumnSettingsPanel` in create mode.
 *   - A `+ Add a row` line appears after the last data row. When `addRowDraft`
 *     is set, the draft row is rendered in the grid with one editor per column.
 *
 * Absent on the tender RatesTab — every new prop is optional, so the existing
 * call sites pass nothing and gain nothing.
 */
export type StructureAdding = {
  /** Called when the user clicks the `+` column header button. */
  onAddColumn(): void;
  /** Called when the user clicks `+ Add a row`. */
  onAddRow(): void;
  /**
   * When set, a draft row is rendered in-grid with one editor per column.
   * The parent owns the draft cells (keyed by column id) and the commit/cancel
   * handlers.
   */
  addRowDraft?: {
    cells: Record<string, unknown>;
    columns: RateColumn[];
    onChange: (next: Record<string, unknown>) => void;
    errors: Array<{ columnId: string; message: string }>;
    onCommit: () => Promise<void>;
    onCancel: () => void;
    busy?: boolean;
  };
};

type Props = {
  columns: RateGridColumn[];
  rows: RateGridRow[];
  groupByKey?: string | null;
  trailingHeader?: ReactNode;
  renderTrailing?: (row: RateGridRow) => ReactNode;
  testIdPrefix: string;
  emptyState?: ReactNode;
  /**
   * RATE_SCENARIO_PICKER_V2 — mark ONE row as the row something outside this
   * grid is talking about. The admin Rates page uses it to point at the row
   * the charge-steps preview is pricing.
   *
   * OPTIONAL, and no highlight is the default: the tender Rates tab renders
   * this same grid and passes nothing, so it is unchanged. Marking is all it
   * does — no scroll, no selection, no filtering, and the other rows stay
   * exactly where they were.
   */
  highlightRowId?: string | null;
  /**
   * RATE_S3_COLUMN_STRUCTURE — admin-only. When present, the header chevron
   * dropdown gains Column settings / Move left / Move right / Delete column.
   * Absent on the tender RatesTab.
   */
  structureEditing?: StructureEditing;
  /**
   * RATE_S3_STRUCTURE_ADDING — admin-only. When present, a `+` appears at the
   * end of the header row (add column) and a `+ Add a row` line appears below
   * the last data row. Absent on the tender RatesTab.
   */
  structureAdding?: StructureAdding;
};

const ACCENT = "var(--text-accent, #EA580C)";
const BRAND = "var(--brand-primary)";
const BORDER = "var(--border-subtle, #E5E7EB)";
const MUTED = "var(--text-muted, #64748b)";

export function FilterableRateGrid({
  columns,
  rows,
  groupByKey,
  trailingHeader,
  renderTrailing,
  testIdPrefix,
  emptyState,
  highlightRowId = null,
  structureEditing,
  structureAdding
}: Props) {
  const defaultGroupKey =
    groupByKey === undefined
      ? columns.find((c) => c.groupable)?.key ?? null
      : groupByKey;

  const groupableExists = columns.some((c) => c.groupable);

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string | null; dir: 1 | -1 }>({
    key: null,
    dir: 1
  });
  const [columnFilters, setColumnFilters] = useState<Record<string, Set<string>>>({});
  const [numberRanges, setNumberRanges] = useState<Record<string, NumberRange>>({});
  const [groupingEnabled, setGroupingEnabled] = useState<boolean>(
    Boolean(defaultGroupKey) && groupableExists
  );
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [openDropdownKey, setOpenDropdownKey] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const activeGroupKey = groupingEnabled ? defaultGroupKey ?? null : null;

  const filteredRows = useMemo(() => {
    let out = rows.filter((r) => matchesQuery(r, columns, query));
    out = out.filter((r) => passesColumnFilters(r, columnFilters));
    for (const [key, range] of Object.entries(numberRanges)) {
      if (range.min === null && range.max === null) continue;
      out = out.filter((r) => passesNumberRange(r, key, range.min, range.max));
    }
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        const sorted = out.slice();
        sorted.sort((a, b) => compareRows(a, b, col, sort.dir));
        out = sorted;
      }
    }
    return out;
  }, [rows, columns, query, columnFilters, numberRanges, sort]);

  const grouped = useMemo(
    () => groupRows(filteredRows, activeGroupKey),
    [filteredRows, activeGroupKey]
  );

  const hasActiveFacets =
    query.trim() !== "" ||
    Object.values(columnFilters).some((s) => s && s.size > 0) ||
    Object.values(numberRanges).some((r) => r.min !== null || r.max !== null) ||
    sort.key !== null;

  const clearAll = () => {
    setQuery("");
    setColumnFilters({});
    setNumberRanges({});
    setSort({ key: null, dir: 1 });
    setCollapsedGroups({});
    setOpenDropdownKey(null);
  };

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 1 ? -1 : 1 } : { key, dir: 1 }
    );
  };

  const setSortExplicit = (key: string, dir: 1 | -1) => {
    setSort({ key, dir });
    setOpenDropdownKey(null);
  };

  const setValueFilter = (key: string, values: Set<string>) => {
    setColumnFilters((prev) => ({ ...prev, [key]: values }));
  };

  const clearValueFilter = (key: string) => {
    setColumnFilters((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const setRange = (key: string, range: NumberRange) => {
    setNumberRanges((prev) => ({ ...prev, [key]: range }));
  };

  const clearRange = (key: string) => {
    setNumberRanges((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  return (
    <div data-testid={`${testIdPrefix}-grid`}>
      <Toolbar
        query={query}
        onQueryChange={setQuery}
        groupingEnabled={groupingEnabled}
        canGroup={Boolean(defaultGroupKey) && groupableExists}
        onToggleGrouping={() => setGroupingEnabled((v) => !v)}
        onClear={clearAll}
        canClear={hasActiveFacets || Object.keys(collapsedGroups).length > 0}
        matchCount={filteredRows.length}
        totalCount={rows.length}
        testIdPrefix={testIdPrefix}
      />

      <ChipRow
        columns={columns}
        query={query}
        onClearQuery={() => setQuery("")}
        columnFilters={columnFilters}
        onClearFilter={clearValueFilter}
        numberRanges={numberRanges}
        onClearRange={clearRange}
        sort={sort}
        onClearSort={() => setSort({ key: null, dir: 1 })}
        testIdPrefix={testIdPrefix}
      />

      <div ref={scrollContainerRef} style={{ overflowX: "auto", position: "relative" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 14
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", borderBottom: `1px solid ${BORDER}` }}>
              {columns.map((col) => (
                <HeaderCell
                  key={col.key}
                  column={col}
                  rows={rows}
                  sort={sort}
                  onToggleSort={() => (col.sortable === false ? undefined : toggleSort(col.key))}
                  isOpen={openDropdownKey === col.key}
                  onOpen={() => setOpenDropdownKey(col.key)}
                  onClose={() => setOpenDropdownKey(null)}
                  columnFilter={columnFilters[col.key]}
                  onSetValueFilter={(vs) => setValueFilter(col.key, vs)}
                  onClearValueFilter={() => clearValueFilter(col.key)}
                  range={numberRanges[col.key]}
                  onSetRange={(r) => setRange(col.key, r)}
                  onClearRange={() => clearRange(col.key)}
                  onSort={(dir) => setSortExplicit(col.key, dir)}
                  testIdPrefix={testIdPrefix}
                  structureEditing={structureEditing}
                  scrollContainerRef={scrollContainerRef}
                />
              ))}
              {trailingHeader !== undefined ? (
                <th style={{ padding: "8px 12px", width: 80 }}>{trailingHeader}</th>
              ) : null}
              {structureAdding ? (
                <th style={{ padding: "4px 8px", width: 40 }}>
                  <button
                    type="button"
                    onClick={structureAdding.onAddColumn}
                    aria-label="Add column"
                    data-testid={`${testIdPrefix}-add-column`}
                    style={{
                      background: "transparent",
                      border: `1px dashed ${BORDER}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      color: MUTED,
                      fontSize: 16,
                      lineHeight: 1,
                      padding: "2px 8px",
                      fontWeight: 600
                    }}
                  >
                    +
                  </button>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (trailingHeader !== undefined ? 1 : 0) + (structureAdding ? 1 : 0)}
                  style={{ padding: 24, textAlign: "center", color: MUTED }}
                  data-testid={`${testIdPrefix}-empty`}
                >
                  {emptyState ?? "No rows match the current filters."}
                </td>
              </tr>
            ) : (
              grouped.map((group) => (
                <GroupSection
                  key={group.key}
                  groupKey={group.key}
                  rows={group.rows}
                  columns={columns}
                  groupingEnabled={groupingEnabled && activeGroupKey !== null}
                  collapsed={Boolean(collapsedGroups[group.key])}
                  onToggle={() =>
                    setCollapsedGroups((prev) => ({
                      ...prev,
                      [group.key]: !prev[group.key]
                    }))
                  }
                  renderTrailing={renderTrailing}
                  hasTrailing={trailingHeader !== undefined}
                  hasAddColumn={Boolean(structureAdding)}
                  highlightRowId={highlightRowId}
                  testIdPrefix={testIdPrefix}
                />
              ))
            )}
            {structureAdding ? (
              <>
                {structureAdding.addRowDraft ? (
                  <AddRowDraftRow
                    draft={structureAdding.addRowDraft}
                    gridColumns={columns}
                    hasTrailing={trailingHeader !== undefined}
                    testIdPrefix={testIdPrefix}
                  />
                ) : null}
                <tr>
                  <td
                    colSpan={columns.length + (trailingHeader !== undefined ? 1 : 0) + 1}
                    style={{ padding: "8px 12px" }}
                  >
                    <button
                      type="button"
                      onClick={structureAdding.onAddRow}
                      disabled={Boolean(structureAdding.addRowDraft)}
                      data-testid={`${testIdPrefix}-add-row`}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: structureAdding.addRowDraft ? "default" : "pointer",
                        color: structureAdding.addRowDraft ? MUTED : BRAND,
                        fontSize: 13,
                        fontWeight: 500,
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        opacity: structureAdding.addRowDraft ? 0.4 : 1
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
                      Add a row
                    </button>
                  </td>
                </tr>
              </>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Toolbar ──────────────────────────────────────────────────────────────

function Toolbar({
  query,
  onQueryChange,
  groupingEnabled,
  canGroup,
  onToggleGrouping,
  onClear,
  canClear,
  matchCount,
  totalCount,
  testIdPrefix
}: {
  query: string;
  onQueryChange: (v: string) => void;
  groupingEnabled: boolean;
  canGroup: boolean;
  onToggleGrouping: () => void;
  onClear: () => void;
  canClear: boolean;
  matchCount: number;
  totalCount: number;
  testIdPrefix: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        flexWrap: "wrap",
        marginBottom: 8
      }}
    >
      <label
        style={{
          position: "relative",
          flex: "1 1 220px",
          minWidth: 200,
          maxWidth: 360
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: 12,
            color: MUTED,
            pointerEvents: "none"
          }}
        >
          🔍
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search…"
          className="s7-input"
          style={{ paddingLeft: 26, width: "100%" }}
          data-testid={`${testIdPrefix}-search`}
        />
      </label>
      {canGroup ? (
        <button
          type="button"
          className="s7-btn s7-btn--sm"
          onClick={onToggleGrouping}
          aria-pressed={groupingEnabled}
          data-testid={`${testIdPrefix}-group-toggle`}
          style={{
            minHeight: 36,
            background: groupingEnabled ? "rgba(0,91,97,0.08)" : "transparent",
            color: groupingEnabled ? BRAND : "var(--text)",
            borderColor: groupingEnabled ? BRAND : BORDER,
            fontWeight: groupingEnabled ? 600 : 400
          }}
        >
          Group
        </button>
      ) : null}
      <button
        type="button"
        className="s7-btn s7-btn--ghost s7-btn--sm"
        onClick={onClear}
        disabled={!canClear}
        data-testid={`${testIdPrefix}-clear`}
        style={{ minHeight: 36 }}
      >
        Clear
      </button>
      <span
        style={{ marginLeft: "auto", fontSize: 12, color: MUTED }}
        data-testid={`${testIdPrefix}-count`}
      >
        {matchCount === totalCount
          ? `${totalCount} rows`
          : `${matchCount} of ${totalCount} rows`}
      </span>
    </div>
  );
}

// ── Chip row ─────────────────────────────────────────────────────────────

function ChipRow({
  columns,
  query,
  onClearQuery,
  columnFilters,
  onClearFilter,
  numberRanges,
  onClearRange,
  sort,
  onClearSort,
  testIdPrefix
}: {
  columns: RateGridColumn[];
  query: string;
  onClearQuery: () => void;
  columnFilters: Record<string, Set<string>>;
  onClearFilter: (key: string) => void;
  numberRanges: Record<string, NumberRange>;
  onClearRange: (key: string) => void;
  sort: { key: string | null; dir: 1 | -1 };
  onClearSort: () => void;
  testIdPrefix: string;
}) {
  const chips: Array<{ key: string; label: string; onClear: () => void }> = [];
  if (query.trim()) {
    chips.push({ key: "query", label: `Search: "${query.trim()}"`, onClear: onClearQuery });
  }
  for (const col of columns) {
    const f = columnFilters[col.key];
    if (f && f.size > 0) {
      const preview = Array.from(f).slice(0, 2).join(", ");
      const suffix = f.size > 2 ? ` +${f.size - 2}` : "";
      chips.push({
        key: `f-${col.key}`,
        label: `${col.label}: ${preview}${suffix}`,
        onClear: () => onClearFilter(col.key)
      });
    }
    const r = numberRanges[col.key];
    if (r && (r.min !== null || r.max !== null)) {
      const min = r.min === null ? "…" : String(r.min);
      const max = r.max === null ? "…" : String(r.max);
      chips.push({
        key: `r-${col.key}`,
        label: `${col.label}: ${min}–${max}`,
        onClear: () => onClearRange(col.key)
      });
    }
  }
  if (sort.key) {
    const col = columns.find((c) => c.key === sort.key);
    if (col) {
      chips.push({
        key: "sort",
        label: `Sort: ${col.label} ${sort.dir === 1 ? "↑" : "↓"}`,
        onClear: onClearSort
      });
    }
  }
  if (chips.length === 0) return null;
  return (
    <div
      style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}
      data-testid={`${testIdPrefix}-chips`}
    >
      {chips.map((chip) => (
        <span
          key={chip.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            fontSize: 12,
            borderRadius: 999,
            background: "rgba(0,91,97,0.08)",
            color: BRAND
          }}
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onClear}
            aria-label={`Clear ${chip.label}`}
            style={{
              background: "transparent",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              fontSize: 12,
              padding: 0,
              lineHeight: 1
            }}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

// ── Role chip ────────────────────────────────────────────────────────────

/**
 * Small inline chip that names the column's purpose.
 * Uses only s7-* design tokens — no hex literals, no new font.
 */
function RoleChip({
  role,
  chargedFrom
}: {
  role: RateGridColumnRole;
  chargedFrom?: boolean;
}) {
  let label: string;
  let chipStyle: CSSProperties;

  if (role === "price" && chargedFrom) {
    label = "the rate";
    chipStyle = {
      background: BRAND,
      color: "var(--text-inverse)",
      border: "none"
    };
  } else if (role === "price") {
    label = "price";
    chipStyle = {
      background: "transparent",
      color: BRAND,
      border: `1px solid ${BRAND}`
    };
  } else if (role === "lookup") {
    label = "look-up";
    chipStyle = {
      background: "rgba(0,91,97,0.08)",
      color: MUTED,
      border: "none"
    };
  } else {
    // info
    label = "info";
    chipStyle = {
      background: "rgba(148,163,184,0.15)",
      color: MUTED,
      border: "none"
    };
  }

  return (
    <span
      style={{
        ...chipStyle,
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 600,
        lineHeight: "16px",
        whiteSpace: "nowrap"
      }}
    >
      {label}
    </span>
  );
}

// ── Header cell + dropdown ───────────────────────────────────────────────

function HeaderCell({
  column,
  rows,
  sort,
  onToggleSort,
  isOpen,
  onOpen,
  onClose,
  columnFilter,
  onSetValueFilter,
  onClearValueFilter,
  range,
  onSetRange,
  onClearRange,
  onSort,
  testIdPrefix,
  structureEditing,
  scrollContainerRef
}: {
  column: RateGridColumn;
  rows: RateGridRow[];
  sort: { key: string | null; dir: 1 | -1 };
  onToggleSort: () => void;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  columnFilter: Set<string> | undefined;
  onSetValueFilter: (v: Set<string>) => void;
  onClearValueFilter: () => void;
  range: NumberRange | undefined;
  onSetRange: (r: NumberRange) => void;
  onClearRange: () => void;
  onSort: (dir: 1 | -1) => void;
  testIdPrefix: string;
  structureEditing?: StructureEditing;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const align = column.align ?? (column.kind === "text" ? "left" : "right");
  const hasFilter =
    (columnFilter && columnFilter.size > 0) ||
    (range && (range.min !== null || range.max !== null));
  const isSorted = sort.key === column.key;
  const filterable = column.filterable !== false;
  const sortable = column.sortable !== false;

  return (
    <th
      style={{
        padding: "8px 12px",
        textAlign: align,
        position: "sticky",
        top: 0,
        background: "var(--text-inverse)",
        zIndex: 1,
        color: hasFilter ? ACCENT : undefined,
        ...(column.chargedFrom
          ? { boxShadow: "inset 3px 0 0 0 var(--brand-primary)" }
          : undefined)
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={sortable ? onToggleSort : undefined}
          disabled={!sortable}
          style={{
            background: "transparent",
            border: "none",
            cursor: sortable ? "pointer" : "default",
            padding: 0,
            font: "inherit",
            color: "inherit",
            fontWeight: 600
          }}
          data-testid={`${testIdPrefix}-header-${column.key}`}
        >
          {column.label}
          {isSorted ? <span aria-hidden> {sort.dir === 1 ? "↑" : "↓"}</span> : null}
        </button>
        {column.labelSuffix ? <span>{column.labelSuffix}</span> : null}
        {column.role ? <RoleChip role={column.role} chargedFrom={column.chargedFrom} /> : null}
        {filterable ? (
          <button
            type="button"
            onClick={isOpen ? onClose : onOpen}
            aria-label={`Filter ${column.label}`}
            aria-expanded={isOpen}
            data-testid={`${testIdPrefix}-header-chevron-${column.key}`}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0 2px",
              color: hasFilter ? ACCENT : MUTED,
              fontSize: 10
            }}
          >
            ▾
          </button>
        ) : null}
      </span>
      {column.subline ? (
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2, fontWeight: 400 }}>
          {column.subline}
        </div>
      ) : null}
      {isOpen && filterable ? (
        <HeaderDropdown
          column={column}
          rows={rows}
          onClose={onClose}
          onSort={onSort}
          columnFilter={columnFilter}
          onSetValueFilter={onSetValueFilter}
          onClearValueFilter={onClearValueFilter}
          range={range}
          onSetRange={onSetRange}
          onClearRange={onClearRange}
          testIdPrefix={testIdPrefix}
          structureEditing={structureEditing}
          scrollContainerRef={scrollContainerRef}
        />
      ) : null}
      {structureEditing && structureEditing.openSettingsKey === column.key
        ? structureEditing.renderSettings(column)
        : null}
    </th>
  );
}

function HeaderDropdown({
  column,
  rows,
  onClose,
  onSort,
  columnFilter,
  onSetValueFilter,
  onClearValueFilter,
  range,
  onSetRange,
  onClearRange,
  testIdPrefix,
  structureEditing,
  scrollContainerRef
}: {
  column: RateGridColumn;
  rows: RateGridRow[];
  onClose: () => void;
  onSort: (dir: 1 | -1) => void;
  columnFilter: Set<string> | undefined;
  onSetValueFilter: (v: Set<string>) => void;
  onClearValueFilter: () => void;
  range: NumberRange | undefined;
  onSetRange: (r: NumberRange) => void;
  onClearRange: () => void;
  testIdPrefix: string;
  structureEditing?: StructureEditing;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [find, setFind] = useState("");

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const values = useMemo(() => distinctValues(rows, column.key), [rows, column.key]);
  const filtered = useMemo(() => {
    const q = find.trim().toLowerCase();
    if (!q) return values;
    return values.filter((v) => v.toLowerCase().includes(q));
  }, [values, find]);

  const isNumeric = column.kind === "number" || column.kind === "currency";
  const currentSet = columnFilter ?? new Set(values);
  const allSelected = filtered.every((v) => currentSet.has(v));

  // RATE_S3_COLUMN_STRUCTURE — flip: anchor right:0 when the dropdown would
  // overflow the scroll container on the right. Measured via bounding rect.
  const [flipRight, setFlipRight] = useState(false);
  useEffect(() => {
    if (!ref.current || !scrollContainerRef.current) return;
    const dropdownRect = ref.current.getBoundingClientRect();
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    if (dropdownRect.right > containerRect.right) {
      setFlipRight(true);
    }
  }, [scrollContainerRef]);

  const style: CSSProperties = {
    position: "absolute",
    top: "100%",
    marginTop: 4,
    ...(flipRight ? { right: 0 } : { left: 0 }),
    zIndex: 10,
    background: "var(--text-inverse)",
    border: `1px solid ${BORDER}`,
    borderRadius: 6,
    boxShadow: "0 4px 12px rgba(15,23,42,0.12)",
    padding: 8,
    minWidth: 220,
    fontSize: 13,
    fontWeight: 400,
    textAlign: "left"
  };

  return (
    <div
      ref={ref}
      style={style}
      role="dialog"
      aria-label={`${column.label} filter`}
      data-testid={`${testIdPrefix}-dropdown-${column.key}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => onSort(1)}
          style={{ justifyContent: "flex-start", minHeight: 32 }}
          data-testid={`${testIdPrefix}-sort-asc-${column.key}`}
        >
          Sort ascending
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => onSort(-1)}
          style={{ justifyContent: "flex-start", minHeight: 32 }}
          data-testid={`${testIdPrefix}-sort-desc-${column.key}`}
        >
          Sort descending
        </button>
      </div>
      <hr style={{ margin: "8px 0", border: "none", borderTop: `1px solid ${BORDER}` }} />
      {isNumeric ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: MUTED }}>Min</span>
            <input
              type="number"
              className="s7-input"
              value={range?.min ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onSetRange({
                  min: v === "" ? null : Number(v),
                  max: range?.max ?? null
                });
              }}
              data-testid={`${testIdPrefix}-min-${column.key}`}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: MUTED }}>Max</span>
            <input
              type="number"
              className="s7-input"
              value={range?.max ?? ""}
              onChange={(e) => {
                const v = e.target.value.trim();
                onSetRange({
                  min: range?.min ?? null,
                  max: v === "" ? null : Number(v)
                });
              }}
              data-testid={`${testIdPrefix}-max-${column.key}`}
            />
          </label>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={onClearRange}
            style={{ minHeight: 32 }}
          >
            Clear range
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <input
            className="s7-input"
            placeholder="Find value…"
            value={find}
            onChange={(e) => setFind(e.target.value)}
            data-testid={`${testIdPrefix}-find-${column.key}`}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  const next = new Set(currentSet);
                  filtered.forEach((v) => next.add(v));
                  if (next.size === values.length) {
                    onClearValueFilter();
                  } else {
                    onSetValueFilter(next);
                  }
                } else {
                  const next = new Set(currentSet);
                  filtered.forEach((v) => next.delete(v));
                  onSetValueFilter(next);
                }
              }}
            />
            (Select all)
          </label>
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              paddingRight: 4
            }}
          >
            {filtered.map((v) => {
              const checked = currentSet.has(v);
              return (
                <label
                  key={v}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 12
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    data-testid={`${testIdPrefix}-value-${column.key}-${v}`}
                    onChange={(e) => {
                      const next = new Set(currentSet);
                      if (e.target.checked) next.add(v);
                      else next.delete(v);
                      if (next.size === values.length) {
                        onClearValueFilter();
                      } else {
                        onSetValueFilter(next);
                      }
                    }}
                  />
                  {v === "" ? <em style={{ color: MUTED }}>(blank)</em> : v}
                </label>
              );
            })}
          </div>
        </div>
      )}
      {structureEditing ? (
        <>
          <hr style={{ margin: "8px 0", border: "none", borderTop: `1px solid ${BORDER}` }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => {
                onClose(); // close the filter dropdown first
                structureEditing.onOpenSettings(column);
              }}
              style={{ justifyContent: "flex-start", minHeight: 32 }}
              data-testid={`${testIdPrefix}-settings-${column.key}`}
            >
              Column settings
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => {
                structureEditing.onMove(column, -1);
                onClose();
              }}
              disabled={!structureEditing.canMoveLeft(column)}
              style={{ justifyContent: "flex-start", minHeight: 32 }}
              data-testid={`${testIdPrefix}-move-left-${column.key}`}
            >
              Move left
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => {
                structureEditing.onMove(column, 1);
                onClose();
              }}
              disabled={!structureEditing.canMoveRight(column)}
              style={{ justifyContent: "flex-start", minHeight: 32 }}
              data-testid={`${testIdPrefix}-move-right-${column.key}`}
            >
              Move right
            </button>
            {(() => {
              const refusal = structureEditing.deleteRefusal(column);
              return (
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={refusal ? undefined : () => {
                    structureEditing.onDelete(column);
                    onClose();
                  }}
                  disabled={Boolean(refusal)}
                  title={refusal ?? undefined}
                  style={{ justifyContent: "flex-start", minHeight: 32 }}
                  data-testid={`${testIdPrefix}-delete-col-${column.key}`}
                >
                  Delete column
                </button>
              );
            })()}
          </div>
        </>
      ) : null}
    </div>
  );
}

// ── Group section ────────────────────────────────────────────────────────

function GroupSection({
  groupKey,
  rows,
  columns,
  groupingEnabled,
  collapsed,
  onToggle,
  renderTrailing,
  hasTrailing,
  hasAddColumn,
  highlightRowId,
  testIdPrefix
}: {
  groupKey: string;
  rows: RateGridRow[];
  columns: RateGridColumn[];
  groupingEnabled: boolean;
  collapsed: boolean;
  onToggle: () => void;
  renderTrailing?: (row: RateGridRow) => ReactNode;
  hasTrailing: boolean;
  /** RATE_S3_STRUCTURE_ADDING — true when the grid has an add-column `+` header cell. */
  hasAddColumn?: boolean;
  highlightRowId: string | null;
  testIdPrefix: string;
}) {
  const colSpan = columns.length + (hasTrailing ? 1 : 0) + (hasAddColumn ? 1 : 0);
  return (
    <>
      {groupingEnabled ? (
        <tr style={{ background: "rgba(0,91,97,0.05)" }}>
          <td
            colSpan={colSpan}
            style={{ padding: "6px 12px", fontWeight: 600, color: BRAND }}
          >
            <button
              type="button"
              onClick={onToggle}
              aria-expanded={!collapsed}
              data-testid={`${testIdPrefix}-group-${groupKey}`}
              style={{
                background: "transparent",
                border: "none",
                color: "inherit",
                font: "inherit",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: 0
              }}
            >
              <span aria-hidden style={{ display: "inline-block", width: 10 }}>
                {collapsed ? "▸" : "▾"}
              </span>
              {groupKey === "" ? <em>(blank)</em> : groupKey}
              <span style={{ color: MUTED, fontWeight: 400 }}>({rows.length})</span>
            </button>
          </td>
        </tr>
      ) : null}
      {(!groupingEnabled || !collapsed) &&
        rows.map((row) => (
          <BodyRow
            key={row.id}
            row={row}
            columns={columns}
            renderTrailing={renderTrailing}
            hasTrailing={hasTrailing}
            hasAddColumn={hasAddColumn}
            highlighted={row.id === highlightRowId}
          />
        ))}
    </>
  );
}

function BodyRow({
  row,
  columns,
  renderTrailing,
  hasTrailing,
  hasAddColumn,
  highlighted = false
}: {
  row: RateGridRow;
  columns: RateGridColumn[];
  renderTrailing?: (row: RateGridRow) => ReactNode;
  hasTrailing: boolean;
  /** RATE_S3_STRUCTURE_ADDING — true when the grid has an add-column `+` header cell. */
  hasAddColumn?: boolean;
  /**
   * RATE_SCENARIO_PICKER_V2 — this is the row the caption under the grid is
   * pointing at. `BodyRow` has exactly ONE call site, so grouped, ungrouped,
   * filtered and sorted row paths all mark it the same way.
   */
  highlighted?: boolean;
}) {
  return (
    <tr
      data-highlighted={highlighted ? "true" : undefined}
      style={{
        // The row rule. `--border-subtle` carried a phantom literal fallback
        // that was not even the token's own value and could never have been
        // reached (tokens.css defines the token at `:root`); this slice's rule
        // is that every colour on a row comes from a token, and this is one.
        borderBottom: "1px solid var(--border-subtle)",
        // RATE_SCENARIO_PICKER_V2 — a token fill plus an inset left rule. Both
        // are tokens and neither is a hex literal: `--surface-hover` is
        // redefined for dark mode in tokens.css so the fill follows the theme,
        // and `--brand-accent` deliberately does NOT flip, so the same amber
        // rule reads against the light fill and the dark one. `inset` rather
        // than a real border, so marking a row does not shift the grid by 3px.
        ...(highlighted
          ? {
              background: "var(--surface-hover)",
              boxShadow: "inset 3px 0 0 0 var(--brand-accent)"
            }
          : null)
      }}
    >
      {columns.map((col) => {
        const custom = row.render?.[col.key];
        const align = col.align ?? (col.kind === "text" ? "left" : "right");
        const numericFont =
          col.kind === "number" || col.kind === "currency"
            ? "ui-monospace, SFMono-Regular, Menlo, monospace"
            : undefined;
        return (
          <td
            key={col.key}
            style={{
              padding: "8px 12px",
              textAlign: align,
              fontFamily: numericFont,
              verticalAlign: "middle",
              ...(col.chargedFrom
                ? { boxShadow: "inset 3px 0 0 0 var(--brand-primary)" }
                : undefined)
            }}
          >
            {custom !== undefined ? custom : renderDefault(col, row.values[col.key])}
          </td>
        );
      })}
      {hasTrailing ? (
        <td style={{ padding: "8px 12px", textAlign: "right" }}>
          {renderTrailing ? renderTrailing(row) : null}
        </td>
      ) : null}
      {hasAddColumn ? <td style={{ padding: "8px 12px" }} /> : null}
    </tr>
  );
}

// ── AddRowDraftRow ────────────────────────────────────────────────────────

/**
 * RATE_S3_STRUCTURE_ADDING — the draft row rendered in-grid when `addRowDraft`
 * is set. One editor per column chosen by the column's kind:
 *   - LIST_REF -> select over that list's items (ListRefCellEditor)
 *   - number/money -> numeric box
 *   - everything else -> text input
 *
 * Cells are keyed by column id (not position). The parent owns the cells map
 * and the commit/cancel handlers.
 */
function AddRowDraftRow({
  draft,
  gridColumns,
  hasTrailing,
  testIdPrefix
}: {
  draft: NonNullable<StructureAdding["addRowDraft"]>;
  gridColumns: RateGridColumn[];
  hasTrailing: boolean;
  testIdPrefix: string;
}) {
  const errorByColumn = new Map<string, string>();
  for (const e of draft.errors) errorByColumn.set(e.columnId, e.message);

  return (
    <>
      <tr
        style={{
          background: "rgba(254,170,109,0.06)",
          borderBottom: "1px solid var(--border-subtle)"
        }}
      >
        {draft.columns.map((c) => {
          const err = errorByColumn.get(c.id);
          const align = c.dataType === "NUMBER" || c.dataType === "CURRENCY" ? "right" : "left";
          return (
            <td
              key={c.id}
              style={{
                padding: "6px 8px",
                textAlign: align,
                verticalAlign: "middle"
              }}
            >
              <InlineCellEditor
                column={c}
                value={draft.cells[c.id]}
                onChange={(v) => draft.onChange({ ...draft.cells, [c.id]: v })}
                testIdPrefix={testIdPrefix}
                error={err}
              />
            </td>
          );
        })}
        {hasTrailing ? <td style={{ padding: "6px 8px" }} /> : null}
        {/* The add-column `+` header cell — trailing blank */}
        <td style={{ padding: "6px 8px" }} />
      </tr>
      <tr style={{ background: "rgba(254,170,109,0.04)" }}>
        <td
          colSpan={draft.columns.length + (hasTrailing ? 1 : 0) + 1}
          style={{ padding: "6px 12px", textAlign: "right" }}
        >
          <span style={{ display: "inline-flex", gap: 8 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={draft.onCancel}
              style={{ minHeight: 32 }}
              data-testid={`${testIdPrefix}-draft-cancel`}
            >
              Cancel
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={draft.errors.length > 0 || draft.busy}
              onClick={() => void draft.onCommit()}
              style={{ minHeight: 32 }}
              data-testid={`${testIdPrefix}-draft-commit`}
            >
              {draft.busy ? "Adding…" : "Add the row"}
            </button>
          </span>
        </td>
      </tr>
    </>
  );
}

/**
 * RATE_S3_STRUCTURE_ADDING — minimal in-cell editor for the draft row.
 * Reuses the same logic as the page's `CellEditor` / `ListRefCellEditor` but
 * lives here so the grid has no page import.
 */
function InlineCellEditor({
  column,
  value,
  onChange,
  testIdPrefix,
  error
}: {
  column: RateColumn;
  value: unknown;
  onChange: (next: unknown) => void;
  testIdPrefix: string;
  error?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {column.dataType === "BOOL" ? (
        <label style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            data-testid={`${testIdPrefix}-draft-${column.id}`}
          />
          <span style={{ fontSize: 12 }}>{value ? "yes" : "no"}</span>
        </label>
      ) : column.dataType === "DATE" ? (
        <input
          type="date"
          className="s7-input"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`${testIdPrefix}-draft-${column.id}`}
        />
      ) : column.dataType === "NUMBER" || column.dataType === "CURRENCY" ? (
        <input
          type="number"
          inputMode="decimal"
          className="s7-input"
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`${testIdPrefix}-draft-${column.id}`}
        />
      ) : column.dataType === "LIST_REF" ? (
        <InlineListRefEditor
          listSlug={column.listSlug ?? ""}
          value={typeof value === "string" ? value : ""}
          onChange={onChange}
          testId={`${testIdPrefix}-draft-${column.id}`}
        />
      ) : (
        <input
          className="s7-input"
          value={typeof value === "string" ? value : String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          data-testid={`${testIdPrefix}-draft-${column.id}`}
        />
      )}
      {error ? (
        <div style={{ fontSize: 11, color: "var(--status-danger)" }}>{error}</div>
      ) : null}
    </div>
  );
}

/**
 * RATE_S3_STRUCTURE_ADDING — list-column editor for the draft row.
 * Mirrors `ListRefCellEditor` in the page but is self-contained in the grid
 * component so the grid can render editors without importing the full page.
 */
function InlineListRefEditor({
  listSlug,
  value,
  onChange,
  testId
}: {
  listSlug: string;
  value: string;
  onChange: (next: string) => void;
  testId: string;
}) {
  const [items, setItems] = useState<Array<{ id: string; value: string; label: string }> | null>(null);

  useEffect(() => {
    if (!listSlug) return;
    let cancelled = false;
    // Use a plain fetch — the grid has no auth context. The page's
    // ListRefCellEditor uses authFetch; this one mirrors the pattern but relies
    // on the session cookie (same-origin). For local dev with httpOnly cookies
    // this is equivalent.
    fetch(`/api/lists/${listSlug}/items`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as Array<{ id: string; value: string; label: string; isArchived: boolean }>;
        if (!cancelled) setItems(body.filter((i) => !i.isArchived));
      })
      .catch(() => { /* ignore network errors; the page's editor handles them */ });
    return () => { cancelled = true; };
  }, [listSlug]);

  return (
    <select
      className="s7-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={testId}
    >
      <option value="">—</option>
      {(items ?? []).map((i) => (
        <option key={i.id} value={i.value}>
          {i.label}
        </option>
      ))}
    </select>
  );
}

function renderDefault(_col: RateGridColumn, value: RateGridRowValue): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
