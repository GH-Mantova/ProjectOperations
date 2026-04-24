import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { QuoteTab } from "./QuoteTab";
import { AddClientModal } from "./AddClientModal";
import { TenderDocumentsPanel } from "./TenderDocumentsPanel";
import { TenderClientNotesSection } from "./TenderClientNotesSection";
import { TenderClarificationLog } from "./TenderClarificationLog";
import { AnthropicKeyModal } from "./AnthropicKeyModal";
import { AiProviderSelector, type AvailableProvider } from "../../components/ai/AiProviderSelector";
// NOTE: the Drafted Scope tab + panel are retired in PR #44 — AI draft items
// now land directly in the Scope of Works tab as status="draft" rows.
import { ConvertToProjectModal } from "./ConvertToProjectModal";
import { ScopeOfWorksTab } from "./ScopeOfWorksTab";
import { ClientStarRating } from "../../components/ClientStarRating";

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
  submittedAt?: string | null;
  ratesSnapshotAt?: string | null;
  createdAt: string;
  updatedAt: string;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    id: string;
    client: {
      id: string;
      name: string;
      preferenceScore?: number | null;
      winCount?: number | null;
      tenderCount?: number | null;
      winRate?: string | null;
    };
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

type Tab = "overview" | "scope" | "estimate";

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
  const canConvertTender = useMemo(
    () => user?.permissions.includes("tenderconversion.manage") ?? false,
    [user]
  );
  const [convertOpen, setConvertOpen] = useState(false);
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [estimateSummary, setEstimateSummary] = useState<EstimateSummaryPayload | null>(null);
  const [estimateLock, setEstimateLock] = useState<EstimateLockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [posting, setPosting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [newFollowUp, setNewFollowUp] = useState({ details: "", dueAt: "" });
  const [drafting, setDrafting] = useState(false);
  const [draftToast, setDraftToast] = useState<string | null>(null);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [pendingCorrection, setPendingCorrection] = useState<string | null>(null);
  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [pendingDraftCorrection, setPendingDraftCorrection] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientMsg, setClientMsg] = useState<string | null>(null);

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
        const body = (await estimateRes.json()) as { lockedAt: string | null } | null;
        setEstimateLock(body ? { lockedAt: body.lockedAt } : null);
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
      if (detail === "overview" || detail === "scope" || detail === "estimate") {
        setTab(detail);
      }
    };
    window.addEventListener("tender-detail:switch-tab", handler);
    return () => window.removeEventListener("tender-detail:switch-tab", handler);
  }, []);

  const runDraft = useCallback(
    async (correction: string | null, selectedProviderId: string | null) => {
      if (!tender) return;
      setDrafting(true);
      setError(null);
      try {
        const response = await authFetch(`/tenders/${tender.id}/draft-scope`, {
          method: "POST",
          body: JSON.stringify({
            ...(correction ? { correction } : {}),
            ...(selectedProviderId ? { selectedProviderId } : {})
          })
        });
        if (!response.ok) {
          if (response.status === 412) {
            setPendingCorrection(correction);
            setKeyModalOpen(true);
            return;
          }
          throw new Error(await response.text());
        }
        const body = (await response.json()) as {
          itemsCreated?: number;
          providerMeta?: { label: string; source: string };
        };
        const count = body.itemsCreated ?? 0;
        const who = body.providerMeta?.label ?? "AI";
        setDraftToast(
          count > 0
            ? `Generated by ${who} — ${count} scope item${count === 1 ? "" : "s"} in the Scope of Works tab.`
            : `Generated by ${who} — no new scope items.`
        );
        setTab("scope");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setDrafting(false);
      }
    },
    [authFetch, tender]
  );

  const requestDraft = useCallback(
    (correction: string | null) => {
      // Open the provider selector; it auto-picks when 0/1 providers are
      // available and shows the modal only when 2+ are configured.
      setPendingDraftCorrection(correction);
      setProviderPickerOpen(true);
    },
    []
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
            {canConvertTender && tender.status === "AWARDED" ? (
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => setConvertOpen(true)}
              >
                Convert to project →
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
            aria-selected={tab === "scope"}
            className={tab === "scope" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab("scope")}
          >
            Scope of Works
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "estimate"}
            className={tab === "estimate" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => setTab("estimate")}
          >
            Quote
          </button>
        </nav>

        {tab === "overview" && (
          <div className="tender-detail__sections">
            <section className="tender-detail__info-cards">
              <div className="tender-detail__info-card">
                <p className="s7-type-label">Stage</p>
                <div className="tender-detail__info-card-value">
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
              </div>
              <div className="tender-detail__info-card">
                <p className="s7-type-label">Value</p>
                <div className="tender-detail__info-card-value">{formatCurrency(tender.estimatedValue)}</div>
              </div>
              <div className="tender-detail__info-card">
                <p className="s7-type-label">Probability</p>
                <div className="tender-detail__info-card-value" style={{ display: "flex", alignItems: "center" }}>
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
                </div>
              </div>
              <div className="tender-detail__info-card">
                <p className="s7-type-label">Due date</p>
                <div className="tender-detail__info-card-value">{formatDate(tender.dueDate)}</div>
              </div>
              <div className="tender-detail__info-card">
                <p className="s7-type-label">Rate snapshot</p>
                <div className="tender-detail__info-card-value">
                  {estimateSummary && estimateSummary.estimateId ? (
                    estimateLock && estimateLock.lockedAt ? (
                      <span className="s7-badge" style={{ background: "#D1FAE5", color: "#065F46" }}>Locked</span>
                    ) : (
                      <span className="s7-badge" style={{ background: "#FEAA6D", color: "#3E1C00" }}>Live rates</span>
                    )
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 14 }}>No estimate yet</span>
                  )}
                </div>
              </div>
            </section>

            <div className="tender-detail__two-col">
              <section className="s7-card">
                <h3 className="s7-type-section-heading" style={{ marginTop: 0 }}>Description</h3>
                <InlineEditableText
                  value={tender.description ?? ""}
                  placeholder="No description recorded."
                  canEdit={canManageTenders}
                  rows={4}
                  onSave={async (next) => {
                    const response = await authFetch(`/tenders/${tender.id}/quick-edit`, {
                      method: "PATCH",
                      body: JSON.stringify({ description: next || null })
                    });
                    if (!response.ok) throw new Error(await response.text());
                    await reload();
                  }}
                />
                <h4 className="s7-type-card-title" style={{ marginTop: 12, marginBottom: 6 }}>Scope notes</h4>
                <InlineEditableText
                  value={tender.notes ?? ""}
                  placeholder="No scope notes yet."
                  canEdit={canManageTenders}
                  rows={3}
                  onSave={async (next) => {
                    const response = await authFetch(`/tenders/${tender.id}/quick-edit`, {
                      method: "PATCH",
                      body: JSON.stringify({ notes: next || null })
                    });
                    if (!response.ok) throw new Error(await response.text());
                    await reload();
                  }}
                />
              </section>

              <section className="s7-card">
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
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 6 }}>
                  <h4 className="s7-type-card-title" style={{ margin: 0 }}>Clients</h4>
                  {canManageTenders ? (
                    <button
                      type="button"
                      className="s7-btn s7-btn--ghost s7-btn--sm"
                      onClick={() => setAddClientOpen(true)}
                    >
                      + Add client
                    </button>
                  ) : null}
                </div>
                {clientMsg ? (
                  <p style={{ color: "var(--status-danger)", fontSize: 12, margin: "4px 0" }}>{clientMsg}</p>
                ) : null}
                {tender.tenderClients.length === 0 ? (
                  <p style={{ color: "var(--text-muted)" }}>No clients linked.</p>
                ) : (
                  <ul className="tender-detail__clients" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
                    {tender.tenderClients.map((tc) => {
                      const canRemove = canManageTenders && tender.tenderClients.length > 1;
                      return (
                        <ExpandableClientRow
                          key={tc.id}
                          tenderId={tender.id}
                          clientId={tc.client.id}
                          clientName={tc.client.name}
                          preferenceScore={tc.client.preferenceScore ?? null}
                          winCount={tc.client.winCount ?? 0}
                          tenderCount={tc.client.tenderCount ?? 0}
                          winRate={tc.client.winRate ?? null}
                          contact={tc.contact ?? null}
                          relationshipType={tc.relationshipType ?? null}
                          isAwarded={tc.isAwarded}
                          contractIssued={tc.contractIssued}
                          canManage={canManageTenders}
                          canManageClients={canManageTenders}
                          onScoreChange={async (next) => {
                            try {
                              const response = await authFetch(
                                `/master-data/clients/${tc.client.id}`,
                                {
                                  method: "PATCH",
                                  body: JSON.stringify({
                                    name: tc.client.name,
                                    preferenceScore: next
                                  })
                                }
                              );
                              if (!response.ok) throw new Error(await response.text());
                              await reload();
                            } catch (err) {
                              setClientMsg((err as Error).message);
                            }
                          }}
                          canRemove={canRemove}
                          onRemove={async () => {
                            if (!canRemove) {
                              setClientMsg("A tender must have at least one client.");
                              return;
                            }
                            if (!window.confirm(`Remove ${tc.client.name} from this tender?`)) return;
                            try {
                              const response = await authFetch(
                                `/tenders/${tender.id}/clients/${tc.client.id}`,
                                { method: "DELETE" }
                              );
                              if (!response.ok) throw new Error(await response.text());
                              setClientMsg(null);
                              await reload();
                            } catch (err) {
                              setClientMsg((err as Error).message);
                            }
                          }}
                        />
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

            <section className="s7-card">
              <div className="tender-detail__section-head">
                <h3 className="s7-type-section-heading" style={{ margin: 0 }}>
                  Documents ({tender.tenderDocuments.length})
                </h3>
              </div>
              <TenderDocumentsPanel
                tenderId={tender.id}
                documents={tender.tenderDocuments}
                onDocumentsChanged={() => void reload()}
                canManage={canManageTenders}
                onDraftRequest={() => void requestDraft(null)}
                drafting={drafting}
                draftBadgeState="none"
              />
            </section>

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

            <TenderClarificationLog
              tenderId={tender.id}
              canManage={canManageTenders}
              rfiItems={tender.clarifications}
              onRfiChanged={() => void reload()}
            />

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
                    <FollowUpRow
                      key={item.id}
                      item={item}
                      tenderId={tender.id}
                      canManage={canManageTenders}
                      onChanged={() => void reload()}
                    />
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}

        {tab === "scope" && (
          <ScopeOfWorksTab tenderId={tender.id} tenderTitle={tender.title} />
        )}

        {tab === "estimate" && (
          <QuoteTab
            tenderId={tender.id}
            tender={{
              tenderNumber: tender.tenderNumber,
              estimator: tender.estimator,
              ratesSnapshotAt: tender.ratesSnapshotAt ?? null,
              tenderClients: tender.tenderClients.map((tc) => ({
                id: tc.id,
                client: { id: tc.client.id, name: tc.client.name },
                contact: tc.contact ?? null
              }))
            }}
            canManage={canManageTenders}
          />
        )}

      </div>

      {draftToast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "#005B61",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            boxShadow: "0 6px 20px rgba(0,0,0,0.15)",
            zIndex: 100,
            maxWidth: 420
          }}
          onClick={() => setDraftToast(null)}
        >
          {draftToast}
        </div>
      ) : null}


      <AnthropicKeyModal
        open={keyModalOpen}
        onClose={() => setKeyModalOpen(false)}
        onSaved={() => {
          setKeyModalOpen(false);
          // After the admin-side key is saved, re-run with no override so the
          // resolver falls back through the company chain.
          void runDraft(pendingCorrection, null);
          setPendingCorrection(null);
        }}
      />

      {addClientOpen ? (
        <AddClientModal
          tenderId={tender.id}
          linkedClientIds={tender.tenderClients.map((tc) => tc.client.id)}
          onClose={() => setAddClientOpen(false)}
          onAdded={() => {
            setAddClientOpen(false);
            setClientMsg(null);
            void reload();
          }}
        />
      ) : null}

      {providerPickerOpen ? (
        <AiProviderSelector
          actionLabel="Draft scope"
          onCancel={() => {
            setProviderPickerOpen(false);
            setPendingDraftCorrection(null);
          }}
          onProviderSelected={(providerId: string | null, _meta?: AvailableProvider) => {
            setProviderPickerOpen(false);
            const correction = pendingDraftCorrection;
            setPendingDraftCorrection(null);
            void runDraft(correction, providerId);
          }}
        />
      ) : null}

      {convertOpen ? (
        <ConvertToProjectModal
          tender={{
            id: tender.id,
            tenderNumber: tender.tenderNumber,
            title: tender.title,
            estimatedValue: tender.estimatedValue,
            proposedStartDate: tender.proposedStartDate,
            tenderClients: tender.tenderClients.map((c) => ({
              client: c.client,
              isAwarded: c.isAwarded
            }))
          }}
          onClose={() => setConvertOpen(false)}
          onConverted={(result) => {
            setConvertOpen(false);
            navigate(`/projects/${result.projectId}`);
          }}
        />
      ) : null}
    </div>
  );
}

