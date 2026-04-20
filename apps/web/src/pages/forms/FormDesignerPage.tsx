import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type FieldType = "text" | "textarea" | "number" | "date" | "checkbox" | "multiple_choice" | "signature" | "image_capture" | "file";

type DraftField = {
  tempId: string;
  fieldKey: string;
  label: string;
  fieldType: FieldType | string;
  fieldOrder: number;
  isRequired: boolean;
  placeholder?: string;
  helpText?: string;
  options?: string[];
};

type DraftSection = {
  tempId: string;
  title: string;
  description?: string;
  sectionOrder: number;
  fields: DraftField[];
};

type DraftRule = {
  tempId: string;
  sourceFieldKey: string;
  targetFieldKey: string;
  operator: string;
  comparisonValue: string;
  effect: string;
};

type Draft = {
  name: string;
  code: string;
  description?: string;
  sections: DraftSection[];
  rules: DraftRule[];
};

type TemplateVersion = {
  id: string;
  versionNumber: number;
  status: string;
  sections: Array<{
    id: string;
    title: string;
    description?: string | null;
    sectionOrder: number;
    fields: Array<{
      id: string;
      fieldKey: string;
      label: string;
      fieldType: string;
      fieldOrder: number;
      isRequired: boolean;
      placeholder?: string | null;
      helpText?: string | null;
      optionsJson?: unknown;
    }>;
  }>;
  rules: Array<{ id: string; sourceFieldKey: string; targetFieldKey: string; operator: string; comparisonValue?: string | null; effect: string }>;
};

type Template = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  versions: TemplateVersion[];
};

const FIELD_TYPES: Array<{ type: FieldType; label: string; icon: string }> = [
  { type: "text", label: "Short text", icon: "Tt" },
  { type: "textarea", label: "Long text", icon: "¶" },
  { type: "number", label: "Number", icon: "#" },
  { type: "date", label: "Date", icon: "📅" },
  { type: "checkbox", label: "Checkbox", icon: "☑" },
  { type: "multiple_choice", label: "Dropdown", icon: "▾" },
  { type: "signature", label: "Signature", icon: "✍" },
  { type: "image_capture", label: "Photo", icon: "📷" },
  { type: "file", label: "File upload", icon: "📎" }
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function keyFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "") || uid();
}

