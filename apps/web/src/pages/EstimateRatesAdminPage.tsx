import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type LabourRate = {
  id: string;
  role: string;
  dayRate: string;
  nightRate: string;
  weekendRate: string;
  isActive: boolean;
  sortOrder: number;
};

type PlantRate = {
  id: string;
  item: string;
  unit: string;
  rate: string;
  fuelRate: string;
  isActive: boolean;
  sortOrder: number;
};

type WasteRate = {
  id: string;
  wasteType: string;
  facility: string;
  wasteGroup: string | null;
  unit: string;
  tonRate: string;
  loadRate: string;
  isActive: boolean;
  sortOrder: number;
};

type CuttingRate = {
  id: string;
  equipment: string;
  elevation: string;
  material: string;
  depthMm: number;
  ratePerM: string;
  isActive: boolean;
  sortOrder: number;
};

type CoreHoleRate = {
  id: string;
  diameterMm: number;
  ratePerHole: string;
  isActive: boolean;
};

type FuelRate = {
  id: string;
  item: string;
  unit: string;
  rate: string;
  isActive: boolean;
  sortOrder: number;
};

type EnclosureRate = {
  id: string;
  enclosureType: string;
  unit: string;
  rate: string;
  isActive: boolean;
  sortOrder: number;
};

type OtherRate = {
  id: string;
  description: string;
  unit: string;
  rate: string;
  isActive: boolean;
  sortOrder: number;
};

type Tab = "labour" | "plant" | "waste" | "cutting" | "coreholes" | "fuel" | "enclosure" | "other";

const SNAPSHOT_NOTE =
  "Rate snapshots: Every submitted quote freezes the rates in force on the submit date. Editing a rate here never changes an old quote.";

type Api = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;

type ColumnDef<T> = {
  key: keyof T & string;
  label: string;
  type?: "text" | "number";
  step?: string;
  render?: (value: string) => ReactNode;
  widthPct?: number;
};

