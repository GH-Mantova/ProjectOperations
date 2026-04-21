import { useCallback, useEffect, useState } from "react";
import { EmptyState } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type ClarificationNote = {
  id: string;
  direction: "sent" | "received";
  text: string;
  occurredAt: string;
  createdBy: { id: string; firstName: string; lastName: string } | null;
};

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}

export function TenderClarificationLog({ tenderId, canManage }: { tenderId: string; canManage: boolean }) {
  const { authFetch } = useAuth();
  const [notes, setNotes] = useState<ClarificationNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [direction, setDirection] = useState<"sent" | "received">("received");
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch(`/tenders/${tenderId}/clarification-notes`);
      if (!response.ok) throw new Error(await response.text());
      setNotes((await response.json()) as ClarificationNote[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!text.trim()) return;
    setPosting(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${tenderId}/clarification-notes`, {
        method: "POST",
        body: JSON.stringify({ direction, text: text.trim(), date: date || undefined })
      });
      if (!response.ok) throw new Error(await response.text());
      setText("");
      setDate("");
      setAdding(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this clarification note?")) return;
    const response = await authFetch(`/tenders/${tenderId}/clarification-notes/${id}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await load();
  };

  return (
    <section className="s7-card" style={{ marginTop: 12 }}>
      <div className="tender-detail__section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Clarification log</h3>
        {canManage ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? "Cancel" : "+ Add"}
          </button>
        ) : null}
      </div>

      {adding ? (
        <form
          style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div style={{ display: "flex", gap: 8 }}>
            <div role="radiogroup" aria-label="Direction" style={{ display: "flex", gap: 4 }}>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                <input
                  type="radio"
                  checked={direction === "sent"}
                  onChange={() => setDirection("sent")}
                />
                Sent
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                <input
                  type="radio"
                  checked={direction === "received"}
                  onChange={() => setDirection("received")}
                />
                Received
              </label>
            </div>
            <input
              type="date"
              className="s7-input"
              style={{ maxWidth: 180 }}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <textarea
            className="s7-input"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Clarification text…"
            required
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={posting || !text.trim()}>
              {posting ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : null}

      {error ? <p style={{ color: "var(--status-danger)" }}>{error}</p> : null}

      {loading ? (
        <p style={{ color: "var(--text-muted)" }}>Loading…</p>
      ) : notes.length === 0 ? (
        <EmptyState
          heading="No clarification log entries"
          subtext="Log every sent or received message here to keep a clean audit trail alongside the Q&A clarifications above."
        />
      ) : (
        <ul className="tender-clarifications" style={{ marginTop: 12 }}>
          {notes.map((n) => {
            const isSent = n.direction === "sent";
            const tone = isSent ? "var(--brand-primary, #005B61)" : "var(--brand-accent, #FEAA6D)";
            return (
              <li
                key={n.id}
                style={{
                  padding: 10,
                  border: "1px solid var(--border, #e5e7eb)",
                  borderLeft: `4px solid ${tone}`,
                  borderRadius: 6,
                  marginBottom: 6,
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 11,
                        padding: "2px 8px",
                        background: tone,
                        color: "#fff",
                        borderRadius: 999,
                        textTransform: "uppercase",
                        letterSpacing: 0.3
                      }}
                    >
                      {isSent ? "Sent →" : "← Received"}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{formatDate(n.occurredAt)}</span>
                    {n.createdBy ? (
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                        · {n.createdBy.firstName} {n.createdBy.lastName}
                      </span>
                    ) : null}
                  </div>
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{n.text}</p>
                </div>
                {canManage ? (
                  <button
                    type="button"
                    className="s7-btn s7-btn--ghost s7-btn--sm"
                    aria-label="Delete clarification"
                    onClick={() => void remove(n.id)}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
