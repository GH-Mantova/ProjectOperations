import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type ItemType = "saw-cut" | "core-hole";

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
  notes: string | null;
  sortOrder: number;
};

const SAW_EQUIPMENT = ["Roadsaw", "Demosaw", "Ringsaw", "Flush-cut", "Tracksaw"];
const ELEVATIONS = ["Floor", "Wall", "Inverted"];
const SAW_MATERIALS = ["Concrete unreinforced", "Concrete reinforced", "Masonry", "Asphalt"];
const CORE_DIAMETERS = [32, 50, 75, 100, 150, 200, 250, 300, 400, 500, 650];
const SHIFTS = ["Day", "Night", "Weekend"];

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ItemType>("saw-cut");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items`);
      if (!response.ok) throw new Error(await response.text());
      setItems((await response.json()) as CuttingItem[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => items.filter((i) => i.itemType === tab), [items, tab]);
  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + (i.lineTotal ? Number(i.lineTotal) : 0), 0),
    [items]
  );

  const addItem = async () => {
    if (!canManage) return;
    const wbsRef = wbsRefs[0] ?? "SO1";
    const response = await authFetch(`/tenders/${tenderId}/scope/cutting-items`, {
      method: "POST",
      body: JSON.stringify({
        wbsRef,
        itemType: tab,
        shift: "Day"
      })
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          Concrete cutting
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({items.length} item{items.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Subtotal: <strong style={{ color: "var(--text)" }}>{fmt(subtotal)}</strong>
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border, #e5e7eb)", marginBottom: 12 }}>
        {(["saw-cut", "core-hole"] as ItemType[]).map((t) => {
          const active = t === tab;
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
              {t === "saw-cut" ? "Saw cuts" : "Core holes"} (
              {items.filter((i) => i.itemType === t).length})
            </button>
          );
        })}
      </div>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : visible.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No {tab === "saw-cut" ? "saw cuts" : "core holes"} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          {tab === "saw-cut" ? (
            <SawCutTable items={visible} wbsRefs={wbsRefs} canManage={canManage} patch={patch} remove={remove} />
          ) : (
            <CoreHoleTable items={visible} wbsRefs={wbsRefs} canManage={canManage} patch={patch} remove={remove} />
          )}
        </div>
      )}

      {canManage ? (
        <button type="button" className="s7-btn s7-btn--primary" style={{ marginTop: 12 }} onClick={() => void addItem()}>
          + Add {tab === "saw-cut" ? "saw cut" : "core hole"}
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

function SawCutTable({ items, wbsRefs, canManage, patch, remove }: RowProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
        <tr>
          {["WBS", "Description", "Equipment", "Elevation", "Material", "Depth mm", "Qty Lm", "Rate $/m", "Shift", "Loading $", "Line total", "Notes", ""].map((h) => (
            <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const showLoading = item.shift === "Night" || item.shift === "Weekend";
          return (
            <tr key={item.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: 4 }}>
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
                  onChange={(e) => void patch(item.id, { equipment: e.target.value || null })}
                >
                  <option value="">—</option>
                  {SAW_EQUIPMENT.map((eq) => <option key={eq} value={eq}>{eq}</option>)}
                </select>
              </td>
              <td style={{ padding: 4 }}>
                <select
                  className="s7-input"
                  value={item.elevation ?? ""}
                  disabled={!canManage}
                  onChange={(e) => void patch(item.id, { elevation: e.target.value || null })}
                >
                  <option value="">—</option>
                  {ELEVATIONS.map((el) => <option key={el} value={el}>{el}</option>)}
                </select>
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
                <input
                  className="s7-input"
                  defaultValue={item.notes ?? ""}
                  disabled={!canManage}
                  onBlur={(e) => void patch(item.id, { notes: e.target.value })}
                />
              </td>
              <td style={{ padding: 4 }}>
                {canManage ? (
                  <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void remove(item.id)}>×</button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function CoreHoleTable({ items, wbsRefs, canManage, patch, remove }: RowProps) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
        <tr>
          {["WBS", "Description", "Diameter mm", "Quantity", "Rate $/hole", "Shift", "Loading $", "Line total", "Notes", ""].map((h) => (
            <th key={h} style={{ padding: "8px 6px", textAlign: "left", fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const showLoading = item.shift === "Night" || item.shift === "Weekend";
          const diameter = item.diameterMm ?? 0;
          const isStandard = CORE_DIAMETERS.includes(diameter);
          return (
            <tr key={item.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: 4 }}>
                <select
                  className="s7-input"
                  value={item.wbsRef}
                  disabled={!canManage}
                  onChange={(e) => void patch(item.id, { wbsRef: e.target.value })}
                  style={{ width: 80 }}
                >
                  {!wbsRefs.includes(item.wbsRef) ? <option value={item.wbsRef}>{item.wbsRef}</option> : null}
                  {wbsRefs.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
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
                <input
                  className="s7-input"
                  type="number"
                  defaultValue={item.quantityEach ?? ""}
                  disabled={!canManage}
                  style={{ width: 80 }}
                  onBlur={(e) => void patch(item.id, { quantityEach: numOrNull(e.target.value) })}
                />
              </td>
              <td style={{ padding: 4, color: "var(--text-muted)" }}>{fmt(item.ratePerHole)}</td>
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
                <input
                  className="s7-input"
                  defaultValue={item.notes ?? ""}
                  disabled={!canManage}
                  onBlur={(e) => void patch(item.id, { notes: e.target.value })}
                />
              </td>
              <td style={{ padding: 4 }}>
                {canManage ? (
                  <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => void remove(item.id)}>×</button>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
