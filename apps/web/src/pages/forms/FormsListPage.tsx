import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type FormTemplate = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  updatedAt: string;
  versions: Array<{
    id: string;
    versionNumber: number;
    status: string;
    sections: Array<{ id: string; fields: Array<{ id: string }> }>;
  }>;
};

type TemplateResponse = {
  items: FormTemplate[];
  total: number;
};

type Submission = {
  id: string;
  status: string;
  submittedAt: string;
  summary?: string | null;
  submittedBy?: { id: string; firstName: string; lastName: string } | null;
  templateVersion: {
    id: string;
    versionNumber: number;
    template: { id: string; name: string; code: string };
  };
};

type SubmissionResponse = {
  items: Submission[];
  total: number;
};

type Tab = "templates" | "submissions";

const STATUS_CLASS: Record<string, string> = {
  DRAFT: "s7-badge s7-badge--neutral",
  SUBMITTED: "s7-badge s7-badge--info",
  REVIEWED: "s7-badge s7-badge--active"
};

function fieldCount(template: FormTemplate): number {
  const active = template.versions.find((v) => v.status === "ACTIVE") ?? template.versions[0];
  if (!active) return 0;
  return active.sections.reduce((sum, section) => sum + section.fields.length, 0);
}

function activeVersion(template: FormTemplate): FormTemplate["versions"][number] | null {
  return template.versions.find((v) => v.status === "ACTIVE") ?? template.versions[0] ?? null;
}

export function FormsListPage() {
  const { authFetch } = useAuth();
  const [tab, setTab] = useState<Tab>("templates");
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formFilter, setFormFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [submitterFilter, setSubmitterFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [templatesRes, submissionsRes] = await Promise.all([
          authFetch("/forms/templates?page=1&pageSize=100"),
          authFetch("/forms/submissions?page=1&pageSize=100")
        ]);
        if (!templatesRes.ok) throw new Error("Could not load templates.");
        if (!submissionsRes.ok) throw new Error("Could not load submissions.");
        const t = (await templatesRes.json()) as TemplateResponse;
        const s = (await submissionsRes.json()) as SubmissionResponse;
        if (!cancelled) {
          setTemplates(t.items);
          setSubmissions(s.items);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch]);

  const submitters = useMemo(() => {
    const seen = new Map<string, string>();
    for (const sub of submissions) {
      if (sub.submittedBy) {
        seen.set(sub.submittedBy.id, `${sub.submittedBy.firstName} ${sub.submittedBy.lastName}`);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [submissions]);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (formFilter && sub.templateVersion.template.id !== formFilter) return false;
      if (statusFilter && sub.status !== statusFilter) return false;
      if (submitterFilter && sub.submittedBy?.id !== submitterFilter) return false;
      if (dateFilter) {
        const submittedDay = new Date(sub.submittedAt).toISOString().slice(0, 10);
        if (submittedDay !== dateFilter) return false;
      }
      return true;
    });
  }, [submissions, formFilter, statusFilter, submitterFilter, dateFilter]);

  return (
    <div className="forms-page">
      <header className="workers-page__header">
        <div>
          <p className="s7-type-label">Operations</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>Forms</h1>
        </div>
        <div className="tender-page__view-toggle" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "templates"}
            className={tab === "templates" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
            onClick={() => setTab("templates")}
          >
            Templates
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "submissions"}
            className={tab === "submissions" ? "tender-page__view-btn tender-page__view-btn--active" : "tender-page__view-btn"}
            onClick={() => setTab("submissions")}
          >
            Submissions
          </button>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      {tab === "templates" ? (
        <section className="forms-templates">
          {loading ? (
            <div className="assets-grid">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={`tpl-skel-${index}`} className="s7-card">
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="40%" height={12} style={{ marginTop: 8 }} />
                  <Skeleton width="100%" height={22} style={{ marginTop: 12 }} />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <EmptyState heading="No form templates" subtext="Create a template to start collecting structured data from the field." />
          ) : (
            <div className="assets-grid">
              {templates.map((template) => {
                const active = activeVersion(template);
                return (
                  <article key={template.id} className="s7-card forms-template-card">
                    <div className="forms-template-card__head">
                      <h3 className="s7-type-card-title" style={{ margin: 0 }}>{template.name}</h3>
                      <span className="s7-badge s7-badge--neutral">
                        {active ? `v${active.versionNumber}` : "unversioned"}
                      </span>
                    </div>
                    <p className="forms-template-card__meta">
                      {template.code} · {fieldCount(template)} fields
                    </p>
                    {template.description ? (
                      <p className="forms-template-card__desc">{template.description}</p>
                    ) : null}
                    <p className="forms-template-card__updated">
                      Updated {new Date(template.updatedAt).toLocaleDateString()}
                    </p>
                    <div className="forms-template-card__actions">
                      <Link to={`/forms/designer/${template.id}`} className="s7-btn s7-btn--secondary s7-btn--sm">
                        Open designer
                      </Link>
                      <Link to={`/forms/submit/${template.id}`} className="s7-btn s7-btn--primary s7-btn--sm">
                        New submission
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <section className="forms-submissions">
          <div className="jobs-page__filters">
            <select className="s7-select" value={formFilter} onChange={(event) => setFormFilter(event.target.value)}>
              <option value="">All forms</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input
              className="s7-input"
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              aria-label="Submitted on"
            />
            <select className="s7-select" value={submitterFilter} onChange={(event) => setSubmitterFilter(event.target.value)}>
              <option value="">All submitters</option>
              {submitters.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select className="s7-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="REVIEWED">Reviewed</option>
            </select>
          </div>

          <div className="s7-table-scroll">
            <table className="s7-table">
              <thead>
                <tr>
                  <th>Form</th>
                  <th>Version</th>
                  <th>Submitted</th>
                  <th>Submitter</th>
                  <th>Status</th>
                  <th>Summary</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={`sub-s-${i}`}>
                      {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}><Skeleton height={14} /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState heading="No submissions match your filters" subtext="Adjust the filters above to see submissions." />
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((sub) => (
                    <tr key={sub.id}>
                      <td><strong>{sub.templateVersion.template.name}</strong></td>
                      <td>v{sub.templateVersion.versionNumber}</td>
                      <td>{new Date(sub.submittedAt).toLocaleString()}</td>
                      <td>{sub.submittedBy ? `${sub.submittedBy.firstName} ${sub.submittedBy.lastName}` : "—"}</td>
                      <td><span className={STATUS_CLASS[sub.status] ?? "s7-badge s7-badge--neutral"}>{sub.status}</span></td>
                      <td>{sub.summary ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
