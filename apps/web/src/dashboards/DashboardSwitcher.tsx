import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { NewDashboardModal } from "./NewDashboardModal";
import type { UserDashboard } from "./types";

type Props = {
  slug: string;
  dashboards: UserDashboard[];
  activeId: string | null;
  onSelect: (dashboard: UserDashboard) => void;
  onListRefresh: () => void;
};

export function DashboardSwitcher({ slug, dashboards, activeId, onSelect, onListRefresh }: Props) {
  const { authFetch } = useAuth();
  const [open, setOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const setDefault = async (id: string) => {
    await authFetch(`/user-dashboards/${id}/default`, { method: "POST" });
    onListRefresh();
  };

  const deleteDashboard = async (id: string) => {
    if (!window.confirm("Delete this dashboard?")) return;
    await authFetch(`/user-dashboards/${id}`, { method: "DELETE" });
    onListRefresh();
  };

  const rename = async (dash: UserDashboard) => {
    const next = window.prompt("New dashboard name:", dash.name);
    if (!next || !next.trim() || next.trim() === dash.name) return;
    await authFetch(`/user-dashboards/${dash.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: next.trim() })
    });
    onListRefresh();
  };

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
      <button
        type="button"
        className="s7-btn s7-btn--secondary s7-btn--sm"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        Dashboards ▾
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: 6,
            minWidth: 240,
            background: "var(--surface-card, white)",
            border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 6,
            zIndex: 40
          }}
        >
          {dashboards.length === 0 ? (
            <p style={{ margin: 8, color: "var(--text-muted)", fontSize: 13 }}>No dashboards yet.</p>
          ) : (
            dashboards.map((d) => (
              <button
                key={d.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onSelect(d);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  width: "100%",
                  padding: "8px 10px",
                  background: d.id === activeId ? "var(--surface-subtle, rgba(0,0,0,0.04))" : "transparent",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  textAlign: "left"
                }}
              >
                <span style={{ fontWeight: d.id === activeId ? 600 : 400 }}>{d.name}</span>
                {d.isSystem ? <span style={{ fontSize: 11, color: "var(--text-muted)" }}>System</span> : null}
              </button>
            ))
          )}
          <div style={{ height: 1, background: "var(--border-subtle, rgba(0,0,0,0.08))", margin: "6px 0" }} />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setNewOpen(true);
              setOpen(false);
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 10px",
              border: "none",
              background: "transparent",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              textAlign: "left"
            }}
          >
            + New dashboard
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setManageOpen(true);
              setOpen(false);
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 10px",
              border: "none",
              background: "transparent",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              textAlign: "left"
            }}
          >
            Manage dashboards
          </button>
        </div>
      ) : null}

      {newOpen ? (
        <NewDashboardModal
          slug={slug}
          existingDashboards={dashboards}
          onClose={() => setNewOpen(false)}
          onCreated={() => {
            setNewOpen(false);
            onListRefresh();
          }}
        />
      ) : null}

      {manageOpen ? (
        <div className="slide-over-overlay" role="dialog" aria-modal="true" onClick={() => setManageOpen(false)}>
          <div
            className="slide-over"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <header className="slide-over__header">
              <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Manage dashboards</h2>
              <button type="button" className="slide-over__close" onClick={() => setManageOpen(false)}>×</button>
            </header>
            <div className="slide-over__body">
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                {dashboards.map((d) => (
                  <li
                    key={d.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto auto auto",
                      gap: 8,
                      alignItems: "center",
                      padding: "8px 10px",
                      border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                      borderRadius: 6
                    }}
                  >
                    <span>
                      <strong>{d.name}</strong>
                      {d.isDefault ? <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>default</span> : null}
                      {d.isSystem ? <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-muted)" }}>system</span> : null}
                    </span>
                    <button
                      type="button"
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      onClick={() => void setDefault(d.id)}
                      disabled={d.isDefault}
                    >
                      Default
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--secondary s7-btn--sm"
                      onClick={() => void rename(d)}
                      disabled={d.isSystem}
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--danger s7-btn--sm"
                      onClick={() => void deleteDashboard(d.id)}
                      disabled={d.isSystem}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
