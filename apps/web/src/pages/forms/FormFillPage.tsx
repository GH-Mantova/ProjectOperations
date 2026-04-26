import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// ── Types matching the engine response shape ─────────────────────────────

type FieldRule = {
  trigger: "on_change" | "on_load" | "on_submit";
  conditionGroup: ConditionGroup;
  actions: Array<{ type: string; target?: string; value?: unknown }>;
};

type Condition = {
  fieldKey: string;
  operator: string;
  value?: unknown;
  value2?: unknown;
};

type ConditionGroup = {
  logic: "AND" | "OR";
  conditions: Array<Condition | ConditionGroup>;
};

type Field = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
  helpText?: string | null;
  placeholder?: string | null;
  defaultValue?: string | null;
  config?: Record<string, unknown>;
  conditions?: FieldRule[];
};

type Section = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  fields: Field[];
};

type Submission = {
  id: string;
  status: string;
  submittedById?: string | null;
  context?: { jobId?: string; projectId?: string; supervisorId?: string } | null;
  values: Array<{
    fieldKey: string;
    valueText: string | null;
    valueNumber: string | number | null;
    valueBoolean: boolean | null;
    valueDateTime: string | null;
    valueJson: unknown;
    filePath: string | null;
  }>;
  templateVersion: {
    id: string;
    versionNumber: number;
    template: { id: string; name: string; category?: string | null };
    sections: Section[];
  };
};

type ValueMap = Record<string, unknown>;

// ── Local rules eval (mirrors RulesEngineService for live UI updates) ─────
// Server is still authoritative — this just keeps the form responsive while
// the user types so we don't roundtrip on every keystroke.

function isGroup(node: Condition | ConditionGroup): node is ConditionGroup {
  return (node as ConditionGroup).conditions !== undefined;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  return false;
}

function evalCondition(c: Condition, values: ValueMap): boolean {
  const actual = values[c.fieldKey];
  const expected = c.value;
  switch (c.operator) {
    case "equals":
      return actual == expected;
    case "not_equals":
      return actual != expected;
    case "contains":
      if (Array.isArray(actual)) return actual.includes(expected as never);
      return String(actual ?? "").includes(String(expected ?? ""));
    case "not_contains":
      if (Array.isArray(actual)) return !actual.includes(expected as never);
      return !String(actual ?? "").includes(String(expected ?? ""));
    case "greater_than": {
      const a = toNumber(actual), b = toNumber(expected);
      return a !== null && b !== null && a > b;
    }
    case "less_than": {
      const a = toNumber(actual), b = toNumber(expected);
      return a !== null && b !== null && a < b;
    }
    case "between": {
      const a = toNumber(actual), lo = toNumber(expected), hi = toNumber(c.value2);
      return a !== null && lo !== null && hi !== null && a >= lo && a <= hi;
    }
    case "is_empty":
      return isEmpty(actual);
    case "is_not_empty":
      return !isEmpty(actual);
    case "is_one_of":
      return Array.isArray(expected) && expected.includes(actual as never);
    case "is_not_one_of":
      return Array.isArray(expected) && !expected.includes(actual as never);
    default:
      return false;
  }
}

function evalGroup(g: ConditionGroup, values: ValueMap): boolean {
  if (!g || !Array.isArray(g.conditions) || g.conditions.length === 0) return true;
  const evals = g.conditions.map((n) => (isGroup(n) ? evalGroup(n, values) : evalCondition(n, values)));
  return g.logic === "OR" ? evals.some(Boolean) : evals.every(Boolean);
}

function fieldVisible(field: Field, values: ValueMap): boolean {
  const rules = field.conditions ?? [];
  if (rules.length === 0) return true;
  for (const rule of rules) {
    if (!evalGroup(rule.conditionGroup, values)) continue;
    for (const action of rule.actions) {
      if (action.type === "hide") return false;
      if (action.type === "show") return true;
    }
  }
  return true;
}

function fieldRequired(field: Field, values: ValueMap): boolean {
  const rules = field.conditions ?? [];
  if (rules.length === 0) return field.isRequired;
  let required = field.isRequired;
  for (const rule of rules) {
    if (!evalGroup(rule.conditionGroup, values)) continue;
    for (const action of rule.actions) {
      if (action.type === "require") required = true;
      else if (action.type === "unrequire") required = false;
    }
  }
  return required;
}

// ── Initial values from the persisted submission rows ────────────────────

