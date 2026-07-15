import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { AdminAccessRequestsTab } from "./admin/AdminAccessRequestsTab";
import { isAdminUser } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";
import { AdminUsersTab } from "./admin/AdminUsersTab";
import { AdminRolesPermissionsTab } from "./admin/AdminRolesPermissionsTab";
import { AdminClientVersionsTab } from "./admin/AdminClientVersionsTab";

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
  { id: "operations", label: "Operations" },
  { id: "users", label: "Users" },
  { id: "access-requests", label: "Access requests" },
  { id: "ai", label: "AI & Integrations" },
  { id: "integrations", label: "Integrations / API keys" },
  { id: "platform", label: "Platform" },
  { id: "permissions", label: "Permissions" },
  { id: "client-versions", label: "Client versions" },
  { id: "audit", label: "Audit log" }
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AdminSettingsPage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [tab, setTab] = useState<TabId>("notifications");

  if (!user) return null;
  if (!isAdmin) return <NoAccess required="role:Admin" title="Admin settings requires the Admin role" />;

  return (
    <div style={{ padding: 24, maxWidth: 1200 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>Admin settings</h1>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        System configuration â€” notifications, email delivery, integrations, and audit history.
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
          {tab === "operations" && <OperationsTab />}
          {tab === "users" && <AdminUsersTab />}
          {tab === "access-requests" && <AdminAccessRequestsTab />}
          {tab === "ai" && (
            <IntegrationTab
              href="/admin/platform"
              label="AI provider configuration"
              body="Manage Anthropic, Gemini, Groq, and OpenAI API keys and the preferred provider for scope drafting. Personal AI keys live on each user's /account page."
            />
          )}
          {tab === "integrations" && <IntegrationsKeysTab />}
          {tab === "platform" && (
            <>
              <IntegrationTab
                href="/admin/platform"
                label="Platform integrations â€” SharePoint"
                body="SharePoint tenant, site, and library bindings plus the root folder tree used by Project Operations. SHAREPOINT_MODE is set by environment."
              />
              <SharePointTestPanel />
              <SharePointFolderMappingsPanel />
              <XeroPanel />
            </>
          )}
          {tab === "permissions" && <AdminRolesPermissionsTab />}
          {tab === "client-versions" && <AdminClientVersionsTab />}
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

// â”€â”€ Notifications tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  if (loading) return <p style={{ color: "var(--text-muted)" }}>Loadingâ€¦</p>;

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
          <span style={{ fontSize: 11, color: "#16A34A" }}>âœ“ Saved</span>
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
                          {u.firstName} {u.lastName} <span style={{ color: "var(--text-muted)" }}>Â· {u.email}</span>
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

// â”€â”€ Email tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  if (loading || !config) return <p style={{ color: "var(--text-muted)" }}>Loadingâ€¦</p>;

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
          {saving ? "Savingâ€¦" : "Save"}
        </button>
        <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void testConn()} disabled={testing}>
          {testing ? "Testingâ€¦" : "Test connection"}
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
          {test.success ? "âœ“ " : "âœ— "}
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

// ── Operations tab (fuel price + travel rate) ───────────────────────
// Backs OperationsSettings singleton. Waste-transport cost engine R3 T-0
// (2026-07-15): first slice — Marco enters the fuel price manually here;
// T-2 will refresh it from a feed. travelRatePerKm is an interim flat
// rate used by the SoW line until T-1 wires fuel × consumption × distance.
type OperationsSettings = {
  id: string;
  fuelPricePerLitre: string | number | null;
  fuelPriceSource: string | null;
  fuelPriceFetchedAt: string | null;
  travelRatePerKm: string | number | null;
  updatedAt: string;
  updatedById: string | null;
};

function OperationsTab() {
  const { authFetch } = useAuth();
  const [config, setConfig] = useState<OperationsSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [fuelPrice, setFuelPrice] = useState("");
  const [fuelSource, setFuelSource] = useState("");
  const [travelRate, setTravelRate] = useState("");
  const loadedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/admin/settings/operations");
      if (!response.ok) throw new Error(await response.text());
      const body = (await response.json()) as OperationsSettings;
      setConfig(body);
      if (!loadedRef.current) {
        setFuelPrice(body.fuelPricePerLitre != null ? String(body.fuelPricePerLitre) : "");
        setFuelSource(body.fuelPriceSource ?? "");
        setTravelRate(body.travelRatePerKm != null ? String(body.travelRatePerKm) : "");
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
      // Blank → null (clear the value). Non-blank → number for the two
      // decimals. Empty string stays undefined so the server leaves it alone.
      const patch: Record<string, unknown> = {};
      patch.fuelPricePerLitre = fuelPrice.trim() === "" ? null : Number(fuelPrice);
      patch.fuelPriceSource = fuelSource.trim() === "" ? null : fuelSource.trim();
      patch.travelRatePerKm = travelRate.trim() === "" ? null : Number(travelRate);
      const response = await authFetch("/admin/settings/operations", {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      if (!response.ok) throw new Error(await response.text());
      setConfig((await response.json()) as OperationsSettings);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !config) return <p style={{ color: "var(--text-muted)" }}>Loading…</p>;

  return (
    <section className="s7-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
          Operations / Fuel
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0, fontSize: 13 }}>
          Fuel price and interim travel rate used by the waste-transport cost engine (R3). Per-truck
          fuel consumption lives on each Asset; per-material load capacity lives in the Transport
          capacity reference table under Rates &amp; Lists.
        </p>
      </div>
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      <label className="estimate-editor__field">
        <span>Fuel price (per litre, AUD)</span>
        <input
          className="s7-input"
          type="number"
          step="0.001"
          min="0"
          value={fuelPrice}
          onChange={(e) => setFuelPrice(e.target.value)}
          placeholder="e.g. 2.150"
        />
      </label>
      <label className="estimate-editor__field">
        <span>Fuel price source</span>
        <input
          className="s7-input"
          value={fuelSource}
          onChange={(e) => setFuelSource(e.target.value)}
          placeholder="Manual entry / feed name (T-2 will populate this automatically)"
        />
      </label>
      <label className="estimate-editor__field">
        <span>Travel rate (per km, AUD) — interim</span>
        <input
          className="s7-input"
          type="number"
          step="0.01"
          min="0"
          value={travelRate}
          onChange={(e) => setTravelRate(e.target.value)}
          placeholder="Interim flat rate — replaced by fuel × consumption × distance in T-1"
        />
      </label>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => void save()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {savedFlash ? <span style={{ fontSize: 12, color: "#16A34A" }}>✓ Saved</span> : null}
      </div>

      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Last updated: {new Date(config.updatedAt).toLocaleString("en-AU")}
        {config.fuelPriceFetchedAt
          ? ` · fuel price fetched ${new Date(config.fuelPriceFetchedAt).toLocaleString("en-AU")}`
          : ""}
      </div>
    </section>
  );
}

function SharePointTestPanel() {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ connected: boolean; mode: string; message?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const response = await authFetch("/sharepoint/test");
      if (!response.ok) throw new Error(await response.text());
      setResult(await response.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="s7-card" style={{ marginTop: 12 }}>
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>SharePoint connection</h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 10px" }}>
        Probes the configured adapter. Mock mode always returns OK. Live mode performs a benign
        ensureFolder call against the configured root.
      </p>
      <button type="button" className="s7-btn s7-btn--secondary" onClick={() => void run()} disabled={busy}>
        {busy ? "Testingâ€¦" : "Test connection"}
      </button>
      {error ? (
        <p style={{ color: "var(--status-danger)", marginTop: 10 }}>{error}</p>
      ) : null}
      {result ? (
        <div
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 6,
            background: result.connected ? "rgba(22, 163, 74, 0.10)" : "rgba(245, 158, 11, 0.10)",
            borderLeft: `4px solid ${result.connected ? "#16a34a" : "#f59e0b"}`,
            fontSize: 13
          }}
        >
          <strong>{result.connected ? "Connected" : "Unavailable"}</strong> â€” mode: <code>{result.mode}</code>
          {result.message ? <div style={{ marginTop: 4 }}>{result.message}</div> : null}
        </div>
      ) : null}
    </section>
  );
}

