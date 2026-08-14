import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Tenant = {
  id: string;
  name: string;
  code: string | null;
};

/**
 * MT-4: Reusable tenant-assignment control for mixed-classification records
 * (Client, Worker, Contact). Presents two states:
 *
 *  - "Shared across the group" → emits `tenantId: null`
 *  - "This company only" → emits `tenantId: <selected Tenant id>`, defaulting
 *    to the first tenant in the list (typically the active company).
 *
 * Fetches the tenant list from `GET /admin/tenants` (super-user only). When the
 * caller lacks super-user access the endpoint will 403 and the control renders a
 * read-only label with the supplied `value` so the edit form degrades gracefully.
 *
 * Props:
 *   value     — current tenantId (null = shared, string = company-scoped)
 *   onChange  — called with the new tenantId when the user changes selection
 *   disabled  — if true, all controls are disabled (read-only mode)
 */
export function TenantAssignmentField({
  value,
  onChange,
  disabled = false
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  disabled?: boolean;
}) {
  const { authFetch } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    authFetch("/admin/tenants")
      .then(async (res) => {
        if (!res.ok) {
          // 403 = not super-user; degrade gracefully to read-only label.
          if (!cancelled) setFetchError(true);
          return;
        }
        const data = (await res.json()) as Tenant[];
        if (!cancelled) setTenants(data);
      })
      .catch(() => {
        if (!cancelled) setFetchError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  // Graceful degradation: if the tenant list couldn't be loaded (no super-user
  // access), show a read-only label so the edit form doesn't break.
  if (fetchError) {
    return (
      <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
        <span style={{ fontWeight: 600 }}>Company scope:</span>{" "}
        {value ? `Scoped (${value})` : "Shared across group"}
      </div>
    );
  }

  const isShared = value === null;

  const handleModeChange = (shared: boolean) => {
    if (shared) {
      onChange(null);
    } else {
      // Default to the first available tenant when switching to company-scoped.
      onChange(tenants[0]?.id ?? null);
    }
  };

  const handleTenantSelect = (id: string) => {
    onChange(id);
  };

  return (
    <fieldset
      style={{ border: "1px solid var(--border, #e5e7eb)", borderRadius: 6, padding: "10px 14px", margin: 0 }}
      disabled={disabled}
    >
      <legend style={{ fontSize: 12, color: "var(--text-muted)", padding: "0 4px", fontWeight: 600 }}>
        Company scope
      </legend>

      {loading ? (
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading&hellip;</span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
            <input
              type="radio"
              name="tenant-scope"
              value="shared"
              checked={isShared}
              disabled={disabled}
              onChange={() => handleModeChange(true)}
            />
            Shared across the group
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
            <input
              type="radio"
              name="tenant-scope"
              value="scoped"
              checked={!isShared}
              disabled={disabled}
              onChange={() => handleModeChange(false)}
            />
            This company only
          </label>

          {!isShared && tenants.length > 0 && (
            <select
              value={value ?? ""}
              disabled={disabled}
              onChange={(e) => handleTenantSelect(e.target.value)}
              style={{
                marginLeft: 24,
                padding: "6px 10px",
                border: "1px solid var(--border, #d1d5db)",
                borderRadius: 4,
                fontSize: 13,
                maxWidth: 280
              }}
              aria-label="Select company"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.code ? ` (${t.code})` : ""}
                </option>
              ))}
            </select>
          )}

          {!isShared && tenants.length === 0 && (
            <p style={{ margin: "4px 0 0 24px", fontSize: 12, color: "var(--status-danger, #dc2626)" }}>
              No active companies found. Contact your administrator.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
