import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { EmptyState, Skeleton } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";
import {
  ADVANCED_TYPES,
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
      snippetCode?: string | null;
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
              config: (field.config ?? undefined) as Record<string, unknown> | undefined,
              snippetCode: field.snippetCode ?? undefined
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
        <PassThresholdControl
          templateSettings={template.settings}
          onSave={async (nextThreshold) => {
            if (!templateId) return;
            try {
              const base = ((template.settings as Record<string, unknown> | null | undefined) ?? {}) as Record<string, unknown>;
              const nextSettings = { ...base, passThresholdPct: nextThreshold };
              const res = await authFetch(`/forms/templates/${templateId}`, {
                method: "PATCH",
                body: JSON.stringify({ settings: nextSettings })
              });
              if (res.ok) setTemplate((await res.json()) as Template);
            } catch {
              /* silent — user can retry */
            }
          }}
        />
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
                  draft={draft}
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
  draft,
  onChange
}: {
  tab: PropertyTab;
  field: DraftField;
  draft: DesignerDraft;
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
  const isAdvanced = ADVANCED_TYPES.has(field.fieldType);
  const isImage = field.fieldType === "image";
  const isContentBlock = field.fieldType === "content_block";

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
        {isContentBlock ? (
          <ContentBlockSnippetPicker
            value={field.snippetCode ?? ""}
            onChange={(code) => onChange({ snippetCode: code || undefined })}
          />
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
        <>
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
          <ScoringEditor field={field} config={config} patchConfig={patchConfig} />
        </>
      );
    }
    if (isAdvanced) {
      return <AdvancedOptionsEditor field={field} draft={draft} patchConfig={patchConfig} />;
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

/**
 * Options-tab editor for the four F-4 advanced types. Each edits its config
 * blob in place via patchConfig — no schema migration means every knob lives
 * inside `FormField.config`.
 */
function AdvancedOptionsEditor({
  field,
  draft,
  patchConfig
}: {
  field: DraftField;
  draft: DesignerDraft;
  patchConfig: (patch: Record<string, unknown>) => void;
}) {
  const config = (field.config ?? {}) as Record<string, unknown>;
  const allFields = draft.sections.flatMap((s) => s.fields).filter((f) => f.tempId !== field.tempId);

  if (field.fieldType === "lookup") {
    return (
      <>
        <label>
          List slug
          <input
            type="text"
            value={String(config.listSlug ?? "")}
            onChange={(e) => patchConfig({ listSlug: e.target.value })}
            placeholder="e.g. trade_types"
          />
        </label>
        <p style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", margin: "4px 0 8px" }}>
          Points at <code>GET /lists/&lt;slug&gt;/items</code>. Options load at fill time.
        </p>
        <label>
          Parent field (for nested lookups)
          <select
            value={String(config.parentFieldKey ?? "")}
            onChange={(e) => patchConfig({ parentFieldKey: e.target.value })}
          >
            <option value="">— none —</option>
            {allFields
              .filter((f) => f.fieldType === "lookup" || f.fieldType === "multiple_choice")
              .map((f) => (
                <option key={f.tempId} value={f.fieldKey}>
                  {f.label || f.fieldKey}
                </option>
              ))}
          </select>
        </label>
      </>
    );
  }

  if (field.fieldType === "calculation") {
    const operation = String(config.operation ?? "sum");
    const operandKeys = Array.isArray(config.operandKeys) ? (config.operandKeys as string[]) : [];
    const numericFields = allFields.filter((f) =>
      ["number", "calculation", "rating", "scale"].includes(f.fieldType)
    );
    const toggleOperand = (key: string) => {
      const next = operandKeys.includes(key)
        ? operandKeys.filter((k) => k !== key)
        : [...operandKeys, key];
      patchConfig({ operandKeys: next });
    };
    return (
      <>
        <label>
          Operation
          <select
            value={operation}
            onChange={(e) => patchConfig({ operation: e.target.value })}
          >
            <option value="sum">Sum</option>
            <option value="difference">Difference (first − rest)</option>
            <option value="product">Product</option>
            <option value="average">Average</option>
            <option value="min">Minimum</option>
            <option value="max">Maximum</option>
          </select>
        </label>
        <label>
          Decimal places
          <input
            type="number"
            min={0}
            max={6}
            value={Number(config.decimals ?? 2)}
            onChange={(e) => patchConfig({ decimals: Number(e.target.value) })}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Operand fields</div>
          {numericFields.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--fv2-muted, #64748B)" }}>
              Add a number field to this form first, then pick it here.
            </div>
          ) : (
            numericFields.map((f) => (
              <label
                key={f.tempId}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}
              >
                <input
                  type="checkbox"
                  checked={operandKeys.includes(f.fieldKey)}
                  onChange={() => toggleOperand(f.fieldKey)}
                />
                <span>
                  {f.label || f.fieldKey}{" "}
                  <span style={{ color: "var(--fv2-muted, #64748B)" }}>({f.fieldType})</span>
                </span>
              </label>
            ))
          )}
        </div>
      </>
    );
  }

  if (field.fieldType === "table") {
    const columns = Array.isArray(config.columns)
      ? (config.columns as Array<{ key: string; label: string; fieldType: string }>)
      : [];
    const updateColumn = (idx: number, patch: Partial<{ key: string; label: string; fieldType: string }>) => {
      const next = columns.map((c, i) => (i === idx ? { ...c, ...patch } : c));
      patchConfig({ columns: next });
    };
    const addColumn = () => {
      const nextIndex = columns.length + 1;
      patchConfig({
        columns: [
          ...columns,
          { key: `col_${nextIndex}`, label: `Column ${nextIndex}`, fieldType: "text" }
        ]
      });
    };
    const removeColumn = (idx: number) =>
      patchConfig({ columns: columns.filter((_, i) => i !== idx) });
    return (
      <>
        <label>
          Minimum rows
          <input
            type="number"
            min={0}
            value={Number(config.minRows ?? 1)}
            onChange={(e) => patchConfig({ minRows: Number(e.target.value) })}
          />
        </label>
        <label>
          Maximum rows
          <input
            type="number"
            min={1}
            value={Number(config.maxRows ?? 20)}
            onChange={(e) => patchConfig({ maxRows: Number(e.target.value) })}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Columns</div>
          {columns.map((col, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 90px auto",
                gap: 4,
                marginBottom: 4
              }}
            >
              <input
                type="text"
                value={col.label}
                onChange={(e) => updateColumn(idx, { label: e.target.value })}
                placeholder="Label"
              />
              <input
                type="text"
                value={col.key}
                onChange={(e) => updateColumn(idx, { key: e.target.value })}
                placeholder="key"
              />
              <select
                value={col.fieldType}
                onChange={(e) => updateColumn(idx, { fieldType: e.target.value })}
              >
                <option value="text">Text</option>
                <option value="number">Number</option>
                <option value="date">Date</option>
                <option value="checkbox">Checkbox</option>
              </select>
              <button
                type="button"
                className="fv2-danger"
                onClick={() => removeColumn(idx)}
                aria-label={`Remove column ${col.label}`}
              >
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="fv2-tbtn" onClick={addColumn}>
            + Add column
          </button>
        </div>
      </>
    );
  }

  if (field.fieldType === "terms") {
    return (
      <>
        <label>
          Terms text (shown above the acceptance checkbox)
          <textarea
            value={String(config.termsText ?? "")}
            onChange={(e) => patchConfig({ termsText: e.target.value })}
            rows={4}
          />
        </label>
        <label>
          Version
          <input
            type="text"
            value={String(config.termsVersion ?? "1")}
            onChange={(e) => patchConfig({ termsVersion: e.target.value })}
            placeholder="e.g. 2026-07"
          />
        </label>
        <p style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", margin: "4px 0 0" }}>
          The accepted version + timestamp are stored on the submission value.
        </p>
      </>
    );
  }

  return (
    <div className="fv2-props__empty" style={{ padding: 0 }}>
      No options to configure for this field type.
    </div>
  );
}

// ── Inspection scoring editors (this PR) ─────────────────────────────────

type ResponseOptionRow = {
  value: string;
  label?: string;
  score: number;
  isPassing?: boolean;
  isNA?: boolean;
  color?: string;
};

type ResponseSetShape = { key?: string; name?: string; options: ResponseOptionRow[] };

const DEFAULT_PASS_FAIL_SET: ResponseSetShape = {
  name: "Pass / Fail / N/A",
  options: [
    { value: "pass", label: "Pass", score: 1, isPassing: true, color: "#16A34A" },
    { value: "fail", label: "Fail", score: 0, isPassing: false, color: "#DC2626" },
    { value: "na",   label: "N/A",  score: 0, isNA: true,       color: "#64748B" }
  ]
};

function PassThresholdControl({
  templateSettings,
  onSave
}: {
  templateSettings: unknown;
  onSave: (nextThreshold: number | null) => Promise<void>;
}) {
  const initial = (() => {
    const raw = (templateSettings as { passThresholdPct?: number } | null | undefined)?.passThresholdPct;
    return typeof raw === "number" && Number.isFinite(raw) ? String(raw) : "";
  })();
  const [text, setText] = useState(initial);
  useEffect(() => setText(initial), [initial]);
  return (
    <label
      style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--fv2-muted, #64748B)" }}
      title="Pass threshold — submissions with scorePct ≥ this value are marked PASS."
    >
      Pass ≥
      <input
        type="number"
        min={0}
        max={100}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text === "") {
            void onSave(null);
            return;
          }
          const n = Number(text);
          if (!Number.isFinite(n)) return;
          void onSave(Math.max(0, Math.min(100, n)));
        }}
        style={{ width: 56, padding: 4, fontSize: 12 }}
      />
      %
    </label>
  );
}

