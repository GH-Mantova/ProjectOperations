import { useEffect, useState } from "react";
import { Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  estimatorInitials,
  loadEstimators,
  patchAssignedEstimator,
  type EstimatorOption
} from "./teamEstimatorActions";

export function TeamEstimatorPanel({
  tenderId,
  assignedEstimatorId,
  canManage
}: {
  tenderId: string;
  assignedEstimatorId: string | null;
  canManage: boolean;
}) {
  const { authFetch } = useAuth();
  const [options, setOptions] = useState<EstimatorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(assignedEstimatorId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSelectedId(assignedEstimatorId);
  }, [assignedEstimatorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadEstimators(authFetch);
        if (!cancelled) setOptions(loaded);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const selected = options.find((o) => o.id === selectedId) ?? null;

  const assign = async (nextId: string | null) => {
    const previous = selectedId;
    setSelectedId(nextId);
    setSaving(true);
    setError(null);
    try {
      await patchAssignedEstimator(authFetch, tenderId, nextId);
    } catch (err) {
      setSelectedId(previous);
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="s7-card" data-testid="team-estimator-panel">
      <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Team</h3>
      {loading ? (
        <div>
          <Skeleton width="40%" height={14} />
          <Skeleton width="100%" height={36} style={{ marginTop: 8 }} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {selected ? (
            <div className="tender-detail__team-row" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="tender-detail__avatar">{estimatorInitials(selected)}</span>
              <div>
                <strong>{selected.firstName} {selected.lastName}</strong>
                <p
                  className="s7-type-label"
                  style={{ margin: 0, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-muted)" }}
                >
                  Estimator
                </p>
              </div>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>Unassigned</p>
          )}
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
            <span className="s7-type-label">Assigned estimator</span>
            <select
              className="s7-select"
              aria-label="Assigned estimator"
              value={selectedId ?? ""}
              disabled={!canManage || saving}
              onChange={(event) => void assign(event.target.value || null)}
            >
              <option value="">Unassigned</option>
              {selectedId && !selected ? (
                <option value={selectedId}>Current assignee (no estimator role)</option>
              ) : null}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.firstName} {option.lastName}
                </option>
              ))}
            </select>
          </label>
          {error ? (
            <p style={{ color: "var(--status-danger)", fontSize: 12, margin: 0 }}>{error}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
