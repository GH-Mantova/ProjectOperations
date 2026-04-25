import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type IncidentType =
  | "near_miss"
  | "first_aid"
  | "medical_treatment"
  | "lost_time"
  | "dangerous_occurrence"
  | "property_damage";

type Severity = "low" | "medium" | "high" | "critical";

type HazardType =
  | "physical"
  | "chemical"
  | "biological"
  | "ergonomic"
  | "electrical"
  | "fire"
  | "environmental"
  | "other";

type RiskLevel = "low" | "medium" | "high" | "extreme";

const INCIDENT_TYPES: Array<{ value: IncidentType; label: string }> = [
  { value: "near_miss", label: "Near miss" },
  { value: "first_aid", label: "First aid" },
  { value: "medical_treatment", label: "Medical treatment" },
  { value: "lost_time", label: "Lost time injury" },
  { value: "dangerous_occurrence", label: "Dangerous occurrence" },
  { value: "property_damage", label: "Property damage" }
];
const SEVERITIES: Array<{ value: Severity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" }
];
const HAZARD_TYPES: Array<{ value: HazardType; label: string }> = [
  { value: "physical", label: "Physical" },
  { value: "chemical", label: "Chemical" },
  { value: "biological", label: "Biological" },
  { value: "ergonomic", label: "Ergonomic" },
  { value: "electrical", label: "Electrical" },
  { value: "fire", label: "Fire" },
  { value: "environmental", label: "Environmental" },
  { value: "other", label: "Other" }
];
const RISK_LEVELS: Array<{ value: RiskLevel; label: string }> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "extreme", label: "Extreme" }
];

type RecentReport = {
  id: string;
  kind: "incident" | "hazard";
  number: string;
  description: string;
  date: string;
  severity?: string;
  riskLevel?: string;
};

