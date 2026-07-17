import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState, Skeleton } from "@project-ops/ui";

type ClientItem = { id: string; name: string };

type SatisfactionSummary = {
  clientId: string;
  count: number;
  meanScore: number | null;
  lastSubmittedAt: string | null;
  latestComments: string[];
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="s7-badge s7-badge--neutral">No responses</span>;
  const cls =
    score >= 4 ? "s7-badge s7-badge--active"
    : score >= 3 ? "s7-badge s7-badge--info"
    : "s7-badge s7-badge--warning";
  return <span className={cls}>{score.toFixed(1)} / 5</span>;
}

export function ClientSatisfactionPage() {
  const { authFetch } = useAuth();

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [summary, setSummary] = useState<SatisfactionSummary | null>(null);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await authFetch("/master-data/clients?page=1&pageSize=200");
        if (!res.ok) throw new Error("Could not load clients.");
        const data = await res.json();
        if (!cancelled) setClients((data.items ?? []) as ClientItem[]);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  const loadSummary = async (clientId: string) => {
    if (!clientId) { setSummary(null); return; }
    setLoadingSummary(true);
    setError(null);
    try {
      const res = await authFetch(`/clients/${clientId}/satisfaction`);
      if (!res.ok) throw new Error("Could not load satisfaction data.");
      setSummary((await res.json()) as SatisfactionSummary);
    } catch (err) {
      setError((err as Error).message);
      setSummary(null);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleClientChange = (id: string) => {
    setSelectedClientId(id);
    void loadSummary(id);
  };

  return (
    <div className="s7-page">
      <h1 className="s7-page__title">Client Satisfaction</h1>
      <p className="s7-page__subtitle">
        View aggregated survey scores and feedback for each client.
      </p>

      {error && (
        <div className="s7-alert s7-alert--danger" role="alert">
          {error}
        </div>
      )}

      {loadingClients ? (
        <Skeleton width="60%" height={40} />
      ) : (
        <div style={{ maxWidth: 480, marginBottom: 24 }}>
          <label className="s7-label" htmlFor="sat-client-select">Select client</label>
          <select
            id="sat-client-select"
            className="s7-input"
            value={selectedClientId}
            onChange={(e) => handleClientChange(e.target.value)}
          >
            <option value="">Choose a client…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {loadingSummary && <Skeleton width="100%" height={200} />}

      {!loadingSummary && summary && (
        <section className="s7-card" style={{ maxWidth: 720 }}>
          <h2 className="s7-section-title">
            Satisfaction summary
            <ScoreBadge score={summary.meanScore} />
          </h2>

          {summary.count === 0 ? (
            <EmptyState heading="No responses yet" subtext="Capture a survey response to see satisfaction data." />
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
                <div className="s7-card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-teal)" }}>
                    {summary.meanScore !== null ? summary.meanScore.toFixed(1) : "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Mean score (/ 5)</div>
                </div>
                <div className="s7-card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "var(--color-teal)" }}>
                    {summary.count}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Responses</div>
                </div>
                <div className="s7-card" style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 600 }}>
                    {summary.lastSubmittedAt
                      ? new Date(summary.lastSubmittedAt).toLocaleDateString("en-AU")
                      : "—"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--color-text-muted)" }}>Last response</div>
                </div>
              </div>

              {summary.latestComments.length > 0 && (
                <>
                  <h3 style={{ fontWeight: 600, marginBottom: 12 }}>Latest comments</h3>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {summary.latestComments.map((comment, idx) => (
                      <li
                        key={idx}
                        style={{
                          padding: "10px 14px",
                          background: "var(--color-bg-subtle)",
                          borderRadius: 6,
                          fontSize: 14,
                          borderLeft: "3px solid var(--color-teal)"
                        }}
                      >
                        {comment}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      )}

      {!loadingSummary && !summary && selectedClientId && !error && (
        <EmptyState heading="No data" subtext="Select a client to view satisfaction data." />
      )}
    </div>
  );
}
