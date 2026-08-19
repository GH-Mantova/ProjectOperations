/**
 * S4 — Create Schedule of Rates wizard (rate-hub-sor-integration-plan.md §S4).
 *
 * Four-step state-machine wizard:
 *   Step 1 — Period details (year, half, startDate, expiryDate, label)
 *   Step 2 — Select lines (3 sub-tabs: Internal / Subcontractors / Suppliers)
 *   Step 3 — Review + markup (editable per-line markupPct, effective rate preview)
 *   Step 4 — Confirm (summary + "Create SoR" button)
 *
 * On success, navigates back to /admin/schedule-of-rates with ?highlight=<newId>.
 * No external wizard library. No Prisma/schema touch. No migration.
 */

import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";

// ── Types ─────────────────────────────────────────────────────────────────────

type SorPeriodHalf = "H1" | "H2";
type SorCategory = "LABOUR" | "PLANT" | "WASTE" | "SUBCONTRACTOR";
type SorRateSourceType = "INTERNAL" | "SUBBIE" | "SUPPLIER" | "MANUAL";

// Hub-view (S1) vendor shape — /subcontractors/hub-view
type RateLine = {
  id: string;
  discipline: string;
  unit: string;
  rate: string; // Decimal serialised as string
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
};

type VendorEntry = {
  id: string;
  name: string;
  entityType: string;
  rates: RateLine[];
};

type VendorTypeGroup = {
  typeId: string | null;
  typeLabel: string;
  vendors: VendorEntry[];
};

// Internal rate table row — /rates/tables/:id
type RateTableColumn = {
  id: string;
  name: string;
  role: string; // KEY | VALUE | INFO
  dataType: string;
};

type RateTableRow = {
  id: string;
  cells: Record<string, unknown>;
  isActive: boolean;
};

type RateTableFull = {
  id: string;
  name: string;
  slug: string;
  columns: RateTableColumn[];
  rows: RateTableRow[];
};

type RateTableSummary = {
  id: string;
  name: string;
  slug: string;
  category: string;
  columns: RateTableColumn[];
};

// Selected line that flows through the wizard
type WizardLine = {
  key: string; // unique id within the wizard (sourceRateRowId | sourceSubRateId | manual-uuid)
  name: string;
  category: SorCategory;
  unit: string;
  baseRate: number;
  sourceType: SorRateSourceType;
  sourceRateRowId?: string;
  sourceSubRateId?: string;
  markupPct: number | null; // per-line override; null = use category default (0 at create time)
};

// POST body for /schedule-of-rates/create-period
type CreateSorPayload = {
  year: number;
  half: SorPeriodHalf;
  startDate: string;
  expiryDate: string;
  label: string;
  lines: Array<{
    name: string;
    category: SorCategory;
    unit?: string;
    baseRate: number;
    sourceType: SorRateSourceType;
    sourceRateRowId?: string;
    sourceSubRateId?: string;
    markupPct?: number;
  }>;
};

// ── Step types ────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

type PeriodDetails = {
  year: string;
  half: SorPeriodHalf;
  startDate: string;
  expiryDate: string;
  label: string;
};

const BLANK_PERIOD: PeriodDetails = {
  year: String(new Date().getFullYear()),
  half: "H1",
  startDate: "",
  expiryDate: "",
  label: ""
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeEffective(baseRate: number, markupPct: number | null): number {
  const pct = markupPct ?? 0;
  return round2(baseRate * (1 + pct / 100));
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "var(--surface, #fff)",
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 8,
  padding: "20px 24px",
  marginBottom: 20
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 600,
  fontSize: 13,
  marginBottom: 4,
  color: "var(--text)"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  fontSize: 14,
  border: "1px solid var(--border, #e5e7eb)",
  borderRadius: 4,
  background: "var(--surface, #fff)",
  color: "var(--text)",
  boxSizing: "border-box"
};

const selectStyle: React.CSSProperties = { ...inputStyle };

const btnPrimary: React.CSSProperties = {
  padding: "9px 20px",
  background: "var(--brand-primary, #005B61)",
  color: "#fff",
  border: "none",
  borderRadius: 5,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer"
};

const btnSecondary: React.CSSProperties = {
  padding: "9px 20px",
  background: "transparent",
  color: "var(--brand-primary, #005B61)",
  border: "1px solid var(--brand-primary, #005B61)",
  borderRadius: 5,
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer"
};

const thStyle: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "left",
  fontWeight: 600,
  fontSize: 12,
  color: "var(--text-muted)",
  borderBottom: "1px solid var(--border, #e5e7eb)",
  whiteSpace: "nowrap"
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  fontSize: 13,
  verticalAlign: "middle",
  borderTop: "1px solid var(--border, #e5e7eb)"
};

