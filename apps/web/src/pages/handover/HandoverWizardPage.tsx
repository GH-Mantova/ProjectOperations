/**
 * B-HW-7: Handover wizard shell.
 *
 * Launched from the contract detail page (Overview tab) via "Open handover wizard".
 * - Loads the handover instance by id (/handovers/:id).
 * - Renders the pinned template version as a step-per-section wizard.
 * - Pricing & Budget section is always sorted first (step #1).
 * - Supports draft save/resume via PATCH /handovers/:id/values.
 * - Per-section "Section Done" toggle.
 * - Overall completion bar.
 * - Field rendering dispatches on field.type (text, money, date, list, attachment, contact).
 * - Auto-prefilled fields (sourceType="auto") show their value pre-filled.
 *
 * B-HW-8 adds: "edited — differs from source" badge + reset-to-source on auto
 * fields, a pre-finalise "quote updated — re-sync?" prompt driven by a
 * source-refresh check, a derived quoted-vs-contracted variance panel, and a
 * hard lock on derived / completion-% fields.
 *
 * Deferred to B-HW-9+: compliance derivation.
 * Deferred to B-HW-10+: subcontractors.
 * Deferred to B-HW-11+: finalise → create job.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { hwGet, hwPatchValues } from "./handoverApi";
import type { Handover, HandoverField, HandoverSection, HandoverValue } from "./handoverApi";
import {
  computeQuotedVsContractedVariance,
  detectSourceDrift,
  isReadOnlyField,
  resetPatch,
  type QuotedVsContractedVariance,
  type SourceDrift
} from "./autoFieldSafeguards";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PRICING_KEYWORDS = ["pricing", "price", "budget", "cost", "financial"];

/** Sort sections so that the Pricing & Budget section is always first. */
function sortedSections(sections: HandoverSection[]): HandoverSection[] {
  return [...sections].sort((sectionA, sectionB) => {
    const aLabel = sectionA.label.toLowerCase();
    const bLabel = sectionB.label.toLowerCase();
    const aPricing = PRICING_KEYWORDS.some((kw) => aLabel.includes(kw));
    const bPricing = PRICING_KEYWORDS.some((kw) => bLabel.includes(kw));
    if (aPricing && !bPricing) return -1;
    if (!aPricing && bPricing) return 1;
    return sectionA.sortOrder - sectionB.sortOrder;
  });
}

/** Build a map from fieldKey → HandoverValue for quick look-up. */
function buildValueMap(values: HandoverValue[]): Map<string, HandoverValue> {
  return new Map(values.map((v) => [v.fieldKey, v]));
}

/** Coerce a stored JSON value into the string a form input expects. */
function coerceToString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return JSON.stringify(val);
}

function fmtPct(n: number): string {
  return `${Math.max(0, Math.min(100, Math.round(n)))}%`;
}

// ─── Completion bar ───────────────────────────────────────────────────────────