function buildInitialValues(submission: Submission): ValueMap {
  const out: ValueMap = {};
  for (const v of submission.values) {
    if (v.valueText !== null) out[v.fieldKey] = v.valueText;
    else if (v.valueNumber !== null) out[v.fieldKey] = Number(v.valueNumber);
    else if (v.valueBoolean !== null) out[v.fieldKey] = v.valueBoolean;
    else if (v.valueDateTime !== null) out[v.fieldKey] = v.valueDateTime;
    else if (v.valueJson !== null) out[v.fieldKey] = v.valueJson;
    else if (v.filePath !== null) out[v.fieldKey] = v.filePath;
  }
  return out;
}

const DRAFT_KEY = (id: string) => `forms.draft.${id}`;

// ── Component ────────────────────────────────────────────────────────────

export function FormFillPage() {
  const { submissionId } = useParams<{ submissionId: string }>();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [values, setValues] = useState<ValueMap>({});
  const [sectionIndex, setSectionIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ ref: string; created: { type: string; id: string }[] } | null>(null);
  const [gps, setGps] = useState<{ lat?: number; lng?: number; status: "idle" | "loading" | "ok" | "error"; message?: string }>({ status: "idle" });
  const [online, setOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const saveTimerRef = useRef<number | null>(null);

  // Online/offline tracking
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOn = () => setOnline(true);
    const onOff = () => setOnline(false);
    window.addEventListener("online", onOn);
    window.addEventListener("offline", onOff);
    return () => {
      window.removeEventListener("online", onOn);
      window.removeEventListener("offline", onOff);
    };
  }, []);

  // Load submission + template
  useEffect(() => {
    if (!submissionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/forms/submissions/${submissionId}`);
        if (!res.ok) throw new Error(await res.text());
        const body = (await res.json()) as Submission;
        if (cancelled) return;
        setSubmission(body);
        // Merge any locally-saved offline draft on top of server-side values so
        // the worker's in-flight edits aren't lost when they reconnect.
        const initial = buildInitialValues(body);
        try {
          const draftRaw = localStorage.getItem(DRAFT_KEY(body.id));
          if (draftRaw) {
            const draft = JSON.parse(draftRaw) as { values: ValueMap; sectionIndex?: number };
            setValues({ ...initial, ...(draft.values ?? {}) });
            if (typeof draft.sectionIndex === "number") setSectionIndex(draft.sectionIndex);
          } else {
            setValues(initial);
          }
        } catch {
          setValues(initial);
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authFetch, submissionId]);

  const sections = useMemo(() => {
    if (!submission) return [] as Section[];
    return [...submission.templateVersion.sections].sort((a, b) => a.sectionOrder - b.sectionOrder);
  }, [submission]);

  const currentSection = sections[sectionIndex];

  // Auto-save (debounced) — local first, server when online
  const persistDraft = useCallback(
    async (next: ValueMap, idx: number) => {
      if (!submission) return;
      try {
        localStorage.setItem(DRAFT_KEY(submission.id), JSON.stringify({ values: next, sectionIndex: idx }));
      } catch {
        // localStorage may be full / disabled — silent
      }
      if (!online) {
        setSaveStatus("saved");
        return;
      }
      setSaveStatus("saving");
      try {
        const res = await authFetch(`/forms/submissions/${submission.id}/values`, {
          method: "PATCH",
          body: JSON.stringify({ values: next })
        });
        if (!res.ok) throw new Error(await res.text());
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    },
    [authFetch, online, submission]
  );

  const scheduleSave = useCallback(
    (next: ValueMap, idx: number) => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        void persistDraft(next, idx);
      }, 700);
    },
    [persistDraft]
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

  // GPS auto-capture once on mount
  useEffect(() => {
    if (!submission) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGps({ status: "error", message: "Geolocation not supported on this device." });
      return;
    }
    setGps({ status: "loading" });
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ status: "ok", lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGps({ status: "error", message: err.message }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
    );
  }, [submission?.id]);

  // Reconnect: flush local draft to server
  useEffect(() => {
    if (online && submission && saveStatus === "error") {
      void persistDraft(values, sectionIndex);
    }
  }, [online, submission, saveStatus, persistDraft, values, sectionIndex]);

  const setValue = (fieldKey: string, value: unknown) => {
    const next = { ...values, [fieldKey]: value };
    setValues(next);
    if (errors[fieldKey]) {
      setErrors((prev) => {
        const out = { ...prev };
        delete out[fieldKey];
        return out;
      });
    }
    scheduleSave(next, sectionIndex);
  };

  const visibleFields = useMemo(() => {
    if (!currentSection) return [] as Field[];
    return currentSection.fields
      .slice()
      .sort((a, b) => a.fieldOrder - b.fieldOrder)
      .filter((f) => fieldVisible(f, values));
  }, [currentSection, values]);

  const validateSection = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const f of visibleFields) {
      if (fieldRequired(f, values) && isEmpty(values[f.fieldKey])) {
        newErrors[f.fieldKey] = `${f.label} is required.`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (!validateSection()) return;
    if (sectionIndex < sections.length - 1) {
      const next = sectionIndex + 1;
      setSectionIndex(next);
      scheduleSave(values, next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goPrev = () => {
    if (sectionIndex > 0) {
      const prev = sectionIndex - 1;
      setSectionIndex(prev);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const submit = async () => {
    if (!submission) return;
    // Validate ALL sections before submitting
    const allErrors: Record<string, string> = {};
    let firstErrorSection = -1;
    for (let i = 0; i < sections.length; i++) {
      for (const f of sections[i].fields ?? []) {
        if (!fieldVisible(f, values)) continue;
        if (fieldRequired(f, values) && isEmpty(values[f.fieldKey])) {
          allErrors[f.fieldKey] = `${f.label} is required.`;
          if (firstErrorSection === -1) firstErrorSection = i;
        }
      }
    }
    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      if (firstErrorSection >= 0) setSectionIndex(firstErrorSection);
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      // Flush any pending values first
      await persistDraft(values, sectionIndex);
      const res = await authFetch(`/forms/submissions/${submission.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ gpsLat: gps.lat, gpsLng: gps.lng })
      });
      if (res.status === 422) {
        const body = await res.json();
        if (body?.errors) {
          setErrors(body.errors as Record<string, string>);
        } else if (Array.isArray(body?.complianceFailures)) {
          setError(body.complianceFailures.join(" "));
        } else {
          setError("Validation failed.");
        }
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const body = (await res.json()) as { id: string; triggeredRecords?: Array<{ recordType: string; recordId: string }> };
      try {
        localStorage.removeItem(DRAFT_KEY(submission.id));
      } catch {
        // ignore
      }
      setSubmitted({
        ref: body.id,
        created: (body.triggeredRecords ?? []).map((r) => ({ type: r.recordType, id: r.recordId }))
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return <SubmittedSuccess submitted={submitted} onDone={() => navigate("/forms")} />;
  }

  if (error && !submission) {
    return (
      <div style={{ padding: 24 }}>
        <p style={{ color: "var(--status-danger)" }}>{error}</p>
        <Link to="/forms" className="s7-btn s7-btn--ghost">
          ← Back to forms
        </Link>
      </div>
    );
  }

  if (!submission || !currentSection) {
    return <div style={{ padding: 24, color: "var(--text-muted)" }}>Loading…</div>;
  }

  const progressPct = Math.round(((sectionIndex + 1) / sections.length) * 100);
  const isLastSection = sectionIndex === sections.length - 1;
  const ctx = submission.context ?? {};

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "16px 16px 96px", display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Sticky header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--surface-app, #fff)",
          zIndex: 20,
          paddingTop: 4,
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <Link to="/forms" className="s7-btn s7-btn--ghost s7-btn--sm" aria-label="Back to forms">
            ←
          </Link>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1, textAlign: "center" }}>
            {submission.templateVersion.template.name}
          </h1>
          <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 70, textAlign: "right" }}>
            {saveStatus === "saving"
              ? "Saving…"
              : saveStatus === "saved"
                ? "✓ Saved"
                : saveStatus === "error"
                  ? "⚠ Not saved"
                  : ""}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Section {sectionIndex + 1} of {sections.length}
          </span>
          <div style={{ flex: 1, height: 4, background: "var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: 999, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#FEAA6D",
                transition: "width 200ms ease"
              }}
            />
          </div>
        </div>
      </header>

      {!online ? (
        <div style={{ padding: "8px 12px", background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 12 }}>
          📴 Offline — your progress is saved locally and will sync when you reconnect.
        </div>
      ) : null}

      {(ctx.jobId || ctx.projectId || ctx.supervisorId) ? (
        <details className="s7-card" style={{ padding: "8px 12px" }}>
          <summary style={{ cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>
            Context
          </summary>
          <div style={{ fontSize: 12, marginTop: 6, color: "var(--text-muted)" }}>
            {ctx.jobId ? <div>Job ID: {ctx.jobId}</div> : null}
            {ctx.projectId ? <div>Project ID: {ctx.projectId}</div> : null}
            {ctx.supervisorId ? <div>Supervisor ID: {ctx.supervisorId}</div> : null}
          </div>
        </details>
      ) : null}

      <section>
        <h2 style={{ color: "#005B61", fontSize: 18, margin: "8px 0" }}>{currentSection.title}</h2>
        {currentSection.description ? (
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 0 }}>{currentSection.description}</p>
        ) : null}

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {visibleFields.map((field) => {
            const required = fieldRequired(field, values);
            const errorMsg = errors[field.fieldKey];
            return (
              <FieldRender
                key={field.id}
                field={field}
                required={required}
                value={values[field.fieldKey]}
                onChange={(v) => setValue(field.fieldKey, v)}
                error={errorMsg}
                context={ctx as Record<string, string | undefined>}
                gps={gps}
              />
            );
          })}
        </div>
      </section>

      {error ? <p style={{ color: "var(--status-danger)", fontSize: 13 }}>{error}</p> : null}

      {/* Footer nav */}
      <footer
        style={{
          position: "sticky",
          bottom: 0,
          background: "var(--surface-app, #fff)",
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
          display: "flex",
          gap: 8,
          justifyContent: "space-between"
        }}
      >
        <button
          type="button"
          className="s7-btn s7-btn--ghost"
          onClick={goPrev}
          disabled={sectionIndex === 0}
        >
          ← Previous
        </button>
        {isLastSection ? (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D", minWidth: 140 }}
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}
            onClick={goNext}
          >
            Next →
          </button>
        )}
      </footer>
    </div>
  );
}

