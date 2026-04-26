import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

// ── Types ────────────────────────────────────────────────────────────────

type FormTemplate = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  category?: string | null;
  isSystemTemplate?: boolean;
  updatedAt: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: string;
    sections: Array<{ id: string; fields: Array<{ id: string }> }>;
  }>;
};

type Submission = {
  id: string;
  status: string;
  submittedAt?: string | null;
  updatedAt: string;
  submittedBy?: { id: string; firstName: string; lastName: string } | null;
  templateVersion: {
    id: string;
    versionNumber: number;
    template: { id: string; name: string; code: string; category?: string | null };
  };
  approvals?: Array<{
    id: string;
    stepNumber: number;
    status: string;
    dueAt?: string | null;
  }>;
};

type PendingApprovalRow = {
  id: string;
  submissionId: string;
  stepNumber: number;
  status: string;
  dueAt?: string | null;
  submission: Submission;
};

type Tab = "templates" | "my-submissions" | "approvals" | "analytics";

// ── Category palette ─────────────────────────────────────────────────────
// Each category gets a colour bar at the top of its template card and a pill
// badge on the row. Colours match project_instructions §10 brand tokens.

const CATEGORY_COLOUR: Record<string, string> = {
  safety: "#E74C3C",
  asbestos: "#E67E22",
  plant: "#3498DB",
  induction: "#005B61",
  environmental: "#27AE60",
  permits: "#8E44AD",
  quality: "#95A5A6",
  daily: "#F39C12",
  custom: "#2C3E50"
};

const CATEGORY_LABEL: Record<string, string> = {
  safety: "Safety",
  asbestos: "Asbestos",
  plant: "Plant",
  induction: "Induction",
  environmental: "Environmental",
  permits: "Permits",
  quality: "Quality",
  daily: "Daily",
  custom: "Custom"
};

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string }> = {
  draft: { bg: "#E2E8F0", fg: "#1F2937", label: "Draft" },
  submitted: { bg: "color-mix(in srgb, #3B82F6 18%, transparent)", fg: "#1D4ED8", label: "Submitted" },
  under_review: { bg: "color-mix(in srgb, #F59E0B 18%, transparent)", fg: "#B45309", label: "Under review" },
  approved: { bg: "#DCFCE7", fg: "#166534", label: "Approved" },
  rejected: { bg: "#FEE2E2", fg: "#B91C1C", label: "Rejected" }
};

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return "Just now";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ── Component ────────────────────────────────────────────────────────────

