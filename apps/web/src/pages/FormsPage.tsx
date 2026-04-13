import { useEffect, useMemo, useState } from "react";
import { AppCard } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

type TemplateField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  isRequired: boolean;
  optionsJson?: string[] | null;
};

type TemplateSection = {
  id: string;
  title: string;
  fields: TemplateField[];
};

type TemplateVersion = {
  id: string;
  versionNumber: number;
  status: string;
  sections: TemplateSection[];
  rules: Array<{ id: string; sourceFieldKey: string; targetFieldKey: string; effect: string }>;
};

type TemplateRecord = {
  id: string;
  name: string;
  code: string;
  status: string;
  geolocationEnabled: boolean;
  versions: TemplateVersion[];
};

type SubmissionRecord = {
  id: string;
  status: string;
  submittedAt: string;
  summary?: string | null;
  templateVersion: {
    id: string;
    versionNumber: number;
    template: { name: string; code: string };
  };
  job?: { jobNumber: string; name: string } | null;
  asset?: { name: string; assetCode: string } | null;
  values: Array<{ fieldKey: string; valueText?: string | null; valueNumber?: string | null; valueDateTime?: string | null; valueJson?: unknown }>;
  signatures: Array<{ signerName: string; signedAt: string }>;
};

const emptyTemplateForm = {
  name: "",
  code: "",
  description: "",
  geolocationEnabled: true,
  associationScopes: ["job", "shift", "asset", "worker", "site"],
  sections: [
    {
      title: "Main",
      description: "Primary checks",
      sectionOrder: 1,
      fields: [
        {
          fieldKey: "fit_for_work",
          label: "Fit for work",
          fieldType: "multiple_choice",
          fieldOrder: 1,
          isRequired: true,
          optionsJson: ["Yes", "No"]
        },
        {
          fieldKey: "hazard_notes",
          label: "Hazard notes",
          fieldType: "textarea",
          fieldOrder: 2,
          isRequired: false,
          optionsJson: undefined
        }
      ]
    }
  ],
  rules: [
    {
      sourceFieldKey: "fit_for_work",
      targetFieldKey: "hazard_notes",
      operator: "equals",
      comparisonValue: "No",
      effect: "REQUIRE"
    }
  ]
};