// ── Step 1 ── Period Details ───────────────────────────────────────────────────

function Step1({
  details,
  onChange,
  onNext
}: {
  details: PeriodDetails;
  onChange: (d: PeriodDetails) => void;
  onNext: () => void;
}) {
  const yearNum = parseInt(details.year, 10);
  const yearValid = Number.isFinite(yearNum) && yearNum >= 2020 && yearNum <= 2099;
  const canContinue =
    yearValid &&
    !!details.startDate &&
    !!details.expiryDate &&
    !!details.label.trim();

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, fontWeight: 700 }}>
        Step 1 — Period Details
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div>
          <label style={labelStyle} htmlFor="sor-year">Year</label>
          <input
            id="sor-year"
            type="number"
            min={2020}
            max={2099}
            step={1}
            style={inputStyle}
            value={details.year}
            onChange={(e) => onChange({ ...details, year: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="sor-half">Half</label>
          <select
            id="sor-half"
            style={selectStyle}
            value={details.half}
            onChange={(e) => onChange({ ...details, half: e.target.value as SorPeriodHalf })}
          >
            <option value="H1">H1 (Jan–Jun)</option>
            <option value="H2">H2 (Jul–Dec)</option>
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="sor-start">Start date</label>
          <input
            id="sor-start"
            type="date"
            style={inputStyle}
            value={details.startDate}
            onChange={(e) => onChange({ ...details, startDate: e.target.value })}
          />
        </div>
        <div>
          <label style={labelStyle} htmlFor="sor-expiry">Expiry date</label>
          <input
            id="sor-expiry"
            type="date"
            style={inputStyle}
            value={details.expiryDate}
            onChange={(e) => onChange({ ...details, expiryDate: e.target.value })}
          />
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <label style={labelStyle} htmlFor="sor-label">Label</label>
        <input
          id="sor-label"
          type="text"
          style={inputStyle}
          placeholder="e.g. 2026 H1 Master Rates"
          value={details.label}
          onChange={(e) => onChange({ ...details, label: e.target.value })}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          style={canContinue ? btnPrimary : { ...btnPrimary, opacity: 0.5, cursor: "not-allowed" }}
          disabled={!canContinue}
          onClick={onNext}
        >
          Next: Select lines
        </button>
      </div>
    </div>
  );
}

// ── Step 2 ── Select Lines ────────────────────────────────────────────────────

type LinePicker2Tab = "internal" | "subcontractors" | "suppliers";

function Step2({
  selected,
  onToggleLine,
  onNext,
  onBack,
  authFetch
}: {
  selected: Set<string>;
  onToggleLine: (line: WizardLine, checked: boolean) => void;
  onNext: () => void;
  onBack: () => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [tab, setTab] = useState<LinePicker2Tab>("internal");

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, fontWeight: 700 }}>
        Step 2 — Select Lines
      </h2>

      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0, marginBottom: 12 }}>
        Check the lines you want to include in this SoR period. Use the tabs to browse Internal
        hub rates, Subcontractors, and Suppliers.
      </p>

      {/* Sub-tabs */}
      <div
        role="tablist"
        style={{
          display: "flex",
          gap: 4,
          borderBottom: "1px solid var(--border, #e5e7eb)",
          marginBottom: 16
        }}
      >
        {(["internal", "subcontractors", "suppliers"] as LinePicker2Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            style={{
              minHeight: 40,
              padding: "0 18px",
              background: "transparent",
              border: "none",
              borderBottom:
                tab === t
                  ? "3px solid var(--brand-primary, #005B61)"
                  : "3px solid transparent",
              color:
                tab === t ? "var(--brand-primary, #005B61)" : "var(--text)",
              fontWeight: tab === t ? 600 : 500,
              cursor: "pointer",
              fontSize: 13,
              textTransform: "capitalize"
            }}
          >
            {t === "internal" ? "Internal" : t === "subcontractors" ? "Subcontractors" : "Suppliers"}
          </button>
        ))}
      </div>

      {tab === "internal" && (
        <InternalLinePicker selected={selected} onToggleLine={onToggleLine} authFetch={authFetch} />
      )}
      {tab === "subcontractors" && (
        <VendorLinePicker
          entityType="subcontractor"
          selected={selected}
          onToggleLine={onToggleLine}
          authFetch={authFetch}
        />
      )}
      {tab === "suppliers" && (
        <VendorLinePicker
          entityType="supplier"
          selected={selected}
          onToggleLine={onToggleLine}
          authFetch={authFetch}
        />
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button type="button" style={btnSecondary} onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          style={selected.size > 0 ? btnPrimary : { ...btnPrimary, opacity: 0.5, cursor: "not-allowed" }}
          disabled={selected.size === 0}
          onClick={onNext}
        >
          Next: Review &amp; markup ({selected.size} selected)
        </button>
      </div>
    </div>
  );
}

