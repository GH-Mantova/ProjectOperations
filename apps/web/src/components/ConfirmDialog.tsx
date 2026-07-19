import { useEffect, useRef } from "react";
import { CenteredModal } from "@project-ops/ui";

export type ConfirmVariant = "default" | "danger";

export interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** When true, hide the cancel button and don't resolve false on backdrop/Esc — used by alert(). */
  alertOnly?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function isFocusable(el: Element): el is HTMLElement {
  if (!(el instanceof HTMLElement)) return false;
  if (el.hasAttribute("disabled")) return false;
  const tabIndex = el.getAttribute("tabindex");
  return tabIndex === null || Number(tabIndex) >= 0;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  alertOnly = false,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    confirmBtnRef.current?.focus();
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target && target.tagName === "TEXTAREA") return;
        event.preventDefault();
        onConfirm();
        return;
      }
      if (event.key !== "Tab") return;
      const root = document.querySelector<HTMLElement>('[data-testid="confirm-dialog"]');
      if (!root) return;
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter(isFocusable);
      if (candidates.length === 0) return;
      const first = candidates[0];
      const last = candidates[candidates.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !root.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !root.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onConfirm]);

  const confirmClass =
    variant === "danger" ? "s7-btn s7-btn--danger" : "s7-btn s7-btn--primary";

  return (
    <CenteredModal
      title={title}
      onClose={onCancel}
      dataTestId="confirm-dialog"
      cardClassName="confirm-dialog__card"
      footer={
        <>
          {alertOnly ? null : (
            <button type="button" className="s7-btn s7-btn--ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            className={confirmClass}
            onClick={onConfirm}
            data-testid="confirm-dialog-confirm"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {message ? (
        <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary, #4B5563)" }}>
          {message}
        </p>
      ) : null}
    </CenteredModal>
  );
}