// SharePoint folder mappings — DB-backed, super-user-only. Same idea as
// the Rates admin: which folder each entity's documents live in is a
// business decision, not a deployment setting. Server enforces
// super-user; this hides the panel from everyone else so it doesn't
// look editable when it isn't.
type FolderMapping = {
  id: string;
  entityType: "TENDER" | "JOB";
  folderPath: string;
  isActive: boolean;
  updatedAt: string;
};

const ENTITY_LABELS: Record<FolderMapping["entityType"], string> = {
  TENDER: "Tender",
  JOB: "Job"
};

function SharePointFolderMappingsPanel() {
  const { authFetch, user } = useAuth();
  const isSuperUser = user?.isSuperUser === true;
  const [mappings, setMappings] = useState<FolderMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entityType: FolderMapping["entityType"]; path: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSuperUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/admin/sharepoint-folder-mappings");
      if (!response.ok) throw new Error(await response.text());
      setMappings((await response.json()) as FolderMapping[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, isSuperUser]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isSuperUser) return null;

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await authFetch(
        `/admin/sharepoint-folder-mappings/${editing.entityType}`,
        {
          method: "PATCH",
          body: JSON.stringify({ folderPath: editing.path })
        }
      );
      if (!response.ok) {
        // Server rejects an invalid path with a specific message naming
        // the folder that wasn't found — surface it verbatim so the
        // admin can see what's wrong instead of a generic error.
        const message = await response.text();
        throw new Error(message);
      }
      setFlash(`Updated ${ENTITY_LABELS[editing.entityType]} folder path.`);
      setEditing(null);
      await load();
    } catch (err) {
      setSaveError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="s7-card" style={{ marginTop: 12 }}>
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>SharePoint folder mappings</h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 10px" }}>
        Which folder each entity's documents live in. Edit the path and Save — the change is
        validated against SharePoint and takes effect immediately. No redeploy.
      </p>
      {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : null}
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {flash ? <p style={{ color: "#16a34a", margin: "0 0 10px" }}>{flash}</p> : null}
      {!loading && mappings.length > 0 ? (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--divider)" }}>Entity</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--divider)" }}>Folder path</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid var(--divider)", width: 100 }}>Status</th>
              <th style={{ padding: "6px 8px", borderBottom: "1px solid var(--divider)", width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => {
              const isEditing = editing?.entityType === m.entityType;
              return (
                <tr key={m.id}>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)" }}>{ENTITY_LABELS[m.entityType]}</td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)" }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={editing!.path}
                        onChange={(e) => setEditing({ entityType: m.entityType, path: e.target.value })}
                        style={{ width: "100%", padding: 4, fontFamily: "monospace", fontSize: 12 }}
                        disabled={saving}
                      />
                    ) : (
                      <code style={{ fontSize: 12 }}>{m.folderPath}</code>
                    )}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)" }}>
                    {m.isActive ? (
                      <span style={{ color: "#16a34a" }}>Active</span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>Inactive</span>
                    )}
                  </td>
                  <td style={{ padding: "8px", borderBottom: "1px solid var(--divider)", textAlign: "right" }}>
                    {isEditing ? (
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="s7-btn s7-btn--primary"
                          onClick={() => void save()}
                          disabled={saving}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          {saving ? "Saving…" : "Save"}
                        </button>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost"
                          onClick={() => {
                            setEditing(null);
                            setSaveError(null);
                          }}
                          disabled={saving}
                          style={{ padding: "4px 10px", fontSize: 12 }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost"
                        onClick={() => {
                          setEditing({ entityType: m.entityType, path: m.folderPath });
                          setFlash(null);
                          setSaveError(null);
                        }}
                        style={{ padding: "4px 10px", fontSize: 12 }}
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : null}
      {saveError ? (
        <p style={{ color: "var(--status-danger)", marginTop: 10, fontSize: 12 }}>{saveError}</p>
      ) : null}
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        Paths are relative to the SharePoint library. A path that doesn't exist in the library will
        be rejected — create the folder in SharePoint first.
      </p>
    </section>
  );
}

