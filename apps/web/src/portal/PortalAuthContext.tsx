import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

type PortalUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  clientId: string;
  client: { id: string; name: string };
};

type PortalAuthValue = {
  accessToken: string | null;
  user: PortalUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const PortalAuthContext = createContext<PortalAuthValue | undefined>(undefined);

const KEY_ACCESS = "project-ops.portal.accessToken";
const KEY_REFRESH = "project-ops.portal.refreshToken";
const KEY_USER = "project-ops.portal.user";

export function PortalAuthProvider({ children }: PropsWithChildren) {
  const [accessToken, setAccessToken] = useState<string | null>(localStorage.getItem(KEY_ACCESS));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem(KEY_REFRESH));
  const [user, setUser] = useState<PortalUser | null>(() => {
    const raw = localStorage.getItem(KEY_USER);
    return raw ? (JSON.parse(raw) as PortalUser) : null;
  });

  useEffect(() => {
    if (accessToken) localStorage.setItem(KEY_ACCESS, accessToken);
    else localStorage.removeItem(KEY_ACCESS);
    if (refreshToken) localStorage.setItem(KEY_REFRESH, refreshToken);
    else localStorage.removeItem(KEY_REFRESH);
    if (user) localStorage.setItem(KEY_USER, JSON.stringify(user));
    else localStorage.removeItem(KEY_USER);
  }, [accessToken, refreshToken, user]);

  const setSession = useCallback(
    (data: { accessToken: string; refreshToken: string; user: PortalUser }) => {
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUser(data.user);
    },
    []
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/portal/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Login failed");
      }
      const body = await response.json();
      setSession(body);
    },
    [setSession]
  );

  const acceptInvite = useCallback(
    async (token: string, password: string) => {
      const response = await fetch(`${API_BASE_URL}/portal/auth/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password })
      });
      if (!response.ok) throw new Error(await response.text());
      const body = await response.json();
      setSession(body);
    },
    [setSession]
  );

  const logout = useCallback(async () => {
    if (refreshToken) {
      await fetch(`${API_BASE_URL}/portal/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      }).catch(() => undefined);
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, [refreshToken]);

  const authFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers ?? {});
      if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
      if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
      const response = await fetch(`${API_BASE_URL}${input}`, { ...init, headers });
      if (response.status === 401) {
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
      }
      return response;
    },
    [accessToken]
  );

  const value = useMemo<PortalAuthValue>(
    () => ({
      accessToken,
      user,
      isAuthenticated: Boolean(accessToken && user),
      login,
      acceptInvite,
      logout,
      authFetch
    }),
    [accessToken, user, login, acceptInvite, logout, authFetch]
  );

  return <PortalAuthContext.Provider value={value}>{children}</PortalAuthContext.Provider>;
}

export function usePortalAuth() {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) throw new Error("usePortalAuth must be used inside PortalAuthProvider");
  return ctx;
}
