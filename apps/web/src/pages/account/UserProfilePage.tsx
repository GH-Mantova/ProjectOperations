import { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { AddPersonalProviderModal } from "./AddPersonalProviderModal";
import { GlobalListsSection } from "./GlobalListsSection";

type PersonalProvider = {
  id: string;
  provider: string;
  label: string | null;
  model: string;
  isActive: boolean;
  maskedKey: string;
  createdAt: string;
  updatedAt: string;
};

type CompanyEntry = {
  id: string;
  type: string;
  source: "company";
  label: string;
  model: string;
  isDefault: boolean;
};

type ListResponse = {
  personal: PersonalProvider[];
  company: CompanyEntry[];
};

const PROVIDER_LABELS: Record<string, string> = {
  anthropic: "Claude (Anthropic)",
  openai: "ChatGPT (OpenAI)",
  gemini: "Gemini (Google)",
  groq: "Llama 3 on Groq"
};

export function UserProfilePage() {
  const { user, authFetch } = useAuth();
  const isAdmin = useMemo(() => user?.roles?.some((r) => r.name === "Admin") ?? false, [user]);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch("/user/ai-providers");
      if (!response.ok) throw new Error(await response.text());
      setData((await response.json()) as ListResponse);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const toggleActive = async (id: string, next: boolean) => {
    const response = await authFetch(`/user/ai-providers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: next })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await reload();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this personal AI provider? You can re-add it later.")) return;
    const response = await authFetch(`/user/ai-providers/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await reload();
  };

  return (
    <div style={{ padding: "24px", maxWidth: 980 }}>
      <h1 className="s7-type-page-heading" style={{ marginTop: 0 }}>My account</h1>
      {user ? (
        <p style={{ color: "var(--text-muted)" }}>
          Signed in as <strong>{user.firstName} {user.lastName}</strong> · {user.email}
        </p>
      ) : null}

      <section className="s7-card" style={{ marginTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
              My AI providers
            </h2>
            <p style={{ color: "var(--text-muted)", margin: 0, fontSize: 13 }}>
              Keys you add here are private to you. Whenever an AI feature runs, you can choose
              between your personal keys and the company-managed keys.
            </p>
          </div>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => setAddOpen(true)}
          >
            + Add personal key
          </button>
        </div>

        {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

        <section style={{ marginTop: 16 }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Company providers
            <span style={{
              marginLeft: 8,
              padding: "1px 8px",
              background: "var(--surface-muted, #eef)",
              color: "var(--text-muted)",
              borderRadius: 999,
              fontSize: 11,
              textTransform: "none"
            }}>
              Managed by admin
            </span>
          </h3>
          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : data?.company.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {data.company.map((c) => (
                <li key={c.id} style={{ padding: "8px 12px", border: "1px solid var(--border, #e5e7eb)", borderRadius: 6 }}>
                  <div style={{ fontWeight: 500 }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Model: {c.model}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              No company-managed providers are configured. Ask an admin to configure one in
              Admin → Platform settings, or add your own personal key below.
            </p>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>
            Personal providers
          </h3>
          {loading ? (
            <p style={{ color: "var(--text-muted)" }}>Loading…</p>
          ) : data?.personal.length ? (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {data.personal.map((p) => {
                const providerLabel = PROVIDER_LABELS[p.provider] ?? p.provider;
                return (
                  <li
                    key={p.id}
                    style={{
                      padding: "10px 12px",
                      border: "1px solid var(--border, #e5e7eb)",
                      borderRadius: 6,
                      opacity: p.isActive ? 1 : 0.6,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 500 }}>
                        {p.label ?? `${providerLabel} (personal)`}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {providerLabel} · Model: {p.model} · Key: {p.maskedKey}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12 }}>
                        <input
                          type="checkbox"
                          checked={p.isActive}
                          onChange={(e) => void toggleActive(p.id, e.target.checked)}
                        />
                        Active
                      </label>
                      <button
                        type="button"
                        className="s7-btn s7-btn--ghost s7-btn--sm"
                        onClick={() => void remove(p.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              heading="No personal AI keys yet"
              subtext="Add your own key to keep AI usage on your personal account."
              action={
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => setAddOpen(true)}
                >
                  Add a personal key
                </button>
              }
            />
          )}
        </section>
      </section>

      <GlobalListsSection isAdmin={isAdmin} />

      <section className="s7-card" style={{ marginTop: 24 }}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0, marginBottom: 4 }}>
          Notification preferences
        </h2>
        <p style={{ color: "var(--text-muted)", marginTop: 0, fontSize: 13 }}>
          System-wide notification triggers and recipient lists are managed by your administrator on
          the <strong>Admin → Settings</strong> page. You'll automatically receive any trigger that
          names you (or your role) as a recipient.
        </p>
      </section>

      {addOpen ? (
        <AddPersonalProviderModal
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            void reload();
          }}
        />
      ) : null}
    </div>
  );
}
