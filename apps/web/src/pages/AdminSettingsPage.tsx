import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AdminUsersTab } from "./admin/AdminUsersTab";

type Trigger = {
  id: string;
  trigger: string;
  label: string;
  description: string;
  isEnabled: boolean;
  deliveryMethod: "both" | "email" | "inapp";
  recipientRoles: string[];
  recipientUserIds: string[];
};

type AdminUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: { name: string };
};

type EmailConfig = {
  id: string;
  provider: "outlook" | "gmail";
  senderAddress: string;
  senderName: string;
  isConfigured: boolean;
  updatedAt: string;
  updatedById: string | null;
};

const TABS = [
  { id: "notifications", label: "Notifications" },
  { id: "email", label: "Email" },
  { id: "users", label: "Users" },
  { id: "ai", label: "AI & Integrations" },
  { id: "platform", label: "Platform" },
  { id: "permissions", label: "Permissions" },
  { id: "audit", label: "Audit log" }
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AdminSettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.roles?.some((r) => r.name === "Admin") ?? false;
  const [tab, setTab] = useState<TabId>("notifications");

  if (!user) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>Admin settings</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        System configuration — notifications, email delivery, integrations, and audit history.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, marginTop: 24 }}>
        <nav aria-label="Settings sections" style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: active ? "rgba(0,91,97,0.08)" : "transparent",
                  color: active ? "#005B61" : "var(--text)",
                  fontWeight: active ? 600 : 400,
                  cursor: "pointer",
                  borderLeft: active ? "3px solid #005B61" : "3px solid transparent"
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <div>
          {tab === "notifications" && <NotificationsTab />}
          {tab === "email" && <EmailTab />}
          {tab === "users" && <AdminUsersTab />}
          {tab === "ai" && (
            <IntegrationTab
              href="/admin/platform"
              label="AI provider configuration"
              body="Manage Anthropic, Gemini, Groq, and OpenAI API keys and the preferred provider for scope drafting. Personal AI keys live on each user's /account page."
            />
          )}
          {tab === "platform" && (
            <IntegrationTab
              href="/admin/platform"
              label="Platform integrations — SharePoint"
              body="SharePoint tenant, site, and library bindings plus the root folder tree used by Project Operations. SHAREPOINT_MODE is set by environment."
            />
          )}
          {tab === "permissions" && (
            <StubCard title="Role & permission management" body="Coming soon." />
          )}
          {tab === "audit" && <StubCard title="System audit log" body="Coming soon. All admin actions are recorded." />}
        </div>
      </div>
    </div>
  );
}

function IntegrationTab({ href, label, body }: { href: string; label: string; body: string }) {
  return (
    <section className="s7-card">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>{label}</h2>
      <p style={{ color: "var(--text-muted)" }}>{body}</p>
      <Link to={href} className="s7-btn s7-btn--primary">Open settings</Link>
    </section>
  );
}

function StubCard({ title, body }: { title: string; body: string }) {
  return (
    <section className="s7-card">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>{title}</h2>
      <p style={{ color: "var(--text-muted)" }}>{body}</p>
    </section>
  );
}

