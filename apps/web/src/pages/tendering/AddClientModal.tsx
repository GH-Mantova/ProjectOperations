import { useCallback, useEffect, useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { DynamicFieldSection } from "../../components/DynamicFieldSection";

type ClientSearchResult = {
  id: string;
  name: string;
  email: string | null;
  contactName: string | null;
  customFields?: Record<string, unknown>;
};

export function AddClientModal({
  tenderId,
  linkedClientIds,
  onClose,
  onAdded
}: {
  tenderId: string;
  linkedClientIds: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { authFetch } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ClientSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Tracks the currently-previewed client so DynamicFieldSection can show
  // its custom fields before the link is confirmed.
  const [previewClient, setPreviewClient] = useState<ClientSearchResult | null>(null);

  const runSearch = useCallback(
    async (term: string) => {
      setError(null);
      setPreviewClient(null);
      if (term.trim().length === 0) {
        setResults([]);
        return;
      }
      try {
        const response = await authFetch(`/tendering/clients/search?q=${encodeURIComponent(term.trim())}`);
        if (!response.ok) throw new Error(await response.text());
        setResults((await response.json()) as ClientSearchResult[]);
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [authFetch]
  );

  // Debounce input so we don't fire on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => void runSearch(q), 250);
    return () => clearTimeout(t);
  }, [q, runSearch]);

  const add = async (clientId: string) => {
    setBusyId(clientId);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/clients`, {
        method: "POST",
        body: JSON.stringify({ clientId })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Could not add client.");
      }
      onAdded();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <CenteredModal
      title="Add client to tender"
      onClose={onClose}
      maxWidth={520}
      footer={
        <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Close</button>
      }
    >
      <label className="estimate-editor__field">
        <span>Search clients</span>
        <input
          autoFocus
          className="s7-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Start typing a client name…"
        />
      </label>

      {error ? <p style={{ color: "var(--status-danger)", marginTop: 8 }}>{error}</p> : null}

      <ul style={{ listStyle: "none", padding: 0, margin: "12px 0 0", maxHeight: 320, overflowY: "auto" }}>
        {q.trim().length === 0 ? (
          <li style={{ color: "var(--text-muted)", fontSize: 13, padding: 8 }}>
            Type at least one character to search.
          </li>
        ) : results.length === 0 ? (
          <li style={{ color: "var(--text-muted)", fontSize: 13, padding: 8 }}>No matches.</li>
        ) : (
          results.map((r) => {
            const alreadyLinked = linkedClientIds.includes(r.id);
            return (
              <li
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--border, #e5e7eb)",
                  gap: 8
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }}>{r.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {r.contactName ? `${r.contactName}` : null}
                    {r.contactName && r.email ? " · " : null}
                    {r.email ?? null}
                  </div>
                </div>
                {alreadyLinked ? (
                  <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Already linked</span>
                ) : (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      disabled={busyId !== null}
                      onClick={() => setPreviewClient(previewClient?.id === r.id ? null : r)}
                    >
                      {previewClient?.id === r.id ? "Hide fields" : "View fields"}
                    </button>
                    <button
                      type="button"
                      className="s7-btn s7-btn--primary s7-btn--sm"
                      disabled={busyId !== null}
                      onClick={() => void add(r.id)}
                    >
                      {busyId === r.id ? "Adding…" : "Add"}
                    </button>
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>

      {previewClient ? (
        // Preview panel scrolls internally so a tenant with many CLIENT
        // custom field definitions does not stretch the "Add client" modal
        // past viewport — the "Close" footer must stay reachable.
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--surface-subtle, rgba(0,0,0,0.02))",
            borderRadius: 6,
            maxHeight: 260,
            overflowY: "auto",
            overflowX: "hidden"
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
            Custom fields — {previewClient.name}
          </p>
          <DynamicFieldSection
            appliesTo="CLIENT"
            record={previewClient}
            onChange={() => {
              // Read-only preview — changes are not submitted here.
            }}
          />
        </div>
      ) : null}
    </CenteredModal>
  );
}
