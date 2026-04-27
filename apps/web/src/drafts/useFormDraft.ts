import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { FormDraftStore, SensitiveFieldError } from "./FormDraftStore";

// PR #111 — manual save + auto-save on visibilitychange. The hook
// deliberately stays opt-in: a form must invoke this hook to get drafts.
// Login / password / portal-auth forms simply do not call it.

export type UseFormDraftOptions<T> = {
  formType: string;
  contextKey: string | null;
  schemaVersion: number;
  // Caller wires these to the form library it's already using
  // (controlled-state hooks, react-hook-form, whatever).
  getValues: () => T;
  setValues: (data: T) => void;
  // Optional: caller can short-circuit auto-save when the form isn't
  // dirty. Defaults to "always save on visibilitychange" if absent —
  // safer to over-save than to lose data.
  isDirty?: () => boolean;
  // Optional: called when save() detects an existing draft. Return
  // true to overwrite, false to abort. If omitted, save overwrites
  // unconditionally (the typical UX shows the dialog before calling
  // save again with confirmAction=true).
  onOverwriteConfirm?: (existingUpdatedAt: number) => Promise<boolean>;
};

export type UseFormDraftResult = {
  hasDraft: boolean;
  lastSavedAt: Date | null;
  saveDraft: () => Promise<void>;
  restoreDraft: () => Promise<void>;
  discardDraft: () => Promise<void>;
};

export function useFormDraft<T>({
  formType,
  contextKey,
  schemaVersion,
  getValues,
  setValues,
  isDirty,
  onOverwriteConfirm
}: UseFormDraftOptions<T>): UseFormDraftResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs so the visibilitychange listener (attached once per
  // userId/formType) always sees the latest getValues / isDirty
  // closures without re-binding on every render.
  const getValuesRef = useRef(getValues);
  const isDirtyRef = useRef(isDirty);
  const contextKeyRef = useRef(contextKey);
  useEffect(() => {
    getValuesRef.current = getValues;
    isDirtyRef.current = isDirty;
    contextKeyRef.current = contextKey;
  }, [getValues, isDirty, contextKey]);

  // On mount (and whenever userId/formType changes): check if a draft
  // exists. Don't auto-restore — the form renders <DraftBanner /> and
  // the user opts in.
  useEffect(() => {
    if (!userId || !formType) {
      setHasDraft(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const row = await FormDraftStore.get(userId, formType);
        if (cancelled) return;
        setHasDraft(Boolean(row));
        setLastSavedAt(row ? new Date(row.updatedAt) : null);
      } catch {
        // IndexedDB unavailable (private mode, quota, disabled)
        // — fail closed: no draft state, no banner, no save.
        if (!cancelled) setHasDraft(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, formType]);

  const saveDraft = useCallback(async () => {
    if (!userId || !formType) return;
    try {
      const existing = await FormDraftStore.get(userId, formType);
      if (existing && onOverwriteConfirm) {
        const ok = await onOverwriteConfirm(existing.updatedAt);
        if (!ok) return;
      }
      const data = getValuesRef.current();
      await FormDraftStore.save(userId, formType, contextKeyRef.current, data, schemaVersion);
      setHasDraft(true);
      setLastSavedAt(new Date());
    } catch (err) {
      if (err instanceof SensitiveFieldError) {
        // Surface to caller via console — and re-throw so the UI can
        // toast the failure. The denylist guard is a safety net, not
        // an expected user path.
        console.error("[form-drafts] sensitive field detected, draft NOT saved:", err.message);
        throw err;
      }
      // Quiet on storage errors (private mode etc.) — the form still
      // works without drafts. Log in dev only.
      if (import.meta.env?.DEV) console.warn("[form-drafts] save failed:", err);
    }
  }, [userId, formType, schemaVersion, onOverwriteConfirm]);

  const restoreDraft = useCallback(async () => {
    if (!userId || !formType) return;
    try {
      const row = await FormDraftStore.get(userId, formType);
      if (!row) return;
      setValues(row.data as T);
    } catch (err) {
      if (import.meta.env?.DEV) console.warn("[form-drafts] restore failed:", err);
    }
  }, [userId, formType, setValues]);

  const discardDraft = useCallback(async () => {
    if (!userId || !formType) return;
    try {
      await FormDraftStore.delete(userId, formType);
      setHasDraft(false);
      setLastSavedAt(null);
    } catch (err) {
      if (import.meta.env?.DEV) console.warn("[form-drafts] discard failed:", err);
    }
  }, [userId, formType]);

  // Auto-save when the page goes hidden (tab switch, app backgrounded
  // on mobile). Skip if the form isn't dirty (when the caller provides
  // an isDirty signal). Save without prompting — overwrite confirm is
  // a manual-save concern, not an auto-save one.
  useEffect(() => {
    if (!userId || !formType) return;
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState !== "hidden") return;
      const dirty = isDirtyRef.current ? isDirtyRef.current() : true;
      if (!dirty) return;
      void (async () => {
        try {
          const data = getValuesRef.current();
          await FormDraftStore.save(userId, formType, contextKeyRef.current, data, schemaVersion);
          setHasDraft(true);
          setLastSavedAt(new Date());
        } catch (err) {
          // Silent — visibilitychange fires during navigation away,
          // and we don't want to spam the console as the user closes
          // the tab. Sensitive-field errors are still logged in save.
          if (import.meta.env?.DEV) console.warn("[form-drafts] auto-save failed:", err);
        }
      })();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [userId, formType, schemaVersion]);

  return { hasDraft, lastSavedAt, saveDraft, restoreDraft, discardDraft };
}
