import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { can } from "../auth/permissions";

// Universal in-context AI assist ("Copilot everywhere"). A slide-over
// with three one-shot actions — Summarise / Draft / Explain — that
// serialise the record's visible context to the /assist endpoint and
// display the completion. Fully reusable across modules: consumers pass
// the record context via `getContext`, an optional `surface` label, and
// control open state.
//
// Design constraints (from the originating prompt):
//   - Reuse the existing AI provider store (BYOK). The /assist endpoint
//     resolves the caller's provider server-side; no keys touch the
//     browser here.
//   - Do NOT auto-apply output. The user copies or inserts manually.
//   - Do NOT add a new AI stack. This is a thin surface on top of the
//     existing ai-providers module.

export type AssistTask = "summarise" | "draft" | "explain";

const TASK_OPTIONS: Array<{ id: AssistTask; label: string; description: string }> = [
  {
    id: "summarise",
    label: "Summarise this record",
    description: "3–6 sentences covering what matters at a glance."
  },
  {
    id: "draft",
    label: "Draft an email / note",
    description: "Short internal note about the record, up to 150 words."
  },
  {
    id: "explain",
    label: "Explain this",
    description: "Plain-language walkthrough for someone unfamiliar with the record."
  }
];

// Same permission the Tendering Assistant uses — the /assist endpoint
// guards on `ai.persona.tendering` server-side. Hiding the trigger
// button when the user lacks it avoids a dead affordance.
export const ASSIST_PERMISSION = "ai.persona.tendering";

export type AssistPanelProps = {
  open: boolean;
  onClose: () => void;
  /** Serialises the record's visible state at click-time. Keep it text-only. */
  getContext: () => string;
  /** Cosmetic label ("tender", "job") shown in the header and sent to the model. */
  surface: string;
  /** Optional heading shown under the "AI assist" title. */
  subject?: string;
};

type Status = "idle" | "loading" | "done" | "error";

export function AssistPanel({ open, onClose, getContext, surface, subject }: AssistPanelProps) {
  const { authFetch } = useAuth();
  const [task, setTask] = useState<AssistTask | null>(null);
  const [instruction, setInstruction] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Reset when the panel closes so a fresh open never surfaces stale
  // output from a different record.
  useEffect(() => {
    if (open) return;
    setTask(null);
    setInstruction("");
    setStatus("idle");
    setResult("");
    setError(null);
    setCopied(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const run = useCallback(
    async (selected: AssistTask) => {
      const context = getContext().trim();
      if (!context) {
        setStatus("error");
        setError("Nothing to send — this record has no visible context yet.");
        return;
      }
      setTask(selected);
      setStatus("loading");
      setError(null);
      setResult("");
      setCopied(false);
      const controller = new AbortController();
      abortRef.current?.abort();
      abortRef.current = controller;
      try {
        const res = await authFetch("/assist", {
          method: "POST",
          body: JSON.stringify({
            task: selected,
            context,
            instruction: instruction.trim() || undefined,
            surface
          }),
          signal: controller.signal
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed (${res.status})`);
        }
        const data = (await res.json()) as { text?: string };
        setResult(data.text ?? "");
        setStatus("done");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Assist failed");
        setStatus("error");
      }
    },
    [authFetch, getContext, instruction, surface]
  );

  const copy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }, [result]);

  if (!open) return null;

  return (
    <div
      className="slide-over-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="AI assist"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside className="slide-over" style={{ width: "min(460px, 100%)" }}>
        <header className="slide-over__header">
          <div style={{ minWidth: 0 }}>
            <h2 className="s7-type-section-heading" style={{ margin: 0 }}>
              AI assist
            </h2>
            <p className="slide-over__subtitle">
              {subject ? `${subject} · ${surface}` : `In-context helper · ${surface}`}
            </p>
          </div>
          <button
            type="button"
            className="slide-over__close"
            aria-label="Close AI assist"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="slide-over__body">
          <p className="s7-type-body" style={{ marginTop: 0, color: "var(--text-secondary)" }}>
            Pick an action. The record's visible data is sent to your configured AI provider —
            the reply appears here for you to copy or edit before use.
          </p>

          <ul className="slide-over__list" style={{ marginTop: 12 }}>
            {TASK_OPTIONS.map((option) => {
              const isActive = task === option.id;
              const isLoading = isActive && status === "loading";
              return (
                <li key={option.id} className="slide-over__row">
                  <div className="slide-over__row-meta">
                    <span className="slide-over__row-title">{option.label}</span>
                    <span className="slide-over__row-subtitle">{option.description}</span>
                  </div>
                  <button
                    type="button"
                    className="s7-btn s7-btn--secondary s7-btn--sm"
                    disabled={status === "loading"}
                    onClick={() => void run(option.id)}
                  >
                    {isLoading ? "Working…" : "Run"}
                  </button>
                </li>
              );
            })}
          </ul>

          <label
            className="s7-type-label"
            style={{ display: "block", marginTop: 20, marginBottom: 6 }}
          >
            Optional instruction
          </label>
          <textarea
            className="s7-input"
            rows={2}
            placeholder="e.g. in bullet points; keep under 100 words"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            style={{ width: "100%", resize: "vertical" }}
          />

          {error ? (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: "10px 12px",
                border: "1px solid var(--status-error, #b42318)",
                background: "color-mix(in srgb, var(--status-error, #b42318) 8%, transparent)",
                color: "var(--status-error, #b42318)",
                borderRadius: 8,
                fontSize: 13
              }}
            >
              {error}
            </div>
          ) : null}

          {status === "loading" && result === "" ? (
            <p
              className="s7-type-body"
              style={{ marginTop: 20, color: "var(--text-secondary)" }}
              aria-live="polite"
            >
              Contacting your AI provider…
            </p>
          ) : null}

          {result ? (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6
                }}
              >
                <span className="s7-type-label">Result</span>
                <button
                  type="button"
                  className="s7-btn s7-btn--secondary s7-btn--sm"
                  onClick={() => void copy()}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <textarea
                className="s7-input"
                readOnly
                value={result}
                rows={12}
                style={{
                  width: "100%",
                  resize: "vertical",
                  fontFamily: "inherit",
                  whiteSpace: "pre-wrap"
                }}
                aria-label="AI assist result"
              />
            </div>
          ) : null}
        </div>

        <footer className="slide-over__footer">
          <button type="button" className="s7-btn s7-btn--secondary" onClick={onClose}>
            Close
          </button>
        </footer>
      </aside>
    </div>
  );
}

// Convenience: hides the trigger for users without AI access. Consumers
// import this to gate their "AI assist" button so the affordance never
// renders for someone who'd get a 403 on click.
export function useCanUseAssist(): boolean {
  const { user } = useAuth();
  return can(user, ASSIST_PERMISSION);
}