/**
 * Per-field scoring editor for choice fields.
 *
 * Adds a "Score this question" toggle, a weight input, and an inline
 * response-set editor. When enabled, the field's config.scoreConfig is
 * populated with an inline response set (default Pass/Fail/N-A) that
 * FormsEngineService.computeScoring reads at submit time. Values entered
 * for each option are what land in FormSubmission.score.
 */
function ScoringEditor({
  field,
  config,
  patchConfig
}: {
  field: DraftField;
  config: Record<string, unknown>;
  patchConfig: (patch: Record<string, unknown>) => void;
}) {
  const scoreConfig = (config.scoreConfig ?? undefined) as
    | {
        weight?: number;
        countsTowardScore?: boolean;
        responseSet?: ResponseSetShape;
      }
    | undefined;
  const enabled = Boolean(scoreConfig);
  const set = scoreConfig?.responseSet ?? DEFAULT_PASS_FAIL_SET;
  const weight = scoreConfig?.weight ?? 1;

  const enable = () => {
    patchConfig({
      scoreConfig: {
        weight: 1,
        countsTowardScore: true,
        responseSet: DEFAULT_PASS_FAIL_SET
      }
    });
  };
  const disable = () => patchConfig({ scoreConfig: undefined });

  const updateOption = (idx: number, patch: Partial<ResponseOptionRow>) => {
    const next = set.options.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    patchConfig({
      scoreConfig: { ...scoreConfig, responseSet: { ...set, options: next } }
    });
  };
  const addOption = () => {
    patchConfig({
      scoreConfig: {
        ...scoreConfig,
        responseSet: {
          ...set,
          options: [...set.options, { value: `opt_${set.options.length + 1}`, label: "New", score: 0 }]
        }
      }
    });
  };
  const removeOption = (idx: number) => {
    patchConfig({
      scoreConfig: {
        ...scoreConfig,
        responseSet: { ...set, options: set.options.filter((_, i) => i !== idx) }
      }
    });
  };

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--fv2-border, #E2E8F0)", paddingTop: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <strong style={{ fontSize: 12 }}>Inspection scoring</strong>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => (e.target.checked ? enable() : disable())}
          />
          Score this question
        </label>
      </div>
      {enabled ? (
        <>
          <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>
            Weight
            <input
              type="number"
              min={0}
              step={0.5}
              value={weight}
              onChange={(e) =>
                patchConfig({
                  scoreConfig: { ...scoreConfig, weight: Number(e.target.value) || 1 }
                })
              }
              style={{ width: 80, marginLeft: 8 }}
            />
          </label>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Response set</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {set.options.map((opt, idx) => (
              <div
                key={idx}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 60px 60px 60px auto",
                  gap: 4,
                  alignItems: "center"
                }}
              >
                <input
                  type="text"
                  value={opt.label ?? opt.value}
                  onChange={(e) => updateOption(idx, { label: e.target.value })}
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={opt.value}
                  onChange={(e) => updateOption(idx, { value: e.target.value })}
                  placeholder="value"
                />
                <input
                  type="number"
                  value={opt.score}
                  onChange={(e) => updateOption(idx, { score: Number(e.target.value) || 0 })}
                  aria-label="Score"
                  title="Score for this option"
                />
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }} title="Marks this option as passing">
                  <input
                    type="checkbox"
                    checked={Boolean(opt.isPassing)}
                    onChange={(e) => updateOption(idx, { isPassing: e.target.checked, isNA: e.target.checked ? false : opt.isNA })}
                  />
                  Pass
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }} title="Not applicable — excluded from score and max">
                  <input
                    type="checkbox"
                    checked={Boolean(opt.isNA)}
                    onChange={(e) => updateOption(idx, { isNA: e.target.checked, isPassing: e.target.checked ? false : opt.isPassing })}
                  />
                  N/A
                </label>
                <button type="button" className="fv2-danger" onClick={() => removeOption(idx)} aria-label={`Remove ${opt.label ?? opt.value}`}>
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="fv2-tbtn" onClick={addOption} style={{ marginTop: 6 }}>
            + Add option
          </button>
          <p style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", margin: "6px 0 0" }}>
            The submitter's answer is matched by <code>value</code>. Server computes the
            weighted score on submit against the template's Pass threshold.
          </p>
        </>
      ) : (
        <p style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", margin: 0 }}>
          Turn on scoring to add a Pass/Fail/N-A response set and give this question
          a weight toward the submission's total score.
        </p>
      )}
    </div>
  );
}

