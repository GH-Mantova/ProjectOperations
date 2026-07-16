import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

// ── Types ────────────────────────────────────────────────────────────────

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

type PublicField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired: boolean;
  helpText?: string | null;
  placeholder?: string | null;
  defaultValue?: string | null;
  optionsJson?: unknown;
  config?: Record<string, unknown>;
  conditions?: FieldRule[];
};

type PublicSection = {
  id: string;
  title: string;
  description?: string | null;
  sectionOrder: number;
  fields: PublicField[];
};

type PublicTemplatePayload = {
  linkId: string;
  mode: string;
  templateName: string;
  templateCode: string;
  templateCategory: string;
  versionId: string;
  versionNumber: number;
  sections: PublicSection[];
  siteId?: string | null;
  jobId?: string | null;
};

type ValueMap = Record<string, unknown>;

// ── Local rules eval (mirrors FormFillPage) ───────────────────────────────

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
    case "equals": return actual == expected;
    case "not_equals": return actual != expected;
    case "is_empty": return isEmpty(actual);
    case "is_not_empty": return !isEmpty(actual);
    case "contains":
      if (Array.isArray(actual)) return actual.includes(expected as never);
      return String(actual ?? "").includes(String(expected ?? ""));
    case "not_contains":
      if (Array.isArray(actual)) return !actual.includes(expected as never);
      return !String(actual ?? "").includes(String(expected ?? ""));
    case "greater_than": {
      const va = toNumber(actual), vb = toNumber(expected);
      return va !== null && vb !== null && va > vb;
    }
    case "less_than": {
      const va = toNumber(actual), vb = toNumber(expected);
      return va !== null && vb !== null && va < vb;
    }
    case "is_one_of":
      return Array.isArray(expected) && expected.includes(actual as never);
    default: return false;
  }
}

function evalGroup(g: ConditionGroup, values: ValueMap): boolean {
  if (!g || !Array.isArray(g.conditions) || g.conditions.length === 0) return true;
  const evals = g.conditions.map((n) =>
    isGroup(n) ? evalGroup(n, values) : evalCondition(n, values)
  );
  return g.logic === "OR" ? evals.some(Boolean) : evals.every(Boolean);
}

