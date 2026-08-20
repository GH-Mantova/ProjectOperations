import { useState } from "react";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../../auth/AuthContext";

type Props = {
  onClose: () => void;
  /** Called with the id of the newly-created DRAFT template so the caller can navigate to the designer. */
  onCreated: (templateId: string) => void;
};

/**
 * "Describe a form" modal on the Forms list -- the AI order 2 describe-to-generate entry point.
 *
 * Posts a JSON body to `POST /forms/templates/build-from-description`. The API
 * interprets the plain-language description via the forms AI persona and
 * creates a DRAFT `FormTemplate`, returning the new template id. The caller
 * then routes to the designer for review and publish -- nothing is published
 * automatically. Mirrors `ImportFromPdfModal`'s call/navigate pattern.
 *
 * Guardrail (LOCKED, sot/06-active-specs.md section 6, AI order 2):
 * The draft is never published automatically. The designer is where the human
 * reviews and publishes.
 */
export function DescribeToGenerateModal({ onClose, onCreated }: Props) {
  const { authFetch } = useAuth();
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const MAX_CHARS = 2000;
  const MIN_CHARS = 5;

  const submit = async () => {
    const trimmed = description.trim();
    if (trimmed.length < MIN_CHARS) {
      setError("Add a brief description of the form you want to generate.");
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError(`Keep the description under ${MAX_CHARS} characters.`);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/forms/templates/build-from-description", {
        method: "POST",
        body: JSON.stringify({ description: trimmed })
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Generation failed (${res.status})`);
      }
      const created = (await res.json()) as { id: string };
      onCreated(created.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remaining = MAX_CHARS - description.length;
  const charColour = remaining < 100 ? "#B45309" : remaining < 0 ? "#DC2626" : "var(--text-muted, #9CA3AF)";

  return (
    <CenteredModal
      title="Describe a form"
      onClose={busy ? () => undefined : onClose}
      maxWidth={520}
      footer={
        <>
          <button
            type="button"
            className="s7-btn s7-btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="s7-btn s7-btn--primary"
            style={{ background: "#FEAA6D", color: "#242424", borderColor: "#FEAA6D" }}
            onClick={() => void submit()}
            disabled={busy || description.trim().length < MIN_CHARS}
          >
            {busy ? "Building draft..." : "Generate draft"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, color: "var(--text-muted, #6B7280)" }}>
          Describe the form you need in plain words and the AI will draft a template you can
          review before publishing. Uses your configured AI provider (BYOK). The draft never
          publishes automatically.
        </p>

        <div>
          <label
            htmlFor="describe-form-input"
            style={{ display: "block", fontWeight: 500, marginBottom: 6 }}
          >
            Form description
          </label>
          <textarea
            id="describe-form-input"
            className="s7-textarea"
            rows={5}
            placeholder={
              "e.g. A working-at-heights permit with hazard identification, risk controls, and 2-stage supervisor sign-off."
            }
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setError(null);
            }}
            disabled={busy}
            style={{ width: "100%", resize: "vertical" }}
            maxLength={MAX_CHARS + 50}
          />
          <div
            style={{
              textAlign: "right",
              fontSize: 11,
              color: charColour,
              marginTop: 4
            }}
          >
            {remaining < 0
              ? `${Math.abs(remaining)} characters over the limit`
              : `${remaining} characters remaining`}
          </div>
        </div>

        {error ? (
          <div
            role="alert"
            style={{
              padding: 10,
              background: "#FEE2E2",
              color: "#991B1B",
              borderRadius: 6,
              fontSize: 12
            }}
          >
            {error}
          </div>
        ) : null}

        <p style={{ margin: 0, fontSize: 11, color: "var(--text-muted, #9CA3AF)" }}>
          Tip: mention key sections, required sign-offs, and any compliance context (e.g. WHS,
          asbestos, heights) for better results.
        </p>
      </div>
    </CenteredModal>
  );
}
