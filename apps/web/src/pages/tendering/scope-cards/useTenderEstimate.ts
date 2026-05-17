import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";

// PR B2 — minimal hook for the tender-level markup picker. Reads
// /tenders/:id/estimate on mount (null when no estimate row exists yet
// — treat that as the default markup of 30) and writes via PATCH. The
// API endpoint upserts the TenderEstimate row on first PATCH, so we
// don't need a separate POST step.

export type TenderEstimate = {
  markup: number;
  notes: string | null;
};

const DEFAULT_TENDER_MARKUP = 30;

export function useTenderEstimate(tenderId: string) {
  const { authFetch } = useAuth();
  const [markup, setMarkup] = useState<number>(DEFAULT_TENDER_MARKUP);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(`/tenders/${tenderId}/estimate`);
      if (!res.ok) {
        // No estimate row yet — that's normal for a fresh tender.
        if (res.status === 404) {
          setMarkup(DEFAULT_TENDER_MARKUP);
          return;
        }
        throw new Error(await res.text());
      }
      const body = (await res.json()) as Partial<TenderEstimate> | null;
      if (body && typeof body.markup !== "undefined") {
        setMarkup(Number(body.markup));
      } else {
        setMarkup(DEFAULT_TENDER_MARKUP);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [authFetch, tenderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveMarkup = useCallback(
    async (next: number): Promise<void> => {
      const res = await authFetch(`/tenders/${tenderId}/estimate`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markup: String(next) })
      });
      if (!res.ok) throw new Error(await res.text());
      setMarkup(next);
    },
    [authFetch, tenderId]
  );

  return { markup, loading, error, saveMarkup, reload: load };
}
