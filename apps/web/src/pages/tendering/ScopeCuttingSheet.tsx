import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

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
  shift: string | null;
  shiftLoading: string | null;
  method: string | null;
  otherRateId: string | null;
  otherRate: OtherRate | null;
  notes: string | null;
  sortOrder: number;
};

const SAW_EQUIPMENT = ["Roadsaw", "Demosaw", "Ringsaw", "Flush-cut", "Tracksaw"];
const ELEVATIONS = ["Floor", "Wall", "Inverted"];
// Server-enforced mirror of METHODS_BY_EQUIPMENT. Only methods listed here
// can be selected for a given saw — anything else the server drops silently.
const METHODS_BY_EQUIPMENT: Record<string, string[]> = {
  Roadsaw: ["Fuel", "Low-emission"],
  Demosaw: ["High-Freq", "Fuel"],
  Ringsaw: ["High-Freq", "Fuel"],
  "Flush-cut": ["High-Freq", "Fuel"],
  Tracksaw: ["Fuel"]
};
// Roadsaw is Floor-only per Cutrite. Other saws allow Floor/Wall; Inverted
// only applies to core holes on the server so we hide it for saws too.
const ELEVATIONS_FOR_EQUIPMENT: Record<string, string[]> = {
  Roadsaw: ["Floor"],
  Demosaw: ["Floor", "Wall"],
  Ringsaw: ["Floor", "Wall"],
  "Flush-cut": ["Floor", "Wall"],
  Tracksaw: ["Floor", "Wall"]
};
// Three categorical materials match the rate library's material column.
const SAW_MATERIALS = ["Asphalt", "Concrete", "Masonry"];
const CORE_DIAMETERS = [32, 50, 75, 100, 150, 200, 250, 300, 400, 500, 650];
const SHIFTS = ["Day", "Night", "Weekend"];
const CORE_ELEVATIONS = ["Floor", "Wall", "Inverted"];
const CORE_METHODS = ["N/A", "High-Freq", "Fuel"];

function fmt(n: string | number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const v = typeof n === "string" ? Number(n) : n;
  if (Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 2 }).format(v);
}

export function ScopeCuttingSheet({
  tenderId,
  wbsRefs,
  canManage
}: {
  tenderId: string;
  wbsRefs: string[];
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<CuttingItem[]>([]);
  const [otherRates, setOtherRates] = useState<OtherRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ItemType>("saw-cut");
  // Force a reload when wbsRefs identity changes (so re-keyed scope items
  // re-sync even if the server prunes/renames legacy refs behind the scenes).
  const wbsKey = wbsRefs.join("|");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, ratesRes] = await Promise.all([
        authFetch(`/tenders/${tenderId}/scope/cutting-items`),
        authFetch(`/estimate-rates/other-rates`)
      ]);
      if (!itemsRes.ok) throw new Error(await itemsRes.text());
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
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
    // wbsKey intentionally re-triggers load so WBS changes from the parent
    // scope table propagate through any server-side cleanup that might
    // update cutting rows (e.g. orphan wbsRef remapping).
  }, [load, wbsKey]);

  // Discipline is inferred from the scope wbs refs passed in by the parent
  // (e.g. ["SO1","SO2"] → "SO"). Fallback to null when the parent supplies
  // no refs — in that case we show everything so the sheet still works
  // during tender setup before any scope items exist.
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

  const visible = useMemo(
    () => disciplineItems.filter((i) => i.itemType === tab),
    [disciplineItems, tab]
  );
  const subtotal = useMemo(
    () => disciplineItems.reduce((sum, i) => sum + (i.lineTotal ? Number(i.lineTotal) : 0), 0),
    [disciplineItems]
  );

  const addItem = async () => {
    if (!canManage) return;
    const wbsRef = wbsRefs[0] ?? "SO1";
    const body: Record<string, unknown> = {
      wbsRef,
      itemType: tab,
      shift: "Day"
    };
    if (tab === "other-rate" && otherRates[0]) {
      body.otherRateId = otherRates[0].id;
      body.quantityEach = 1;
    }
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this cutting item?")) return;
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  return (
    <section className="s7-card" style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Concrete cutting
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({disciplineItems.length} item{disciplineItems.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Subtotal: <strong style={{ color: "var(--text)" }}>{fmt(subtotal)}</strong>
        </div>
      </div>
      {discipline ? (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
          Showing items linked to {discipline} scope. Switch discipline above to see others.
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: 12 }}>
        {(["saw-cut", "core-hole", "other-rate"] as ItemType[]).map((t) => {
          const active = t === tab;
          const label = t === "saw-cut" ? "Saw cuts" : t === "core-hole" ? "Core holes" : "Other";
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                padding: "8px 16px",
                background: "transparent",
                border: "none",
                borderBottom: active ? "2px solid #FEAA6D" : "2px solid transparent",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontWeight: active ? 600 : 400,
                cursor: "pointer"
              }}
            >
              {label} ({disciplineItems.filter((i) => i.itemType === t).length})
            </button>
          );
        })}
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No {tab === "saw-cut" ? "saw cuts" : tab === "core-hole" ? "core holes" : "other-rate lines"} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          {tab === "saw-cut" ? (
            <SawCutTable items={visible} wbsRefs={wbsRefs} canManage={canManage} patch={patch} remove={remove} />
          ) : tab === "core-hole" ? (
            <CoreHoleTable items={visible} wbsRefs={wbsRefs} canManage={canManage} patch={patch} remove={remove} />
          ) : (
            <OtherRateTable
              items={visible}
              wbsRefs={wbsRefs}
              canManage={canManage}
              otherRates={otherRates}
              patch={patch}
              remove={remove}
            />
          )}
        </div>
      )}

      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          style={{ marginTop: 12 }}
          onClick={() => void addItem()}
          disabled={tab === "other-rate" && otherRates.length === 0}
          title={tab === "other-rate" && otherRates.length === 0 ? "No active other-rates in catalogue" : undefined}
        >
          + Add {tab === "saw-cut" ? "saw cut" : tab === "core-hole" ? "core hole" : "other-rate line"}
        </button>
      ) : null}
    </section>
  );
}

