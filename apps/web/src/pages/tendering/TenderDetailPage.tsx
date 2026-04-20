import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { EstimateEditor } from "./EstimateEditor";
import { TenderDocumentsPanel } from "./TenderDocumentsPanel";
import { TenderClientNotesSection } from "./TenderClientNotesSection";
import { AnthropicKeyModal } from "./AnthropicKeyModal";
import { DraftedScopePanel, type DraftResult, type EstimateItemRef } from "./DraftedScopePanel";

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
    createdAt?: string;
    fileLink?: { name: string; webUrl: string; sizeBytes?: number | null; mimeType?: string | null } | null;
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

type Tab = "overview" | "estimate" | "documents" | "drafted";

type EstimateSummaryPayload = {
  estimateId: string | null;
  locked: boolean;
  items: Array<{ itemId: string; code: string; itemNumber: number; title: string; price: number }>;
  totals: { labour: number; equip: number; plant: number; waste: number; cutting: number; subtotal: number; price: number };
};

type EstimateLockInfo = { lockedAt: string | null };

type ProbabilityBucket = "hot" | "warm" | "cold" | "unknown";

function bucketForProbability(value: number | null | undefined): ProbabilityBucket {
  if (value === null || value === undefined) return "unknown";
  if (value >= 70) return "hot";
  if (value >= 30) return "warm";
  return "cold";
}

function valueForBucket(bucket: ProbabilityBucket): number | null {
  if (bucket === "hot") return 80;
  if (bucket === "warm") return 50;
  if (bucket === "cold") return 20;
  return null;
}

const PROBABILITY_LABEL: Record<ProbabilityBucket, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  unknown: "Not set"
};

const PROBABILITY_BADGE_STYLE: Record<ProbabilityBucket, { background: string; color: string }> = {
  hot: { background: "#FEAA6D", color: "#3E1C00" },
  warm: { background: "#FED7AA", color: "#3E2A00" },
  cold: { background: "#E2E8F0", color: "#0F172A" },
  unknown: { background: "rgba(0,0,0,0.08)", color: "#6B7280" }
};

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

function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);
}