export function FieldSafetyPage() {
  const { authFetch } = useAuth();
  const [mode, setMode] = useState<"home" | "incident" | "hazard">("home");
  const [recent, setRecent] = useState<RecentReport[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const loadRecent = useCallback(async () => {
    try {
      const [iRes, hRes] = await Promise.all([
        authFetch("/safety/incidents?limit=5"),
        authFetch("/safety/hazards?limit=5")
      ]);
      const incidents = iRes.ok
        ? ((await iRes.json()) as {
            items: Array<{
              id: string;
              incidentNumber: string;
              description: string;
              incidentDate: string;
              severity: string;
            }>;
          }).items
        : [];
      const hazards = hRes.ok
        ? ((await hRes.json()) as {
            items: Array<{
              id: string;
              hazardNumber: string;
              description: string;
              observationDate: string;
              riskLevel: string;
            }>;
          }).items
        : [];
      const merged: RecentReport[] = [
        ...incidents.map((i) => ({
          id: i.id,
          kind: "incident" as const,
          number: i.incidentNumber,
          description: i.description,
          date: i.incidentDate,
          severity: i.severity
        })),
        ...hazards.map((h) => ({
          id: h.id,
          kind: "hazard" as const,
          number: h.hazardNumber,
          description: h.description,
          date: h.observationDate,
          riskLevel: h.riskLevel
        }))
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);
      setRecent(merged);
    } catch {
      // Best-effort.
    }
  }, [authFetch]);

  useEffect(() => {
    void loadRecent();
  }, [loadRecent]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  if (mode === "incident") {
    return (
      <IncidentForm
        onSaved={(num) => {
          setMode("home");
          setToast(`Incident ${num} reported.`);
          void loadRecent();
        }}
        onCancel={() => setMode("home")}
      />
    );
  }
  if (mode === "hazard") {
    return (
      <HazardForm
        onSaved={(num) => {
          setMode("home");
          setToast(`Hazard ${num} logged.`);
          void loadRecent();
        }}
        onCancel={() => setMode("home")}
      />
    );
  }

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: 20, fontFamily: "Syne, Outfit, sans-serif" }}>
        Safety
      </h2>

      <button
        type="button"
        className="field-btn"
        onClick={() => setMode("incident")}
        style={{
          width: "100%",
          padding: "20px 16px",
          fontSize: 18,
          background: "#dc2626",
          color: "#fff",
          marginBottom: 12
        }}
      >
        🔴 Report Incident
      </button>

      <button
        type="button"
        className="field-btn"
        onClick={() => setMode("hazard")}
        style={{
          width: "100%",
          padding: "20px 16px",
          fontSize: 18,
          background: "#f59e0b",
          color: "#fff",
          marginBottom: 16
        }}
      >
        🟡 Report Hazard
      </button>

      <h3 style={{ margin: "16px 0 8px", fontSize: 14, color: "#374151" }}>My recent reports</h3>
      {recent.length === 0 ? (
        <p style={{ color: "#6b7280", fontSize: 13 }}>No reports yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {recent.map((r) => (
            <li key={`${r.kind}-${r.id}`} className="field-card" style={{ padding: 10 }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                {r.number} · {r.kind === "incident" ? "Incident" : "Hazard"} ·{" "}
                {new Date(r.date).toLocaleDateString("en-AU")}
                {r.severity ? ` · ${r.severity}` : ""}
                {r.riskLevel ? ` · ${r.riskLevel} risk` : ""}
              </div>
              <div style={{ fontSize: 13, marginTop: 2 }}>{r.description}</div>
            </li>
          ))}
        </ul>
      )}

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 80,
            left: 16,
            right: 16,
            padding: 12,
            background: "#005B61",
            color: "#fff",
            borderRadius: 8,
            fontSize: 14,
            textAlign: "center"
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function IncidentForm({
  onSaved,
  onCancel
}: {
  onSaved: (incidentNumber: string) => void;
  onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    incidentDate: new Date().toISOString().slice(0, 16),
    location: "",
    incidentType: "near_miss" as IncidentType,
    severity: "medium" as Severity,
    description: "",
    immediateAction: "",
    witnesses: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location.trim() || !form.description.trim()) {
      setErr("Location and description are required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const response = await authFetch("/safety/incidents", {
        method: "POST",
        body: JSON.stringify({
          incidentDate: new Date(form.incidentDate).toISOString(),
          location: form.location.trim(),
          incidentType: form.incidentType,
          severity: form.severity,
          description: form.description.trim(),
          immediateAction: form.immediateAction.trim() || null,
          witnesses: form.witnesses
            ? form.witnesses.split(",").map((w) => w.trim()).filter(Boolean)
            : []
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as { incidentNumber: string };
      onSaved(created.incidentNumber);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Report incident</h2>
      <FieldInput
        label="When"
        type="datetime-local"
        value={form.incidentDate}
        onChange={(v) => setForm({ ...form, incidentDate: v })}
      />
      <FieldInput
        label="Location *"
        value={form.location}
        onChange={(v) => setForm({ ...form, location: v })}
        placeholder="Site or area"
      />
      <FieldSelect
        label="Type"
        value={form.incidentType}
        onChange={(v) => setForm({ ...form, incidentType: v as IncidentType })}
        options={INCIDENT_TYPES}
      />
      <FieldSelect
        label="Severity"
        value={form.severity}
        onChange={(v) => setForm({ ...form, severity: v as Severity })}
        options={SEVERITIES}
      />
      <FieldTextarea
        label="What happened *"
        value={form.description}
        onChange={(v) => setForm({ ...form, description: v })}
      />
      <FieldTextarea
        label="Immediate action taken"
        value={form.immediateAction}
        onChange={(v) => setForm({ ...form, immediateAction: v })}
      />
      <FieldInput
        label="Witnesses (comma-separated)"
        value={form.witnesses}
        onChange={(v) => setForm({ ...form, witnesses: v })}
      />
      {err ? <p style={{ color: "#dc2626", margin: 0 }}>{err}</p> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="field-btn" onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </button>
        <button
          type="submit"
          className="field-btn"
          disabled={submitting}
          style={{ flex: 1, background: "#005B61", color: "#fff" }}
        >
          {submitting ? "Sending…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

function HazardForm({
  onSaved,
  onCancel
}: {
  onSaved: (hazardNumber: string) => void;
  onCancel: () => void;
}) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    observationDate: new Date().toISOString().slice(0, 16),
    location: "",
    hazardType: "physical" as HazardType,
    riskLevel: "medium" as RiskLevel,
    description: "",
    immediateAction: "",
    dueDate: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location.trim() || !form.description.trim()) {
      setErr("Location and description are required.");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      const response = await authFetch("/safety/hazards", {
        method: "POST",
        body: JSON.stringify({
          observationDate: new Date(form.observationDate).toISOString(),
          location: form.location.trim(),
          hazardType: form.hazardType,
          riskLevel: form.riskLevel,
          description: form.description.trim(),
          immediateAction: form.immediateAction.trim() || null,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null
        })
      });
      if (!response.ok) throw new Error(await response.text());
      const created = (await response.json()) as { hazardNumber: string };
      onSaved(created.hazardNumber);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>Report hazard</h2>
      <FieldInput
        label="When"
        type="datetime-local"
        value={form.observationDate}
        onChange={(v) => setForm({ ...form, observationDate: v })}
      />
      <FieldInput
        label="Location *"
        value={form.location}
        onChange={(v) => setForm({ ...form, location: v })}
      />
      <FieldSelect
        label="Hazard type"
        value={form.hazardType}
        onChange={(v) => setForm({ ...form, hazardType: v as HazardType })}
        options={HAZARD_TYPES}
      />
      <FieldSelect
        label="Risk level"
        value={form.riskLevel}
        onChange={(v) => setForm({ ...form, riskLevel: v as RiskLevel })}
        options={RISK_LEVELS}
      />
      <FieldTextarea
        label="What's the hazard *"
        value={form.description}
        onChange={(v) => setForm({ ...form, description: v })}
      />
      <FieldTextarea
        label="Immediate action taken"
        value={form.immediateAction}
        onChange={(v) => setForm({ ...form, immediateAction: v })}
      />
      <FieldInput
        label="Due date (for follow-up)"
        type="date"
        value={form.dueDate}
        onChange={(v) => setForm({ ...form, dueDate: v })}
      />
      {err ? <p style={{ color: "#dc2626", margin: 0 }}>{err}</p> : null}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="field-btn" onClick={onCancel} style={{ flex: 1 }}>
          Cancel
        </button>
        <button
          type="submit"
          className="field-btn"
          disabled={submitting}
          style={{ flex: 1, background: "#f59e0b", color: "#fff" }}
        >
          {submitting ? "Sending…" : "Submit"}
        </button>
      </div>
    </form>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#374151" }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ padding: "12px 10px", fontSize: 15, border: "1px solid #d1d5db", borderRadius: 6 }}
      />
    </label>
  );
}

function FieldSelect<T extends string>({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#374151" }}>{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        style={{
          padding: "12px 10px",
          fontSize: 15,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: "#fff"
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function FieldTextarea({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#374151" }}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          padding: "12px 10px",
          fontSize: 15,
          border: "1px solid #d1d5db",
          borderRadius: 6,
          resize: "vertical",
          fontFamily: "inherit"
        }}
      />
    </label>
  );
}
