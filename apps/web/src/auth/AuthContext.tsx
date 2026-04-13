import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Array<{ id: string; name: string; description?: string | null }>;
  permissions: string[];
};

type AuthContextValue = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SafeUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredState() {
  return {
    accessToken: localStorage.getItem("project-ops.accessToken"),
    refreshToken: localStorage.getItem("project-ops.refreshToken"),
    user: localStorage.getItem("project-ops.user")
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const storedState = readStoredState();
  const [accessToken, setAccessToken] = useState<string | null>(storedState.accessToken);
  const [refreshToken, setRefreshToken] = useState<string | null>(storedState.refreshToken);
  const [user, setUser] = useState<SafeUser | null>(
    storedState.user ? (JSON.parse(storedState.user) as SafeUser) : null
  );

  useEffect(() => {
    if (accessToken) localStorage.setItem("project-ops.accessToken", accessToken);
    else localStorage.removeItem("project-ops.accessToken");

    if (refreshToken) localStorage.setItem("project-ops.refreshToken", refreshToken);
    else localStorage.removeItem("project-ops.refreshToken");

    if (user) localStorage.setItem("project-ops.user", JSON.stringify(user));
    else localStorage.removeItem("project-ops.user");
  }, [accessToken, refreshToken, user]);

  const logout = () => {
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  };

  const login = async (email: string, password: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      throw new Error("Unable to login.");
    }

    const data = await response.json();
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  };

  const authFetch = async (input: string, init: RequestInit = {}) => {
    const request = async (token: string | null) =>
      fetch(`${API_BASE_URL}${input}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      });

    let response = await request(accessToken);

    if (response.status === 401 && refreshToken) {
      const refreshResponse = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ refreshToken })
      });

      if (!refreshResponse.ok) {
        logout();
        throw new Error("Session expired.");
      }

      const refreshed = await refreshResponse.json();
      setAccessToken(refreshed.accessToken);
      setRefreshToken(refreshed.refreshToken);
      setUser(refreshed.user);

      response = await request(refreshed.accessToken);
    }

    return response;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: Boolean(accessToken && user),
      login,
      logout,
      authFetch
    }),
    [accessToken, refreshToken, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
