import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type ArchiveExport = {
  exportedAt: string;
  summary: {
    id: string;
    jobNumber: string;
    name: string;
    description?: string | null;
    status: string;
    client: { id: string; name: string };
    site?: { id: string; name: string } | null;
    projectManager?: { id: string; firstName: string; lastName: string; email: string } | null;
    supervisor?: { id: string; firstName: string; lastName: string; email: string } | null;
    createdAt: string;
    updatedAt: string;
  };
  closeout: {
    id: string;
    status: string;
    summary?: string | null;
    archivedAt?: string | null;
    readOnlyFrom?: string | null;
    createdAt: string;
  } | null;
  checklist: unknown;
  stages: Array<{ id: string; name: string; status: string; stageOrder: number; startDate: string | null; endDate: string | null }>;
  activities: Array<{ id: string; name: string; status: string; activityOrder: number; jobStageId: string; plannedDate: string | null }>;
  issues: Array<{ id: string; title: string; severity: string; status: string; reportedAt: string; description: string | null }>;
  variations: Array<{ id: string; reference: string; title: string; status: string; amount: string | null; approvedAt: string | null }>;
  progressEntries: Array<{ id: string; entryType: string; entryDate: string; summary: string; percentComplete: number | null }>;
  statusHistory: Array<{ id: string; fromStatus: string | null; toStatus: string; note: string | null; changedAt: string }>;
  documents: Array<{
    id: string;
    title: string;
    category: string;
    versionLabel: string | null;
    fileName: string | null;
    webUrl: string | null;
    folderPath: string | null;
  }>;
  formSubmissions: Array<{
    id: string;
    templateName: string;
    templateCode: string;
    versionNumber: number;
    status: string;
    submittedAt: string;
    summary: string | null;
  }>;
};

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section
      style={{
        border: "1px solid var(--surface-border, #e5e7eb)",
        borderRadius: 10,
        marginBottom: 12,
        overflow: "hidden"
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          minHeight: 44,
          padding: "10px 14px",
          textAlign: "left",
          background: "var(--surface-muted, #f5f7fa)",
          border: "none",
          fontWeight: 600,
          cursor: "pointer"
        }}
        aria-expanded={open}
      >
        {open ? "▾" : "▸"} {title}
      </button>
      {open ? <div style={{ padding: 14 }}>{children}</div> : null}
    </section>
  );
}

