import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { widgetsByCategory } from "./widgetRegistry";
import type { UserDashboard, UserDashboardConfig, WidgetPeriod } from "./types";

type Props = {
  slug: string;
  existingDashboards: UserDashboard[];
  onClose: () => void;
  onCreated: () => void;
};

type StartMode = "blank" | "copy";

export function NewDashboardModal({ slug, existingDashboards, onClose, onCreated }: Props) {
  const { authFetch } = useAuth();
  const groups = useMemo(() => widgetsByCategory(), []);
  const [name, setName] = useState("New dashboard");
  const [mode, setMode] = useState<StartMode>("blank");
  const [copyFromId, setCopyFromId] = useState<string>(existingDashboards[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (type: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      let config: UserDashboardConfig;
      if (mode === "copy") {
        const source = existingDashboards.find((d) => d.id === copyFromId);
        if (!source) throw new Error("Source dashboard not found.");
        config = JSON.parse(JSON.stringify(source.config));
      } else {
        const widgetTypes = Array.from(selected);
        config = {
          period: "30d" as WidgetPeriod,
          widgets: widgetTypes.map((type, index) => ({
            id: `${type}-${index}`,
            type,
            visible: true,
            order: index,
            config: { period: null, filters: {} }
          }))
        };
      }
      const response = await authFetch(`/user-dashboards`, {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), slug, config })
      });
      if (!response.ok) throw new Error("Could not create dashboard.");
      onCreated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div
        className="slide-over"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="slide-over__header">
          <h2 className="s7-type-section-heading" style={{ margin: 0 }}>New dashboard</h2>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="slide-over__body">
          {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

          <label className="estimate-editor__field">
            <span>Name</span>
            <input className="s7-input" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <fieldset style={{ border: "none", padding: 0, marginTop: 16 }}>
            <legend style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
              Start
            </legend>
            <label style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
              <input type="radio" checked={mode === "blank"} onChange={() => setMode("blank")} />
              Start blank
            </label>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input type="radio" checked={mode === "copy"} onChange={() => setMode("copy")} disabled={existingDashboards.length === 0} />
              Copy from
              <select
                className="s7-input s7-input--sm"
                value={copyFromId}
                onChange={(e) => setCopyFromId(e.target.value)}
                disabled={mode !== "copy"}
              >
                {existingDashboards.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </label>
          </fieldset>

          {mode === "blank" ? (
            <div style={{ marginTop: 16 }}>
              <h3 className="s7-type-section-heading" style={{ fontSize: 14, marginBottom: 8 }}>Pick widgets</h3>
              {groups.map((group) => (
                <div key={group.category} style={{ marginBottom: 14 }}>
                  <h4 style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", margin: "0 0 6px 0" }}>
                    {group.category}
                  </h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {group.items.map((widget) => (
                      <label
                        key={widget.type}
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "flex-start",
                          padding: 10,
                          border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                          borderRadius: 6,
                          cursor: "pointer"
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(widget.type)}
                          onChange={() => toggle(widget.type)}
                          style={{ marginTop: 2 }}
                        />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{widget.name}</div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{widget.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <footer className="slide-over__footer">
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void submit()}
            disabled={busy || !name.trim() || (mode === "blank" && selected.size === 0)}
          >
            {busy ? "Creating…" : "Create dashboard"}
          </button>
        </footer>
      </div>
    </div>
  );
}
