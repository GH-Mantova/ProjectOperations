import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  emptyForm,
  formFromRecord,
  toCreatePayload,
  validateForm,
  type Competency,
  type JobRoleForm,
  type JobRoleRecord
} from "./jobRolesHelpers";

const TOUCH_TARGET: CSSProperties = { minHeight: 44, minWidth: 44 };

export function JobRolesPage() {
  const { authFetch } = useAuth();
  const [roles, setRoles] = useState<JobRoleRecord[] | null>(null);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<JobRoleForm>(emptyForm());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setRoles(null);
    const [rolesRes, compRes] = await Promise.all([
      authFetch("/job-roles"),
      authFetch("/competencies?page=1&pageSize=500")
    ]);
    const rolesJson: JobRoleRecord[] = rolesRes.ok ? await rolesRes.json() : [];
    const compJson = compRes.ok ? await compRes.json() : { items: [] };
    setRoles(rolesJson);
    setCompetencies(compJson.items ?? []);
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  const competencyById = useMemo(() => {
    const map = new Map<string, Competency>();
    for (const c of competencies) map.set(c.id, c);
    return map;
  }, [competencies]);

  const startCreate = () => {
    setEditingId("new");
    setForm(emptyForm());
    setError(null);
  };

  const startEdit = (rec: JobRoleRecord) => {
    setEditingId(rec.id);
    setForm(formFromRecord(rec));
    setError(null);
  };

  const cancel = () => {
    setEditingId(null);
    setForm(emptyForm());
    setError(null);
  };

  const save = async () => {
    const verdict = validateForm(form);
    if (!verdict.ok) {
      setError(verdict.reason);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = toCreatePayload(form);
      const isNew = editingId === "new";
      const res = await authFetch(isNew ? "/job-roles" : `/job-roles/${editingId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message ?? "Failed to save job role.");
        return;
      }
      cancel();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this job role?")) return;
    const res = await authFetch(`/job-roles/${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError("Failed to delete job role.");
      return;
    }
    await load();
  };

  const toggleRequirement = (competencyId: string) => {
    setForm((prev) => {
      const existing = prev.requirements.find((r) => r.competencyId === competencyId);
      if (existing) {
        return {
          ...prev,
          requirements: prev.requirements.filter((r) => r.competencyId !== competencyId)
        };
      }
      return {
        ...prev,
        requirements: [...prev.requirements, { competencyId, isMandatory: true }]
      };
    });
  };

  const toggleMandatory = (competencyId: string) => {
    setForm((prev) => ({
      ...prev,
      requirements: prev.requirements.map((r) =>
        r.competencyId === competencyId ? { ...r, isMandatory: !r.isMandatory } : r
      )
    }));
  };

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ margin: 0 }}>Job Roles</h1>
          <p style={{ margin: "4px 0 0", color: "var(--text-muted, #555)" }}>
            Named job functions that bundle required competencies. Used by the scheduler to
            decide who is eligible for a shift.
          </p>
        </div>
        <button
          type="button"
          onClick={startCreate}
          disabled={editingId !== null}
          style={{ ...TOUCH_TARGET, padding: "0 16px", borderRadius: "var(--radius-md, 6px)" }}
        >
          + New job role
        </button>
      </header>

      {error ? (
        <div role="alert" style={{ color: "var(--status-error, #b00020)" }}>
          {error}
        </div>
      ) : null}

      {editingId ? (
        <div
          style={{
            border: "1px solid var(--surface-border, #d0d0d0)",
            borderRadius: "var(--radius-md, 8px)",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12
          }}
        >
          <h2 style={{ margin: 0 }}>{editingId === "new" ? "New job role" : "Edit job role"}</h2>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={{ ...TOUCH_TARGET, padding: "0 8px" }}
              data-testid="job-role-name"
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              style={{ padding: 8 }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span>Colour</span>
            <input
              type="text"
              value={form.colour}
              placeholder="#2e7d32"
              onChange={(e) => setForm({ ...form, colour: e.target.value })}
              style={{ ...TOUCH_TARGET, padding: "0 8px", maxWidth: 160 }}
            />
          </label>

          <fieldset
            style={{
              border: "1px solid var(--surface-border, #d0d0d0)",
              borderRadius: 6,
              padding: 12
            }}
          >
            <legend>Required competencies</legend>
            {competencies.length === 0 ? (
              <p style={{ color: "var(--text-muted, #555)" }}>No competencies defined yet.</p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                {competencies.map((c) => {
                  const selected = form.requirements.find((r) => r.competencyId === c.id);
                  return (
                    <li key={c.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <label
                        style={{ display: "flex", alignItems: "center", gap: 8, ...TOUCH_TARGET }}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selected)}
                          onChange={() => toggleRequirement(c.id)}
                          data-testid={`req-${c.id}`}
                        />
                        <span>
                          {c.name}
                          {c.code ? <small style={{ marginLeft: 6 }}>({c.code})</small> : null}
                        </span>
                      </label>
                      {selected ? (
                        <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <input
                            type="checkbox"
                            checked={selected.isMandatory}
                            onChange={() => toggleMandatory(c.id)}
                          />
                          <span>Mandatory</span>
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              style={{ ...TOUCH_TARGET, padding: "0 16px" }}
              data-testid="job-role-save"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              style={{ ...TOUCH_TARGET, padding: "0 16px" }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {roles === null ? (
        <Skeleton style={{ height: 120 }} />
      ) : roles.length === 0 ? (
        <EmptyState
          heading="No job roles yet"
          subtext="Create the first job role to start building your scheduler eligibility catalogue."
          action={
            <button type="button" onClick={startCreate} style={{ ...TOUCH_TARGET, padding: "0 16px" }}>
              + New job role
            </button>
          }
        />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--surface-border, #d0d0d0)" }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>Description</th>
              <th style={{ padding: 8 }}>Requirements</th>
              <th style={{ padding: 8 }} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {roles.map((rec) => (
              <tr key={rec.id} style={{ borderBottom: "1px solid var(--surface-border, #eee)" }}>
                <td style={{ padding: 8 }}>
                  {rec.colour ? (
                    <span
                      aria-hidden
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        background: rec.colour,
                        borderRadius: 3,
                        marginRight: 8
                      }}
                    />
                  ) : null}
                  {rec.name}
                </td>
                <td style={{ padding: 8 }}>{rec.description ?? ""}</td>
                <td style={{ padding: 8 }}>
                  {rec.requirements
                    .map((r) => competencyById.get(r.competencyId)?.name ?? r.competency.name)
                    .join(", ")}
                </td>
                <td style={{ padding: 8, display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => startEdit(rec)}
                    style={{ ...TOUCH_TARGET, padding: "0 12px" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(rec.id)}
                    style={{ ...TOUCH_TARGET, padding: "0 12px" }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
