import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
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
  type RateGridRow,
  type RateGridRowValue
} from "./rateGridModel";

type Props = {
  columns: RateGridColumn[];
  rows: RateGridRow[];
  groupByKey?: string | null;
  trailingHeader?: ReactNode;
  renderTrailing?: (row: RateGridRow) => ReactNode;
  testIdPrefix: string;
  emptyState?: ReactNode;
};

const ACCENT = "var(--text-accent, #EA580C)";
const BRAND = "var(--brand-primary, #005B61)";
const BORDER = "var(--border-subtle, #E5E7EB)";
const MUTED = "var(--text-muted, #64748b)";

export function FilterableRateGrid({
  columns,
  rows,
  groupByKey,
  trailingHeader,
  renderTrailing,
  testIdPrefix,
  emptyState
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

      <div style={{ overflowX: "auto", position: "relative" }}>
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
                />
              ))}
              {trailingHeader !== undefined ? (
                <th style={{ padding: "8px 12px", width: 80 }}>{trailingHeader}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (trailingHeader !== undefined ? 1 : 0)}
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
                  testIdPrefix={testIdPrefix}
                />
              ))
            )}
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
  testIdPrefix
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
        background: "var(--surface, #fff)",
        zIndex: 1,
        color: hasFilter ? ACCENT : undefined
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
        />
      ) : null}
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
  testIdPrefix
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

  const style: CSSProperties = {
    position: "absolute",
    top: "100%",
    marginTop: 4,
    left: 0,
    zIndex: 10,
    background: "var(--surface, #fff)",
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
  testIdPrefix: string;
}) {
  const colSpan = columns.length + (hasTrailing ? 1 : 0);
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
          />
        ))}
    </>
  );
}

function BodyRow({
  row,
  columns,
  renderTrailing,
  hasTrailing
}: {
  row: RateGridRow;
  columns: RateGridColumn[];
  renderTrailing?: (row: RateGridRow) => ReactNode;
  hasTrailing: boolean;
}) {
  return (
    <tr style={{ borderBottom: `1px solid var(--border-subtle, #F1F5F9)` }}>
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
              verticalAlign: "middle"
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
    </tr>
  );
}

function renderDefault(_col: RateGridColumn, value: RateGridRowValue): ReactNode {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
