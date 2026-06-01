import { useEffect, type ReactNode } from "react";

export interface CenteredModalProps {
  /** Dialog heading (required). */
  title: string;

  /** Optional second-line subtitle/description. */
  subtitle?: string;

  /** Footer slot — typically Cancel + Primary buttons. Right-aligned, 8px gap. */
  footer?: ReactNode;

  /** Called when the user clicks the backdrop or presses Esc. */
  onClose: () => void;

  /** When true, click-outside and Esc are ignored. Used during in-flight saves. */
  busy?: boolean;

  /** Max width of the card in pixels. Default 420. */
  maxWidth?: number;

  /** Optional data-testid forwarded to the backdrop element. */
  dataTestId?: string;

  /** Optional className appended to the inner card for one-off layout tweaks. */
  cardClassName?: string;

  /** Body content (between subtitle and footer). */
  children: ReactNode;
}

const TITLE_ID = "centered-modal-title";

/**
 * Canonical centered modal for ProjectOperations.
 *
 * Use this for any pop-up that asks the user to make a discrete decision —
 * confirm a delete, pick a discipline, fill a small form, etc. The visual
 * pattern matches the "+ add card" Discipline picker that lives in
 * apps/web/src/pages/tendering/scope-cards/NewCardModal.tsx (the agreed
 * reference design as of 2026-06-01).
 *
 * Not for: full-page editors (use a route), inline popovers anchored to a
 * trigger (use a popover lib), or persistent side panels (use a slide-over).
 *
 * Accessibility:
 * - role="dialog" + aria-modal="true"
 * - Esc to dismiss when not busy
 * - Focus trap is NOT yet implemented — to be added in a separate PR.
 *   Users navigating with Tab will currently escape the modal into the
 *   background page. Avoid using this component for forms where escaping
 *   the modal would be a data-loss event.
 */
export function CenteredModal({
  title,
  subtitle,
  footer,
  onClose,
  busy = false,
  maxWidth = 420,
  dataTestId,
  cardClassName,
  children
}: CenteredModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [busy, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={TITLE_ID}
      data-testid={dataTestId}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className={cardClassName}
        style={{
          background: "var(--surface-card, #fff)",
          borderRadius: "var(--radius-lg, 12px)",
          padding: 24,
          maxWidth,
          width: "90%",
          boxShadow: "var(--shadow-dropdown, 0 4px 16px rgba(0,0,0,0.10))"
        }}
      >
        <h3 id={TITLE_ID} style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
          {title}
        </h3>
        {subtitle ? (
          <p
            style={{
              marginTop: 8,
              marginBottom: 16,
              color: "var(--text-secondary, #6B7280)",
              fontSize: 14
            }}
          >
            {subtitle}
          </p>
        ) : null}

        {children}

        {footer ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
              marginTop: 24
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
