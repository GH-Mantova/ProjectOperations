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

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions) => Promise<void>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type DialogState =
  | { kind: "confirm"; options: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "alert"; options: AlertOptions; resolve: () => void };

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

  const handleConfirm = useCallback(() => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(true);
    else state.resolve();
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    if (!state) return;
    if (state.kind === "confirm") state.resolve(false);
    else state.resolve();
    setState(null);
  }, [state]);

  const value = useMemo<ConfirmContextValue>(() => ({ confirm, alert }), [confirm, alert]);

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
        ) : (
          <ConfirmDialog
            title={state.options.title}
            message={state.options.message}
            confirmLabel={state.options.confirmLabel ?? "OK"}
            variant="default"
            alertOnly
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
