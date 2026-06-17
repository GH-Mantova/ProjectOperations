import { useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";
import { CenteredModal } from "@project-ops/ui";
import { useAuth } from "../auth/AuthContext";

const ICON_FEEDBACK = (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
);

type Category = "bug" | "idea" | "question" | "other";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "bug", label: "Bug" },
  { value: "idea", label: "Idea" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" }
];

export function FeedbackButton() {
  const { authFetch } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category>("idea");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reset = () => {
    setCategory("idea");
    setMessage("");
    setError(null);
    setBusy(false);
  };

  const close = () => {
    if (busy) return;
    setOpen(false);
    reset();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setError("Tell us what's on your mind.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await authFetch("/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          route: location.pathname + location.search,
          category,
          message: message.trim()
        })
      });
      if (!res.ok) {
        setError("Couldn't send feedback. Please try again.");
        setBusy(false);
        return;
      }
      setOpen(false);
      reset();
      setToast("Thanks! Feedback sent.");
      setTimeout(() => setToast(null), 2500);
    } catch {
      setError("Couldn't send feedback. Please try again.");
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="shell__topbar-action"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        title="Send feedback"
        style={{ minWidth: 44, minHeight: 44 }}
      >
        {ICON_FEEDBACK}
      </button>
      {open ? (
        <CenteredModal
          title="Send feedback"
          subtitle="Tell Marco what's working, what's broken, or what you'd like to see."
          onClose={close}
          busy={busy}
          maxWidth={460}
          dataTestId="feedback-modal"
          footer={
            <>
              <button
                type="button"
                onClick={close}
                disabled={busy}
                style={{ minHeight: 44, padding: "0 16px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                form="feedback-form"
                disabled={busy}
                style={{
                  minHeight: 44,
                  padding: "0 16px",
                  background: "var(--brand-primary, #2563eb)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "var(--radius-md, 8px)",
                  fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer"
                }}
              >
                {busy ? "Sending..." : "Send"}
              </button>
            </>
          }
        >
          <form id="feedback-form" onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                disabled={busy}
                style={{ minHeight: 44, padding: "0 12px", borderRadius: "var(--radius-md, 8px)" }}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>Message</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={busy}
                rows={5}
                placeholder="What happened, what you'd like, or a question..."
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-md, 8px)",
                  resize: "vertical",
                  fontFamily: "inherit",
                  fontSize: 14
                }}
                autoFocus
              />
            </label>
            {error ? (
              <p
                role="alert"
                style={{
                  margin: 0,
                  color: "var(--status-danger, #dc2626)",
                  fontSize: 13
                }}
              >
                {error}
              </p>
            ) : null}
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary, #6B7280)" }}>
              Submitted from <code>{location.pathname + location.search}</code>
            </p>
          </form>
        </CenteredModal>
      ) : null}
      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--surface-card, #1f2937)",
            color: "#fff",
            padding: "12px 16px",
            borderRadius: "var(--radius-md, 8px)",
            boxShadow: "var(--shadow-dropdown, 0 4px 16px rgba(0,0,0,0.20))",
            zIndex: 1100,
            fontSize: 14
          }}
        >
          {toast}
        </div>
      ) : null}
    </>
  );
}