// ── Notifications tab ────────────────────────────────────────────────────
function NotificationsTab() {
  const { authFetch } = useAuth();
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, uRes] = await Promise.all([
        authFetch("/admin/settings/notifications"),
        authFetch("/admin/settings/users")
      ]);
      if (!tRes.ok) throw new Error(await tRes.text());
      if (!uRes.ok) throw new Error(await uRes.text());
      setTriggers((await tRes.json()) as Trigger[]);
      setUsers((await uRes.json()) as AdminUser[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchTrigger = async (trigger: string, patch: Partial<Trigger>) => {
    try {
      const response = await authFetch(`/admin/settings/notifications/${trigger}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      if (!response.ok) throw new Error(await response.text());
      const updated = (await response.json()) as Trigger;
      setTriggers((prev) => prev.map((t) => (t.trigger === trigger ? updated : t)));
      setSavedFlash(trigger);
      setTimeout(() => setSavedFlash((s) => (s === trigger ? null : s)), 1500);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  const enabled = triggers.filter((t) => t.isEnabled);
  const disabled = triggers.filter((t) => !t.isEnabled);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      <section className="s7-card">
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Enabled triggers</h2>
        {enabled.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No triggers enabled.</p>
        ) : (
          enabled.map((t) => (
            <TriggerRow
              key={t.id}
              trigger={t}
              users={users}
              onPatch={(patch) => void patchTrigger(t.trigger, patch)}
              savedFlash={savedFlash === t.trigger}
            />
          ))
        )}
      </section>
      <section className="s7-card" style={{ opacity: 0.75 }}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Disabled triggers</h2>
        {disabled.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>All triggers are enabled.</p>
        ) : (
          disabled.map((t) => (
            <TriggerRow
              key={t.id}
              trigger={t}
              users={users}
              onPatch={(patch) => void patchTrigger(t.trigger, patch)}
              savedFlash={savedFlash === t.trigger}
            />
          ))
        )}
      </section>
    </div>
  );
}

function TriggerRow({
  trigger,
  users,
  onPatch,
  savedFlash
}: {
  trigger: Trigger;
  users: AdminUser[];
  onPatch: (patch: Partial<Trigger>) => void;
  savedFlash: boolean;
}) {
  const usersByRole = useMemo(() => {
    const map = new Map<string, AdminUser[]>();
    for (const u of users) {
      const roleName = u.role?.name ?? "Member";
      if (!map.has(roleName)) map.set(roleName, []);
      map.get(roleName)!.push(u);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [users]);

  const toggleUser = (id: string) => {
    const next = trigger.recipientUserIds.includes(id)
      ? trigger.recipientUserIds.filter((u) => u !== id)
      : [...trigger.recipientUserIds, id];
    onPatch({ recipientUserIds: next });
  };

  const toggleRole = (roleName: string, allIds: string[], someSelected: boolean) => {
    const current = new Set(trigger.recipientUserIds);
    if (someSelected) {
      allIds.forEach((id) => current.delete(id));
    } else {
      allIds.forEach((id) => current.add(id));
    }
    onPatch({ recipientUserIds: Array.from(current) });
  };

  return (
    <div
      style={{
        padding: 12,
        borderTop: "1px solid var(--border, #e5e7eb)",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <ToggleSwitch checked={trigger.isEnabled} onChange={(v) => onPatch({ isEnabled: v })} />
        <div style={{ flex: 1 }}>
          <strong>{trigger.label}</strong>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{trigger.description}</div>
        </div>
        {savedFlash ? (
          <span style={{ fontSize: 11, color: "#16A34A" }}>✓ Saved</span>
        ) : null}
      </div>

      {trigger.isEnabled ? (
        <div style={{ paddingLeft: 52, display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Delivery method
            </span>
            <div style={{ display: "inline-flex", marginLeft: 10, border: "1px solid var(--border, #e5e7eb)", borderRadius: 6, overflow: "hidden" }}>
              {(["both", "email", "inapp"] as const).map((m) => {
                const active = trigger.deliveryMethod === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => onPatch({ deliveryMethod: m })}
                    style={{
                      padding: "4px 10px",
                      background: active ? "#FEAA6D" : "transparent",
                      color: active ? "#000" : "var(--text)",
                      border: "none",
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    {m === "both" ? "Both" : m === "email" ? "Email only" : "In-app only"}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>
              Recipients
            </span>
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {usersByRole.map(([roleName, roleUsers]) => {
                const allIds = roleUsers.map((u) => u.id);
                const selectedCount = allIds.filter((id) => trigger.recipientUserIds.includes(id)).length;
                const someSelected = selectedCount > 0;
                const allSelected = selectedCount === allIds.length;
                return (
                  <details key={roleName} style={{ borderLeft: "2px solid var(--border, #e5e7eb)", paddingLeft: 8 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13 }}>
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleRole(roleName, allIds, someSelected)}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                        />
                        <strong>{roleName}</strong> ({roleUsers.length})
                      </label>
                    </summary>
                    <div style={{ marginTop: 4, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 2 }}>
                      {roleUsers.map((u) => (
                        <label key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={trigger.recipientUserIds.includes(u.id)}
                            onChange={() => toggleUser(u.id)}
                          />
                          {u.firstName} {u.lastName} <span style={{ color: "var(--text-muted)" }}>· {u.email}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 999,
        border: "none",
        background: checked ? "#FEAA6D" : "var(--border, #cbd5e1)",
        position: "relative",
        cursor: "pointer",
        padding: 0,
        transition: "background 120ms"
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "#fff",
          transition: "left 120ms",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
        }}
      />
    </button>
  );
}

// ── Email tab ────────────────────────────────────────────────────────────
function EmailTab() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<{ success: boolean; message: string } | null>(null);
  const [senderAddress, setSenderAddress] = useState("");
  const [senderName, setSenderName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/admin/settings/email");
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as EmailConfig;
      setConfig(body);
      if (!loadedRef.current) {
        setSenderAddress(body.senderAddress);
        setSenderName(body.senderName);
        loadedRef.current = true;
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

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch("/admin/settings/email", {
        method: "PATCH",
        body: JSON.stringify({ senderAddress: senderAddress.trim(), senderName: senderName.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      setConfig((await response.json()) as EmailConfig);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const testConn = async () => {
    setTesting(true);
    setTest(null);
    try {
      const response = await authFetch("/admin/settings/email/test");
      if (!response.ok) throw new Error(await response.text());
      setTest((await response.json()) as { success: boolean; message: string });
    } catch (err) {
      setTest({ success: false, message: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  if (loading || !config) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  const showMailSendBanner = test && !test.success && /Mail\.Send/i.test(test.message);

  return (
    <section className="s7-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 0 }}>Email provider</h2>
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      <div>
        <span style={{ fontSize: 11, textTransform: "uppercase", color: "var(--text-muted)" }}>Provider</span>
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button
            type="button"
            className={config.provider === "outlook" ? "s7-btn s7-btn--primary" : "s7-btn s7-btn--ghost"}
            disabled
            title="Microsoft 365 / Outlook"
          >
            Microsoft 365 (Outlook)
          </button>
          <button type="button" className="s7-btn s7-btn--ghost" disabled title="Coming soon">
            Gmail <span style={{ marginLeft: 6, fontSize: 10, background: "var(--surface-muted, #F6F6F6)", padding: "1px 6px", borderRadius: 999 }}>Coming soon</span>
          </button>
        </div>
      </div>

      <label className="estimate-editor__field">
        <span>Sender address</span>
        <input
          className="s7-input"
          value={senderAddress}
          onChange={(e) => setSenderAddress(e.target.value)}
          placeholder="marco@initialservices.net"
        />
      </label>
      <label className="estimate-editor__field">
        <span>Sender name</span>
        <input
          className="s7-input"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Initial Services"
        />
      </label>

      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="s7-btn s7-btn--primary" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void testConn()} disabled={testing}>
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>

      {test ? (
        <div
          role="status"
          style={{
            padding: 10,
            borderRadius: 6,
            background: test.success ? "rgba(0,91,97,0.08)" : "rgba(239,68,68,0.08)",
            color: test.success ? "var(--brand-primary, #005B61)" : "var(--status-danger, #EF4444)",
            fontSize: 13
          }}
        >
          {test.success ? "✓ " : "✗ "}
          {test.message}
        </div>
      ) : null}

      {showMailSendBanner ? (
        <div
          style={{
            padding: 10,
            borderRadius: 6,
            border: "1px solid #FEAA6D",
            background: "rgba(254,170,109,0.1)",
            fontSize: 13
          }}
        >
          The <strong>Mail.Send</strong> permission is required. Ask your M365 administrator to grant this application permission to the Azure app registration.
        </div>
      ) : null}

      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Last updated: {new Date(config.updatedAt).toLocaleString("en-AU")}
      </div>
    </section>
  );
}
