import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useConfirm } from "../hooks/useConfirm";
import { AdminAccessRequestsTab } from "./admin/AdminAccessRequestsTab";
import { isAdminUser } from "../auth/permissions";
import { NoAccess } from "../components/NoAccess";
import { AdminClientVersionsTab } from "./admin/AdminClientVersionsTab";
import { MapLocationsTab } from "./admin/MapLocationsTab";

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
  { id: "access-requests", label: "Access requests" },
  { id: "ai", label: "AI & Integrations" },
  { id: "integrations", label: "Integrations / API keys" },
  { id: "geofences", label: "Site geofences" },
  { id: "client-versions", label: "Client versions" },
  { id: "map-locations", label: "Map locations" }
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AdminSettingsPage() {
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [tab, setTab] = useState<TabId>("notifications");

  if (!user) return null;
  if (!isAdmin) return <NoAccess required="role:Admin" title="Admin settings requires the Admin role" />;

  return (
    <div className="admin-settings">
      <header className="admin-settings__header">
        <h2 className="s7-type-page-heading" style={{ margin: 0 }}>Admin settings</h2>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0" }}>
          System configuration — notifications, email delivery, integrations, and audit history.
        </p>
      </header>

      <div className="admin-settings__layout">
        <nav className="admin-settings__tabs" aria-label="Admin settings sections">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                tab === t.id
                  ? "admin-settings__tab admin-settings__tab--active"
                  : "admin-settings__tab"
              }
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <div className="admin-settings__panel">
          {tab === "notifications" && <NotificationsTab />}
          {tab === "email" && <EmailTab />}
          {tab === "operations" && <OperationsTab />}
          {tab === "access-requests" && <AdminAccessRequestsTab />}
          {tab === "ai" && (
            <IntegrationTab
              href="/settings/ai"
              label="AI provider configuration"
              body="Manage Anthropic, Gemini, Groq, and OpenAI API keys and the preferred provider for scope drafting."
            />
          )}
          {tab === "integrations" && <IntegrationsKeysTab />}
          {tab === "geofences" && <SiteGeofencesTab />}
          {tab === "client-versions" && <AdminClientVersionsTab />}
          {tab === "map-locations" && <MapLocationsTab />}
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
  const confirm = useConfirm();
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
    const ok = await confirm({
      title: `Remove ${item.label} key`,
      message: `Remove the ${item.label} key? Any feature that uses it will fall back to the Azure env var (if set) or stop working.`,
      confirmLabel: "Remove",
      variant: "danger"
    });
    if (!ok) return;
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

// ── ERP gap C — Site geofences admin tab ──────────────────────────────
// Draw/set a circular geofence per site. Field workers' clock-on GPS is
// checked against active geofences to auto-select the correct job and
// flag out-of-geofence timesheets.
type GeofenceRow = {
  id: string;
  siteId: string;
  siteName: string;
  siteCode: string | null;
  name: string;
  centreLat: string;
  centreLng: string;
  radiusMetres: number;
  isActive: boolean;
  notes: string | null;
};

type SiteOption = { id: string; name: string; code: string | null };

function SiteGeofencesTab() {
  const { authFetch } = useAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<GeofenceRow[] | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<{
    siteId: string;
    name: string;
    centreLat: string;
    centreLng: string;
    radiusMetres: string;
    isActive: boolean;
    notes: string;
  }>({ siteId: "", name: "", centreLat: "", centreLng: "", radiusMetres: "150", isActive: true, notes: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [gRes, sRes] = await Promise.all([
        authFetch("/field/geofences"),
        authFetch("/master-data/sites?page=1&pageSize=100")
      ]);
      if (!gRes.ok) throw new Error(await gRes.text());
      if (!sRes.ok) throw new Error(await sRes.text());
      setRows((await gRes.json()) as GeofenceRow[]);
      const sitesBody = (await sRes.json()) as { items: SiteOption[] };
      setSites(sitesBody.items);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  async function pickMyLocation() {
    if (!navigator.geolocation) {
      setError("Geolocation not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDraft((d) => ({
          ...d,
          centreLat: pos.coords.latitude.toFixed(6),
          centreLng: pos.coords.longitude.toFixed(6)
        }));
      },
      (err) => setError(`Could not get location: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 0 }
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaveMsg(null);
    const lat = Number(draft.centreLat);
    const lng = Number(draft.centreLng);
    const radius = Number(draft.radiusMetres);
    if (!draft.siteId || !draft.name.trim()) {
      setError("Site and name are required.");
      return;
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setError("Centre lat/lng must be valid numbers.");
      return;
    }
    if (!Number.isFinite(radius) || radius < 10 || radius > 5000) {
      setError("Radius must be between 10 and 5000 metres.");
      return;
    }
    try {
      const res = await authFetch("/field/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteId: draft.siteId,
          name: draft.name.trim(),
          centreLat: lat,
          centreLng: lng,
          radiusMetres: radius,
          isActive: draft.isActive,
          notes: draft.notes.trim() || undefined
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveMsg(`Geofence "${draft.name.trim()}" saved.`);
      setDraft({ siteId: "", name: "", centreLat: "", centreLng: "", radiusMetres: "150", isActive: true, notes: "" });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function toggleActive(row: GeofenceRow) {
    try {
      const res = await authFetch(`/field/geofences/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !row.isActive })
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function remove(row: GeofenceRow) {
    const ok = await confirm({
      title: "Delete geofence",
      message: `Delete geofence "${row.name}"? Timesheet audit references will be cleared to null.`,
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    try {
      const res = await authFetch(`/field/geofences/${row.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="s7-card">
      <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Site geofences</h2>
      <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
        Attach a circular boundary to a site so worker clock-ins auto-select the correct job and get flagged if they fall outside the fence. GPS capture is unaffected — this only adds the boundary check.
      </p>

      <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
        <label style={{ gridColumn: "span 2" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Site</div>
          <select
            value={draft.siteId}
            onChange={(e) => setDraft({ ...draft, siteId: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          >
            <option value="">Select a site…</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}{s.code ? ` (${s.code})` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Name</div>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            style={{ width: "100%", padding: 8 }}
            placeholder="e.g. Main gate"
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Radius (metres)</div>
          <input
            type="number"
            min={10}
            max={5000}
            step={10}
            value={draft.radiusMetres}
            onChange={(e) => setDraft({ ...draft, radiusMetres: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Centre latitude</div>
          <input
            type="number"
            step="any"
            value={draft.centreLat}
            onChange={(e) => setDraft({ ...draft, centreLat: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Centre longitude</div>
          <input
            type="number"
            step="any"
            value={draft.centreLng}
            onChange={(e) => setDraft({ ...draft, centreLng: e.target.value })}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <label style={{ gridColumn: "span 2" }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Notes (optional)</div>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            rows={2}
            style={{ width: "100%", padding: 8 }}
          />
        </label>
        <div style={{ gridColumn: "span 2", display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void pickMyLocation()}>
            Use my current location
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
            <input
              type="checkbox"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Active
          </label>
          <button type="submit" className="s7-btn s7-btn--primary" style={{ marginLeft: "auto" }}>
            Add geofence
          </button>
        </div>
      </form>

      {saveMsg ? <p style={{ color: "var(--status-success, #16a34a)", marginTop: 12 }}>{saveMsg}</p> : null}
      {error ? <p style={{ color: "var(--status-danger)", marginTop: 10 }}>{error}</p> : null}

      <div style={{ marginTop: 24 }}>
        {rows === null ? (
          <p style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>No site geofences configured yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #e5e5e5)" }}>
                <th style={{ padding: "8px 6px" }}>Site</th>
                <th style={{ padding: "8px 6px" }}>Geofence</th>
                <th style={{ padding: "8px 6px" }}>Centre</th>
                <th style={{ padding: "8px 6px" }}>Radius</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
                <th style={{ padding: "8px 6px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                  <td style={{ padding: "8px 6px" }}>{r.siteName}{r.siteCode ? ` (${r.siteCode})` : ""}</td>
                  <td style={{ padding: "8px 6px" }}>{r.name}</td>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", fontSize: 12 }}>
                    {r.centreLat}, {r.centreLng}
                  </td>
                  <td style={{ padding: "8px 6px" }}>{r.radiusMetres} m</td>
                  <td style={{ padding: "8px 6px" }}>{r.isActive ? "Active" : "Inactive"}</td>
                  <td style={{ padding: "8px 6px", textAlign: "right" }}>
                    <button type="button" className="s7-btn s7-btn--ghost" onClick={() => void toggleActive(r)}>
                      {r.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      style={{ marginLeft: 6, color: "var(--status-danger)" }}
                      onClick={() => void remove(r)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