// ── Integrations / API keys tab ─────────────────────────────────────────
// Third-party integration keys (Geoapify, fuelpricesqld, future). Same
// UX as ProviderKeyManager for AI keys: the browser only ever sees
// configured/not-configured; the plaintext value is set-once-write-only.
type IntegrationStatus = {
  slug: string;
  label: string;
  description: string | null;
  envVar: string;
  configured: boolean;
  source: "database" | "env" | null;
  updatedAt: string | null;
};

function IntegrationsKeysTab() {
  const { authFetch } = useAuth();
  const [items, setItems] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<IntegrationStatus | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/admin/settings/integrations");
      if (!response.ok) throw new Error(await response.text());
      setItems((await response.json()) as IntegrationStatus[]);
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
    if (!editing) return;
    if (!editValue.trim()) {
      setError("Enter a key first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await authFetch(`/admin/settings/integrations/${editing.slug}`, {
        method: "PUT",
        body: JSON.stringify({ value: editValue.trim() })
      });
      if (!response.ok) throw new Error(await response.text());
      setFlash(`${editing.label} key saved.`);
      setEditing(null);
      setEditValue("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const clear = async (item: IntegrationStatus) => {
    if (
      !window.confirm(
        `Remove the ${item.label} key? Any feature that uses it will fall back to the Azure env var (if set) or stop working.`
      )
    ) {
      return;
    }
    try {
      const response = await authFetch(`/admin/settings/integrations/${item.slug}`, {
        method: "DELETE"
      });
      if (!response.ok) throw new Error(await response.text());
      setFlash(`${item.label} key removed.`);
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <section className="s7-card">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Integrations / API keys</h2>
      <p style={{ color: "var(--text-muted)", margin: "0 0 12px" }}>
        Third-party API keys stored inside the ERP (encrypted at rest with AES-256-GCM). Editing
        here takes effect immediately — no Azure redeploy. When the encrypted value is empty, the
        matching environment variable is used as a fallback so keys already set in Azure keep
        working until re-entered here.
      </p>
      {loading ? <p style={{ color: "var(--text-muted)" }}>Loading…</p> : null}
      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}
      {flash ? <p style={{ color: "#16a34a", margin: "0 0 10px" }}>{flash}</p> : null}
      {!loading && items.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.slug}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                background: "var(--surface-card, #FFFFFF)",
                border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                borderRadius: 8
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                {item.description ? (
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                    {item.description}
                  </div>
                ) : null}
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  {item.configured
                    ? item.source === "database"
                      ? `Configured · stored in ERP${item.updatedAt ? ` · updated ${new Date(item.updatedAt).toLocaleString("en-AU")}` : ""}`
                      : `Configured · using ${item.envVar} env var (not yet stored in ERP)`
                    : `Not configured · env var ${item.envVar} is also empty`}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => {
                    setEditing(item);
                    setEditValue("");
                    setFlash(null);
                    setError(null);
                  }}
                >
                  {item.source === "database" ? "Replace" : "Configure"}
                </button>
                {item.source === "database" ? (
                  <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void clear(item)}>
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {editing ? (
        <div style={{ marginTop: 16, padding: 14, border: "1px solid var(--border, #e5e7eb)", borderRadius: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>{editing.label} API key</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            The key is encrypted at rest with AES-256-GCM and never displayed back.
          </div>
          <input
            type="password"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            placeholder="Paste key"
            autoFocus
            disabled={saving}
            style={{
              width: "100%",
              padding: 10,
              fontSize: 14,
              fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
              border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
              borderRadius: 6,
              boxSizing: "border-box"
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => void save()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => {
                setEditing(null);
                setEditValue("");
                setError(null);
              }}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function XeroPanel() {
  const { authFetch } = useAuth();
  const [status, setStatus] = useState<{
    connected: boolean;
    tenantName?: string | null;
    expiresAt?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await authFetch("/xero/status");
      if (r.ok) setStatus(await r.json());
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch("/xero/connect");
      if (!r.ok) throw new Error(await r.text());
      const body = (await r.json()) as { url: string };
      window.open(body.url, "_blank", "noopener");
      setInfo("Consent window opened â€” finish the flow in the new tab.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Disconnect Xero? You'll need to re-consent next time.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await authFetch("/xero/disconnect", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      setInfo("Disconnected.");
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const syncAll = async () => {
    if (!window.confirm("Push all active clients to Xero now?")) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const r = await authFetch("/xero/contacts/sync-all", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const body = (await r.json()) as {
        total: number;
        results: Array<{ clientId: string; status: string }>;
      };
      const ok = body.results.filter((x) => x.status === "success").length;
      setInfo(`Synced ${ok}/${body.total} clients.`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="s7-card" style={{ marginTop: 16, padding: 16 }}>
      <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>
        Xero integration
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 12px" }}>
        Push clients into Xero as contacts, and create draft invoices from approved progress claims.
        Set <code>XERO_CLIENT_ID</code>, <code>XERO_CLIENT_SECRET</code>, <code>XERO_REDIRECT_URI</code> in
        the API environment first.
      </p>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {status?.connected ? (
          <>
            <span
              style={{
                fontSize: 12,
                padding: "4px 10px",
                borderRadius: 999,
                background: "rgba(22, 163, 74, 0.15)",
                color: "#16a34a"
              }}
            >
              Connected{status.tenantName ? ` â€” ${status.tenantName}` : ""}
            </span>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => void syncAll()}
              disabled={busy}
            >
              Sync all clients
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => void disconnect()}
              disabled={busy}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => void connect()}
            disabled={busy}
          >
            {busy ? "Workingâ€¦" : "Connect Xero"}
          </button>
        )}
      </div>

      {info ? <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 10 }}>{info}</p> : null}
      {error ? <p style={{ color: "var(--status-danger)", marginTop: 10 }}>{error}</p> : null}
    </section>
  );
}
