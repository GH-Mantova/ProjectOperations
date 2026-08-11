/**
 * B-HW-3: Settings — Handover Template editor.
 *
 * Gated on the `handovertemplate.manage` permission.
 * Shows the live (active) version read-only on the left and the draft
 * editor on the right. If no draft exists, offers a "Create draft from
 * active" button.
 */
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { can } from "../../auth/permissions";
import { NoAccess } from "../../components/NoAccess";
import { HandoverTemplateSectionEditor } from "../../components/settings/HandoverTemplateSectionEditor";
import { AddSectionDialog } from "../../components/settings/HandoverTemplateAddDialogs";
import {
  htGetActive,
  htGetDraft,
  htCreateDraft,
  htAddSection,
  htUpdateSection,
  htDeleteSection,
  htAddField,
  htUpdateField,
  htRetireField,
  htPublishDraft
} from "./handoverTemplateApi";
import type {
  HtTemplate,
  HtSection,
  HtField,
  AddFieldDto
} from "./handoverTemplateApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  } catch {
    return iso;
  }
}

// ─── Live panel (read-only tree) ─────────────────────────────────────────────

function LivePanel({ template }: { template: HtTemplate | null }) {
  if (!template) {
    return (
      <div style={panelStyle}>
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No active template found.</p>
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <header style={panelHeaderStyle}>
        <h3 style={{ margin: 0, fontSize: 15 }}>
          Live (v{template.version})
        </h3>
        <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 0" }}>
          Published {formatDate(template.publishedAt)} &mdash; read-only
        </p>
      </header>

      {template.sections.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No sections.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {template.sections.map((section: HtSection) => (
            <div
              key={section.id}
              style={{
                border: "1px solid var(--border-default, #e5e7eb)",
                borderRadius: "var(--radius-md, 6px)",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--surface-elevated, #f3f4f6)",
                  fontWeight: 600,
                  fontSize: 13,
                  borderBottom: "1px solid var(--border-default, #e5e7eb)"
                }}
              >
                {section.label}
              </div>
              <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                {section.fields.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: 12, margin: 0 }}>No fields.</p>
                ) : (
                  section.fields.map((field: HtField) => (
                    <div
                      key={field.id}
                      style={{
                        fontSize: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        color: "var(--text)"
                      }}
                    >
                      <span style={{ flex: 1 }}>{field.label}</span>
                      <span
                        style={{
                          fontSize: 10,
                          background: "var(--surface-info-muted, #eff6ff)",
                          color: "var(--colour-info, #1d4ed8)",
                          padding: "1px 4px",
                          borderRadius: 3
                        }}
                      >
                        {field.type}
                      </span>
                      {field.required && (
                        <span style={{ fontSize: 10, color: "var(--colour-danger, #dc2626)" }}>
                          *
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared panel styles ─────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  border: "1px solid var(--border-default, #e5e7eb)",
  borderRadius: "var(--radius-md, 6px)",
  padding: "var(--space-4, 16px)",
  background: "var(--surface-base, #fff)",
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const panelHeaderStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--border-default, #e5e7eb)",
  paddingBottom: 10,
  marginBottom: 4
};

// ─── Draft panel ─────────────────────────────────────────────────────────────

type DraftPanelProps = {
  draft: HtTemplate | null;
  activeVersion: number;
  onCreateDraft: () => Promise<unknown>;
  onPublish: () => Promise<unknown>;
  sectionCallbacks: {
    onRename: (sectionId: string, label: string) => Promise<unknown>;
    onDelete: (sectionId: string) => Promise<unknown>;
    onMoveUp: (sectionId: string) => Promise<unknown>;
    onMoveDown: (sectionId: string) => Promise<unknown>;
    onAddField: (sectionId: string, dto: AddFieldDto) => Promise<unknown>;
    onFieldMoveUp: (sectionId: string, fieldId: string) => Promise<unknown>;
    onFieldMoveDown: (sectionId: string, fieldId: string) => Promise<unknown>;
    onFieldUpdate: (
      fieldId: string,
      dto: { label?: string; required?: boolean; autoBinding?: string | null; listId?: string | null }
    ) => Promise<unknown>;
    onFieldRetire: (fieldId: string) => Promise<unknown>;
  };
  onAddSection: (label: string) => Promise<unknown>;
  busy?: boolean;
  error?: string | null;
};

function DraftPanel({
  draft,
  activeVersion,
  onCreateDraft,
  onPublish,
  sectionCallbacks,
  onAddSection,
  busy,
  error
}: DraftPanelProps) {
  const [creatingDraft, setCreatingDraft] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [addSectionBusy, setAddSectionBusy] = useState(false);
  const [addSectionError, setAddSectionError] = useState<string | null>(null);

  async function handleCreateDraft() {
    setCreatingDraft(true);
    setCreateError(null);
    try {
      await onCreateDraft();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create draft.");
    } finally {
      setCreatingDraft(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await onPublish();
      setConfirmPublish(false);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Failed to publish draft.");
    } finally {
      setPublishing(false);
    }
  }

  async function handleAddSection(label: string) {
    setAddSectionBusy(true);
    setAddSectionError(null);
    try {
      await onAddSection(label);
      setShowAddSection(false);
    } catch (err) {
      setAddSectionError(err instanceof Error ? err.message : "Failed to add section.");
    } finally {
      setAddSectionBusy(false);
    }
  }

  const canPublish = draft !== null && draft.sections.length > 0;

  // No draft — empty state
  if (!draft) {
    return (
      <div style={panelStyle}>
        <header style={panelHeaderStyle}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Draft (v{activeVersion + 1})</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 0" }}>
            No draft exists
          </p>
        </header>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            padding: "24px 0"
          }}
        >
          <p style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", margin: 0 }}>
            There is no draft template. Create one from the current active version to start editing.
          </p>
          {createError && (
            <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 13, margin: 0 }}>
              {createError}
            </p>
          )}
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            onClick={() => void handleCreateDraft()}
            disabled={creatingDraft || busy}
          >
            {creatingDraft ? "Creating draft…" : "Create draft from active"}
          </button>
        </div>
        {error && (
          <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 13 }}>
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={panelStyle}>
      <header style={{ ...panelHeaderStyle, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15 }}>Draft (v{draft.version})</h3>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "4px 0 0" }}>
            {draft.sections.length} section{draft.sections.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--primary s7-btn--sm"
          disabled={!canPublish || publishing || busy}
          onClick={() => setConfirmPublish(true)}
        >
          Publish
        </button>
      </header>

      {/* Publish confirm */}
      {confirmPublish && (
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: "var(--radius-sm, 4px)",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <p style={{ margin: 0, fontSize: 13 }}>
            This will create a new active version (v{draft.version}). Existing handovers will keep
            their pinned version and are not affected.
          </p>
          {publishError && (
            <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 12, margin: 0 }}>
              {publishError}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              className="s7-btn s7-btn--primary s7-btn--sm"
              disabled={publishing}
              onClick={() => void handlePublish()}
            >
              {publishing ? "Publishing…" : "Confirm publish"}
            </button>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              disabled={publishing}
              onClick={() => {
                setConfirmPublish(false);
                setPublishError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 13 }}>
          {error}
        </p>
      )}

      {/* Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {draft.sections.length === 0 && (
          <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>
            No sections yet. Add one below.
          </p>
        )}
        {draft.sections.map((section: HtSection, idx: number) => (
          <HandoverTemplateSectionEditor
            key={section.id}
            section={section}
            isFirst={idx === 0}
            isLast={idx === draft.sections.length - 1}
            onRename={sectionCallbacks.onRename}
            onDelete={sectionCallbacks.onDelete}
            onMoveUp={sectionCallbacks.onMoveUp}
            onMoveDown={sectionCallbacks.onMoveDown}
            onAddField={sectionCallbacks.onAddField}
            onFieldMoveUp={sectionCallbacks.onFieldMoveUp}
            onFieldMoveDown={sectionCallbacks.onFieldMoveDown}
            onFieldUpdate={sectionCallbacks.onFieldUpdate}
            onFieldRetire={sectionCallbacks.onFieldRetire}
            globalBusy={busy}
          />
        ))}

        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => setShowAddSection(true)}
          disabled={busy}
          style={{ alignSelf: "flex-start" }}
        >
          + Add section
        </button>
      </div>

      {showAddSection && (
        <AddSectionDialog
          onConfirm={handleAddSection}
          onClose={() => {
            setShowAddSection(false);
            setAddSectionError(null);
          }}
          busy={addSectionBusy}
          error={addSectionError}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HandoverTemplatePage() {
  const { user, authFetch } = useAuth();

  // Permission gate
  if (!can(user, "handovertemplate.manage")) {
    return (
      <NoAccess required="handovertemplate.manage" title="Access denied" />
    );
  }

  return <HandoverTemplateEditor authFetch={authFetch} />;
}

// Inner component — only rendered when permission is confirmed
function HandoverTemplateEditor({
  authFetch
}: {
  authFetch: ReturnType<typeof useAuth>["authFetch"];
}) {
  const [active, setActive] = useState<HtTemplate | null>(null);
  const [draft, setDraft] = useState<HtTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [opError, setOpError] = useState<string | null>(null);

  const loadBoth = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [activeResult, draftResult] = await Promise.all([
        htGetActive(authFetch),
        htGetDraft(authFetch)
      ]);
      setActive(activeResult);
      setDraft(draftResult);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load template data.");
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadBoth();
  }, [loadBoth]);

  // ── Shared operation wrapper ─────────────────────────────────────────────

  async function op<T>(fn: () => Promise<T>): Promise<T> {
    setBusy(true);
    setOpError(null);
    try {
      const result = await fn();
      await loadBoth();
      return result;
    } catch (err) {
      setOpError(err instanceof Error ? err.message : "Operation failed.");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  // ── Draft lifecycle ───────────────────────────────────────────────────────

  async function handleCreateDraft() {
    return op(() => htCreateDraft(authFetch));
  }

  async function handlePublish() {
    return op(() => htPublishDraft(authFetch));
  }

  // ── Section operations ────────────────────────────────────────────────────

  async function handleRenameSection(sectionId: string, label: string) {
    return op(() => htUpdateSection(authFetch, sectionId, { label }));
  }

  async function handleDeleteSection(sectionId: string) {
    return op(() => htDeleteSection(authFetch, sectionId));
  }

  async function handleMoveSectionUp(sectionId: string) {
    if (!draft) return;
    const idx = draft.sections.findIndex((s: HtSection) => s.id === sectionId);
    if (idx <= 0) return;
    const sibling = draft.sections[idx - 1];
    await op(async () => {
      await htUpdateSection(authFetch, sectionId, { sortOrder: sibling.sortOrder });
      await htUpdateSection(authFetch, sibling.id, { sortOrder: draft.sections[idx].sortOrder });
    });
  }

  async function handleMoveSectionDown(sectionId: string) {
    if (!draft) return;
    const idx = draft.sections.findIndex((s: HtSection) => s.id === sectionId);
    if (idx < 0 || idx >= draft.sections.length - 1) return;
    const sibling = draft.sections[idx + 1];
    await op(async () => {
      await htUpdateSection(authFetch, sectionId, { sortOrder: sibling.sortOrder });
      await htUpdateSection(authFetch, sibling.id, { sortOrder: draft.sections[idx].sortOrder });
    });
  }

  // ── Field operations ──────────────────────────────────────────────────────

  async function handleAddField(sectionId: string, dto: AddFieldDto) {
    return op(() => htAddField(authFetch, sectionId, dto));
  }

  async function handleFieldMoveUp(sectionId: string, fieldId: string) {
    if (!draft) return;
    const section = draft.sections.find((s: HtSection) => s.id === sectionId);
    if (!section) return;
    const activeFields = section.fields.filter((f: HtField) => !f.retiredAt);
    const idx = activeFields.findIndex((f: HtField) => f.id === fieldId);
    if (idx <= 0) return;
    const sibling = activeFields[idx - 1];
    await op(async () => {
      await htUpdateField(authFetch, fieldId, { sortOrder: sibling.sortOrder });
      await htUpdateField(authFetch, sibling.id, { sortOrder: activeFields[idx].sortOrder });
    });
  }

  async function handleFieldMoveDown(sectionId: string, fieldId: string) {
    if (!draft) return;
    const section = draft.sections.find((s: HtSection) => s.id === sectionId);
    if (!section) return;
    const activeFields = section.fields.filter((f: HtField) => !f.retiredAt);
    const idx = activeFields.findIndex((f: HtField) => f.id === fieldId);
    if (idx < 0 || idx >= activeFields.length - 1) return;
    const sibling = activeFields[idx + 1];
    await op(async () => {
      await htUpdateField(authFetch, fieldId, { sortOrder: sibling.sortOrder });
      await htUpdateField(authFetch, sibling.id, { sortOrder: activeFields[idx].sortOrder });
    });
  }

  async function handleFieldUpdate(
    fieldId: string,
    dto: { label?: string; required?: boolean; autoBinding?: string | null; listId?: string | null }
  ) {
    return op(() => htUpdateField(authFetch, fieldId, dto));
  }

  async function handleFieldRetire(fieldId: string) {
    return op(() => htRetireField(authFetch, fieldId));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="s7-page-content">
      <header style={{ marginBottom: "var(--space-6, 24px)" }}>
        <h2 className="s7-type-section-heading" style={{ margin: 0 }}>
          Handover template
        </h2>
        <p style={{ color: "var(--text-muted)", margin: "6px 0 0", maxWidth: 620, fontSize: 13 }}>
          Define the sections and fields that appear on every contract handover. Edit the draft, then
          publish to cut a new active version. Existing handovers are not affected.
        </p>
      </header>

      {loading && (
        <p style={{ color: "var(--text-muted)" }}>Loading template data…</p>
      )}

      {loadError && (
        <p role="alert" style={{ color: "var(--colour-danger, #dc2626)" }}>
          {loadError}
        </p>
      )}

      {!loading && !loadError && (
        <div
          style={{
            display: "flex",
            gap: "var(--space-6, 24px)",
            alignItems: "flex-start",
            flexWrap: "wrap"
          }}
        >
          {/* Live panel */}
          <LivePanel template={active} />

          {/* Draft editor */}
          <DraftPanel
            draft={draft}
            activeVersion={active?.version ?? 0}
            onCreateDraft={handleCreateDraft}
            onPublish={handlePublish}
            sectionCallbacks={{
              onRename: handleRenameSection,
              onDelete: handleDeleteSection,
              onMoveUp: handleMoveSectionUp,
              onMoveDown: handleMoveSectionDown,
              onAddField: handleAddField,
              onFieldMoveUp: handleFieldMoveUp,
              onFieldMoveDown: handleFieldMoveDown,
              onFieldUpdate: handleFieldUpdate,
              onFieldRetire: handleFieldRetire
            }}
            onAddSection={async (label) => {
              await op(() => htAddSection(authFetch, { label }));
            }}
            busy={busy}
            error={opError}
          />
        </div>
      )}
    </div>
  );
}
