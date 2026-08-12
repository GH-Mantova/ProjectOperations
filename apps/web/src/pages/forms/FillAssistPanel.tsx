import { useState, useCallback } from "react";
import { useAuth } from "../../auth/AuthContext";

// ── Types (mirror apps/api/src/modules/forms/ai-form-fill-assist.service.ts) ─

type ControlSuggestion = {
  hazard: string;
  control: string;
};

type NotifiableIncidentFlag = {
  isNotifiable: boolean;
  basis: string;
};

type FillAssistSuggestion = {
  controlSuggestions: ControlSuggestion[];
  notifiableIncidentFlag: NotifiableIncidentFlag;
  summary: string;
  provider: string;
};

// ── Gate signal ───────────────────────────────────────────────────────────────

/**
 * Categories that carry hazard/incident content — the panel is shown when the
 * template falls into one of these. Uses the `category` field already on the
 * FormTemplate model; no new schema flag is introduced.
 *
 * "safety" — pre-start checks, SWMS, JSA, incident reports.
 * "environmental" — spill/dust/noise/waste incident forms.
 * "plant" — plant pre-start (can carry hazard fields).
 */
const HAZARD_CATEGORIES = new Set(["safety", "environmental", "plant"]);

/**
 * Field-key substrings that indicate hazard or incident content. Used as a
 * secondary gate when `category` alone is not sufficient.
 */
const HAZARD_FIELD_KEY_SIGNALS = [
  "hazard",
  "incident",
  "near_miss",
  "nearmiss",
  "risk",
  "swms",
  "jsa",
  "ppe",
  "control"
];

/**
 * Returns true when the template/fields signal hazard or incident content and
 * the FillAssistPanel should be rendered. Gates on `category` (preferred) or
 * field-key substrings — no new schema flag is introduced.
 *
 * @param category - template category from `submission.templateVersion.template.category`
 * @param fieldKeys - all fieldKey values across all sections of the template
 */
export function shouldShowFillAssist(
  category: string | null | undefined,
  fieldKeys: string[]
): boolean {
  if (category && HAZARD_CATEGORIES.has(category)) return true;
  return fieldKeys.some((key) =>
    HAZARD_FIELD_KEY_SIGNALS.some((signal) => key.toLowerCase().includes(signal))
  );
}

// ── Panel component ───────────────────────────────────────────────────────────

type FillAssistPanelProps = {
  submissionId: string;
  /**
   * The filler's current form values as `{ fieldLabel: value }`. The panel
   * filters to non-empty values before sending to the API. Only send values
   * that are relevant to hazard/incident analysis (filtered by the parent).
   */
  answers: Record<string, unknown>;
  /** Whether any answers are available to analyse. Controls the CTA button. */
  hasAnswers: boolean;
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; suggestion: FillAssistSuggestion };

/**
 * FillAssistPanel — fill-time AI assist side panel (AI order 3, LOCKED
 * suggest-never-decide, sot/06-active-specs.md §6).
 *
 * Shows hazard control suggestions and a notifiable-incident flag based on
 * the filler's current in-progress answers. All items are labelled "AI
 * suggestion" and require explicit accept/dismiss. Nothing auto-applies.
 *
 * Guardrails:
 *  - AI cannot trigger a BLOCK, WARN, push action, or approval-chain change.
 *  - AI cannot write to the submission.
 *  - Every item is clearly labelled as AI-generated.
 *  - Filler/supervisor must explicitly accept or dismiss each suggestion.
 */
