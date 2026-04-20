import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type TenderListItem = {
  id: string;
  tenderNumber: string;
  title: string;
  description?: string | null;
  status: string;
  dueDate?: string | null;
  estimatedValue?: string | null;
  updatedAt: string;
  estimator?: { id: string; firstName: string; lastName: string } | null;
  tenderClients: Array<{
    id: string;
    clientId: string;
    client: { id: string; name: string };
  }>;
};

type TenderListResponse = {
  items: TenderListItem[];
  total: number;
  page: number;
  pageSize: number;
};

const STAGES = ["DRAFT", "IN_PROGRESS", "SUBMITTED", "AWARDED", "LOST", "WITHDRAWN"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  DRAFT: "Identified",
  IN_PROGRESS: "In Progress",
  SUBMITTED: "Submitted",
  AWARDED: "Awarded",
  LOST: "Lost",
  WITHDRAWN: "Withdrawn"
};

const STAGE_ACCENT: Record<Stage, string> = {
  DRAFT: "var(--status-neutral, #6B7280)",
  IN_PROGRESS: "var(--status-info, #3B82F6)",
  SUBMITTED: "var(--status-warning, #F59E0B)",
  AWARDED: "var(--status-active, #1D9E75)",
  LOST: "var(--status-danger, #EF4444)",
  WITHDRAWN: "var(--text-muted, #9CA3AF)"
};

type View = "pipeline" | "register";

function initials(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return "??";
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase();
}

