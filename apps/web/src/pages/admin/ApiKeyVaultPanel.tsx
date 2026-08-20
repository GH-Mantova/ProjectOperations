import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { throwIfApiError } from "../../lib/api-errors";
import { useConfirm } from "../../hooks/useConfirm";

// SLICE-4b — Unified API Keys vault UI.
// Consumes SLICE-4a /api-keys/** endpoints exclusively (PR #917).
// Compliance §6.2: the key value is NEVER rendered. UI only shows
// hasKey / validatedAt / updatedById / updatedAt.
//
// ADAPTER_COST_TIERS mirrors the server-side constant in geocoding-adapter.ts.
const ADAPTER_COST_TIERS: Record<string, "free" | "paid-metered"> = {
  geoapify: "paid-metered",
  google: "paid-metered",
  geocodify: "paid-metered",
  maptiler: "paid-metered",
  nominatim: "free",
  "custom-rest": "paid-metered"
};

// ── Types (mirror CredentialSummary / TypeSummary from api-keys.service.ts) ──

type CredentialScope = "company" | "user";

type CredentialSummary = {
  id: string;
  name: string;
  typeId: string;
  typeName: string;
  systemKind: string | null;
  adapter: string | null;
  scope: CredentialScope;
  userId: string | null;
  hasKey: boolean;
  validatedAt: string | null;
  enabled: boolean;
  order: number | null;
  config: unknown;
  updatedAt: string;
  createdAt: string;
  updatedById: string | null;
};

type TypeSummary = {
  id: string;
  name: string;
  description: string | null;
  systemKind: string | null;
  credentialCount: number;
};

type TestResult = {
  ok: boolean;
  validatedAt?: string;
  reason?: string;
};

// ── Main panel ────────────────────────────────────────────────────────────────

