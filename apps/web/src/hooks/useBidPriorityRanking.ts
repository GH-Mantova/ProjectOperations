// BP-2 — hook for GET /tenders/priority-ranking.
// Calls the existing API via authFetch (matching all other tendering data
// hooks in the repo). Returns { data, isLoading, error }.
// ADVISORY ONLY — results must never feed pricing or acceptance decisions.

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export type BidPriorityItem = {
  tenderId: string;
  title: string;
  client: string;
  estimatedValue: string | null;
  dueDate: string | null;
  pointEstimate: number | null;
  confidence: "LOW" | "MEDIUM" | "HIGH" | null;
  expectedValueScore: number | null;
  whyFactors: string[];
  insufficientData: boolean;
};

type UseBidPriorityRankingResult = {
  data: BidPriorityItem[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
};

export function useBidPriorityRanking(): UseBidPriorityRankingResult {
  const { authFetch } = useAuth();
  const [data, setData] = useState<BidPriorityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch("/tenders/priority-ranking");
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Request failed (${response.status})`);
      }
      const body = (await response.json()) as BidPriorityItem[];
      setData(body);
    } catch (err) {
      setError((err as Error).message ?? "Failed to load bid priority ranking");
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, isLoading, error, reload: load };
}
