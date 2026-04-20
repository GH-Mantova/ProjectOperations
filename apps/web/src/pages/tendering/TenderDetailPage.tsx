import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { EstimateEditor } from "./EstimateEditor";

type TenderDetail = {
  id: string;
  tenderNumber: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: string | null;
  proposedStartDate?: string | null;
  estimatedValue?: string | null;
  probability?: number | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    id: string;
    client: { id: string; name: string };
    contact?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
    isAwarded: boolean;
    contractIssued: boolean;
    relationshipType?: string | null;
  }>;
  tenderNotes: Array<{ id: string; body: string; createdAt: string; author?: { firstName: string; lastName: string } | null }>;
  clarifications: Array<{ id: string; subject: string; response?: string | null; status: string; createdAt: string; dueDate?: string | null }>;
  followUps: Array<{ id: string; details: string; dueAt: string; status: string; assignedUser?: { firstName: string; lastName: string } | null }>;
  pricingSnapshots: Array<{ id: string; versionLabel: string; estimatedValue?: string | null; marginPercent?: string | null; assumptions?: string | null; createdAt: string }>;
  outcomes: Array<{ id: string; outcomeType: string; notes?: string | null; recordedAt: string }>;
  tenderDocuments: Array<{
    id: string;
    category: string;
    title: string;
    description?: string | null;
    fileLink?: { name: string; webUrl: string } | null;
  }>;
};

const STAGE_LABEL: Record<string, string> = {
  DRAFT: "Identified",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  LOST: "Lost",
  WITHDRAWN: "Withdrawn"
};

const STAGE_ACCENT: Record<string, string> = {
  DRAFT: "var(--status-neutral, #6B7280)",
  IN_PROGRESS: "var(--status-info, #3B82F6)",
  SUBMITTED: "var(--status-warning, #F59E0B)",
  AWARDED: "var(--status-active, #005B61)",
  LOST: "var(--status-danger, #EF4444)",
  WITHDRAWN: "var(--text-muted, #9CA3AF)"
};

type Tab = "overview" | "estimate" | "documents";

function formatCurrency(raw?: string | null): string {
  if (!raw) return "—";
  const value = Number(raw);
  if (Number.isNaN(value)) return raw;
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString();
}

