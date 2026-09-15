import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";

// ── Types ──────────────────────────────────────────────────────────────────

type FieldProvenance = {
  confidence: number;
  sourcePage: number | null;
  sourceLine: number | null;
  sourceText: string | null;
  coercedFrom: string | null;
};

type FieldDto = {
  fieldKey: string;
  label: string;
  fieldType: string;
  fieldOrder: number;
  isRequired?: boolean;
  placeholder?: string;
  helpText?: string;
  optionsJson?: string[];
};

type SectionDto = {
  title: string;
  description?: string;
  sectionOrder: number;
  fields: FieldDto[];
};

type ProposalDto = {
  name: string;
  code: string;
  description?: string;
  status?: string;
  geolocationEnabled?: boolean;
  associationScopes?: string[];
  sections: SectionDto[];
};

type PreviewImportPayload = {
  jobId: string;
  extractedText: string;
  pages: number;
  proposal: ProposalDto;
  provenance: Record<string, FieldProvenance>;
};

// Filter segments
type FilterSegment = "all" | "needs-look" | "guessed" | "rejected";

// ── Helper functions ──────────────────────────────────────────────────────

function confidenceLabel(c: number): "read" | "guessed" | "invented" {
  if (c >= 0.8) return "read";
  if (c >= 0.4) return "guessed";
  return "invented";
}

function confidenceColor(label: "read" | "guessed" | "invented"): string {
  if (label === "read") return "var(--status-active, #16a34a)";
  if (label === "guessed") return "var(--status-warning, #d97706)";
  return "var(--status-error, #dc2626)";
}

function allFieldTypes(): string[] {
  return [
    "text", "textarea", "number", "date", "time", "email", "phone", "address",
    "multiple_choice", "checkbox", "radio", "rating", "scale", "signature",
    "image_capture", "heading", "paragraph"
  ];
}

function countStats(
  sections: SectionDto[],
  provenance: Record<string, FieldProvenance>,
  rejected: Set<string>
) {
  let fields = 0;
  let kept = 0;
  let rejectedCount = 0;
  let read = 0;
  let guessed = 0;
  let coerced = 0;

  for (const section of sections) {
    for (const field of section.fields) {
      fields++;
      if (rejected.has(field.fieldKey)) {
        rejectedCount++;
      } else {
        kept++;
      }
      const prov = provenance[field.fieldKey];
      if (prov) {
        const lbl = confidenceLabel(prov.confidence);
        if (lbl === "read") read++;
        else if (lbl === "guessed") guessed++;
        if (prov.coercedFrom !== null) coerced++;
      }
    }
  }

  return { sectionCount: sections.length, fields, kept, rejected: rejectedCount, read, guessed, coerced };
}

// ── Chip component ────────────────────────────────────────────────────────

function ProvenanceChip({ label }: { label: "read" | "guessed" | "invented" }) {
  const color = confidenceColor(label);
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: "0.02em",
        color,
        border: `1px solid ${color}`,
        background: "transparent",
        textTransform: "uppercase",
        lineHeight: "18px"
      }}
    >
      {label}
    </span>
  );
}

function CoercedChip({ from }: { from: string }) {
  return (
    <span
      title={`Model proposed type: ${from}`}
      style={{
        display: "inline-block",
        padding: "1px 7px",
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        color: "var(--status-warning, #d97706)",
        border: "1px solid var(--status-warning, #d97706)",
        background: "transparent",
        textTransform: "uppercase",
        lineHeight: "18px"
      }}
    >
      type coerced
    </span>
  );
}

// ── Source pane ───────────────────────────────────────────────────────────

