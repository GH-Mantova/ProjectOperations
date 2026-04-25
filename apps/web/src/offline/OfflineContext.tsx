import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";
import { useAuth } from "../auth/AuthContext";
import { countPending } from "./db";
import { buildOfflineFetch, flushQueue, type OfflineCapableFetch, type SyncResult } from "./syncManager";

type OfflineValue = {
  online: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  syncing: boolean;
  flush: () => Promise<SyncResult | null>;
  offlineFetch: OfflineCapableFetch;
};

const OfflineContext = createContext<OfflineValue | undefined>(undefined);

export function OfflineProvider({ children }: PropsWithChildren) {
  const { authFetch, isAuthenticated } = useAuth();
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const inflightRef = useRef(false);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingCount(await countPending());
    } catch {
      // ignore — IndexedDB may not be available in private mode
    }
  }, []);

  const flush = useCallback(async () => {
    if (!isAuthenticated || inflightRef.current) return null;
    inflightRef.current = true;
    setSyncing(true);
    try {
      const result = await flushQueue(authFetch);
      setLastSyncAt(Date.now());
      await refreshPendingCount();
      return result;
    } finally {
      inflightRef.current = false;
      setSyncing(false);
    }
  }, [authFetch, isAuthenticated, refreshPendingCount]);

  useEffect(() => {
    void refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOnline = () => {
      setOnline(true);
      void flush();
    };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [flush]);

  // Initial sync on mount once authenticated, in case the user came back online
  // before the listener was attached.
  useEffect(() => {
    if (isAuthenticated && online) void flush();
  }, [isAuthenticated, online, flush]);

  const offlineFetch = useMemo<OfflineCapableFetch>(() => {
    const wrapped = buildOfflineFetch(authFetch);
    return async (url, init, kind) => {
      const result = await wrapped(url, init, kind);
      await refreshPendingCount();
      return result;
    };
  }, [authFetch, refreshPendingCount]);

  const value = useMemo<OfflineValue>(
    () => ({ online, pendingCount, lastSyncAt, syncing, flush, offlineFetch }),
    [online, pendingCount, lastSyncAt, syncing, flush, offlineFetch]
  );

  return <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>;
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used inside OfflineProvider");
  return ctx;
}
