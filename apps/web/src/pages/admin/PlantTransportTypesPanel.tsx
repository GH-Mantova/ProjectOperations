/**
 * PlantTransportTypesPanel.tsx -- TRANSPORT_CAPACITY_MATRIX_V1 (scopecards-s9)
 *
 * Admin panel for assigning a Transport type to transport-category plant rates.
 * The option list is read from the transport-capacity matrix's own Transport type
 * KEY column (via GET /estimate-rates/plant/transport-types) -- never a hard-coded list --
 * so the two cannot drift apart.
 *
 * Only transport-category rows are shown (where category === "Truck" or unit === "each way").
 * Blank transport type means "no matrix default" -- the estimator types a capacity manually.
 */

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { readApiErrorMessage } from "../../lib/api-errors";

type PlantRate = {
  id: string;
  item: string;
  category: string | null;
  unit: string;
  rate: string;
  isActive: boolean;
  transportType: string | null;
};

function isTransportPlantRate(p: PlantRate): boolean {
  return p.category === "Truck" || p.unit === "each way";
}

export function PlantTransportTypesPanel() {
  const { authFetch } = useAuth();
  const [plantRates, setPlantRates] = useState<PlantRate[]>([]);
  // Options list read from the matrix's own Transport type key column.
  const [matrixTypes, setMatrixTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ratesRes, typesRes] = await Promise.all([
        authFetch("/estimate-rates/plant"),
        // TRANSPORT_CAPACITY_MATRIX_V1 -- the option list comes from the matrix,
        // not a hard-coded array. This endpoint reads the matrix's Transport type
        // KEY column live so it cannot drift from what Marco configures in Rates & Lists.
        authFetch("/estimate-rates/plant/transport-types")
      ]);
      if (!ratesRes.ok) throw new Error(await readApiErrorMessage(ratesRes));
      const rates = (await ratesRes.json()) as PlantRate[];
      setPlantRates(rates.filter(isTransportPlantRate));
      if (typesRes.ok) {
        const types = (await typesRes.json()) as string[];
        setMatrixTypes(types);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const setTransportType = async (id: string, item: string, transportType: string | null) => {
    setSaving((prev) => ({ ...prev, [id]: true }));
    try {
      const rate = plantRates.find((p) => p.id === id);
      if (!rate) return;
      const res = await authFetch(`/estimate-rates/plant/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          item: rate.item,
          rate: rate.rate,
          transportType: transportType ?? null
        })
      });
      if (!res.ok) {
        setError(await readApiErrorMessage(res));
        return;
      }
      // Update local state
      setPlantRates((prev) =>
        prev.map((p) => (p.id === id ? { ...p, transportType: transportType ?? null } : p))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving((prev) => ({ ...prev, [id]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>
        Loading transport rates...
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "0 0 12px" }}>
        The Transport type list comes from the transport-capacity matrix's own
        Transport type column — it cannot drift from what is configured there.
        Leave blank and that rate has no capacity default; the estimator types one manually.
      </p>

      {error ? (
        <div style={{
          marginBottom: 12,
          padding: 10,
          borderRadius: 6,
          background: "rgba(220,38,38,0.08)",
          borderLeft: "3px solid var(--status-danger)",
          fontSize: 12,
          color: "var(--status-danger)"
        }}>
          {error}
        </div>
      ) : null}

      {plantRates.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          No transport-category plant rates found (category &quot;Truck&quot; or unit &quot;each way&quot;).
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12.5 }}>
            <thead>
              <tr>
                {["Rate", "Category", "Transport type", "Rate / day", ""].map((h) => (
                  <th key={h} style={{
                    textAlign: h === "Rate / day" ? "right" : "left",
                    padding: "7px 10px",
                    background: "var(--surface-subtle)",
                    fontWeight: 600,
                    fontSize: 10.5,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border-default)"
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plantRates.map((p) => (
                <tr key={p.id} style={{ borderTop: "1px solid var(--surface-subtle)" }}>
                  <td style={{ padding: "7px 10px" }}>
                    {p.item}
                    {!p.isActive ? (
                      <span style={{ fontSize: 10, marginLeft: 6, color: "var(--text-muted)" }}>
                        (inactive)
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: "7px 10px", color: "var(--text-muted)" }}>
                    {p.category ?? "—"}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <select
                      className="s7-select s7-input--sm"
                      value={p.transportType ?? ""}
                      disabled={saving[p.id]}
                      onChange={(e) => {
                        const next = e.target.value || null;
                        void setTransportType(p.id, p.item, next);
                      }}
                      style={{ minWidth: 160 }}
                      title="Which transport-capacity matrix type does this rig correspond to?"
                    >
                      <option value="">— no matrix default —</option>
                      {matrixTypes.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "7px 10px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    ${Number(p.rate).toFixed(2)} / {p.unit}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    {p.transportType ? (
                      <span style={{
                        display: "inline-block",
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 4,
                        border: "1px solid var(--brand-primary)",
                        color: "var(--brand-primary)",
                        background: "var(--brand-primary-light)",
                        whiteSpace: "nowrap"
                      }}>
                        Sizes loads
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-block",
                        fontSize: 10.5,
                        fontWeight: 700,
                        padding: "1px 7px",
                        borderRadius: 4,
                        border: "1px solid var(--border-default)",
                        color: "var(--text-muted)",
                        background: "var(--surface-card)",
                        whiteSpace: "nowrap"
                      }}>
                        No capacity default
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
