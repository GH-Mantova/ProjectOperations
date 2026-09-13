/**
 * useCapacityBoard
 *
 * Fetches GET /tenders/capacity-board and exposes mutation helpers for all
 * allocation actions. Follows the same authFetch + useEffect pattern used
 * by useFieldDefinitions and useSafetyRealtime.
 *
 * No React Query dependency — the project uses plain authFetch hooks.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

// ── Response shape mirrors CapacityService interfaces (capacity.service.ts) ──

export interface EstimatorSummary {
  userId: string;
  displayName: string;
  load: number;
  effectiveCap: number;
  utilizationPct: number;
  isOverloaded: boolean;
  openTenderCount: number;
  availabilityPct: number;
  concurrentCap: number;
  isActive: boolean;
}

export interface UnallocatedBoardTender {
  tenderId: string;
  tenderNumber: string;
  title: string;
  dueDate: string | null;
  estimatedValue: string | null;
  urgencyKey: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  sizeBand: "XS" | "S" | "M" | "L";
  load: number;
  suggestedEstimatorId: string | null;
}

export interface CapacityBoard {
  estimators: EstimatorSummary[];
  unallocated: UnallocatedBoardTender[];
}

export interface AllocatorDelegate {
  id: string;
  delegateId: string;
  delegateName: string;
  grantedById: string;
  grantedByName: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

// ── Hook state ────────────────────────────────────────────────────────────────

export interface UseCapacityBoardResult {
  board: CapacityBoard | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  // Mutations
  allocateSingle: (tenderId: string, estimatorId: string) => Promise<void>;
  allocatePool: (tenderId: string, estimatorIds: string[]) => Promise<void>;
  selfClaim: (tenderId: string) => Promise<void>;
  override: (tenderId: string, estimatorId: string) => Promise<void>;
  pushBack: (tenderId: string) => Promise<void>;
  updateCapacity: (userId: string, availabilityPct?: number, concurrentCap?: number) => Promise<void>;
  // Delegate CRUD
  listDelegates: () => Promise<AllocatorDelegate[]>;
  createDelegate: (delegateId: string, startDate: string, endDate: string) => Promise<AllocatorDelegate>;
  deleteDelegate: (id: string) => Promise<void>;
}

export function useCapacityBoard(): UseCapacityBoardResult {
  const { authFetch } = useAuth();
  const [board, setBoard] = useState<CapacityBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void authFetch("/tenders/capacity-board")
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Failed to load capacity board (${res.status}): ${text}`);
        }
        const data = (await res.json()) as CapacityBoard;
        if (!cancelled && mountedRef.current) {
          setBoard(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && mountedRef.current) {
          setError((err as Error).message ?? "Unknown error");
        }
      })
      .finally(() => {
        if (!cancelled && mountedRef.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, tick]);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const allocateSingle = useCallback(
    async (tenderId: string, estimatorId: string) => {
      const res = await authFetch(`/tenders/allocations/${tenderId}/allocate-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatorId })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`allocate-single failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  const allocatePool = useCallback(
    async (tenderId: string, estimatorIds: string[]) => {
      const res = await authFetch(`/tenders/allocations/${tenderId}/allocate-pool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatorIds })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`allocate-pool failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  const selfClaim = useCallback(
    async (tenderId: string) => {
      const res = await authFetch(`/tenders/allocations/${tenderId}/self-claim`, {
        method: "POST"
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`self-claim failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  const override = useCallback(
    async (tenderId: string, estimatorId: string) => {
      const res = await authFetch(`/tenders/allocations/${tenderId}/override`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimatorId })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`override failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  const pushBack = useCallback(
    async (tenderId: string) => {
      const res = await authFetch(`/tenders/allocations/${tenderId}/push-back`, {
        method: "POST"
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`push-back failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  const updateCapacity = useCallback(
    async (userId: string, availabilityPct?: number, concurrentCap?: number) => {
      const body: Record<string, number> = {};
      if (availabilityPct !== undefined) body.availabilityPct = availabilityPct;
      if (concurrentCap !== undefined) body.concurrentCap = concurrentCap;
      const res = await authFetch(`/tenders/capacity-board/estimators/${userId}/capacity`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`updateCapacity failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  // ── Delegate window helpers ───────────────────────────────────────────────

  const listDelegates = useCallback(async (): Promise<AllocatorDelegate[]> => {
    const res = await authFetch("/tenders/allocations/delegates");
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`listDelegates failed (${res.status}): ${text}`);
    }
    return (await res.json()) as AllocatorDelegate[];
  }, [authFetch]);

  const createDelegate = useCallback(
    async (delegateId: string, startDate: string, endDate: string): Promise<AllocatorDelegate> => {
      const res = await authFetch("/tenders/allocations/delegates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ delegateId, startDate, endDate })
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`createDelegate failed (${res.status}): ${text}`);
      }
      return (await res.json()) as AllocatorDelegate;
    },
    [authFetch]
  );

  const deleteDelegate = useCallback(
    async (id: string): Promise<void> => {
      const res = await authFetch(`/tenders/allocations/delegates/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`deleteDelegate failed (${res.status}): ${text}`);
      }
    },
    [authFetch]
  );

  return {
    board,
    loading,
    error,
    refetch,
    allocateSingle,
    allocatePool,
    selfClaim,
    override,
    pushBack,
    updateCapacity,
    listDelegates,
    createDelegate,
    deleteDelegate
  };
}