export function FormDesignerPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { authFetch } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldKey, setSelectedFieldKey] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await authFetch(`/forms/templates/${templateId}`);
        if (!response.ok) throw new Error("Template not found.");
        const data = (await response.json()) as Template;
        if (cancelled) return;
        setTemplate(data);
        const latest = data.versions.find((v) => v.status === "ACTIVE") ?? data.versions[0];
        if (!latest) {
          setDraft({
            name: data.name,
            code: data.code,
            description: data.description ?? undefined,
            sections: [{ tempId: uid(), title: "Section 1", sectionOrder: 1, fields: [] }],
            rules: []
          });
          return;
        }
        setDraft({
          name: data.name,
          code: data.code,
          description: data.description ?? undefined,
          sections: latest.sections.map((section, i) => ({
            tempId: uid(),
            title: section.title,
            description: section.description ?? undefined,
            sectionOrder: section.sectionOrder ?? i + 1,
            fields: section.fields.map((field, j) => ({
              tempId: uid(),
              fieldKey: field.fieldKey,
              label: field.label,
              fieldType: field.fieldType,
              fieldOrder: field.fieldOrder ?? j + 1,
              isRequired: field.isRequired,
              placeholder: field.placeholder ?? undefined,
              helpText: field.helpText ?? undefined,
              options: Array.isArray(field.optionsJson) ? (field.optionsJson as string[]) : undefined
            }))
          })),
          rules: latest.rules.map((rule) => ({
            tempId: uid(),
            sourceFieldKey: rule.sourceFieldKey,
            targetFieldKey: rule.targetFieldKey,
            operator: rule.operator,
            comparisonValue: rule.comparisonValue ?? "",
            effect: rule.effect
          }))
        });
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

  const allFields = useMemo(() => {
    if (!draft) return [] as DraftField[];
    return draft.sections.flatMap((s) => s.fields);
  }, [draft]);

  const selectedField = useMemo(() => {
    if (!draft || !selectedFieldKey) return null;
    for (const section of draft.sections) {
      const match = section.fields.find((f) => f.fieldKey === selectedFieldKey);
      if (match) return { field: match, section };
    }
    return null;
  }, [draft, selectedFieldKey]);

  if (loading || !draft || !template) {
    return (
      <div className="forms-designer">
        <Skeleton width="60%" height={24} />
        <Skeleton width="100%" height={300} style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="forms-designer">
        <EmptyState
          heading="Could not load template"
          subtext={error}
          action={<Link to="/forms" className="s7-btn s7-btn--primary">← Back to forms</Link>}
        />
      </div>
    );
  }

  const addFieldToSection = (sectionTempId: string, fieldType: FieldType | string) => {
    const label =
      FIELD_TYPES.find((f) => f.type === fieldType)?.label ?? fieldType;
    const newField: DraftField = {
      tempId: uid(),
      fieldKey: `${keyFromLabel(label)}_${uid().slice(0, 4)}`,
      label: `New ${label.toLowerCase()} field`,
      fieldType,
      fieldOrder: 0,
      isRequired: false,
      options: fieldType === "multiple_choice" ? ["Option 1", "Option 2"] : undefined
    };
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.tempId !== sectionTempId) return section;
          const reordered = [...section.fields, newField].map((field, i) => ({ ...field, fieldOrder: i + 1 }));
          return { ...section, fields: reordered };
        })
      };
    });
    setSelectedFieldKey(newField.fieldKey);
  };

  const moveField = (sectionTempId: string, fieldTempId: string, direction: -1 | 1) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.tempId !== sectionTempId) return section;
          const index = section.fields.findIndex((f) => f.tempId === fieldTempId);
          if (index < 0) return section;
          const target = index + direction;
          if (target < 0 || target >= section.fields.length) return section;
          const next = [...section.fields];
          [next[index], next[target]] = [next[target], next[index]];
          return { ...section, fields: next.map((field, i) => ({ ...field, fieldOrder: i + 1 })) };
        })
      };
    });
  };

  const deleteField = (sectionTempId: string, fieldTempId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const nextSections = current.sections.map((section) => {
        if (section.tempId !== sectionTempId) return section;
        return {
          ...section,
          fields: section.fields
            .filter((f) => f.tempId !== fieldTempId)
            .map((field, i) => ({ ...field, fieldOrder: i + 1 }))
        };
      });
      const deletedKey = current.sections
        .find((s) => s.tempId === sectionTempId)?.fields.find((f) => f.tempId === fieldTempId)?.fieldKey;
      const rules = deletedKey
        ? current.rules.filter((r) => r.sourceFieldKey !== deletedKey && r.targetFieldKey !== deletedKey)
        : current.rules;
      return { ...current, sections: nextSections, rules };
    });
    setSelectedFieldKey(null);
  };

  const updateField = (sectionTempId: string, fieldTempId: string, patch: Partial<DraftField>) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((section) => {
          if (section.tempId !== sectionTempId) return section;
          return {
            ...section,
            fields: section.fields.map((field) => (field.tempId === fieldTempId ? { ...field, ...patch } : field))
          };
        })
      };
    });
  };

  const addSection = () => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: [
          ...current.sections,
          {
            tempId: uid(),
            title: `Section ${current.sections.length + 1}`,
            sectionOrder: current.sections.length + 1,
            fields: []
          }
        ]
      };
    });
  };

  const updateSection = (sectionTempId: string, patch: Partial<DraftSection>) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections.map((s) => (s.tempId === sectionTempId ? { ...s, ...patch } : s))
      };
    });
  };

  const removeSection = (sectionTempId: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        sections: current.sections
          .filter((s) => s.tempId !== sectionTempId)
          .map((s, i) => ({ ...s, sectionOrder: i + 1 }))
      };
    });
  };

  const addRule = () => {
    if (allFields.length < 1) return;
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        rules: [
          ...current.rules,
          {
            tempId: uid(),
            sourceFieldKey: allFields[0].fieldKey,
            targetFieldKey: allFields[Math.min(1, allFields.length - 1)].fieldKey,
            operator: "equals",
            comparisonValue: "",
            effect: "SHOW"
          }
        ]
      };
    });
  };

  const updateRule = (tempId: string, patch: Partial<DraftRule>) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        rules: current.rules.map((r) => (r.tempId === tempId ? { ...r, ...patch } : r))
      };
    });
  };

  const removeRule = (tempId: string) => {
    setDraft((current) => {
      if (!current) return current;
      return { ...current, rules: current.rules.filter((r) => r.tempId !== tempId) };
    });
  };

  const publish = async () => {
    if (!templateId) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name,
        code: draft.code,
        description: draft.description,
        status: "ACTIVE",
        sections: draft.sections.map((section) => ({
          title: section.title,
          description: section.description,
          sectionOrder: section.sectionOrder,
          fields: section.fields.map((field) => ({
            fieldKey: field.fieldKey,
            label: field.label,
            fieldType: field.fieldType,
            fieldOrder: field.fieldOrder,
            isRequired: field.isRequired,
            placeholder: field.placeholder,
            helpText: field.helpText,
            optionsJson: field.options
          }))
        })),
        rules: draft.rules.map((rule) => ({
          sourceFieldKey: rule.sourceFieldKey,
          targetFieldKey: rule.targetFieldKey,
          operator: rule.operator,
          comparisonValue: rule.comparisonValue,
          effect: rule.effect
        }))
      };
      const response = await authFetch(`/forms/templates/${templateId}/versions`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message ?? "Could not save & publish.");
      }
      const updated = (await response.json()) as Template;
      setTemplate(updated);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const latest = template.versions.find((v) => v.status === "ACTIVE") ?? template.versions[0];
  const nextVersion = (latest?.versionNumber ?? 0) + 1;

  return (
    <div className="forms-designer">
      <header className="workers-page__header">
        <div>
          <Link to="/forms" className="tender-detail__back">← Back to forms</Link>
          <h1 className="s7-type-page-title" style={{ margin: "8px 0 0" }}>Designer</h1>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span className="s7-badge s7-badge--neutral">Next: v{nextVersion}</span>
          <button type="button" className="s7-btn s7-btn--secondary" onClick={() => setPreviewOpen(true)}>
            Preview
          </button>
          <button type="button" className="s7-btn s7-btn--primary" onClick={() => void publish()} disabled={saving}>
            {saving ? "Saving…" : "Save & publish"}
          </button>
        </div>
      </header>

      {error ? <div className="tender-page__error" role="alert">{error}</div> : null}

      <div className="designer-grid">
        <aside className="designer-palette">
          <h3 className="s7-type-label" style={{ marginTop: 0, marginBottom: 10 }}>Field types</h3>
          <ul className="designer-palette__list">
            {FIELD_TYPES.map((ft) => (
              <li
                key={ft.type}
                className="designer-chip"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData("text/field-type", ft.type);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                title="Drag to a section, or click to add to the last section"
                onClick={() => {
                  if (!draft || draft.sections.length === 0) return;
                  addFieldToSection(draft.sections[draft.sections.length - 1].tempId, ft.type);
                }}
              >
                <span className="designer-chip__icon" aria-hidden>{ft.icon}</span>
                <span>{ft.label}</span>
              </li>
            ))}
          </ul>
        </aside>

        <main className="designer-canvas">
          <input
            className="s7-input designer-title"
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="Form title"
          />
          <input
            className="s7-input designer-subtitle"
            value={draft.code}
            onChange={(event) => setDraft({ ...draft, code: event.target.value })}
            placeholder="Form code (e.g. DAILY-PRESTART)"
          />
          <textarea
            className="s7-textarea"
            value={draft.description ?? ""}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
            placeholder="Description (optional)"
            rows={2}
          />

          {draft.sections.map((section) => (
            <section
              key={section.tempId}
              className="designer-section"
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("text/field-type")) {
                  event.preventDefault();
                  event.currentTarget.classList.add("designer-section--drag-over");
                }
              }}
              onDragLeave={(event) => event.currentTarget.classList.remove("designer-section--drag-over")}
              onDrop={(event) => {
                event.preventDefault();
                event.currentTarget.classList.remove("designer-section--drag-over");
                const type = event.dataTransfer.getData("text/field-type");
                if (type) addFieldToSection(section.tempId, type);
              }}
            >
              <header className="designer-section__head">
                <input
                  className="s7-input designer-section__title"
                  value={section.title}
                  onChange={(event) => updateSection(section.tempId, { title: event.target.value })}
                  placeholder="Section title"
                />
                <button
                  type="button"
                  className="s7-btn s7-btn--ghost s7-btn--sm"
                  onClick={() => removeSection(section.tempId)}
                  aria-label="Remove section"
                  disabled={draft.sections.length === 1}
                >
                  ✕
                </button>
              </header>
              {section.fields.length === 0 ? (
                <div className="designer-section__dropzone">Drop a field type here or click one in the left palette</div>
              ) : (
                <ul className="designer-fields">
                  {section.fields.map((field) => {
                    const selected = selectedFieldKey === field.fieldKey;
                    return (
                      <li
                        key={field.tempId}
                        className={selected ? "designer-field designer-field--selected" : "designer-field"}
                        onClick={() => setSelectedFieldKey(field.fieldKey)}
                      >
                        <span className="designer-field__type">{field.fieldType}</span>
                        <span className="designer-field__label">
                          {field.label}
                          {field.isRequired ? <span className="designer-field__required">*</span> : null}
                        </span>
                        <div className="designer-field__actions" onClick={(e) => e.stopPropagation()}>
                          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => moveField(section.tempId, field.tempId, -1)} aria-label="Move up">↑</button>
                          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => moveField(section.tempId, field.tempId, 1)} aria-label="Move down">↓</button>
                          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => deleteField(section.tempId, field.tempId)} aria-label="Delete">✕</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ))}

          <button type="button" className="s7-btn s7-btn--secondary" onClick={addSection}>
            + Add section
          </button>
        </main>

        <aside className="designer-properties">
          {selectedField ? (
            <FieldPropertiesEditor
              field={selectedField.field}
              onChange={(patch) => updateField(selectedField.section.tempId, selectedField.field.tempId, patch)}
            />
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Select a field to edit its properties, or drag one from the left palette.
            </p>
          )}

          <hr style={{ margin: "20px 0", border: 0, borderTop: "1px solid var(--border-default)" }} />

          <h3 className="s7-type-label" style={{ marginTop: 0 }}>Conditional rules</h3>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 0, marginBottom: 8 }}>
            Show or hide fields based on other fields' values.
          </p>
          {draft.rules.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--text-muted)" }}>No rules yet.</p>
          ) : (
            <ul className="designer-rules">
              {draft.rules.map((rule) => (
                <li key={rule.tempId} className="designer-rule">
                  <div className="designer-rule__row">
                    <select className="s7-select" value={rule.sourceFieldKey} onChange={(e) => updateRule(rule.tempId, { sourceFieldKey: e.target.value })}>
                      {allFields.map((f) => <option key={f.fieldKey} value={f.fieldKey}>{f.label}</option>)}
                    </select>
                    <select className="s7-select" value={rule.operator} onChange={(e) => updateRule(rule.tempId, { operator: e.target.value })}>
                      <option value="equals">equals</option>
                      <option value="not_equals">not equals</option>
                    </select>
                    <input className="s7-input" value={rule.comparisonValue} onChange={(e) => updateRule(rule.tempId, { comparisonValue: e.target.value })} placeholder="value" />
                  </div>
                  <div className="designer-rule__row">
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>then</span>
                    <select className="s7-select" value={rule.effect} onChange={(e) => updateRule(rule.tempId, { effect: e.target.value })}>
                      <option value="SHOW">show</option>
                      <option value="HIDE">hide</option>
                      <option value="REQUIRE">require</option>
                    </select>
                    <select className="s7-select" value={rule.targetFieldKey} onChange={(e) => updateRule(rule.tempId, { targetFieldKey: e.target.value })}>
                      {allFields.map((f) => <option key={f.fieldKey} value={f.fieldKey}>{f.label}</option>)}
                    </select>
                    <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={() => removeRule(rule.tempId)}>✕</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <button type="button" className="s7-btn s7-btn--ghost s7-btn--sm" onClick={addRule} disabled={allFields.length < 1}>
            + Add rule
          </button>
        </aside>
      </div>

      {previewOpen ? (
        <div className="slide-over-overlay" role="dialog" aria-modal="true" onClick={() => setPreviewOpen(false)}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <header className="slide-over__header">
              <h2 className="s7-type-section-heading" style={{ margin: 0 }}>Preview · {draft.name}</h2>
              <button type="button" className="slide-over__close" onClick={() => setPreviewOpen(false)} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </header>
            <div className="slide-over__body">
              {draft.sections.map((section) => (
                <section key={section.tempId} className="preview-section">
                  <h3>{section.title}</h3>
                  {section.fields.map((field) => (
                    <div key={field.tempId} className="preview-field">
                      <label className="s7-type-label" style={{ marginBottom: 4 }}>
                        {field.label}{field.isRequired ? " *" : ""}
                      </label>
                      {field.fieldType === "textarea" ? (
                        <textarea className="s7-textarea" disabled placeholder="—" />
                      ) : field.fieldType === "checkbox" ? (
                        <input type="checkbox" disabled />
                      ) : field.fieldType === "multiple_choice" ? (
                        <select className="s7-select" disabled>
                          <option>—</option>
                          {(field.options ?? []).map((opt) => <option key={opt}>{opt}</option>)}
                        </select>
                      ) : field.fieldType === "signature" ? (
                        <div className="preview-signature">Signature canvas</div>
                      ) : field.fieldType === "image_capture" ? (
                        <div className="preview-signature">Photo capture</div>
                      ) : field.fieldType === "file" ? (
                        <div className="preview-signature">File upload</div>
                      ) : (
                        <input
                          className="s7-input"
                          disabled
                          type={field.fieldType === "number" ? "number" : field.fieldType === "date" ? "date" : "text"}
                          placeholder={field.placeholder ?? "—"}
                        />
                      )}
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type FieldPropertiesEditorProps = {
  field: DraftField;
  onChange: (patch: Partial<DraftField>) => void;
};

function FieldPropertiesEditor({ field, onChange }: FieldPropertiesEditorProps) {
  const [optionsText, setOptionsText] = useState((field.options ?? []).join("\n"));
  useEffect(() => {
    setOptionsText((field.options ?? []).join("\n"));
  }, [field.fieldKey]);

  const commitOptions = () => {
    const options = optionsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    onChange({ options });
  };

  return (
    <>
      <h3 className="s7-type-label" style={{ marginTop: 0 }}>Field properties</h3>
      <label className="tender-form__field">
        <span className="s7-type-label">Label</span>
        <input className="s7-input" value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </label>
      <label className="tender-form__field">
        <span className="s7-type-label">Type</span>
        <select className="s7-select" value={field.fieldType} onChange={(e) => onChange({ fieldType: e.target.value })}>
          {FIELD_TYPES.map((ft) => (
            <option key={ft.type} value={ft.type}>{ft.label}</option>
          ))}
        </select>
      </label>
      <label className="tender-form__field">
        <span className="s7-type-label">Placeholder</span>
        <input className="s7-input" value={field.placeholder ?? ""} onChange={(e) => onChange({ placeholder: e.target.value })} />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13 }}>
        <input
          type="checkbox"
          checked={field.isRequired}
          onChange={(e) => onChange({ isRequired: e.target.checked })}
        />
        Required
      </label>
      {field.fieldType === "multiple_choice" ? (
        <label className="tender-form__field" style={{ marginTop: 12 }}>
          <span className="s7-type-label">Options (one per line)</span>
          <textarea
            className="s7-textarea"
            rows={4}
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            onBlur={commitOptions}
          />
        </label>
      ) : null}
    </>
  );
}
