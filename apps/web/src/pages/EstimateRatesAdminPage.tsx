import { useCallback, useEffect, useMemo, useState } from "react";
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
  tonRate: string;
  loadRate: string;
  isActive: boolean;
  sortOrder: number;
};

type CuttingRate = {
  id: string;
  cuttingType: string;
  unit: string;
  rate: string;
  isActive: boolean;
  sortOrder: number;
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

type Tab = "labour" | "plant" | "waste" | "cutting" | "fuel" | "enclosure";

const SNAPSHOT_NOTE =
  "Rate snapshots: Every submitted quote freezes the rates in force on the submit date. Editing a rate here never changes an old quote.";

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
  const [fuel, setFuel] = useState<FuelRate[]>([]);
  const [enclosure, setEnclosure] = useState<EnclosureRate[]>([]);
  const [searches, setSearches] = useState<Record<Tab, string>>({
    labour: "",
    plant: "",
    waste: "",
    cutting: "",
    fuel: "",
    enclosure: ""
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, p, w, c, f, e] = await Promise.all([
        authFetch(`/estimate-rates/labour`).then((r) => (r.ok ? (r.json() as Promise<LabourRate[]>) : [])),
        authFetch(`/estimate-rates/plant`).then((r) => (r.ok ? (r.json() as Promise<PlantRate[]>) : [])),
        authFetch(`/estimate-rates/waste`).then((r) => (r.ok ? (r.json() as Promise<WasteRate[]>) : [])),
        authFetch(`/estimate-rates/cutting`).then((r) => (r.ok ? (r.json() as Promise<CuttingRate[]>) : [])),
        authFetch(`/estimate-rates/fuel`).then((r) => (r.ok ? (r.json() as Promise<FuelRate[]>) : [])),
        authFetch(`/estimate-rates/enclosure`).then((r) => (r.ok ? (r.json() as Promise<EnclosureRate[]>) : []))
      ]);
      setLabour(l as LabourRate[]);
      setPlant(p as PlantRate[]);
      setWaste(w as WasteRate[]);
      setCutting(c as CuttingRate[]);
      setFuel(f as FuelRate[]);
      setEnclosure(e as EnclosureRate[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const callApi = useCallback(
    async (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => {
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
  const wasteFiltered = filterRows(waste, search, (r) => `${r.wasteType} ${r.facility}`);
  const cuttingFiltered = filterRows(cutting, search, (r) => `${r.cuttingType} ${r.unit}`);
  const fuelFiltered = filterRows(fuel, search, (r) => `${r.item} ${r.unit}`);
  const enclosureFiltered = filterRows(enclosure, search, (r) => `${r.enclosureType} ${r.unit}`);

  const countFor: Record<Tab, number> = {
    labour: labour.length,
    plant: plant.length,
    waste: waste.length,
    cutting: cutting.length,
    fuel: fuel.length,
    enclosure: enclosure.length
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
          { key: "cutting", label: `Cutting (${countFor.cutting})` },
          { key: "fuel", label: `Fuel (${countFor.fuel})` },
          { key: "enclosure", label: `Enclosures (${countFor.enclosure})` }
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
          {currentFilteredLength(tab, { labourFiltered, plantFiltered, wasteFiltered, cuttingFiltered, fuelFiltered, enclosureFiltered })}
          {" of "}
          {countFor[tab]}
          {" entries"}
        </span>
      </div>

      {loading ? (
        <div className="s7-card">
          <Skeleton width="100%" height={200} />
        </div>
      ) : (
        <section className="s7-card">
          {tab === "labour" && <LabourRatesTable rows={labourFiltered} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "plant" && <PlantRatesTable rows={plantFiltered} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "waste" && <WasteRatesTable rows={wasteFiltered} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "cutting" && <CuttingRatesTable rows={cuttingFiltered} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "fuel" && <FuelRatesTable rows={fuelFiltered} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "enclosure" && <EnclosureRatesTable rows={enclosureFiltered} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
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

function currentFilteredLength(
  tab: Tab,
  filtered: {
    labourFiltered: LabourRate[];
    plantFiltered: PlantRate[];
    wasteFiltered: WasteRate[];
    cuttingFiltered: CuttingRate[];
    fuelFiltered: FuelRate[];
    enclosureFiltered: EnclosureRate[];
  }
): number {
  switch (tab) {
    case "labour": return filtered.labourFiltered.length;
    case "plant": return filtered.plantFiltered.length;
    case "waste": return filtered.wasteFiltered.length;
    case "cutting": return filtered.cuttingFiltered.length;
    case "fuel": return filtered.fuelFiltered.length;
    case "enclosure": return filtered.enclosureFiltered.length;
  }
}

type Api = (path: string, method: "POST" | "PATCH" | "DELETE", body?: unknown) => Promise<void>;

function LabourRatesTable({ rows, canAdmin, saving, callApi }: { rows: LabourRate[]; canAdmin: boolean; saving: boolean; callApi: Api }) {
  const [form, setForm] = useState({ role: "", dayRate: "", nightRate: "", weekendRate: "" });
  const add = async () => {
    if (!form.role.trim()) return;
    await callApi(`/estimate-rates/labour`, "POST", {
      role: form.role.trim(),
      dayRate: form.dayRate || "0",
      nightRate: form.nightRate || "0",
      weekendRate: form.weekendRate || "0"
    });
    setForm({ role: "", dayRate: "", nightRate: "", weekendRate: "" });
  };
  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          <input className="s7-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Role…" />
          <input type="number" step="0.01" className="s7-input" value={form.dayRate} onChange={(e) => setForm({ ...form, dayRate: e.target.value })} placeholder="Day rate" />
          <input type="number" step="0.01" className="s7-input" value={form.nightRate} onChange={(e) => setForm({ ...form, nightRate: e.target.value })} placeholder="Night rate" />
          <input type="number" step="0.01" className="s7-input" value={form.weekendRate} onChange={(e) => setForm({ ...form, weekendRate: e.target.value })} placeholder="Weekend rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.role.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No labour rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr><th>Role</th><th>Day</th><th>Night</th><th>Weekend</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.role} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.role) void callApi(`/estimate-rates/labour/${row.id}`, "PATCH", { role: e.target.value, dayRate: row.dayRate, nightRate: row.nightRate, weekendRate: row.weekendRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.dayRate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.dayRate) void callApi(`/estimate-rates/labour/${row.id}`, "PATCH", { role: row.role, dayRate: e.target.value, nightRate: row.nightRate, weekendRate: row.weekendRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.nightRate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.nightRate) void callApi(`/estimate-rates/labour/${row.id}`, "PATCH", { role: row.role, dayRate: row.dayRate, nightRate: e.target.value, weekendRate: row.weekendRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.weekendRate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.weekendRate) void callApi(`/estimate-rates/labour/${row.id}`, "PATCH", { role: row.role, dayRate: row.dayRate, nightRate: row.nightRate, weekendRate: e.target.value, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={row.isActive} disabled={!canAdmin}
                    onChange={(e) => void callApi(`/estimate-rates/labour/${row.id}`, "PATCH", { role: row.role, dayRate: row.dayRate, nightRate: row.nightRate, weekendRate: row.weekendRate, isActive: e.target.checked })} />
                </td>
                <td>
                  {canAdmin ? (
                    <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => { if (window.confirm(`Delete labour rate "${row.role}"?`)) void callApi(`/estimate-rates/labour/${row.id}`, "DELETE"); }}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PlantRatesTable({ rows, canAdmin, saving, callApi }: { rows: PlantRate[]; canAdmin: boolean; saving: boolean; callApi: Api }) {
  const [form, setForm] = useState({ item: "", unit: "day", rate: "", fuelRate: "" });
  const add = async () => {
    if (!form.item.trim()) return;
    await callApi(`/estimate-rates/plant`, "POST", {
      item: form.item.trim(),
      unit: form.unit || "day",
      rate: form.rate || "0",
      fuelRate: form.fuelRate || "0"
    });
    setForm({ item: "", unit: "day", rate: "", fuelRate: "" });
  };
  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          <input className="s7-input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Plant item…" />
          <input className="s7-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (day/hr)" />
          <input type="number" step="0.01" className="s7-input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="Rate" />
          <input type="number" step="0.01" className="s7-input" value={form.fuelRate} onChange={(e) => setForm({ ...form, fuelRate: e.target.value })} placeholder="Fuel rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.item.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No plant rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr><th>Item</th><th>Unit</th><th>Rate</th><th>Fuel</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.item} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.item) void callApi(`/estimate-rates/plant/${row.id}`, "PATCH", { item: e.target.value, unit: row.unit, rate: row.rate, fuelRate: row.fuelRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.unit} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.unit) void callApi(`/estimate-rates/plant/${row.id}`, "PATCH", { item: row.item, unit: e.target.value, rate: row.rate, fuelRate: row.fuelRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.rate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.rate) void callApi(`/estimate-rates/plant/${row.id}`, "PATCH", { item: row.item, unit: row.unit, rate: e.target.value, fuelRate: row.fuelRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.fuelRate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.fuelRate) void callApi(`/estimate-rates/plant/${row.id}`, "PATCH", { item: row.item, unit: row.unit, rate: row.rate, fuelRate: e.target.value, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={row.isActive} disabled={!canAdmin}
                    onChange={(e) => void callApi(`/estimate-rates/plant/${row.id}`, "PATCH", { item: row.item, unit: row.unit, rate: row.rate, fuelRate: row.fuelRate, isActive: e.target.checked })} />
                </td>
                <td>
                  {canAdmin ? (
                    <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => { if (window.confirm(`Delete plant rate "${row.item}"?`)) void callApi(`/estimate-rates/plant/${row.id}`, "DELETE"); }}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function WasteRatesTable({ rows, canAdmin, saving, callApi }: { rows: WasteRate[]; canAdmin: boolean; saving: boolean; callApi: Api }) {
  const [form, setForm] = useState({ wasteType: "", facility: "", tonRate: "", loadRate: "" });
  const add = async () => {
    if (!form.wasteType.trim() || !form.facility.trim()) return;
    await callApi(`/estimate-rates/waste`, "POST", {
      wasteType: form.wasteType.trim(),
      facility: form.facility.trim(),
      tonRate: form.tonRate || "0",
      loadRate: form.loadRate || "0"
    });
    setForm({ wasteType: "", facility: "", tonRate: "", loadRate: "" });
  };
  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          <input className="s7-input" value={form.wasteType} onChange={(e) => setForm({ ...form, wasteType: e.target.value })} placeholder="Disposal type…" />
          <input className="s7-input" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} placeholder="Facility" />
          <input type="number" step="0.01" className="s7-input" value={form.tonRate} onChange={(e) => setForm({ ...form, tonRate: e.target.value })} placeholder="Ton rate" />
          <input type="number" step="0.01" className="s7-input" value={form.loadRate} onChange={(e) => setForm({ ...form, loadRate: e.target.value })} placeholder="Load rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.wasteType.trim() || !form.facility.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No disposal rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr><th>Type</th><th>Facility</th><th>$/t</th><th>$/load</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.wasteType} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.wasteType) void callApi(`/estimate-rates/waste/${row.id}`, "PATCH", { wasteType: e.target.value, facility: row.facility, tonRate: row.tonRate, loadRate: row.loadRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.facility} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.facility) void callApi(`/estimate-rates/waste/${row.id}`, "PATCH", { wasteType: row.wasteType, facility: e.target.value, tonRate: row.tonRate, loadRate: row.loadRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.tonRate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.tonRate) void callApi(`/estimate-rates/waste/${row.id}`, "PATCH", { wasteType: row.wasteType, facility: row.facility, tonRate: e.target.value, loadRate: row.loadRate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.loadRate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.loadRate) void callApi(`/estimate-rates/waste/${row.id}`, "PATCH", { wasteType: row.wasteType, facility: row.facility, tonRate: row.tonRate, loadRate: e.target.value, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={row.isActive} disabled={!canAdmin}
                    onChange={(e) => void callApi(`/estimate-rates/waste/${row.id}`, "PATCH", { wasteType: row.wasteType, facility: row.facility, tonRate: row.tonRate, loadRate: row.loadRate, isActive: e.target.checked })} />
                </td>
                <td>
                  {canAdmin ? (
                    <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => { if (window.confirm(`Delete disposal rate "${row.wasteType} @ ${row.facility}"?`)) void callApi(`/estimate-rates/waste/${row.id}`, "DELETE"); }}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function CuttingRatesTable({ rows, canAdmin, saving, callApi }: { rows: CuttingRate[]; canAdmin: boolean; saving: boolean; callApi: Api }) {
  const [form, setForm] = useState({ cuttingType: "", unit: "lm", rate: "" });
  const add = async () => {
    if (!form.cuttingType.trim()) return;
    await callApi(`/estimate-rates/cutting`, "POST", {
      cuttingType: form.cuttingType.trim(),
      unit: form.unit || "lm",
      rate: form.rate || "0"
    });
    setForm({ cuttingType: "", unit: "lm", rate: "" });
  };
  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          <input className="s7-input" value={form.cuttingType} onChange={(e) => setForm({ ...form, cuttingType: e.target.value })} placeholder="Cutting type…" />
          <input className="s7-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (lm/ea)" />
          <input type="number" step="0.01" className="s7-input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="Rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.cuttingType.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No cutting rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr><th>Type</th><th>Unit</th><th>Rate</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.cuttingType} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.cuttingType) void callApi(`/estimate-rates/cutting/${row.id}`, "PATCH", { cuttingType: e.target.value, unit: row.unit, rate: row.rate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.unit} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.unit) void callApi(`/estimate-rates/cutting/${row.id}`, "PATCH", { cuttingType: row.cuttingType, unit: e.target.value, rate: row.rate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.rate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.rate) void callApi(`/estimate-rates/cutting/${row.id}`, "PATCH", { cuttingType: row.cuttingType, unit: row.unit, rate: e.target.value, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={row.isActive} disabled={!canAdmin}
                    onChange={(e) => void callApi(`/estimate-rates/cutting/${row.id}`, "PATCH", { cuttingType: row.cuttingType, unit: row.unit, rate: row.rate, isActive: e.target.checked })} />
                </td>
                <td>
                  {canAdmin ? (
                    <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => { if (window.confirm(`Delete cutting rate "${row.cuttingType}"?`)) void callApi(`/estimate-rates/cutting/${row.id}`, "DELETE"); }}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function FuelRatesTable({ rows, canAdmin, saving, callApi }: { rows: FuelRate[]; canAdmin: boolean; saving: boolean; callApi: Api }) {
  const [form, setForm] = useState({ item: "", unit: "L", rate: "" });
  const add = async () => {
    if (!form.item.trim()) return;
    await callApi(`/estimate-rates/fuel`, "POST", {
      item: form.item.trim(),
      unit: form.unit || "L",
      rate: form.rate || "0"
    });
    setForm({ item: "", unit: "L", rate: "" });
  };
  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          <input className="s7-input" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="Fuel item…" />
          <input className="s7-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (L)" />
          <input type="number" step="0.01" className="s7-input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="Rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.item.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No fuel rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr><th>Item</th><th>Unit</th><th>Rate</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.item} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.item) void callApi(`/estimate-rates/fuel/${row.id}`, "PATCH", { item: e.target.value, unit: row.unit, rate: row.rate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.unit} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.unit) void callApi(`/estimate-rates/fuel/${row.id}`, "PATCH", { item: row.item, unit: e.target.value, rate: row.rate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.rate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.rate) void callApi(`/estimate-rates/fuel/${row.id}`, "PATCH", { item: row.item, unit: row.unit, rate: e.target.value, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={row.isActive} disabled={!canAdmin}
                    onChange={(e) => void callApi(`/estimate-rates/fuel/${row.id}`, "PATCH", { item: row.item, unit: row.unit, rate: row.rate, isActive: e.target.checked })} />
                </td>
                <td>
                  {canAdmin ? (
                    <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => { if (window.confirm(`Delete fuel rate "${row.item}"?`)) void callApi(`/estimate-rates/fuel/${row.id}`, "DELETE"); }}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EnclosureRatesTable({ rows, canAdmin, saving, callApi }: { rows: EnclosureRate[]; canAdmin: boolean; saving: boolean; callApi: Api }) {
  const [form, setForm] = useState({ enclosureType: "", unit: "m²", rate: "" });
  const add = async () => {
    if (!form.enclosureType.trim()) return;
    await callApi(`/estimate-rates/enclosure`, "POST", {
      enclosureType: form.enclosureType.trim(),
      unit: form.unit || "m²",
      rate: form.rate || "0"
    });
    setForm({ enclosureType: "", unit: "m²", rate: "" });
  };
  return (
    <div>
      {canAdmin ? (
        <div className="admin-page__add-row">
          <input className="s7-input" value={form.enclosureType} onChange={(e) => setForm({ ...form, enclosureType: e.target.value })} placeholder="Enclosure type…" />
          <input className="s7-input" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unit (m²/day/ea)" />
          <input type="number" step="0.01" className="s7-input" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="Rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.enclosureType.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No enclosure rates match" subtext="Clear your search or add a new rate." />
      ) : (
        <table className="admin-page__table">
          <thead>
            <tr><th>Type</th><th>Unit</th><th>Rate</th><th>Active</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.enclosureType} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.enclosureType) void callApi(`/estimate-rates/enclosure/${row.id}`, "PATCH", { enclosureType: e.target.value, unit: row.unit, rate: row.rate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input className="s7-input s7-input--sm" defaultValue={row.unit} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.unit) void callApi(`/estimate-rates/enclosure/${row.id}`, "PATCH", { enclosureType: row.enclosureType, unit: e.target.value, rate: row.rate, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="number" step="0.01" className="s7-input s7-input--sm" defaultValue={row.rate} disabled={!canAdmin}
                    onBlur={(e) => { if (e.target.value !== row.rate) void callApi(`/estimate-rates/enclosure/${row.id}`, "PATCH", { enclosureType: row.enclosureType, unit: row.unit, rate: e.target.value, isActive: row.isActive }); }} />
                </td>
                <td>
                  <input type="checkbox" defaultChecked={row.isActive} disabled={!canAdmin}
                    onChange={(e) => void callApi(`/estimate-rates/enclosure/${row.id}`, "PATCH", { enclosureType: row.enclosureType, unit: row.unit, rate: row.rate, isActive: e.target.checked })} />
                </td>
                <td>
                  {canAdmin ? (
                    <button type="button" className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => { if (window.confirm(`Delete enclosure rate "${row.enclosureType}"?`)) void callApi(`/estimate-rates/enclosure/${row.id}`, "DELETE"); }}>
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
