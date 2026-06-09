import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent
} from "react";
import { CenteredModal } from "@project-ops/ui";

// PR B1.7 — reusable notes input with an inline 4-row textarea + an
// "expand to modal" button (bottom-right) for longer entry. Used by
// item-level notes, the shared Cutting subtable notes, and the shared
// Waste subtable notes. The modal supports Escape to cancel, backdrop
// click to cancel, and returns focus to the inline textarea on close.

type Props = {
  value: string | null;
  onSave: (value: string | null) => void | Promise<void>;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Inline textarea rows (default 4 per the B1.7 design spec). */
  rows?: number;
  /** Inline textarea min-height in px (default 96, matches 4 rows visually). */
  minHeight?: number;
  /** Optional wrapper style. */
  style?: CSSProperties;
};

const SAVE_DEBOUNCE_MS = 300;

export function NotesField({
  value,
  onSave,
  label,
  placeholder = "Notes…",
  disabled,
  rows = 4,
  minHeight = 96,
  style
}: Props) {
  const [draft, setDraft] = useState(value ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDraft, setModalDraft] = useState(value ?? "");
  const inlineRef = useRef<HTMLTextAreaElement | null>(null);
  const modalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const labelId = useId();

  // Sync the local draft when the parent value changes (e.g. after a
  // server reload). Don't clobber the user's in-flight typing.
  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const commit = useCallback(
    (next: string) => {
      const cleaned = next.length === 0 ? null : next;
      const current = value ?? null;
      if (cleaned === current) return;
      void onSave(cleaned);
    },
    [onSave, value]
  );

  // Debounced auto-save on blur of the inline textarea. Typing is local
  // until blur fires, then we save once.
  const handleInlineChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
  };
  const handleInlineBlur = () => {
    const next = draft;
    // Tiny debounce so a focus jump within the same row doesn't fire
    // back-to-back saves.
    const timer = window.setTimeout(() => commit(next), SAVE_DEBOUNCE_MS);
    inlineRef.current?.addEventListener(
      "focus",
      () => window.clearTimeout(timer),
      { once: true }
    );
  };

  const openModal = () => {
    setModalDraft(draft);
    setModalOpen(true);
  };

  const closeModal = (save: boolean) => {
    if (save) {
      setDraft(modalDraft);
      commit(modalDraft);
    }
    setModalOpen(false);
    // Return focus to the inline textarea once the modal unmounts.
    window.setTimeout(() => inlineRef.current?.focus(), 0);
  };

  // Focus the modal textarea on open. Escape is handled by CenteredModal.
  useEffect(() => {
    if (!modalOpen) return;
    window.setTimeout(() => modalTextareaRef.current?.focus(), 0);
  }, [modalOpen]);

  const handleModalKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl+Enter saves and closes for keyboard-first users.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      closeModal(true);
    }
  };

  return (
    <div style={{ position: "relative", ...style }}>
      {label ? (
        <label id={labelId} htmlFor={`${labelId}-ta`} className="s7-type-label" style={{ display: "block", marginBottom: 4 }}>
          {label}
        </label>
      ) : null}
      <textarea
        id={`${labelId}-ta`}
        ref={inlineRef}
        className="s7-textarea"
        rows={rows}
        placeholder={placeholder}
        value={draft}
        onChange={handleInlineChange}
        onBlur={handleInlineBlur}
        disabled={disabled}
        style={{
          width: "100%",
          minHeight,
          paddingRight: 40
        }}
      />
      <button
        type="button"
        aria-label="Expand notes"
        title="Expand notes"
        onClick={openModal}
        disabled={disabled}
        style={{
          position: "absolute",
          right: 8,
          bottom: 8,
          width: 28,
          height: 28,
          background: "var(--surface-card, #fff)",
          border: "1px solid var(--border-default, #e5e7eb)",
          borderRadius: 6,
          cursor: disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          color: "var(--text-muted, #6b7280)",
          fontSize: 14,
          lineHeight: 1
        }}
      >
        {/* tabler ti-arrows-diagonal — inline SVG keeps zero deps */}
        <svg
          aria-hidden
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M16 4l4 0l0 4" />
          <path d="M14 10l6 -6" />
          <path d="M8 20l-4 0l0 -4" />
          <path d="M4 20l6 -6" />
        </svg>
      </button>

      {modalOpen ? (
        <CenteredModal
          title={label ?? "Notes"}
          subtitle="⌘/Ctrl + Enter to save · Esc to cancel"
          onClose={() => closeModal(false)}
          maxWidth={720}
          footer={
            <>
              <button
                type="button"
                className="s7-btn s7-btn--ghost"
                onClick={() => closeModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="s7-btn s7-btn--primary"
                onClick={() => closeModal(true)}
              >
                Save
              </button>
            </>
          }
        >
          <textarea
            ref={modalTextareaRef}
            className="s7-textarea"
            rows={16}
            value={modalDraft}
            onChange={(e) => setModalDraft(e.target.value)}
            onKeyDown={handleModalKey}
            style={{ width: "100%", minHeight: 320 }}
            placeholder={placeholder}
          />
        </CenteredModal>
      ) : null}
    </div>
  );
}