function fieldVisible(field: PublicField, values: ValueMap): boolean {
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

function fieldRequired(field: PublicField, values: ValueMap): boolean {
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

// ── Component ────────────────────────────────────────────────────────────

/**
 * Public / Kiosk form fill page — no authentication required.
 *
 * Fetches the blank template via GET /api/forms/public/:token
 * and submits via POST /api/forms/public/:token/submit.
 *
 * In kiosk mode: auto-resets after a successful submit so the next
 * person can fill the form on the same shared device.
 */
export function PublicFormFillPage() {
  const { token } = useParams<{ token: string }>();

  const [payload, setPayload] = useState<PublicTemplatePayload | null>(null);
  const [values, setValues] = useState<ValueMap>({});
  const [submitterName, setSubmitterName] = useState("");
  const [sectionIndex, setSectionIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [kioskCountdown, setKioskCountdown] = useState<number | null>(null);

  // Fetch the blank template
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    fetch(`/api/forms/public/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<PublicTemplatePayload>;
      })
      .then((data) => {
        setPayload(data);
        // Seed default values
        const defaults: ValueMap = {};
        for (const section of data.sections) {
          for (const field of section.fields) {
            if (field.defaultValue !== null && field.defaultValue !== undefined) {
              defaults[field.fieldKey] = field.defaultValue;
            }
          }
        }
        setValues(defaults);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const currentSection = payload?.sections[sectionIndex];
  const totalSections = payload?.sections.length ?? 0;

  const visibleFields = useMemo(
    () => (currentSection?.fields ?? []).filter((f) => fieldVisible(f, values)),
    [currentSection, values]
  );

  const handleChange = useCallback((fieldKey: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleBack = () => {
    if (sectionIndex > 0) setSectionIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (!currentSection) return;
    const missing = currentSection.fields
      .filter((f) => fieldVisible(f, values) && fieldRequired(f, values))
      .filter((f) => {
        const val = values[f.fieldKey];
        return val === null || val === undefined || val === "";
      });
    if (missing.length > 0) {
      setSubmitError(`Please fill in: ${missing.map((f) => f.label).join(", ")}`);
      return;
    }
    setSubmitError(null);
    setSectionIndex((i) => i + 1);
  };

  const handleSubmit = async () => {
    if (!token || !payload) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/forms/public/${token}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values,
          submitterName: submitterName.trim() || undefined
        })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Submit failed (HTTP ${res.status})`);
      }
      setSubmitted(true);

      // Kiosk mode: auto-reset after 8 seconds
      if (payload.mode === "kiosk") {
        setKioskCountdown(8);
      }
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // Kiosk countdown timer
  useEffect(() => {
    if (kioskCountdown === null || kioskCountdown <= 0) {
      if (kioskCountdown === 0) {
        // Reset for next person
        setSubmitted(false);
        setValues({});
        setSubmitterName("");
        setSectionIndex(0);
        setSubmitError(null);
        setKioskCountdown(null);
      }
      return;
    }
    const timer = setTimeout(() => setKioskCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(timer);
  }, [kioskCountdown]);

  const isKiosk = payload?.mode === "kiosk";
  const isLastSection = sectionIndex === totalSections - 1;

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PublicShell title="Loading form...">
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted, #6B7280)" }}>
          Loading form...
        </div>
      </PublicShell>
    );
  }

  if (error) {
    return (
      <PublicShell title="Form unavailable">
        <div
          role="alert"
          style={{
            padding: 20,
            background: "#FEE2E2",
            color: "#991B1B",
            borderRadius: 8,
            fontSize: 14
          }}
        >
          <strong>This form is not available.</strong>
          <p style={{ margin: "8px 0 0" }}>{error}</p>
        </div>
      </PublicShell>
    );
  }

  if (!payload) return null;

  if (submitted) {
    return (
      <PublicShell title={payload.templateName}>
        <div
          style={{
            textAlign: "center",
            padding: 40,
            background: "#F0FDF4",
            borderRadius: 12,
            border: "1px solid #86EFAC"
          }}
        >
          <div style={{ fontSize: 48 }}>&#10003;</div>
          <h2 style={{ margin: "12px 0 8px", color: "#166534" }}>Submitted successfully</h2>
          <p style={{ color: "#15803D", margin: 0 }}>Thank you. Your response has been recorded.</p>
          {isKiosk && kioskCountdown !== null && (
            <p style={{ marginTop: 16, color: "#6B7280", fontSize: 13 }}>
              Resetting for next person in {kioskCountdown}s...
            </p>
          )}
          {isKiosk && (
            <button
              type="button"
              style={{
                marginTop: 20,
                padding: "10px 28px",
                background: "#FEAA6D",
                color: "#242424",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14
              }}
              onClick={() => {
                setSubmitted(false);
                setValues({});
                setSubmitterName("");
                setSectionIndex(0);
                setSubmitError(null);
                setKioskCountdown(null);
              }}
            >
              Fill again (next person)
            </button>
          )}
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell title={payload.templateName}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 700,
            color: "#005B61"
          }}
        >
          {payload.templateName}
        </h1>
        {isKiosk && (
          <span
            style={{
              display: "inline-block",
              marginTop: 6,
              padding: "3px 10px",
              background: "#005B61",
              color: "#fff",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: 0.5
            }}
          >
            Kiosk mode
          </span>
        )}
      </div>

      {/* Section progress */}
      {totalSections > 1 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              fontSize: 12,
              color: "#6B7280",
              marginBottom: 6
            }}
          >
            <span>
              Section {sectionIndex + 1} of {totalSections}
            </span>
            <span style={{ marginLeft: "auto" }}>{currentSection?.title}</span>
          </div>
          <div
            style={{
              height: 4,
              background: "#E5E7EB",
              borderRadius: 2,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${((sectionIndex + 1) / totalSections) * 100}%`,
                background: "#005B61",
                transition: "width 0.3s ease"
              }}
            />
          </div>
        </div>
      )}

      {/* Section title */}
      {currentSection && (
        <div style={{ marginBottom: 16 }}>
          {totalSections === 1 && (
            <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 600 }}>
              {currentSection.title}
            </h2>
          )}
          {currentSection.description && (
            <p style={{ margin: 0, fontSize: 13, color: "#6B7280" }}>
              {currentSection.description}
            </p>
          )}
        </div>
      )}

      {/* Submitter name field (shown on first section of kiosk forms) */}
      {sectionIndex === 0 && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontWeight: 500, fontSize: 13, marginBottom: 4 }}>
            Your name <span style={{ color: "#9CA3AF", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            type="text"
            value={submitterName}
            onChange={(e) => setSubmitterName(e.target.value)}
            placeholder="Enter your name..."
            style={{
              width: "100%",
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #D1D5DB",
              fontSize: 14,
              boxSizing: "border-box"
            }}
          />
        </div>
      )}

      {/* Fields */}
      {visibleFields.map((field) => (
        <PublicFieldRenderer
          key={field.fieldKey}
          field={field}
          value={values[field.fieldKey]}
          required={fieldRequired(field, values)}
          onChange={(val) => handleChange(field.fieldKey, val)}
        />
      ))}

      {submitError && (
        <div
          role="alert"
          style={{
            marginTop: 12,
            padding: 10,
            background: "#FEE2E2",
            color: "#991B1B",
            borderRadius: 6,
            fontSize: 13
          }}
        >
          {submitError}
        </div>
      )}

      {/* Navigation */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 24,
          justifyContent: "space-between"
        }}
      >
        <button
          type="button"
          disabled={sectionIndex === 0}
          onClick={handleBack}
          style={{
            padding: "10px 20px",
            borderRadius: 6,
            border: "1px solid #D1D5DB",
            background: "#fff",
            color: "#374151",
            fontSize: 14,
            cursor: sectionIndex === 0 ? "not-allowed" : "pointer",
            opacity: sectionIndex === 0 ? 0.4 : 1
          }}
        >
          Back
        </button>

        {isLastSection ? (
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleSubmit()}
            style={{
              padding: "10px 28px",
              borderRadius: 6,
              border: "none",
              background: "#FEAA6D",
              color: "#242424",
              fontWeight: 700,
              fontSize: 14,
              cursor: submitting ? "wait" : "pointer"
            }}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            style={{
              padding: "10px 28px",
              borderRadius: 6,
              border: "none",
              background: "#005B61",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer"
            }}
          >
            Next
          </button>
        )}
      </div>
    </PublicShell>
  );
}

// ── Shell ────────────────────────────────────────────────────────────────

function PublicShell({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#F6F6F6",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "24px 16px 40px"
      }}
    >
      {/* Branded header bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 10
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            background: "#005B61",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14
          }}
        >
          IS
        </div>
        <span style={{ fontSize: 13, color: "#6B7280" }}>Initial Services</span>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 640,
          background: "#fff",
          borderRadius: 12,
          boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
          padding: "28px 24px"
        }}
      >
        {children}
      </div>

      <p style={{ marginTop: 20, fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
        Powered by Initial Services ProjectOperations
      </p>
    </div>
  );
}

// ── Field renderer for public forms ──────────────────────────────────────

function PublicFieldRenderer({
  field,
  value,
  required,
  onChange
}: {
  field: PublicField;
  value: unknown;
  required: boolean;
  onChange: (val: unknown) => void;
}) {
  const strVal = value !== null && value !== undefined ? String(value) : "";
  const numVal = typeof value === "number" ? value : Number(value) || 0;
  const boolVal = Boolean(value);

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid #D1D5DB",
    fontSize: 14,
    boxSizing: "border-box",
    fontFamily: "inherit"
  };

  const labelEl = (
    <label
      style={{
        display: "block",
        fontWeight: 500,
        fontSize: 13,
        marginBottom: 4,
        color: "#111827"
      }}
    >
      {field.label}
      {required ? <span style={{ color: "#DC2626", marginLeft: 3 }}>*</span> : null}
    </label>
  );

  const helpEl = field.helpText ? (
    <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9CA3AF" }}>{field.helpText}</p>
  ) : null;

  const wrap = (input: React.ReactNode) => (
    <div style={{ marginBottom: 18 }}>
      {labelEl}
      {input}
      {helpEl}
    </div>
  );

  switch (field.fieldType) {
    case "text":
    case "email":
    case "phone":
    case "url":
      return wrap(
        <input
          type={field.fieldType === "email" ? "email" : field.fieldType === "url" ? "url" : "text"}
          value={strVal}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );

    case "textarea":
      return wrap(
        <textarea
          value={strVal}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          style={{ ...inputStyle, resize: "vertical" }}
        />
      );

    case "number":
    case "currency":
    case "percentage":
      return wrap(
        <input
          type="number"
          value={strVal}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          style={inputStyle}
        />
      );

    case "date":
      return wrap(
        <input
          type="date"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );

    case "datetime":
      return wrap(
        <input
          type="datetime-local"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );

    case "time":
      return wrap(
        <input
          type="time"
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );

    case "toggle":
    case "checkbox":
      return (
        <div style={{ marginBottom: 18 }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              fontSize: 14,
              color: "#111827"
            }}
          >
            <input
              type="checkbox"
              checked={boolVal}
              onChange={(e) => onChange(e.target.checked)}
              style={{ width: 18, height: 18 }}
            />
            {field.label}
            {required ? <span style={{ color: "#DC2626" }}>*</span> : null}
          </label>
          {helpEl}
        </div>
      );

    case "select":
    case "dropdown": {
      const opts = (field.optionsJson as { label?: string; value: string }[] | undefined) ?? [];
      return wrap(
        <select
          value={strVal}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        >
          <option value="">-- Select --</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label ?? o.value}
            </option>
          ))}
        </select>
      );
    }

    case "radio": {
      const opts = (field.optionsJson as { label?: string; value: string }[] | undefined) ?? [];
      return wrap(
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {opts.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              <input
                type="radio"
                name={field.fieldKey}
                value={o.value}
                checked={strVal === o.value}
                onChange={() => onChange(o.value)}
              />
              {o.label ?? o.value}
            </label>
          ))}
        </div>
      );
    }

    case "multi_select":
    case "checkbox_group": {
      const opts = (field.optionsJson as { label?: string; value: string }[] | undefined) ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {opts.map((o) => (
            <label
              key={o.value}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
                fontSize: 14
              }}
            >
              <input
                type="checkbox"
                checked={selected.includes(o.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange([...selected, o.value]);
                  } else {
                    onChange(selected.filter((v) => v !== o.value));
                  }
                }}
              />
              {o.label ?? o.value}
            </label>
          ))}
        </div>
      );
    }

    case "rating":
    case "nps": {
      const cfg = field.config ?? {};
      const max = typeof cfg["max"] === "number" ? cfg["max"] : 5;
      return wrap(
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                width: 40,
                height: 40,
                borderRadius: 6,
                border: "1px solid",
                borderColor: numVal === n ? "#005B61" : "#D1D5DB",
                background: numVal === n ? "#005B61" : "#fff",
                color: numVal === n ? "#fff" : "#374151",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer"
              }}
            >
              {n}
            </button>
          ))}
        </div>
      );
    }

    case "signature":
      return wrap(
        <div
          style={{
            padding: 12,
            border: "1px dashed #D1D5DB",
            borderRadius: 6,
            fontSize: 13,
            color: "#9CA3AF",
            textAlign: "center"
          }}
        >
          Signature capture is not available in the public form view.
        </div>
      );

    default:
      return wrap(
        <input
          type="text"
          value={strVal}
          placeholder={field.placeholder ?? ""}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      );
  }
}