export function FormsPage() {
  const { authFetch } = useAuth();
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRecord[]>([]);
  const [jobs, setJobs] = useState<Array<{ id: string; jobNumber: string; name: string }>>([]);
  const [assets, setAssets] = useState<Array<{ id: string; name: string; assetCode: string }>>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [templateForm, setTemplateForm] = useState(emptyTemplateForm);
  const [submissionValues, setSubmissionValues] = useState<Record<string, string>>({});
  const [submissionSummary, setSubmissionSummary] = useState("");
  const [submissionJobId, setSubmissionJobId] = useState("");
  const [submissionAssetId, setSubmissionAssetId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [templatesResponse, submissionsResponse, jobsResponse, assetsResponse] = await Promise.all([
      authFetch("/forms/templates?page=1&pageSize=50"),
      authFetch("/forms/submissions?page=1&pageSize=50"),
      authFetch("/jobs?page=1&pageSize=50"),
      authFetch("/assets?page=1&pageSize=50")
    ]);

    if (!templatesResponse.ok || !submissionsResponse.ok || !jobsResponse.ok || !assetsResponse.ok) {
      throw new Error("Unable to load forms workspace.");
    }

    const [templatesData, submissionsData, jobsData, assetsData] = await Promise.all([
      templatesResponse.json(),
      submissionsResponse.json(),
      jobsResponse.json(),
      assetsResponse.json()
    ]);

    setTemplates(templatesData.items);
    setSubmissions(submissionsData.items);
    setJobs(jobsData.items);
    setAssets(assetsData.items);
  };

  useEffect(() => {
    load().catch((loadError) => setError((loadError as Error).message));
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? templates[0] ?? null,
    [templates, selectedTemplateId]
  );

  const selectedVersion = selectedTemplate?.versions[0] ?? null;

  const submitTemplate = async (event: React.FormEvent) => {
    event.preventDefault();
    const response = await authFetch("/forms/templates", {
      method: "POST",
      body: JSON.stringify(templateForm)
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to create form template.");
      return;
    }

    setTemplateForm(emptyTemplateForm);
    await load();
  };

  const submitFormSubmission = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedVersion) return;

    const values = selectedVersion.sections.flatMap((section) =>
      section.fields
        .filter((field) => submissionValues[field.fieldKey])
        .map((field) => ({
          fieldKey: field.fieldKey,
          valueText: submissionValues[field.fieldKey]
        }))
    );

    const response = await authFetch(`/forms/versions/${selectedVersion.id}/submissions`, {
      method: "POST",
      body: JSON.stringify({
        status: "SUBMITTED",
        summary: submissionSummary,
        jobId: submissionJobId || undefined,
        assetId: submissionAssetId || undefined,
        values,
        signatures: [
          {
            fieldKey: "crew_signature",
            signerName: "Codex Demo Signatory"
          }
        ]
      })
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.message ?? "Unable to submit form.");
      return;
    }

    setSubmissionValues({});
    setSubmissionSummary("");
    setSubmissionJobId("");
    setSubmissionAssetId("");
    await load();
  };

  return (
    <div className="crm-page crm-page--operations">
      {error ? <p className="error-text">{error}</p> : null}

      <div className="crm-page__sidebar">
        <AppCard title="Form Templates" subtitle="Versioned templates that preserve historical submissions">
          <div className="dashboard-list dashboard-list--capped">
            {templates.map((template) => (
              <button key={template.id} type="button" className="asset-record" onClick={() => setSelectedTemplateId(template.id)}>
                <div>
                  <strong>{template.name}</strong>
                  <p className="muted-text">{template.code}</p>
                </div>
                <div className="asset-record__meta">
                  <span className="pill pill--green">{template.status}</span>
                  <span className="muted-text">v{template.versions[0]?.versionNumber ?? 0}</span>
                </div>
              </button>
            ))}
          </div>
        </AppCard>

        <AppCard title="Create Template" subtitle="Configurable without code changes">
          <form className="admin-form" onSubmit={submitTemplate}>
            <div className="compact-filter-grid compact-filter-grid--two">
              <label>
                Template name
                <input value={templateForm.name} onChange={(event) => setTemplateForm({ ...templateForm, name: event.target.value })} />
              </label>
              <label>
                Code
                <input value={templateForm.code} onChange={(event) => setTemplateForm({ ...templateForm, code: event.target.value })} />
              </label>
              <label className="compact-filter-grid__wide">
                Description
                <input value={templateForm.description} onChange={(event) => setTemplateForm({ ...templateForm, description: event.target.value })} />
              </label>
            </div>
            <button type="submit">Create Template</button>
          </form>
        </AppCard>
      </div>

      <div className="crm-page__main">
        <AppCard title="Template Detail" subtitle="Current version, sections, fields, and conditional rules">
          {selectedTemplate ? (
            <div className="scheduler-pane">
              <div className="dashboard-preview">
                <h3>{selectedTemplate.name}</h3>
                <p>{selectedTemplate.code} | {selectedTemplate.geolocationEnabled ? "Geolocation enabled" : "No geolocation"}</p>
                <p>Versions: {selectedTemplate.versions.map((version) => `v${version.versionNumber}`).join(", ")}</p>
              </div>

              <div className="compact-two-up">
                {selectedVersion?.sections.map((section) => (
                  <div key={section.id} className="subsection">
                    <strong>{section.title}</strong>
                    {section.fields.map((field) => (
                      <div key={field.id} className="record-row">
                        <span>{field.label}</span>
                        <span className="muted-text">{field.fieldType}{field.isRequired ? " | required" : ""}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>

              <div className="subsection">
                <strong>Rules</strong>
                {selectedVersion?.rules.map((rule) => (
                  <div key={rule.id} className="record-row">
                    <span>{`${rule.sourceFieldKey} -> ${rule.targetFieldKey}`}</span>
                    <span className="muted-text">{rule.effect}</span>
                  </div>
                ))}
                {(selectedVersion?.rules.length ?? 0) === 0 ? <p className="muted-text">No rules configured.</p> : null}
              </div>
            </div>
          ) : (
            <p className="muted-text">No form templates yet.</p>
          )}
        </AppCard>

        <AppCard title="Submit Form" subtitle="Submit against latest template version">
          {selectedVersion ? (
            <form className="admin-form" onSubmit={submitFormSubmission}>
              <div className="compact-filter-grid compact-filter-grid--two">
                <label>
                  Job
                  <select value={submissionJobId} onChange={(event) => setSubmissionJobId(event.target.value)}>
                    <option value="">Select job</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>{job.jobNumber} - {job.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Asset
                  <select value={submissionAssetId} onChange={(event) => setSubmissionAssetId(event.target.value)}>
                    <option value="">Select asset</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.assetCode} - {asset.name}</option>
                    ))}
                  </select>
                </label>
                <label className="compact-filter-grid__wide">
                  Summary
                  <input value={submissionSummary} onChange={(event) => setSubmissionSummary(event.target.value)} />
                </label>
              </div>
              {selectedVersion.sections.flatMap((section) => section.fields).map((field) => (
                <label key={field.id}>
                  {field.label}
                  <input
                    value={submissionValues[field.fieldKey] ?? ""}
                    onChange={(event) =>
                      setSubmissionValues((current) => ({
                        ...current,
                        [field.fieldKey]: event.target.value
                      }))
                    }
                    placeholder={field.fieldType}
                  />
                </label>
              ))}
              <button type="submit">Submit Form</button>
            </form>
          ) : (
            <p className="muted-text">Select a template to submit.</p>
          )}
        </AppCard>

        <AppCard title="Submissions" subtitle="Historical submissions remain bound to their template version">
          <div className="dashboard-list dashboard-list--capped">
            {submissions.map((submission) => (
              <div key={submission.id} className="resource-card">
                <div className="split-header">
                  <div>
                    <strong>{submission.templateVersion.template.name}</strong>
                    <p className="muted-text">
                      {submission.templateVersion.template.code} | v{submission.templateVersion.versionNumber} | {new Date(submission.submittedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="pill pill--green">{submission.status}</span>
                </div>
                <p className="muted-text">{submission.summary ?? "No summary"}</p>
                <div className="subsection">
                  {submission.values.map((value) => (
                    <div key={`${submission.id}-${value.fieldKey}`} className="record-row">
                      <span>{value.fieldKey}</span>
                      <span className="muted-text">{value.valueText ?? value.valueNumber ?? value.valueDateTime ?? JSON.stringify(value.valueJson ?? "")}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </AppCard>
      </div>
    </div>
  );
}