export function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { authFetch, user } = useAuth();
  const canManageEstimates = useMemo(() => user?.permissions.includes("estimates.manage") ?? false, [user]);
  const canAdminEstimates = useMemo(() => user?.permissions.includes("estimates.admin") ?? false, [user]);
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [posting, setPosting] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newClarification, setNewClarification] = useState("");
  const [newFollowUp, setNewFollowUp] = useState({ details: "", dueAt: "" });

  const reload = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch(`/tenders/${id}`);
      if (!response.ok) throw new Error("Tender not found.");
      setTender((await response.json()) as TenderDetail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch, id]);

  if (loading) {
    return (
      <div className="tender-detail">
        <div className="tender-detail__main">
          <Skeleton width="30%" height={14} />
          <Skeleton width="70%" height={24} style={{ marginTop: 12 }} />
          <Skeleton width="100%" height={200} style={{ marginTop: 24 }} />
        </div>
        <div className="tender-detail__rail">
          <Skeleton width="100%" height={300} />
        </div>
      </div>
    );
  }

  if (error || !tender) {
    return (
      <div className="tender-detail tender-detail--single">
        <EmptyState
          heading="Tender not found"
          subtext={error ?? "The tender you're looking for doesn't exist or has been removed."}
          action={<Link to="/tenders" className="s7-btn s7-btn--primary">← Back to pipeline</Link>}
        />
      </div>
    );
  }

  const stageLabel = STAGE_LABEL[tender.status] ?? tender.status;
  const stageAccent = STAGE_ACCENT[tender.status] ?? "var(--text-muted)";

  const activityTimeline = [
    ...tender.tenderNotes.map((note) => ({
      kind: "note" as const,
      id: note.id,
      at: note.createdAt,
      title: "Note",
      body: note.body,
      author: note.author ? `${note.author.firstName} ${note.author.lastName}` : undefined
    })),
    ...tender.clarifications.map((item) => ({
      kind: "clarification" as const,
      id: item.id,
      at: item.createdAt,
      title: `Clarification · ${item.status}`,
      body: `Q: ${item.subject}${item.response ? `\nA: ${item.response}` : ""}`,
      author: undefined as string | undefined
    })),
    ...tender.followUps.map((item) => ({
      kind: "follow-up" as const,
      id: item.id,
      at: item.dueAt,
      title: `Follow-up · due ${formatDate(item.dueAt)}`,
      body: item.details,
      author: item.assignedUser ? `${item.assignedUser.firstName} ${item.assignedUser.lastName}` : undefined
    })),
    ...tender.outcomes.map((item) => ({
      kind: "outcome" as const,
      id: item.id,
      at: item.recordedAt,
      title: `Outcome · ${item.outcomeType}`,
      body: item.notes ?? "",
      author: undefined as string | undefined
    }))
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const postNote = async () => {
    if (!tender || !newNote.trim()) return;
    setPosting(true);
    try {
      const response = await authFetch(`/tenders/${tender.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ body: newNote.trim() })
      });
      if (!response.ok) throw new Error("Could not add note.");
      setNewNote("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const postClarification = async () => {
    if (!tender || !newClarification.trim()) return;
    setPosting(true);
    try {
      const response = await authFetch(`/tenders/${tender.id}/clarifications`, {
        method: "POST",
        body: JSON.stringify({ subject: newClarification.trim() })
      });
      if (!response.ok) throw new Error("Could not add clarification.");
      setNewClarification("");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const postFollowUp = async () => {
    if (!tender || !newFollowUp.details.trim() || !newFollowUp.dueAt) return;
    setPosting(true);
    try {
      const response = await authFetch(`/tenders/${tender.id}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({
          details: newFollowUp.details.trim(),
          dueAt: new Date(newFollowUp.dueAt).toISOString()
        })
      });
      if (!response.ok) throw new Error("Could not add follow-up.");
      setNewFollowUp({ details: "", dueAt: "" });
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="tender-detail">
      <div className="tender-detail__main">
        <Link to="/tenders" className="tender-detail__back">← Back to pipeline</Link>
        <div className="tender-detail__title-row">
          <div>
            <p className="s7-type-label">{tender.tenderNumber}</p>
            <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>{tender.title}</h1>
          </div>
          <span
            className="s7-badge"
            style={{
              background: `color-mix(in srgb, ${stageAccent} 15%, transparent)`,
              color: stageAccent
            }}
          >
            {stageLabel}
          </span>
        </div>

        <nav className="tender-detail__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "overview"}
            className={tab === "overview" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab("overview")}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "estimate"}
            className={tab === "estimate" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab("estimate")}
          >
            Estimate
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "documents"}
            className={tab === "documents" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab("documents")}
          >
            Documents ({tender.tenderDocuments.length})
          </button>
        </nav>

        {tab === "overview" && (
          <div className="tender-detail__sections">
            <section className="s7-card">
              <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Description</h3>
              {tender.description ? (
                <p>{tender.description}</p>
              ) : (
                <p style={{ color: "var(--text-muted)" }}>No description recorded.</p>
              )}
              {tender.notes ? (
                <>
                  <h4 className="s7-type-card-title" style={{ marginBottom: 6 }}>Scope notes</h4>
                  <p>{tender.notes}</p>
                </>
              ) : null}
            </section>

            <section className="s7-card">
              <div className="tender-detail__section-head">
                <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Activity timeline</h3>
              </div>
              <form
                className="tender-detail__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void postNote();
                }}
              >
                <input
                  className="s7-input"
                  value={newNote}
                  onChange={(event) => setNewNote(event.target.value)}
                  placeholder="Add a note…"
                />
                <button type="submit" className="s7-btn s7-btn--primary" disabled={posting || !newNote.trim()}>
                  Post
                </button>
              </form>
              {activityTimeline.length === 0 ? (
                <EmptyState heading="No activity yet" subtext="Notes, clarifications, follow-ups, and outcomes appear here once recorded." />
              ) : (
                <ul className="tender-timeline">
                  {activityTimeline.map((entry) => (
                    <li key={`${entry.kind}-${entry.id}`} className={`tender-timeline__item tender-timeline__item--${entry.kind}`}>
                      <span className="tender-timeline__marker" aria-hidden />
                      <div className="tender-timeline__body">
                        <div className="tender-timeline__head">
                          <strong>{entry.title}</strong>
                          <span className="tender-timeline__time">{formatDateTime(entry.at)}</span>
                        </div>
                        {entry.body ? <p className="tender-timeline__text">{entry.body}</p> : null}
                        {entry.author ? <span className="tender-timeline__author">— {entry.author}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="s7-card">
              <div className="tender-detail__section-head">
                <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Clarifications</h3>
              </div>
              <form
                className="tender-detail__form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void postClarification();
                }}
              >
                <input
                  className="s7-input"
                  value={newClarification}
                  onChange={(event) => setNewClarification(event.target.value)}
                  placeholder="Subject of the clarification…"
                />
                <button type="submit" className="s7-btn s7-btn--primary" disabled={posting || !newClarification.trim()}>
                  Add
                </button>
              </form>
              {tender.clarifications.length === 0 ? (
                <EmptyState heading="No clarifications" subtext="Record questions and their responses to keep the audit trail complete." />
              ) : (
                <ul className="tender-clarifications">
                  {tender.clarifications.map((item) => (
                    <li key={item.id} className="tender-clarifications__item">
                      <div className="tender-clarifications__head">
                        <strong>Q: {item.subject}</strong>
                        <span className="s7-badge s7-badge--neutral">{item.status}</span>
                      </div>
                      {item.response ? <p>A: {item.response}</p> : <p style={{ color: "var(--text-muted)" }}>Awaiting response.</p>}
                      {item.dueDate ? <span className="tender-clarifications__due">Due {formatDate(item.dueDate)}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="s7-card">
              <div className="tender-detail__section-head">
                <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Follow-ups</h3>
              </div>
              <form
                className="tender-detail__form tender-detail__form--two"
                onSubmit={(event) => {
                  event.preventDefault();
                  void postFollowUp();
                }}
              >
                <input
                  className="s7-input"
                  value={newFollowUp.details}
                  onChange={(event) => setNewFollowUp((current) => ({ ...current, details: event.target.value }))}
                  placeholder="Follow-up detail…"
                />
                <input
                  className="s7-input"
                  type="date"
                  value={newFollowUp.dueAt}
                  onChange={(event) => setNewFollowUp((current) => ({ ...current, dueAt: event.target.value }))}
                />
                <button type="submit" className="s7-btn s7-btn--primary" disabled={posting || !newFollowUp.details.trim() || !newFollowUp.dueAt}>
                  Add
                </button>
              </form>
              {tender.followUps.length === 0 ? (
                <EmptyState heading="No follow-ups" subtext="Schedule the next action to keep this tender moving." />
              ) : (
                <ul className="tender-followups">
                  {tender.followUps.map((item) => (
                    <li key={item.id} className="tender-followups__item">
                      <div className="tender-followups__head">
                        <strong>{item.details}</strong>
                        <span className="s7-badge s7-badge--neutral">{item.status}</span>
                      </div>
                      <span className="tender-followups__due">
                        Due {formatDate(item.dueAt)}
                        {item.assignedUser ? ` · ${item.assignedUser.firstName} ${item.assignedUser.lastName}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "estimate" && (
          <EstimateEditor tenderId={tender.id} canManage={canManageEstimates} canAdmin={canAdminEstimates} />
        )}

        {tab === "documents" && (
          <section className="s7-card">
            <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Documents</h3>
            {tender.tenderDocuments.length === 0 ? (
              <EmptyState heading="No documents yet" subtext="Linked SharePoint documents appear here once uploaded or registered." />
            ) : (
              <ul className="tender-docs">
                {tender.tenderDocuments.map((doc) => (
                  <li key={doc.id} className="tender-docs__item">
                    <div>
                      <strong>{doc.title}</strong>
                      <p className="tender-docs__meta">{doc.category}{doc.description ? ` · ${doc.description}` : ""}</p>
                    </div>
                    {doc.fileLink ? (
                      <a href={doc.fileLink.webUrl} target="_blank" rel="noreferrer" className="s7-btn s7-btn--secondary s7-btn--sm">
                        Open
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

      </div>

      <aside className="tender-detail__rail">
        <section className="s7-card tender-detail__rail-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Snapshot</h3>
          <dl className="tender-detail__dl">
            <div><dt>Stage</dt><dd>{stageLabel}</dd></div>
            <div><dt>Value</dt><dd>{formatCurrency(tender.estimatedValue)}</dd></div>
            <div><dt>Probability</dt><dd>{tender.probability !== null && tender.probability !== undefined ? `${tender.probability}%` : "—"}</dd></div>
            <div><dt>Due</dt><dd>{formatDate(tender.dueDate)}</dd></div>
            <div><dt>Proposed start</dt><dd>{formatDate(tender.proposedStartDate)}</dd></div>
            <div><dt>Last activity</dt><dd>{formatDateTime(tender.updatedAt)}</dd></div>
          </dl>
        </section>

        <section className="s7-card tender-detail__rail-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Team</h3>
          <div className="tender-detail__team">
            {tender.estimator ? (
              <div className="tender-detail__team-row">
                <span className="tender-detail__avatar">{tender.estimator.firstName[0]}{tender.estimator.lastName[0]}</span>
                <div>
                  <strong>{tender.estimator.firstName} {tender.estimator.lastName}</strong>
                  <p className="s7-type-label">Estimator</p>
                </div>
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)" }}>No estimator assigned.</p>
            )}
          </div>
        </section>

        <section className="s7-card tender-detail__rail-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Clients</h3>
          {tender.tenderClients.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No clients linked.</p>
          ) : (
            <ul className="tender-detail__clients">
              {tender.tenderClients.map((tc) => (
                <li key={tc.id}>
                  <strong>{tc.client.name}</strong>
                  {tc.relationshipType ? <span className="tender-detail__client-tag">{tc.relationshipType}</span> : null}
                  {tc.isAwarded ? <span className="s7-badge s7-badge--active">Awarded</span> : null}
                  {tc.contractIssued ? <span className="s7-badge s7-badge--info">Contract issued</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="s7-card tender-detail__rail-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Pricing snapshots</h3>
          {tender.pricingSnapshots.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>No pricing recorded.</p>
          ) : (
            <ul className="tender-detail__pricing">
              {tender.pricingSnapshots.map((snapshot) => (
                <li key={snapshot.id}>
                  <strong>{snapshot.versionLabel}</strong>
                  <span>{formatCurrency(snapshot.estimatedValue)}{snapshot.marginPercent ? ` · ${snapshot.marginPercent}% margin` : ""}</span>
                  {snapshot.assumptions ? <span className="tender-detail__pricing-assumptions">{snapshot.assumptions}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