export function EstimateRatesAdminPage() {
  const { authFetch, user } = useAuth();
  const canAdmin = useMemo(() => user?.permissions.includes("estimates.admin") ?? false, [user]);
  const canView = useMemo(
    () => user?.permissions.includes("estimates.view") || user?.permissions.includes("estimates.admin") || false,
    [user]
  );

  const [tab, setTab] = useState<Tab>("labour");
  const [labour, setLabour] = useState<LabourRate[]>([]);
  const [plant, setPlant] = useState<PlantRate[]>([]);
  const [waste, setWaste] = useState<WasteRate[]>([]);
  const [cutting, setCutting] = useState<CuttingRate[]>([]);
  const [coreHoles, setCoreHoles] = useState<CoreHoleRate[]>([]);
  const [fuel, setFuel] = useState<FuelRate[]>([]);
  const [enclosure, setEnclosure] = useState<EnclosureRate[]>([]);
  const [other, setOther] = useState<OtherRate[]>([]);
  const [searches, setSearches] = useState<Record<Tab, string>>({
    labour: "",
    plant: "",
    waste: "",
    cutting: "",
    coreholes: "",
    fuel: "",
    enclosure: "",
    other: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, p, w, c, ch, f, e, o] = await Promise.all([
        authFetch(`/estimate-rates/labour`).then((r) => (r.ok ? (r.json() as Promise<LabourRate[]>) : [])),
        authFetch(`/estimate-rates/plant`).then((r) => (r.ok ? (r.json() as Promise<PlantRate[]>) : [])),
        authFetch(`/estimate-rates/waste`).then((r) => (r.ok ? (r.json() as Promise<WasteRate[]>) : [])),
        authFetch(`/estimate-rates/cutting`).then((r) => (r.ok ? (r.json() as Promise<CuttingRate[]>) : [])),
        authFetch(`/estimate-rates/core-holes`).then((r) => (r.ok ? (r.json() as Promise<CoreHoleRate[]>) : [])),
        authFetch(`/estimate-rates/fuel`).then((r) => (r.ok ? (r.json() as Promise<FuelRate[]>) : [])),
        authFetch(`/estimate-rates/enclosure`).then((r) => (r.ok ? (r.json() as Promise<EnclosureRate[]>) : [])),
        authFetch(`/estimate-rates/other-rates`).then((r) => (r.ok ? (r.json() as Promise<OtherRate[]>) : []))
      ]);
      setLabour(l as LabourRate[]);
      setPlant(p as PlantRate[]);
      setWaste(w as WasteRate[]);
      setCutting(c as CuttingRate[]);
      setCoreHoles(ch as CoreHoleRate[]);
      setFuel(f as FuelRate[]);
      setEnclosure(e as EnclosureRate[]);
      setOther(o as OtherRate[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const callApi = useCallback<Api>(
    async (path, method, body) => {
      setSaving(true);
      setError(null);
      try {
        const response = await authFetch(path, { method, body: body ? JSON.stringify(body) : undefined });
        if (!response.ok) throw new Error(await response.text());
        await reload();
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setSaving(false);
      }
    },
    [authFetch, reload]
  );

  if (!canView) {
    return (
      <div className="admin-page">
        <EmptyState heading="Not authorised" subtext="You don't have permission to view estimate rates." />
      </div>
    );
  }

  const search = searches[tab];
  const setSearch = (value: string) => setSearches((prev) => ({ ...prev, [tab]: value }));

  const labourFiltered = filterRows(labour, search, (r) => r.role);
  const plantFiltered = filterRows(plant, search, (r) => `${r.item} ${r.unit}`);
  const wasteFiltered = filterRows(waste, search, (r) => `${r.wasteType} ${r.facility} ${r.wasteGroup ?? ""}`);
  const cuttingFiltered = filterRows(cutting, search, (r) => `${r.equipment} ${r.material} ${r.elevation} ${r.depthMm}`);
  const coreHolesFiltered = filterRows(coreHoles, search, (r) => String(r.diameterMm));
  const fuelFiltered = filterRows(fuel, search, (r) => `${r.item} ${r.unit}`);
  const enclosureFiltered = filterRows(enclosure, search, (r) => `${r.enclosureType} ${r.unit}`);
  const otherFiltered = filterRows(other, search, (r) => `${r.description} ${r.unit}`);

  const countFor: Record<Tab, number> = {
    labour: labour.length,
    plant: plant.length,
    waste: waste.length,
    cutting: cutting.length,
    coreholes: coreHoles.length,
    fuel: fuel.length,
    enclosure: enclosure.length,
    other: other.length
  };

  const filteredCount: Record<Tab, number> = {
    labour: labourFiltered.length,
    plant: plantFiltered.length,
    waste: wasteFiltered.length,
    cutting: cuttingFiltered.length,
    coreholes: coreHolesFiltered.length,
    fuel: fuelFiltered.length,
    enclosure: enclosureFiltered.length,
    other: otherFiltered.length
  };

  return (
    <div className="admin-page" style={{ paddingBottom: 70 }}>
      <header className="admin-page__header">
        <div>
          <p className="s7-type-label">Tendering</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Estimate rate library</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Company-wide locked rates used by the estimate editor.
          </p>
        </div>
      </header>

      {error ? (
        <div className="s7-card" role="alert" style={{ borderColor: "var(--status-danger)", color: "var(--status-danger)" }}>
          {error}
        </div>
      ) : null}

      <nav className="admin-page__tabs" role="tablist">
        {([
          { key: "labour", label: `Labour (${countFor.labour})` },
          { key: "plant", label: `Plant (${countFor.plant})` },
          { key: "waste", label: `Disposal (${countFor.waste})` },
          { key: "cutting", label: `Saw Cutting (${countFor.cutting})` },
          { key: "coreholes", label: `Core holes (${countFor.coreholes})` },
          { key: "fuel", label: `Fuel (${countFor.fuel})` },
          { key: "enclosure", label: `Enclosures (${countFor.enclosure})` },
          { key: "other", label: `Other rates (${countFor.other})` }
        ] as Array<{ key: Tab; label: string }>).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={tab === t.key ? "admin-page__tab admin-page__tab--active" : "admin-page__tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <input
          type="search"
          className="s7-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={`Search ${tab}…`}
          style={{ maxWidth: 320, flex: 1 }}
        />
        <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
          {filteredCount[tab]} of {countFor[tab]} entries
        </span>
      </div>

      {loading ? (
        <div className="s7-card"><Skeleton width="100%" height={200} /></div>
      ) : (
        <section className="s7-card">
          {tab === "labour" && (
            <RatesTable
              rows={labourFiltered}
              columns={[
                { key: "role", label: "Role", type: "text", widthPct: 40 },
                { key: "dayRate", label: "Day", type: "number", step: "0.01", render: currency, widthPct: 15 },
                { key: "nightRate", label: "Night", type: "number", step: "0.01", render: currency, widthPct: 15 },
                { key: "weekendRate", label: "Weekend", type: "number", step: "0.01", render: currency, widthPct: 15 }
              ]}
              basePath="/estimate-rates/labour"
              addDefaults={{ role: "", dayRate: "0", nightRate: "0", weekendRate: "0" }}
              deleteLabel={(r) => r.role}
              canAdmin={canAdmin}
              saving={saving}
              callApi={callApi}
            />
          )}
          {tab === "plant" && (
            <RatesTable
              rows={plantFiltered}
              columns={[
                { key: "item", label: "Item", type: "text", widthPct: 40 },
                { key: "unit", label: "Unit", type: "text", widthPct: 12 },
                { key: "rate", label: "Rate", type: "number", step: "0.01", render: currency, widthPct: 15 },
                { key: "fuelRate", label: "Fuel", type: "number", step: "0.01", render: currency, widthPct: 15 }
              ]}
              basePath="/estimate-rates/plant"
              addDefaults={{ item: "", unit: "day", rate: "0", fuelRate: "0" }}
              deleteLabel={(r) => r.item}
              canAdmin={canAdmin}
              saving={saving}
              callApi={callApi}
            />
          )}
          {tab === "waste" && (
            <RatesTable
              rows={wasteFiltered}
              columns={[
                { key: "wasteGroup", label: "Group", type: "text", widthPct: 15 },
                { key: "wasteType", label: "Type", type: "text", widthPct: 26 },
                { key: "facility", label: "Facility", type: "text", widthPct: 23 },
                { key: "unit", label: "Unit", type: "text", widthPct: 8 },
                { key: "tonRate", label: "Rate", type: "number", step: "0.01", render: currency, widthPct: 12 },
                { key: "loadRate", label: "$/load", type: "number", step: "0.01", render: currency, widthPct: 12 }
              ]}
              basePath="/estimate-rates/waste"
              addDefaults={{ wasteGroup: "", wasteType: "", facility: "", unit: "tonne", tonRate: "0", loadRate: "0" }}
              deleteLabel={(r) => `${r.wasteType} @ ${r.facility}`}
              canAdmin={canAdmin}
              saving={saving}
              callApi={callApi}
            />
          )}
          {tab === "cutting" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
                Rates shown are base rates. High-Freq / Low-emission method adds 25%. Wall elevation adds 10%. Inverted elevation doubles the rate. These multipliers are applied at cutting-sheet save time.
              </p>
              <RatesTable
                rows={cuttingFiltered}
                columns={[
                  { key: "equipment", label: "Equipment", type: "text", widthPct: 18 },
                  { key: "elevation", label: "Elevation", type: "text", widthPct: 14 },
                  { key: "material", label: "Material", type: "text", widthPct: 20 },
                  { key: "depthMm", label: "Depth (mm)", type: "number", step: "1", widthPct: 14 },
                  { key: "ratePerM", label: "$/m", type: "number", step: "0.0001", render: currency, widthPct: 18 }
                ]}
                basePath="/estimate-rates/cutting"
                addDefaults={{ equipment: "Roadsaw", elevation: "Floor", material: "Concrete", depthMm: 100, ratePerM: "0" }}
                deleteLabel={(r) => `${r.equipment} / ${r.material} / ${r.depthMm}mm / ${r.elevation}`}
                canAdmin={canAdmin}
                saving={saving}
                callApi={callApi}
              />
            </>
          )}
          {tab === "coreholes" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
                Rate is per 10mm depth. Final cost = rate × (depth ÷ 10) × quantity × elevation multiplier × method multiplier.
              </p>
              <RatesTable
                rows={coreHolesFiltered}
                columns={[
                  { key: "diameterMm", label: "Diameter (mm)", type: "number", step: "1", widthPct: 40 },
                  { key: "ratePerHole", label: "$/hole per 10mm", type: "number", step: "0.0001", render: currency, widthPct: 40 }
                ]}
                basePath="/estimate-rates/core-holes"
                addDefaults={{ diameterMm: 100, ratePerHole: "0" }}
                deleteLabel={(r) => `${r.diameterMm} mm`}
                canAdmin={canAdmin}
                saving={saving}
                callApi={callApi}
              />
            </>
          )}
          {tab === "fuel" && (
            <RatesTable
              rows={fuelFiltered}
              columns={[
                { key: "item", label: "Item", type: "text", widthPct: 55 },
                { key: "unit", label: "Unit", type: "text", widthPct: 15 },
                { key: "rate", label: "Rate", type: "number", step: "0.01", render: currency, widthPct: 20 }
              ]}
              basePath="/estimate-rates/fuel"
              addDefaults={{ item: "", unit: "L", rate: "0" }}
              deleteLabel={(r) => r.item}
              canAdmin={canAdmin}
              saving={saving}
              callApi={callApi}
            />
          )}
          {tab === "enclosure" && (
            <RatesTable
              rows={enclosureFiltered}
              columns={[
                { key: "enclosureType", label: "Type", type: "text", widthPct: 55 },
                { key: "unit", label: "Unit", type: "text", widthPct: 15 },
                { key: "rate", label: "Rate", type: "number", step: "0.01", render: currency, widthPct: 20 }
              ]}
              basePath="/estimate-rates/enclosure"
              addDefaults={{ enclosureType: "", unit: "m²", rate: "0" }}
              deleteLabel={(r) => r.enclosureType}
              canAdmin={canAdmin}
              saving={saving}
              callApi={callApi}
            />
          )}
          {tab === "other" && (
            <>
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 0 }}>
                Flat-fee or unit-priced extras for the cutting sheet (establishment fees, blade changes, wet-vac hire, etc). Line total = rate × quantity; multipliers do not apply.
              </p>
              <RatesTable
                rows={otherFiltered}
                columns={[
                  { key: "description", label: "Description", type: "text", widthPct: 55 },
                  { key: "unit", label: "Unit", type: "text", widthPct: 15 },
                  { key: "rate", label: "Rate", type: "number", step: "0.01", render: currency, widthPct: 20 }
                ]}
                basePath="/estimate-rates/other-rates"
                addDefaults={{ description: "", unit: "each", rate: "0" }}
                deleteLabel={(r) => r.description}
                canAdmin={canAdmin}
                saving={saving}
                callApi={callApi}
              />
            </>
          )}
        </section>
      )}

      <footer
        style={{
          position: "sticky",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--surface-raised, white)",
          borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
          padding: "10px 16px",
          fontSize: 12,
          color: "var(--text-muted)",
          marginTop: 12,
          zIndex: 10
        }}
      >
        {SNAPSHOT_NOTE}
      </footer>
    </div>
  );
}