function CompletionBar({ pct, size = "md" }: { pct: number; size?: "sm" | "md" }) {
  const height = size === "sm" ? 6 : 10;
  const clamped = Math.max(0, Math.min(100, pct));
  const colour =
    clamped >= 100
      ? "#22C55E"
      : clamped >= 60
        ? "#005B61"
        : clamped >= 30
          ? "#FEAA6D"
          : "#9CA3AF";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div
        style={{
          flex: 1,
          height,
          borderRadius: height / 2,
          background: "var(--border-default, #e5e7eb)",
          overflow: "hidden"
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${clamped}%`,
            background: colour,
            borderRadius: height / 2,
            transition: "width 0.3s ease"
          }}
        />
      </div>
      <span style={{ fontSize: size === "sm" ? 11 : 13, fontWeight: 600, color: colour, minWidth: 36 }}>
        {fmtPct(clamped)}
      </span>
    </div>
  );
}

// ─── Field renderer ───────────────────────────────────────────────────────────

type FieldRendererProps = {
  field: HandoverField;
  currentValue: string;
  onChange: (val: string) => void;
  disabled?: boolean;
};

function FieldRenderer({ field, currentValue, onChange, disabled }: FieldRendererProps) {
  const baseInputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    border: "1px solid var(--border-default, #e5e7eb)",
    borderRadius: "var(--radius-sm, 4px)",
    fontSize: 13,
    background: disabled ? "var(--surface-muted, #F6F6F6)" : "var(--surface-base, #fff)",
    color: disabled ? "var(--text-muted)" : "var(--text)",
    cursor: disabled ? "not-allowed" : "text"
  };

  if (field.type === "date") {
    // Normalise ISO datetime to date-only for the input
    const dateOnly = currentValue ? currentValue.slice(0, 10) : "";
    return (
      <input
        type="date"
        className="s7-input"
        style={baseInputStyle}
        value={dateOnly}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "money") {
    return (
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 8,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-muted)",
            fontSize: 13,
            pointerEvents: "none"
          }}
        >
          $
        </span>
        <input
          type="number"
          className="s7-input"
          style={{ ...baseInputStyle, paddingLeft: 22 }}
          value={currentValue}
          disabled={disabled}
          step="0.01"
          min="0"
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (field.type === "list") {
    // Render as a text input for now (no list items fetched); B-HW-8 may upgrade.
    return (
      <input
        type="text"
        className="s7-input"
        style={baseInputStyle}
        value={currentValue}
        disabled={disabled}
        placeholder="Select or type a value…"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (field.type === "attachment") {
    return (
      <div
        style={{
          ...baseInputStyle,
          cursor: "default",
          color: "var(--text-muted)",
          fontStyle: "italic",
          fontSize: 12
        }}
      >
        {currentValue || "No attachment — upload in Documents after handover is finalised."}
      </div>
    );
  }

  if (field.type === "contact") {
    return (
      <input
        type="text"
        className="s7-input"
        style={baseInputStyle}
        value={currentValue}
        disabled={disabled}
        placeholder="Contact name, email or phone…"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  // Default: text (multi-line for long content)
  return (
    <textarea
      className="s7-input"
      style={{ ...baseInputStyle, resize: "vertical", minHeight: 60 }}
      value={currentValue}
      disabled={disabled}
      rows={2}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ─── Section step panel ───────────────────────────────────────────────────────

type SectionStepProps = {
  section: HandoverSection;
  stepIndex: number;
  totalSteps: number;
  valueMap: Map<string, HandoverValue>;
  localDraft: Map<string, string>;
  sectionDone: boolean;
  saving: boolean;
  onFieldChange: (fieldKey: string, val: string) => void;
  onResetField: (fieldKey: string) => Promise<void>;
  onSave: () => Promise<void>;
  onToggleSectionDone: () => Promise<void>;
  onNext: () => void;
  onPrev: () => void;
};

function SectionStep({
  section,
  stepIndex,
  totalSteps,
  valueMap,
  localDraft,
  sectionDone,
  saving,
  onFieldChange,
  onResetField,
  onSave,
  onToggleSectionDone,
  onNext,
  onPrev
}: SectionStepProps) {
  const activeFields = section.fields.filter((f) => !f.retiredAt);
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  return (
    <div>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}
      >
        <div>
          <p style={{ margin: "0 0 2px", fontSize: 12, color: "var(--text-muted)" }}>
            Step {stepIndex + 1} of {totalSteps}
          </p>
          <h3 style={{ margin: 0, fontSize: 18 }}>{section.label}</h3>
        </div>
        {/* Section Done toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
            color: sectionDone ? "#22C55E" : "var(--text-muted)"
          }}
        >
          <input
            type="checkbox"
            checked={sectionDone}
            disabled={saving}
            onChange={() => void onToggleSectionDone()}
            style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#22C55E" }}
          />
          Section done
        </label>
      </div>

      {/* Fields */}
      {activeFields.length === 0 ? (
        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>No fields in this section.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {activeFields.map((field) => {
            const saved = valueMap.get(field.key);
            const draftVal = localDraft.get(field.key);
            const displayVal =
              draftVal !== undefined ? draftVal : coerceToString(saved?.value ?? "");
            const isAutoField = field.sourceType === "auto";
            const readOnly = isReadOnlyField(field);
            const showEditedBadge =
              isAutoField && saved?.isOverridden === true && saved.sourceValue !== null;

            return (
              <div key={field.id}>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 600,
                    marginBottom: 4,
                    color: "var(--text)"
                  }}
                >
                  {field.label}
                  {field.required && (
                    <span style={{ color: "var(--colour-danger, #dc2626)", marginLeft: 2 }}>*</span>
                  )}
                  <span
                    style={{
                      marginLeft: 6,
                      fontSize: 10,
                      fontWeight: 400,
                      background: "var(--surface-info-muted, #eff6ff)",
                      color: "var(--colour-info, #1d4ed8)",
                      padding: "1px 5px",
                      borderRadius: 3
                    }}
                  >
                    {field.type}
                  </span>
                  {isAutoField && (
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        fontWeight: 400,
                        background: "#fef3c7",
                        color: "#92400e",
                        padding: "1px 5px",
                        borderRadius: 3
                      }}
                    >
                      auto-filled
                    </span>
                  )}
                  {readOnly && (
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 10,
                        fontWeight: 400,
                        background: "var(--surface-muted, #F6F6F6)",
                        color: "var(--text-muted)",
                        padding: "1px 5px",
                        borderRadius: 3
                      }}
                      title="Derived — computed from other fields; not editable."
                    >
                      derived
                    </span>
                  )}
                  {showEditedBadge && (
                    <span style={{ marginLeft: 6, display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          background: "#fee2e2",
                          color: "#991b1b",
                          padding: "1px 5px",
                          borderRadius: 3
                        }}
                        title={`Original source value: ${coerceToString(saved.sourceValue)}`}
                      >
                        edited — differs from source
                      </span>
                      <button
                        type="button"
                        onClick={() => void onResetField(field.key)}
                        disabled={saving || sectionDone}
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          border: "1px solid var(--border-default, #e5e7eb)",
                          borderRadius: 3,
                          background: "var(--surface-base, #fff)",
                          color: "var(--text)",
                          cursor: saving || sectionDone ? "not-allowed" : "pointer"
                        }}
                        title="Restore this field to the value prefilled from the awarded quote."
                      >
                        Reset to source
                      </button>
                    </span>
                  )}
                </label>
                <FieldRenderer
                  field={field}
                  currentValue={displayVal}
                  onChange={(val) => onFieldChange(field.key, val)}
                  disabled={sectionDone || readOnly}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Navigation / save row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid var(--border-default, #e5e7eb)"
        }}
      >
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={isFirst || saving}
          onClick={onPrev}
        >
          Previous
        </button>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={saving}
            onClick={() => {
              void onSave().then(() => { if (!isLast) onNext(); });
            }}
          >
            {isLast ? "Save" : "Save & Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step nav sidebar ─────────────────────────────────────────────────────────

type StepNavProps = {
  sections: HandoverSection[];
  currentStep: number;
  valueMap: Map<string, HandoverValue>;
  onStepClick: (idx: number) => void;
};

function StepNav({ sections, currentStep, valueMap, onStepClick }: StepNavProps) {
  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {sections.map((section, idx) => {
        const active = idx === currentStep;
        // Check if section is done: any value in this section has sectionDone=true
        const sectionFields = section.fields.filter((f) => !f.retiredAt);
        const isDone =
          sectionFields.length > 0 &&
          sectionFields.some((f) => {
            const val = valueMap.get(f.key);
            return val?.sectionDone === true;
          });

        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onStepClick(idx)}
            style={{
              textAlign: "left",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm, 4px)",
              border: "none",
              background: active
                ? "rgba(0,91,97,0.1)"
                : "transparent",
              fontWeight: active ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              color: active ? "#005B61" : "var(--text)",
              borderLeft: active ? "3px solid #005B61" : "3px solid transparent",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 18 }}>
              {idx + 1}.
            </span>
            <span style={{ flex: 1 }}>{section.label}</span>
            {isDone && (
              <span style={{ fontSize: 14, color: "#22C55E" }}>&#10003;</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ─── Variance panel ───────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0
  });
}

function VariancePanel({ variance }: { variance: QuotedVsContractedVariance }) {
  const { quotedTotal, contractedValue, variance: delta, variancePct } = variance;
  const positive = delta >= 0;
  const colour = delta === 0 ? "var(--text-muted)" : positive ? "#005B61" : "#dc2626";

  return (
    <section
      aria-label="Quoted vs contracted variance"
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        border: "1px solid var(--border-default, #e5e7eb)",
        borderRadius: "var(--radius-md, 6px)",
        background: "var(--surface-muted, #F6F6F6)",
        display: "flex",
        gap: 24,
        flexWrap: "wrap",
        alignItems: "center"
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Awarded quote
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600 }}>{fmtMoney(quotedTotal)}</p>
      </div>
      <div>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Contract value
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600 }}>{fmtMoney(contractedValue)}</p>
      </div>
      <div style={{ marginLeft: "auto" }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Variance (derived)
        </p>
        <p style={{ margin: "2px 0 0", fontSize: 15, fontWeight: 600, color: colour }}>
          {positive ? "+" : ""}{fmtMoney(delta)}
          {variancePct !== null && (
            <span style={{ marginLeft: 6, fontSize: 12, fontWeight: 500 }}>
              ({positive ? "+" : ""}{variancePct.toFixed(1)}%)
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

// ─── Re-sync banner ───────────────────────────────────────────────────────────

type ResyncBannerProps = {
  drift: SourceDrift[] | null;
  checking: boolean;
  saving: boolean;
  onCheck: () => void;
  onAccept: () => void;
  onDismiss: () => void;
};

function ResyncBanner({ drift, checking, saving, onCheck, onAccept, onDismiss }: ResyncBannerProps) {
  // No check has been run yet — show the "Check for updates" trigger.
  if (drift === null) {
    return (
      <div
        style={{
          marginBottom: 16,
          padding: "8px 12px",
          fontSize: 12,
          color: "var(--text-muted)",
          border: "1px dashed var(--border-default, #e5e7eb)",
          borderRadius: "var(--radius-sm, 4px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <span>Prefill was one-way from the awarded quote at handover creation.</span>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          disabled={checking || saving}
          onClick={onCheck}
        >
          {checking ? "Checking…" : "Check for quote updates"}
        </button>
      </div>
    );
  }

  if (drift.length === 0) {
    return (
      <div
        role="status"
        style={{
          marginBottom: 16,
          padding: "8px 12px",
          fontSize: 13,
          color: "#065f46",
          background: "#d1fae5",
          borderRadius: "var(--radius-sm, 4px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}
      >
        <span>Awarded quote is unchanged since prefill.</span>
        <button
          type="button"
          onClick={onDismiss}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: "#065f46", fontSize: 12 }}
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div
      role="alert"
      style={{
        marginBottom: 16,
        padding: "10px 14px",
        border: "1px solid #f59e0b",
        background: "#fef3c7",
        color: "#92400e",
        borderRadius: "var(--radius-sm, 4px)"
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13 }}>
            Quote updated — re-sync?
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 12 }}>
            The awarded quote has changed since this handover was prefilled.
            {" "}
            {drift.length} auto-field{drift.length === 1 ? "" : "s"} would be updated:
            {" "}
            <em>{drift.map((d) => d.fieldKey).join(", ")}</em>.
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            disabled={saving}
            onClick={onDismiss}
          >
            Keep current
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary s7-btn--sm"
            disabled={saving}
            onClick={onAccept}
          >
            Re-sync
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function HandoverWizardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { authFetch } = useAuth();

  const [handover, setHandover] = useState<Handover | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [drift, setDrift] = useState<SourceDrift[] | null>(null);
  const [checkingDrift, setCheckingDrift] = useState(false);

  // Local draft: fieldKey → string value (pending save)
  const localDraftRef = useRef<Map<string, string>>(new Map());
  const [localDraftVersion, setLocalDraftVersion] = useState(0); // force re-render

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await hwGet(authFetch, id);
      setHandover(data);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load handover.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const sections =
    handover?.templateVersion?.sections != null
      ? sortedSections(handover.templateVersion.sections)
      : [];

  const valueMap = handover ? buildValueMap(handover.values) : new Map<string, HandoverValue>();

  const allFields: HandoverField[] = sections.flatMap((s) =>
    s.fields.filter((f) => !f.retiredAt)
  );

  const variance: QuotedVsContractedVariance | null = useMemo(() => {
    if (!handover) return null;
    return computeQuotedVsContractedVariance(allFields, handover.values);
  }, [handover, allFields]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFieldChange(fieldKey: string, val: string) {
    localDraftRef.current.set(fieldKey, val);
    setLocalDraftVersion((v) => v + 1);
  }

  async function handleSave() {
    if (!handover) return;
    if (localDraftRef.current.size === 0) return;

    setSaving(true);
    setSaveError(null);

    const items = Array.from(localDraftRef.current.entries()).map(([fieldKey, value]) => ({
      fieldKey,
      value
    }));

    try {
      const updated = await hwPatchValues(authFetch, handover.id, items);
      setHandover(updated);
      localDraftRef.current = new Map();
      setLocalDraftVersion((v) => v + 1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Reset a single auto-field back to its prefilled `sourceValue`. Persists
   * immediately so the "edited" badge clears without waiting for a Save.
   */
  async function handleResetField(fieldKey: string) {
    if (!handover) return;
    const saved = valueMap.get(fieldKey);
    if (!saved) return;
    const patch = resetPatch(saved);
    if (!patch) return;

    setSaving(true);
    setSaveError(null);
    try {
      const updated = await hwPatchValues(authFetch, handover.id, [patch]);
      setHandover(updated);
      localDraftRef.current.delete(fieldKey);
      setLocalDraftVersion((v) => v + 1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to reset field.");
    } finally {
      setSaving(false);
    }
  }

  /**
   * Re-fetch the handover and diff its stored `sourceValue`s against the
   * currently-loaded snapshot. Any drift on quote-sourced auto-fields is the
   * "quote updated — re-sync?" prompt (plan §1.7).
   */
  async function handleCheckForUpdates() {
    if (!handover) return;
    setCheckingDrift(true);
    setSaveError(null);
    try {
      const fresh = await hwGet(authFetch, handover.id);
      const found = detectSourceDrift(handover.values, fresh.values, allFields);
      setDrift(found);
      setHandover(fresh);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to check for source updates.");
    } finally {
      setCheckingDrift(false);
    }
  }

  /**
   * User accepted the re-sync prompt: overwrite the local value for each
   * drifted field with its fresh `sourceValue`. Clears the drift banner.
   */
  async function handleAcceptResync() {
    if (!handover || !drift || drift.length === 0) return;
    const patches = drift
      .map((d) => ({ fieldKey: d.fieldKey, value: d.currentSource }))
      .filter((p) => p.value !== null && p.value !== undefined);
    if (patches.length === 0) {
      setDrift(null);
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await hwPatchValues(authFetch, handover.id, patches);
      setHandover(updated);
      setDrift(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to re-sync source values.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleSectionDone() {
    if (!handover || sections.length === 0) return;
    const section = sections[currentStep];
    if (!section) return;

    const activeFields = section.fields.filter((f) => !f.retiredAt);
    if (activeFields.length === 0) return;

    // Check current sectionDone state from the saved values (not localDraft)
    const currentDone = activeFields.some((f) => {
      const val = valueMap.get(f.key);
      return val?.sectionDone === true;
    });
    const nextDone = !currentDone;

    setSaving(true);
    setSaveError(null);

    // Flush any pending draft changes + set sectionDone on all fields in section
    const localEntries = Array.from(localDraftRef.current.entries()).map(([fieldKey, value]) => ({
      fieldKey,
      value,
      // Only set sectionDone for fields in THIS section
      sectionDone: activeFields.some((f) => f.key === fieldKey) ? nextDone : undefined
    }));

    // Fields in this section that don't have a pending local draft update
    const fieldsNotInDraft = activeFields.filter(
      (f) => !localDraftRef.current.has(f.key)
    );

    const sectionDoneItems = fieldsNotInDraft.map((f) => ({
      fieldKey: f.key,
      value: valueMap.get(f.key)?.value ?? "",
      sectionDone: nextDone
    }));

    const allItems = [...localEntries, ...sectionDoneItems];

    try {
      const updated = await hwPatchValues(authFetch, handover.id, allItems);
      setHandover(updated);
      localDraftRef.current = new Map();
      setLocalDraftVersion((v) => v + 1);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update section status.");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ padding: 32, textAlign: "center", color: "var(--text-muted)" }}>
        Loading handover wizard…
      </div>
    );
  }

  if (loadError || !handover) {
    return (
      <div style={{ padding: 32 }}>
        <p role="alert" style={{ color: "var(--colour-danger, #dc2626)" }}>
          {loadError ?? "Handover not found."}
        </p>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div style={{ padding: 32 }}>
        <p style={{ color: "var(--text-muted)" }}>
          The pinned template has no sections. Please configure the handover template in Settings
          first.
        </p>
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </div>
    );
  }

  const safeStep = Math.max(0, Math.min(currentStep, sections.length - 1));
  const activeSection = sections[safeStep];

  // sectionDone for active section
  const activeFields = activeSection?.fields.filter((f) => !f.retiredAt) ?? [];
  const sectionIsDone =
    activeFields.length > 0 &&
    activeFields.some((f) => valueMap.get(f.key)?.sectionDone === true);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: 12 }}>
        <Link
          to={`/contracts/${handover.contractId}`}
          style={{ fontSize: 12, color: "var(--text-muted)" }}
        >
          ← Back to contract
        </Link>
      </div>

      {/* Page header */}
      <header style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 className="s7-type-page-heading" style={{ margin: 0 }}>
              Handover wizard
            </h1>
            <p style={{ color: "var(--text-muted)", margin: "4px 0 0", fontSize: 13 }}>
              Template v{handover.templateVersion.version} &middot; Status:{" "}
              <strong style={{ textTransform: "capitalize" }}>{handover.status}</strong>
            </p>
          </div>
          {/* Overall completion bar */}
          <div style={{ minWidth: 200 }}>
            <p style={{ margin: "0 0 4px", fontSize: 11, color: "var(--text-muted)" }}>
              Overall completion
            </p>
            <CompletionBar pct={handover.completionPct} />
          </div>
        </div>
      </header>

      {saveError && (
        <p role="alert" style={{ color: "var(--colour-danger, #dc2626)", fontSize: 13, marginBottom: 12 }}>
          {saveError}
        </p>
      )}

      {/* Derived variance panel (read-only): awarded quote vs contract value. */}
      {variance && <VariancePanel variance={variance} />}

      {/* Pre-finalise re-sync prompt. Shown after a "Check for updates" that
          found drift on quote-sourced auto-fields. */}
      {handover.status === "draft" && (
        <ResyncBanner
          drift={drift}
          checking={checkingDrift}
          saving={saving}
          onCheck={() => void handleCheckForUpdates()}
          onAccept={() => void handleAcceptResync()}
          onDismiss={() => setDrift(null)}
        />
      )}

      {/* Layout: sidebar + main */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Left nav */}
        <aside
          style={{
            width: 220,
            flexShrink: 0,
            border: "1px solid var(--border-default, #e5e7eb)",
            borderRadius: "var(--radius-md, 6px)",
            padding: 12,
            background: "var(--surface-base, #fff)"
          }}
        >
          <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sections
          </p>
          <StepNav
            sections={sections}
            currentStep={safeStep}
            valueMap={valueMap}
            onStepClick={(idx) => setCurrentStep(idx)}
          />
        </aside>

        {/* Main wizard content */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            border: "1px solid var(--border-default, #e5e7eb)",
            borderRadius: "var(--radius-md, 6px)",
            padding: "var(--space-6, 24px)",
            background: "var(--surface-base, #fff)"
          }}
        >
          {activeSection ? (
            <SectionStep
              key={activeSection.id}
              section={activeSection}
              stepIndex={safeStep}
              totalSteps={sections.length}
              valueMap={valueMap}
              localDraft={localDraftRef.current}
              sectionDone={sectionIsDone}
              saving={saving}
              onFieldChange={handleFieldChange}
              onResetField={handleResetField}
              onSave={handleSave}
              onToggleSectionDone={handleToggleSectionDone}
              onNext={() => setCurrentStep((s) => Math.min(s + 1, sections.length - 1))}
              onPrev={() => setCurrentStep((s) => Math.max(s - 1, 0))}
            />
          ) : null}
        </main>
      </div>

      {/* Hidden render version tracker (forces re-render when localDraft changes) */}
      <span aria-hidden style={{ display: "none" }}>{localDraftVersion}</span>
    </div>
  );
}
