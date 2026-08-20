import { useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import type { FieldRule } from "@project-ops/config/forms-rule-definition";

/**
 * A minimal field descriptor for the AI rule-drafting bar.
 * Mirrors RuleDraftFieldDto on the API side.
 */
export type RuleBarField = {
  fieldKey: string;
  label: string;
  fieldType: string;
};

type Props = {
  /** Fields from the current template version -- the AI will only reference these keys. */
  fields: RuleBarField[];
  /**
   * Called with the drafted FieldRule tree when the AI returns a result.
   * The caller is responsible for loading this into its rule-builder UI state
   * for the human to review, edit, and explicitly save. This component never
   * calls any save or publish action.
   */
  onDraftReady: (draft: FieldRule) => void;
};

/**
 * `RuleAiDraftBar` -- AI suggestion input in the rules builder.
 *
 * Posts a plain-language rule description to
 * `POST /forms/templates/draft-rule` and hands the returned FieldRule draft
 * to `onDraftReady` for the human to review / edit / save in the existing
 * builder UI. This component NEVER calls a save or enable action itself.
 *
 * Guardrail (LOCKED, sot/06-active-specs.md section 6, AI order 2 rules half):
 *   All output is labelled "AI suggestion" and requires explicit accept by the
 *   rules author. The bar has no access to FormsService or any save endpoint.
 */
export function RuleAiDraftBar({ fields, onDraftReady }: Props) {
  const { authFetch } = useAuth();
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MAX_CHARS = 1000;
  const MIN_CHARS = 5;

  const draft = async () => {
    const trimmed = description.trim();
    if (trimmed.length < MIN_CHARS) {
      setError("Describe the rule you want to draft.");
      return;
    }
    if (fields.length === 0) {
      setError("No fields available. Add fields to the form before drafting a rule.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/forms/templates/draft-rule", {
        method: "POST",
        body: JSON.stringify({
          ruleDescription: trimmed,
          fields: fields.map((f) => ({
            fieldKey: f.fieldKey,
            label: f.label,
            fieldType: f.fieldType
          }))
        })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Draft failed (${res.status})`);
      }
      const ruleDraft = (await res.json()) as FieldRule;
      onDraftReady(ruleDraft);
      setDescription("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX_CHARS - description.length;

  return (
    <div
      style={{
        padding: "10px 12px",
        background: "var(--surface-muted, #F6F6F6)",
        borderRadius: 8,
        border: "1px solid var(--border-subtle, rgba(0,0,0,0.1))",
        marginBottom: 16
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 8
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            padding: "2px 8px",
            borderRadius: 999,
            background: "#FEAA6D",
            color: "#242424"
          }}
        >
          AI suggestion
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-default, #242424)"
          }}
        >
          Describe a rule in plain words
        </span>
        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted, #6B7280)",
            flex: 1
          }}
        >
          -- the AI will draft a condition/action tree for you to review and save
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <textarea
            className="s7-textarea"
            rows={2}
            placeholder={
              'e.g. "When hazard severity is Critical, require a supervisor signature and warn before submit"'
            }
            value={description}
            onChange={(e) => {
              setDescription(e.target.value.slice(0, MAX_CHARS + 20));
              setError(null);
            }}
            disabled={busy}
            style={{ width: "100%", fontSize: 12, resize: "vertical" }}
          />
          {remaining < 150 ? (
            <div
              style={{
                fontSize: 11,
                color: remaining < 0 ? "#DC2626" : "#B45309",
                textAlign: "right",
                marginTop: 2
              }}
            >
              {remaining < 0 ? `${Math.abs(remaining)} over limit` : `${remaining} left`}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="s7-btn s7-btn--secondary s7-btn--sm"
          style={{ whiteSpace: "nowrap", marginTop: 2 }}
          onClick={() => void draft()}
          disabled={busy || description.trim().length < MIN_CHARS || fields.length === 0}
          title="Generate a drafted rule from the description (AI suggestion -- you must review and save)"
        >
          {busy ? "Drafting..." : "Draft rule"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          style={{
            marginTop: 8,
            padding: "6px 10px",
            background: "#FEE2E2",
            color: "#991B1B",
            borderRadius: 4,
            fontSize: 12
          }}
        >
          {error}
        </div>
      ) : null}

      <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-muted, #9CA3AF)" }}>
        The drafted rule will appear in the editor above for you to review, edit, and save.
        Nothing is saved until you click Save rules.
      </p>
    </div>
  );
}
