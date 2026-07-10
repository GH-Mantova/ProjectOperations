import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren
} from "react";

import { readApiErrorMessage } from "../lib/api-errors";
import { updatePromptStore } from "../pwa/updatePromptStore";
import { buildInfo } from "../buildInfo";
import { getMsalInstance } from "./msalInstance";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

function notifyIfUpdateRequested(response: Response): void {
  if (response.headers.get("X-Update-Requested") === "1") {
    updatePromptStore.signalNeedRefresh();
  }
}

type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  isSuperUser?: boolean;
  roles: Array<{ id: string; name: string; description?: string | null }>;
  permissions: string[];
};

type AuthContextValue = {
  accessToken: string | null;
  refreshToken: string | null;
  user: SafeUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ requiresPasswordReset?: boolean; tempToken?: string }>;
  resetPassword: (tempToken: string, newPassword: string) => Promise<void>;
  loginWithSso: (idToken: string) => Promise<void>;
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
    // Shared-computer scenario: clear the MSAL account cache so the next
    // "Sign in with Microsoft" click starts fresh instead of silently
    // reusing the previous user's cached Microsoft account. This is a
    // local cache clear only — no full Microsoft sign-out redirect.
    const msal = getMsalInstance();
    if (msal) {
      void msal
        .initialize()
        .then(async () => {
          for (const account of msal.getAllAccounts()) {
            try {
              await msal.clearCache({ account });
            } catch {
              // best-effort — the visible outcome we care about (account
              // picker on next SSO) still fires because of prompt=select_account
            }
          }
        })
        .catch(() => {
          // Never let logout throw — the app-session clear above is
          // authoritative for the user's local state.
        });
    }
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
      throw new Error(await readApiErrorMessage(response, "Unable to login."));
    }

    const data = await response.json();
    if (data.requiresPasswordReset) {
      return { requiresPasswordReset: true as const, tempToken: data.tempToken as string };
    }
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    return {};
  };

  const resetPassword = async (tempToken: string, newPassword: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tempToken, newPassword })
    });
    if (!response.ok) {
      throw new Error(await readApiErrorMessage(response, "Unable to reset password."));
    }
    const data = await response.json();
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  };

  const loginWithSso = async (idToken: string) => {
    const response = await fetch(`${API_BASE_URL}/auth/sso`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idToken })
    });

    if (!response.ok) {
      // Gated-SSO signal: stash the idToken + identity so the LoginPage
      // can render the request-access screen instead of a blank error.
      if (response.status === 403) {
        const body = await response.clone().json().catch(() => null);
        if (
          body &&
          typeof body === "object" &&
          (body as { code?: unknown }).code === "ENTRA_NOT_REGISTERED"
        ) {
          const pending = {
            email: String((body as { email?: unknown }).email ?? ""),
            displayName:
              typeof (body as { displayName?: unknown }).displayName === "string"
                ? (body as { displayName: string }).displayName
                : null,
            idToken
          };
          localStorage.setItem("project-ops.entraPendingAccess", JSON.stringify(pending));
        }
      }
      throw new Error(await readApiErrorMessage(response, "Microsoft sign-in failed."));
    }

    const data = await response.json();
    localStorage.removeItem("project-ops.entraPendingAccess");
    setAccessToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
  };

  const authFetch = async (input: string, init: RequestInit = {}) => {
    const isFormData = typeof FormData !== "undefined" && init.body instanceof FormData;
    const request = async (token: string | null) =>
      fetch(`${API_BASE_URL}${input}`, {
        ...init,
        headers: {
          ...(isFormData ? {} : { "Content-Type": "application/json" }),
          ...(init.headers ?? {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "X-Client-Version": buildInfo.sha
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

    notifyIfUpdateRequested(response);
    return response;
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken,
      refreshToken,
      user,
      isAuthenticated: Boolean(accessToken && user),
      login,
      resetPassword,
      loginWithSso,
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