function filterRows<T>(rows: T[], search: string, accessor: (row: T) => string): T[] {
  if (!search.trim()) return rows;
  const needle = search.trim().toLowerCase();
  return rows.filter((row) => accessor(row).toLowerCase().includes(needle));
}

function currency(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(n);
}

type RatesTableProps<T extends { id: string }> = {
  rows: T[];
  columns: ColumnDef<T>[];
  basePath: string;
  addDefaults: Partial<T>;
  deleteLabel: (row: T) => string;
  canAdmin: boolean;
  saving: boolean;
  callApi: Api;
};

function RatesTable<T extends { id: string }>({
  rows,
  columns,
  basePath,
  addDefaults,
  deleteLabel,
  canAdmin,
  saving,
  callApi
}: RatesTableProps<T>) {
  const [addDraft, setAddDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(columns.map((c) => [c.key, String(addDefaults[c.key] ?? "")]))
  );
  const firstRequiredKey = columns[0].key;
  const addDisabled = saving || !String(addDraft[firstRequiredKey] ?? "").trim();

  const submitAdd = async () => {
    if (addDisabled) return;
    const body: Record<string, string> = {};
    for (const c of columns) {
      body[c.key] = String(addDraft[c.key] ?? "").trim() || String(addDefaults[c.key] ?? "");
    }
    await callApi(basePath, "POST", body);
    setAddDraft(Object.fromEntries(columns.map((c) => [c.key, String(addDefaults[c.key] ?? "")])));
  };

  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          {columns.map((col) => (
            <input
              key={col.key}
              className="s7-input"
              type={col.type ?? "text"}
              step={col.step}
              value={addDraft[col.key] ?? ""}
              onChange={(e) => setAddDraft((prev) => ({ ...prev, [col.key]: e.target.value }))}
              placeholder={col.label}
            />
          ))}
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={() => void submitAdd()} disabled={addDisabled}>
            Add
          </button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={col.widthPct ? { width: `${col.widthPct}%` } : undefined}>
                  {col.label}
                </th>
              ))}
              <th style={{ width: 48 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <EditableRateRow
                key={row.id}
                row={row}
                columns={columns}
                basePath={basePath}
                deleteLabel={deleteLabel(row)}
                canAdmin={canAdmin}
                callApi={callApi}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type EditableRateRowProps<T extends { id: string }> = {
  row: T;
  columns: ColumnDef<T>[];
  basePath: string;
  deleteLabel: string;
  canAdmin: boolean;
  callApi: Api;
};

function EditableRateRow<T extends { id: string }>({
  row,
  columns,
  basePath,
  deleteLabel,
  canAdmin,
  callApi
}: EditableRateRowProps<T>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>(
    () => Object.fromEntries(columns.map((c) => [c.key, String((row as unknown as Record<string, unknown>)[c.key] ?? "")]))
  );
  const trRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    setDraft(Object.fromEntries(columns.map((c) => [c.key, String((row as unknown as Record<string, unknown>)[c.key] ?? "")])));
  }, [row, columns]);

  const enterEdit = () => {
    if (!canAdmin || editing) return;
    setEditing(true);
    requestAnimationFrame(() => {
      const firstInput = trRef.current?.querySelector<HTMLInputElement>("input");
      firstInput?.focus();
      firstInput?.select();
    });
  };

  const commit = async () => {
    const dirty = columns.some(
      (c) => draft[c.key] !== String((row as unknown as Record<string, unknown>)[c.key] ?? "")
    );
    if (!dirty) {
      setEditing(false);
      return;
    }
    const body: Record<string, unknown> = {};
    for (const c of columns) body[c.key] = draft[c.key];
    body.isActive = true;
    await callApi(`${basePath}/${row.id}`, "PATCH", body);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(Object.fromEntries(columns.map((c) => [c.key, String((row as unknown as Record<string, unknown>)[c.key] ?? "")])));
    setEditing(false);
  };

  const handleRowBlur = (e: React.FocusEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    const next = e.relatedTarget as Node | null;
    if (next && trRef.current && trRef.current.contains(next)) return;
    void commit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (!editing) return;
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  const remove = () => {
    if (!window.confirm(`Delete rate "${deleteLabel}"?`)) return;
    void callApi(`${basePath}/${row.id}`, "DELETE");
  };

  return (
    <tr
      ref={trRef}
      className={editing ? "rates-row rates-row--editing" : "rates-row"}
      onClick={enterEdit}
      onBlur={handleRowBlur}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {columns.map((col) => {
        const displayValue = String((row as unknown as Record<string, unknown>)[col.key] ?? "");
        return (
          <td key={col.key}>
            {editing ? (
              <input
                className="s7-input s7-input--sm"
                type={col.type ?? "text"}
                step={col.step}
                value={draft[col.key] ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, [col.key]: e.target.value }))}
                onFocus={(e) => e.currentTarget.select()}
              />
            ) : col.render ? (
              col.render(displayValue)
            ) : (
              displayValue
            )}
          </td>
        );
      })}
      <td onClick={(e) => e.stopPropagation()}>
        {canAdmin ? (
          <button
            type="button"
            aria-label="Delete rate"
            onClick={remove}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--status-danger, #EF4444)",
              fontSize: 18,
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4
            }}
          >
            ×
          </button>
        ) : null}
      </td>
    </tr>
  );
}
