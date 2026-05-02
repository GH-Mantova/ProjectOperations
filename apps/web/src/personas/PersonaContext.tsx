import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren
} from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { ActivePersona } from "./types";

type PersonaContextValue = {
  activePersona: ActivePersona | null;
  isLoading: boolean;
};

const PersonaContext = createContext<PersonaContextValue>({
  activePersona: null,
  isLoading: false
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

  return (
    <PersonaContext.Provider value={{ activePersona, isLoading }}>{children}</PersonaContext.Provider>
  );
}

export function useActivePersona() {
  return useContext(PersonaContext);
}