export function TenderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authFetch, user } = useAuth();
  const canManageTenders = useMemo(() => user?.permissions.includes("tenders.manage") ?? false, [user]);
  const canManageEstimates = useMemo(() => user?.permissions.includes("estimates.manage") ?? false, [user]);
  const canAdminEstimates = useMemo(() => user?.permissions.includes("estimates.admin") ?? false, [user]);
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [estimateSummary, setEstimateSummary] = useState<EstimateSummaryPayload | null>(null);
  const [estimateLock, setEstimateLock] = useState<EstimateLockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [posting, setPosting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newClarification, setNewClarification] = useState("");
  const [newFollowUp, setNewFollowUp] = useState({ details: "", dueAt: "" });
  const [draftResult, setDraftResult] = useState<DraftResult | null>(null);
  const [draftBadge, setDraftBadge] = useState<"none" | "new" | "reviewed">("none");
  const [drafting, setDrafting] = useState(false);
  const [estimateItemsForLink, setEstimateItemsForLink] = useState<EstimateItemRef[]>([]);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState<string | null>(null);

  const reload = useCallback(async () => {
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
  }, [authFetch, id]);

  const loadEstimate = useCallback(async () => {
    if (!id) return;
    try {
      const [summaryRes, estimateRes] = await Promise.all([
        authFetch(`/tenders/${id}/estimate/summary`),
        authFetch(`/tenders/${id}/estimate`)
      ]);
      if (summaryRes.ok) setEstimateSummary((await summaryRes.json()) as EstimateSummaryPayload);
      if (estimateRes.ok) {
        const body = (await estimateRes.json()) as { lockedAt: string | null; items?: EstimateItemRef[] } | null;
        setEstimateLock(body ? { lockedAt: body.lockedAt } : null);
        setEstimateItemsForLink(body?.items ?? []);
      }
    } catch {
      // non-fatal — summary/lock are decorative
    }
  }, [authFetch, id]);

  useEffect(() => {
    void reload();
    void loadEstimate();
  }, [reload, loadEstimate]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<Tab>).detail;
      if (detail === "overview" || detail === "estimate" || detail === "documents" || detail === "drafted") {
        setTab(detail);
      }
    };
    window.addEventListener("tender-detail:switch-tab", handler);
    return () => window.removeEventListener("tender-detail:switch-tab", handler);
  }, []);

  const requestDraft = useCallback(
    async (correction: string | null) => {
      if (!tender) return;
      setDrafting(true);
      setError(null);
      try {
        const response = await authFetch(`/tenders/${tender.id}/draft-scope`, {
          method: "POST",
          body: JSON.stringify(correction ? { correction } : {})
        });
        if (!response.ok) {
          if (response.status === 412) {
            setPendingCorrection(correction);
            setKeyModalOpen(true);
            return;
          }
          throw new Error(await response.text());
        }
        const body = (await response.json()) as DraftResult;
        setDraftResult(body);
        setDraftBadge("new");
        setTab("drafted");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setDrafting(false);
      }
    },
    [authFetch, tender]
  );

  const probabilityBucket = bucketForProbability(tender?.probability);

  const setProbabilityBucket = async (bucket: ProbabilityBucket) => {
    if (!tender) return;
    setPosting(true);
    try {
      const response = await authFetch(`/tenders/${tender.id}/probability`, {
        method: "PATCH",
        body: JSON.stringify({ probability: valueForBucket(bucket) })
      });
      if (!response.ok) throw new Error("Could not update probability.");
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPosting(false);
    }
  };

  const duplicateTender = async () => {
    if (!tender) return;
    setDuplicating(true);
    try {
      const response = await authFetch(`/tenders/${tender.id}/duplicate`, { method: "POST" });
      if (!response.ok) throw new Error("Could not duplicate tender.");
      const copy = (await response.json()) as { id: string };
      navigate(`/tenders/${copy.id}`);
    } catch (err) {
      setError((err as Error).message);
      setDuplicating(false);
    }
  };

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
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span
              className="s7-badge"
              style={{
                background: `color-mix(in srgb, ${stageAccent} 15%, transparent)`,
                color: stageAccent
              }}
            >
              {stageLabel}
            </span>
            {canManageTenders ? (
              <button
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => void duplicateTender()}
                disabled={duplicating}
              >
                {duplicating ? "Duplicating…" : "Duplicate"}
              </button>
            ) : null}
          </div>
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
          {draftResult ? (
            <button
              type="button"
              role="tab"
              aria-selected={tab === "drafted"}
              className={
                (tab === "drafted"
                  ? "tender-detail__tab tender-detail__tab--active"
                  : "tender-detail__tab") +
                (draftBadge === "new" ? " tender-detail__tab--pulse" : "")
              }
              onClick={() => {
                setTab("drafted");
                setDraftBadge((prev) => (prev === "new" ? "reviewed" : prev));
              }}
            >
              Drafted Scope {draftBadge === "reviewed" ? "✓" : "✨"}
            </button>
          ) : null}
        </nav>

        {tab === "overview" && (
          <div className="tender-detail__sections">
            {estimateSummary && estimateSummary.estimateId ? (
              <section className="s7-card">
                <div className="tender-detail__section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Estimate breakdown</h3>
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    onClick={() => setTab("estimate")}
                  >
                    Open estimate →
                  </button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 12 }}>
                  <div>
                    <p className="s7-type-label">Scope items</p>
                    <strong style={{ fontSize: 20 }}>{estimateSummary.items.length}</strong>
                  </div>
                  <div>
                    <p className="s7-type-label">Labour</p>
                    <strong>{formatNumber(estimateSummary.totals.labour)}</strong>
                  </div>
                  <div>
                    <p className="s7-type-label">Equip & sub</p>
                    <strong>{formatNumber(estimateSummary.totals.equip)}</strong>
                  </div>
                  <div>
                    <p className="s7-type-label">Plant</p>
                    <strong>{formatNumber(estimateSummary.totals.plant)}</strong>
                  </div>
                  <div>
                    <p className="s7-type-label">Disposal</p>
                    <strong>{formatNumber(estimateSummary.totals.waste)}</strong>
                  </div>
                  <div>
                    <p className="s7-type-label">Cutting</p>
                    <strong>{formatNumber(estimateSummary.totals.cutting)}</strong>
                  </div>
                  <div>
                    <p className="s7-type-label">Tender price</p>
                    <strong style={{ fontSize: 20, color: "var(--brand-accent, #FEAA6D)" }}>{formatNumber(estimateSummary.totals.price)}</strong>
                  </div>
                </div>
              </section>
            ) : null}

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
          <TenderDocumentsPanel
            tenderId={tender.id}
            documents={tender.tenderDocuments}
            onDocumentsChanged={() => void reload()}
            canManage={canManageTenders}
            onDraftRequest={() => {
              if (draftResult) {
                setTab("drafted");
                return;
              }
              void requestDraft(null);
            }}
            drafting={drafting}
            draftBadgeState={draftBadge}
          />
        )}

        {tab === "drafted" && draftResult ? (
          <DraftedScopePanel
            tenderId={tender.id}
            draft={draftResult}
            estimateItems={estimateItemsForLink}
            onReDraft={(correction) => void requestDraft(correction)}
            onClear={() => {
              setDraftResult(null);
              setDraftBadge("none");
              setTab("overview");
            }}
            onImported={(count) => {
              setDraftBadge("reviewed");
              void loadEstimate();
              void reload();
              window.alert(`${count} item${count === 1 ? "" : "s"} imported into estimate`);
              setTab("estimate");
              window.dispatchEvent(new CustomEvent("tender-detail:estimate-pulse"));
            }}
            drafting={drafting}
            canManage={canManageTenders}
          />
        ) : null}

      </div>

      <aside className="tender-detail__rail">
        <section className="s7-card tender-detail__rail-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Snapshot</h3>
          <dl className="tender-detail__dl">
            <div><dt>Stage</dt><dd>{stageLabel}</dd></div>
            <div><dt>Value</dt><dd>{formatCurrency(tender.estimatedValue)}</dd></div>
            <div>
              <dt>Probability</dt>
              <dd>
                {canManageTenders ? (
                  <select
                    value={probabilityBucket}
                    onChange={(e) => void setProbabilityBucket(e.target.value as ProbabilityBucket)}
                    disabled={posting}
                    style={{
                      background: PROBABILITY_BADGE_STYLE[probabilityBucket].background,
                      color: PROBABILITY_BADGE_STYLE[probabilityBucket].color,
                      border: "none",
                      borderRadius: 999,
                      padding: "4px 28px 4px 12px",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: posting ? "default" : "pointer",
                      appearance: "none",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                      backgroundImage:
                        "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%230F172A' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'><path d='M6 9l6 6 6-6'/></svg>\")",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                      backgroundSize: "10px"
                    }}
                  >
                    <option value="hot">Hot</option>
                    <option value="warm">Warm</option>
                    <option value="cold">Cold</option>
                    <option value="unknown">Not set</option>
                  </select>
                ) : (
                  <span
                    style={{
                      background: PROBABILITY_BADGE_STYLE[probabilityBucket].background,
                      color: PROBABILITY_BADGE_STYLE[probabilityBucket].color,
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 13,
                      fontWeight: 600
                    }}
                  >
                    {PROBABILITY_LABEL[probabilityBucket]}
                  </span>
                )}
              </dd>
            </div>
            <div><dt>Due</dt><dd>{formatDate(tender.dueDate)}</dd></div>
            <div><dt>Proposed start</dt><dd>{formatDate(tender.proposedStartDate)}</dd></div>
            <div><dt>Last activity</dt><dd>{formatDateTime(tender.updatedAt)}</dd></div>
          </dl>
        </section>

        <section className="s7-card tender-detail__rail-card">
          <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Rate snapshot</h3>
          {estimateSummary && estimateSummary.estimateId ? (
            estimateLock && estimateLock.lockedAt ? (
              <div>
                <span className="s7-badge" style={{ background: "#D1FAE5", color: "#065F46" }}>
                  Rates locked
                </span>
                <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 13 }}>
                  Locked {formatDateTime(estimateLock.lockedAt)}. Editing rates in the library will not change this quote.
                </p>
              </div>
            ) : (
              <div>
                <span className="s7-badge" style={{ background: "#FEAA6D", color: "#3E1C00" }}>
                  Using live rates
                </span>
                <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 13 }}>
                  This estimate reads the current rate library. Lock when submitting to freeze.
                </p>
              </div>
            )
          ) : (
            <p style={{ color: "var(--text-muted)" }}>No estimate created yet.</p>
          )}
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
            <ul className="tender-detail__clients" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {tender.tenderClients.map((tc) => (
                <ExpandableClientRow
                  key={tc.id}
                  tenderId={tender.id}
                  clientId={tc.client.id}
                  clientName={tc.client.name}
                  contact={tc.contact ?? null}
                  relationshipType={tc.relationshipType ?? null}
                  isAwarded={tc.isAwarded}
                  contractIssued={tc.contractIssued}
                  canManage={canManageTenders}
                />
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

      <AnthropicKeyModal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        onSaved={() => {
          setKeyModalOpen(false);
          void requestDraft(pendingCorrection);
          setPendingCorrection(null);
        }}
      />
    </div>
  );
}

function ExpandableClientRow({
  tenderId,
  clientId,
  clientName,
  contact,
  relationshipType,
  isAwarded,
  contractIssued,
  canManage
}: {
  tenderId: string;
  clientId: string;
  clientName: string;
  contact: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  relationshipType: string | null;
  isAwarded: boolean;
  contractIssued: boolean;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <li className="tender-detail__client-row">
      <button
        type="button"
        className="tender-detail__client-header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        style={{ background: "transparent", border: "none", width: "100%", padding: 0, textAlign: "left", color: "inherit" }}
      >
        <span className="tender-detail__client-caret" aria-hidden>{expanded ? "▾" : "▸"}</span>
        <span>
          <strong>{clientName}</strong>
          {relationshipType ? <span className="tender-detail__client-tag" style={{ marginLeft: 6 }}>{relationshipType}</span> : null}
          {isAwarded ? <span className="s7-badge s7-badge--active" style={{ marginLeft: 6 }}>Awarded</span> : null}
          {contractIssued ? <span className="s7-badge s7-badge--info" style={{ marginLeft: 6 }}>Contract</span> : null}
        </span>
        <span />
      </button>
      {expanded ? (
        <div style={{ marginTop: 8 }}>
          {contact ? (
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <strong style={{ color: "inherit" }}>
                {contact.firstName} {contact.lastName}
              </strong>
              {contact.email ? (
                <div>
                  <a href={`mailto:${contact.email}`}>{contact.email}</a>
                </div>
              ) : null}
            </div>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>No contact on file.</p>
          )}
          <TenderClientNotesSection tenderId={tenderId} clientId={clientId} canManage={canManage} />
        </div>
      ) : null}
    </li>
  );
}
