import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  addFieldToSection,
  addSectionToDraft,
  CHOICE_TYPES,
  deleteFieldFromDraft,
  duplicateField,
  fieldToPublishPayload,
  isLayoutOnlyType,
  moveFieldInDraft,
  PALETTE_GROUPS,
  removeSectionFromDraft,
  setDraftLayout,
  SURVEY_TYPES,
  tabsForFieldType,
  uid,
  updateFieldInDraft,
  updateSectionInDraft,
  type DesignerDraft,
  type DraftField,
  type DraftSection,
  type FieldType,
  type PropertyTab
} from "./formDesignerState";
import { readTemplateLayout, type FormLayout } from "./formLayoutResolver";
import "./FormBuilder.css";

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
      config?: Record<string, unknown> | null;
    }>;
  }>;
  rules: Array<{
    id: string;
    sourceFieldKey: string;
    targetFieldKey: string;
    operator: string;
    comparisonValue?: string | null;
    effect: string;
  }>;
};

type Template = {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  settings?: unknown;
  versions: TemplateVersion[];
};

export function FormDesignerPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const { authFetch } = useAuth();
  const [template, setTemplate] = useState<Template | null>(null);
  const [draft, setDraft] = useState<DesignerDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFieldTempId, setSelectedFieldTempId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PropertyTab>("general");
  const [propsCollapsed, setPropsCollapsed] = useState(false);
  const [openSectionCogTempId, setOpenSectionCogTempId] = useState<string | null>(null);

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
        const layout: FormLayout = readTemplateLayout(data.settings) ?? "classic";
        const latest = data.versions.find((v) => v.status === "ACTIVE") ?? data.versions[0];
        if (!latest) {
          setDraft({
            name: data.name,
            code: data.code,
            description: data.description ?? undefined,
            layout,
            sections: [{ tempId: uid(), title: "Section 1", sectionOrder: 1, fields: [] }],
            rules: []
          });
          return;
        }
        setDraft({
          name: data.name,
          code: data.code,
          description: data.description ?? undefined,
          layout,
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
              options: Array.isArray(field.optionsJson) ? (field.optionsJson as string[]) : undefined,
              config: (field.config ?? undefined) as Record<string, unknown> | undefined
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

  const selectedField = useMemo(() => {
    if (!draft || !selectedFieldTempId) return null;
    for (const section of draft.sections) {
      const match = section.fields.find((f) => f.tempId === selectedFieldTempId);
      if (match) return { field: match, section };
    }
    return null;
  }, [draft, selectedFieldTempId]);

  useEffect(() => {
    if (!selectedField) return;
    const tabs = tabsForFieldType(selectedField.field.fieldType);
    if (!tabs.includes(activeTab)) setActiveTab(tabs[0]);
  }, [selectedField, activeTab]);

  if (loading || !draft || !template) {
    return (
      <div className="fv2-builder">
        <Skeleton width="60%" height={24} />
        <Skeleton width="100%" height={300} style={{ marginTop: 16 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fv2-builder">
        <EmptyState
          heading="Could not load template"
          subtext={error}
          action={<Link to="/forms" className="s7-btn s7-btn--primary">← Back to forms</Link>}
        />
      </div>
    );
  }

  const handleAddField = (sectionTempId: string, fieldType: FieldType | string) => {
    setDraft((current) => {
      if (!current) return current;
      const result = addFieldToSection(current, sectionTempId, fieldType);
      setSelectedFieldTempId(result.newField.tempId);
      return result.draft;
    });
  };

  const handleUpdateField = (sectionTempId: string, fieldTempId: string, patch: Partial<DraftField>) => {
    setDraft((current) => (current ? updateFieldInDraft(current, sectionTempId, fieldTempId, patch) : current));
  };

  const handleDeleteField = (sectionTempId: string, fieldTempId: string) => {
    setDraft((current) => (current ? deleteFieldFromDraft(current, sectionTempId, fieldTempId) : current));
    setSelectedFieldTempId(null);
  };

  const handleDuplicateField = (sectionTempId: string, fieldTempId: string) => {
    setDraft((current) => {
      if (!current) return current;
      const result = duplicateField(current, sectionTempId, fieldTempId);
      if (result.newField) setSelectedFieldTempId(result.newField.tempId);
      return result.draft;
    });
  };

  const handleMoveField = (sectionTempId: string, fieldTempId: string, dir: -1 | 1) => {
    setDraft((current) => (current ? moveFieldInDraft(current, sectionTempId, fieldTempId, dir) : current));
  };

  const handleUpdateSection = (sectionTempId: string, patch: Partial<DraftSection>) => {
    setDraft((current) => (current ? updateSectionInDraft(current, sectionTempId, patch) : current));
  };

  const handleAddSection = () => setDraft((current) => (current ? addSectionToDraft(current) : current));

  const handleRemoveSection = (sectionTempId: string) => {
    setDraft((current) => (current ? removeSectionFromDraft(current, sectionTempId) : current));
    setOpenSectionCogTempId(null);
  };

  const handleLayoutChange = async (layout: FormLayout) => {
    setDraft((current) => (current ? setDraftLayout(current, layout) : current));
    if (!templateId) return;
    try {
      const nextSettings = {
        ...((template.settings as Record<string, unknown> | null | undefined) ?? {}),
        layout
      };
      const res = await authFetch(`/forms/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ settings: nextSettings })
      });
      if (res.ok) {
        const updated = (await res.json()) as Template;
        setTemplate(updated);
      }
    } catch {
      /* silent — user can retry via toggle; publish also persists structure */
    }
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
          fields: section.fields.map(fieldToPublishPayload)
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
        throw new Error((body as { message?: string }).message ?? "Could not save & publish.");
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
  const tabs: PropertyTab[] = selectedField ? tabsForFieldType(selectedField.field.fieldType) : [];

  return (
    <div className="fv2-builder">
      <Link to="/forms" className="fv2-builder__back">← Back to forms</Link>

      <div className="fv2-topbar">
        <input
          className="fv2-topbar__name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          aria-label="Form name"
        />
        <span className="fv2-chip">DRAFT v{nextVersion}</span>
        <div className="fv2-laytoggle" role="group" aria-label="Fill layout">
          <button
            type="button"
            className={`fv2-laytoggle__btn ${draft.layout === "classic" ? "fv2-laytoggle__btn--on" : ""}`}
            aria-pressed={draft.layout === "classic"}
            onClick={() => void handleLayoutChange("classic")}
          >
            Classic
          </button>
          <button
            type="button"
            className={`fv2-laytoggle__btn ${draft.layout === "card" ? "fv2-laytoggle__btn--on" : ""}`}
            aria-pressed={draft.layout === "card"}
            onClick={() => void handleLayoutChange("card")}
            title="One question at a time — auto below 768px"
          >
            Card
          </button>
        </div>
        <button type="button" className="fv2-tbtn">Versions</button>
        <button
          type="button"
          className="fv2-tbtn fv2-tbtn--primary"
          onClick={() => void publish()}
          disabled={saving}
        >
          {saving ? "Saving…" : "Publish"}
        </button>
      </div>

      {error ? <div className="tender-page__error" role="alert" style={{ maxWidth: 1280, margin: "8px auto" }}>{error}</div> : null}

      <div className="fv2-frame">
        <aside className="fv2-palette" aria-label="Field palette">
          {PALETTE_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="fv2-palette__group-label">{group.label}</div>
              <div className="fv2-palette__grid">
                {group.entries.map((entry) => (
                  <button
                    key={entry.type}
                    type="button"
                    className="fv2-pill"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/field-type", entry.type);
                      event.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => {
                      if (draft.sections.length === 0) return;
                      handleAddField(draft.sections[draft.sections.length - 1].tempId, entry.type);
                    }}
                    title={`Drag or click to add ${entry.label}`}
                  >
                    <span aria-hidden>{entry.icon}</span>
                    <span>{entry.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <main className="fv2-canvas">
          <div className="fv2-formcard">
            <input
              className="fv2-formcard__title"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              aria-label="Form title (inline)"
            />
            <input
              className="fv2-formcard__desc"
              value={draft.description ?? ""}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Description (optional)"
              aria-label="Form description (inline)"
            />

            {draft.sections.map((section) => (
              <section
                key={section.tempId}
                className="fv2-sect"
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("text/field-type")) {
                    event.preventDefault();
                    event.currentTarget.classList.add("fv2-sect--drag-over");
                  }
                }}
                onDragLeave={(event) => event.currentTarget.classList.remove("fv2-sect--drag-over")}
                onDrop={(event) => {
                  event.preventDefault();
                  event.currentTarget.classList.remove("fv2-sect--drag-over");
                  const type = event.dataTransfer.getData("text/field-type");
                  if (type) handleAddField(section.tempId, type);
                }}
              >
                <header className="fv2-sect__head">
                  <input
                    className="fv2-sect__title"
                    value={section.title}
                    onChange={(e) => handleUpdateSection(section.tempId, { title: e.target.value })}
                    aria-label="Section title (inline)"
                  />
                  <button
                    type="button"
                    className="fv2-sect__cog"
                    aria-label="Section settings"
                    aria-expanded={openSectionCogTempId === section.tempId}
                    onClick={() =>
                      setOpenSectionCogTempId((current) => (current === section.tempId ? null : section.tempId))
                    }
                  >
                    ⚙
                  </button>
                </header>

                {openSectionCogTempId === section.tempId ? (
                  <div className="fv2-sect__cog-popover" role="dialog" aria-label="Section settings">
                    <label>
                      Title
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => handleUpdateSection(section.tempId, { title: e.target.value })}
                      />
                    </label>
                    <label>
                      Description
                      <input
                        type="text"
                        value={section.description ?? ""}
                        onChange={(e) => handleUpdateSection(section.tempId, { description: e.target.value })}
                      />
                    </label>
                    <button
                      type="button"
                      className="fv2-danger"
                      onClick={() => handleRemoveSection(section.tempId)}
                      disabled={draft.sections.length === 1}
                    >
                      Remove section
                    </button>
                  </div>
                ) : null}

                {section.fields.length === 0 ? (
                  <div className="fv2-mockinput" style={{ textAlign: "center", padding: "18px", color: "var(--fv2-muted)" }}>
                    Drop a field here or click one in the left palette
                  </div>
                ) : (
                  section.fields.map((field) => {
                    const selected = selectedFieldTempId === field.tempId;
                    return (
                      <div
                        key={field.tempId}
                        className={selected ? "fv2-f fv2-f--sel" : "fv2-f"}
                        onClick={() => setSelectedFieldTempId(field.tempId)}
                        role="button"
                        tabIndex={0}
                      >
                        <input
                          className="fv2-f__label"
                          value={field.label}
                          onChange={(e) => handleUpdateField(section.tempId, field.tempId, { label: e.target.value })}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`${field.fieldType} label`}
                        />
                        {field.isRequired ? <span className="fv2-f__req">*</span> : null}
                        <div className="fv2-f__type">{field.fieldType}</div>
                        <div className="fv2-mockinput" style={{ marginTop: 6 }}>
                          {field.placeholder ?? "—"}
                        </div>
                        <div className="fv2-f__toolbar" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            aria-label="Toggle required"
                            aria-pressed={field.isRequired}
                            onClick={() =>
                              handleUpdateField(section.tempId, field.tempId, { isRequired: !field.isRequired })
                            }
                            title="Required"
                          >
                            {field.isRequired ? "★" : "☆"}
                          </button>
                          <button
                            type="button"
                            aria-label="Move up"
                            onClick={() => handleMoveField(section.tempId, field.tempId, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            aria-label="Move down"
                            onClick={() => handleMoveField(section.tempId, field.tempId, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            aria-label="Duplicate"
                            onClick={() => handleDuplicateField(section.tempId, field.tempId)}
                          >
                            ⧉
                          </button>
                          <button
                            type="button"
                            aria-label="Delete"
                            onClick={() => handleDeleteField(section.tempId, field.tempId)}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </section>
            ))}

            <button type="button" className="fv2-add-section" onClick={handleAddSection}>
              + Add section
            </button>
          </div>
        </main>

        <aside
          className={propsCollapsed ? "fv2-props fv2-props--collapsed" : "fv2-props"}
          aria-label="Field properties"
        >
          <button
            type="button"
            className="fv2-props__collapse"
            onClick={() => setPropsCollapsed((v) => !v)}
            aria-label={propsCollapsed ? "Expand properties" : "Collapse properties"}
            aria-expanded={!propsCollapsed}
          >
            {propsCollapsed ? "‹" : "›"}
          </button>
          {!propsCollapsed && selectedField ? (
            <>
              <div className="fv2-props__head">
                <h3>{selectedField.field.label || "Untitled field"}</h3>
                <div className="fv2-props__type">
                  {selectedField.field.fieldType}
                  {selectedField.field.isRequired ? " · required" : ""}
                </div>
                <div className="fv2-props__tabs" role="tablist">
                  {tabs.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={activeTab === tab}
                      className={`fv2-props__tab ${activeTab === tab ? "fv2-props__tab--on" : ""}`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
              <div className="fv2-props__body">
                <FieldTabBody
                  tab={activeTab}
                  field={selectedField.field}
                  onChange={(patch) =>
                    handleUpdateField(selectedField.section.tempId, selectedField.field.tempId, patch)
                  }
                />
              </div>
            </>
          ) : !propsCollapsed ? (
            <div className="fv2-props__empty">
              Select a field to edit its properties, or drag one from the left palette.
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function FieldTabBody({
  tab,
  field,
  onChange
}: {
  tab: PropertyTab;
  field: DraftField;
  onChange: (patch: Partial<DraftField>) => void;
}) {
  const [optionsText, setOptionsText] = useState((field.options ?? []).join("\n"));
  useEffect(() => {
    setOptionsText((field.options ?? []).join("\n"));
  }, [field.tempId]);

  const config = (field.config ?? {}) as Record<string, unknown>;
  const patchConfig = (patch: Record<string, unknown>) =>
    onChange({ config: { ...config, ...patch } });

  const isLayout = isLayoutOnlyType(field.fieldType);
  const isChoice = CHOICE_TYPES.has(field.fieldType);
  const isSurvey = SURVEY_TYPES.has(field.fieldType);
  const isImage = field.fieldType === "image";

  if (tab === "general") {
    return (
      <>
        <label>
          Label
          <input
            type="text"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </label>
        {!isLayout && field.fieldType !== "divider" ? (
          <label>
            Placeholder
            <input
              type="text"
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </label>
        ) : null}
        <label>
          {field.fieldType === "paragraph" ? "Body text" : "Help text"}
          <input
            type="text"
            value={field.helpText ?? ""}
            onChange={(e) => onChange({ helpText: e.target.value })}
          />
        </label>
        {isImage ? (
          <label>
            Image URL
            <input
              type="url"
              value={String(config.imageUrl ?? "")}
              onChange={(e) => patchConfig({ imageUrl: e.target.value })}
              placeholder="https://…"
            />
          </label>
        ) : null}
        {isLayout ? null : (
          <div className="fv2-tgl">
            <span>Required</span>
            <input
              type="checkbox"
              checked={field.isRequired}
              onChange={(e) => onChange({ isRequired: e.target.checked })}
              aria-label="Required"
            />
          </div>
        )}
      </>
    );
  }

  if (tab === "options") {
    if (isSurvey && field.fieldType === "rating") {
      const maxRating = Number(config.maxRating ?? 5);
      return (
        <label>
          Maximum stars
          <input
            type="number"
            min={2}
            max={10}
            value={maxRating}
            onChange={(e) => patchConfig({ maxRating: Number(e.target.value) || 5 })}
          />
        </label>
      );
    }
    if (isSurvey && field.fieldType === "scale") {
      const min = Number(config.min ?? 1);
      const max = Number(config.max ?? 5);
      return (
        <>
          <label>
            Minimum
            <input
              type="number"
              value={min}
              onChange={(e) => patchConfig({ min: Number(e.target.value) })}
            />
          </label>
          <label>
            Maximum
            <input
              type="number"
              value={max}
              onChange={(e) => patchConfig({ max: Number(e.target.value) })}
            />
          </label>
          <label>
            Label at minimum
            <input
              type="text"
              value={String(config.minLabel ?? "")}
              onChange={(e) => patchConfig({ minLabel: e.target.value })}
            />
          </label>
          <label>
            Label at maximum
            <input
              type="text"
              value={String(config.maxLabel ?? "")}
              onChange={(e) => patchConfig({ maxLabel: e.target.value })}
            />
          </label>
        </>
      );
    }
    if (isChoice) {
      return (
        <label>
          Choices (one per line)
          <textarea
            value={optionsText}
            onChange={(e) => setOptionsText(e.target.value)}
            onBlur={() =>
              onChange({
                options: optionsText.split("\n").map((line) => line.trim()).filter(Boolean)
              })
            }
          />
        </label>
      );
    }
    return (
      <div className="fv2-props__empty" style={{ padding: 0 }}>
        No options to configure for this field type.
      </div>
    );
  }

  return (
    <div className="fv2-props__empty" style={{ padding: 0 }}>
      Rules for this field arrive in F-2 (rules storage + full-screen builder).
      For now, use the legacy rules editor via the JSON version endpoint.
    </div>
  );
}