export function FormsListPage() {
  const { authFetch, user } = useAuth();
  const navigate = useNavigate();

  const canApprove = Boolean(user?.permissions?.includes("forms.approve") || user?.isSuperUser);
  const canManage = Boolean(user?.permissions?.includes("forms.manage") || user?.isSuperUser);

  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [approvals, setApprovals] = useState<PendingApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const requests: Array<Promise<Response>> = [
        authFetch("/forms/templates?page=1&pageSize=100"),
        authFetch("/forms/my-submissions")
      ];
      if (canApprove) requests.push(authFetch("/forms/pending-approvals"));
      const [tplRes, mineRes, approvalsRes] = await Promise.all(requests);
      if (!tplRes.ok) throw new Error(await tplRes.text());
      const tplBody = (await tplRes.json()) as { items: FormTemplate[] };
      setTemplates((tplBody.items ?? []).filter((t) => t.status === "ACTIVE"));
      if (mineRes.ok) {
        const body = await mineRes.json();
        setSubmissions(Array.isArray(body) ? body : (body.items ?? []));
      }
      if (canApprove && approvalsRes && approvalsRes.ok) {
        setApprovals((await approvalsRes.json()) as PendingApprovalRow[]);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, canApprove]);

  useEffect(() => {
    void load();
  }, [load]);

  const lastSubmittedByTemplate = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of submissions) {
      const tplId = s.templateVersion?.template?.id;
      const stamp = s.submittedAt ?? s.updatedAt;
      if (!tplId) continue;
      const prev = map.get(tplId);
      if (!prev || new Date(stamp).getTime() > new Date(prev).getTime()) {
        map.set(tplId, stamp);
      }
    }
    return map;
  }, [submissions]);

  const filteredTemplates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return templates.filter((t) => {
      if (category !== "all" && (t.category ?? "custom") !== category) return false;
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q)
      );
    });
  }, [templates, category, search]);

  const fillOut = async (templateId: string) => {
    setCreating(templateId);
    setError(null);
    try {
      const res = await authFetch("/forms/submissions", {
        method: "POST",
        body: JSON.stringify({ templateId })
      });
      if (!res.ok) throw new Error(await res.text());
      const draft = (await res.json()) as { id: string };
      navigate(`/forms/fill/${draft.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(null);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 className="s7-type-page-heading" style={{ margin: 0 }}>Forms</h1>
        <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
          Select a form to fill out, review your submissions, or approve pending work.
        </p>
      </header>

      <nav role="tablist" style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        <TabButton active={tab === "templates"} onClick={() => setTab("templates")} label="Templates" />
        <TabButton
          active={tab === "my-submissions"}
          onClick={() => setTab("my-submissions")}
          label={`My submissions${submissions.length ? ` (${submissions.length})` : ""}`}
        />
        {canApprove ? (
          <TabButton
            active={tab === "approvals"}
            onClick={() => setTab("approvals")}
            label={`Pending approvals${approvals.length ? ` (${approvals.length})` : ""}`}
          />
        ) : null}
        {canManage ? (
          <TabButton active={tab === "analytics"} onClick={() => setTab("analytics")} label="Analytics" />
        ) : null}
      </nav>

      {error ? (
        <div role="alert" style={{ padding: 10, background: "#FEE2E2", color: "#991B1B", borderRadius: 6, marginBottom: 12 }}>
          {error}
        </div>
      ) : null}

      {tab === "templates" ? (
        <TemplatesTab
          loading={loading}
          templates={filteredTemplates}
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          lastSubmittedByTemplate={lastSubmittedByTemplate}
          creating={creating}
          onFillOut={fillOut}
        />
      ) : null}

      {tab === "my-submissions" ? <MySubmissionsTab loading={loading} submissions={submissions} /> : null}

      {tab === "approvals" && canApprove ? (
        <ApprovalsTab loading={loading} approvals={approvals} onChanged={() => void load()} />
      ) : null}

      {tab === "analytics" && canManage ? <AnalyticsTab /> : null}
    </div>
  );
}

// ── Templates tab ────────────────────────────────────────────────────────

function TemplatesTab({
  loading,
  templates,
  search,
  setSearch,
  category,
  setCategory,
  lastSubmittedByTemplate,
  creating,
  onFillOut
}: {
  loading: boolean;
  templates: FormTemplate[];
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  lastSubmittedByTemplate: Map<string, string>;
  creating: string | null;
  onFillOut: (id: string) => void;
}) {
  const categories = ["all", ...Object.keys(CATEGORY_LABEL)];

  return (
    <section>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="Search forms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="s7-input"
          style={{ minWidth: 220, flex: "0 1 320px" }}
        />
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
        {categories.map((c) => {
          const active = category === c;
          const label = c === "all" ? "All" : CATEGORY_LABEL[c] ?? c;
          const colour = c === "all" ? "#FEAA6D" : CATEGORY_COLOUR[c] ?? "#FEAA6D";
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                border: "1px solid",
                borderColor: active ? colour : "var(--border-subtle, rgba(0,0,0,0.12))",
                background: active ? colour : "var(--surface-card, #fff)",
                color: active ? "#fff" : "var(--text-muted, #6B7280)",
                whiteSpace: "nowrap",
                cursor: "pointer"
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="s7-card" style={{ padding: 14 }}>
              <Skeleton width="60%" height={14} />
              <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
              <Skeleton width="100%" height={28} style={{ marginTop: 12 }} />
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          heading={search || category !== "all" ? "No forms match your filters" : "No form templates available"}
          subtext={search || category !== "all" ? "Try clearing the search or switching category." : "Contact your administrator to create form templates."}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
          {templates.map((t) => {
            const cat = t.category ?? "custom";
            const colour = CATEGORY_COLOUR[cat] ?? CATEGORY_COLOUR.custom;
            const last = lastSubmittedByTemplate.get(t.id);
            const isCreating = creating === t.id;
            return (
              <article
                key={t.id}
                className="s7-card"
                style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}
              >
                <div style={{ background: colour, height: 4 }} aria-hidden />
                <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>{t.name}</h3>
                    <span
                      style={{
                        background: colour,
                        color: "#fff",
                        fontSize: 10,
                        padding: "2px 8px",
                        borderRadius: 999,
                        textTransform: "uppercase"
                      }}
                    >
                      {CATEGORY_LABEL[cat] ?? cat}
                    </span>
                  </div>
                  {t.description ? (
                    <p
                      style={{
                        margin: 0,
                        fontSize: 12,
                        color: "var(--text-muted, #6B7280)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden"
                      }}
                    >
                      {t.description}
                    </p>
                  ) : null}
                  <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted, #9CA3AF)" }}>
                    Last submitted: {relativeTime(last)}
                  </p>
                  <div style={{ marginTop: "auto", paddingTop: 8 }}>
                    <button
                      type="button"
                      className="s7-btn s7-btn--primary"
                      style={{ width: "100%", background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}
                      disabled={isCreating}
                      onClick={() => onFillOut(t.id)}
                    >
                      {isCreating ? "Opening…" : "Fill out"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ── My submissions tab ───────────────────────────────────────────────────

function MySubmissionsTab({ loading, submissions }: { loading: boolean; submissions: Submission[] }) {
  if (loading) {
    return <Skeleton width="100%" height={120} />;
  }
  if (submissions.length === 0) {
    return <EmptyState heading="No submissions yet" subtext="Fill out a form to get started." />;
  }
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "var(--surface-muted, #f6f6f6)" }}>
          {["Form", "Date", "Status", "Approval", "Actions"].map((h) => (
            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {submissions.map((s) => {
          const statusKey = s.status.toLowerCase();
          const pill = STATUS_PILL[statusKey] ?? STATUS_PILL.draft;
          const tpl = s.templateVersion?.template;
          const nextApproval = (s.approvals ?? []).find((a) => a.status === "pending");
          const isDraft = statusKey === "draft";
          const isRejected = statusKey === "rejected";
          return (
            <tr key={s.id} style={{ borderTop: "1px solid var(--border, #e5e7eb)" }}>
              <td style={{ padding: "8px 10px" }}>
                <strong>{tpl?.name ?? "(untitled)"}</strong>
                {tpl?.code ? <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{tpl.code}</div> : null}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                {fmtDateTime(s.submittedAt ?? s.updatedAt)}
              </td>
              <td style={{ padding: "8px 10px" }}>
                <span style={{ background: pill.bg, color: pill.fg, padding: "2px 10px", borderRadius: 999, fontSize: 11 }}>
                  {pill.label}
                </span>
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)", fontSize: 12 }}>
                {nextApproval ? `Step ${nextApproval.stepNumber}` : "—"}
              </td>
              <td style={{ padding: "8px 10px", textAlign: "right" }}>
                {isDraft ? (
                  <Link to={`/forms/fill/${s.id}`} className="s7-btn s7-btn--primary s7-btn--sm" style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}>
                    Continue
                  </Link>
                ) : isRejected ? (
                  <>
                    <Link to={`/forms/submissions/${s.id}`} className="s7-btn s7-btn--ghost s7-btn--sm">
                      View
                    </Link>{" "}
                    <Link to={`/forms/fill/${s.id}`} className="s7-btn s7-btn--secondary s7-btn--sm">
                      Resubmit
                    </Link>
                  </>
                ) : (
                  <Link to={`/forms/submissions/${s.id}`} className="s7-btn s7-btn--ghost s7-btn--sm">
                    View
                  </Link>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Approvals tab ────────────────────────────────────────────────────────

function ApprovalsTab({
  loading,
  approvals,
  onChanged
}: {
  loading: boolean;
  approvals: PendingApprovalRow[];
  onChanged: () => void;
}) {
  const { authFetch } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openComment, setOpenComment] = useState<{ submissionId: string; mode: "approve" | "reject" } | null>(null);
  const [comment, setComment] = useState("");

  if (loading) return <Skeleton width="100%" height={120} />;
  if (approvals.length === 0) {
    return <EmptyState heading="No pending approvals ✓" subtext="You are all caught up." />;
  }

  const submit = async () => {
    if (!openComment) return;
    if (openComment.mode === "reject" && comment.trim().length < 1) {
      setError("A comment is required when rejecting.");
      return;
    }
    setBusy(openComment.submissionId);
    setError(null);
    try {
      const res = await authFetch(
        `/forms/submissions/${openComment.submissionId}/${openComment.mode}`,
        {
          method: "POST",
          body: JSON.stringify({ comment: comment.trim() || undefined })
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setOpenComment(null);
      setComment("");
      onChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section>
      {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--surface-muted, #f6f6f6)" }}>
            {["Form", "Submitted by", "Submitted", "Due", "Actions"].map((h) => (
              <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {approvals.map((a) => {
            const submittedBy = a.submission.submittedBy;
            const tpl = a.submission.templateVersion?.template;
            const overdue = a.dueAt ? new Date(a.dueAt).getTime() < Date.now() : false;
            return (
              <tr
                key={a.id}
                style={{
                  borderTop: "1px solid var(--border, #e5e7eb)",
                  borderLeft: overdue ? "4px solid #DC2626" : "4px solid transparent"
                }}
              >
                <td style={{ padding: "8px 10px" }}>
                  <strong>{tpl?.name ?? "(form)"}</strong>
                  {overdue ? (
                    <span style={{ marginLeft: 6, fontSize: 10, padding: "2px 6px", background: "#FEE2E2", color: "#B91C1C", borderRadius: 999 }}>
                      Overdue
                    </span>
                  ) : null}
                </td>
                <td style={{ padding: "8px 10px" }}>
                  {submittedBy ? `${submittedBy.firstName} ${submittedBy.lastName}` : "—"}
                </td>
                <td style={{ padding: "8px 10px", color: "var(--text-muted)" }}>
                  {fmtDateTime(a.submission.submittedAt)}
                </td>
                <td style={{ padding: "8px 10px", color: overdue ? "#DC2626" : "var(--text-muted)" }}>
                  {fmtDateTime(a.dueAt)}
                </td>
                <td style={{ padding: "8px 10px", textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link to={`/forms/submissions/${a.submissionId}`} className="s7-btn s7-btn--ghost s7-btn--sm">
                    View
                  </Link>{" "}
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    style={{ background: "#16A34A", color: "#fff", borderColor: "#16A34A" }}
                    disabled={busy === a.submissionId}
                    onClick={() => {
                      setOpenComment({ submissionId: a.submissionId, mode: "approve" });
                      setComment("");
                    }}
                  >
                    Approve
                  </button>{" "}
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    style={{ background: "#DC2626", color: "#fff", borderColor: "#DC2626" }}
                    disabled={busy === a.submissionId}
                    onClick={() => {
                      setOpenComment({ submissionId: a.submissionId, mode: "reject" });
                      setComment("");
                    }}
                  >
                    Reject
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {openComment ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setOpenComment(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="s7-card"
            style={{ padding: 18, width: "min(420px, 92vw)" }}
          >
            <h3 className="s7-type-section-heading" style={{ margin: "0 0 8px" }}>
              {openComment.mode === "approve" ? "Approve submission" : "Reject submission"}
            </h3>
            <textarea
              className="s7-textarea"
              rows={3}
              placeholder={
                openComment.mode === "approve"
                  ? "Optional comment to send to the submitter…"
                  : "Required — explain why this is being rejected."
              }
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              style={{ width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              <button type="button" className="s7-btn s7-btn--ghost" onClick={() => setOpenComment(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                disabled={busy === openComment.submissionId}
                onClick={() => void submit()}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// ── Analytics tab (compact stub — full chart suite is Phase 5C follow-up) ─

function AnalyticsTab() {
  const { authFetch } = useAuth();
  const [data, setData] = useState<{
    totalSubmissions?: number;
    byStatus?: Record<string, number>;
    overdueApprovals?: number;
  } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void authFetch("/forms/analytics")
      .then(async (r) => {
        if (cancelled || !r.ok) return;
        setData(await r.json());
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [authFetch]);
  return (
    <section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <Card label="Total submissions" value={data?.totalSubmissions ?? "…"} />
        <Card label="Drafts" value={data?.byStatus?.draft ?? 0} tone="default" />
        <Card label="Submitted" value={data?.byStatus?.submitted ?? 0} tone="info" />
        <Card label="Approved" value={data?.byStatus?.approved ?? 0} tone="success" />
        <Card
          label="Overdue approvals"
          value={data?.overdueApprovals ?? 0}
          tone={(data?.overdueApprovals ?? 0) > 0 ? "danger" : "default"}
        />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 12 }}>
        Detailed charts (submission trend, by-template breakdown, field completion rates) are tracked in
        roadmap Phase 5C.
      </p>
    </section>
  );
}

function Card({ label, value, tone = "default" }: { label: string; value: number | string; tone?: "default" | "danger" | "info" | "success" }) {
  const colour =
    tone === "danger"
      ? "#DC2626"
      : tone === "info"
        ? "#1D4ED8"
        : tone === "success"
          ? "#166534"
          : "var(--text-default, #242424)";
  return (
    <div className="s7-card" style={{ padding: 14 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 600, color: colour, marginTop: 6 }}>{value}</div>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={active ? "s7-btn s7-btn--secondary s7-btn--sm" : "s7-btn s7-btn--ghost s7-btn--sm"}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