export function ApiKeyVaultPanel() {
  const { authFetch, user } = useAuth();
  const confirm = useConfirm();
  const [scope, setScope] = useState<CredentialScope>("company");
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [types, setTypes] = useState<TypeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [editingCred, setEditingCred] = useState<CredentialSummary | null>(null);
  const [rotatingCred, setRotatingCred] = useState<CredentialSummary | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult | "testing">>({});

  const flashMsg = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash((f) => (f === msg ? null : f)), 3000);
  };

  const loadTypes = useCallback(async () => {
    try {
      const res = await authFetch("/api-keys/types");
      await throwIfApiError(res);
      setTypes((await res.json()) as TypeSummary[]);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [authFetch]);

  const loadCredentials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/api-keys/credentials?scope=${scope}`);
      await throwIfApiError(res);
      setCredentials((await res.json()) as CredentialSummary[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [credRes, typeRes] = await Promise.all([
        authFetch(`/api-keys/credentials?scope=${scope}`),
        authFetch("/api-keys/types")
      ]);
      await throwIfApiError(credRes);
      await throwIfApiError(typeRes);
      setCredentials((await credRes.json()) as CredentialSummary[]);
      setTypes((await typeRes.json()) as TypeSummary[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, scope]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const toggleEnabled = async (cred: CredentialSummary) => {
    try {
      const res = await authFetch(`/api-keys/credentials/${cred.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !cred.enabled })
      });
      await throwIfApiError(res);
      await loadCredentials();
      flashMsg(`${cred.name} ${!cred.enabled ? "enabled" : "disabled"}.`);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteCred = async (cred: CredentialSummary) => {
    const ok = await confirm({
      title: `Delete "${cred.name}"`,
      message: `Remove this API key entry? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    try {
      const res = await authFetch(`/api-keys/credentials/${cred.id}`, { method: "DELETE" });
      await throwIfApiError(res);
      flashMsg(`"${cred.name}" deleted.`);
      await loadCredentials();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const testCred = async (cred: CredentialSummary) => {
    setTestResults((prev) => ({ ...prev, [cred.id]: "testing" }));
    try {
      const res = await authFetch(`/api-keys/credentials/${cred.id}/test`, { method: "POST" });
      await throwIfApiError(res);
      const result = (await res.json()) as TestResult;
      setTestResults((prev) => ({ ...prev, [cred.id]: result }));
      if (result.ok) await loadCredentials();
    } catch (err) {
      setTestResults((prev) => ({ ...prev, [cred.id]: { ok: false, reason: (err as Error).message } }));
    }
  };

  const updateOrder = async (cred: CredentialSummary, newOrder: number) => {
    try {
      const res = await authFetch(`/api-keys/credentials/${cred.id}`, {
        method: "PATCH",
        body: JSON.stringify({ order: newOrder })
      });
      await throwIfApiError(res);
      await loadCredentials();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const isSuperUser = user?.isSuperUser === true;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? <p style={{ color: "var(--status-danger)", margin: 0 }}>{error}</p> : null}
      {flash ? <p style={{ color: "#16a34a", margin: 0 }}>{flash}</p> : null}

      {/* Header row: scope filter + actions */}
      <section className="s7-card" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 0 }}>
            API Keys vault
          </h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => setShowManageTypes(true)}
            >
              Manage types
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => setShowAddModal(true)}
            >
              + Add key
            </button>
          </div>
        </div>

        <p style={{ color: "var(--text-muted)", margin: "0 0 12px", fontSize: 13 }}>
          Third-party API keys stored encrypted at rest (AES-256-GCM). Key values are
          never displayed — only status, last validated, and last updated are shown.
        </p>

        {/* Scope filter */}
        <div style={{ display: "inline-flex", border: "1px solid var(--border, #e5e7eb)", borderRadius: 6, overflow: "hidden", marginBottom: 16 }}>
          {(["company", "user"] as CredentialScope[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              style={{
                padding: "5px 14px",
                background: scope === s ? "#FEAA6D" : "transparent",
                color: scope === s ? "#000" : "var(--text)",
                border: "none",
                fontSize: 13,
                cursor: "pointer",
                fontWeight: scope === s ? 600 : 400
              }}
            >
              {s === "company" ? "Company" : "Personal"}
            </button>
          ))}
        </div>

        {/* Credentials table */}
        {loading ? (
          <p style={{ color: "var(--text-muted)", paddingBottom: 16 }}>Loading…</p>
        ) : credentials.length === 0 ? (
          <p style={{ color: "var(--text-muted)", paddingBottom: 16 }}>
            No {scope === "company" ? "company" : "personal"} keys configured.
          </p>
        ) : (
          <div style={{ overflowX: "auto", paddingBottom: 4 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #e5e5e5)" }}>
                  <th style={{ padding: "8px 6px" }}>Name</th>
                  <th style={{ padding: "8px 6px" }}>Type</th>
                  <th style={{ padding: "8px 6px" }}>Status</th>
                  <th style={{ padding: "8px 6px" }}>Validated</th>
                  <th style={{ padding: "8px 6px" }}>Updated</th>
                  {scope === "company" ? <th style={{ padding: "8px 6px", width: 60 }}>Order</th> : null}
                  <th style={{ padding: "8px 6px" }} />
                </tr>
              </thead>
              <tbody>
                {credentials.map((cred) => {
                  const costTier =
                    cred.adapter && ADAPTER_COST_TIERS[cred.adapter]
                      ? ADAPTER_COST_TIERS[cred.adapter]
                      : null;
                  const testResult = testResults[cred.id];
                  const isGeocoding = cred.systemKind === "geocoding";
                  return (
                    <tr key={cred.id} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                      <td style={{ padding: "10px 6px" }}>
                        <div style={{ fontWeight: 600 }}>{cred.name}</div>
                        {!cred.hasKey ? (
                          <div style={{ fontSize: 11, color: "var(--status-danger, #EF4444)" }}>No key stored</div>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <div>{cred.typeName}</div>
                        {costTier && isGeocoding ? (
                          <span
                            style={{
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 999,
                              background: costTier === "free" ? "rgba(22,163,74,0.12)" : "rgba(254,170,109,0.25)",
                              color: costTier === "free" ? "#15803d" : "#92400e",
                              fontWeight: 600,
                              display: "inline-block",
                              marginTop: 2
                            }}
                          >
                            {costTier === "free" ? "Free" : "Paid-metered"}
                          </span>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={cred.enabled}
                          title={cred.enabled ? "Click to disable" : "Click to enable"}
                          onClick={() => void toggleEnabled(cred)}
                          style={{
                            width: 36,
                            height: 20,
                            borderRadius: 999,
                            border: "none",
                            background: cred.enabled ? "#FEAA6D" : "var(--border, #cbd5e1)",
                            position: "relative",
                            cursor: "pointer",
                            padding: 0
                          }}
                        >
                          <span
                            style={{
                              position: "absolute",
                              top: 2,
                              left: cred.enabled ? 18 : 2,
                              width: 16,
                              height: 16,
                              borderRadius: "50%",
                              background: "#fff",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                              transition: "left 120ms"
                            }}
                          />
                        </button>
                        <span style={{ fontSize: 11, marginLeft: 6, color: "var(--text-muted)" }}>
                          {cred.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 6px", fontSize: 12, color: "var(--text-muted)" }}>
                        {cred.validatedAt
                          ? new Date(cred.validatedAt).toLocaleString("en-AU")
                          : "Not validated"}
                        {testResult && testResult !== "testing" ? (
                          <div
                            style={{
                              marginTop: 2,
                              color: testResult.ok ? "#16a34a" : "var(--status-danger, #EF4444)"
                            }}
                          >
                            {testResult.ok ? "✓ OK" : `✗ ${testResult.reason ?? "Failed"}`}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "10px 6px", fontSize: 12, color: "var(--text-muted)" }}>
                        {new Date(cred.updatedAt).toLocaleString("en-AU")}
                      </td>
                      {scope === "company" ? (
                        <td style={{ padding: "10px 6px" }}>
                          {isGeocoding ? (
                            <input
                              type="number"
                              min={1}
                              value={cred.order ?? ""}
                              title="Failover chain order (lower = tried first)"
                              onChange={(e) => {
                                const val = parseInt(e.target.value, 10);
                                if (!isNaN(val) && val > 0) void updateOrder(cred, val);
                              }}
                              style={{
                                width: 52,
                                padding: "3px 6px",
                                fontSize: 12,
                                border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))",
                                borderRadius: 4
                              }}
                            />
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>
                          )}
                        </td>
                      ) : null}
                      <td style={{ padding: "10px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost"
                          disabled={testResult === "testing"}
                          onClick={() => void testCred(cred)}
                          style={{ fontSize: 12 }}
                        >
                          {testResult === "testing" ? "Testing…" : "Test now"}
                        </button>
                        {/* Super-users or owner of personal key can rotate / edit */}
                        {(scope === "company" ? isSuperUser : true) ? (
                          <>
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost"
                              onClick={() => setEditingCred(cred)}
                              style={{ fontSize: 12, marginLeft: 4 }}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost"
                              onClick={() => setRotatingCred(cred)}
                              style={{ fontSize: 12, marginLeft: 4 }}
                            >
                              Rotate key
                            </button>
                            <button
                              type="button"
                              className="s7-btn s7-btn--ghost"
                              onClick={() => void deleteCred(cred)}
                              style={{ fontSize: 12, marginLeft: 4, color: "var(--status-danger)" }}
                            >
                              Delete
                            </button>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add key modal */}
      {showAddModal ? (
        <AddKeyModal
          types={types}
          scope={scope}
          authFetch={authFetch}
          onClose={() => setShowAddModal(false)}
          onSaved={async (msg) => {
            flashMsg(msg);
            setShowAddModal(false);
            await loadCredentials();
          }}
        />
      ) : null}

      {/* Edit credential modal (name / type only — no key field) */}
      {editingCred ? (
        <EditCredModal
          cred={editingCred}
          types={types}
          authFetch={authFetch}
          onClose={() => setEditingCred(null)}
          onSaved={async (msg) => {
            flashMsg(msg);
            setEditingCred(null);
            await loadCredentials();
          }}
        />
      ) : null}

      {/* Rotate key modal (write-only key field, clears validatedAt) */}
      {rotatingCred ? (
        <RotateKeyModal
          cred={rotatingCred}
          authFetch={authFetch}
          onClose={() => setRotatingCred(null)}
          onSaved={async (msg) => {
            flashMsg(msg);
            setRotatingCred(null);
            await loadCredentials();
          }}
        />
      ) : null}

      {/* Manage Types modal */}
      {showManageTypes ? (
        <ManageTypesModal
          types={types}
          authFetch={authFetch}
          onClose={() => setShowManageTypes(false)}
          onChanged={async () => {
            await loadTypes();
          }}
        />
      ) : null}
    </div>
  );
}

// ── Add key modal ──────────────────────────────────────────────────────────────

function AddKeyModal({
  types,
  scope,
  authFetch,
  onClose,
  onSaved
}: {
  types: TypeSummary[];
  scope: CredentialScope;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState(types[0]?.id ?? "");
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!typeId) { setError("Select a type."); return; }
    if (!keyValue.trim()) { setError("Enter an API key."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api-keys/credentials", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), typeId, scope, key: keyValue.trim() })
      });
      await throwIfApiError(res);
      await onSaved(`"${name.trim()}" added.`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title="Add API key" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error ? <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}
        <label className="estimate-editor__field">
          <span>Name</span>
          <input
            className="s7-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Geoapify production"
            autoFocus
            disabled={saving}
          />
        </label>
        <label className="estimate-editor__field">
          <span>Type</span>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            disabled={saving}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))", fontSize: 14, width: "100%" }}
          >
            <option value="">Select a type…</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <label className="estimate-editor__field">
          <span>API key</span>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            Write-only — the value is encrypted at rest and never shown again.
          </div>
          <input
            type="password"
            className="s7-input"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="Paste key"
            disabled={saving}
            style={{ fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace" }}
            autoComplete="new-password"
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Add key"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Edit credential modal (name + type only) ───────────────────────────────────

function EditCredModal({
  cred,
  types,
  authFetch,
  onClose,
  onSaved
}: {
  cred: CredentialSummary;
  types: TypeSummary[];
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [name, setName] = useState(cred.name);
  const [typeId, setTypeId] = useState(cred.typeId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    if (!typeId) { setError("Select a type."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api-keys/credentials/${cred.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), typeId })
      });
      await throwIfApiError(res);
      await onSaved(`"${name.trim()}" updated.`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit — ${cred.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error ? <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}
        <label className="estimate-editor__field">
          <span>Name</span>
          <input
            className="s7-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={saving}
          />
        </label>
        <label className="estimate-editor__field">
          <span>Type</span>
          <select
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            disabled={saving}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid var(--border-subtle, rgba(0,0,0,0.16))", fontSize: 14, width: "100%" }}
          >
            {types.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Rotate key modal (write-only, clears validatedAt) ─────────────────────────

function RotateKeyModal({
  cred,
  authFetch,
  onClose,
  onSaved
}: {
  cred: CredentialSummary;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!keyValue.trim()) { setError("Enter the new API key."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api-keys/credentials/${cred.id}`, {
        method: "PATCH",
        body: JSON.stringify({ key: keyValue.trim() })
      });
      await throwIfApiError(res);
      await onSaved(`Key rotated for "${cred.name}".`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <Modal title={`Rotate key — ${cred.name}`} onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
          Enter the new key. The old key is overwritten immediately and
          <strong> cannot be recovered</strong>. The validated timestamp will be
          cleared and you should run "Test now" after rotation.
        </p>
        {error ? <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}
        <label className="estimate-editor__field">
          <span>New API key</span>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            Write-only — the value is encrypted at rest and never shown.
          </div>
          <input
            type="password"
            className="s7-input"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder="Paste new key"
            autoFocus
            disabled={saving}
            style={{ fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace" }}
            autoComplete="new-password"
          />
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 4 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Rotating…" : "Rotate key"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Manage Types modal ─────────────────────────────────────────────────────────

function ManageTypesModal({
  types,
  authFetch,
  onClose,
  onChanged
}: {
  types: TypeSummary[];
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const [localTypes, setLocalTypes] = useState<TypeSummary[]>(types);
  const [showNewType, setShowNewType] = useState(false);
  const [editingType, setEditingType] = useState<TypeSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const flashMsg = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash((f) => (f === msg ? null : f)), 3000);
  };

  const refresh = async () => {
    try {
      const res = await authFetch("/api-keys/types");
      await throwIfApiError(res);
      const updated = (await res.json()) as TypeSummary[];
      setLocalTypes(updated);
      await onChanged();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteType = async (type: TypeSummary) => {
    if (type.credentialCount > 0) {
      setError(
        `Cannot delete "${type.name}" — ${type.credentialCount} key${type.credentialCount !== 1 ? "s" : ""} use this type. Reassign or delete them first.`
      );
      return;
    }
    const ok = await confirm({
      title: `Delete type "${type.name}"`,
      message: "This cannot be undone.",
      confirmLabel: "Delete",
      variant: "danger"
    });
    if (!ok) return;
    try {
      const res = await authFetch(`/api-keys/types/${type.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.text();
        // 409 = keys still reference this type
        if (res.status === 409) {
          setError(`Cannot delete: ${body}`);
          return;
        }
        throw new Error(body);
      }
      flashMsg(`"${type.name}" deleted.`);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Modal title="Manage API key types" onClose={onClose} wide>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {error ? <p style={{ color: "var(--status-danger)", margin: 0, fontSize: 13 }}>{error}</p> : null}
        {flash ? <p style={{ color: "#16a34a", margin: 0, fontSize: 13 }}>{flash}</p> : null}

        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border, #e5e5e5)" }}>
              <th style={{ padding: "6px 6px" }}>Name</th>
              <th style={{ padding: "6px 6px" }}>Description</th>
              <th style={{ padding: "6px 6px" }}>Kind</th>
              <th style={{ padding: "6px 6px", textAlign: "right" }}>Keys</th>
              <th style={{ padding: "6px 6px" }} />
            </tr>
          </thead>
          <tbody>
            {localTypes.map((type) => (
              <tr key={type.id} style={{ borderBottom: "1px solid var(--border, #f0f0f0)" }}>
                <td style={{ padding: "8px 6px", fontWeight: 600 }}>{type.name}</td>
                <td style={{ padding: "8px 6px", color: "var(--text-muted)" }}>{type.description ?? "—"}</td>
                <td style={{ padding: "8px 6px" }}>
                  {type.systemKind ? (
                    <span style={{ fontSize: 11, padding: "1px 6px", background: "var(--surface-muted, #F6F6F6)", borderRadius: 999 }}>
                      {type.systemKind}
                    </span>
                  ) : (
                    <span style={{ color: "var(--text-muted)" }}>custom</span>
                  )}
                </td>
                <td style={{ padding: "8px 6px", textAlign: "right" }}>{type.credentialCount}</td>
                <td style={{ padding: "8px 6px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost"
                    style={{ fontSize: 12 }}
                    onClick={() => { setEditingType(type); setError(null); }}
                  >
                    Rename
                  </button>
                  {!type.systemKind ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost"
                      style={{ fontSize: 12, marginLeft: 4, color: "var(--status-danger)" }}
                      onClick={() => void deleteType(type)}
                    >
                      Delete
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {editingType ? (
          <RenameTypeInline
            type={editingType}
            authFetch={authFetch}
            onCancel={() => setEditingType(null)}
            onSaved={async (msg) => {
              setEditingType(null);
              flashMsg(msg);
              await refresh();
            }}
          />
        ) : null}

        {showNewType ? (
          <NewTypeInline
            authFetch={authFetch}
            onCancel={() => setShowNewType(false)}
            onSaved={async (msg) => {
              setShowNewType(false);
              flashMsg(msg);
              await refresh();
            }}
          />
        ) : (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost"
              onClick={() => { setShowNewType(true); setError(null); }}
            >
              + New type
            </button>
            <button type="button" className="s7-btn s7-btn--primary" onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}

function RenameTypeInline({
  type,
  authFetch,
  onCancel,
  onSaved
}: {
  type: TypeSummary;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onCancel: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [name, setName] = useState(type.name);
  const [description, setDescription] = useState(type.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch(`/api-keys/types/${type.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined })
      });
      await throwIfApiError(res);
      await onSaved(`"${name.trim()}" updated.`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 12, border: "1px solid var(--border, #e5e7eb)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>Rename "{type.name}"</div>
      {error ? <p style={{ color: "var(--status-danger)", margin: "0 0 8px", fontSize: 13 }}>{error}</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          className="s7-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={saving}
          placeholder="Type name"
        />
        <input
          className="s7-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
          placeholder="Description (optional)"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function NewTypeInline({
  authFetch,
  onCancel,
  onSaved
}: {
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  onCancel: () => void;
  onSaved: (msg: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await authFetch("/api-keys/types", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined })
      });
      await throwIfApiError(res);
      await onSaved(`"${name.trim()}" created.`);
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 12, border: "1px solid var(--border, #e5e7eb)", borderRadius: 8 }}>
      <div style={{ fontWeight: 600, marginBottom: 8, fontSize: 13 }}>New type</div>
      {error ? <p style={{ color: "var(--status-danger)", margin: "0 0 8px", fontSize: 13 }}>{error}</p> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          className="s7-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          disabled={saving}
          placeholder="Type name"
        />
        <input
          className="s7-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={saving}
          placeholder="Description (optional)"
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Creating…" : "Create"}
          </button>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared modal scaffold ─────────────────────────────────────────────────────

function Modal({
  title,
  children,
  onClose,
  wide = false
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)"
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--surface-card, #fff)",
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          padding: 24,
          width: wide ? 680 : 460,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 18,
              color: "var(--text-muted)",
              lineHeight: 1,
              padding: "2px 6px"
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