function ExpandableClientRow({
  tenderId,
  clientId,
  clientName,
  preferenceScore,
  winCount,
  tenderCount,
  winRate,
  contact,
  relationshipType,
  isAwarded,
  contractIssued,
  canManage,
  canManageClients,
  onScoreChange,
  canRemove,
  onRemove
}: {
  tenderId: string;
  clientId: string;
  clientName: string;
  preferenceScore: number | null;
  winCount: number;
  tenderCount: number;
  winRate: string | null;
  contact: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  relationshipType: string | null;
  isAwarded: boolean;
  contractIssued: boolean;
  canManage: boolean;
  canManageClients: boolean;
  onScoreChange: (score: number) => void;
  canRemove: boolean;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const winRateDisplay = winRate !== null && winRate !== undefined ? Number(winRate) : null;
  return (
    <li className="tender-detail__client-row" style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        className="tender-detail__client-header"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        style={{ background: "transparent", border: "none", width: "100%", padding: 0, paddingRight: canManage ? 24 : 0, textAlign: "left", color: "inherit" }}
      >
        <span className="tender-detail__client-caret" aria-hidden>{expanded ? "▾" : "▸"}</span>
        <span>
          <strong>{clientName}</strong>
          {relationshipType ? <span className="tender-detail__client-tag" style={{ marginLeft: 6 }}>{relationshipType}</span> : null}
          {isAwarded ? <span className="s7-badge s7-badge--active" style={{ marginLeft: 6 }}>Awarded</span> : null}
          {contractIssued ? <span className="s7-badge s7-badge--info" style={{ marginLeft: 6 }}>Contract</span> : null}
          <span style={{ marginLeft: 8, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ClientStarRating score={preferenceScore} readOnly size="sm" ariaLabel={`${clientName} preference`} />
            {tenderCount > 0 && winRateDisplay !== null ? (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {winRateDisplay.toFixed(0)}% win
              </span>
            ) : null}
          </span>
        </span>
        <span />
      </button>
      {canManage ? (
        <button
          type="button"
          aria-label={`Remove ${clientName}`}
          title={canRemove ? `Remove ${clientName}` : "A tender must have at least one client"}
          disabled={!canRemove}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          style={{
            position: "absolute",
            top: 4,
            right: 6,
            background: "transparent",
            border: "none",
            cursor: canRemove ? "pointer" : "not-allowed",
            color: "var(--text-muted)",
            fontSize: 18,
            lineHeight: 1,
            padding: "2px 6px",
            opacity: canRemove ? 1 : 0.4
          }}
        >
          ×
        </button>
      ) : null}
      {expanded ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Preference:</span>
              <ClientStarRating
                score={preferenceScore}
                readOnly={!canManageClients}
                onChange={canManageClients ? onScoreChange : undefined}
                ariaLabel={`${clientName} preference score`}
              />
            </div>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {tenderCount > 0 && winRateDisplay !== null
                ? `${winRateDisplay.toFixed(0)}% win rate (${winCount} won of ${tenderCount} quoted)`
                : "No tender history yet"}
            </span>
          </div>
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

function FollowUpRow({
  item,
  tenderId,
  canManage,
  onChanged
}: {
  item: TenderDetail["followUps"][number];
  tenderId: string;
  canManage: boolean;
  onChanged: () => void;
}) {
  const { authFetch } = useAuth();
  const [editing, setEditing] = useState(false);
  const [draftDetails, setDraftDetails] = useState(item.details);
  const [draftDue, setDraftDue] = useState(item.dueAt ? item.dueAt.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const isDone = item.status === "DONE";
  const dueTime = item.dueAt ? new Date(item.dueAt).getTime() : null;
  const isOverdue = !isDone && dueTime !== null && dueTime < Date.now();

  const activityPath = `/tenders/${tenderId}/activities/${encodeURIComponent(`follow-up:${item.id}`)}`;

  const saveEdit = async () => {
    if (!draftDetails.trim() || !draftDue) return;
    setBusy(true);
    try {
      const response = await authFetch(activityPath, {
        method: "PATCH",
        body: JSON.stringify({
          details: draftDetails.trim(),
          dueAt: new Date(draftDue).toISOString()
        })
      });
      if (!response.ok) throw new Error(await response.text());
      setEditing(false);
      onChanged();
    } catch {
      // swallow — parent shows the error via its own state
    } finally {
      setBusy(false);
    }
  };

  const toggleDone = async () => {
    setBusy(true);
    try {
      const response = await authFetch(activityPath, {
        method: "PATCH",
        body: JSON.stringify({ status: isDone ? "OPEN" : "DONE" })
      });
      if (!response.ok) throw new Error(await response.text());
      onChanged();
    } catch {
      // swallow
    } finally {
      setBusy(false);
    }
  };

  const pillStyle: React.CSSProperties = isDone
    ? { background: "#D1FAE5", color: "#065F46" }
    : isOverdue
      ? { background: "#FEE2E2", color: "#991B1B" }
      : { background: "#FEAA6D", color: "#3E1C00" };

  if (editing) {
    return (
      <li className="tender-followups__item" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <textarea
          autoFocus
          className="s7-input"
          rows={2}
          value={draftDetails}
          onChange={(e) => setDraftDetails(e.target.value)}
          style={{ width: "100%", resize: "vertical" }}
          disabled={busy}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <input
            className="s7-input s7-input--sm"
            type="date"
            value={draftDue}
            onChange={(e) => setDraftDue(e.target.value)}
            disabled={busy}
          />
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              onClick={() => {
                setDraftDetails(item.details);
                setDraftDue(item.dueAt ? item.dueAt.slice(0, 10) : "");
                setEditing(false);
              }}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              onClick={() => void saveEdit()}
              disabled={busy || !draftDetails.trim() || !draftDue}
            >
              Save
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li
      className="tender-followups__item"
      style={{ position: "relative", opacity: isDone ? 0.65 : 1 }}
    >
      <div className="tender-followups__head">
        <strong style={{ textDecoration: isDone ? "line-through" : "none" }}>{item.details}</strong>
        <span
          className="s7-badge"
          style={{ ...pillStyle, fontSize: 11, padding: "2px 8px" }}
        >
          {isDone ? "Done" : isOverdue ? "Overdue" : `Due ${formatDate(item.dueAt)}`}
        </span>
      </div>
      <span className="tender-followups__due">
        Due {formatDate(item.dueAt)}
        {item.assignedUser ? ` · ${item.assignedUser.firstName} ${item.assignedUser.lastName}` : ""}
      </span>
      {canManage ? (
        <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => setEditing(true)}
            disabled={busy}
            aria-label="Edit follow-up"
            title="Edit"
          >
            ✎ Edit
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            onClick={() => void toggleDone()}
            disabled={busy}
            aria-label={isDone ? "Reopen follow-up" : "Mark follow-up complete"}
            title={isDone ? "Reopen" : "Mark complete"}
          >
            {isDone ? "↺ Reopen" : "✓ Complete"}
          </button>
        </div>
      ) : null}
    </li>
  );
}

// Click-to-edit text block for free-form fields (description, notes). Shows
// the current value as a paragraph with a subtle hover affordance; clicking
// swaps in a textarea that saves on blur (or Enter-to-save / Esc-to-cancel).
// Errors surface inline rather than being thrown.
function InlineEditableText({
  value,
  placeholder,
  canEdit,
  rows = 3,
  onSave
}: {
  value: string;
  placeholder: string;
  canEdit: boolean;
  rows?: number;
  onSave: (next: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = async () => {
    if (draft.trim() === (value ?? "").trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return value ? (
      <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{value}</p>
    ) : (
      <p style={{ color: "var(--text-muted)", margin: 0 }}>{placeholder}</p>
    );
  }

  if (editing) {
    return (
      <div>
        <textarea
          autoFocus
          rows={rows}
          className="s7-input"
          style={{ width: "100%", resize: "vertical", minHeight: 80 }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              void commit();
            }
          }}
          disabled={saving}
        />
        {error ? <p style={{ color: "var(--status-danger)", fontSize: 12 }}>{error}</p> : null}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      title="Click to edit"
      style={{
        borderRadius: 4,
        padding: "2px 4px",
        margin: "0 -4px",
        cursor: "text",
        transition: "background 120ms"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-subtle, rgba(0,0,0,0.03))")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {value ? (
        <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{value}</p>
      ) : (
        <p style={{ color: "var(--text-muted)", margin: 0 }}>{placeholder}</p>
      )}
    </div>
  );
}