type RowProps = {
  items: CuttingItem[];
  wbsRefs: string[];
  canManage: boolean;
  patch: (id: string, body: Record<string, unknown>) => Promise<void>;
  remove: (id: string) => Promise<void>;
};

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v === "" || Number.isNaN(n) ? null : n;
}

function WbsCell({ item, wbsRefs, canManage, patch }: { item: CuttingItem; wbsRefs: string[]; canManage: boolean; patch: RowProps["patch"] }) {
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

function NotesRow({
  item,
  canManage,
  patch,
  colSpan
}: {
  item: CuttingItem;
  canManage: boolean;
  patch: RowProps["patch"];
  colSpan: number;
}) {
  return (
    <tr>
      <td colSpan={colSpan} style={{ padding: "0 6px 6px" }}>
        <textarea
          className="s7-input"
          placeholder="Notes"
          defaultValue={item.notes ?? ""}
          disabled={!canManage}
          rows={2}
          style={{ width: "100%", minHeight: 40, resize: "vertical" }}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== (item.notes ?? "")) void patch(item.id, { notes: v });
          }}
        />
      </td>
    </tr>
  );
}

function SawCutTable({ items, wbsRefs, canManage, patch, remove }: RowProps) {
  const headers = ["WBS", "Description", "Equipment", "Elevation", "Material", "Depth mm", "Qty Lm", "Rate $/m", "Shift", "Method", "Loading $", "Line total", ""];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
        <tr>
          {headers.map((h) => (
            <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const showLoading = item.shift === "Night" || item.shift === "Weekend";
          const equipment = item.equipment ?? "";
          const allowedElevations = equipment ? (ELEVATIONS_FOR_EQUIPMENT[equipment] ?? ELEVATIONS) : ELEVATIONS;
          const allowedMethods = equipment ? (METHODS_BY_EQUIPMENT[equipment] ?? []) : [];
          return (
            <Fragment key={item.id}>
              <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: 4 }}>
                  <WbsCell item={item} wbsRefs={wbsRefs} canManage={canManage} patch={patch} />
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    defaultValue={item.description ?? ""}
                    disabled={!canManage}
                    onBlur={(e) => void patch(item.id, { description: e.target.value })}
                  />
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.equipment ?? ""}
                    disabled={!canManage}
                    onChange={(e) => {
                      const next = e.target.value || null;
                      // When switching equipment, reset elevation/method to the
                      // new allowlist so stale values don't linger on the item.
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
                    <option value="">—</option>
                    {SAW_EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  {equipment === "Roadsaw" ? (
                    <span style={{ color: "var(--text-muted)" }}>Floor</span>
                  ) : (
                    <select
                      className="s7-input"
                      value={item.elevation ?? ""}
                      disabled={!canManage || !equipment}
                      onChange={(e) => void patch(item.id, { elevation: e.target.value || null })}
                    >
                      <option value="">—</option>
                      {allowedElevations.map((el) => <option key={el} value={el}>{el}</option>)}
                    </select>
                  )}
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.material ?? ""}
                    disabled={!canManage}
                    onChange={(e) => void patch(item.id, { material: e.target.value || null })}
                  >
                    <option value="">—</option>
                    {SAW_MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    type="number"
                    defaultValue={item.depthMm ?? ""}
                    disabled={!canManage}
                    style={{ width: 80 }}
                    onBlur={(e) => void patch(item.id, { depthMm: numOrNull(e.target.value) })}
                  />
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    type="number"
                    step="0.01"
                    defaultValue={item.quantityLm ?? ""}
                    disabled={!canManage}
                    style={{ width: 80 }}
                    onBlur={(e) => void patch(item.id, { quantityLm: numOrNull(e.target.value) })}
                  />
                </td>
                <td style={{ padding: 4, color: "var(--text-muted)" }}>{fmt(item.ratePerM)}</td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.shift ?? "Day"}
                    disabled={!canManage}
                    onChange={(e) => void patch(item.id, { shift: e.target.value })}
                  >
                    {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.method ?? ""}
                    disabled={!canManage || !equipment}
                    style={{ width: 110 }}
                    onChange={(e) => void patch(item.id, { method: e.target.value || null })}
                  >
                    <option value="">N/A</option>
                    {allowedMethods.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  {showLoading ? (
                    <input
                      className="s7-input"
                      type="number"
                      step="0.01"
                      defaultValue={item.shiftLoading ?? ""}
                      disabled={!canManage}
                      style={{ width: 80 }}
                      onBlur={(e) => void patch(item.id, { shiftLoading: numOrNull(e.target.value) })}
                    />
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: 4, fontWeight: 600 }}>{fmt(item.lineTotal)}</td>
                <td style={{ padding: 4 }}>
                  {canManage ? (
                    <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void remove(item.id)}>×</button>
                  ) : null}
                </td>
              </tr>
              <NotesRow item={item} canManage={canManage} patch={patch} colSpan={headers.length} />
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function CoreHoleTable({ items, wbsRefs, canManage, patch, remove }: RowProps) {
  const headers = ["WBS", "Description", "Diameter mm", "Elevation", "Depth mm", "Quantity", "Rate $/hole", "Shift", "Method", "Loading $", "Line total", ""];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
        <tr>
          {headers.map((h) => (
            <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const showLoading = item.shift === "Night" || item.shift === "Weekend";
          const diameter = item.diameterMm ?? 0;
          const isStandard = CORE_DIAMETERS.includes(diameter);
          const isPOA = diameter > 650;
          return (
            <Fragment key={item.id}>
              <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: 4 }}>
                  <WbsCell item={item} wbsRefs={wbsRefs} canManage={canManage} patch={patch} />
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    defaultValue={item.description ?? ""}
                    disabled={!canManage}
                    onBlur={(e) => void patch(item.id, { description: e.target.value })}
                  />
                </td>
                <td style={{ padding: 4 }}>
                  {isStandard || diameter === 0 ? (
                    <select
                      className="s7-input"
                      value={diameter || ""}
                      disabled={!canManage}
                      onChange={(e) =>
                        void patch(item.id, {
                          diameterMm: e.target.value === "custom" ? null : numOrNull(e.target.value)
                        })
                      }
                      style={{ width: 100 }}
                    >
                      <option value="">—</option>
                      {CORE_DIAMETERS.map((d) => <option key={d} value={d}>{d}</option>)}
                      <option value="custom">Custom…</option>
                    </select>
                  ) : (
                    <input
                      className="s7-input"
                      type="number"
                      defaultValue={diameter}
                      disabled={!canManage}
                      style={{ width: 100 }}
                      onBlur={(e) => void patch(item.id, { diameterMm: numOrNull(e.target.value) })}
                    />
                  )}
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.elevation ?? "Floor"}
                    disabled={!canManage}
                    onChange={(e) => void patch(item.id, { elevation: e.target.value || null })}
                  >
                    {CORE_ELEVATIONS.map((el) => <option key={el} value={el}>{el}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    type="number"
                    defaultValue={item.depthMm ?? ""}
                    disabled={!canManage}
                    style={{ width: 80 }}
                    onBlur={(e) => void patch(item.id, { depthMm: numOrNull(e.target.value) })}
                  />
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    type="number"
                    defaultValue={item.quantityEach ?? ""}
                    disabled={!canManage}
                    style={{ width: 80 }}
                    onBlur={(e) => void patch(item.id, { quantityEach: numOrNull(e.target.value) })}
                  />
                </td>
                <td style={{ padding: 4, color: "var(--text-muted)" }}>
                  {isPOA ? <span style={{ color: "#B45309", fontWeight: 600 }}>POA</span> : fmt(item.ratePerHole)}
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.shift ?? "Day"}
                    disabled={!canManage}
                    onChange={(e) => void patch(item.id, { shift: e.target.value })}
                  >
                    {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.method ?? "N/A"}
                    disabled={!canManage}
                    style={{ width: 110 }}
                    onChange={(e) => void patch(item.id, { method: e.target.value === "N/A" ? null : e.target.value })}
                  >
                    {CORE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </td>
                <td style={{ padding: 4 }}>
                  {showLoading ? (
                    <input
                      className="s7-input"
                      type="number"
                      step="0.01"
                      defaultValue={item.shiftLoading ?? ""}
                      disabled={!canManage}
                      style={{ width: 80 }}
                      onBlur={(e) => void patch(item.id, { shiftLoading: numOrNull(e.target.value) })}
                    />
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>—</span>
                  )}
                </td>
                <td style={{ padding: 4, fontWeight: 600 }}>
                  {isPOA ? <span style={{ color: "#B45309" }}>—</span> : fmt(item.lineTotal)}
                </td>
                <td style={{ padding: 4 }}>
                  {canManage ? (
                    <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void remove(item.id)}>×</button>
                  ) : null}
                </td>
              </tr>
              <NotesRow item={item} canManage={canManage} patch={patch} colSpan={headers.length} />
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

function OtherRateTable({
  items,
  wbsRefs,
  canManage,
  otherRates,
  patch,
  remove
}: RowProps & { otherRates: OtherRate[] }) {
  const headers = ["WBS", "Description", "Item", "Unit", "Rate", "Qty", "Line total", ""];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
        <tr>
          {headers.map((h) => (
            <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const selected = item.otherRate;
          return (
            <Fragment key={item.id}>
              <tr style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <td style={{ padding: 4 }}>
                  <WbsCell item={item} wbsRefs={wbsRefs} canManage={canManage} patch={patch} />
                </td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    defaultValue={item.description ?? ""}
                    disabled={!canManage}
                    onBlur={(e) => void patch(item.id, { description: e.target.value })}
                  />
                </td>
                <td style={{ padding: 4 }}>
                  <select
                    className="s7-input"
                    value={item.otherRateId ?? ""}
                    disabled={!canManage}
                    style={{ minWidth: 220 }}
                    onChange={(e) => void patch(item.id, { otherRateId: e.target.value || null })}
                  >
                    <option value="">— Select rate —</option>
                    {otherRates.map((r) => (
                      <option key={r.id} value={r.id}>{r.description}</option>
                    ))}
                    {item.otherRateId && !otherRates.some((r) => r.id === item.otherRateId) && selected ? (
                      <option value={item.otherRateId}>{selected.description} (inactive)</option>
                    ) : null}
                  </select>
                </td>
                <td style={{ padding: 4, color: "var(--text-muted)" }}>{selected?.unit ?? "—"}</td>
                <td style={{ padding: 4, color: "var(--text-muted)" }}>{selected ? fmt(selected.rate) : "—"}</td>
                <td style={{ padding: 4 }}>
                  <input
                    className="s7-input"
                    type="number"
                    step="0.01"
                    defaultValue={item.quantityEach ?? ""}
                    disabled={!canManage}
                    style={{ width: 80 }}
                    onBlur={(e) => void patch(item.id, { quantityEach: numOrNull(e.target.value) })}
                  />
                </td>
                <td style={{ padding: 4, fontWeight: 600 }}>{fmt(item.lineTotal)}</td>
                <td style={{ padding: 4 }}>
                  {canManage ? (
                    <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void remove(item.id)}>×</button>
                  ) : null}
                </td>
              </tr>
              <NotesRow item={item} canManage={canManage} patch={patch} colSpan={headers.length} />
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
