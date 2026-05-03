import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { deriveContextKey } from "./context-key-helpers";
import type { ActivePersona } from "./types";

type PersonaContextValue = {
  activePersona: ActivePersona | null;
  isLoading: boolean;
  // §5A.1 PR 10: scope key for conversation persistence. Tender id when
  // the active sub-mode is tender-scoped; null otherwise.
  contextKey: string | null;
};

const PersonaContext = createContext<PersonaContextValue>({
  activePersona: null,
  isLoading: false,
  contextKey: null
});

export function PersonaProvider({ children }: PropsWithChildren) {
  const location = useLocation();
  const { authFetch, isAuthenticated } = useAuth();
  const [activePersona, setActivePersona] = useState<ActivePersona | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setActivePersona(null);
      setIsLoading(false);
      return;
    }

    const url = `${location.pathname}${location.search}`;
    let cancelled = false;
    setIsLoading(true);

    authFetch(`/personas/active-for-route?url=${encodeURIComponent(url)}`)
      .then(async (res) => {
        if (!res.ok) return null;
        const text = await res.text();
        if (!text || text === "null") return null;
        try {
          return JSON.parse(text) as ActivePersona | null;
        } catch {
          return null;
        }
      })
      .then((data) => {
        if (!cancelled) setActivePersona(data);
      })
      .catch(() => {
        if (!cancelled) setActivePersona(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authFetch, isAuthenticated, location.pathname, location.search]);

  const contextKey = useMemo(
    () => deriveContextKey(location.pathname, activePersona?.subMode.name),
    [location.pathname, activePersona?.subMode.name]
  );

  return (
    <PersonaContext.Provider value={{ activePersona, isLoading, contextKey }}>{children}</PersonaContext.Provider>
  );
}

export function useActivePersona() {
  return useContext(PersonaContext);
}
