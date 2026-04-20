import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type TemplateField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
  placeholder?: string | null;
  helpText?: string | null;
  optionsJson?: unknown;
};

type TemplateSection = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  fields: TemplateField[];
};

type TemplateRule = {
  id: string;
  sourceFieldKey: string;
  targetFieldKey: string;
  operator: string;
  comparisonValue?: string | null;
  effect: string;
};

type TemplateVersion = {
  id: string;
  versionNumber: number;
  status: string;
  sections: TemplateSection[];
  rules: TemplateRule[];
};

type Template = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  versions: TemplateVersion[];
};

type FieldValue = string | boolean | number | File | null;

type ValuesMap = Record<string, FieldValue>;

function fieldVisible(field: TemplateField, rules: TemplateRule[], values: ValuesMap): boolean {
  const targeting = rules.filter((r) => r.targetFieldKey === field.fieldKey);
  if (targeting.length === 0) return true;
  for (const rule of targeting) {
    const source = values[rule.sourceFieldKey];
    const actual = typeof source === "boolean" ? (source ? "true" : "false") : source == null ? "" : String(source);
    const match = rule.operator === "not_equals" ? actual !== (rule.comparisonValue ?? "") : actual === (rule.comparisonValue ?? "");
    if (rule.effect === "SHOW" && !match) return false;
    if (rule.effect === "HIDE" && match) return false;
  }
  return true;
}