// Internal lines from rate tables
function InternalLinePicker({
  selected,
  onToggleLine,
  authFetch
}: {
  selected: Set<string>;
  onToggleLine: (line: WizardLine, checked: boolean) => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [tables, setTables] = useState<RateTableSummary[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [tableDetail, setTableDetail] = useState<RateTableFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTables = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/rates/tables");
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load rate tables."));
      const data = (await res.json()) as RateTableSummary[];
      // Only show INITIAL_SERVICES tables (internal hub)
      const internal = data.filter((t) => t.category === "INITIAL_SERVICES");
      setTables(internal);
      if (internal.length > 0) setSelectedTableId(internal[0].id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  const loadTableDetail = useCallback(
    async (id: string) => {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/rates/tables/${id}`);
        if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load table."));
        setTableDetail((await res.json()) as RateTableFull);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [authFetch]
  );

  useEffect(() => {
    void loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedTableId) void loadTableDetail(selectedTableId);
  }, [selectedTableId, loadTableDetail]);

  if (loading) {
    return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading rate tables&hellip;</p>;
  }
  if (error) {
    return <p style={{ color: "var(--error, #dc2626)", fontSize: 13 }}>{error}</p>;
  }
  if (tables.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        No internal rate tables found. Add tables in Settings &rarr; Reference data.
      </p>
    );
  }

  // Determine VALUE columns to find the base rate
  const valueColumns = tableDetail?.columns.filter((c) => c.role === "VALUE") ?? [];
  const keyColumns = tableDetail?.columns.filter((c) => c.role === "KEY") ?? [];

  // Category inference from slug
  function inferCategory(slug: string): SorCategory {
    if (slug.includes("labour")) return "LABOUR";
    if (slug.includes("plant")) return "PLANT";
    if (slug.includes("waste")) return "WASTE";
    return "LABOUR";
  }

  function makeLineFromRow(row: RateTableRow): WizardLine | null {
    if (!tableDetail) return null;
    const slug = tableDetail.slug;
    // Name: first KEY cell value, or fallback
    const nameCells = keyColumns.map((col) => String(row.cells[col.id] ?? "")).filter(Boolean);
    const name = nameCells.join(" – ") || "Rate";
    // Base rate: first VALUE cell that is numeric
    let baseRate = 0;
    let unit = "";
    for (const col of valueColumns) {
      const raw = row.cells[col.id];
      const num = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
      if (Number.isFinite(num) && num > 0) {
        baseRate = num;
        unit = col.name;
        break;
      }
    }
    const category = inferCategory(slug);
    return {
      key: row.id,
      name,
      category,
      unit,
      baseRate,
      sourceType: "INTERNAL" as SorRateSourceType,
      sourceRateRowId: row.id,
      markupPct: null
    };
  }

  const activeRows = tableDetail?.rows.filter((r) => r.isActive) ?? [];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <label style={labelStyle} htmlFor="int-table-select">Rate table</label>
        <select
          id="int-table-select"
          style={{ ...selectStyle, maxWidth: 320 }}
          value={selectedTableId}
          onChange={(e) => setSelectedTableId(e.target.value)}
        >
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {!tableDetail || activeRows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No active rows in this table.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-subtle, #f9fafb)" }}>
              <th style={{ ...thStyle, width: 32 }}></th>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Category</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Base rate</th>
              <th style={thStyle}>Unit</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((row) => {
              const line = makeLineFromRow(row);
              if (!line) return null;
              const checked = selected.has(line.key);
              return (
                <tr key={row.id}>
                  <td style={tdStyle}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => onToggleLine(line, e.target.checked)}
                    />
                  </td>
                  <td style={tdStyle}>{line.name}</td>
                  <td style={tdStyle}>
                    <CategoryBadge category={line.category} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.baseRate > 0 ? fmtCurrency(line.baseRate) : "—"}
                  </td>
                  <td style={tdStyle}>{line.unit || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Vendor lines from hub-view
function VendorLinePicker({
  entityType,
  selected,
  onToggleLine,
  authFetch
}: {
  entityType: "subcontractor" | "supplier";
  selected: Set<string>;
  onToggleLine: (line: WizardLine, checked: boolean) => void;
  authFetch: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const [groups, setGroups] = useState<VendorTypeGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = `?entityType=${encodeURIComponent(entityType)}`;
      const res = await authFetch(`/subcontractors/hub-view${qs}`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res, "Failed to load vendor rates."));
      setGroups((await res.json()) as VendorTypeGroup[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, entityType]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading vendor rates&hellip;</p>;
  if (error) return <p style={{ color: "var(--error, #dc2626)", fontSize: 13 }}>{error}</p>;

  const sourceType: SorRateSourceType = entityType === "subcontractor" ? "SUBBIE" : "SUPPLIER";

  const allRates: Array<{ group: VendorTypeGroup; vendor: VendorEntry; rate: RateLine }> = [];
  for (const group of groups) {
    for (const vendor of group.vendors) {
      for (const rate of vendor.rates) {
        if (rate.isActive) {
          allRates.push({ group, vendor, rate });
        }
      }
    }
  }

  if (allRates.length === 0) {
    return (
      <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
        No active {entityType} rates found. Add rates via the vendor detail card.
      </p>
    );
  }

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "var(--surface-subtle, #f9fafb)" }}>
          <th style={{ ...thStyle, width: 32 }}></th>
          <th style={thStyle}>Vendor</th>
          <th style={thStyle}>Type</th>
          <th style={thStyle}>Discipline</th>
          <th style={{ ...thStyle, textAlign: "right" }}>Rate</th>
          <th style={thStyle}>Unit</th>
        </tr>
      </thead>
      <tbody>
        {allRates.map(({ group, vendor, rate }) => {
          const lineKey = rate.id;
          const checked = selected.has(lineKey);
          const baseRate = parseFloat(rate.rate ?? "0");
          const line: WizardLine = {
            key: lineKey,
            name: `${vendor.name} — ${rate.discipline}`,
            category: "SUBCONTRACTOR" as SorCategory,
            unit: rate.unit,
            baseRate: Number.isFinite(baseRate) ? baseRate : 0,
            sourceType,
            sourceSubRateId: rate.id,
            markupPct: null
          };
          return (
            <tr key={rate.id}>
              <td style={tdStyle}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggleLine(line, e.target.checked)}
                />
              </td>
              <td style={tdStyle}>{vendor.name}</td>
              <td style={tdStyle}>{group.typeLabel}</td>
              <td style={tdStyle}>{rate.discipline}</td>
              <td style={{ ...tdStyle, textAlign: "right" }}>
                {Number.isFinite(baseRate) && baseRate > 0 ? fmtCurrency(baseRate) : "—"}
              </td>
              <td style={tdStyle}>{rate.unit || "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Step 3 ── Review + markup ─────────────────────────────────────────────────

function Step3({
  lines,
  onLineMarkupChange,
  onNext,
  onBack
}: {
  lines: WizardLine[];
  onLineMarkupChange: (key: string, pct: number | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 17, fontWeight: 700 }}>
        Step 3 — Review &amp; Markup
      </h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        Edit the per-line markup % override (leave blank to use the period default — 0% at creation).
        The effective rate column updates as you type.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-subtle, #f9fafb)" }}>
              <th style={thStyle}>Name</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Source</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Base rate</th>
              <th style={{ ...thStyle, textAlign: "right", width: 100 }}>Markup %</th>
              <th style={{ ...thStyle, textAlign: "right" }}>Effective rate</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const effective = computeEffective(line.baseRate, line.markupPct);
              return (
                <tr key={line.key}>
                  <td style={tdStyle}>{line.name}</td>
                  <td style={tdStyle}>
                    <CategoryBadge category={line.category} />
                  </td>
                  <td style={tdStyle}>
                    <SourceBadge sourceType={line.sourceType} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.baseRate > 0 ? fmtCurrency(line.baseRate) : "—"}
                  </td>
                  <td style={tdStyle}>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      step={0.1}
                      placeholder="—"
                      style={{
                        width: 80,
                        padding: "4px 6px",
                        border: "1px solid var(--border, #e5e7eb)",
                        borderRadius: 4,
                        fontSize: 13,
                        textAlign: "right"
                      }}
                      value={line.markupPct ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value.trim();
                        if (raw === "") {
                          onLineMarkupChange(line.key, null);
                        } else {
                          const num = parseFloat(raw);
                          if (Number.isFinite(num)) onLineMarkupChange(line.key, num);
                        }
                      }}
                    />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                    {effective > 0 ? fmtCurrency(effective) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button type="button" style={btnSecondary} onClick={onBack}>
          Back
        </button>
        <button type="button" style={btnPrimary} onClick={onNext}>
          Next: Confirm
        </button>
      </div>
    </div>
  );
}

// ── Step 4 ── Confirm ─────────────────────────────────────────────────────────

function Step4({
  details,
  lines,
  submitting,
  error,
  onBack,
  onSubmit
}: {
  details: PeriodDetails;
  lines: WizardLine[];
  submitting: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const categoryGroups = groupByCategory(lines);

  return (
    <div style={cardStyle}>
      <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: 17, fontWeight: 700 }}>
        Step 4 — Confirm
      </h2>

      {/* Period summary */}
      <div
        style={{
          background: "var(--surface-subtle, #f9fafb)",
          border: "1px solid var(--border, #e5e7eb)",
          borderRadius: 6,
          padding: "14px 18px",
          marginBottom: 20
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <SummaryField label="Period" value={`${details.year} ${details.half}`} />
          <SummaryField label="Label" value={details.label} />
          <SummaryField label="Status" value="ACTIVE (default)" />
          <SummaryField label="Start date" value={fmtDate(details.startDate)} />
          <SummaryField label="Expiry date" value={fmtDate(details.expiryDate)} />
          <SummaryField label="Total lines" value={String(lines.length)} />
        </div>
      </div>

      {/* Lines by category */}
      {(Object.entries(categoryGroups) as [SorCategory, WizardLine[]][]).map(([cat, catLines]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <h3
            style={{
              marginTop: 0,
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.05em"
            }}
          >
            {cat} ({catLines.length})
          </h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-subtle, #f9fafb)" }}>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Source</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Base</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Markup</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Effective</th>
              </tr>
            </thead>
            <tbody>
              {catLines.map((line) => (
                <tr key={line.key}>
                  <td style={tdStyle}>{line.name}</td>
                  <td style={tdStyle}>
                    <SourceBadge sourceType={line.sourceType} />
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.baseRate > 0 ? fmtCurrency(line.baseRate) : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    {line.markupPct != null ? `${line.markupPct}%` : "—"}
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                    {fmtCurrency(computeEffective(line.baseRate, line.markupPct))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {error ? (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: "var(--error-surface, #fef2f2)",
            border: "1px solid var(--error, #dc2626)",
            borderRadius: 5,
            color: "var(--error, #dc2626)",
            fontSize: 13
          }}
        >
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button type="button" style={btnSecondary} onClick={onBack} disabled={submitting}>
          Back
        </button>
        <button
          type="button"
          style={submitting ? { ...btnPrimary, opacity: 0.6, cursor: "not-allowed" } : btnPrimary}
          disabled={submitting}
          onClick={onSubmit}
        >
          {submitting ? "Creating SoR…" : "Create SoR"}
        </button>
      </div>
    </div>
  );
}

// ── Shared badge components ───────────────────────────────────────────────────

const CAT_COLORS: Record<SorCategory, string> = {
  LABOUR: "#3b82f6",
  PLANT: "#f59e0b",
  WASTE: "#16a34a",
  SUBCONTRACTOR: "#8b5cf6"
};

function CategoryBadge({ category }: { category: SorCategory }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        background: CAT_COLORS[category] ?? "#6b7280",
        color: "#fff"
      }}
    >
      {category}
    </span>
  );
}

const SRC_COLORS: Record<SorRateSourceType, string> = {
  INTERNAL: "#3b82f6",
  SUBBIE: "#f59e0b",
  SUPPLIER: "#10b981",
  MANUAL: "#6b7280"
};

const SRC_LABELS: Record<SorRateSourceType, string> = {
  INTERNAL: "Hub",
  SUBBIE: "Subbie",
  SUPPLIER: "Supplier",
  MANUAL: "Manual"
};

function SourceBadge({ sourceType }: { sourceType: SorRateSourceType }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 99,
        fontSize: 10,
        fontWeight: 700,
        background: SRC_COLORS[sourceType] ?? "#6b7280",
        color: "#fff"
      }}
    >
      {SRC_LABELS[sourceType] ?? sourceType}
    </span>
  );
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function groupByCategory(lines: WizardLine[]): Partial<Record<SorCategory, WizardLine[]>> {
  const out: Partial<Record<SorCategory, WizardLine[]>> = {};
  for (const line of lines) {
    if (!out[line.category]) out[line.category] = [];
    out[line.category]!.push(line);
  }
  return out;
}

// ── Stepper indicator ─────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    "Period details",
    "Select lines",
    "Review & markup",
    "Confirm"
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        marginBottom: 24,
        background: "var(--surface, #fff)",
        border: "1px solid var(--border, #e5e7eb)",
        borderRadius: 8,
        padding: "12px 20px"
      }}
    >
      {steps.map((label, idx) => {
        const stepNum = (idx + 1) as Step;
        const done = stepNum < current;
        const active = stepNum === current;
        return (
          <div key={stepNum} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: done || active ? "var(--brand-primary, #005B61)" : "var(--border, #e5e7eb)",
                  color: done || active ? "#fff" : "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0
                }}
              >
                {done ? "✓" : stepNum}
              </div>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: active ? 700 : 400,
                  color: active ? "var(--brand-primary, #005B61)" : "var(--text-muted)"
                }}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 ? (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: done ? "var(--brand-primary, #005B61)" : "var(--border, #e5e7eb)",
                  margin: "0 12px"
                }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function CreateSorPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [details, setDetails] = useState<PeriodDetails>(BLANK_PERIOD);
  // Map of line.key => WizardLine for all selected lines
  const [selectedMap, setSelectedMap] = useState<Map<string, WizardLine>>(new Map());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const selectedKeys = new Set(selectedMap.keys());

  function handleToggleLine(line: WizardLine, checked: boolean) {
    setSelectedMap((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(line.key, line);
      } else {
        next.delete(line.key);
      }
      return next;
    });
  }

  function handleMarkupChange(key: string, pct: number | null) {
    setSelectedMap((prev) => {
      const existing = prev.get(key);
      if (!existing) return prev;
      const next = new Map(prev);
      next.set(key, { ...existing, markupPct: pct });
      return next;
    });
  }

  const lines = Array.from(selectedMap.values());

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);

    const payload: CreateSorPayload = {
      year: parseInt(details.year, 10),
      half: details.half,
      startDate: details.startDate,
      expiryDate: details.expiryDate,
      label: details.label,
      lines: lines.map((line) => ({
        name: line.name,
        category: line.category,
        unit: line.unit || undefined,
        baseRate: line.baseRate,
        sourceType: line.sourceType,
        sourceRateRowId: line.sourceRateRowId,
        sourceSubRateId: line.sourceSubRateId,
        markupPct: line.markupPct ?? undefined
      }))
    };

    try {
      const res = await authFetch("/schedule-of-rates/create-period", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res, "Failed to create SoR period.");
        setSubmitError(msg);
        setSubmitting(false);
        return;
      }
      const created = (await res.json()) as { id: string };
      navigate(`/admin/schedule-of-rates?highlight=${created.id}`);
    } catch (err) {
      setSubmitError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 20 }}>
        <button
          type="button"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--brand-primary, #005B61)",
            fontSize: 13,
            padding: 0,
            fontWeight: 500
          }}
          onClick={() => navigate("/admin/schedule-of-rates")}
        >
          &larr; Back to Schedule of Rates
        </button>
      </div>

      <h1 style={{ marginTop: 0, marginBottom: 8, fontSize: 22, fontWeight: 800 }}>
        Create Schedule of Rates
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0, marginBottom: 20, fontSize: 14 }}>
        Build a new SoR period by selecting lines from the rate hub and setting markup.
      </p>

      <StepIndicator current={step} />

      {step === 1 && (
        <Step1
          details={details}
          onChange={setDetails}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          selected={selectedKeys}
          onToggleLine={handleToggleLine}
          onNext={() => setStep(3)}
          onBack={() => setStep(1)}
          authFetch={authFetch}
        />
      )}
      {step === 3 && (
        <Step3
          lines={lines}
          onLineMarkupChange={handleMarkupChange}
          onNext={() => setStep(4)}
          onBack={() => setStep(2)}
        />
      )}
      {step === 4 && (
        <Step4
          details={details}
          lines={lines}
          submitting={submitting}
          error={submitError}
          onBack={() => setStep(3)}
          onSubmit={() => { void handleSubmit(); }}
        />
      )}
    </div>
  );
}