export function ArchiveDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { authFetch } = useAuth();
  const [data, setData] = useState<ArchiveExport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch(`/archive/${jobId}/export`);
        if (!response.ok) throw new Error("Unable to load archive record.");
        setData(await response.json());
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch, jobId]);

  const downloadExport = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `archive-${data.summary.jobNumber}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <AppCard title="Archive detail" subtitle="Loading archived job...">
        <p className="muted-text">Retrieving archive record...</p>
      </AppCard>
    );
  }

  if (error || !data) {
    return (
      <AppCard title="Archive detail" subtitle="Unable to load">
        <p className="error-text">{error ?? "Record not found."}</p>
        <Link to="/archive">← Back to Archive</Link>
      </AppCard>
    );
  }

  const { summary, closeout } = data;

  return (
    <AppCard
      title={`${summary.jobNumber} — ${summary.name}`}
      subtitle={`Read-only archive record · exported ${new Date(data.exportedAt).toLocaleString()}`}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Link to="/archive" style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}>
            ← Archive
          </Link>
          <button type="button" onClick={downloadExport} style={{ minHeight: 44, padding: "8px 16px" }}>
            Export record
          </button>
        </div>
      }
    >
      <Panel title="Job summary">
        <p>
          <strong>Client:</strong> {summary.client.name}
        </p>
        <p>
          <strong>Site:</strong> {summary.site?.name ?? "—"}
        </p>
        <p>
          <strong>Status:</strong> {summary.status}
        </p>
        <p>
          <strong>Project manager:</strong>{" "}
          {summary.projectManager ? `${summary.projectManager.firstName} ${summary.projectManager.lastName}` : "—"}
        </p>
        <p>
          <strong>Supervisor:</strong>{" "}
          {summary.supervisor ? `${summary.supervisor.firstName} ${summary.supervisor.lastName}` : "—"}
        </p>
        {summary.description ? <p>{summary.description}</p> : null}
      </Panel>

      <Panel title="Closeout & checklist">
        {closeout ? (
          <>
            <p>
              <strong>Status:</strong> {closeout.status}
            </p>
            {closeout.archivedAt ? (
              <p>
                <strong>Archived:</strong> {new Date(closeout.archivedAt).toLocaleString()}
              </p>
            ) : null}
            {closeout.summary ? <p>{closeout.summary}</p> : null}
            <pre
              style={{
                background: "var(--surface-muted, #f5f7fa)",
                padding: 10,
                borderRadius: 6,
                overflowX: "auto",
                fontSize: 12
              }}
            >
              {JSON.stringify(data.checklist ?? {}, null, 2)}
            </pre>
          </>
        ) : (
          <p className="muted-text">No closeout record.</p>
        )}
      </Panel>

      <Panel title={`Stages & activities (${data.stages.length} stages, ${data.activities.length} activities)`}>
        {data.stages.map((stage) => {
          const stageActivities = data.activities.filter((activity) => activity.jobStageId === stage.id);
          return (
            <div key={stage.id} style={{ marginBottom: 10 }}>
              <strong>
                {stage.stageOrder}. {stage.name}
              </strong>{" "}
              <span className="pill pill--amber">{stage.status}</span>
              <ul>
                {stageActivities.map((activity) => (
                  <li key={activity.id}>
                    {activity.activityOrder}. {activity.name} — <em>{activity.status}</em>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </Panel>

      <Panel title={`Issues & variations (${data.issues.length} issues, ${data.variations.length} variations)`}>
        <h4>Issues</h4>
        {data.issues.length === 0 ? <p className="muted-text">No issues recorded.</p> : (
          <ul>
            {data.issues.map((issue) => (
              <li key={issue.id}>
                <strong>{issue.title}</strong> — {issue.severity} / {issue.status}
                {issue.description ? <p className="muted-text">{issue.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
        <h4>Variations</h4>
        {data.variations.length === 0 ? <p className="muted-text">No variations recorded.</p> : (
          <ul>
            {data.variations.map((variation) => (
              <li key={variation.id}>
                <strong>{variation.reference}</strong> — {variation.title} ({variation.status})
                {variation.amount ? ` · $${variation.amount}` : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Form submissions (${data.formSubmissions.length})`}>
        {data.formSubmissions.length === 0 ? <p className="muted-text">No form submissions for this job.</p> : (
          <ul>
            {data.formSubmissions.map((submission) => (
              <li key={submission.id}>
                <strong>{submission.templateName}</strong> v{submission.versionNumber} — {submission.status}
                {" · "}
                {new Date(submission.submittedAt).toLocaleString()}
                {submission.summary ? <p className="muted-text">{submission.summary}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Linked documents (${data.documents.length})`}>
        {data.documents.length === 0 ? <p className="muted-text">No documents linked.</p> : (
          <ul>
            {data.documents.map((document) => (
              <li key={document.id}>
                <strong>{document.title}</strong> — {document.category}
                {document.versionLabel ? ` (${document.versionLabel})` : ""}
                {document.fileName ? ` · ${document.fileName}` : ""}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`Status history (${data.statusHistory.length})`}>
        {data.statusHistory.length === 0 ? <p className="muted-text">No status changes recorded.</p> : (
          <ul>
            {data.statusHistory.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.changedAt).toLocaleString()} · {entry.fromStatus ?? "∅"} → {entry.toStatus}
                {entry.note ? <p className="muted-text">{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AppCard>
  );
}
