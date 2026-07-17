import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { EmptyState, Skeleton } from "@project-ops/ui";

type SurveyQuestion = {
  id: string;
  prompt: string;
  type: "rating" | "text";
  required: boolean;
  min?: number;
  max?: number;
};

type Survey = {
  id: string;
  name: string;
  description?: string | null;
  questions: SurveyQuestion[];
  isDefault: boolean;
};

type ClientItem = { id: string; name: string };
type JobItem = { id: string; jobNumber: string; name: string };
type ProjectItem = { id: string; projectNumber: string; name: string };

type AnswerMap = Record<string, string | number>;

export function SurveyCaptureFormPage() {
  const { authFetch } = useAuth();

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);

  const [selectedSurveyId, setSelectedSurveyId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [answers, setAnswers] = useState<AnswerMap>({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [surveysRes, clientsRes, jobsRes, projectsRes] = await Promise.all([
          authFetch("/surveys"),
          authFetch("/master-data/clients?page=1&pageSize=200"),
          authFetch("/jobs?page=1&pageSize=200"),
          authFetch("/projects?page=1&pageSize=200")
        ]);
        if (cancelled) return;
        if (surveysRes.ok) {
          const data = (await surveysRes.json()) as Survey[];
          setSurveys(data);
          const def = data.find((s) => s.isDefault);
          if (def) setSelectedSurveyId(def.id);
        }
        if (clientsRes.ok) {
          const data = await clientsRes.json();
          setClients((data.items ?? []) as ClientItem[]);
        }
        if (jobsRes.ok) {
          const data = await jobsRes.json();
          setJobs((data.items ?? []) as JobItem[]);
        }
        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects((data.items ?? []) as ProjectItem[]);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [authFetch]);

  const activeSurvey = surveys.find((s) => s.id === selectedSurveyId) ?? null;

  const handleRating = (questionId: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleText = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSurveyId || !selectedClientId) {
      setError("Please select a survey and a client.");
      return;
    }
    if (!activeSurvey) return;

    // Validate required questions
    const missing = activeSurvey.questions.filter(
      (q) => q.required && (answers[q.id] === undefined || answers[q.id] === "")
    );
    if (missing.length > 0) {
      setError(`Please answer all required questions: ${missing.map((q) => `"${q.prompt}"`).join(", ")}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const body = {
        clientId: selectedClientId,
        jobId: selectedJobId || null,
        projectId: selectedProjectId || null,
        answers: Object.entries(answers).map(([questionId, value]) => ({ questionId, value }))
      };
      const res = await authFetch(`/surveys/${selectedSurveyId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Submission failed." }));
        throw new Error((err as { message?: string }).message ?? "Submission failed.");
      }
      setSuccessMsg("Response recorded. Client satisfaction score updated.");
      setAnswers({});
      setSelectedClientId("");
      setSelectedJobId("");
      setSelectedProjectId("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="s7-page">
        <h1 className="s7-page__title">Capture Survey Response</h1>
        <Skeleton width="100%" height={300} />
      </div>
    );
  }

  return (
    <div className="s7-page">
      <h1 className="s7-page__title">Capture Survey Response</h1>
      <p className="s7-page__subtitle">
        Record a client satisfaction response for a completed job or project.
      </p>

      {successMsg && (
        <div className="s7-alert s7-alert--success" role="alert">
          {successMsg}
        </div>
      )}
      {error && (
        <div className="s7-alert s7-alert--danger" role="alert">
          {error}
        </div>
      )}

      {surveys.length === 0 ? (
        <EmptyState heading="No surveys available" subtext="Create a survey template first." />
      ) : (
        <form onSubmit={handleSubmit} className="s7-card" style={{ maxWidth: 720, gap: 24, display: "flex", flexDirection: "column" }}>
          {/* Context selectors */}
          <section>
            <h2 className="s7-section-title">Context</h2>
            <div className="s7-form-row">
              <label className="s7-label" htmlFor="survey-select">Survey template</label>
              <select
                id="survey-select"
                className="s7-input"
                value={selectedSurveyId}
                onChange={(e) => { setSelectedSurveyId(e.target.value); setAnswers({}); }}
                required
              >
                <option value="">Select a survey…</option>
                {surveys.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.isDefault ? " (default)" : ""}</option>
                ))}
              </select>
            </div>

            <div className="s7-form-row">
              <label className="s7-label" htmlFor="client-select">Client *</label>
              <select
                id="client-select"
                className="s7-input"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                required
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="s7-form-row">
              <label className="s7-label" htmlFor="job-select">Job (optional)</label>
              <select
                id="job-select"
                className="s7-input"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
              >
                <option value="">None</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.jobNumber} — {j.name}</option>
                ))}
              </select>
            </div>

            <div className="s7-form-row">
              <label className="s7-label" htmlFor="project-select">Project (optional)</label>
              <select
                id="project-select"
                className="s7-input"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.projectNumber} — {p.name}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Survey questions */}
          {activeSurvey && (
            <section>
              <h2 className="s7-section-title">{activeSurvey.name}</h2>
              {activeSurvey.description && (
                <p style={{ color: "var(--color-text-muted)", marginBottom: 16 }}>{activeSurvey.description}</p>
              )}
              {activeSurvey.questions.map((q) => (
                <div key={q.id} className="s7-form-row" style={{ marginBottom: 20 }}>
                  <label className="s7-label">
                    {q.prompt}
                    {q.required && <span style={{ color: "var(--color-danger)", marginLeft: 4 }}>*</span>}
                  </label>

                  {q.type === "rating" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      {Array.from({ length: (q.max ?? 5) - (q.min ?? 1) + 1 }, (_, i) => (q.min ?? 1) + i).map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleRating(q.id, val)}
                          className={answers[q.id] === val ? "s7-btn s7-btn--primary s7-btn--sm" : "s7-btn s7-btn--secondary s7-btn--sm"}
                          style={{ minWidth: 40 }}
                          aria-label={`Rate ${val}`}
                          aria-pressed={answers[q.id] === val}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      className="s7-input"
                      rows={3}
                      value={(answers[q.id] as string) ?? ""}
                      onChange={(e) => handleText(q.id, e.target.value)}
                      placeholder="Enter your response…"
                      style={{ marginTop: 8, resize: "vertical" }}
                    />
                  )}
                </div>
              ))}
            </section>
          )}

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="submit" className="s7-btn s7-btn--primary" disabled={submitting || !activeSurvey}>
              {submitting ? "Saving…" : "Submit response"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