// ── Field renderer (covers most-used types; advanced types fall back) ─────

function FieldRender({
  field,
  required,
  value,
  onChange,
  error,
  context,
  gps
}: {
  field: Field;
  required: boolean;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  context: Record<string, string | undefined>;
  gps: { lat?: number; lng?: number; status: string; message?: string };
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const options = (config.options ?? []) as string[];

  // Layout fields render without label scaffolding
  if (field.fieldType === "section_header") {
    return <h3 style={{ margin: "12px 0 4px", color: "#005B61", fontSize: 16 }}>{field.label}</h3>;
  }
  if (field.fieldType === "divider") {
    return <hr style={{ border: 0, borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }} />;
  }
  if (field.fieldType === "instructions") {
    return (
      <div style={{ background: "var(--surface-muted, #F6F6F6)", padding: 12, borderRadius: 6, fontSize: 13 }}>
        {field.helpText ?? field.label}
      </div>
    );
  }

  return (
    <div>
      <label style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
        {field.label}
        {required ? <span style={{ color: "#FEAA6D", marginLeft: 4 }}>*</span> : null}
      </label>
      {field.helpText ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 6px" }}>{field.helpText}</p>
      ) : null}
      <FieldInput field={field} value={value} onChange={onChange} options={options} context={context} gps={gps} />
      {error ? <p style={{ fontSize: 11, color: "var(--status-danger, #DC2626)", marginTop: 4 }}>{error}</p> : null}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  options,
  context,
  gps
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  options: string[];
  context: Record<string, string | undefined>;
  gps: { lat?: number; lng?: number; status: string; message?: string };
}) {
  const t = field.fieldType;
  const config = (field.config ?? {}) as Record<string, unknown>;

  switch (t) {
    case "short_text":
    case "url":
      return (
        <input
          type="text"
          className="s7-input"
          placeholder={field.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "long_text":
      return (
        <textarea
          className="s7-textarea"
          rows={3}
          placeholder={field.placeholder ?? ""}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "email":
      return (
        <input
          type="email"
          inputMode="email"
          className="s7-input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "phone":
      return (
        <input
          type="tel"
          inputMode="tel"
          className="s7-input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "number":
      return (
        <input
          type="number"
          inputMode="decimal"
          className="s7-input"
          value={(value as number | string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "currency":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ color: "var(--text-muted)" }}>$</span>
          <input
            type="number"
            inputMode="decimal"
            className="s7-input"
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            style={{ flex: 1, fontSize: 14, padding: 10 }}
          />
        </div>
      );
    case "percentage":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="number"
            inputMode="decimal"
            className="s7-input"
            value={(value as number | string) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            style={{ flex: 1, fontSize: 14, padding: 10 }}
          />
          <span style={{ color: "var(--text-muted)" }}>%</span>
        </div>
      );
    case "date":
      return (
        <input
          type="date"
          className="s7-input"
          value={dateInputValue(value, "date")}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "time":
      return (
        <input
          type="time"
          className="s7-input"
          value={dateInputValue(value, "time")}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "datetime":
      return (
        <input
          type="datetime-local"
          className="s7-input"
          value={dateInputValue(value, "datetime")}
          onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        />
      );
    case "dropdown":
      return (
        <select
          className="s7-input"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          style={{ width: "100%", fontSize: 14, padding: 10 }}
        >
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case "multi_select":
    case "checkbox": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => {
            const checked = arr.includes(o);
            return (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const next = e.target.checked ? [...arr, o] : arr.filter((x) => x !== o);
                    onChange(next);
                  }}
                  style={{ width: 20, height: 20 }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    }
    case "radio":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {options.map((o) => {
            const checked = value === o;
            return (
              <label key={o} style={{ display: "flex", alignItems: "center", gap: 8, padding: 8, fontSize: 14 }}>
                <input
                  type="radio"
                  name={field.fieldKey}
                  checked={checked}
                  onChange={() => onChange(o)}
                  style={{ width: 20, height: 20 }}
                />
                {o}
              </label>
            );
          })}
        </div>
      );
    case "toggle": {
      const v = Boolean(value);
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, cursor: "pointer" }}>
          <button
            type="button"
            role="switch"
            aria-checked={v}
            onClick={() => onChange(!v)}
            style={{
              width: 48,
              height: 28,
              borderRadius: 999,
              background: v ? "#FEAA6D" : "#CBD5E1",
              border: "none",
              position: "relative",
              padding: 0,
              cursor: "pointer"
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: v ? 23 : 3,
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 120ms ease"
              }}
            />
          </button>
          <span>{v ? "Yes" : "No"}</span>
        </label>
      );
    }
    case "button_group":
      return (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {options.map((o) => {
            const active = value === o;
            return (
              <button
                key={o}
                type="button"
                onClick={() => onChange(o)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid",
                  borderColor: active ? "#FEAA6D" : "var(--border-subtle, rgba(0,0,0,0.12))",
                  background: active ? "#FEAA6D" : "var(--surface-card, #fff)",
                  color: active ? "#242424" : "var(--text-default)",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                {o}
              </button>
            );
          })}
        </div>
      );
    case "rating": {
      const max = Number(config.maxRating ?? 5);
      const rating = Number(value ?? 0);
      return (
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} stars`}
              onClick={() => onChange(n)}
              style={{
                width: 40,
                height: 40,
                fontSize: 28,
                background: "transparent",
                border: "none",
                color: rating >= n ? "#FEAA6D" : "#CBD5E1",
                cursor: "pointer"
              }}
            >
              ★
            </button>
          ))}
        </div>
      );
    }
    case "system_field": {
      const source = String(config.source ?? "");
      const lookup: Record<string, string | undefined> = {
        job: context.jobId,
        project: context.projectId,
        supervisor: context.supervisorId,
        worker: undefined
      };
      const display = lookup[source] ?? "(auto)";
      return (
        <div
          style={{
            padding: 10,
            background: "var(--surface-muted, #F6F6F6)",
            borderRadius: 6,
            fontSize: 13,
            display: "flex",
            justifyContent: "space-between"
          }}
        >
          <span>{display}</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>auto</span>
        </div>
      );
    }
    case "gps":
      return (
        <div style={{ padding: 10, background: "var(--surface-muted, #F6F6F6)", borderRadius: 6, fontSize: 13 }}>
          {gps.status === "loading"
            ? "📍 Getting location…"
            : gps.status === "ok"
              ? `📍 ${gps.lat?.toFixed(5)}, ${gps.lng?.toFixed(5)}`
              : `📍 ${gps.message ?? "Location unavailable"}`}
        </div>
      );
    case "address": {
      const v = (value as Record<string, string> | null) ?? { street: "", suburb: "", state: "QLD", postcode: "" };
      return (
        <div style={{ display: "grid", gap: 6 }}>
          <input className="s7-input" placeholder="Street" value={v.street ?? ""} onChange={(e) => onChange({ ...v, street: e.target.value })} style={{ padding: 10 }} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 6 }}>
            <input className="s7-input" placeholder="Suburb" value={v.suburb ?? ""} onChange={(e) => onChange({ ...v, suburb: e.target.value })} style={{ padding: 10 }} />
            <input className="s7-input" placeholder="State" value={v.state ?? "QLD"} onChange={(e) => onChange({ ...v, state: e.target.value })} style={{ padding: 10 }} />
            <input className="s7-input" placeholder="Postcode" value={v.postcode ?? ""} onChange={(e) => onChange({ ...v, postcode: e.target.value })} style={{ padding: 10 }} />
          </div>
        </div>
      );
    }
    case "signature":
      return <SignaturePad value={value as string | null} onChange={onChange} />;
    case "photo":
    case "file":
      return <PhotoInput value={value as string[] | null} onChange={onChange} maxCount={Number(config.maxCount ?? 5)} />;
    default:
      // matrix, lookup, barcode, slider, nps, likert, calculation — defer
      return (
        <div style={{ padding: 10, background: "#FEF3C7", color: "#92400E", borderRadius: 6, fontSize: 12 }}>
          Field type "{t}" — fill on a desktop browser (advanced field types in next release).
        </div>
      );
  }
}

function dateInputValue(value: unknown, kind: "date" | "time" | "datetime"): string {
  if (!value) return "";
  if (typeof value === "string") {
    if (kind === "date") return value.slice(0, 10);
    if (kind === "time") return value.length > 5 ? value.slice(11, 16) : value;
    return value.slice(0, 16);
  }
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    if (kind === "date") return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    if (kind === "time") return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
  }
  return "";
}

// ── Signature pad ────────────────────────────────────────────────────────

function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = value;
  }, [value]);

  const getPos = (e: PointerEvent | React.PointerEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.strokeStyle = "#242424";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const onPointerUp = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  };
  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={600}
        height={160}
        style={{
          width: "100%",
          height: 160,
          border: "1px dashed var(--border-subtle, rgba(0,0,0,0.2))",
          borderRadius: 6,
          background: "#fff",
          touchAction: "none"
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Sign above</span>
        <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={clear}>
          Clear
        </button>
      </div>
    </div>
  );
}

// ── Photo / file input — stores as base64 strings in valueJson ───────────

function PhotoInput({
  value,
  onChange,
  maxCount
}: {
  value: string[] | null;
  onChange: (v: string[] | null) => void;
  maxCount: number;
}) {
  const photos = Array.isArray(value) ? value : [];
  const inputRef = useRef<HTMLInputElement | null>(null);

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= maxCount) break;
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      next.push(data);
    }
    onChange(next.length > 0 ? next : null);
  };

  const remove = (idx: number) => {
    const next = photos.filter((_, i) => i !== idx);
    onChange(next.length > 0 ? next : null);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: "none" }}
        onChange={(e) => void onFiles(e.target.files)}
      />
      <button
        type="button"
        className="s7-btn s7-btn--secondary"
        onClick={() => inputRef.current?.click()}
        disabled={photos.length >= maxCount}
        style={{ width: "100%", padding: 12 }}
      >
        📷 {photos.length === 0 ? "Take photo / attach" : `Add another (${photos.length}/${maxCount})`}
      </button>
      {photos.length > 0 ? (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {photos.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={src}
                alt={`Attachment ${i + 1}`}
                style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}
              />
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label="Remove"
                style={{
                  position: "absolute",
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  background: "#DC2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  fontSize: 12,
                  cursor: "pointer"
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ── Success screen ───────────────────────────────────────────────────────

function SubmittedSuccess({
  submitted,
  onDone
}: {
  submitted: { ref: string; created: { type: string; id: string }[] };
  onDone: () => void;
}) {
  return (
    <div style={{ padding: 32, maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
      <div
        aria-hidden
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: "#16A34A",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px",
          fontSize: 40
        }}
      >
        ✓
      </div>
      <h2 style={{ margin: "0 0 6px", fontSize: 22 }}>Form submitted</h2>
      <p style={{ color: "var(--text-muted)", fontSize: 13, margin: "0 0 16px" }}>
        Reference: {submitted.ref}
      </p>
      {submitted.created.length > 0 ? (
        <div style={{ background: "var(--surface-muted, #F6F6F6)", padding: 12, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
          <strong>This submission created:</strong>
          <ul style={{ margin: "6px 0 0", padding: "0 0 0 18px" }}>
            {submitted.created.map((r) => (
              <li key={r.id}>{r.type.replace(/_/g, " ")} — {r.id.slice(0, 8)}…</li>
            ))}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        className="s7-btn s7-btn--primary"
        onClick={onDone}
        style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D", padding: "10px 24px" }}
      >
        Done
      </button>
    </div>
  );
}
