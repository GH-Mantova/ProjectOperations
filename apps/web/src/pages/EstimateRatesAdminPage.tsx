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

type Tab = "labour" | "plant" | "waste" | "cutting";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, p, w, c] = await Promise.all([
        authFetch(`/estimate-rates/labour`).then((r) => (r.ok ? (r.json() as Promise<LabourRate[]>) : [])),
        authFetch(`/estimate-rates/plant`).then((r) => (r.ok ? (r.json() as Promise<PlantRate[]>) : [])),
        authFetch(`/estimate-rates/waste`).then((r) => (r.ok ? (r.json() as Promise<WasteRate[]>) : [])),
        authFetch(`/estimate-rates/cutting`).then((r) => (r.ok ? (r.json() as Promise<CuttingRate[]>) : []))
      ]);
      setLabour(l as LabourRate[]);
      setPlant(p as PlantRate[]);
      setWaste(w as WasteRate[]);
      setCutting(c as CuttingRate[]);
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

  return (
    <div className="admin-page">
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
          { key: "labour", label: `Labour (${labour.length})` },
          { key: "plant", label: `Plant (${plant.length})` },
          { key: "waste", label: `Waste (${waste.length})` },
          { key: "cutting", label: `Cutting (${cutting.length})` }
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

      {loading ? (
        <div className="s7-card">
          <Skeleton width="100%" height={200} />
        </div>
      ) : (
        <section className="s7-card">
          {tab === "labour" && <LabourRatesTable rows={labour} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "plant" && <PlantRatesTable rows={plant} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "waste" && <WasteRatesTable rows={waste} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
          {tab === "cutting" && <CuttingRatesTable rows={cutting} canAdmin={canAdmin} saving={saving} callApi={callApi} />}
        </section>
      )}
    </div>
  );
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
        <EmptyState heading="No labour rates yet" subtext="Add a rate to start building the library." />
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
        <EmptyState heading="No plant rates yet" subtext="Add a rate to start building the library." />
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
          <input className="s7-input" value={form.wasteType} onChange={(e) => setForm({ ...form, wasteType: e.target.value })} placeholder="Waste type…" />
          <input className="s7-input" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} placeholder="Facility" />
          <input type="number" step="0.01" className="s7-input" value={form.tonRate} onChange={(e) => setForm({ ...form, tonRate: e.target.value })} placeholder="Ton rate" />
          <input type="number" step="0.01" className="s7-input" value={form.loadRate} onChange={(e) => setForm({ ...form, loadRate: e.target.value })} placeholder="Load rate" />
          <button type="button" className="s7-btn s7-btn--primary s7-btn--sm" onClick={add} disabled={saving || !form.wasteType.trim() || !form.facility.trim()}>Add</button>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState heading="No waste rates yet" subtext="Add a rate to start building the library." />
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
                      onClick={() => { if (window.confirm(`Delete waste rate "${row.wasteType} @ ${row.facility}"?`)) void callApi(`/estimate-rates/waste/${row.id}`, "DELETE"); }}>
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
        <EmptyState heading="No cutting rates yet" subtext="Add a rate to start building the library." />
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