export function FormSubmitPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { authFetch } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<ValuesMap>({});
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch(`/forms/templates/${templateId}`);
        if (!response.ok) throw new Error("Template not found.");
        if (!cancelled) setTemplate((await response.json()) as Template);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, templateId]);

  const activeVersion = useMemo(() => {
    if (!template) return null;
    return template.versions.find((v) => v.status === "ACTIVE") ?? template.versions[0] ?? null;
  }, [template]);

  const totalSteps = activeVersion ? activeVersion.sections.length + 1 : 0; // +1 for review
  const isReview = step === totalSteps - 1;
  const section = activeVersion && !isReview ? activeVersion.sections[step] : null;

  const setValue = (key: string, value: FieldValue) => setValues((current) => ({ ...current, [key]: value }));

  const canNext = (): boolean => {
    if (!section) return true;
    for (const field of section.fields) {
      if (!field.isRequired) continue;
      if (!fieldVisible(field, activeVersion!.rules, values)) continue;
      const v = values[field.fieldKey];
      if (v === undefined || v === null) return false;
      if (typeof v === "string" && v.trim() === "") return false;
    }
    return true;
  };

  const submit = async () => {
    if (!activeVersion) return;
    setSubmitting(true);
    setError(null);
    try {
      type Payload = { fieldKey: string; valueText?: string; valueNumber?: number };
      const payloadValues: Payload[] = [];
      for (const [fieldKey, value] of Object.entries(values)) {
        if (value === null || value === undefined) continue;
        if (typeof value === "boolean") payloadValues.push({ fieldKey, valueText: value ? "true" : "false" });
        else if (typeof value === "number") payloadValues.push({ fieldKey, valueNumber: value });
        else if (value instanceof File) payloadValues.push({ fieldKey, valueText: value.name });
        else payloadValues.push({ fieldKey, valueText: String(value) });
      }

      const response = await authFetch(`/forms/versions/${activeVersion.id}/submissions`, {
        method: "POST",
        body: JSON.stringify({
          status: "SUBMITTED",
          values: payloadValues
        })
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not submit.");
      }
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="form-submit">
        <Skeleton width="50%" height={22} />
        <Skeleton width="100%" height={200} style={{ marginTop: 20 }} />
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="form-submit">
        <EmptyState
          heading="Could not load template"
          subtext={error}
          action={<Link to="/forms" className="s7-btn s7-btn--primary">← Back to forms</Link>}
        />
      </div>
    );
  }

  if (!activeVersion || !template) {
    return (
      <div className="form-submit">
        <EmptyState heading="No active version" subtext="This template has no active published version yet." />
      </div>
    );
  }

  if (done) {
    return (
      <div className="form-submit">
        <EmptyState
          heading="Submission received"
          subtext={`Thanks — your ${template.name} has been recorded.`}
          action={
            <Link to="/forms" className="s7-btn s7-btn--primary">
              Back to forms
            </Link>
          }
        />
      </div>
    );
  }

  const progress = Math.round(((step + 1) / totalSteps) * 100);

  return (
    <div className="form-submit">
      <header className="form-submit__head">
        <div>
          <p className="s7-type-label">{template.code} · v{activeVersion.versionNumber}</p>
          <h1 className="s7-type-page-title" style={{ margin: "4px 0 0" }}>{template.name}</h1>
        </div>
        <Link to="/forms" className="s7-btn s7-btn--ghost s7-btn--sm">Cancel</Link>
      </header>

      <div className="form-submit__progress">
        <div className="form-submit__progress-head">
          <span>Section {Math.min(step + 1, totalSteps)} of {totalSteps}{isReview ? " · Review" : ""}</span>
          <span>{progress}%</span>
        </div>
        <div className="jobs-card__progress" aria-hidden>
          <span className="jobs-card__progress-bar" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      {isReview ? (
        <section className="s7-card form-submit__card">
          <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>Review your answers</h2>
          {activeVersion.sections.map((sec) => (
            <div key={sec.id} style={{ marginBottom: 16 }}>
              <h3 className="s7-type-card-title" style={{ marginBottom: 8 }}>{sec.title}</h3>
              <dl className="tender-detail__dl">
                {sec.fields
                  .filter((f) => fieldVisible(f, activeVersion.rules, values))
                  .map((field) => {
                    const v = values[field.fieldKey];
                    let display: string = "—";
                    if (typeof v === "boolean") display = v ? "Yes" : "No";
                    else if (v instanceof File) display = v.name;
                    else if (v !== null && v !== undefined && String(v).length > 0) display = String(v);
                    return (
                      <div key={field.fieldKey}>
                        <dt>{field.label}</dt>
                        <dd>{display}</dd>
                      </div>
                    );
                  })}
              </dl>
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "space-between" }}>
            <button type="button" className="s7-btn s7-btn--secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>← Back</button>
            <button type="button" className="s7-btn s7-btn--primary" onClick={submit} disabled={submitting}>
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </section>
      ) : section ? (
        <section className="s7-card form-submit__card">
          <header>
            <h2 className="s7-type-section-heading" style={{ marginTop: 0 }}>{section.title}</h2>
            {section.description ? <p style={{ color: "var(--text-secondary)" }}>{section.description}</p> : null}
          </header>
          {section.fields.map((field) => {
            if (!fieldVisible(field, activeVersion.rules, values)) return null;
            return (
              <FieldInput
                key={field.id}
                field={field}
                value={values[field.fieldKey]}
                onChange={(v) => setValue(field.fieldKey, v)}
              />
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 20, justifyContent: "space-between" }}>
            <button
              type="button"
              className="s7-btn s7-btn--secondary"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
            >
              ← Back
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--primary"
              onClick={() => setStep((s) => Math.min(totalSteps - 1, s + 1))}
              disabled={!canNext()}
            >
              {step === totalSteps - 2 ? "Review →" : "Next →"}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}

type FieldInputProps = {
  field: TemplateField;
  value: FieldValue | undefined;
  onChange: (value: FieldValue) => void;
};

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const options = Array.isArray(field.optionsJson) ? (field.optionsJson as string[]) : [];
  return (
    <label className="form-submit__field">
      <span className="form-submit__label">
        {field.label}
        {field.isRequired ? <span style={{ color: "var(--status-danger)" }}> *</span> : null}
      </span>
      {field.fieldType === "textarea" ? (
        <textarea
          className="s7-textarea"
          rows={4}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? ""}
        />
      ) : field.fieldType === "checkbox" ? (
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : field.fieldType === "multiple_choice" ? (
        <select
          className="s7-select"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.fieldType === "signature" ? (
        <SignaturePad value={typeof value === "string" ? value : ""} onChange={onChange} />
      ) : field.fieldType === "image_capture" ? (
        <PhotoInput onChange={onChange} currentName={value instanceof File ? value.name : typeof value === "string" ? value : ""} />
      ) : field.fieldType === "file" ? (
        <PhotoInput onChange={onChange} currentName={value instanceof File ? value.name : typeof value === "string" ? value : ""} accept="*" />
      ) : (
        <input
          className="s7-input"
          type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
          value={typeof value === "string" || typeof value === "number" ? String(value) : ""}
          onChange={(e) => {
            const raw = e.target.value;
            if (field.fieldType === "number") {
              onChange(raw === "" ? null : Number(raw));
            } else {
              onChange(raw);
            }
          }}
          placeholder={field.placeholder ?? ""}
        />
      )}
      {field.helpText ? <span className="form-submit__help">{field.helpText}</span> : null}
    </label>
  );
}

type SignaturePadProps = {
  value: string;
  onChange: (value: string) => void;
};

function SignaturePad({ value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const rect = event.currentTarget.getBoundingClientRect();
    last.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !canvasRef.current || !last.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#0F1117";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    last.current = current;
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
    if (canvasRef.current) {
      onChange(canvasRef.current.toDataURL());
    }
  };
  const clear = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    onChange("");
  };

  return (
    <div className="form-submit__sig">
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span className="s7-type-label" style={{ fontSize: 11 }}>
          {value ? "Signed" : "Sign above"}
        </span>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}

type PhotoInputProps = {
  onChange: (value: FieldValue) => void;
  currentName?: string;
  accept?: string;
};

function PhotoInput({ onChange, currentName, accept = "image/*" }: PhotoInputProps) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  return (
    <div className="form-submit__photo">
      <input
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (file) {
            const url = URL.createObjectURL(file);
            setPreview(url);
            onChange(file);
          } else {
            setPreview(null);
            onChange(null);
          }
        }}
      />
      {preview ? (
        <img src={preview} alt="Preview" className="form-submit__photo-thumb" />
      ) : currentName ? (
        <span className="form-submit__photo-name">{currentName}</span>
      ) : null}
    </div>
  );
}