function daysSince(iso?: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  const now = Date.now();
  const days = Math.max(0, Math.floor((now - then) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

function formatCurrency(raw?: string | null): string {
  if (!raw) return "—";
  const value = Number(raw);
  if (Number.isNaN(value)) return raw;
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  }).format(value);
}

export function TenderingPage() {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<View>("pipeline");
  const [tenders, setTenders] = useState<TenderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<"" | Stage>("");
  const [sortKey, setSortKey] = useState<"updatedAt" | "dueDate" | "estimatedValue" | "tenderNumber">("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await authFetch("/tenders?page=1&pageSize=100");
      if (!response.ok) throw new Error("Could not load tenders.");
      const data = (await response.json()) as TenderListResponse;
      setTenders(data.items);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, [authFetch]);

  const byStage = useMemo(() => {
    const groups: Record<Stage, TenderListItem[]> = {
      DRAFT: [],
      IN_PROGRESS: [],
      SUBMITTED: [],
      AWARDED: [],
      LOST: [],
      WITHDRAWN: []
    };
    for (const tender of tenders) {
      if ((STAGES as readonly string[]).includes(tender.status)) {
        groups[tender.status as Stage].push(tender);
      }
    }
    return groups;
  }, [tenders]);

  const registerRows = useMemo(() => {
    const filtered = tenders.filter((tender) => {
      if (stageFilter && tender.status !== stageFilter) return false;
      if (search) {
        const needle = search.toLowerCase();
        const hay = [
          tender.tenderNumber,
          tender.title,
          tender.tenderClients.map((tc) => tc.client.name).join(" ")
        ].join(" ").toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "updatedAt") {
        return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * dir;
      }
      if (sortKey === "dueDate") {
        const aDate = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        const bDate = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        return (aDate - bDate) * dir;
      }
      if (sortKey === "estimatedValue") {
        return ((Number(a.estimatedValue ?? 0)) - (Number(b.estimatedValue ?? 0))) * dir;
      }
      return a.tenderNumber.localeCompare(b.tenderNumber) * dir;
    });
    return sorted;
  }, [tenders, search, stageFilter, sortKey, sortDir]);

  const moveTender = async (tenderId: string, toStage: Stage) => {
    // Optimistic update
    setTenders((current) =>
      current.map((tender) => (tender.id === tenderId ? { ...tender, status: toStage } : tender))
    );
    try {
      const response = await authFetch(`/tenders/${tenderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: toStage })
      });
      if (!response.ok) throw new Error("Could not update tender stage.");
    } catch (err) {
      setError((err as Error).message);
      void reload();
    }
  };

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="tender-page">
      <header className="tender-page__header">
        <div>
          <p className="s7-type-label">Tendering</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Pipeline</h1>
        </div>
        <div className="tender-page__header-actions">
          <div className="tender-page__view-toggle" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={view === "pipeline"}
              className={view === "pipeline" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("pipeline")}
            >
              Pipeline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "register"}
              className={view === "register" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
              onClick={() => setView("register")}
            >
              Register
            </button>
          </div>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            onClick={() => setNewOpen(true)}
          >
            + New tender
          </button>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      {view === "pipeline" ? (
        <div className="tender-kanban">
          {STAGES.map((stage) => {
            const items = byStage[stage];
            const total = items.reduce((sum, tender) => sum + Number(tender.estimatedValue ?? 0), 0);
            return (
              <KanbanColumn
                key={stage}
                stage={stage}
                items={items}
                total={total}
                loading={loading}
                onDrop={moveTender}
                onOpen={(id) => navigate(`/tenders/${id}`)}
              />
            );
          })}
        </div>
      ) : (
        <div className="tender-register">
          <div className="tender-register__filters">
            <input
              className="s7-input"
              placeholder="Search by number, name, or client"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              className="s7-select"
              value={stageFilter}
              onChange={(event) => setStageFilter(event.target.value as Stage | "")}
            >
              <option value="">All stages</option>
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {STAGE_LABEL[stage]}
                </option>
              ))}
            </select>
          </div>
          <div className="s7-table-scroll">
            <table className="s7-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" className="tender-register__th-btn" onClick={() => toggleSort("tenderNumber")}>
                      Tender # {sortKey === "tenderNumber" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>Name</th>
                  <th>Client</th>
                  <th>
                    <button type="button" className="tender-register__th-btn" onClick={() => toggleSort("estimatedValue")}>
                      Value {sortKey === "estimatedValue" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>Stage</th>
                  <th>
                    <button type="button" className="tender-register__th-btn" onClick={() => toggleSort("dueDate")}>
                      Due {sortKey === "dueDate" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                  <th>Assignee</th>
                  <th>
                    <button type="button" className="tender-register__th-btn" onClick={() => toggleSort("updatedAt")}>
                      Last activity {sortKey === "updatedAt" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`row-skel-${index}`}>
                      {Array.from({ length: 8 }).map((__, col) => (
                        <td key={col}><Skeleton height={14} /></td>
                      ))}
                    </tr>
                  ))
                ) : registerRows.length === 0 ? (
                  <tr>
                    <td colSpan={8}>
                      <EmptyState
                        heading="No tenders yet"
                        subtext="Start tracking opportunities — the register fills in once you've created tenders."
                        action={
                          <button
                            type="button"
                            className="s7-btn s7-btn--primary"
                            onClick={() => setNewOpen(true)}
                          >
                            + New tender
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  registerRows.map((tender) => {
                    const clients = tender.tenderClients.map((tc) => tc.client.name).join(", ") || "—";
                    return (
                      <tr
                        key={tender.id}
                        className="s7-table__row--clickable"
                        onClick={() => navigate(`/tenders/${tender.id}`)}
                      >
                        <td><strong>{tender.tenderNumber}</strong></td>
                        <td>{tender.title}</td>
                        <td>{clients}</td>
                        <td>{formatCurrency(tender.estimatedValue)}</td>
                        <td>
                          <span className="s7-badge" style={{ background: `color-mix(in srgb, ${STAGE_ACCENT[tender.status as Stage] ?? "#6B7280"} 15%, transparent)`, color: STAGE_ACCENT[tender.status as Stage] ?? "#6B7280" }}>
                            {STAGE_LABEL[tender.status as Stage] ?? tender.status}
                          </span>
                        </td>
                        <td>{tender.dueDate ? new Date(tender.dueDate).toLocaleDateString() : "—"}</td>
                        <td>{tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : "—"}</td>
                        <td>{daysSince(tender.updatedAt)} ago</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <NewTenderSlideOver open={newOpen} onClose={() => setNewOpen(false)} onCreated={(id) => {
        setNewOpen(false);
        void reload();
        navigate(`/tenders/${id}`);
      }} />
    </div>
  );
}

type KanbanColumnProps = {
  stage: Stage;
  items: TenderListItem[];
  total: number;
  loading: boolean;
  onDrop: (tenderId: string, stage: Stage) => void;
  onOpen: (tenderId: string) => void;
};

function KanbanColumn({ stage, items, total, loading, onDrop, onOpen }: KanbanColumnProps) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={dragOver ? "tender-column tender-column--drag-over" : "tender-column"}
      onDragOver={(event) => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragOver(false);
        const tenderId = event.dataTransfer.getData("text/tender-id");
        if (tenderId) onDrop(tenderId, stage);
      }}
    >
      <header className="tender-column__header">
        <span className="tender-column__accent" style={{ background: STAGE_ACCENT[stage] }} aria-hidden />
        <span className="tender-column__title">{STAGE_LABEL[stage]}</span>
        <span className="tender-column__count">{items.length}</span>
        <span className="tender-column__total">{total > 0 ? formatCurrency(String(total)) : "—"}</span>
      </header>
      <div className="tender-column__body">
        {loading ? (
          Array.from({ length: 2 }).map((_, index) => (
            <div key={`col-skel-${stage}-${index}`} className="tender-card tender-card--skel">
              <Skeleton width="70%" height={14} />
              <Skeleton width="50%" height={12} style={{ marginTop: 8 }} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
            </div>
          ))
        ) : items.length === 0 ? (
          <p className="tender-column__empty">No tenders in this stage.</p>
        ) : (
          items.map((tender) => (
            <TenderCard key={tender.id} tender={tender} onOpen={() => onOpen(tender.id)} />
          ))
        )}
      </div>
    </div>
  );
}

type TenderCardProps = {
  tender: TenderListItem;
  onOpen: () => void;
};

function TenderCard({ tender, onOpen }: TenderCardProps) {
  const clients = tender.tenderClients.map((tc) => tc.client.name).join(", ");
  const assignee = tender.estimator ? `${tender.estimator.firstName} ${tender.estimator.lastName}` : null;
  return (
    <article
      className="tender-card"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData("text/tender-id", tender.id);
        event.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="tender-card__head">
        <span className="tender-card__number">{tender.tenderNumber}</span>
        {assignee ? (
          <span className="tender-card__avatar" title={assignee}>
            {initials(tender.estimator?.firstName, tender.estimator?.lastName)}
          </span>
        ) : null}
      </div>
      <h3 className="tender-card__title">{tender.title}</h3>
      {clients ? <p className="tender-card__meta">{clients}</p> : null}
      <div className="tender-card__footer">
        <span className="tender-card__value">{formatCurrency(tender.estimatedValue)}</span>
        <span className="tender-card__activity">{daysSince(tender.updatedAt)} since activity</span>
      </div>
    </article>
  );
}

type NewTenderSlideOverProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (tenderId: string) => void;
};

function NewTenderSlideOver({ open, onClose, onCreated }: NewTenderSlideOverProps) {
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    tenderNumber: "",
    title: "",
    description: "",
    estimatedValue: "",
    dueDate: "",
    status: "DRAFT"
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setForm({
        tenderNumber: "",
        title: "",
        description: "",
        estimatedValue: "",
        dueDate: "",
        status: "DRAFT"
      });
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.tenderNumber.trim() || !form.title.trim()) {
      setError("Tender number and title are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        tenderNumber: form.tenderNumber.trim(),
        title: form.title.trim(),
        status: form.status
      };
      if (form.description.trim()) payload.description = form.description.trim();
      if (form.estimatedValue.trim()) payload.estimatedValue = form.estimatedValue.trim();
      if (form.dueDate) payload.dueDate = new Date(form.dueDate).toISOString();
      const response = await authFetch("/tenders", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not create tender.");
      }
      const created = await response.json();
      onCreated(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="slide-over-overlay" role="dialog" aria-modal="true" aria-label="Create tender" onClick={onClose}>
      <div ref={panelRef} className="slide-over" onClick={(event) => event.stopPropagation()}>
        <header className="slide-over__header">
          <div>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>New tender</h2>
            <p className="slide-over__subtitle">Create a tender and drop it anywhere on the pipeline.</p>
          </div>
          <button type="button" className="slide-over__close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          </button>
        </header>
        <form onSubmit={submit} className="slide-over__body tender-form">
          {error ? <div className="login-card__error" role="alert">{error}</div> : null}
          <label className="tender-form__field">
            <span className="s7-type-label">Tender number</span>
            <input
              className="s7-input"
              value={form.tenderNumber}
              onChange={(event) => setForm((current) => ({ ...current, tenderNumber: event.target.value }))}
              placeholder="IS-T009"
              required
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Title</span>
            <input
              className="s7-input"
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Site civil works package"
              required
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Stage</span>
            <select
              className="s7-select"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
            >
              {STAGES.map((stage) => (
                <option key={stage} value={stage}>{STAGE_LABEL[stage]}</option>
              ))}
            </select>
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Estimated value (AUD)</span>
            <input
              className="s7-input"
              type="number"
              min="0"
              step="1"
              value={form.estimatedValue}
              onChange={(event) => setForm((current) => ({ ...current, estimatedValue: event.target.value }))}
              placeholder="0"
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Due date</span>
            <input
              className="s7-input"
              type="date"
              value={form.dueDate}
              onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
            />
          </label>
          <label className="tender-form__field">
            <span className="s7-type-label">Description</span>
            <textarea
              className="s7-textarea"
              rows={4}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Short scope summary"
            />
          </label>
          <footer className="slide-over__footer">
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting}>
              {submitting ? "Creating…" : "Create tender"}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}

