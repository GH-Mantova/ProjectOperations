import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { ConfirmDialog, type ConfirmVariant } from "../components/ConfirmDialog";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
}

export interface AlertOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
}

export interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  multiline?: boolean;
  validate?: (value: string) => string | null;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type DialogState =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void }
  | { kind: "prompt"; options: PromptOptions; resolve: (value: string | null) => void };

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setState({ kind: "confirm", options, resolve });
    });
  }, []);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setState({ kind: "alert", options, resolve: () => resolve() });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setState({ kind: "prompt", options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(
    (value?: string) => {
      if (!state) return;
      if (state.kind === "confirm") state.resolve(true);
      else if (state.kind === "prompt") state.resolve(value ?? "");
      else state.resolve();
      setState(null);
    },
    [state]
  );

  const handleCancel = useCallback(() => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(false);
    else if (state.kind === "prompt") state.resolve(null);
    else state.resolve();
    setState(null);
  }, [state]);

  const value = useMemo<ConfirmContextValue>(
    () => ({ confirm, alert, prompt }),
    [confirm, alert, prompt]
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state ? (
        state.kind === "confirm" ? (
          <ConfirmDialog
            title={state.options.title}
            message={state.options.message}
            confirmLabel={state.options.confirmLabel}
            cancelLabel={state.options.cancelLabel}
            variant={state.options.variant ?? "default"}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        ) : state.kind === "alert" ? (
          <ConfirmDialog
            title={state.options.title}
            message={state.options.message}
            confirmLabel={state.options.confirmLabel ?? "OK"}
            variant="default"
            alertOnly
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        ) : (
          <ConfirmDialog
            title={state.options.title}
            message={state.options.message}
            confirmLabel={state.options.confirmLabel}
            cancelLabel={state.options.cancelLabel}
            variant="default"
            input={{
              defaultValue: state.options.defaultValue,
              placeholder: state.options.placeholder,
              multiline: state.options.multiline,
              validate: state.options.validate
            }}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): (options: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx.confirm;
}

export function useAlert(): (options: AlertOptions) => Promise<void> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useAlert must be used within a ConfirmProvider");
  return ctx.alert;
}

export function usePrompt(): (options: PromptOptions) => Promise<string | null> {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("usePrompt must be used within a ConfirmProvider");
  return ctx.prompt;
}
