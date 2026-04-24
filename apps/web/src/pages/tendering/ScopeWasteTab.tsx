import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

// Waste disposal rows for a tender × discipline. truckDays and lineTotal
// are derived server-side — the UI only submits raw inputs (tonnes, loads,
// rates) and re-reads the server response. Minimal dependencies on the
// wider scope tab (just the selected discipline and the list of WBS refs
// for its scope items, for the row-level wbsRef dropdown).

type WasteRow = {
  id: string;
  tenderId: string;
  discipline: string;
  wbsRef: string | null;
  description: string;
  wasteGroup: string | null;
  wasteType: string | null;
  wasteFacility: string | null;
  wasteTonnes: string | null;
  wasteLoads: number | null;
  truckDays: string | null;
  ratePerTonne: string | null;
  ratePerLoad: string | null;
  lineTotal: string | null;
  notes: string | null;
  sortOrder: number;
};

function fmtCurrency(value: string | number | null): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(n);
}

export function ScopeWasteTab({
  tenderId,
  discipline,
  wbsRefs,
  canManage
}: {
  tenderId: string;
  discipline: string;
  wbsRefs: string[];
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [rows, setRows] = useState<WasteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/scope/waste?discipline=${discipline}`);
      if (!response.ok) throw new Error(await response.text());
      setRows((await response.json()) as WasteRow[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId, discipline]);

  useEffect(() => {
    void load();
  }, [load]);

  const addRow = async () => {
    if (!canManage) return;
    const body = {
      discipline,
      wbsRef: wbsRefs[0] ?? null,
      description: "Waste disposal"
    };
    const response = await authFetch(`/tenders/${tenderId}/scope/waste`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const patchRow = async (id: string, patch: Record<string, unknown>) => {
    const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const deleteRow = async (id: string) => {
    if (!window.confirm("Delete this waste row?")) return;
    const response = await authFetch(`/tenders/${tenderId}/scope/waste/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  const subtotal = useMemo(
    () => rows.reduce((sum, r) => sum + (r.lineTotal ? Number(r.lineTotal) : 0), 0),
    [rows]
  );

  return (
    <section className="s7-card" style={{ marginTop: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12
        }}
      >
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
          {discipline} — Waste disposal
          <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>
            ({rows.length} row{rows.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Subtotal: <strong style={{ color: "var(--text)" }}>{fmtCurrency(subtotal)}</strong>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "0 0 12px" }}>
        Waste rows live on the tender directly (not inside a scope item) so one WBS ref can
        have multiple waste streams with different facilities and rates.
      </p>

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
          No waste rows for {discipline} yet.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ background: "var(--surface-muted, #F6F6F6)" }}>
              <tr>
                {[
                  "WBS",
                  "Description",
                  "Group",
                  "Type",
                  "Facility",
                  "Tonnes",
                  "Loads",
                  "Truck days",
                  "$/T",
                  "$/Load",
                  "Line total",
                  "Notes",
                  ""
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "6px 4px",
                      textAlign: "left",
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: "var(--text-muted)"
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
                  <td style={{ padding: 2 }}>
                    <select
                      value={row.wbsRef ?? ""}
                      onChange={(e) => void patchRow(row.id, { wbsRef: e.target.value || null })}
                      disabled={!canManage}
                      style={{ fontSize: 12, padding: 2, width: 70 }}
                    >
                      <option value="">—</option>
                      {!wbsRefs.includes(row.wbsRef ?? "") && row.wbsRef ? (
                        <option value={row.wbsRef}>{row.wbsRef}</option>
                      ) : null}
                      {wbsRefs.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      defaultValue={row.description}
                      disabled={!canManage}
                      onBlur={(e) =>
                        e.target.value !== row.description &&
                        void patchRow(row.id, { description: e.target.value })
                      }
                      style={{ width: "100%" }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      defaultValue={row.wasteGroup ?? ""}
                      disabled={!canManage}
                      onBlur={(e) =>
                        (e.target.value || null) !== (row.wasteGroup ?? null) &&
                        void patchRow(row.id, { wasteGroup: e.target.value || null })
                      }
                      placeholder="e.g. C&D"
                      style={{ width: 100 }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      defaultValue={row.wasteType ?? ""}
                      disabled={!canManage}
                      onBlur={(e) =>
                        (e.target.value || null) !== (row.wasteType ?? null) &&
                        void patchRow(row.id, { wasteType: e.target.value || null })
                      }
                      placeholder="e.g. General"
                      style={{ width: 110 }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      defaultValue={row.wasteFacility ?? ""}
                      disabled={!canManage}
                      onBlur={(e) =>
                        (e.target.value || null) !== (row.wasteFacility ?? null) &&
                        void patchRow(row.id, { wasteFacility: e.target.value || null })
                      }
                      placeholder="e.g. BMI"
                      style={{ width: 120 }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.wasteTonnes ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.wasteTonnes))
                          void patchRow(row.id, { wasteTonnes: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      defaultValue={row.wasteLoads ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.wasteLoads))
                          void patchRow(row.id, { wasteLoads: n });
                      }}
                      style={{ width: 60, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2, fontSize: 12, color: "var(--text-muted)", textAlign: "right" }}>
                    {row.truckDays ?? "—"}
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.ratePerTonne ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.ratePerTonne))
                          void patchRow(row.id, { ratePerTonne: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      type="number"
                      step="0.01"
                      defaultValue={row.ratePerLoad ?? ""}
                      disabled={!canManage}
                      onBlur={(e) => {
                        const n = e.target.value === "" ? null : Number(e.target.value);
                        if (String(n) !== String(row.ratePerLoad))
                          void patchRow(row.id, { ratePerLoad: n });
                      }}
                      style={{ width: 70, textAlign: "right" }}
                    />
                  </td>
                  <td style={{ padding: 2, fontWeight: 500, textAlign: "right" }}>
                    {fmtCurrency(row.lineTotal)}
                  </td>
                  <td style={{ padding: 2 }}>
                    <input
                      className="s7-input s7-input--sm"
                      defaultValue={row.notes ?? ""}
                      disabled={!canManage}
                      onBlur={(e) =>
                        (e.target.value || null) !== (row.notes ?? null) &&
                        void patchRow(row.id, { notes: e.target.value || null })
                      }
                      style={{ width: 160 }}
                    />
                  </td>
                  <td style={{ padding: 2 }}>
                    {canManage ? (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => void deleteRow(row.id)}
                        aria-label="Delete waste row"
                      >
                        ×
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          style={{ marginTop: 12 }}
          onClick={() => void addRow()}
        >
          + Add waste row
        </button>
      ) : null}
    </section>
  );
}