function SourcePane({
  text,
  highlightLine
}: {
  text: string;
  highlightLine: string | null;
}) {
  const lineRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (highlightLine) {
      const el = lineRefs.current.get(highlightLine);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [highlightLine]);

  const lines = text.split("\n");

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: 11,
        lineHeight: 1.7,
        overflowY: "auto",
        height: "100%",
        padding: "12px 14px",
        background: "var(--surface-subtle)",
        borderRadius: 6,
        border: "1px solid var(--border-default)"
      }}
    >
      {lines.map((line, idx) => {
        const lineId = `L${idx + 1}`;
        const isPage = line.startsWith("--- Page ");
        const isHighlighted = highlightLine === lineId;
        return (
          <div
            key={idx}
            ref={(el) => {
              if (el) lineRefs.current.set(lineId, el);
            }}
            style={{
              display: "flex",
              gap: 8,
              background: isHighlighted ? "color-mix(in srgb, var(--brand-accent) 20%, transparent)" : "transparent",
              borderRadius: isHighlighted ? 3 : 0,
              padding: "0 4px"
            }}
          >
            <span style={{ color: "var(--text-muted)", userSelect: "none", minWidth: 32, textAlign: "right" }}>
              {idx + 1}
            </span>
            <span style={{ color: isPage ? "var(--text-secondary)" : "inherit", fontWeight: isPage ? 600 : "normal", flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {line}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Field row ─────────────────────────────────────────────────────────────

function FieldRow({
  field,
  prov,
  rejected,
  onToggleReject,
  onTypeChange,
  onLabelChange,
  onRequiredChange,
  onHighlightLine
}: {
  field: FieldDto;
  prov: FieldProvenance | undefined;
  rejected: boolean;
  onToggleReject: () => void;
  onTypeChange: (t: string) => void;
  onLabelChange: (l: string) => void;
  onRequiredChange: (r: boolean) => void;
  onHighlightLine: (line: string | null) => void;
}) {
  const confidence = prov?.confidence ?? 0.5;
  const provLabel = confidenceLabel(confidence);
  const sourceRef = prov?.sourceLine != null ? `L${prov.sourceLine}` : null;

  return (
    <div
      style={{
        padding: "10px 12px",
        borderBottom: "1px solid var(--border-default)",
        opacity: rejected ? 0.45 : 1,
        background: rejected ? "var(--surface-subtle)" : "var(--surface-card)"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        {/* Label (editable) */}
        <div style={{ flex: 2, minWidth: 0 }}>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onLabelChange(e.target.value)}
            disabled={rejected}
            style={{
              width: "100%",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: "4px 8px",
              fontSize: 12,
              background: "var(--surface-card)",
              color: "var(--text-primary)",
              textDecoration: rejected ? "line-through" : "none"
            }}
          />
        </div>

        {/* Type select */}
        <div style={{ flex: 1, minWidth: 80 }}>
          <select
            value={field.fieldType}
            onChange={(e) => onTypeChange(e.target.value)}
            disabled={rejected}
            style={{
              width: "100%",
              border: "1px solid var(--border-default)",
              borderRadius: 4,
              padding: "4px 6px",
              fontSize: 11,
              background: "var(--surface-card)",
              color: "var(--text-primary)"
            }}
          >
            {allFieldTypes().map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Required */}
        <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, whiteSpace: "nowrap", paddingTop: 4 }}>
          <input
            type="checkbox"
            checked={field.isRequired ?? false}
            onChange={(e) => onRequiredChange(e.target.checked)}
            disabled={rejected}
          />
          req
        </label>

        {/* Reject toggle */}
        <button
          type="button"
          onClick={onToggleReject}
          title={rejected ? "Include field" : "Reject field"}
          style={{
            padding: "3px 8px",
            borderRadius: 4,
            border: "1px solid var(--border-default)",
            cursor: "pointer",
            fontSize: 11,
            background: rejected ? "var(--surface-card)" : "transparent",
            color: rejected ? "var(--status-active, #16a34a)" : "var(--text-secondary)"
          }}
        >
          {rejected ? "Include" : "Reject"}
        </button>
      </div>

      {/* Provenance bar */}
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <ProvenanceChip label={provLabel} />
        {prov?.coercedFrom ? <CoercedChip from={prov.coercedFrom} /> : null}

        {/* Confidence bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 48, height: 4, borderRadius: 2, background: "var(--border-default)", overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.round(confidence * 100)}%`,
                height: "100%",
                background: confidenceColor(provLabel),
                borderRadius: 2
              }}
            />
          </div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{Math.round(confidence * 100)}%</span>
        </div>

        {/* Source reference */}
        {sourceRef ? (
          <button
            type="button"
            onClick={() => onHighlightLine(sourceRef)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              cursor: "pointer",
              color: "var(--brand-accent, #2563eb)",
              fontSize: 10,
              textDecoration: "underline"
            }}
          >
            {prov?.sourcePage != null ? `p.${prov.sourcePage} ` : ""}{sourceRef}
          </button>
        ) : null}

        {/* options chips */}
        {field.optionsJson && field.optionsJson.length > 0 ? (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
            {field.optionsJson.slice(0, 4).map((o) => `"${o}"`).join(", ")}
            {field.optionsJson.length > 4 ? ` +${field.optionsJson.length - 4}` : ""}
          </span>
        ) : null}
      </div>
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────────

function SectionBlock({
  section,
  sectionIdx,
  provenance,
  rejectedFields,
  rejectedSections,
  filter,
  highlightLine,
  onToggleFieldReject,
  onToggleSectionReject,
  onFieldTypeChange,
  onFieldLabelChange,
  onFieldRequiredChange,
  onSectionTitleChange,
  onHighlightLine
}: {
  section: SectionDto;
  sectionIdx: number;
  provenance: Record<string, FieldProvenance>;
  rejectedFields: Set<string>;
  rejectedSections: Set<number>;
  filter: FilterSegment;
  highlightLine: string | null;
  onToggleFieldReject: (key: string) => void;
  onToggleSectionReject: (idx: number) => void;
  onFieldTypeChange: (key: string, t: string) => void;
  onFieldLabelChange: (key: string, l: string) => void;
  onFieldRequiredChange: (key: string, r: boolean) => void;
  onSectionTitleChange: (idx: number, t: string) => void;
  onHighlightLine: (line: string | null) => void;
}) {
  const sectionRejected = rejectedSections.has(sectionIdx);

  const visibleFields = section.fields.filter((f) => {
    if (filter === "all") return true;
    const prov = provenance[f.fieldKey];
    const rejected = rejectedFields.has(f.fieldKey) || sectionRejected;
    if (filter === "rejected") return rejected;
    if (rejected) return false;
    if (filter === "needs-look") {
      return prov?.coercedFrom != null || (prov?.confidence ?? 0.5) < 0.6;
    }
    if (filter === "guessed") {
      return prov != null && confidenceLabel(prov.confidence) === "guessed";
    }
    return true;
  });

  return (
    <div style={{ marginBottom: 16, border: "1px solid var(--border-default)", borderRadius: 6, overflow: "hidden" }}>
      {/* Section header */}
      <div
        style={{
          background: "var(--surface-subtle)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          opacity: sectionRejected ? 0.45 : 1
        }}
      >
        <input
          type="text"
          value={section.title}
          onChange={(e) => onSectionTitleChange(sectionIdx, e.target.value)}
          disabled={sectionRejected}
          style={{
            flex: 1,
            border: "1px solid var(--border-default)",
            borderRadius: 4,
            padding: "4px 8px",
            fontSize: 13,
            fontWeight: 600,
            background: "var(--surface-card)",
            color: "var(--text-primary)",
            textDecoration: sectionRejected ? "line-through" : "none"
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {section.fields.length} field{section.fields.length !== 1 ? "s" : ""}
        </span>
        <button
          type="button"
          onClick={() => onToggleSectionReject(sectionIdx)}
          style={{
            padding: "3px 8px",
            borderRadius: 4,
            border: "1px solid var(--border-default)",
            cursor: "pointer",
            fontSize: 11,
            background: sectionRejected ? "var(--surface-card)" : "transparent",
            color: sectionRejected ? "var(--status-active, #16a34a)" : "var(--text-secondary)"
          }}
        >
          {sectionRejected ? "Include section" : "Reject section"}
        </button>
      </div>

      {/* Fields */}
      {visibleFields.length === 0 ? (
        <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted)" }}>
          No fields match the current filter.
        </div>
      ) : (
        visibleFields.map((field) => (
          <FieldRow
            key={field.fieldKey}
            field={field}
            prov={provenance[field.fieldKey]}
            rejected={rejectedFields.has(field.fieldKey) || sectionRejected}
            onToggleReject={() => onToggleFieldReject(field.fieldKey)}
            onTypeChange={(t) => onFieldTypeChange(field.fieldKey, t)}
            onLabelChange={(l) => onFieldLabelChange(field.fieldKey, l)}
            onRequiredChange={(r) => onFieldRequiredChange(field.fieldKey, r)}
            onHighlightLine={onHighlightLine}
          />
        ))
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

/**
 * FormImportReviewPage -- state 3 of the FV2-import flow.
 *
 * Loaded at /forms/import/:jobId. Fetches the preview proposal via
 * GET /forms/templates/preview-import/:jobId, shows a two-pane review UI
 * (source text left, editable proposal right), then submits the edited
 * proposal to POST /forms/templates/preview-import/:jobId/create.
 *
 * State 4: failure / expired job
 * State 5: done -- shows what was created and rejected
 */
export function FormImportReviewPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { authFetch } = useAuth();
  const navigate = useNavigate();

  // Data state
  const [payload, setPayload] = useState<PreviewImportPayload | null>(null);
  const [proposal, setProposal] = useState<ProposalDto | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterSegment>("all");
  const [rejectedFields, setRejectedFields] = useState<Set<string>>(new Set());
  const [rejectedSections, setRejectedSections] = useState<Set<number>>(new Set());
  const [highlightLine, setHighlightLine] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<{ id: string; keptCount: number; rejectedCount: number } | null>(null);

  // Meta bar inputs
  const [nameVal, setNameVal] = useState("");
  const [codeVal, setCodeVal] = useState("");
  const [categoryVal, setCategoryVal] = useState("");

  // Load on mount
  useEffect(() => {
    if (!jobId) return;
    void (async () => {
      try {
        const res = await authFetch(`/forms/templates/preview-import/${jobId}`);
        if (res.status === 404) {
          setExpired(true);
          setLoading(false);
          return;
        }
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          throw new Error(body.message ?? `Failed to load import job (${res.status})`);
        }
        const data = (await res.json()) as PreviewImportPayload;
        setPayload(data);
        setProposal(data.proposal);
        setNameVal(data.proposal.name);
        setCodeVal(data.proposal.code);
        setCategoryVal(data.proposal.description ?? "");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]); // authFetch is stable (AuthContext memo)

  // Mutation helpers -- all return new proposal (immutable updates)
  const updateField = (fieldKey: string, updater: (f: FieldDto) => FieldDto) => {
    setProposal((p) => {
      if (!p) return p;
      return {
        ...p,
        sections: p.sections.map((s) => ({
          ...s,
          fields: s.fields.map((f) => f.fieldKey === fieldKey ? updater(f) : f)
        }))
      };
    });
  };

  const onFieldTypeChange = (key: string, t: string) =>
    updateField(key, (f) => ({ ...f, fieldType: t }));
  const onFieldLabelChange = (key: string, l: string) =>
    updateField(key, (f) => ({ ...f, label: l }));
  const onFieldRequiredChange = (key: string, r: boolean) =>
    updateField(key, (f) => ({ ...f, isRequired: r }));

  const onSectionTitleChange = (idx: number, title: string) => {
    setProposal((p) => {
      if (!p) return p;
      return {
        ...p,
        sections: p.sections.map((s, i) => i === idx ? { ...s, title } : s)
      };
    });
  };

  const onToggleFieldReject = (key: string) => {
    setRejectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onToggleSectionReject = (idx: number) => {
    setRejectedSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const submit = async () => {
    if (!proposal || !jobId) return;
    setSubmitting(true);
    setError(null);
    try {
      // Build cleaned DTO: remove rejected fields and sections
      const cleanedSections = proposal.sections
        .filter((_, sIdx) => !rejectedSections.has(sIdx))
        .map((s) => ({
          ...s,
          fields: s.fields.filter((f) => !rejectedFields.has(f.fieldKey))
        }))
        .filter((s) => s.fields.length > 0);

      if (cleanedSections.length === 0) {
        // Keep a placeholder so the API doesn't reject ArrayMinSize(1)
        cleanedSections.push({ title: "Section 1", sectionOrder: 1, fields: [] });
      }

      const totalFields = proposal.sections.reduce((a, s) => a + s.fields.length, 0);
      const keptFields = cleanedSections.reduce((a, s) => a + s.fields.length, 0);

      const cleanedProposal = {
        ...proposal,
        name: nameVal || proposal.name,
        code: codeVal || proposal.code,
        description: categoryVal || proposal.description,
        status: "DRAFT",
        sections: cleanedSections
      };

      const res = await authFetch(`/forms/templates/preview-import/${jobId}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal: cleanedProposal })
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Create failed (${res.status})`);
      }

      const created = (await res.json()) as { id: string };
      setDone({
        id: created.id,
        keptCount: keptFields,
        rejectedCount: totalFields - keptFields
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  // ── State 4: expired ──────────────────────────────────────────────────

  if (expired) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 16,
          padding: 32
        }}
      >
        <div style={{ fontSize: 48 }}>&#x23F3;</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
          This extraction has expired
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", textAlign: "center", maxWidth: 380 }}>
          Import proposals are held for 30 minutes. This one has expired -- import the document again to start a new extraction.
        </p>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => navigate("/forms")}
        >
          Back to Forms
        </button>
      </div>
    );
  }

  // ── State 4: load error ───────────────────────────────────────────────

  if (!loading && error && !payload) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 16,
          padding: 32
        }}
      >
        <div style={{ fontSize: 48 }}>&#x26A0;&#xFE0F;</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
          Could not load import
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--status-error, #dc2626)", textAlign: "center", maxWidth: 380 }}>
          {error}
        </p>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => navigate("/forms")}
        >
          Back to Forms
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────

  if (loading || !payload || !proposal) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ height: 24, width: 260, borderRadius: 4, background: "var(--surface-subtle)", marginBottom: 16 }} />
        <div style={{ height: 16, width: 180, borderRadius: 4, background: "var(--surface-subtle)", marginBottom: 8 }} />
        <div style={{ height: 16, width: 220, borderRadius: 4, background: "var(--surface-subtle)" }} />
      </div>
    );
  }

  const stats = countStats(proposal.sections, payload.provenance, new Set([
    ...rejectedFields,
    ...proposal.sections
      .filter((_, i) => rejectedSections.has(i))
      .flatMap((s) => s.fields.map((f) => f.fieldKey))
  ]));

  // ── State 5: done ─────────────────────────────────────────────────────

  if (done) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 16,
          padding: 32
        }}
      >
        <div style={{ fontSize: 48 }}>&#x2705;</div>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
          Draft created
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", textAlign: "center", maxWidth: 400 }}>
          {done.keptCount} field{done.keptCount !== 1 ? "s" : ""} created
          {done.rejectedCount > 0 ? `, ${done.rejectedCount} rejected` : ""}.
          The template is in DRAFT status -- open it in the designer to review and publish.
        </p>
        <button
          type="button"
          className="s7-btn s7-btn--primary"
          onClick={() => navigate(`/forms/designer/${done.id}`)}
        >
          Open in designer
        </button>
        <button
          type="button"
          className="s7-btn s7-btn--ghost"
          onClick={() => navigate("/forms")}
        >
          Back to Forms
        </button>
      </div>
    );
  }

  // ── State 3: review ───────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          padding: "14px 20px 10px",
          borderBottom: "1px solid var(--border-default)",
          background: "var(--surface-card)"
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            Review extraction
          </h1>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {payload.pages} page{payload.pages !== 1 ? "s" : ""} &bull; DRAFT v1 will be created
          </span>
        </div>

        {/* Editable meta */}
        <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Name</label>
            <input
              type="text"
              value={nameVal}
              onChange={(e) => setNameVal(e.target.value)}
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: 13,
                background: "var(--surface-card)",
                color: "var(--text-primary)"
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 120 }}>
            <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Code</label>
            <input
              type="text"
              value={codeVal}
              onChange={(e) => setCodeVal(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: 12,
                fontFamily: "monospace",
                background: "var(--surface-card)",
                color: "var(--text-primary)"
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
            <input
              type="text"
              value={categoryVal}
              onChange={(e) => setCategoryVal(e.target.value)}
              style={{
                border: "1px solid var(--border-default)",
                borderRadius: 4,
                padding: "5px 8px",
                fontSize: 13,
                background: "var(--surface-card)",
                color: "var(--text-primary)"
              }}
            />
          </div>
        </div>

        {/* Meta bar */}
        <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap", fontSize: 12, color: "var(--text-secondary)" }}>
          <span>{stats.sectionCount} section{stats.sectionCount !== 1 ? "s" : ""}</span>
          <span>{stats.kept} field{stats.kept !== 1 ? "s" : ""} kept</span>
          {stats.rejected > 0 ? <span style={{ color: "var(--status-error, #dc2626)" }}>{stats.rejected} rejected</span> : null}
          <span>{stats.read} read verbatim</span>
          <span style={{ color: stats.guessed > 0 ? "var(--status-warning, #d97706)" : undefined }}>
            {stats.guessed} guessed
          </span>
          {stats.coerced > 0 ? (
            <span style={{ color: "var(--status-warning, #d97706)" }}>{stats.coerced} type coerced</span>
          ) : null}
          <span style={{ color: "var(--text-muted)" }}>will be created as DRAFT v1</span>
        </div>

        {/* Filter segment */}
        <div style={{ display: "flex", gap: 2, marginTop: 10 }}>
          {(["all", "needs-look", "guessed", "rejected"] as FilterSegment[]).map((seg) => (
            <button
              key={seg}
              type="button"
              onClick={() => setFilter(seg)}
              style={{
                padding: "4px 12px",
                borderRadius: 4,
                border: "1px solid var(--border-default)",
                cursor: "pointer",
                fontSize: 11,
                background: filter === seg ? "var(--brand-accent, #2563eb)" : "transparent",
                color: filter === seg ? "#fff" : "var(--text-secondary)",
                fontWeight: filter === seg ? 600 : 400
              }}
            >
              {seg === "all" ? "All" : seg === "needs-look" ? "Needs a look" : seg === "guessed" ? "Guessed" : "Rejected"}
            </button>
          ))}
        </div>
      </div>

      {/* Two-pane body */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, gap: 0, overflow: "hidden" }}>
        {/* Left: source text */}
        <div
          style={{
            flex: "0 0 40%",
            minWidth: 0,
            overflow: "hidden",
            borderRight: "1px solid var(--border-default)",
            display: "flex",
            flexDirection: "column",
            padding: 12
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Source text
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <SourcePane text={payload.extractedText} highlightLine={highlightLine} />
          </div>
        </div>

        {/* Right: proposal */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "auto",
            padding: 12
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Proposed fields
          </div>

          {proposal.sections.map((section, idx) => (
            <SectionBlock
              key={idx}
              section={section}
              sectionIdx={idx}
              provenance={payload.provenance}
              rejectedFields={rejectedFields}
              rejectedSections={rejectedSections}
              filter={filter}
              highlightLine={highlightLine}
              onToggleFieldReject={onToggleFieldReject}
              onToggleSectionReject={onToggleSectionReject}
              onFieldTypeChange={onFieldTypeChange}
              onFieldLabelChange={onFieldLabelChange}
              onFieldRequiredChange={onFieldRequiredChange}
              onSectionTitleChange={onSectionTitleChange}
              onHighlightLine={setHighlightLine}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "12px 20px",
          borderTop: "1px solid var(--border-default)",
          background: "var(--surface-card)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12
        }}
      >
        <div>
          {error ? (
            <span
              role="alert"
              style={{ fontSize: 12, color: "var(--status-error, #dc2626)" }}
            >
              {error}
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={() => navigate("/forms")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "var(--brand-accent)", color: "#242424", borderColor: "var(--brand-accent)" }}
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create DRAFT"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Export helpers for testing
export { confidenceLabel, countStats };
export type { FieldProvenance, FieldDto, SectionDto, ProposalDto, PreviewImportPayload, FilterSegment };
