import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

type ProjectOption = {
  id: string;
  projectNumber: string;
  name: string;
  clientName: string | null;
  hasContract: boolean;
};

export function NewContractModal({ onClose }: { onClose: () => void }) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectId, setProjectId] = useState("");
  const [contractValue, setContractValue] = useState("");
  const [retentionPct, setRetentionPct] = useState("0");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectsRes, contractsRes] = await Promise.all([
        authFetch("/projects?pageSize=100"),
        authFetch("/contracts")
      ]);
      if (!projectsRes.ok) throw new Error(await projectsRes.text());
      const projectsBody = (await projectsRes.json()) as {
        items?: Array<{ id: string; projectNumber: string; name: string; client?: { name: string } | null }>;
      };
      const items = projectsBody.items ?? [];
      const contractsBody: Array<{ project: { id: string } }> = contractsRes.ok
        ? ((await contractsRes.json()) as Array<{ project: { id: string } }>)
        : [];
      const withContract = new Set(contractsBody.map((c) => c.project.id));
      setProjects(
        items.map((p) => ({
          id: p.id,
          projectNumber: p.projectNumber,
          name: p.name,
          clientName: p.client?.name ?? null,
          hasContract: withContract.has(p.id)
        }))
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!projectId) {
      setError("Select a project.");
      return;
    }
    const value = Number(contractValue);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Contract value must be a positive number.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch("/contracts", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          contractValue: value,
          retentionPct: Number(retentionPct) || 0,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          notes: notes.trim() || undefined
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as { id: string };
      navigate(`/contracts/${created.id}`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  const availableProjects = projects.filter((p) => !p.hasContract);

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Create contract" onClick={onClose}>
      <div className="s7-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>New contract</h2>

        {loading ? (
          <p style={{ color: "var(--text-muted)" }}>Loading projects…</p>
        ) : (
          <>
            <label className="estimate-editor__field">
              <span>Project</span>
              <select
                className="s7-input"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                autoFocus
              >
                <option value="">Select a project…</option>
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.projectNumber} — {p.name}
                    {p.clientName ? ` · ${p.clientName}` : ""}
                  </option>
                ))}
              </select>
              {projects.length > 0 && availableProjects.length === 0 ? (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  All existing projects already have contracts.
                </span>
              ) : null}
            </label>

            <label className="estimate-editor__field">
              <span>Contract value (ex GST)</span>
              <input
                className="s7-input"
                type="number"
                step="0.01"
                min="0"
                value={contractValue}
                onChange={(e) => setContractValue(e.target.value)}
                placeholder="0.00"
              />
            </label>

            <label className="estimate-editor__field">
              <span>Retention %</span>
              <input
                className="s7-input"
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={retentionPct}
                onChange={(e) => setRetentionPct(e.target.value)}
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <label className="estimate-editor__field">
                <span>Start date</span>
                <input className="s7-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className="estimate-editor__field">
                <span>End date</span>
                <input className="s7-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <label className="estimate-editor__field">
              <span>Notes</span>
              <textarea
                className="s7-input"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
              />
            </label>
          </>
        )}

        {error ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{error}</p> : null}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void submit()} disabled={saving}>
            {saving ? "Creating…" : "Create contract"}
          </button>
        </div>
      </div>
    </div>
  );
}
