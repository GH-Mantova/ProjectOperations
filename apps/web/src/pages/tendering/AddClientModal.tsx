import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type ClientSearchResult = {
  id: string;
  name: string;
  email: string | null;
  contactName: string | null;
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

  const runSearch = useCallback(
    async (term: string) => {
      setError(null);
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
    <div
      className="slide-over-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add client to tender"
      onClick={onClose}
    >
      <div className="s7-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
        <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Add client to tender</h2>
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
                    <button
                      type="button"
                      className="s7-btn s7-btn--primary s7-btn--sm"
                      disabled={busyId !== null}
                      onClick={() => void add(r.id)}
                    >
                      {busyId === r.id ? "Adding…" : "Add"}
                    </button>
                  )}
                </li>
              );
            })
          )}
        </ul>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
