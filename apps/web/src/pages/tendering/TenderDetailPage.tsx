import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { QuoteTab } from "./QuoteTab";
import { AddClientModal } from "./AddClientModal";
import { TenderDocumentsPanel } from "./TenderDocumentsPanel";
import { CorrespondencePanel } from "../../components/correspondence/CorrespondencePanel";
import { TenderEntriesPanel } from "./TenderEntriesPanel";
import { TeamEstimatorPanel } from "./TeamEstimatorPanel";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";
import { ConvertToProjectModal } from "./ConvertToProjectModal";
import { ScopeCardsTab } from "./scope-cards/ScopeCardsTab";
import { RatesTab } from "./RatesTab";
import { AssumptionsExclusionsFloatingEditor } from "./AssumptionsExclusionsFloatingEditor";
import { AssistPanel, useCanUseAssist } from "../../components/AssistPanel";
import { RecordHistory } from "../../components/RecordHistory";

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
  assignedEstimatorId?: string | null;
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

import { TENDER_STATUS_LABEL as STAGE_LABEL, TENDER_STATUS_ACCENT as STAGE_ACCENT } from "./tenderStatusLabels";

type Tab = "overview" | "scope" | "rates" | "quote" | "history";

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
  const location = useLocation();
  const { authFetch, user } = useAuth();

  const tab: Tab = useMemo(() => {
    if (location.pathname.endsWith("/scope")) return "scope";
    if (location.pathname.endsWith("/rates")) return "rates";
    if (location.pathname.endsWith("/quote")) return "quote";
    if (location.pathname.endsWith("/history")) return "history";
    return "overview";
  }, [location.pathname]);

  const canManageTenders = useMemo(() => can(user, "tenders.manage"), [user]);
  const canManageEstimates = useMemo(() => can(user, "estimates.manage"), [user]);
  const canAdminEstimates = useMemo(() => can(user, "estimates.admin"), [user]);
  const canConvertTender = useMemo(() => can(user, "tenderconversion.manage"), [user]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [tender, setTender] = useState<TenderDetail | null>(null);
  const [estimateSummary, setEstimateSummary] = useState<EstimateSummaryPayload | null>(null);
  const [estimateLock, setEstimateLock] = useState<EstimateLockInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [clientMsg, setClientMsg] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletePreflight, setDeletePreflight] = useState<{ _count: Record<string, number> } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [aeEditorOpen, setAeEditorOpen] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const canUseAssist = useCanUseAssist();
  // G5 — "Mark as new revision" confirm flow.
  const [bumpOpen, setBumpOpen] = useState(false);
  const [bumpReason, setBumpReason] = useState("");
  const [bumpBusy, setBumpBusy] = useState(false);
  const [bumpError, setBumpError] = useState<string | null>(null);
  const [bumpToast, setBumpToast] = useState<string | null>(null);

  // Alt+A toggles the Assumptions & Exclusions floating editor (not on Quote tab)
  const aeEditorOpenRef = useRef(aeEditorOpen);
  aeEditorOpenRef.current = aeEditorOpen;
  useEffect(() => {
    if (tab === "quote") return;
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey || e.key.toLowerCase() !== "a") return;
      e.preventDefault();
      setAeEditorOpen((o) => !o);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [tab]);

  // Close the editor when navigating to the Quote tab
  useEffect(() => {
    if (tab === "quote") setAeEditorOpen(false);
  }, [tab]);

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
      if (!id) return;
      if (detail === "scope") navigate(`/tenders/${id}/scope`);
      else if (detail === "rates") navigate(`/tenders/${id}/rates`);
      else if (detail === "quote") navigate(`/tenders/${id}/quote`);
      else if (detail === "history") navigate(`/tenders/${id}/history`);
      else if (detail === "overview") navigate(`/tenders/${id}`);
    };
    window.addEventListener("tender-detail:switch-tab", handler);
    return () => window.removeEventListener("tender-detail:switch-tab", handler);
  }, [id, navigate]);

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

  const changeStatus = async (next: string) => {
    if (!tender || tender.status === next) return;
    setStatusUpdating(true);
    try {
      const response = await authFetch(`/tenders/${tender.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next })
      });
      if (!response.ok) throw new Error(await response.text());
      await reload();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatusUpdating(false);
    }
  };

  const startDeleteTender = async () => {
    if (!tender) return;
    setDeleteConfirmOpen(true);
    setDeletePreflight(null);
    try {
      const res = await authFetch(`/tenders/${tender.id}/delete-preflight`);
      if (res.ok) setDeletePreflight(await res.json());
    } catch {
      /* best-effort */
    }
  };

  const confirmDeleteTender = async () => {
    if (!tender) return;
    setDeleteBusy(true);
    try {
      const res = await authFetch(`/tenders/${tender.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      navigate("/tenders");
    } catch (err) {
      setError((err as Error).message);
      setDeleteBusy(false);
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

  // G5 — "Mark as new revision" bumps Rev{N} on the canonical tender number.
  const bumpRevision = async () => {
    if (!tender) return;
    setBumpBusy(true);
    setBumpError(null);
    try {
      const response = await authFetch(`/tenders/${tender.id}/bump-revision`, {
        method: "POST",
        body: JSON.stringify(bumpReason.trim() ? { reason: bumpReason.trim() } : {})
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? "Could not bump the revision.");
      }
      const updated = (await response.json()) as { tenderNumber: string };
      setBumpOpen(false);
      setBumpReason("");
      setBumpToast(`Tender is now ${updated.tenderNumber}`);
      await reload();
    } catch (err) {
      setBumpError((err as Error).message);
    } finally {
      setBumpBusy(false);
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

  const stageLabel = (STAGE_LABEL as Record<string, string>)[tender.status] ?? tender.status;
  const stageAccent = (STAGE_ACCENT as Record<string, string>)[tender.status] ?? "var(--text-muted)";

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
              <select
                aria-label="Change tender status"
                className="s7-input"
                value={tender.status}
                disabled={statusUpdating}
                onChange={(e) => void changeStatus(e.target.value)}
                style={{ padding: "4px 8px", fontSize: 13, height: 30 }}
              >
                {Object.entries(STAGE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            ) : null}
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
            {canManageTenders ? (
              <button
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => {
                  setBumpError(null);
                  setBumpReason("");
                  setBumpOpen(true);
                }}
              >
                Mark as new revision
              </button>
            ) : null}
            {canManageTenders ? (
              <button
                type="button"
                className="s7-btn s7-btn--sm"
                style={{ color: "#DC2626", borderColor: "#FCA5A5" }}
                onClick={() => void startDeleteTender()}
                disabled={deleteBusy}
              >
                Delete
              </button>
            ) : null}
            {canConvertTender && tender.status === "CONTRACT_ISSUED" ? (
              <button
                type="button"
                className="s7-btn s7-btn--primary s7-btn--sm"
                onClick={() => setConvertOpen(true)}
              >
                Convert to project →
              </button>
            ) : null}
            {canUseAssist ? (
              <button
                type="button"
                className="s7-btn s7-btn--secondary s7-btn--sm"
                onClick={() => setAssistOpen(true)}
                title="Summarise, draft, or explain — powered by your configured AI provider"
              >
                AI assist
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
            onClick={() => navigate(`/tenders/${id}`)}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "scope"}
            className={tab === "scope" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => navigate(`/tenders/${id}/scope`)}
          >
            Scope of Works
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rates"}
            className={tab === "rates" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => navigate(`/tenders/${id}/rates`)}
          >
            Rates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "quote"}
            className={tab === "quote" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => navigate(`/tenders/${id}/quote`)}
          >
            Quote
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "history"}
            className={tab === "history" ? "tender-detail__tab tender-detail__tab--active" : "tender-detail__tab"}
            onClick={() => navigate(`/tenders/${id}/history`)}
          >
            History
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

              <TeamEstimatorPanel
                tenderId={tender.id}
                assignedEstimatorId={tender.assignedEstimatorId ?? null}
                canManage={canManageTenders}
              />
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
              />
            </section>

            <section className="s7-card">
              <CorrespondencePanel ownerKind="tender" ownerId={tender.id} />
            </section>

            {estimateSummary && estimateSummary.estimateId ? (
              <section className="s7-card">
                <div className="tender-detail__section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 className="s7-type-section-heading" style={{ margin: 0 }}>Estimate breakdown</h3>
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    onClick={() => navigate(`/tenders/${id}/quote`)}
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

            {clientMsg ? (
              <p style={{ color: "var(--status-danger)", fontSize: 12, margin: "4px 0" }}>{clientMsg}</p>
            ) : null}
            <TenderEntriesPanel
              tenderId={tender.id}
              canManage={canManageTenders}
              canRemoveClients={canManageTenders && tender.tenderClients.length > 1}
              clients={tender.tenderClients.map((tc) => ({
                tenderClientId: tc.id,
                clientId: tc.client.id,
                name: tc.client.name,
                preferenceScore: tc.client.preferenceScore ?? null,
                relationshipType: tc.relationshipType ?? null,
                isAwarded: tc.isAwarded,
                contractIssued: tc.contractIssued,
                winCount: tc.client.winCount ?? 0,
                tenderCount: tc.client.tenderCount ?? 0,
                winRate: tc.client.winRate ?? null,
                contact: tc.contact ?? null
              }))}
              onAddClient={() => setAddClientOpen(true)}
              onScoreChange={async (clientId, next) => {
                const tc = tender.tenderClients.find((row) => row.client.id === clientId);
                if (!tc) return;
                try {
                  const response = await authFetch(`/master-data/clients/${clientId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ name: tc.client.name, preferenceScore: next })
                  });
                  if (!response.ok) throw new Error(await response.text());
                  setClientMsg(null);
                  await reload();
                } catch (err) {
                  setClientMsg((err as Error).message);
                }
              }}
              onRemoveClient={async (clientId) => {
                const tc = tender.tenderClients.find((row) => row.client.id === clientId);
                if (!tc) return;
                if (tender.tenderClients.length <= 1) {
                  setClientMsg("A tender must have at least one client.");
                  return;
                }
                if (!window.confirm(`Remove ${tc.client.name} from this tender?`)) return;
                try {
                  const response = await authFetch(`/tenders/${tender.id}/clients/${clientId}`, {
                    method: "DELETE"
                  });
                  if (!response.ok) throw new Error(await response.text());
                  setClientMsg(null);
                  await reload();
                } catch (err) {
                  setClientMsg((err as Error).message);
                }
              }}
            />
          </div>
        )}

        {tab === "scope" && (
          <ScopeCardsTab tenderId={tender.id} tenderTitle={tender.title} />
        )}

        {tab === "rates" && (
          <RatesTab tenderId={tender.id} canManage={canManageTenders} />
        )}

        {tab === "quote" && (
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

        {tab === "history" && (
          <RecordHistory entityType="Tender" entityId={tender.id} />
        )}

      </div>

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

      {bumpOpen ? (
        <div
          className="slide-over-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Mark as new revision"
          onClick={() => setBumpOpen(false)}
        >
          <div className="slide-over" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 420 }}>
            <header className="slide-over__header">
              <div>
                <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Mark as new revision</h2>
                <p className="slide-over__subtitle">
                  {tender.tenderNumber} will become Rev{" "}
                  {/* next rev is server-computed; this is informational */}
                  {(tender.tenderNumber.match(/-Rev(\d+)/) ? Number(tender.tenderNumber.match(/-Rev(\d+)/)![1]) + 1 : 2)}.
                  The tender itself is unchanged — only its number moves.
                </p>
              </div>
            </header>
            <div className="slide-over__body tender-form">
              {bumpError ? <div className="login-card__error" role="alert">{bumpError}</div> : null}
              <label className="tender-form__field">
                <span className="s7-type-label">Reason (optional, recorded in the audit log)</span>
                <input
                  className="s7-input"
                  value={bumpReason}
                  onChange={(event) => setBumpReason(event.target.value)}
                  placeholder="e.g. Client issued amended scope"
                />
              </label>
              <footer className="slide-over__footer">
                <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setBumpOpen(false)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="s7-btn s7-btn--primary"
                  onClick={() => void bumpRevision()}
                  disabled={bumpBusy}
                >
                  {bumpBusy ? "Bumping…" : "Mark as new revision"}
                </button>
              </footer>
            </div>
          </div>
        </div>
      ) : null}

      {bumpToast ? (
        <div
          role="status"
          style={{
            position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 70,
            background: "var(--surface-raised, #1f2937)", color: "var(--text-primary, #fff)",
            padding: "10px 16px", borderRadius: 8, boxShadow: "0 2px 8px rgba(0,0,0,0.25)"
          }}
          onAnimationEnd={() => setBumpToast(null)}
        >
          {bumpToast}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setBumpToast(null)}
            style={{ marginLeft: 12, background: "none", border: "none", color: "inherit", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      ) : null}

      {deleteConfirmOpen && tender ? (
        <ConfirmDeleteDialog
          entityType="tender"
          entityRef={tender.tenderNumber}
          status={tender.status}
          cascadeCounts={deletePreflight?._count}
          busy={deleteBusy}
          onConfirm={() => void confirmDeleteTender()}
          onCancel={() => { setDeleteConfirmOpen(false); setDeletePreflight(null); }}
        />
      ) : null}

      {/* Floating Assumptions & Exclusions button — visible on Overview + SoW, hidden on Quote */}
      {tab !== "quote" && tender && !aeEditorOpen && (
        <button
          onClick={() => setAeEditorOpen(true)}
          title="Assumptions & Exclusions (Alt+A)"
          aria-label="Open Assumptions & Exclusions editor"
          style={{
            position: "fixed", top: 16, right: 16, zIndex: 65,
            width: 40, height: 40, borderRadius: "50%",
            background: "var(--brand-primary, #2563eb)", color: "#fff",
            border: "none", cursor: "pointer", fontSize: 18, fontWeight: 700,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}
        >A</button>
      )}

      {/* Floating editor panel */}
      {aeEditorOpen && tender && (
        <AssumptionsExclusionsFloatingEditor
          tenderId={tender.id}
          onClose={() => setAeEditorOpen(false)}
          readOnly={!canManageTenders}
        />
      )}

      <AssistPanel
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        surface="tender"
        subject={tender ? `${tender.tenderNumber} — ${tender.title}` : undefined}
        getContext={() => buildTenderAssistContext(tender)}
      />
    </div>
  );
}

// Serialises the tender's visible fields into a compact plain-text block
// the AI can reason over. Kept text-only on purpose — the /assist
// endpoint enforces a 12000-char cap and rendering markdown/HTML in the
// panel would tempt the model to structure output for a richer surface
// than we provide.
function buildTenderAssistContext(tender: TenderDetail | null): string {
  if (!tender) return "";
  const lines: string[] = [];
  lines.push(`Tender: ${tender.tenderNumber} — ${tender.title}`);
  lines.push(`Status: ${tender.status}`);
  if (tender.description) lines.push(`Description: ${tender.description}`);
  if (tender.estimatedValue) lines.push(`Estimated value: ${tender.estimatedValue}`);
  if (typeof tender.probability === "number") {
    lines.push(`Probability: ${tender.probability}%`);
  }
  if (tender.dueDate) lines.push(`Due date: ${tender.dueDate}`);
  if (tender.proposedStartDate) lines.push(`Proposed start: ${tender.proposedStartDate}`);
  if (tender.estimator) {
    lines.push(`Estimator: ${tender.estimator.firstName} ${tender.estimator.lastName}`);
  }
  if (tender.tenderClients.length > 0) {
    lines.push(
      `Clients: ${tender.tenderClients.map((c) => c.client.name).join("; ")}`
    );
  }
  if (tender.notes) lines.push(`Notes: ${tender.notes}`);
  if (tender.clarifications.length > 0) {
    lines.push(
      `Open clarifications: ${tender.clarifications
        .filter((c) => c.status !== "CLOSED")
        .map((c) => c.subject)
        .join("; ") || "(none open)"}`
    );
  }
  return lines.join("\n");
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
