import { useEffect, useMemo, useRef, useState } from "react";
import { CenteredModal } from "@project-ops/ui";

export type ConfirmVariant = "default" | "danger";

export interface ConfirmDialogInput {
  defaultValue?: string;
  placeholder?: string;
  multiline?: boolean;
  validate?: (value: string) => string | null;
}

export interface ConfirmDialogProps {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  /** When true, hide the cancel button and don't resolve false on backdrop/Esc — used by alert(). */
  alertOnly?: boolean;
  /** When set, render a text input (or textarea when multiline). The current value is passed to onConfirm. */
  input?: ConfirmDialogInput;
  onConfirm: (value?: string) => void;
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
  input,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [inputValue, setInputValue] = useState(input?.defaultValue ?? "");

  const validationError = useMemo(
    () => (input?.validate ? input.validate(inputValue) : null),
    [input, inputValue]
  );

  const submitRef = useRef<() => void>(() => {});
  submitRef.current = () => {
    if (input) {
      if (validationError) return;
      onConfirm(inputValue);
    } else {
      onConfirm();
    }
  };

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    if (input) {
      inputRef.current?.focus();
    } else {
      confirmBtnRef.current?.focus();
    }
    return () => {
      previouslyFocused.current?.focus?.();
    };
  }, [input]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        if (target && target.tagName === "TEXTAREA") return;
        event.preventDefault();
        submitRef.current();
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
  }, []);

  const confirmClass =
    variant === "danger" ? "s7-btn s7-btn--danger" : "s7-btn s7-btn--primary";
  const confirmDisabled = Boolean(input && validationError);

  const handleConfirmClick = () => submitRef.current();

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
            onClick={handleConfirmClick}
            disabled={confirmDisabled}
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
      {input ? (
        <div style={{ marginTop: message ? 12 : 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {input.multiline ? (
            <textarea
              ref={(el) => {
                inputRef.current = el;
              }}
              value={inputValue}
              placeholder={input.placeholder}
              onChange={(event) => setInputValue(event.target.value)}
              data-testid="confirm-dialog-input"
              rows={4}
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border-default, #D1D5DB)",
                borderRadius: 6,
                fontFamily: "inherit",
                fontSize: 14,
                resize: "vertical"
              }}
            />
          ) : (
            <input
              ref={(el) => {
                inputRef.current = el;
              }}
              type="text"
              value={inputValue}
              placeholder={input.placeholder}
              onChange={(event) => setInputValue(event.target.value)}
              data-testid="confirm-dialog-input"
              style={{
                width: "100%",
                padding: "8px 10px",
                border: "1px solid var(--border-default, #D1D5DB)",
                borderRadius: 6,
                fontFamily: "inherit",
                fontSize: 14
              }}
            />
          )}
          {validationError ? (
            <p
              role="alert"
              data-testid="confirm-dialog-error"
              style={{ margin: 0, fontSize: 12, color: "var(--status-danger, #B91C1C)" }}
            >
              {validationError}
            </p>
          ) : null}
        </div>
      ) : null}
    </CenteredModal>
  );
}