// ── Content block snippet picker ─────────────────────────────────────────

type SnippetSummary = {
  id: string;
  code: string;
  name: string;
  category: string;
  version: number;
};

/**
 * Property-panel picker for content_block fields.
 *
 * Fetches the snippet library from GET /forms/snippets and renders a
 * searchable select + inline preview of the selected snippet's metadata.
 * The parent manages the actual `snippetCode` value via `onChange`.
 */
function ContentBlockSnippetPicker({
  value,
  onChange
}: {
  value: string;
  onChange: (code: string) => void;
}) {
  const { authFetch } = useAuth();
  const [snippets, setSnippets] = useState<SnippetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    setLoading(true);
    void authFetch("/forms/snippets?page=1&pageSize=200")
      .then(async (r) => {
        if (!r.ok) return;
        const body = (await r.json()) as { items: SnippetSummary[] };
        setSnippets(body.items ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [authFetch]);

  const selected = snippets.find((s) => s.code === value);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        Content snippet
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ fontSize: 12 }}
          disabled={loading}
        >
          <option value="">— select a snippet —</option>
          {snippets.map((s) => (
            <option key={s.id} value={s.code}>
              [{s.category}] {s.name}
            </option>
          ))}
        </select>
      </label>
      {loading ? (
        <Skeleton width="80%" height={12} />
      ) : selected ? (
        <div style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", lineHeight: 1.4 }}>
          Code: <code style={{ fontSize: 11 }}>{selected.code}</code>
          {" · "}v{selected.version}
        </div>
      ) : value ? (
        <div style={{ fontSize: 11, color: "#B91C1C" }}>
          Snippet <code style={{ fontSize: 11 }}>{value}</code> not found or inactive.
        </div>
      ) : null}
      <p style={{ fontSize: 11, color: "var(--fv2-muted, #64748B)", margin: 0 }}>
        Manage snippets under Admin &rarr; Forms &rarr; Content Library.
      </p>
    </div>
  );
}