export function FillAssistPanel({ submissionId, answers, hasAnswers }: FillAssistPanelProps) {
  const { authFetch } = useAuth();
  const [state, setState] = useState<PanelState>({ status: "idle" });
  // Track which suggestion indices have been accepted or dismissed.
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  const requestSuggestions = useCallback(async () => {
    // Filter to non-empty answers for the API call.
    const filtered: Record<string, unknown> = {};
    for (const [label, value] of Object.entries(answers)) {
      if (value !== null && value !== undefined && value !== "") {
        filtered[label] = value;
      }
    }
    if (Object.keys(filtered).length === 0) {
      setState({ status: "error", message: "Fill in some hazard or incident fields first." });
      return;
    }

    setState({ status: "loading" });
    setAccepted(new Set());
    setDismissed(new Set());

    try {
      const res = await authFetch(`/forms/submissions/${submissionId}/fill-assist`, {
        method: "POST",
        body: JSON.stringify({ answers: filtered })
      });
      if (!res.ok) {
        const text = await res.text();
        setState({ status: "error", message: text || "AI assistant unavailable." });
        return;
      }
      const suggestion = (await res.json()) as FillAssistSuggestion;
      setState({ status: "done", suggestion });
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : "AI assistant unavailable."
      });
    }
  }, [authFetch, submissionId, answers]);

  const acceptSuggestion = (index: number) => {
    setAccepted((prev) => new Set([...prev, index]));
  };

  const dismissSuggestion = (index: number) => {
    setDismissed((prev) => new Set([...prev, index]));
  };

  const resetPanel = () => {
    setState({ status: "idle" });
    setAccepted(new Set());
    setDismissed(new Set());
  };

  return (
    <aside
      data-testid="fill-assist-panel"
      aria-label="AI fill-time assist suggestions"
      style={{
        border: "1px solid var(--border-subtle, rgba(0,0,0,0.1))",
        borderRadius: 8,
        padding: 14,
        background: "var(--surface-muted, #F6F6F6)",
        fontSize: 13,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            background: "#005B61",
            color: "#fff",
            borderRadius: 4,
            padding: "2px 6px",
            textTransform: "uppercase",
            flexShrink: 0
          }}
        >
          AI suggestion
        </span>
        <span style={{ fontWeight: 600, color: "#005B61", fontSize: 13 }}>
          Safety Assist
        </span>
      </div>

      <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
        Based on your answers so far, the AI can suggest hazard controls and check
        whether a notifiable incident flag applies. You decide — nothing here
        auto-applies or blocks your submission.
      </p>

      {/* Idle / CTA */}
      {state.status === "idle" && (
        <button
          type="button"
          className="s7-btn s7-btn--ghost s7-btn--sm"
          style={{ alignSelf: "flex-start" }}
          onClick={() => void requestSuggestions()}
          disabled={!hasAnswers}
          title={hasAnswers ? undefined : "Fill in some fields first"}
          data-testid="fill-assist-request-btn"
        >
          Get safety suggestions
        </button>
      )}

      {/* Loading */}
      {state.status === "loading" && (
        <p style={{ margin: 0, color: "var(--text-muted)", fontStyle: "italic", fontSize: 12 }}>
          Analysing your answers…
        </p>
      )}

      {/* Error */}
      {state.status === "error" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <p
            style={{ margin: 0, color: "var(--status-danger, #DC2626)", fontSize: 12 }}
            data-testid="fill-assist-error"
          >
            {state.message}
          </p>
          <button
            type="button"
            className="s7-btn s7-btn--ghost s7-btn--sm"
            style={{ alignSelf: "flex-start" }}
            onClick={resetPanel}
          >
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {state.status === "done" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Summary */}
          {state.suggestion.summary ? (
            <p
              style={{
                margin: 0,
                fontStyle: "italic",
                color: "#444",
                fontSize: 12,
                borderLeft: "3px solid #FEAA6D",
                paddingLeft: 8
              }}
              data-testid="fill-assist-summary"
            >
              {state.suggestion.summary}
            </p>
          ) : null}

          {/* Notifiable incident flag */}
          {state.suggestion.notifiableIncidentFlag.isNotifiable && (
            <div
              role="alert"
              data-testid="fill-assist-notifiable-flag"
              style={{
                background: "rgba(220, 38, 38, 0.08)",
                border: "1px solid rgba(220, 38, 38, 0.3)",
                borderRadius: 6,
                padding: "8px 10px"
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  color: "#DC2626",
                  fontSize: 12,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <span aria-hidden="true">!</span>
                <span>Possible notifiable incident (AI suggestion)</span>
              </div>
              {state.suggestion.notifiableIncidentFlag.basis ? (
                <p style={{ margin: 0, fontSize: 11, color: "#7F1D1D", lineHeight: 1.5 }}>
                  {state.suggestion.notifiableIncidentFlag.basis}
                </p>
              ) : null}
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 11,
                  color: "var(--text-muted)",
                  fontStyle: "italic"
                }}
              >
                This is an AI suggestion only. Your supervisor must review and
                determine if notification is required.
              </p>
            </div>
          )}

          {/* Control suggestions */}
          {state.suggestion.controlSuggestions.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p
                style={{
                  margin: 0,
                  fontWeight: 600,
                  fontSize: 12,
                  color: "#005B61"
                }}
              >
                Suggested controls
              </p>
              {state.suggestion.controlSuggestions.map((suggestion, index) => {
                const isAccepted = accepted.has(index);
                const isDismissed = dismissed.has(index);
                if (isDismissed) return null;
                return (
                  <div
                    key={index}
                    data-testid={`fill-assist-suggestion-${index}`}
                    style={{
                      background: isAccepted
                        ? "rgba(0, 91, 97, 0.06)"
                        : "var(--surface-app, #fff)",
                      border: isAccepted
                        ? "1px solid rgba(0, 91, 97, 0.25)"
                        : "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
                      borderRadius: 6,
                      padding: "8px 10px"
                    }}
                  >
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                      Hazard: <strong style={{ color: "#444" }}>{suggestion.hazard}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: "#333", marginBottom: 6 }}>
                      {suggestion.control}
                    </div>
                    {isAccepted ? (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#005B61",
                          fontStyle: "italic"
                        }}
                      >
                        Noted
                      </div>
                    ) : (
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          style={{ fontSize: 11, padding: "2px 8px" }}
                          onClick={() => acceptSuggestion(index)}
                          data-testid={`fill-assist-accept-${index}`}
                          aria-label={`Note suggestion: ${suggestion.hazard}`}
                        >
                          Note this
                        </button>
                        <button
                          type="button"
                          className="s7-btn s7-btn--ghost s7-btn--sm"
                          style={{ fontSize: 11, padding: "2px 8px", color: "var(--text-muted)" }}
                          onClick={() => dismissSuggestion(index)}
                          data-testid={`fill-assist-dismiss-${index}`}
                          aria-label={`Dismiss suggestion: ${suggestion.hazard}`}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
              No specific control suggestions for the current answers.
            </p>
          )}

          {/* AI disclaimer + refresh */}
          <div
            style={{
              borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))",
              paddingTop: 8,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 10,
                color: "var(--text-muted)",
                fontStyle: "italic",
                lineHeight: 1.4
              }}
            >
              AI suggestions are advisory only and do not affect submission
              outcome. Generated by {state.suggestion.provider}.
            </p>
            <button
              type="button"
              className="s7-btn s7-btn--ghost s7-btn--sm"
              style={{ fontSize: 11, flexShrink: 0 }}
              onClick={() => void requestSuggestions()}
              data-testid="fill-assist-refresh-btn"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
