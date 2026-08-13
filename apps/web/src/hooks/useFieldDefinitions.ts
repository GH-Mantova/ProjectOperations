import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";

export interface FieldDefinition {
  id: string;
  key: string;
  label: string;
  group: string;
  sortOrder: number;
  visible: boolean;
  required: boolean;
  appliesTo: "CLIENT" | "VENDOR" | "BOTH";
  source: "BUILTIN" | "CUSTOM";
}

interface CacheEntry {
  data: FieldDefinition[];
  fetchedAt: number;
}

const TTL_MS = 60_000; // 60-second TTL

// Module-level cache so repeated calls within the same session share results.
const cache = new Map<string, CacheEntry>();

/**
 * Fetches field definitions for the given `appliesTo` value from
 * `GET /field-definitions?appliesTo=<CLIENT|VENDOR>`. Results are cached for
 * 60 seconds per appliesTo key so back-to-back renders do not pound the API.
 *
 * The hook does NOT cache across `authFetch` identity changes (i.e. user
 * log-out / log-in) because `authFetch` is recreated on each AuthProvider
 * mount, which causes `useCallback` deps to differ and re-fetches naturally.
 */
export function useFieldDefinitions(appliesTo: "CLIENT" | "VENDOR"): {
  definitions: FieldDefinition[];
  loading: boolean;
  error: string | null;
} {
  const { authFetch } = useAuth();
  const [definitions, setDefinitions] = useState<FieldDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track whether the component is still mounted so we skip stale set-state calls.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    const cacheKey = appliesTo;
    const now = Date.now();
    const hit = cache.get(cacheKey);
    if (hit && now - hit.fetchedAt < TTL_MS) {
      if (mountedRef.current) {
        setDefinitions(hit.data);
        setLoading(false);
        setError(null);
      }
      return;
    }

    if (mountedRef.current) setLoading(true);
    try {
      const res = await authFetch(`/field-definitions?appliesTo=${appliesTo}`);
      if (!res.ok) {
        throw new Error(`Failed to load field definitions (${res.status})`);
      }
      const data = (await res.json()) as FieldDefinition[];
      cache.set(cacheKey, { data, fetchedAt: Date.now() });
      if (mountedRef.current) {
        setDefinitions(data);
        setError(null);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [authFetch, appliesTo]);

  useEffect(() => {
    void load();
  }, [load]);

  return { definitions, loading, error };
}
